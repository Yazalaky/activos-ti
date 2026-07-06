import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseDb';
import type { Act, Activity, Asset, Invoice, Quote, Site, Supplier, Maintenance } from '../types';

export interface QueryFilters {
  siteId?: string;
  startDate?: string;
  endDate?: string;
  supplierId?: string;
  assetId?: string;
  status?: string;
}

const fetchCollection = async <T extends { isDeleted?: boolean }>(collectionName: string): Promise<T[]> => {
  try {
    const q = query(collection(db, collectionName));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((snap) => ({ id: snap.id, ...snap.data() } as T))
      .filter((item) => !item.isDeleted);
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
};

// SITES
export const getSites = () => fetchCollection<Site>('sites');
export const addSite = (data: Omit<Site, 'id'>, actorUid?: string) => addDoc(collection(db, 'sites'), { ...data, createdAt: Date.now(), createdByUid: actorUid });
export const deleteSite = (id: string, actorUid?: string) => updateDoc(doc(db, 'sites', id), { isDeleted: true, deletedAt: Date.now(), deletedByUid: actorUid });
export const updateSite = (id: string, data: Partial<Site>, actorUid?: string) => updateDoc(doc(db, 'sites', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });

// ASSETS
export const getAssets = () => fetchCollection<Asset>('assets');

const generateNextFixedId = async (siteId: string): Promise<string> => {
  const siteRef = doc(db, 'sites', siteId);
  return runTransaction(db, async (tx) => {
    const siteSnap = await tx.get(siteRef);
    if (!siteSnap.exists()) {
      throw new Error('Sede no encontrada.');
    }
    const data = siteSnap.data() as Partial<Site> & { assetSeq?: number };
    const prefix = data.prefix || 'GEN';

    // No re-utilizamos secuencias para preservar histórico
    const nextSeq = (data.assetSeq ?? 0) + 1;
    tx.update(siteRef, { assetSeq: nextSeq });
    return `${prefix}-${String(nextSeq).padStart(3, '0')}`;
  });
};

export const addAsset = async (data: Omit<Asset, 'id' | 'fixedAssetId'>, actorUid?: string) => {
  const fixedAssetId = await generateNextFixedId(data.siteId);
  const finalData = { ...data, fixedAssetId, createdAt: Date.now(), createdByUid: actorUid };
  return addDoc(collection(db, 'assets'), finalData);
};

export const updateAsset = (id: string, data: Partial<Asset>, actorUid?: string) =>
  updateDoc(doc(db, 'assets', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });

export const moveAssetToSite = async (assetId: string, newSiteId: string) => {
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
    tx.update(siteRef, { assetSeq: nextSeq });

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
      movedAt: Date.now(),
      movedFromSiteId: currentSiteId || null,
    } as any);

    return { changed: true, fixedAssetId: newFixedAssetId, siteId: newSiteId };
  });
};

// ACTIVITIES
export const getActivities = async (filters?: QueryFilters) => {
  try {
    const q = query(collection(db, 'activities'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Activity))
      .filter((item) => !item.isDeleted)
      .filter((item) => {
        if (filters?.siteId && item.siteId !== filters.siteId) return false;
        if (filters?.startDate && item.date < filters.startDate) return false;
        if (filters?.endDate && item.date > filters.endDate) return false;
        if (filters?.assetId && item.assetId !== filters.assetId) return false;
        return true;
      });
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
  const all = await fetchCollection<Invoice>('invoices');
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
export const deleteInvoice = (id: string, actorUid?: string) => updateDoc(doc(db, 'invoices', id), { isDeleted: true, deletedAt: Date.now(), deletedByUid: actorUid });

export const bulkDeleteAssetsForSite = async (siteId: string, assetIds: string[], releasedSeqs: number[], actorUid?: string) => {
  // Ignoramos releasedSeqs para no reutilizar
  return runTransaction(db, async (tx) => {
    assetIds.forEach((id) => {
      tx.update(doc(db, 'assets', id), { isDeleted: true, status: 'baja', deletedAt: Date.now(), deletedByUid: actorUid });
    });
  });
};

// QUOTES (Cotizaciones)
export const getQuotes = async () => {
  try {
    const q = query(collection(db, 'quotes'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quote)).filter(x => !x.isDeleted);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return [];
  }
};

export const addQuote = (data: Omit<Quote, 'id'>, actorUid?: string) => addDoc(collection(db, 'quotes'), { ...data, createdAt: Date.now(), createdByUid: actorUid });
export const updateQuote = (id: string, data: Partial<Quote>, actorUid?: string) => updateDoc(doc(db, 'quotes', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });
export const deleteQuote = (id: string, actorUid?: string) => updateDoc(doc(db, 'quotes', id), { isDeleted: true, deletedAt: Date.now(), deletedByUid: actorUid });

// ACTS (Actas)
export const getActs = async () => {
  try {
    const q = query(collection(db, 'acts'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Act)).filter(x => !x.isDeleted);
  } catch (error) {
    console.error('Error fetching acts:', error);
    return [];
  }
};

export const addAct = (data: Omit<Act, 'id'>, actorUid?: string) => addDoc(collection(db, 'acts'), { ...data, createdAt: Date.now(), createdByUid: actorUid });
export const updateAct = (id: string, data: Partial<Act>, actorUid?: string) => updateDoc(doc(db, 'acts', id), { ...data, updatedAt: Date.now(), updatedByUid: actorUid });
export const deleteAct = (id: string, actorUid?: string) => updateDoc(doc(db, 'acts', id), { isDeleted: true, deletedAt: Date.now(), deletedByUid: actorUid });

// MAINTENANCES
export const getMaintenances = async (filters?: QueryFilters) => {
  const all = await fetchCollection<Maintenance>('maintenances');
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
export const softDeleteMaintenance = (id: string, actorUid?: string) => updateDoc(doc(db, 'maintenances', id), { isDeleted: true, deletedAt: Date.now(), deletedByUid: actorUid });

