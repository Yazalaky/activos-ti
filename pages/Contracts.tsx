import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
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
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useAuth } from '../auth/AuthContext';
import {
  addSupplierContract,
  addSupplierContractDocument,
  createSupplierContractDocumentId,
  getSupplierContractDocuments,
  getSupplierContracts,
  getSuppliers,
  updateSupplierContract,
} from '../services/api';
import { deleteStoragePath, getStorageFileUrl } from '../services/storageFiles';
import { uploadFileToStorage } from '../services/storageUpload';
import type {
  Supplier,
  SupplierContract,
  SupplierContractDocument,
  SupplierContractDocumentKind,
} from '../types';

type ContractStatusFilter = 'all' | 'active' | 'upcoming' | 'expiring' | 'expired' | 'terminated' | 'missing_pdf';
type RelatedDraft = {
  key: string;
  kind: Exclude<SupplierContractDocumentKind, 'signed_contract'>;
  title: string;
  date: string;
  file: File | null;
};
type ContractForm = {
  supplierId: string;
  object: string;
  contractNumber: string;
  signedDate: string;
  startDate: string;
  endDate: string;
  value: string;
  notes: string;
};

const MAX_PDF_SIZE = 20 * 1024 * 1024;
const documentKindLabels: Record<SupplierContractDocumentKind, string> = {
  signed_contract: 'Contrato firmado',
  addendum: 'Adenda',
  renewal: 'Renovación',
  other: 'Otro documento',
};

const emptyForm = (supplierId = ''): ContractForm => ({
  supplierId,
  object: '',
  contractNumber: '',
  signedDate: '',
  startDate: '',
  endDate: '',
  value: '',
  notes: '',
});

const localDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const formatTimestamp = (value?: number) => value
  ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const getStatus = (contract: SupplierContract) => {
  if (contract.status === 'terminated') return { key: 'terminated', label: 'Terminado', color: 'default' as const };
  const today = localDateString();
  if (contract.startDate && contract.startDate > today) {
    return { key: 'upcoming', label: 'Próximo', color: 'info' as const };
  }
  if (contract.endDate && contract.endDate < today) {
    return { key: 'expired', label: 'Vencido', color: 'error' as const };
  }
  if (contract.endDate) {
    const daysLeft = Math.ceil((new Date(`${contract.endDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    if (daysLeft >= 0 && daysLeft <= 30) {
      return { key: 'expiring', label: `Vence en ${daysLeft} d`, color: 'warning' as const };
    }
  }
  return { key: 'active', label: 'Vigente', color: 'success' as const };
};

const validatePdf = (file: File) => {
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
    throw new Error('Selecciona un archivo PDF válido.');
  }
  if (file.size <= 0 || file.size >= MAX_PDF_SIZE) {
    throw new Error('El PDF debe pesar menos de 20 MB.');
  }
};

const Contracts = () => {
  const { role, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const canRead = role === 'admin'
    || role === 'management'
    || role === 'auditor'
    || (role === 'tech' && profile?.accessScope !== 'sites');
  const canManage = role === 'admin' || (role === 'tech' && profile?.accessScope !== 'sites');

  const [contracts, setContracts] = useState<SupplierContract[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState(searchParams.get('supplierId') || '');
  const [statusFilter, setStatusFilter] = useState<ContractStatusFilter>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<SupplierContract | null>(null);
  const [editingDocuments, setEditingDocuments] = useState<SupplierContractDocument[]>([]);
  const [form, setForm] = useState<ContractForm>(emptyForm());
  const [mainPdf, setMainPdf] = useState<File | null>(null);
  const [replacementReason, setReplacementReason] = useState('');
  const [relatedDrafts, setRelatedDrafts] = useState<RelatedDraft[]>([]);
  const [loadingEditDocuments, setLoadingEditDocuments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  const [documentsContract, setDocumentsContract] = useState<SupplierContract | null>(null);
  const [documents, setDocuments] = useState<SupplierContractDocument[]>([]);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState<SupplierContract | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'warning',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [contractRows, supplierRows] = await Promise.all([getSupplierContracts(), getSuppliers()]);
      setContracts(contractRows);
      setSuppliers(supplierRows);
    } catch (error) {
      console.error('Error loading supplier contracts:', error);
      setSnackbar({ open: true, message: 'No se pudieron cargar los contratos.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSupplierFilter(searchParams.get('supplierId') || '');
  }, [searchParams]);

  useEffect(() => {
    if (canRead) void loadData();
    else setLoading(false);
  }, [canRead]);

  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);
  const visibleContracts = useMemo(() => contracts
    .filter((contract) => {
      const supplierName = supplierById.get(contract.supplierId)?.name || contract.supplierNameSnapshot;
      const haystack = normalize([
        supplierName,
        contract.object,
        contract.contractNumber || '',
        contract.notes || '',
      ].join(' '));
      if (search && !haystack.includes(normalize(search))) return false;
      if (supplierFilter && contract.supplierId !== supplierFilter) return false;
      const status = getStatus(contract).key;
      if (statusFilter === 'missing_pdf') return !contract.currentSignedDocumentId;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => String(b.startDate || b.signedDate || '').localeCompare(String(a.startDate || a.signedDate || ''))),
  [contracts, search, supplierFilter, statusFilter, supplierById]);

  const resetEditor = () => {
    setDialogOpen(false);
    setEditingContract(null);
    setEditingDocuments([]);
    setForm(emptyForm());
    setMainPdf(null);
    setReplacementReason('');
    setRelatedDrafts([]);
    setLoadingEditDocuments(false);
    setUploadPct(0);
  };

  const openCreate = () => {
    setEditingContract(null);
    setEditingDocuments([]);
    setForm(emptyForm(supplierFilter));
    setMainPdf(null);
    setReplacementReason('');
    setRelatedDrafts([]);
    setLoadingEditDocuments(false);
    setDialogOpen(true);
  };

  const openEdit = async (contract: SupplierContract) => {
    setEditingContract(contract);
    setForm({
      supplierId: contract.supplierId,
      object: contract.object || '',
      contractNumber: contract.contractNumber || '',
      signedDate: contract.signedDate || '',
      startDate: contract.startDate || '',
      endDate: contract.endDate || '',
      value: contract.value != null ? String(contract.value) : '',
      notes: contract.notes || '',
    });
    setMainPdf(null);
    setReplacementReason('');
    setRelatedDrafts([]);
    setEditingDocuments([]);
    setDialogOpen(true);
    setLoadingEditDocuments(true);
    try {
      setEditingDocuments(await getSupplierContractDocuments(contract.id));
    } catch (error) {
      console.error('Error loading contract documents:', error);
      setSnackbar({ open: true, message: 'No se pudo cargar el historial de documentos.', severity: 'error' });
    } finally {
      setLoadingEditDocuments(false);
    }
  };

  const uploadAndRegisterDocument = async (
    contractId: string,
    file: File,
    details: {
      kind: SupplierContractDocumentKind;
      title: string;
      date?: string;
      replacesDocumentId?: string;
      replacementReason?: string;
    },
    makeCurrent: boolean,
  ) => {
    validatePdf(file);
    const documentId = createSupplierContractDocumentId(contractId);
    const storagePath = `contracts/${contractId}/documents/${documentId}`;
    const uploaded = await uploadFileToStorage(storagePath, file, setUploadPct);
    try {
      await addSupplierContractDocument(contractId, documentId, {
        kind: details.kind,
        title: details.title.trim(),
        documentDate: details.date || '',
        storagePath: uploaded.path,
        fileName: file.name,
        contentType: 'application/pdf',
        size: uploaded.size,
        ...(details.replacesDocumentId ? { replacesDocumentId: details.replacesDocumentId } : {}),
        ...(details.replacementReason ? { replacementReason: details.replacementReason.trim() } : {}),
      }, makeCurrent, profile?.uid);
    } catch (error) {
      await deleteStoragePath(uploaded.path).catch((cleanupError) => {
        console.warn('No se pudo limpiar el archivo de contrato sin metadatos:', cleanupError);
      });
      throw error;
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (!form.supplierId || !form.object.trim()) {
      setSnackbar({ open: true, message: 'Selecciona el proveedor e indica el objeto del contrato.', severity: 'warning' });
      return;
    }

    const currentSignedDocument = editingDocuments.find((document) => document.id === editingContract?.currentSignedDocumentId);
    const needsMainPdf = !editingContract || !editingContract.currentSignedDocumentId;
    if (needsMainPdf && !mainPdf) {
      setSnackbar({ open: true, message: 'Adjunta el PDF firmado del contrato principal.', severity: 'warning' });
      return;
    }
    if (mainPdf) {
      try {
        validatePdf(mainPdf);
      } catch (error) {
        setSnackbar({ open: true, message: error instanceof Error ? error.message : 'PDF no válido.', severity: 'warning' });
        return;
      }
      if (currentSignedDocument && replacementReason.trim().length < 5) {
        setSnackbar({ open: true, message: 'Para reemplazar el PDF indica un motivo de al menos 5 caracteres.', severity: 'warning' });
        return;
      }
      if (editingContract?.currentSignedDocumentId && !currentSignedDocument) {
        setSnackbar({ open: true, message: 'No se pudo verificar el PDF vigente. Cierra y vuelve a abrir la edición antes de reemplazarlo.', severity: 'warning' });
        return;
      }
    }
    for (const draft of relatedDrafts) {
      if (!draft.title.trim() || !draft.file) {
        setSnackbar({ open: true, message: 'Completa el título y PDF de cada documento relacionado, o quita la fila vacía.', severity: 'warning' });
        return;
      }
      try {
        validatePdf(draft.file);
      } catch (error) {
        setSnackbar({ open: true, message: error instanceof Error ? error.message : 'PDF no válido.', severity: 'warning' });
        return;
      }
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setSnackbar({ open: true, message: 'La fecha de vencimiento no puede ser anterior a la fecha de inicio.', severity: 'warning' });
      return;
    }

    setSaving(true);
    setUploadPct(0);
    let contractId = editingContract?.id || '';
    let metadataSaved = Boolean(editingContract);
    const uploadErrors: string[] = [];
    try {
      const selectedSupplier = supplierById.get(form.supplierId);
      if (!selectedSupplier) throw new Error('El proveedor seleccionado ya no existe. Actualiza la página e inténtalo de nuevo.');
      const value = form.value.trim() ? Number(form.value.replace(/[^\d.]/g, '')) : undefined;
      if (form.value.trim() && (!Number.isFinite(value) || Number(value) < 0)) {
        throw new Error('El valor del contrato no es válido.');
      }
      const metadata = {
        supplierId: form.supplierId,
        supplierNameSnapshot: selectedSupplier.name,
        object: form.object.trim(),
        contractNumber: form.contractNumber.trim(),
        signedDate: form.signedDate,
        startDate: form.startDate,
        endDate: form.endDate,
        value: value ?? null,
        notes: form.notes.trim(),
        status: (editingContract?.status || 'active') as SupplierContract['status'],
        currentSignedDocumentId: editingContract?.currentSignedDocumentId || '',
        ...(editingContract?.status === 'terminated'
          ? { terminatedAt: editingContract.terminatedAt, terminatedByUid: editingContract.terminatedByUid }
          : {}),
      };

      if (editingContract) {
        await updateSupplierContract(editingContract.id, metadata, profile?.uid);
        contractId = editingContract.id;
      } else {
        const created = await addSupplierContract(metadata, profile?.uid);
        contractId = created.id;
      }
      metadataSaved = true;

      if (mainPdf) {
        try {
          await uploadAndRegisterDocument(contractId, mainPdf, {
            kind: 'signed_contract',
            title: 'Contrato firmado',
            date: form.signedDate,
            ...(currentSignedDocument ? {
              replacesDocumentId: currentSignedDocument.id,
              replacementReason,
            } : {}),
          }, true);
        } catch (error) {
          console.error('Error uploading signed contract PDF:', error);
          uploadErrors.push('No se pudo cargar el PDF principal.');
        }
      }

      for (const draft of relatedDrafts) {
        if (!draft.file) continue;
        try {
          await uploadAndRegisterDocument(contractId, draft.file, {
            kind: draft.kind,
            title: draft.title,
            date: draft.date,
          }, false);
        } catch (error) {
          console.error('Error uploading related contract PDF:', error);
          uploadErrors.push(`No se pudo cargar «${draft.title}».`);
        }
      }

      await loadData();
      resetEditor();
      setSnackbar({
        open: true,
        message: uploadErrors.length
          ? `Los datos quedaron guardados, pero ${uploadErrors.join(' ')} Puedes volver a adjuntarlo editando el contrato.`
          : editingContract ? 'Contrato actualizado y documentos registrados.' : 'Contrato creado y PDF firmado cargado.',
        severity: uploadErrors.length ? 'warning' : 'success',
      });
    } catch (error) {
      console.error('Error saving supplier contract:', error);
      setSnackbar({
        open: true,
        message: metadataSaved
          ? 'Los datos del contrato quedaron guardados, pero no se pudieron completar todos los archivos. Edita el registro para reintentarlo.'
          : error instanceof Error ? error.message : 'No se pudo guardar el contrato.',
        severity: 'error',
      });
      if (metadataSaved) {
        await loadData();
        resetEditor();
      }
    } finally {
      setSaving(false);
    }
  };

  const openDocuments = async (contract: SupplierContract) => {
    setDocumentsContract(contract);
    setDocuments([]);
    setDocumentsOpen(true);
    setLoadingDocuments(true);
    try {
      setDocuments(await getSupplierContractDocuments(contract.id));
    } catch (error) {
      console.error('Error loading contract documents:', error);
      setSnackbar({ open: true, message: 'No se pudieron cargar los documentos.', severity: 'error' });
    } finally {
      setLoadingDocuments(false);
    }
  };

  const openPdf = async (document: SupplierContractDocument) => {
    const popup = window.open('', '_blank');
    if (popup) popup.opener = null;
    try {
      const url = await getStorageFileUrl(document.storagePath);
      if (popup) popup.location.href = url;
      else setSnackbar({ open: true, message: 'Permite ventanas emergentes para abrir el PDF.', severity: 'warning' });
    } catch (error) {
      popup?.close();
      console.error('Error opening contract PDF:', error);
      setSnackbar({ open: true, message: 'No se pudo abrir el PDF. Verifica tus permisos y vuelve a intentarlo.', severity: 'error' });
    }
  };

  const handleTerminate = async () => {
    if (!canManage || !terminateTarget || !profile?.uid) return;
    try {
      await updateSupplierContract(terminateTarget.id, {
        status: 'terminated',
        terminatedAt: Date.now(),
        terminatedByUid: profile.uid,
      }, profile.uid);
      setTerminateTarget(null);
      await loadData();
      setSnackbar({ open: true, message: 'Contrato marcado como terminado. El historial y sus PDFs se conservaron.', severity: 'success' });
    } catch (error) {
      console.error('Error terminating supplier contract:', error);
      setSnackbar({ open: true, message: 'No se pudo terminar el contrato.', severity: 'error' });
    }
  };

  if (!canRead) {
    return <Alert severity="error">No tienes permisos para consultar los contratos del área.</Alert>;
  }

  const currentEditMainPdf = editingDocuments.find((document) => document.id === editingContract?.currentSignedDocumentId);
  const currentDialogMainPdf = documents.find((document) => document.id === documentsContract?.currentSignedDocumentId);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>Contratos de proveedores</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Centraliza contratos firmados, adendas y renovaciones del área de sistemas.
            </Typography>
          </Box>
          {canManage && (
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>
              Nuevo contrato
            </Button>
          )}
        </Stack>
      </Box>

      <Alert severity="info">
        Los PDFs se conservan como historial: reemplazar el principal no borra la versión anterior y terminar un contrato tampoco elimina sus archivos.
      </Alert>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Buscar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            fullWidth
            placeholder="Proveedor, objeto o número..."
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlinedIcon /></InputAdornment> }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel id="contract-supplier-filter">Proveedor</InputLabel>
            <Select
              labelId="contract-supplier-filter"
              value={supplierFilter}
              label="Proveedor"
              onChange={(event) => setSupplierFilter(String(event.target.value))}
            >
              <MenuItem value="">Todos los proveedores</MenuItem>
              {suppliers.map((supplier) => <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel id="contract-status-filter">Estado</InputLabel>
            <Select
              labelId="contract-status-filter"
              value={statusFilter}
              label="Estado"
              onChange={(event) => setStatusFilter(event.target.value as ContractStatusFilter)}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="active">Vigentes</MenuItem>
              <MenuItem value="upcoming">Próximos a iniciar</MenuItem>
              <MenuItem value="expiring">Vencen en 30 días</MenuItem>
              <MenuItem value="expired">Vencidos</MenuItem>
              <MenuItem value="terminated">Terminados</MenuItem>
              <MenuItem value="missing_pdf">Sin PDF principal</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {loading && <LinearProgress />}
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Proveedor</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Objeto / contrato</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Vigencia</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Valor</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>PDF principal</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleContracts.map((contract) => {
                  const supplierName = supplierById.get(contract.supplierId)?.name || contract.supplierNameSnapshot;
                  const status = getStatus(contract);
                  return (
                    <TableRow key={contract.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{supplierName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{contract.object}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {contract.contractNumber ? `No. ${contract.contractNumber}` : 'Sin número registrado'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">Inicio: {formatDate(contract.startDate)}</Typography>
                        <Typography variant="caption" color="text.secondary">Firmado: {formatDate(contract.signedDate)}</Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">Fin: {contract.endDate ? formatDate(contract.endDate) : 'Sin fecha de vencimiento'}</Typography>
                      </TableCell>
                      <TableCell align="right">{contract.value != null ? `$${Number(contract.value).toLocaleString('es-CO')}` : '—'}</TableCell>
                      <TableCell><Chip size="small" label={status.label} color={status.color} /></TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant={contract.currentSignedDocumentId ? 'filled' : 'outlined'}
                          color={contract.currentSignedDocumentId ? 'success' : 'warning'}
                          label={contract.currentSignedDocumentId ? 'Cargado' : 'Pendiente'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                          <Button size="small" startIcon={<VisibilityOutlinedIcon />} onClick={() => void openDocuments(contract)}>
                            Archivos
                          </Button>
                          {canManage && contract.status !== 'terminated' && (
                            <>
                              <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => void openEdit(contract)}>Editar</Button>
                              <Button size="small" color="error" startIcon={<StopCircleOutlinedIcon />} onClick={() => setTerminateTarget(contract)}>
                                Terminar
                              </Button>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && visibleContracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">No hay contratos que coincidan con los filtros.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => !saving && resetEditor()} fullWidth maxWidth="md" PaperProps={{ sx: { maxHeight: '92vh' } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>{editingContract ? 'Editar contrato' : 'Registrar contrato'}</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSave} sx={{ mt: 1 }}>
            <Stack spacing={2}>
              {editingContract && (
                <Alert severity="info">
                  El PDF principal y cada adenda o renovación se guardan como documentos separados para mantener el historial.
                </Alert>
              )}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth required disabled={saving || Boolean(editingContract)}>
                    <InputLabel id="contract-supplier">Proveedor</InputLabel>
                    <Select
                      labelId="contract-supplier"
                      label="Proveedor"
                      value={form.supplierId}
                      onChange={(event) => setForm((current) => ({ ...current, supplierId: String(event.target.value) }))}
                    >
                      <MenuItem value="">Selecciona proveedor...</MenuItem>
                      {suppliers.map((supplier) => <MenuItem key={supplier.id} value={supplier.id}>{supplier.name} · NIT {supplier.nit}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Objeto del contrato"
                    required
                    fullWidth
                    value={form.object}
                    inputProps={{ maxLength: 1000 }}
                    onChange={(event) => setForm((current) => ({ ...current, object: event.target.value }))}
                    disabled={saving || editingContract?.status === 'terminated'}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <TextField label="Número del contrato (opcional)" fullWidth value={form.contractNumber} inputProps={{ maxLength: 120 }} onChange={(event) => setForm((current) => ({ ...current, contractNumber: event.target.value }))} disabled={saving || editingContract?.status === 'terminated'} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <TextField label="Fecha de firma" type="date" fullWidth value={form.signedDate} InputLabelProps={{ shrink: true }} onChange={(event) => setForm((current) => ({ ...current, signedDate: event.target.value }))} disabled={saving || editingContract?.status === 'terminated'} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <TextField label="Valor (COP, opcional)" type="number" fullWidth value={form.value} inputProps={{ min: 0, step: 1 }} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} disabled={saving || editingContract?.status === 'terminated'} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Fecha de inicio" type="date" fullWidth value={form.startDate} InputLabelProps={{ shrink: true }} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} disabled={saving || editingContract?.status === 'terminated'} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Fecha de vencimiento (opcional)" type="date" fullWidth value={form.endDate} InputLabelProps={{ shrink: true }} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} disabled={saving || editingContract?.status === 'terminated'} />
                </Grid>
                <Grid size={12}>
                  <TextField label="Observaciones (opcional)" fullWidth multiline minRows={2} value={form.notes} inputProps={{ maxLength: 4000 }} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} disabled={saving || editingContract?.status === 'terminated'} />
                </Grid>
              </Grid>

              {editingContract?.status !== 'terminated' && (
                <>
                  <Divider />
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>PDF firmado del contrato</Typography>
                    {currentEditMainPdf ? (
                      <Alert severity="success">
                        Versión principal actual: <strong>{currentEditMainPdf.fileName}</strong>. Si se reemplaza, la versión anterior permanecerá en el historial.
                      </Alert>
                    ) : (
                      <Alert severity="warning">Aún no hay un PDF principal cargado. Adjunta el contrato firmado para completar el registro.</Alert>
                    )}
                    <Button component="label" variant="outlined" startIcon={<AttachFileOutlinedIcon />} disabled={saving}>
                      {mainPdf ? `Seleccionado: ${mainPdf.name}` : currentEditMainPdf ? 'Reemplazar PDF principal' : 'Cargar PDF firmado'}
                      <input hidden type="file" accept="application/pdf,.pdf" onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setMainPdf(file);
                        event.target.value = '';
                      }} />
                    </Button>
                    {mainPdf && currentEditMainPdf && (
                      <TextField
                        label="Motivo del reemplazo"
                        value={replacementReason}
                        onChange={(event) => setReplacementReason(event.target.value)}
                        inputProps={{ maxLength: 500 }}
                        helperText="Obligatorio; quedará asociado a la versión anterior. Mínimo 5 caracteres."
                        required
                        fullWidth
                        disabled={saving}
                      />
                    )}
                  </Stack>

                  <Divider />
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Adendas, renovaciones y otros</Typography>
                        <Typography variant="caption" color="text.secondary">Documentos relacionados opcionales; cada archivo queda en el historial.</Typography>
                      </Box>
                      <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => setRelatedDrafts((current) => [...current, { key: crypto.randomUUID(), kind: 'addendum', title: '', date: '', file: null }])} disabled={saving}>
                        Agregar
                      </Button>
                    </Stack>
                    {relatedDrafts.map((draft) => (
                      <Paper key={draft.key} variant="outlined" sx={{ p: 1.5 }}>
                        <Grid container spacing={1.5} alignItems="center">
                          <Grid size={{ xs: 12, sm: 3 }}>
                            <FormControl fullWidth size="small">
                              <InputLabel id={`kind-${draft.key}`}>Tipo</InputLabel>
                              <Select labelId={`kind-${draft.key}`} label="Tipo" value={draft.kind} onChange={(event) => setRelatedDrafts((rows) => rows.map((row) => row.key === draft.key ? { ...row, kind: event.target.value as RelatedDraft['kind'] } : row))}>
                                <MenuItem value="addendum">Adenda</MenuItem>
                                <MenuItem value="renewal">Renovación</MenuItem>
                                <MenuItem value="other">Otro</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField size="small" label="Nombre o detalle" required fullWidth value={draft.title} onChange={(event) => setRelatedDrafts((rows) => rows.map((row) => row.key === draft.key ? { ...row, title: event.target.value } : row))} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 2 }}>
                            <TextField size="small" label="Fecha" type="date" fullWidth value={draft.date} InputLabelProps={{ shrink: true }} onChange={(event) => setRelatedDrafts((rows) => rows.map((row) => row.key === draft.key ? { ...row, date: event.target.value } : row))} />
                          </Grid>
                          <Grid size={{ xs: 10, sm: 2 }}>
                            <Button component="label" size="small" fullWidth startIcon={<AttachFileOutlinedIcon />}>
                              {draft.file ? 'PDF listo' : 'PDF'}
                              <input hidden type="file" accept="application/pdf,.pdf" onChange={(event) => {
                                const file = event.target.files?.[0] || null;
                                setRelatedDrafts((rows) => rows.map((row) => row.key === draft.key ? { ...row, file } : row));
                                event.target.value = '';
                              }} />
                            </Button>
                          </Grid>
                          <Grid size={{ xs: 2, sm: 1 }}>
                            <Button color="error" aria-label="Quitar documento" onClick={() => setRelatedDrafts((rows) => rows.filter((row) => row.key !== draft.key))}>×</Button>
                          </Grid>
                          {draft.file && <Grid size={12}><Typography variant="caption" color="text.secondary">{draft.file.name}</Typography></Grid>}
                        </Grid>
                      </Paper>
                    ))}
                  </Stack>
                  {loadingEditDocuments && <LinearProgress />}
                  {editingDocuments.length > 0 && (
                    <Alert severity="info">Hay {editingDocuments.length} documento(s) ya guardado(s). Para consultarlos, abre “Archivos” desde la lista; no se eliminarán al guardar.</Alert>
                  )}
                </>
              )}

              {saving && <LinearProgress variant={uploadPct > 0 ? 'determinate' : 'indeterminate'} value={uploadPct} />}
              <DialogActions sx={{ px: 0 }}>
                <Button onClick={resetEditor} disabled={saving}>Cancelar</Button>
                {editingContract?.status !== 'terminated' && canManage && (
                  <Button type="submit" variant="contained" disabled={saving || loadingEditDocuments}>
                    {saving ? 'Guardando…' : editingContract ? 'Guardar cambios' : 'Guardar contrato'}
                  </Button>
                )}
              </DialogActions>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={documentsOpen} onClose={() => setDocumentsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>Documentos del contrato</DialogTitle>
        <DialogContent>
          {documentsContract && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {supplierById.get(documentsContract.supplierId)?.name || documentsContract.supplierNameSnapshot} · {documentsContract.object}
            </Typography>
          )}
          {loadingDocuments && <LinearProgress />}
          {!loadingDocuments && documents.length === 0 && <Alert severity="warning">Este contrato todavía no tiene documentos cargados.</Alert>}
          {!loadingDocuments && documents.length > 0 && (
            <Table size="small">
              <TableHead><TableRow>
                <TableCell sx={{ fontWeight: 900 }}>Tipo / nombre</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Archivo</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>PDF</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {documents.slice().reverse().map((document) => {
                  const isCurrent = document.id === documentsContract?.currentSignedDocumentId;
                  return (
                    <TableRow key={document.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{document.title}</Typography>
                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
                          <Chip size="small" variant="outlined" label={documentKindLabels[document.kind]} />
                          {isCurrent && <Chip size="small" color="success" label="Principal actual" />}
                          {document.kind === 'signed_contract' && !isCurrent && <Chip size="small" label="Versión anterior" />}
                        </Stack>
                        {document.replacementReason && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Motivo de reemplazo: {document.replacementReason}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDate(document.documentDate)}</Typography>
                        <Typography variant="caption" color="text.secondary">Cargado: {formatTimestamp(document.createdAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>{document.fileName}</Typography>
                        <Typography variant="caption" color="text.secondary">{(document.size / (1024 * 1024)).toFixed(2)} MB</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" startIcon={<OpenInNewOutlinedIcon />} onClick={() => void openPdf(document)}>Abrir</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {currentDialogMainPdf && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>El contrato principal actual está identificado; las versiones anteriores se conservan como historial.</Typography>}
        </DialogContent>
        <DialogActions><Button onClick={() => setDocumentsOpen(false)}>Cerrar</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(terminateTarget)} onClose={() => setTerminateTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Terminar contrato</DialogTitle>
        <DialogContent>
          <Typography variant="body2">¿Marcar como terminado el contrato «{terminateTarget?.object}»? El registro y todos sus PDF se conservarán.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTerminateTarget(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => void handleTerminate()}>Terminar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={7000} onClose={() => setSnackbar((current) => ({ ...current, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((current) => ({ ...current, open: false }))} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Stack>
  );
};

export default Contracts;
