import {
  addDoc,
  collection,
  deleteField,
  documentId,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth } from '../firebaseAuth';
import { db } from '../firebaseDb';
import type { Act, ActTemplate, Activity, Asset, Assignment, Invoice, Quote, Site, Supplier, Maintenance } from '../types';

export interface QueryFilters {
  siteId?: string;
  startDate?: string;
  endDate?: string;
  supplierId?: string;
  assetId?: string;
  status?: string;
}

type SiteScope = 'none' | 'documentId' | 'siteId';

type AccessContext = {
  active: boolean;
  global: boolean;
  siteIds: string[];
};

const resolveActorUid = (providedUid?: string) => {
  const authenticatedUid = auth.currentUser?.uid;
  if (!authenticatedUid) {
    throw new Error('No hay una sesión autenticada para realizar esta operación.');
  }
  if (providedUid && providedUid !== authenticatedUid) {
    throw new Error('El usuario de auditoría no coincide con la sesión activa.');
  }
  return authenticatedUid;
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

const getAccessContext = async (): Promise<AccessContext> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return { active: false, global: false, siteIds: [] };

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return { active: false, global: false, siteIds: [] };

    const data = snap.data();
    const active = data.active !== false;
    const siteIds = Array.isArray(data.siteIds)
      ? data.siteIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [];

    return {
      active,
      global: active && data.accessScope !== 'sites',
      siteIds: active ? siteIds : [],
    };
  } catch (error) {
    console.error('Error obteniendo el alcance del usuario:', error);
    return { active: false, global: false, siteIds: [] };
  }
};

const fetchCollection = async <T extends { isDeleted?: boolean }>(
  collectionName: string,
  siteScope: SiteScope = 'none',
): Promise<T[]> => {
  try {
    const access = await getAccessContext();
    if (!access.active) return [];
    if (!access.global && siteScope !== 'none' && access.siteIds.length === 0) return [];

    const constraints = [];
    if (!access.global && siteScope !== 'none') {
      constraints.push(where(siteScope === 'documentId' ? documentId() : 'siteId', 'in', access.siteIds));
    }

    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((snap) => ({ id: snap.id, ...snap.data() } as unknown as T))
      .filter((item) => !item.isDeleted);
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
};

// SITES
export const getSites = () => fetchCollection<Site>('sites', 'documentId');
export const addSite = (data: Omit<Site, 'id'>, actorUid?: string) => addDoc(collection(db, 'sites'), { ...data, createdAt: Date.now(), createdByUid: actorUid });
export const deleteSite = (id: string, actorUid?: string) => {
  const now = Date.now();
  return updateDoc(doc(db, 'sites', id), {
    isDeleted: true,
    deletedAt: now,
    deletedByUid: actorUid,
    updatedAt: now,
    updatedByUid: actorUid,
  });
};
export const updateSite = (id: string, data: Partial<Site>, actorUid?: string) => updateDoc(doc(db, 'sites', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });

// ASSETS
export const getAssets = () => fetchCollection<Asset>('assets', 'siteId');

export const addAsset = async (data: Omit<Asset, 'id' | 'fixedAssetId'>, actorUid?: string) => {
  const resolvedActorUid = resolveActorUid(actorUid);
  const siteRef = doc(db, 'sites', data.siteId);
  const assetRef = doc(collection(db, 'assets'));

  return runTransaction(db, async (tx) => {
    const siteSnap = await tx.get(siteRef);
    if (!siteSnap.exists()) {
      throw new Error('Sede no encontrada.');
    }

    const site = siteSnap.data() as Partial<Site> & { assetSeq?: number };
    const prefix = site.prefix || 'GEN';
    // El consecutivo y el activo se guardan juntos para evitar saltos si una escritura falla.
    const nextSeq = (site.assetSeq ?? 0) + 1;
    const fixedAssetId = `${prefix}-${String(nextSeq).padStart(3, '0')}`;
    const now = Date.now();

    tx.update(siteRef, {
      assetSeq: nextSeq,
      updatedAt: now,
      updatedByUid: resolvedActorUid,
    });
    tx.set(assetRef, {
      ...data,
      fixedAssetId,
      createdAt: now,
      createdByUid: resolvedActorUid,
    });

    return assetRef;
  });
};

export const updateAsset = (id: string, data: Partial<Asset>, actorUid?: string) => {
  const resolvedActorUid = resolveActorUid(actorUid);
  return updateDoc(doc(db, 'assets', id), { ...data, updatedAt: Date.now(), updatedByUid: resolvedActorUid });
};

export const updateAssetAssignment = (id: string, assignment: Assignment, actorUid?: string) => {
  const resolvedActorUid = resolveActorUid(actorUid);
  return updateDoc(doc(db, 'assets', id), {
    currentAssignment: assignment,
    updatedAt: Date.now(),
    updatedByUid: resolvedActorUid,
  });
};

export const decommissionAsset = async (id: string, reason: string, actorUid?: string) => {
  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new Error('El motivo de baja es obligatorio.');
  }

  const now = Date.now();
  const resolvedActorUid = resolveActorUid(actorUid);

  return updateDoc(doc(db, 'assets', id), {
    status: 'baja',
    currentAssignment: null,
    decommissionReason: normalizedReason,
    decommissionedAt: now,
    decommissionedByUid: resolvedActorUid,
    updatedAt: now,
    updatedByUid: resolvedActorUid,
  });
};

