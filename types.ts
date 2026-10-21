export type Role = 'admin' | 'tech' | 'auditor' | 'management';
export type AccessScope = 'global' | 'sites';

export type Status = 'bodega' | 'asignado' | 'mantenimiento' | 'baja';

export type AssetType = 'laptop' | 'desktop' | 'monitor' | 'keyboard' | 'mouse' | 'printer' | 'scanner' | 'network' | 'other';

export interface AuditFields {
  createdAt?: number;
  createdByUid?: string;
  updatedAt?: number;
  updatedByUid?: string;
  deletedAt?: number;
  deletedByUid?: string;
  isDeleted?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  name: string;
  active?: boolean;
  accessScope?: AccessScope;
  siteIds?: string[];
}

export interface Site extends AuditFields {
  id: string;
  name: string;
  city: string;
  address: string;
  prefix: string; // Nuevo: Ejemplo MBOG, MMED, MCAL
  assetSeq?: number; // Secuencia para generar fixedAssetId
  releasedAssetSeqs?: number[]; // Secuencias liberadas para reutilizar códigos
  companyId?: string; // Para seleccionar plantilla/logo del acta
}

export interface Assignment {
  assignedToName: string;
  assignedToPosition: string;
  assignedAt: number; // Timestamp
  assignedToResponsible?: string;
  assignedToDoc?: string; // Opcional (legacy)
}

export interface Asset extends AuditFields {
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
  imagePath?: string;
  notes?: string;

  // Baja del activo: se conserva el documento y la evidencia histórica.
  decommissionReason?: string;
  decommissionedAt?: number;
  decommissionedByUid?: string;

  currentAssignment?: Assignment | null;
  previousFixedAssetIds?: string[]; // Historial cuando se cambia de sede/código
  movedAt?: number; // Timestamp del último cambio de sede
  movedFromSiteId?: string | null;
}

