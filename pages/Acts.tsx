import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useAuth } from '../auth/AuthContext';
import { auth } from '../firebaseAuth';
import { addAct, getActs, getActTemplates, getAssets, getSites, updateActContent } from '../services/api';
import { uploadFileToStorage } from '../services/storageUpload';
import { generateActPdf } from '../services/actPdf';
import { confirmSignedActPdf } from '../services/actSignedPdf';
import { ACT_COMPANIES, companyLabel } from '../services/actTemplates';
import { isLegacyActPending } from '../services/actLegacy';
import type { Act, ActDocumentDetails, ActStatus, ActTemplate, Asset, Site } from '../types';

const stripUndefinedDeep = (value: any): any => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
      const next = stripUndefinedDeep(child);
      if (next === undefined) continue;
      out[key] = next;
    }
    return out;
  }
  return value;
};

const statusLabel: Record<ActStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  signed: 'Firmada',
  void: 'Anulada',
};

const statusColor = (status: ActStatus) => {
  switch (status) {
    case 'draft':
      return 'default';
    case 'issued':
      return 'info';
    case 'signed':
      return 'success';
    case 'void':
      return 'error';
    default:
      return 'default';
  }
};

const MAX_ACT_PDF_SIZE = 10 * 1024 * 1024;

const toActSnapshotText = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const isSupportedActSnapshotValue = (value: unknown) => value == null
  || typeof value === 'string'
  || (typeof value === 'number' && Number.isFinite(value));

const createEmptyDocumentDetails = (): ActDocumentDetails => ({
  deviceTypes: { desktop: false, laptop: false, printer: false, tablet: false, cellphone: false, other: false },
  standardSoftware: { office365: false, antivirus: false, adobeReader: false, sevenZip: false, chrome: false, mozilla: false },
  requestedSoftware: { tns: false, tipificador: false, progsalud: false, ccleaner: false, ipscan: false, anydesk: false },
  discountSources: { fees: false, salary: false, benefits: false },
  partyType: 'employee',
});

const deviceTypeOptions: Array<{ key: keyof ActDocumentDetails['deviceTypes']; label: string }> = [
  { key: 'desktop', label: 'Desktop' },
  { key: 'laptop', label: 'Laptop' },
  { key: 'printer', label: 'Impresora' },
  { key: 'tablet', label: 'Tablet' },
  { key: 'cellphone', label: 'Celular' },
  { key: 'other', label: 'Otro tipo' },
];

const standardSoftwareOptions: Array<{ key: keyof ActDocumentDetails['standardSoftware']; label: string }> = [
  { key: 'office365', label: 'Microsoft Office 365' },
  { key: 'antivirus', label: 'Antivirus' },
  { key: 'adobeReader', label: 'Adobe Reader' },
  { key: 'sevenZip', label: 'Compresor 7 Zip' },
  { key: 'chrome', label: 'Explorador Chrome' },
  { key: 'mozilla', label: 'Explorador Mozilla' },
];

const requestedSoftwareOptions: Array<{ key: keyof ActDocumentDetails['requestedSoftware']; label: string }> = [
  { key: 'tns', label: 'TNS' },
  { key: 'tipificador', label: 'Tipificador' },
  { key: 'progsalud', label: 'Progsalud' },
  { key: 'ccleaner', label: 'CCleaner' },
  { key: 'ipscan', label: 'IPScan' },
  { key: 'anydesk', label: 'AnyDesk' },
];

