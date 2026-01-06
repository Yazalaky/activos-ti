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
import type { Act, Activity, Asset, Invoice, Site, Supplier } from '../types';

const fetchCollection = async <T>(collectionName: string): Promise<T[]> => {
  try {
    const q = query(collection(db, collectionName));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() } as T));
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
};

// SITES
export const getSites = () => fetchCollection<Site>('sites');
export const addSite = (data: Omit<Site, 'id'>) => addDoc(collection(db, 'sites'), data);
export const deleteSite = (id: string) => deleteDoc(doc(db, 'sites', id));
export const updateSite = (id: string, data: Partial<Site>) => updateDoc(doc(db, 'sites', id), data);

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
    const nextSeq = (data.assetSeq ?? 0) + 1;
    tx.update(siteRef, { assetSeq: nextSeq });
    return `${prefix}-${String(nextSeq).padStart(3, '0')}`;
  });
};

export const addAsset = async (data: Omit<Asset, 'id' | 'fixedAssetId'>) => {
  const fixedAssetId = await generateNextFixedId(data.siteId);
  const finalData = { ...data, fixedAssetId, createdAt: Date.now() };
  return addDoc(collection(db, 'assets'), finalData);
};

export const updateAsset = (id: string, data: Partial<Asset>) =>
  updateDoc(doc(db, 'assets', id), data);

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
export const getActivities = async () => {
  try {
    const q = query(collection(db, 'activities'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Activity));
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
};

export const addActivity = (data: Omit<Activity, 'id'>) => addDoc(collection(db, 'activities'), data);

// SUPPLIERS
export const getSuppliers = () => fetchCollection<Supplier>('suppliers');
export const addSupplier = (data: Omit<Supplier, 'id'>) => addDoc(collection(db, 'suppliers'), data);

// INVOICES
export const getInvoices = () => fetchCollection<Invoice>('invoices');
export const addInvoice = async (data: Omit<Invoice, 'id'>) => {
  const finalData = { ...data, status: data.status ?? 'pending', createdAt: Date.now() };
  return addDoc(collection(db, 'invoices'), finalData);
};

export const updateInvoice = (id: string, data: Partial<Invoice>) =>
  updateDoc(doc(db, 'invoices', id), data);

// ACTS (Actas)
export const getActs = async () => {
  try {
    const q = query(collection(db, 'acts'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Act));
  } catch (error) {
    console.error('Error fetching acts:', error);
    return [];
  }
};

export const addAct = (data: Omit<Act, 'id'>) => addDoc(collection(db, 'acts'), data);
export const updateAct = (id: string, data: Partial<Act>) => updateDoc(doc(db, 'acts', id), data);
export const deleteAct = (id: string) => deleteDoc(doc(db, 'acts', id));