export interface Activity extends AuditFields {
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

export interface Supplier extends AuditFields {
  id: string;
  name: string;
  nit: string;
  contactName: string;
  phone: string;
  email: string;
  category: string;
}

export interface GoogleOneAccount extends AuditFields {
  id: string;
  accountEmail: string;
  cardLastFour: string;
  plan: string;
  storage: string;
  monthlyPrice?: number;
  billingDay: number;
  active: boolean;
}

export type SupplierContractStatus = 'active' | 'terminated';
export type SupplierContractDocumentKind = 'signed_contract' | 'addendum' | 'renewal' | 'other';

export interface SupplierContract extends AuditFields {
  id: string;
  supplierId: string;
  supplierNameSnapshot: string;
  object: string;
  contractNumber?: string;
  signedDate?: string;
  startDate?: string;
  endDate?: string;
  currentRenewalDocumentId?: string;
  renewalStartDate?: string;
  renewalEndDate?: string;
  value?: number | null;
  notes?: string;
  status: SupplierContractStatus;
  currentSignedDocumentId: string;
  terminatedAt?: number;
  terminatedByUid?: string;
}

export interface SupplierContractDocument extends AuditFields {
  id: string;
  contractId: string;
  kind: SupplierContractDocumentKind;
  title: string;
  documentDate?: string;
  renewalStartDate?: string;
  renewalEndDate?: string;
  storagePath: string;
  fileName: string;
  contentType: 'application/pdf';
  size: number;
  replacesDocumentId?: string;
  replacementReason?: string;
  updatedAt?: number;
  updatedByUid?: string;
}

export interface Invoice extends AuditFields {
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
  pdfPath?: string;
  pdfName?: string;
  pdfContentType?: string;
  pdfSize?: number;
}

export type QuoteStatus = 'pending' | 'approved' | 'rejected';

export interface Quote extends AuditFields {
  id: string;
  date: string; // YYYY-MM-DD
  supplierId: string;
  siteId: string;
  status: QuoteStatus;
  notes?: string;
  pdfUrl?: string;
  pdfPath?: string;
  pdfName?: string;
  pdfContentType?: string;
  pdfSize?: number;
}

export type ActStatus = 'draft' | 'issued' | 'signed' | 'void';

export type ActSignatureMethod = 'electronic' | 'uploaded_pdf';

export type ActLegacyClassification = 'pending' | 'issued' | 'signed_uploaded';

export interface ActSignaturePlacement {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ActTemplate extends AuditFields {
  id: string;
  companyId: string;
  companyName: string;
  nit?: string;
  sourceDocxUrl?: string;
  sourceDocxPath?: string;
  sourceDocxName?: string;
  pdfTemplateUrl?: string;
  pdfTemplatePath?: string;
  pdfTemplateName?: string;
  version: number;
  active: boolean;
  signaturePlacement?: ActSignaturePlacement;
}

export interface ActPdfFile {
  url: string;
  path: string;
  name: string;
  contentType: string;
  size: number;
  createdAt?: number;
  createdByUid?: string;
}

export interface ActPdfHistoryEntry extends ActPdfFile {
  replacedAt: number;
  replacedByUid: string;
  replacementReason: string;
}

export interface ActDocumentDetails {
  deliveredByName?: string;
  deviceTypes: {
    desktop: boolean;
    laptop: boolean;
    printer: boolean;
    tablet: boolean;
    cellphone: boolean;
    other: boolean;
  };
  otherDeviceType?: string;
  charger?: string;
  mouse?: string;
  monitor?: string;
  license?: string;
  keyboard?: string;
  phoneSerial?: string;
  phoneImei?: string;
  standardSoftware: {
    office365: boolean;
    antivirus: boolean;
    adobeReader: boolean;
    sevenZip: boolean;
    chrome: boolean;
    mozilla: boolean;
  };
  requestedSoftware: {
    tns: boolean;
    tipificador: boolean;
    progsalud: boolean;
    ccleaner: boolean;
    ipscan: boolean;
    anydesk: boolean;
  };
  otherSoftware?: string;
  partyType?: 'employee' | 'contractor';
  discountSources: {
    fees: boolean;
    salary: boolean;
    benefits: boolean;
  };
  discountAmountWords?: string;
  discountAmountValue?: string;
}

export interface Act extends AuditFields {
  id: string;
  assetId: string;
  siteId: string;
  companyId: string;
  templateId: string;
  templateVersion?: number;
  fixedAssetIdSnapshot: string;
  assetSnapshot: Pick<Asset, 'type' | 'brand' | 'model' | 'serial' | 'processor' | 'ram' | 'storage' | 'os'>;
  recipient: {
    fullName: string;
    position: string;
    email?: string;
    documentNumber?: string;
    area?: string;
    phone?: string;
    extension?: string;
    networkUser?: string;
  };
  observations?: string;
  companyNitSnapshot?: string;
  documentDetails?: ActDocumentDetails;
  status: ActStatus;
  generatedPdf?: ActPdfFile;
  signedPdf?: ActPdfFile;
  signedPdfHistory?: ActPdfHistoryEntry[];
  signatureMethod?: ActSignatureMethod;
  signedByUid?: string;
  contentRevision?: number;
  lastEditId?: string;
  lastEditedAt?: number;
  lastEditedByUid?: string;
  lastEditReason?: string;
  legacyClassification?: ActLegacyClassification;
  legacyClassificationReason?: string;
  legacyClassifiedAt?: number;
  legacyClassifiedByUid?: string;
  legacySignatureDateUnknown?: boolean;
  legacySignerUnknown?: boolean;
  pdfUrl?: string;
  pdfPath?: string;
  pdfName?: string;
  pdfContentType?: string;
  pdfSize?: number;
  issuedAt?: number;
  signedAt?: number;
}

export interface Maintenance extends AuditFields {
  id: string;
  assetId: string;
  siteId: string;
  type: 'preventivo' | 'correctivo';
  status: 'programado' | 'en_proceso' | 'realizado' | 'cancelado';
  scheduledDate?: string;
  completedDate?: string;
  technicianName?: string;
  supplierId?: string;
  cost?: number;
  findings?: string;
  actionsTaken?: string;
  nextMaintenanceDate?: string;
  evidenceUrl?: string;
  evidencePath?: string;
  evidenceName?: string;
  evidenceContentType?: string;
  evidenceSize?: number;
}