const Acts = () => {
  const { role, profile } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';

  const [acts, setActs] = useState<Act[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [templates, setTemplates] = useState<ActTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<ActStatus | ''>('');
  const [filterSiteId, setFilterSiteId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingAct, setEditingAct] = useState<Act | null>(null);
  const [editReason, setEditReason] = useState('');
  const [createCompanyId, setCreateCompanyId] = useState('');
  const [createSiteId, setCreateSiteId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPosition, setRecipientPosition] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientDocument, setRecipientDocument] = useState('');
  const [recipientArea, setRecipientArea] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientExtension, setRecipientExtension] = useState('');
  const [recipientNetworkUser, setRecipientNetworkUser] = useState('');
  const [observations, setObservations] = useState('');
  const [documentDetails, setDocumentDetails] = useState<ActDocumentDetails>(createEmptyDocumentDetails);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAct, setUploadAct] = useState<Act | null>(null);
  const [uploadMode, setUploadMode] = useState<'signed' | 'replace_signed'>('signed');
  const [replacementReason, setReplacementReason] = useState('');
  const [generatingActId, setGeneratingActId] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const load = async () => {
    setLoading(true);
    const [a, s, ac, t] = await Promise.all([getAssets(), getSites(), getActs(), getActTemplates()]);
    setAssets(a);
    setSites(s);
    setActs(ac);
    setTemplates(t);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedAsset = useMemo(() => assets.find((a) => a.id === assetId) || null, [assets, assetId]);
  const selectedSite = useMemo(() => sites.find((s) => s.id === createSiteId) || null, [sites, createSiteId]);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.companyId === createCompanyId) || null,
    [templates, createCompanyId]
  );
  const sitesForCreateCompany = useMemo(
    () => sites.filter((site) => site.companyId === createCompanyId).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [sites, createCompanyId]
  );
  const availableCompanies = useMemo(
    () => ACT_COMPANIES.filter((company) => sites.some((site) => site.companyId === company.id)),
    [sites]
  );
  const assetsForCreateSite = useMemo(
    () => assets
      .filter((asset) => !createSiteId || asset.siteId === createSiteId)
      .filter((asset) => asset.id === editingAct?.assetId || (asset.status === 'asignado' && Boolean(asset.currentAssignment?.assignedToName && asset.currentAssignment?.assignedToPosition && asset.currentAssignment?.assignedToResponsible)))
      .slice()
      .sort((a, b) => String(a.fixedAssetId).localeCompare(String(b.fixedAssetId))),
    [assets, createSiteId, editingAct?.assetId]
  );

  const filteredActs = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return acts.filter((act) => {
      if (filterStatus && act.status !== filterStatus) return false;
      if (filterSiteId && act.siteId !== filterSiteId) return false;
      if (!q) return true;
      const assetCode = String(act.fixedAssetIdSnapshot || '').toLowerCase();
      const person = String(act.recipient?.fullName || '').toLowerCase();
      return assetCode.includes(q) || person.includes(q) || String(act.companyId || '').toLowerCase().includes(q);
    });
  }, [acts, filterText, filterStatus, filterSiteId]);

  const openCreate = () => {
    setEditingAct(null);
    setEditReason('');
    setCreateCompanyId('');
    setCreateSiteId('');
    setAssetId('');
    setRecipientName('');
    setRecipientPosition('');
    setRecipientEmail('');
    setRecipientDocument('');
    setRecipientArea('');
    setRecipientPhone('');
    setRecipientExtension('');
    setRecipientNetworkUser('');
    setObservations('');
    setDocumentDetails(createEmptyDocumentDetails());
    setCreateOpen(true);
  };

  const openEdit = (act: Act) => {
    if (!canWrite || isLegacyActPending(act) || !['draft', 'issued'].includes(act.status)) return;
    const defaults = createEmptyDocumentDetails();
    const details = act.documentDetails || defaults;
    setEditingAct(act);
    setEditReason('');
    setCreateCompanyId(act.companyId);
    setCreateSiteId(act.siteId);
    setAssetId(act.assetId);
    setRecipientName(act.recipient?.fullName || '');
    setRecipientPosition(act.recipient?.position || '');
    setRecipientEmail(act.recipient?.email || '');
    setRecipientDocument(act.recipient?.documentNumber || '');
    setRecipientArea(act.recipient?.area || '');
    setRecipientPhone(act.recipient?.phone || '');
    setRecipientExtension(act.recipient?.extension || '');
    setRecipientNetworkUser(act.recipient?.networkUser || '');
    setObservations(act.observations || '');
    setDocumentDetails({
      ...defaults,
      ...details,
      deviceTypes: { ...defaults.deviceTypes, ...details.deviceTypes },
      standardSoftware: { ...defaults.standardSoftware, ...details.standardSoftware },
      requestedSoftware: { ...defaults.requestedSoftware, ...details.requestedSoftware },
      discountSources: { ...defaults.discountSources, ...details.discountSources },
    });
    setCreateOpen(true);
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!assetId) {
      setSnackbar({ open: true, message: 'Seleccione un activo.', severity: 'warning' });
      return;
    }
    if (!createCompanyId) {
      setSnackbar({ open: true, message: 'Seleccione la empresa para el acta.', severity: 'warning' });
      return;
    }
    if (!recipientName.trim() || !recipientPosition.trim() || !recipientDocument.trim()) {
      setSnackbar({ open: true, message: 'Complete nombre completo, documento y cargo.', severity: 'warning' });
      return;
    }
    const overLimit = [
      [recipientName, 200], [recipientPosition, 150], [recipientDocument, 80], [recipientEmail, 254],
      [recipientArea, 150], [recipientPhone, 80], [recipientExtension, 30], [recipientNetworkUser, 150],
      [observations, 4000], [documentDetails.otherDeviceType || '', 100], [documentDetails.charger || '', 100], [documentDetails.mouse || '', 100],
      [documentDetails.monitor || '', 150], [documentDetails.license || '', 150], [documentDetails.keyboard || '', 100],
      [documentDetails.phoneSerial || '', 100], [documentDetails.phoneImei || '', 100],
      [documentDetails.otherSoftware || '', 1000], [documentDetails.discountAmountWords || '', 300],
      [documentDetails.discountAmountValue || '', 80],
    ].some(([value, max]) => String(value).length > Number(max));
    const otherSoftwareCount = String(documentDetails.otherSoftware || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean).length;
    if (overLimit || otherSoftwareCount > 6) {
      setSnackbar({ open: true, message: otherSoftwareCount > 6 ? 'Registre máximo 6 programas en “Otro software”.' : 'Hay campos que superan la longitud permitida.', severity: 'warning' });
      return;
    }

    if (editingAct) {
      if (isLegacyActPending(editingAct) || !['draft', 'issued'].includes(editingAct.status)) {
        setSnackbar({ open: true, message: 'Esta acta ya no se puede editar.', severity: 'error' });
        return;
      }
      if (editingAct.status === 'issued' && editReason.trim().length < 5) {
        setSnackbar({ open: true, message: 'Indique un motivo de al menos 5 caracteres para corregir el acta emitida.', severity: 'warning' });
        return;
      }
      try {
        setCreating(true);
        await updateActContent(editingAct.id, stripUndefinedDeep({
          recipient: {
            fullName: recipientName.trim(),
            position: recipientPosition.trim(),
            email: recipientEmail.trim() || undefined,
            documentNumber: recipientDocument.trim(),
            area: recipientArea.trim() || undefined,
            phone: recipientPhone.trim() || undefined,
            extension: recipientExtension.trim() || undefined,
            networkUser: recipientNetworkUser.trim() || undefined,
          },
          observations: observations.trim(),
          documentDetails: {
            ...documentDetails,
            deliveredByName: editingAct.documentDetails?.deliveredByName || profile?.name || '',
          },
        }), editReason, profile?.uid);
        setSnackbar({
          open: true,
          message: editingAct.status === 'issued'
            ? 'Corrección guardada. El acta volvió a borrador; imprime la nueva versión y descarta la copia anterior.'
            : 'Cambios guardados en el borrador.',
          severity: 'success',
        });
        setCreateOpen(false);
        setEditingAct(null);
        await load();
      } catch (error) {
        console.error('Edit act error:', error);
        setSnackbar({ open: true, message: error instanceof Error ? error.message : 'No se pudo actualizar el acta.', severity: 'error' });
      } finally {
        setCreating(false);
      }
      return;
    }

    const asset = assets.find((a) => a.id === assetId);
    if (!asset) {
      setSnackbar({ open: true, message: 'Activo no encontrado.', severity: 'error' });
      return;
    }
    const site = sites.find((s) => s.id === asset.siteId);
    if (!createSiteId || asset.siteId !== createSiteId) {
      setSnackbar({ open: true, message: 'Seleccione una sede y un activo de esa misma sede.', severity: 'warning' });
      return;
    }
    if (!site?.companyId) {
      setSnackbar({ open: true, message: 'La sede no tiene empresa asignada. Configura companyId en Sedes.', severity: 'warning' });
      return;
    }
    if (site.companyId !== createCompanyId) {
      setSnackbar({ open: true, message: 'La empresa seleccionada no corresponde a la sede del activo.', severity: 'error' });
      return;
    }
    if (!selectedTemplate?.nit?.trim()) {
      setSnackbar({ open: true, message: 'Un administrador debe configurar el NIT de la empresa antes de crear el acta.', severity: 'warning' });
      return;
    }
    if (asset.status !== 'asignado' || !asset.currentAssignment?.assignedToName || !asset.currentAssignment?.assignedToPosition || !asset.currentAssignment?.assignedToResponsible) {
      setSnackbar({ open: true, message: 'Solo se pueden crear actas para activos asignados con asignación completa.', severity: 'warning' });
      return;
    }
    const assetSnapshot = {
      type: toActSnapshotText(asset.type),
      brand: toActSnapshotText(asset.brand),
      model: toActSnapshotText(asset.model),
      serial: toActSnapshotText(asset.serial),
      processor: toActSnapshotText(asset.processor),
      ram: toActSnapshotText(asset.ram),
      storage: toActSnapshotText(asset.storage),
      os: toActSnapshotText(asset.os),
    };
    const requiredSnapshotFields: Array<[string, string | undefined, number]> = [
      ['tipo', assetSnapshot.type, 50],
      ['marca', assetSnapshot.brand, 100],
      ['modelo', assetSnapshot.model, 150],
      ['serial', assetSnapshot.serial, 150],
    ];
    const invalidRequiredSnapshot = requiredSnapshotFields.find(([, value, maxLength]) => !value || value.length > maxLength);
    if (invalidRequiredSnapshot) {
      setSnackbar({
        open: true,
        message: `El activo ${asset.fixedAssetId} tiene un dato técnico obligatorio vacío o demasiado largo (${invalidRequiredSnapshot[0]}). Corrígelo en Inventario antes de crear el acta.`,
        severity: 'warning',
      });
      return;
    }
    const optionalSnapshotFields: Array<[string, unknown, string | undefined, number]> = [
      ['procesador', asset.processor, assetSnapshot.processor, 150],
      ['RAM', asset.ram, assetSnapshot.ram, 100],
      ['almacenamiento', asset.storage, assetSnapshot.storage, 100],
      ['sistema operativo', asset.os, assetSnapshot.os, 100],
    ];
    const invalidOptionalSnapshot = optionalSnapshotFields.find(([, original, value, maxLength]) =>
      !isSupportedActSnapshotValue(original) || (value !== undefined && value.length > maxLength));
    if (invalidOptionalSnapshot) {
      setSnackbar({
        open: true,
        message: `El dato de ${invalidOptionalSnapshot[0]} del activo ${asset.fixedAssetId} no tiene un formato válido. Corrígelo en Inventario antes de crear el acta.`,
        severity: 'warning',
      });
      return;
    }
    const assignmentFields: Array<[string, unknown, number]> = [
      ['nombre del responsable', asset.currentAssignment.assignedToName, 200],
      ['cargo del responsable', asset.currentAssignment.assignedToPosition, 150],
      ['responsable de entrega', asset.currentAssignment.assignedToResponsible, 200],
    ];
    const invalidAssignment = assignmentFields.find(([, value, maxLength]) =>
      typeof value !== 'string' || !value.trim() || value.length > maxLength);
    if (invalidAssignment) {
      setSnackbar({
        open: true,
        message: `La asignación actual del activo ${asset.fixedAssetId} tiene un dato inválido (${invalidAssignment[0]}). Corrige la asignación en Inventario y vuelve a intentarlo.`,
        severity: 'warning',
      });
      return;
    }
    if (acts.some((act) => act.assetId === asset.id && act.status !== 'void')) {
      setSnackbar({ open: true, message: 'El activo ya tiene un acta vigente. Anule la anterior antes de crear otra.', severity: 'warning' });
      return;
    }

    try {
      setCreating(true);
      const payload = stripUndefinedDeep({
        assetId: asset.id,
        siteId: asset.siteId,
        companyId: site.companyId,
        templateId: site.companyId,
        templateVersion: selectedTemplate.version || 1,
        companyNitSnapshot: selectedTemplate.nit.trim(),
        fixedAssetIdSnapshot: asset.fixedAssetId,
        assetSnapshot,
        recipient: {
          fullName: recipientName.trim(),
          position: recipientPosition.trim(),
          email: recipientEmail.trim() || undefined,
          documentNumber: recipientDocument.trim(),
          area: recipientArea.trim() || undefined,
          phone: recipientPhone.trim() || undefined,
          extension: recipientExtension.trim() || undefined,
          networkUser: recipientNetworkUser.trim() || undefined,
        },
        observations: observations.trim() || undefined,
        documentDetails: {
          ...documentDetails,
          deliveredByName: profile?.name || '',
        },
        status: 'draft',
        contentRevision: 1,
      }) as Omit<Act, 'id'>;
      await addAct(payload, profile?.uid);
      setSnackbar({ open: true, message: 'Acta creada (borrador).', severity: 'success' });
      setCreateOpen(false);
      await load();
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
      const profileScopeAllowsSite = profile?.accessScope !== 'sites'
        || Boolean(profile.siteIds?.includes(asset.siteId));
      console.error('Create act error:', {
        code,
        siteId: asset.siteId,
        assetId: asset.id,
        fixedAssetId: asset.fixedAssetId,
        diagnostics: {
          authenticated: Boolean(auth.currentUser),
          profileUidMatchesSession: Boolean(auth.currentUser?.uid && auth.currentUser.uid === profile?.uid),
          roleCanCreate: profile?.role === 'admin' || profile?.role === 'tech',
          profileActive: profile?.active !== false,
          profileScopeAllowsSite,
          assetBelongsToSite: asset.siteId === site.id,
          siteCompanyMatchesSelection: site.companyId === createCompanyId,
          assetAssigned: asset.status === 'asignado',
        },
      }, error);
      setSnackbar({
        open: true,
        message: code === 'permission-denied'
          ? `Firestore rechazó el borrador de ${asset.fixedAssetId}. Verifica que tu usuario tenga acceso a ${site.name} y que los datos de sede/asignación sigan vigentes. Si persiste, informa este código de activo al administrador.`
          : 'No se pudo crear el acta. Inténtalo de nuevo y, si persiste, informa el código de activo al administrador.',
        severity: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const openUpload = (act: Act, mode: 'signed' | 'replace_signed' = 'signed') => {
    setUploadAct(act);
    setUploadMode(mode);
    setUploadFile(null);
    setUploadPct(0);
    setReplacementReason('');
    setUploadOpen(true);
  };

  const handleGeneratePdf = async (act: Act) => {
    if (!canWrite || isLegacyActPending(act) || act.status === 'signed' || act.status === 'void') return;
    const site = sites.find((item) => item.id === act.siteId);
    const template = templates.find((item) => item.companyId === act.companyId);
    if (!site || !template) {
      setSnackbar({ open: true, message: 'No se encontró la sede o la configuración de empresa del acta.', severity: 'warning' });
      return;
    }
    if (!(act.companyNitSnapshot || template.nit)?.trim()) {
      setSnackbar({ open: true, message: 'La empresa no tiene NIT configurado. Un administrador debe completar ese dato.', severity: 'warning' });
      return;
    }

    const printWindow = window.open('about:blank', '_blank');
    if (printWindow) printWindow.opener = null;
    try {
      setGeneratingActId(act.id);
      const { file } = await generateActPdf(act.id);
      const objectUrl = URL.createObjectURL(file);
      let openedInTab = false;
      if (printWindow && !printWindow.closed) {
        printWindow.location.href = objectUrl;
        openedInTab = true;
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30 * 60 * 1000);
      } else {
        printWindow?.close();
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = file.name;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      }

      setSnackbar({
        open: true,
        message: openedInTab
          ? 'PDF generado y abierto para imprimir. Cuando esté firmado, carga el PDF en el acta.'
          : 'PDF generado y descargado. Cuando esté firmado, carga el PDF en el acta.',
        severity: 'success',
      });
      await load();
    } catch (error) {
      printWindow?.close();
      console.error('Generate act PDF error:', error);
      setSnackbar({ open: true, message: error instanceof Error ? error.message : 'No se pudo generar el PDF.', severity: 'error' });
    } finally {
      setGeneratingActId(null);
    }
  };

  const handleUploadPdf = async () => {
    if (!canWrite) return;
    if (!uploadAct) return;
    if (!profile?.uid) {
      setSnackbar({ open: true, message: 'No se pudo identificar tu usuario para registrar la carga.', severity: 'error' });
      return;
    }
    if (!uploadFile) {
      setSnackbar({ open: true, message: 'Seleccione un archivo PDF.', severity: 'warning' });
      return;
    }
    if (uploadFile.type !== 'application/pdf' && !uploadFile.name.toLowerCase().endsWith('.pdf')) {
      setSnackbar({ open: true, message: 'El archivo debe ser un PDF.', severity: 'warning' });
      return;
    }
    if (uploadFile.size >= MAX_ACT_PDF_SIZE) {
      setSnackbar({ open: true, message: 'El PDF debe pesar menos de 10 MB.', severity: 'warning' });
      return;
    }
    if (uploadMode === 'replace_signed' && replacementReason.trim().length < 5) {
      setSnackbar({ open: true, message: 'Indique un motivo de al menos 5 caracteres para reemplazar el PDF firmado.', severity: 'warning' });
      return;
    }
    let uploadPhase: 'subir PDF a Storage' | 'registrar PDF firmado en el servidor' = 'subir PDF a Storage';
    try {
      setUploading(true);
      const ts = Date.now();
      if (isLegacyActPending(uploadAct) && uploadMode !== 'replace_signed') {
        throw new Error('El acta antigua debe ser clasificada por un administrador antes de cargar o firmar un PDF.');
      }
      if (uploadMode === 'signed' && (!['draft', 'issued'].includes(uploadAct.status) || uploadAct.signedPdf)) {
        throw new Error('El acta debe estar en borrador o emitida, sin PDF firmado previo.');
      }
      if (uploadMode === 'replace_signed' && (uploadAct.status !== 'signed' || !uploadAct.signedPdf)) {
        throw new Error('No se encontró un PDF firmado que pueda reemplazarse.');
      }
      const kind = 'signed';
      const result = await uploadFileToStorage(
        `acts/${uploadAct.id}/${kind}/${ts}-${uploadFile.name}`,
        uploadFile,
        setUploadPct,
        { uploadedByUid: profile.uid },
      );
      uploadPhase = 'registrar PDF firmado en el servidor';
      await confirmSignedActPdf(uploadAct.id, result.path, uploadMode, replacementReason.trim());

      setSnackbar({
        open: true,
        message: uploadMode === 'signed'
          ? 'PDF firmado cargado y acta cerrada.'
          : 'PDF firmado reemplazado. La versión anterior se conservó.',
        severity: 'success',
      });
      setUploadOpen(false);
      await load();
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
      console.error('Upload act PDF error:', {
        phase: uploadPhase,
        code: errorCode,
        actId: uploadAct.id,
        status: uploadAct.status,
        legacyClassification: uploadAct.legacyClassification || null,
        fileSize: uploadFile.size,
        fileType: uploadFile.type || '(vacío)',
      }, error);
      const message = uploadPhase === 'subir PDF a Storage'
        ? 'Storage rechazó el PDF. Verifica que sea un archivo PDF válido, pese menos de 10 MB y que tengas acceso a la sede del acta.'
        : error instanceof Error
          ? error.message
          : 'No se pudo guardar el PDF.';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Actas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Crea, gestiona y adjunta actas de entrega por activo.
          </Typography>
        </Box>

        {canWrite && (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>
            Nueva acta
          </Button>
        )}
      </Stack>

      {!canWrite && (
        <Alert severity="info">Modo solo lectura (Gerencia/Auditoría). Puedes ver y descargar actas, pero no crear o modificar.</Alert>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Buscar"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Código del activo o nombre del colaborador..."
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="act-status-label">Estado</InputLabel>
                <Select
                  labelId="act-status-label"
                  label="Estado"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus((e.target.value as any) || '')}
                  startAdornment={
                    <InputAdornment position="start">
                      <FilterAltOutlinedIcon />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="draft">Borrador</MenuItem>
                  <MenuItem value="issued">Emitida</MenuItem>
                  <MenuItem value="signed">Firmada</MenuItem>
                  <MenuItem value="void">Anulada</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="act-site-label">Sede</InputLabel>
                <Select labelId="act-site-label" label="Sede" value={filterSiteId} onChange={(e) => setFilterSiteId(String(e.target.value))}>
                  <MenuItem value="">Todas</MenuItem>
                  {sites
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name} ({s.prefix})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Cargando actas…
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Activo</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Colaborador</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Sede</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Empresa</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>PDF</TableCell>
                  <TableCell sx={{ fontWeight: 900 }} align="right">
                    Acciones
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredActs.map((act) => {
                  const site = sites.find((s) => s.id === act.siteId);
                  const legacyPending = isLegacyActPending(act);
                  return (
                    <TableRow key={act.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'primary.main' }}>
                          {act.fixedAssetIdSnapshot || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {act.assetSnapshot?.brand} {act.assetSnapshot?.model} · S/N: {act.assetSnapshot?.serial}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {act.recipient?.fullName || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {act.recipient?.position || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{site?.name || '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={companyLabel(act.companyId)} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          <Chip label={statusLabel[act.status]} color={statusColor(act.status) as any} />
                          {legacyPending && <Chip label="Revisión pendiente" color="warning" variant="outlined" />}
                          {act.signatureMethod === 'electronic' && <Chip label="Firma electrónica histórica" variant="outlined" />}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<OpenInNewOutlinedIcon />}
                          disabled={!act.pdfUrl}
                          onClick={() => {
                            if (!act.pdfUrl) return;
                            window.open(act.pdfUrl, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          Abrir
                        </Button>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                          {canWrite && ['draft', 'issued'].includes(act.status) && !legacyPending && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditOutlinedIcon />}
                              onClick={() => openEdit(act)}
                            >
                              {act.status === 'issued' ? 'Corregir' : 'Editar'}
                            </Button>
                          )}
                          {canWrite && ['draft', 'issued'].includes(act.status) && !legacyPending && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<DescriptionOutlinedIcon />}
                              onClick={() => handleGeneratePdf(act)}
                              disabled={generatingActId === act.id}
                            >
                              {generatingActId === act.id ? 'Preparando…' : 'Imprimir acta'}
                            </Button>
                          )}
                          {canWrite && ['draft', 'issued'].includes(act.status) && !legacyPending && (
                            <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => openUpload(act, 'signed')}>
                              Cargar PDF firmado
                            </Button>
                          )}
                          {act.status === 'signed' && act.signedPdf && canWrite && (
                            <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => openUpload(act, 'replace_signed')}>
                              Reemplazar PDF
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredActs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 6 }}>
                      <Typography variant="body2" color="text.secondary" align="center">
                        No hay actas.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { maxHeight: '92vh' } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          {editingAct ? (editingAct.status === 'issued' ? 'Corregir acta emitida' : 'Editar borrador') : 'Nueva acta'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSaveCreate} sx={{ mt: 1 }}>
            <Stack spacing={2}>
              {editingAct && (
                <>
                  <Alert severity={editingAct.status === 'issued' ? 'warning' : 'info'}>
                    {editingAct.status === 'issued'
                      ? 'Al guardar, el acta regresará a Borrador y tendrás que imprimirla otra vez. La copia impresa anterior queda obsoleta: descártala y no la firmes.'
                      : 'Los cambios se guardarán sobre esta misma acta. El activo, la sede y la empresa se mantienen sin cambios.'}
                  </Alert>
                  <TextField
                    label={editingAct.status === 'issued' ? 'Motivo de la corrección' : 'Nota de edición (opcional)'}
                    value={editReason}
                    onChange={(event) => setEditReason(event.target.value)}
                    helperText={editingAct.status === 'issued' ? 'Obligatorio; mínimo 5 caracteres.' : 'Quedará registrado junto con la versión anterior.'}
                    required={editingAct.status === 'issued'}
                    inputProps={{ maxLength: 500 }}
                    fullWidth
                    multiline
                    minRows={2}
                    disabled={!canWrite || creating}
                  />
                </>
              )}
              <FormControl fullWidth required disabled={!canWrite || creating || Boolean(editingAct)}>
                <InputLabel id="act-create-company-label">Empresa</InputLabel>
                <Select
                  labelId="act-create-company-label"
                  label="Empresa"
                  value={createCompanyId}
                  onChange={(e) => {
                    setCreateCompanyId(String(e.target.value));
                    setCreateSiteId('');
                    setAssetId('');
                    setRecipientName('');
                    setRecipientPosition('');
                    setRecipientEmail('');
                    setRecipientDocument('');
                    setRecipientArea('');
                    setRecipientPhone('');
                    setRecipientExtension('');
                    setRecipientNetworkUser('');
                    setObservations('');
                    setDocumentDetails(createEmptyDocumentDetails());
                  }}
                >
                  <MenuItem value="">Seleccione una empresa...</MenuItem>
                  {availableCompanies.map((company) => <MenuItem key={company.id} value={company.id}>{company.label}</MenuItem>)}
                </Select>
              </FormControl>

              {!editingAct && createCompanyId && (
                <Alert severity={selectedTemplate?.nit ? 'info' : 'warning'}>
                  {selectedTemplate?.nit
                    ? `El formato y logo de ${companyLabel(createCompanyId)} se aplicarán automáticamente. NIT: ${selectedTemplate.nit}.`
                    : `Falta configurar el NIT de ${companyLabel(createCompanyId)}. Solicita al administrador completarlo antes de guardar el acta.`}
                </Alert>
              )}

              <FormControl fullWidth required disabled={!canWrite || creating || Boolean(editingAct)}>
                <InputLabel id="act-create-site-label">Sede</InputLabel>
                <Select
                  labelId="act-create-site-label"
                  label="Sede"
                  value={createSiteId}
                  disabled={!canWrite || creating || !createCompanyId || Boolean(editingAct)}
                  onChange={(e) => {
                    const siteId = String(e.target.value);
                    setCreateSiteId(siteId);
                    setAssetId('');
                    setRecipientName('');
                    setRecipientPosition('');
                    setRecipientEmail('');
                    setRecipientDocument('');
                    setRecipientArea('');
                    setRecipientPhone('');
                    setRecipientExtension('');
                    setRecipientNetworkUser('');
                    setObservations('');
                    setDocumentDetails(createEmptyDocumentDetails());
                  }}
                >
                  <MenuItem value="">{createCompanyId ? 'Seleccione una sede...' : 'Seleccione primero una empresa'}</MenuItem>
                  {sitesForCreateCompany.map((site) => {
                      const siteAssetCount = assets.filter((asset) => asset.siteId === site.id && asset.status === 'asignado' && Boolean(asset.currentAssignment?.assignedToName && asset.currentAssignment?.assignedToPosition && asset.currentAssignment?.assignedToResponsible)).length;
                      return (
                        <MenuItem key={site.id} value={site.id}>
                          {site.name} · {siteAssetCount} activo{siteAssetCount === 1 ? '' : 's'}
                        </MenuItem>
                      );
                    })}
                </Select>
              </FormControl>

              <FormControl fullWidth required disabled={!canWrite || creating || !createSiteId || Boolean(editingAct)}>
                <InputLabel id="act-asset-label">Activo</InputLabel>
                <Select
                  labelId="act-asset-label"
                  label="Activo"
                  value={assetId}
                  onChange={(e) => {
                    const id = String(e.target.value);
                    setAssetId(id);
                    const asset = assets.find((a) => a.id === id);
                    if (asset?.currentAssignment?.assignedToName) setRecipientName(asset.currentAssignment.assignedToName);
                    if (asset?.currentAssignment?.assignedToPosition) setRecipientPosition(asset.currentAssignment.assignedToPosition);
                    if (asset) {
                      setDocumentDetails((current) => ({
                        ...current,
                        deviceTypes: {
                          desktop: asset.type === 'desktop',
                          laptop: asset.type === 'laptop',
                          printer: asset.type === 'printer',
                          tablet: false,
                          cellphone: false,
                          other: !['desktop', 'laptop', 'printer'].includes(asset.type),
                        },
                        otherDeviceType: !['desktop', 'laptop', 'printer'].includes(asset.type)
                          ? (({ monitor: 'Monitor', keyboard: 'Teclado', mouse: 'Mouse', scanner: 'Escáner', network: 'Red', other: 'Otro' } as Record<string, string>)[asset.type] || 'Otro')
                          : '',
                      }));
                    }
                  }}
                >
                  <MenuItem value="">
                    {!createSiteId
                      ? 'Seleccione primero una sede'
                      : assetsForCreateSite.length === 0
                        ? 'No hay activos en esta sede'
                        : 'Seleccione un activo...'}
                  </MenuItem>
                  {assetsForCreateSite.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.fixedAssetId} · {a.brand} {a.model} · S/N: {a.serial} · Estado: {a.status}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {editingAct ? (
                <Alert severity="info">
                  Activo fijo: {editingAct.fixedAssetIdSnapshot} · Sede: {sites.find((site) => site.id === editingAct.siteId)?.name || editingAct.siteId} · Empresa: {companyLabel(editingAct.companyId)}. Esta relación no se modifica al corregir el acta.
                </Alert>
              ) : selectedAsset && (
                <Alert severity="success">
                  Empresa: {companyLabel(createCompanyId)} · Sede: {selectedSite?.name} · Activo: {selectedAsset.fixedAssetId}. Los datos del equipo se copiarán automáticamente.
                </Alert>
              )}

              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Datos del colaborador</Typography>
              <TextField
                label="Nombre completo"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
                fullWidth
                disabled={!canWrite || creating}
              />
              <TextField
                label="Cargo"
                value={recipientPosition}
                onChange={(e) => setRecipientPosition(e.target.value)}
                required
                fullWidth
                disabled={!canWrite || creating}
              />
              <TextField
                label="Documento de identidad"
                value={recipientDocument}
                onChange={(e) => setRecipientDocument(e.target.value)}
                required
                fullWidth
                disabled={!canWrite || creating}
              />
              <TextField
                label="Correo (opcional)"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                fullWidth
                disabled={!canWrite || creating}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Área (opcional)" value={recipientArea} onChange={(e) => setRecipientArea(e.target.value)} fullWidth disabled={!canWrite || creating} />
                </Grid>
                <Grid size={{ xs: 8, sm: 4 }}>
                  <TextField label="Teléfono (opcional)" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} fullWidth disabled={!canWrite || creating} />
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
                  <TextField label="Ext." value={recipientExtension} onChange={(e) => setRecipientExtension(e.target.value)} fullWidth disabled={!canWrite || creating} />
                </Grid>
              </Grid>
              <TextField label="Usuario de red (opcional)" value={recipientNetworkUser} onChange={(e) => setRecipientNetworkUser(e.target.value)} fullWidth disabled={!canWrite || creating} />
              <Divider />
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Hardware y accesorios</Typography>
              <Typography variant="body2" color="text.secondary">El tipo se precarga según el activo; puedes ajustar las opciones para que coincidan con lo que se entrega.</Typography>
              <FormGroup row>
                {deviceTypeOptions.map(({ key, label }) => (
                  <FormControlLabel
                    key={key}
                    label={label}
                    control={<Checkbox
                      checked={documentDetails.deviceTypes[key]}
                      onChange={(event) => setDocumentDetails((current) => ({
                        ...current,
                        deviceTypes: { ...current.deviceTypes, [key]: event.target.checked },
                      }))}
                      disabled={!canWrite || creating}
                    />}
                  />
                ))}
              </FormGroup>
              {documentDetails.deviceTypes.other && (
                <TextField
                  label="Tipo de equipo (opcional)"
                  value={documentDetails.otherDeviceType || ''}
                  onChange={(e) => setDocumentDetails((current) => ({ ...current, otherDeviceType: e.target.value }))}
                  fullWidth
                  disabled={!canWrite || creating}
                />
              )}
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField label="Cargador" value={documentDetails.charger || ''} onChange={(e) => setDocumentDetails((current) => ({ ...current, charger: e.target.value }))} fullWidth disabled={!canWrite || creating} /></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField label="Mouse" value={documentDetails.mouse || ''} onChange={(e) => setDocumentDetails((current) => ({ ...current, mouse: e.target.value }))} fullWidth disabled={!canWrite || creating} /></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField label="Monitor" value={documentDetails.monitor || ''} onChange={(e) => setDocumentDetails((current) => ({ ...current, monitor: e.target.value }))} fullWidth disabled={!canWrite || creating} /></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField label="Licencia" value={documentDetails.license || ''} onChange={(e) => setDocumentDetails((current) => ({ ...current, license: e.target.value }))} fullWidth disabled={!canWrite || creating} /></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField label="Teclado" value={documentDetails.keyboard || ''} onChange={(e) => setDocumentDetails((current) => ({ ...current, keyboard: e.target.value }))} fullWidth disabled={!canWrite || creating} /></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField label="Teléfono serial" value={documentDetails.phoneSerial || ''} onChange={(e) => setDocumentDetails((current) => ({ ...current, phoneSerial: e.target.value }))} fullWidth disabled={!canWrite || creating} /></Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField label="IMEI teléfono" value={documentDetails.phoneImei || ''} onChange={(e) => setDocumentDetails((current) => ({ ...current, phoneImei: e.target.value }))} fullWidth disabled={!canWrite || creating} /></Grid>
              </Grid>
              <Divider />
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Software entregado o solicitado</Typography>
              <Typography variant="subtitle2">Software estándar corporativo</Typography>
              <FormGroup row>
                {standardSoftwareOptions.map(({ key, label }) => (
                  <FormControlLabel key={key} label={label} control={<Checkbox checked={documentDetails.standardSoftware[key]} onChange={(event) => setDocumentDetails((current) => ({ ...current, standardSoftware: { ...current.standardSoftware, [key]: event.target.checked } }))} disabled={!canWrite || creating} />} />
                ))}
              </FormGroup>
              <Typography variant="subtitle2">Software especial solicitado</Typography>
              <FormGroup row>
                {requestedSoftwareOptions.map(({ key, label }) => (
                  <FormControlLabel key={key} label={label} control={<Checkbox checked={documentDetails.requestedSoftware[key]} onChange={(event) => setDocumentDetails((current) => ({ ...current, requestedSoftware: { ...current.requestedSoftware, [key]: event.target.checked } }))} disabled={!canWrite || creating} />} />
                ))}
              </FormGroup>
              <TextField
                label="Otro software (uno por línea, máximo 6)"
                value={documentDetails.otherSoftware || ''}
                onChange={(e) => setDocumentDetails((current) => ({ ...current, otherSoftware: e.target.value }))}
                fullWidth
                multiline
                minRows={2}
                helperText="Estos nombres también se imprimirán en el formato."
                disabled={!canWrite || creating}
              />
              <Divider />
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Autorización del formato</Typography>
              <FormControl fullWidth disabled={!canWrite || creating}>
                <InputLabel id="act-party-type-label">Tipo de vinculación</InputLabel>
                <Select
                  labelId="act-party-type-label"
                  label="Tipo de vinculación"
                  value={documentDetails.partyType || 'employee'}
                  onChange={(e) => setDocumentDetails((current) => ({ ...current, partyType: e.target.value as 'employee' | 'contractor' }))}
                >
                  <MenuItem value="employee">Trabajador</MenuItem>
                  <MenuItem value="contractor">Contratista</MenuItem>
                </Select>
              </FormControl>
              <FormGroup row>
                <FormControlLabel label="Descuento de honorarios" control={<Checkbox checked={documentDetails.discountSources.fees} onChange={(event) => setDocumentDetails((current) => ({ ...current, discountSources: { ...current.discountSources, fees: event.target.checked } }))} disabled={!canWrite || creating} />} />
                <FormControlLabel label="Descuento de salarios" control={<Checkbox checked={documentDetails.discountSources.salary} onChange={(event) => setDocumentDetails((current) => ({ ...current, discountSources: { ...current.discountSources, salary: event.target.checked } }))} disabled={!canWrite || creating} />} />
                <FormControlLabel label="Descuento de prestaciones sociales" control={<Checkbox checked={documentDetails.discountSources.benefits} onChange={(event) => setDocumentDetails((current) => ({ ...current, discountSources: { ...current.discountSources, benefits: event.target.checked } }))} disabled={!canWrite || creating} />} />
              </FormGroup>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 7 }}><TextField label="Valor en letras (opcional)" value={documentDetails.discountAmountWords || ''} onChange={(e) => setDocumentDetails((current) => ({ ...current, discountAmountWords: e.target.value }))} fullWidth disabled={!canWrite || creating} /></Grid>
                <Grid size={{ xs: 12, sm: 5 }}><TextField label="Valor numérico (opcional)" value={documentDetails.discountAmountValue || ''} onChange={(e) => setDocumentDetails((current) => ({ ...current, discountAmountValue: e.target.value }))} fullWidth disabled={!canWrite || creating} /></Grid>
              </Grid>
              <Divider />
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Observaciones</Typography>
              <TextField
                label="Observaciones (opcional)"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                disabled={!canWrite || creating}
              />
            </Stack>

            <DialogActions sx={{ px: 0, mt: 2 }}>
              <Button onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={!canWrite || creating}>
                {editingAct ? 'Guardar cambios' : 'Guardar borrador'}
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {uploadMode === 'signed' ? 'Cargar acta firmada' : 'Reemplazar PDF del acta'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              {uploadMode === 'signed'
                ? 'Adjunta el PDF con las firmas manuales. Al guardarlo, el acta quedará cerrada; si el archivo es incorrecto, podrás reemplazarlo y el anterior se conservará en el historial.'
                : 'El PDF actual no se eliminará: quedará registrado en el historial junto con el motivo del reemplazo.'}
            </Alert>
            {uploadAct?.pdfUrl && (
              <Typography variant="body2" color="text.secondary">
                Archivo actual: <strong>{uploadAct.pdfName || 'PDF del acta'}</strong>
              </Typography>
            )}
            {uploadMode === 'replace_signed' && (
              <TextField
                label="Motivo del reemplazo"
                value={replacementReason}
                onChange={(event) => setReplacementReason(event.target.value)}
                helperText="Registre por qué se reemplaza el PDF firmado."
                required
                fullWidth
                multiline
                minRows={2}
                disabled={uploading}
              />
            )}
            {uploading && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Subiendo… {uploadPct}%
                </Typography>
                <LinearProgress variant="determinate" value={uploadPct} sx={{ mt: 0.5, borderRadius: 99 }} />
              </Box>
            )}
            <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled={!canWrite || uploading}>
              {uploadFile ? `Archivo: ${uploadFile.name}` : 'Seleccionar PDF'}
              <input
                hidden
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile(file);
                  setUploadPct(0);
                  e.target.value = '';
                }}
              />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleUploadPdf} disabled={!canWrite || uploading}>
            {uploadMode === 'signed' ? 'Guardar PDF firmado' : 'Reemplazar PDF'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default Acts;
