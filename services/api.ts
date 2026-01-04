import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  query, 
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { Asset, Activity, Site, Supplier, Invoice } from '../types';

// ==========================================
// MOCK DATA STORE (For Demo Mode)
// ==========================================
const isDemo = () => localStorage.getItem('demoMode') === 'true';

const mockDB = {
  sites: [
    { id: '1', name: 'Sede Principal', city: 'Bogotá', address: 'Calle 100 # 15-20', prefix: 'MBOG' },
    { id: '2', name: 'Sucursal Norte', city: 'Medellín', address: 'Av. El Poblado', prefix: 'MMED' },
    { id: '3', name: 'Planta Operativa', city: 'Cali', address: 'Zona Industrial', prefix: 'MCAL' }
  ] as Site[],
  assets: [
    { 
      id: '101', fixedAssetId: 'MBOG-001', type: 'laptop', brand: 'Dell', model: 'Latitude 5420', serial: 'DL-8823', 
      status: 'asignado', siteId: '1', 
      processor: 'Core i5', ram: '16GB', storage: '512GB SSD', os: 'Windows 11 Pro',
      purchaseDate: '2023-01-15', cost: 3500000,
      currentAssignment: { assignedToName: 'Juan Pérez', assignedToDoc: '10102020', assignedToPosition: 'Desarrollador', assignedAt: Date.now() - 10000000 }, 
      createdAt: Date.now() 
    },
    { 
      id: '102', fixedAssetId: 'MBOG-002', type: 'desktop', brand: 'HP', model: 'ProDesk', serial: 'HP-999',
      status: 'bodega', siteId: '1',
      processor: 'Core i7', ram: '32GB', storage: '1TB SSD', os: 'Windows 10',
      monitorBrand: 'Samsung', monitorSize: '24"', monitorSerial: 'SAM-222',
      createdAt: Date.now() 
    }
  ] as Asset[],
  activities: [
    { id: '201', date: '2023-10-25', type: 'Soporte Usuario', description: 'Falla en disco duro usuario RH', priority: 'alta', siteId: '1', techName: 'Carlos Admin', timeSpentMinutes: 45 },
    { id: '202', date: '2023-10-26', type: 'Requerimiento', description: 'Limpieza preventiva servidores', priority: 'media', siteId: '2', techName: 'Carlos Admin', timeSpentMinutes: 120 }
  ] as Activity[],
  suppliers: [
    { id: '301', name: 'TecnoGlobal SAS', nit: '900.123.456', contactName: 'Maria Rodriguez', phone: '3001234567', email: 'ventas@tecnoglobal.com', category: 'Hardware' }
  ] as Supplier[],
  invoices: [] as Invoice[]
};

// Generic Helper
const simulateDelay = () => new Promise(resolve => setTimeout(resolve, 500));

// ==========================================
// API IMPLEMENTATION
// ==========================================