export const moveAssetToSite = async (assetId: string, newSiteId: string, actorUid?: string) => {
  const resolvedActorUid = resolveActorUid(actorUid);
  const assetRef = doc(db, 'assets', assetId);
  const siteRef = doc(db, 'sites', newSiteId);

  return runTransaction(db, async (tx) => {
    const assetSnap = await tx.get(assetRef);
    if (!assetSnap.exists()) {
      throw new Error('Activo no encontrado.');
    }
    const asset = assetSnap.data() as Partial<Asset>;
    const currentSiteId = String(asset.siteId || '');
    if (!newSiteId || newSiteId === currentSiteId) {
      return { changed: false, fixedAssetId: String(asset.fixedAssetId || ''), siteId: currentSiteId };
    }

    const siteSnap = await tx.get(siteRef);
    if (!siteSnap.exists()) {
      throw new Error('Sede no encontrada.');
    }
    const site = siteSnap.data() as Partial<Site> & { assetSeq?: number };
    const prefix = String(site.prefix || 'GEN');
    
    const nextSeq = (site.assetSeq ?? 0) + 1;
    const now = Date.now();
    tx.update(siteRef, {
      assetSeq: nextSeq,
      updatedAt: now,
      updatedByUid: resolvedActorUid,
    });

    const newFixedAssetId = `${prefix}-${String(nextSeq).padStart(3, '0')}`;
    const prevFixedAssetId = String(asset.fixedAssetId || '').trim();
    const prevList = Array.isArray((asset as any).previousFixedAssetIds) ? ((asset as any).previousFixedAssetIds as string[]) : [];
    const nextPrevList = prevFixedAssetId
      ? [...prevList.filter((x) => x !== prevFixedAssetId), prevFixedAssetId].slice(-10)
      : prevList;

    tx.update(assetRef, {
      siteId: newSiteId,
      fixedAssetId: newFixedAssetId,
      previousFixedAssetIds: nextPrevList,
      movedAt: now,
      movedFromSiteId: currentSiteId || null,
      updatedAt: now,
      updatedByUid: resolvedActorUid,
    } as any);

    return { changed: true, fixedAssetId: newFixedAssetId, siteId: newSiteId };
  });
};

// ACTIVITIES
export const getActivities = async (filters?: QueryFilters) => {
  try {
    const access = await getAccessContext();
    if (!access.active || (!access.global && access.siteIds.length === 0)) return [];

    const constraints = access.global
      ? [orderBy('date', 'desc')]
      : [where('siteId', 'in', access.siteIds)];
    const q = query(collection(db, 'activities'), ...constraints);
    const snap = await getDocs(q);
    const result = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Activity))
      .filter((item) => !item.isDeleted)
      .filter((item) => {
        if (filters?.siteId && item.siteId !== filters.siteId) return false;
        if (filters?.startDate && item.date < filters.startDate) return false;
        if (filters?.endDate && item.date > filters.endDate) return false;
        if (filters?.assetId && item.assetId !== filters.assetId) return false;
        return true;
      });
    return result.sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
};

export const addActivity = (data: Omit<Activity, 'id'>, actorUid?: string) => addDoc(collection(db, 'activities'), { ...data, createdAt: Date.now(), createdByUid: actorUid });
export const updateActivity = (id: string, data: Partial<Activity>, actorUid?: string) => updateDoc(doc(db, 'activities', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });

// SUPPLIERS
export const getSuppliers = () => fetchCollection<Supplier>('suppliers');
export const addSupplier = (data: Omit<Supplier, 'id'>, actorUid?: string) => addDoc(collection(db, 'suppliers'), { ...data, createdAt: Date.now(), createdByUid: actorUid });
export const updateSupplier = (id: string, data: Partial<Supplier>, actorUid?: string) => updateDoc(doc(db, 'suppliers', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });

