export type Role = 'admin' | 'tech' | 'auditor';

export type Status = 'bodega' | 'asignado' | 'mantenimiento' | 'baja';

export type AssetType = 'laptop' | 'desktop' | 'monitor' | 'keyboard' | 'mouse' | 'printer' | 'scanner' | 'network' | 'other';

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  name: string;
}

export interface Site {
  id: string;
  name: string;
  city: string;
  address: string;
  prefix: string; // Nuevo: Ejemplo MBOG, MMED, MCAL
}

export interface Assignment {
  assignedToName: string;
  assignedToDoc: string; // Cédula
  assignedToPosition: string;
  assignedAt: number; // Timestamp
}

export interface Asset {
  id: string;
  fixedAssetId: string; // Nuevo: Auto-generado (ej: MBOG-001)
  type: AssetType;
  brand: string;
  model: string;
  serial: string;
  internalPlate?: string; // Opcional, mantenemos compatibilidad
  status: Status;
  siteId: string;
  
  // Compra y Costos
  purchaseDate?: string;
  cost?: number;
  
  // Hardware Detallado
  processor?: string;
  ram?: string;
  storage?: string;
  os?: string; // Sistema Operativo

  // Específico para Desktop
  monitorBrand?: string;
  monitorSize?: string;
  monitorSerial?: string;

  imageUrl?: string;
  notes?: string;

  currentAssignment?: Assignment | null;
  createdAt: number;
}

export interface Activity {
  id: string;
  date: string; // YYYY-MM-DD
  techId?: string; // User ID optional
  techName: string; // Required now based on prompt
  siteId: string;
  description: string;
  type: 'Soporte Usuario' | 'Requerimiento' | 'Capacitacion' | 'Otro';
  priority: 'alta' | 'media' | 'baja';
  assetId?: string;
  timeSpentMinutes?: number;
}

export interface Supplier {
  id: string;
  name: string;
  nit: string;
  contactName: string;
  phone: string;
  email: string;
  category: string;
}

export interface Invoice {
  id: string;
  supplierId: string;
  number: string;
  siteId: string; // Obligatorio ahora
  description: string; // Servicio o Descripción
  date: string; // Fecha Radicación
  dueDate: string; // Fecha Vencimiento
  total: number; // Valor
  status: 'paid' | 'pending'; // Nuevo campo de estado
  pdfUrl?: string;
  createdAt: number;
}