// Generic fetcher
const fetchCollection = async <T>(collectionName: string): Promise<T[]> => {
  if (isDemo()) {
    await simulateDelay();
    return (mockDB[collectionName as keyof typeof mockDB] || []) as T[];
  }
  try {
    const q = query(collection(db, collectionName));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
};

// SITES
export const getSites = () => fetchCollection<Site>('sites');
export const addSite = async (data: Omit<Site, 'id'>) => {
  if (isDemo()) {
    const newItem = { id: Math.random().toString(36).substr(2, 9), ...data } as Site;
    mockDB.sites.push(newItem);
    return newItem;
  }
  return addDoc(collection(db, 'sites'), data);
};
export const deleteSite = async (id: string) => {
  if (isDemo()) {
    mockDB.sites = mockDB.sites.filter(s => s.id !== id);
    return;
  }
  return deleteDoc(doc(db, 'sites', id));
};

// ASSETS
export const getAssets = () => fetchCollection<Asset>('assets');

// Logic to generate ID: PREFIX-00X
const generateNextFixedId = async (siteId: string): Promise<string> => {
    let sites: Site[] = [];
    let assets: Asset[] = [];

    if (isDemo()) {
        sites = mockDB.sites;
        assets = mockDB.assets;
    } else {
        const sitesSnap = await getDocs(collection(db, 'sites'));
        sites = sitesSnap.docs.map(d => ({id: d.id, ...d.data()} as Site));
        
        // En prod, esto debería ser más eficiente (count query), aquí traemos todo para el MVP
        const assetsSnap = await getDocs(query(collection(db, 'assets'), where('siteId', '==', siteId)));
        assets = assetsSnap.docs.map(d => d.data() as Asset);
    }

    const site = sites.find(s => s.id === siteId);
    if (!site || !site.prefix) return 'GEN-000';

    const prefix = site.prefix;
    // Filtrar activos que tengan el mismo prefijo en su ID fijo
    const count = assets.filter(a => a.fixedAssetId && a.fixedAssetId.startsWith(prefix)).length;
    
    // Generar consecutivo
    const nextNum = count + 1;
    return `${prefix}-${String(nextNum).padStart(3, '0')}`;
};

export const addAsset = async (data: Omit<Asset, 'id' | 'fixedAssetId'>) => {
  const fixedAssetId = await generateNextFixedId(data.siteId);
  const finalData = { ...data, fixedAssetId, createdAt: Date.now() };

  if (isDemo()) {
    const newItem = { id: Math.random().toString(36).substr(2, 9), ...finalData } as Asset;
    mockDB.assets.push(newItem);
    return newItem;
  }
  return addDoc(collection(db, 'assets'), finalData);
};

export const updateAsset = async (id: string, data: Partial<Asset>) => {
  if (isDemo()) {
    const index = mockDB.assets.findIndex(a => a.id === id);
    if (index !== -1) {
      mockDB.assets[index] = { ...mockDB.assets[index], ...data };
    }
    return;
  }
  return updateDoc(doc(db, 'assets', id), data);
};

// ACTIVITIES
export const getActivities = async () => {
    if (isDemo()) {
        await simulateDelay();
        return mockDB.activities.sort((a, b) => b.date.localeCompare(a.date));
    }
    const q = query(collection(db, 'activities'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({id: d.id, ...d.data()} as Activity));
};
export const addActivity = async (data: Omit<Activity, 'id'>) => {
    if (isDemo()) {
        const newItem = { id: Math.random().toString(36).substr(2, 9), ...data } as Activity;
        mockDB.activities.push(newItem);
        return newItem;
    }
    return addDoc(collection(db, 'activities'), data);
};

// SUPPLIERS
export const getSuppliers = () => fetchCollection<Supplier>('suppliers');
export const addSupplier = async (data: Omit<Supplier, 'id'>) => {
    if (isDemo()) {
        const newItem = { id: Math.random().toString(36).substr(2, 9), ...data } as Supplier;
        mockDB.suppliers.push(newItem);
        return newItem;
    }
    return addDoc(collection(db, 'suppliers'), data);
};

// INVOICES
export const getInvoices = () => fetchCollection<Invoice>('invoices');
export const addInvoice = async (data: Omit<Invoice, 'id'>) => {
    if (isDemo()) {
        const newItem = { id: Math.random().toString(36).substr(2, 9), ...data, status: 'pending', createdAt: Date.now() } as Invoice;
        mockDB.invoices.push(newItem);
        return newItem;
    }
    return addDoc(collection(db, 'invoices'), { ...data, status: 'pending', createdAt: Date.now() });
};

export const updateInvoice = async (id: string, data: Partial<Invoice>) => {
    if (isDemo()) {
        const index = mockDB.invoices.findIndex(i => i.id === id);
        if (index !== -1) {
            mockDB.invoices[index] = { ...mockDB.invoices[index], ...data };
        }
        return;
    }
    return updateDoc(doc(db, 'invoices', id), data);
};