// INVOICES
export const getInvoices = async (filters?: QueryFilters) => {
  const all = await fetchCollection<Invoice>('invoices', 'siteId');
  return all.filter((item) => {
    if (filters?.siteId && item.siteId !== filters.siteId) return false;
    if (filters?.startDate && item.date < filters.startDate) return false;
    if (filters?.endDate && item.date > filters.endDate) return false;
    if (filters?.supplierId && item.supplierId !== filters.supplierId) return false;
    if (filters?.status && item.status !== filters.status) return false;
    return true;
  });
};
export const addInvoice = async (data: Omit<Invoice, 'id'>, actorUid?: string) => {
  const finalData = { ...data, status: data.status ?? 'pending', createdAt: Date.now(), createdByUid: actorUid };
  return addDoc(collection(db, 'invoices'), finalData);
};

export const updateInvoice = (id: string, data: Partial<Invoice>, actorUid?: string) =>
  updateDoc(doc(db, 'invoices', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });
export const deleteInvoice = (id: string, actorUid?: string) => {
  const now = Date.now();
  return updateDoc(doc(db, 'invoices', id), {
    isDeleted: true,
    deletedAt: now,
    deletedByUid: actorUid,
    updatedAt: now,
    updatedByUid: actorUid,
  });
};

export const bulkDecommissionAssetsForSite = async (siteId: string, assetIds: string[], actorUid?: string) => {
  const resolvedActorUid = resolveActorUid(actorUid);
  const now = Date.now();
  const reason = 'Baja masiva de equipos en bodega';

  return runTransaction(db, async (tx) => {
    const refs = assetIds.map((id) => doc(db, 'assets', id));
    const snapshots = [];

    for (const ref of refs) {
      snapshots.push(await tx.get(ref));
    }

    snapshots.forEach((snap, index) => {
      if (!snap.exists()) {
        throw new Error('Uno de los activos seleccionados no existe.');
      }

      const asset = snap.data() as Partial<Asset>;
      if (asset.siteId !== siteId || asset.status !== 'bodega') {
        throw new Error('Solo se pueden dar de baja activos en bodega de la sede seleccionada.');
      }

      tx.update(refs[index], {
        status: 'baja',
        currentAssignment: null,
        decommissionReason: reason,
        decommissionedAt: now,
        decommissionedByUid: resolvedActorUid,
        updatedByUid: resolvedActorUid,
        updatedAt: now,
      });
    });
  });
};

// QUOTES (Cotizaciones)
export const getQuotes = async () => {
  try {
    const access = await getAccessContext();
    if (!access.active || (!access.global && access.siteIds.length === 0)) return [];
    const constraints = access.global
      ? [orderBy('date', 'desc')]
      : [where('siteId', 'in', access.siteIds)];
    const q = query(collection(db, 'quotes'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Quote))
      .filter(x => !x.isDeleted)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return [];
  }
};

export const addQuote = (data: Omit<Quote, 'id'>, actorUid?: string) => addDoc(collection(db, 'quotes'), { ...data, createdAt: Date.now(), createdByUid: actorUid });
export const updateQuote = (id: string, data: Partial<Quote>, actorUid?: string) => updateDoc(doc(db, 'quotes', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });
export const deleteQuote = (id: string, actorUid?: string) => {
  const now = Date.now();
  return updateDoc(doc(db, 'quotes', id), {
    isDeleted: true,
    deletedAt: now,
    deletedByUid: actorUid,
    updatedAt: now,
    updatedByUid: actorUid,
  });
};

// ACTS (Actas)
export const getActTemplates = async () => {
  try {
    const access = await getAccessContext();
    if (!access.active) return [];
    const snap = await getDocs(collection(db, 'actTemplates'));
    return snap.docs
      .map((item) => ({ id: item.id, ...item.data() } as ActTemplate))
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  } catch (error) {
    console.error('Error fetching act templates:', error);
    return [];
  }
};

export const upsertActTemplate = async (id: string, data: Partial<ActTemplate>, actorUid?: string) => {
  const resolvedActorUid = resolveActorUid(actorUid);
  const now = Date.now();
  const reference = doc(db, 'actTemplates', id);
  const existing = await getDoc(reference);
  const payload = {
    ...data,
    id,
    updatedAt: now,
    updatedByUid: resolvedActorUid,
    ...(existing.exists() ? {} : { createdAt: now, createdByUid: resolvedActorUid }),
  };
  await setDoc(reference, payload, { merge: true });
};

export const getActs = async () => {
  try {
    const access = await getAccessContext();
    if (!access.active || (!access.global && access.siteIds.length === 0)) return [];
    const constraints = access.global
      ? [orderBy('createdAt', 'desc')]
      : [where('siteId', 'in', access.siteIds)];
    const q = query(collection(db, 'acts'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Act))
      .filter(x => !x.isDeleted)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch (error) {
    console.error('Error fetching acts:', error);
    return [];
  }
};

export const addAct = (data: Omit<Act, 'id'>, actorUid?: string) => addDoc(collection(db, 'acts'), { ...data, createdAt: Date.now(), createdByUid: actorUid });
export const updateAct = (id: string, data: Partial<Act>, actorUid?: string) => updateDoc(doc(db, 'acts', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });
export const updateActContent = async (
  id: string,
  data: Pick<Act, 'recipient' | 'observations' | 'documentDetails'>,
  reason: string,
  actorUid?: string,
) => {
  const resolvedActorUid = resolveActorUid(actorUid);
  const actRef = doc(db, 'acts', id);
  const revisionRef = doc(collection(db, 'acts', id, 'revisions'));
  const editReason = reason.trim() || 'Edición de borrador';

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(actRef);
    if (!snapshot.exists()) throw new Error('El acta ya no existe. Actualiza la lista e inténtalo de nuevo.');

    const current = { id, ...snapshot.data() } as Act;
    if (!['draft', 'issued'].includes(current.status)) {
      throw new Error('Solo se pueden editar actas en borrador o emitidas que aún no estén firmadas.');
    }
    if (current.signedPdf || current.signatureMethod) {
      throw new Error('El acta ya tiene una firma y no se puede modificar.');
    }
    if (current.status === 'issued' && editReason.length < 5) {
      throw new Error('Indique un motivo de al menos 5 caracteres para corregir el acta emitida.');
    }

    const now = Date.now();
    const revision = (current.contentRevision || 1) + 1;
    const before = {
      recipient: current.recipient,
      observations: current.observations || '',
      documentDetails: current.documentDetails || {},
    };
    const after = {
      recipient: data.recipient,
      observations: data.observations || '',
      documentDetails: data.documentDetails || {},
    };
    if (stableJson(before) === stableJson(after)) {
      throw new Error('No hay cambios por guardar. Modifica algún dato antes de guardar.');
    }
    const update: Record<string, unknown> = {
      ...after,
      contentRevision: revision,
      lastEditId: revisionRef.id,
      lastEditedAt: now,
      lastEditedByUid: resolvedActorUid,
      lastEditReason: editReason,
      updatedAt: now,
      updatedByUid: resolvedActorUid,
    };

    if (current.status === 'issued') {
      Object.assign(update, {
        status: 'draft',
        issuedAt: deleteField(),
        generatedPdf: null,
        pdfUrl: null,
        pdfPath: null,
        pdfName: null,
        pdfContentType: null,
        pdfSize: null,
      });
    }

    transaction.update(actRef, update);
    transaction.set(revisionRef, {
      actId: id,
      revision,
      reason: editReason,
      fromStatus: current.status,
      toStatus: current.status === 'issued' ? 'draft' : current.status,
      before,
      after,
      createdAt: now,
      createdByUid: resolvedActorUid,
    });
    return revision;
  });
};
export const deleteAct = (id: string, actorUid?: string) => {
  const now = Date.now();
  return updateDoc(doc(db, 'acts', id), {
    isDeleted: true,
    deletedAt: now,
    deletedByUid: actorUid,
    updatedAt: now,
    updatedByUid: actorUid,
  });
};

// MAINTENANCES
export const getMaintenances = async (filters?: QueryFilters) => {
  const all = await fetchCollection<Maintenance>('maintenances', 'siteId');
  return all.filter((item) => {
    if (filters?.siteId && item.siteId !== filters.siteId) return false;
    if (filters?.startDate && item.scheduledDate && item.scheduledDate < filters.startDate) return false;
    if (filters?.endDate && item.scheduledDate && item.scheduledDate > filters.endDate) return false;
    if (filters?.assetId && item.assetId !== filters.assetId) return false;
    if (filters?.status && item.status !== filters.status) return false;
    return true;
  });
};
export const addMaintenance = (data: Omit<Maintenance, 'id'>, actorUid?: string) => addDoc(collection(db, 'maintenances'), { ...data, createdAt: Date.now(), createdByUid: actorUid });
export const updateMaintenance = (id: string, data: Partial<Maintenance>, actorUid?: string) => updateDoc(doc(db, 'maintenances', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });
export const softDeleteMaintenance = (id: string, actorUid?: string) => {
  const now = Date.now();
  return updateDoc(doc(db, 'maintenances', id), {
    isDeleted: true,
    deletedAt: now,
    deletedByUid: actorUid,
    updatedAt: now,
    updatedByUid: actorUid,
  });
};
