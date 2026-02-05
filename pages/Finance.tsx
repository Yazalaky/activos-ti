import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  InputLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { addInvoice, addSupplier, deleteInvoice, getInvoices, getSites, getSuppliers, updateInvoice, updateSupplier } from '../services/api';
import type { Invoice, Site, Supplier } from '../types';
import { uploadFileToStorage } from '../services/storageUpload';
import { useAuth } from '../auth/AuthContext';
import { deleteStoragePath } from '../services/storageFiles';

type TabKey = 'invoices' | 'suppliers' | 'reports';

const getDisplayStatus = (inv: Invoice) => {
  if (inv.status === 'paid') {
    return { label: 'Pagado', color: 'success' as const, icon: <CheckCircleOutlinedIcon fontSize="small" /> };
  }

  const today = new Date().toISOString().split('T')[0];
  if (inv.dueDate && inv.dueDate < today) {
    return { label: 'Vencido', color: 'error' as const, icon: <ErrorOutlineOutlinedIcon fontSize="small" /> };
  }

  return { label: 'Pendiente', color: 'warning' as const, icon: <ScheduleOutlinedIcon fontSize="small" /> };
};

type InvoiceTableProps = {
  invoices: Invoice[];
  suppliers: Supplier[];
  sites: Site[];
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
  onToggleStatus: (inv: Invoice) => void;
};

const InvoiceTable = React.memo(function InvoiceTable({
  invoices,
  suppliers,
  sites,
  canWrite,
  canDelete,
  onEdit,
  onDelete,
  onToggleStatus,
}: InvoiceTableProps) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 800 }}>Factura</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Detalle / Sede</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Fechas</TableCell>
          <TableCell sx={{ fontWeight: 800 }} align="right">
            Valor
          </TableCell>
          <TableCell sx={{ fontWeight: 800 }} align="right">
            Acciones
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {invoices.map((inv) => {
          const statusInfo = getDisplayStatus(inv);
          const supplierName = suppliers.find((s) => s.id === inv.supplierId)?.name || 'N/A';
          const siteName = sites.find((s) => s.id === inv.siteId)?.name || 'Sede N/A';

          return (
            <TableRow key={inv.id} hover>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                  {inv.number}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {supplierName}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                  {inv.description}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <BusinessOutlinedIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="primary">
                    {siteName}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <Chip
                  icon={statusInfo.icon}
                  label={statusInfo.label}
                  color={statusInfo.color}
                  onClick={canWrite ? () => onToggleStatus(inv) : undefined}
                  sx={{ fontWeight: 800 }}
                />
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Rad: {inv.date}
                </Typography>
                {inv.dueDate && (
                  <Typography variant="caption" color={statusInfo.label === 'Vencido' ? 'error.main' : 'text.secondary'}>
                    Venc: {inv.dueDate}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                  ${Number(inv.total || 0).toLocaleString()}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  {canWrite && (
                    <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => onEdit(inv)}>
                      Editar
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="small" variant="text" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => onDelete(inv)}>
                      Eliminar
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<DescriptionOutlinedIcon />}
                    disabled={!inv.pdfUrl}
                    onClick={() => {
                      if (!inv.pdfUrl) return;
                      window.open(inv.pdfUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    PDF
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          );
        })}

        {invoices.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} sx={{ py: 6 }}>
              <Typography variant="body2" color="text.secondary" align="center">
                No hay facturas registradas con los filtros seleccionados.
              </Typography>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
});

const createInitialInvoiceState = (): Partial<Invoice> => ({
  date: new Date().toISOString().split('T')[0],
  dueDate: '',
  siteId: '',
  supplierId: '',
  number: '',
  description: '',
  total: 0,
  status: 'pending',
});

const Finance = () => {
  const { role } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';
  const canDelete = role === 'admin';
  const [activeTab, setActiveTab] = useState<TabKey>('invoices');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState('');

  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceUploadPct, setInvoiceUploadPct] = useState<number>(0);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [deleteAttachmentOpen, setDeleteAttachmentOpen] = useState(false);
  const [deleteInvoiceOpen, setDeleteInvoiceOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'error' | 'success' | 'warning' }>({
    open: false,
    message: '',
    severity: 'warning',
  });

  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({});
  const [invoiceTotalText, setInvoiceTotalText] = useState<string>('');

  const normalizeInvoiceNumber = (value: string) =>
    value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  const parseCopAmount = (input: string): number => {
    const raw = input.trim();
    if (!raw) return 0;
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return 0;
    const num = Number.parseInt(digits, 10);
    return Number.isFinite(num) ? num : 0;
  };

  const [invoiceForm, setInvoiceForm] = useState<Partial<Invoice>>(createInitialInvoiceState);

  const sortedSuppliers = useMemo(
    () => suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [suppliers]
  );

  const sortedSites = useMemo(
    () => sites.slice().sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [sites]
  );

  const loadData = async () => {
    const [sup, inv, s] = await Promise.all([getSuppliers(), getInvoices(), getSites()]);
    setSuppliers(sup);
    setInvoices([...inv]);
    setSites(s);
  };

  useEffect(() => {
    loadData();
  }, []);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedSiteFilter('');
    setSelectedSupplierFilter('');
    setInvoiceNumberFilter('');
  };

  const filteredInvoices = useMemo(() => {
    const numberQuery = normalizeInvoiceNumber(invoiceNumberFilter);
    const filtered = invoices.filter((inv) => {
      if (startDate && inv.date < startDate) return false;
      if (endDate && inv.date > endDate) return false;
      if (selectedSiteFilter && inv.siteId !== selectedSiteFilter) return false;
      if (selectedSupplierFilter && inv.supplierId !== selectedSupplierFilter) return false;
      if (numberQuery && normalizeInvoiceNumber(String(inv.number || '')).indexOf(numberQuery) === -1) return false;
      return true;
    });
    return filtered
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [invoices, startDate, endDate, selectedSiteFilter, selectedSupplierFilter, invoiceNumberFilter]);

  const totals = useMemo(() => {
    const totalInvoiced = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const totalPaid = filteredInvoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const totalPending = filteredInvoices.filter((inv) => inv.status === 'pending').reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    return { totalInvoiced, totalPaid, totalPending };
  }, [filteredInvoices]);

  const openCreateInvoice = useCallback(() => {
    setEditingInvoiceId(null);
    setInvoiceForm(createInitialInvoiceState());
    setInvoiceTotalText('');
    setShowInvoiceDialog(true);
    setInvoiceFile(null);
    setInvoiceUploadPct(0);
    setDeleteAttachmentOpen(false);
  }, []);

  const openEditInvoice = useCallback((inv: Invoice) => {
    setInvoiceForm(inv);
    setEditingInvoiceId(inv.id);
    setInvoiceTotalText(inv.total ? String(Math.round(Number(inv.total))) : '');
    setShowInvoiceDialog(true);
    setInvoiceFile(null);
    setInvoiceUploadPct(0);
    setDeleteAttachmentOpen(false);
  }, []);

  const closeInvoiceDialog = useCallback(() => {
    setShowInvoiceDialog(false);
    setInvoiceForm(createInitialInvoiceState());
    setEditingInvoiceId(null);
    setInvoiceFile(null);
    setInvoiceUploadPct(0);
    setInvoiceTotalText('');
    setSavingInvoice(false);
    setDeleteAttachmentOpen(false);
  }, []);

  const openCreateSupplier = () => {
    setEditingSupplierId(null);
    setSupplierForm({});
    setShowSupplierDialog(true);
  };

  const openEditSupplier = (sup: Supplier) => {
    setEditingSupplierId(sup.id);
    setSupplierForm(sup);
    setShowSupplierDialog(true);
  };

  const closeSupplierDialog = () => {
    setShowSupplierDialog(false);
    setSupplierForm({});
    setEditingSupplierId(null);
  };

  const clearSelectedInvoiceFile = () => {
    setInvoiceFile(null);
    setInvoiceUploadPct(0);
  };

  const openDeleteInvoice = useCallback((inv: Invoice) => {
    setInvoiceToDelete(inv);
    setDeleteInvoiceOpen(true);
  }, []);

  const closeDeleteInvoice = useCallback(() => {
    setDeleteInvoiceOpen(false);
    setInvoiceToDelete(null);
  }, []);

  const handleDeleteInvoice = async () => {
    if (!canDelete || !invoiceToDelete) return;
    try {
      setDeletingInvoice(true);
      const path = String(invoiceToDelete.pdfPath || '').trim();
      if (path) {
        await deleteStoragePath(path).catch(() => undefined);
      }
      await deleteInvoice(invoiceToDelete.id);
      setSnackbar({ open: true, message: 'Factura eliminada.', severity: 'success' });
      closeDeleteInvoice();
      loadData();
    } catch (error) {
      console.error('Delete invoice error:', error);
      setSnackbar({ open: true, message: 'No se pudo eliminar la factura.', severity: 'error' });
    } finally {
      setDeletingInvoice(false);
    }
  };

  const handleDeleteInvoiceAttachment = async () => {
    if (!canWrite) return;
    if (!editingInvoiceId) {
      setInvoiceForm((prev) => ({
        ...prev,
        pdfUrl: undefined,
        pdfPath: undefined,
        pdfName: undefined,
        pdfContentType: undefined,
        pdfSize: undefined,
      }));
      clearSelectedInvoiceFile();
      setDeleteAttachmentOpen(false);
      return;
    }

    try {
      setSavingInvoice(true);
      const path = String(invoiceForm.pdfPath || '').trim();
      if (path) await deleteStoragePath(path);
      await updateInvoice(editingInvoiceId, {
        pdfUrl: null,
        pdfPath: null,
        pdfName: null,
        pdfContentType: null,
        pdfSize: null,
      } as any);
      setInvoiceForm((prev) => ({
        ...prev,
        pdfUrl: undefined,
        pdfPath: undefined,
        pdfName: undefined,
        pdfContentType: undefined,
        pdfSize: undefined,
      }));
      clearSelectedInvoiceFile();
      setSnackbar({ open: true, message: 'Adjunto eliminado.', severity: 'success' });
    } catch (error) {
      console.error('Delete invoice attachment error:', error);
      setSnackbar({ open: true, message: 'No se pudo eliminar el adjunto.', severity: 'error' });
    } finally {
      setSavingInvoice(false);
      setDeleteAttachmentOpen(false);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name || !supplierForm.nit) {
      setSnackbar({ open: true, message: 'Complete al menos nombre y NIT.', severity: 'warning' });
      return;
    }
    try {
      if (editingSupplierId) {
        const { id, ...toUpdate } = supplierForm as any;
        await updateSupplier(editingSupplierId, toUpdate);
        setSnackbar({ open: true, message: 'Proveedor actualizado.', severity: 'success' });
      } else {
        await addSupplier(supplierForm as Omit<Supplier, 'id'>);
        setSnackbar({ open: true, message: 'Proveedor guardado.', severity: 'success' });
      }
      closeSupplierDialog();
      loadData();
    } catch (error) {
      console.error('Error saving supplier:', error);
      setSnackbar({ open: true, message: 'No se pudo guardar el proveedor.', severity: 'error' });
    }
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.supplierId || !invoiceForm.siteId || !invoiceForm.number || !invoiceForm.description) {
      setSnackbar({ open: true, message: 'Complete los campos requeridos.', severity: 'warning' });
      return;
    }
    const normalizedNumber = normalizeInvoiceNumber(String(invoiceForm.number || ''));
    if (!normalizedNumber) {
      setSnackbar({ open: true, message: 'Ingrese un número de factura válido.', severity: 'warning' });
      return;
    }
    const hasDuplicate = invoices.some((inv) => {
      if (editingInvoiceId && inv.id === editingInvoiceId) return false;
      if (inv.supplierId !== invoiceForm.supplierId) return false;
      return normalizeInvoiceNumber(String(inv.number || '')) === normalizedNumber;
    });
    if (hasDuplicate) {
      setSnackbar({
        open: true,
        message: 'Ya existe una factura con ese número para el mismo proveedor.',
        severity: 'warning',
      });
      return;
    }
    if (!Number.isFinite(Number(invoiceForm.total)) || Number(invoiceForm.total) <= 0) {
      setSnackbar({ open: true, message: 'Ingrese un valor total válido.', severity: 'warning' });
      return;
    }

    try {
      setSavingInvoice(true);

      if (editingInvoiceId) {
        const { id, createdAt, ...toUpdate } = invoiceForm as any;

        if (invoiceFile) {
          const prevPath = String(invoiceForm.pdfPath || '').trim();
          const ts = Date.now();
          const result = await uploadFileToStorage(
            `invoices/${editingInvoiceId}/attachments/${ts}-${invoiceFile.name}`,
            invoiceFile,
            setInvoiceUploadPct
          );
          toUpdate.pdfUrl = result.url;
          toUpdate.pdfPath = result.path;
          toUpdate.pdfName = result.name;
          toUpdate.pdfContentType = result.contentType;
          toUpdate.pdfSize = result.size;

          if (prevPath && prevPath !== result.path) {
            deleteStoragePath(prevPath).catch(() => undefined);
          }
        }

        await updateInvoice(editingInvoiceId, toUpdate);
        setSnackbar({ open: true, message: 'Factura actualizada.', severity: 'success' });
      } else {
        const { id, createdAt, pdfUrl, pdfPath, pdfName, pdfContentType, pdfSize, ...createPayload } = invoiceForm as any;
        const newInvoice = { ...createPayload, status: invoiceForm.status || 'pending' };
        const docRef: any = await addInvoice(newInvoice as Omit<Invoice, 'id'>);

        if (invoiceFile) {
          const ts = Date.now();
          const result = await uploadFileToStorage(
            `invoices/${docRef.id}/attachments/${ts}-${invoiceFile.name}`,
            invoiceFile,
            setInvoiceUploadPct
          );
          await updateInvoice(docRef.id, {
            pdfUrl: result.url,
            pdfPath: result.path,
            pdfName: result.name,
            pdfContentType: result.contentType,
            pdfSize: result.size,
          });
        }

        setSnackbar({ open: true, message: 'Factura guardada.', severity: 'success' });
      }

      closeInvoiceDialog();
      loadData();
    } catch (error) {
      console.error('Error saving invoice:', error);
      setSnackbar({ open: true, message: 'No se pudo guardar la factura.', severity: 'error' });
    } finally {
      setSavingInvoice(false);
    }
  };

  const toggleInvoiceStatus = useCallback(
    async (inv: Invoice) => {
      if (!canWrite) return;
      const newStatus: Invoice['status'] = inv.status === 'paid' ? 'pending' : 'paid';
      setInvoices((prev) => prev.map((item) => (item.id === inv.id ? { ...item, status: newStatus } : item)));
      await updateInvoice(inv.id, { status: newStatus });
    },
    [canWrite]
  );

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Gestión financiera
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Facturas, proveedores y reporte de costos
        </Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ '& .MuiTab-root': { fontWeight: 800 } }}
      >
        <Tab value="invoices" label="Facturas" />
        <Tab value="suppliers" label="Proveedores" />
        <Tab value="reports" label="Reporte de costos" />
      </Tabs>

      {(activeTab === 'invoices' || activeTab === 'reports') && (
        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-end' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 220 }}>
                <FilterAltOutlinedIcon color="action" />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Filtros
                </Typography>
              </Stack>

              <TextField
                label="Desde"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: '100%', sm: 220 } }}
              />
              <TextField
                label="Hasta"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: '100%', sm: 220 } }}
              />

              <TextField
                label="No. Factura"
                value={invoiceNumberFilter}
                onChange={(e) => setInvoiceNumberFilter(e.target.value)}
                sx={{ width: { xs: '100%', sm: 220 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon />
                    </InputAdornment>
                  ),
                }}
              />

              <FormControl sx={{ width: { xs: '100%', sm: 260 } }}>
                <InputLabel id="filter-site-label">Sede</InputLabel>
                <Select
                  labelId="filter-site-label"
                  label="Sede"
                  value={selectedSiteFilter}
                  onChange={(e) => setSelectedSiteFilter(String(e.target.value))}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {sortedSites.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ width: { xs: '100%', sm: 260 } }}>
                <InputLabel id="filter-supplier-label">Proveedor</InputLabel>
                <Select
                  labelId="filter-supplier-label"
                  label="Proveedor"
                  value={selectedSupplierFilter}
                  onChange={(e) => setSelectedSupplierFilter(String(e.target.value))}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {sortedSuppliers.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {(startDate || endDate || selectedSiteFilter || selectedSupplierFilter || invoiceNumberFilter) && (
                <Button
                  variant="text"
                  color="error"
                  startIcon={<ClearOutlinedIcon />}
                  onClick={clearFilters}
                  sx={{ ml: 'auto' }}
                >
                  Limpiar
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {activeTab === 'invoices' && (
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            {canWrite && (
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreateInvoice}>
                Nueva factura
              </Button>
            )}
          </Box>

          <Card>
            <CardContent sx={{ p: 0 }}>
              <InvoiceTable
                invoices={filteredInvoices}
                suppliers={suppliers}
                sites={sites}
                canWrite={canWrite}
                canDelete={canDelete}
                onEdit={openEditInvoice}
                onDelete={openDeleteInvoice}
                onToggleStatus={toggleInvoiceStatus}
              />
            </CardContent>
          </Card>
        </Stack>
      )}

      {activeTab === 'suppliers' && (
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            {canWrite && (
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreateSupplier}>
                Nuevo proveedor
              </Button>
            )}
          </Box>

          <Grid container spacing={2}>
            {suppliers.map((sup) => (
              <Grid key={sup.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900 }} noWrap>
                          {sup.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          NIT: {sup.nit}
                        </Typography>
                      </Box>
                      {canWrite && (
                        <Button size="small" variant="text" startIcon={<EditOutlinedIcon />} onClick={() => openEditSupplier(sup)}>
                          Editar
                        </Button>
                      )}
                    </Stack>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="body2">Tel: {sup.phone || '—'}</Typography>
                    <Typography variant="body2">Email: {sup.email || '—'}</Typography>
                    <Box sx={{ mt: 1.5 }}>
                      <Chip label={sup.category || '—'} variant="outlined" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}

            {suppliers.length === 0 && (
              <Grid size={12}>
                <Card sx={{ borderStyle: 'dashed' }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" align="center">
                      No hay proveedores registrados.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Stack>
      )}

      {activeTab === 'reports' && (
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: 0.6 }}>
                    TOTAL FACTURADO
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>
                    ${totals.totalInvoiced.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    en el periodo
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: 0.6 }}>
                    TOTAL PAGADO
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5, color: 'success.main' }}>
                    ${totals.totalPaid.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {totals.totalInvoiced > 0 ? Math.round((totals.totalPaid / totals.totalInvoiced) * 100) : 0}% del total
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: 0.6 }}>
                    PENDIENTE / VENCIDO
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5, color: 'error.main' }}>
                    ${totals.totalPending.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    por pagar
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Detalle de costos
                </Typography>
                <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} disabled>
                  Exportar
                </Button>
              </Box>
              <Divider />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Fecha</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Factura</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Proveedor</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Sede</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">
                      Total
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInvoices.map((inv) => {
                    const statusInfo = getDisplayStatus(inv);
                    const supplierName = suppliers.find((s) => s.id === inv.supplierId)?.name || 'N/A';
                    const siteName = sites.find((s) => s.id === inv.siteId)?.name || 'Sede N/A';

                    return (
                      <TableRow key={inv.id} hover>
                        <TableCell>{inv.date}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{inv.number}</TableCell>
                        <TableCell>{supplierName}</TableCell>
                        <TableCell>{siteName}</TableCell>
                        <TableCell>
                          <Chip icon={statusInfo.icon} label={statusInfo.label} color={statusInfo.color} size="small" />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900 }}>
                          ${Number(inv.total || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredInvoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 6 }}>
                        <Typography variant="body2" color="text.secondary" align="center">
                          No hay datos para el periodo seleccionado.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Stack>
      )}

      <Dialog open={showSupplierDialog} onClose={closeSupplierDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {editingSupplierId ? 'Editar proveedor' : 'Nuevo proveedor'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSaveSupplier} sx={{ mt: 1 }}>
            {!canWrite && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Modo solo lectura (Gerencia/Auditoría). No puedes crear o editar proveedores.
              </Alert>
            )}
            <Stack spacing={2}>
              <TextField
                label="Nombre"
                value={supplierForm.name || ''}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="NIT"
                value={supplierForm.nit || ''}
                onChange={(e) => setSupplierForm({ ...supplierForm, nit: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Contacto"
                value={supplierForm.contactName || ''}
                onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                fullWidth
              />
              <TextField
                label="Teléfono"
                value={supplierForm.phone || ''}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                fullWidth
              />
              <TextField
                label="Email"
                value={supplierForm.email || ''}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                fullWidth
              />
              <TextField
                label="Categoría"
                value={supplierForm.category || ''}
                onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                fullWidth
              />
            </Stack>

            <DialogActions sx={{ px: 0, mt: 2 }}>
              <Button onClick={closeSupplierDialog}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={!canWrite}>
                Guardar
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={showInvoiceDialog} onClose={closeInvoiceDialog} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {editingInvoiceId ? 'Editar factura' : 'Nueva factura'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSaveInvoice} sx={{ mt: 1 }}>
            {!canWrite && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Modo solo lectura (Gerencia/Auditoría). No puedes crear o editar facturas.
              </Alert>
            )}
            {(savingInvoice && invoiceFile) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Subiendo adjunto… {invoiceUploadPct}%
                </Typography>
                <LinearProgress variant="determinate" value={invoiceUploadPct} sx={{ mt: 0.5, borderRadius: 99 }} />
              </Box>
            )}

            {invoiceFile && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Archivo seleccionado: <strong>{invoiceFile.name}</strong>
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel id="invoice-supplier-label">Proveedor</InputLabel>
                  <Select
                    labelId="invoice-supplier-label"
                    label="Proveedor"
                    value={invoiceForm.supplierId || ''}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, supplierId: String(e.target.value) })}
                  >
                    <MenuItem value="">Seleccione...</MenuItem>
                    {sortedSuppliers.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel id="invoice-site-label">Sede</InputLabel>
                  <Select
                    labelId="invoice-site-label"
                    label="Sede"
                    value={invoiceForm.siteId || ''}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, siteId: String(e.target.value) })}
                  >
                    <MenuItem value="">Seleccione...</MenuItem>
                    {sortedSites.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="No. Factura"
                  value={invoiceForm.number || ''}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, number: e.target.value })}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Valor total"
                  type="text"
                  inputMode="numeric"
                  value={invoiceTotalText}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '');
                    setInvoiceTotalText(digitsOnly);
                    setInvoiceForm({ ...invoiceForm, total: parseCopAmount(digitsOnly) });
                  }}
                  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                  required
                  fullWidth
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Fecha radicación"
                  type="date"
                  value={invoiceForm.date || ''}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Fecha vencimiento"
                  type="date"
                  value={invoiceForm.dueDate || ''}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="invoice-status-label">Estado</InputLabel>
                  <Select
                    labelId="invoice-status-label"
                    label="Estado"
                    value={invoiceForm.status || 'pending'}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value as Invoice['status'] })}
                  >
                    <MenuItem value="pending">Pendiente</MenuItem>
                    <MenuItem value="paid">Pagado</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<DescriptionOutlinedIcon />}
                  fullWidth
                  sx={{ height: 56 }}
                  disabled={savingInvoice}
                >
                  {invoiceForm.pdfUrl || invoiceFile ? 'Reemplazar adjunto' : 'Cargar factura (PDF/imagen)'}
                  <input
                    hidden
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setInvoiceFile(file);
                      setInvoiceUploadPct(0);
                    }}
                  />
                </Button>
              </Grid>

              <Grid size={12}>
                <TextField
                  label="Servicio o descripción"
                  value={invoiceForm.description || ''}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  required
                  fullWidth
                  multiline
                  minRows={3}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <DialogActions sx={{ px: 0 }}>
              {invoiceForm.pdfUrl && (
                <Button
                  startIcon={<OpenInNewOutlinedIcon />}
                  onClick={() => window.open(String(invoiceForm.pdfUrl), '_blank', 'noopener,noreferrer')}
                >
                  Ver adjunto
                </Button>
              )}
              {invoiceFile && (
                <Button
                  startIcon={<ClearOutlinedIcon />}
                  disabled={savingInvoice}
                  onClick={clearSelectedInvoiceFile}
                >
                  Quitar selección
                </Button>
              )}
              {invoiceForm.pdfUrl && (
                <Button
                  color="error"
                  startIcon={<DeleteOutlineOutlinedIcon />}
                  disabled={!canWrite || savingInvoice}
                  onClick={() => setDeleteAttachmentOpen(true)}
                >
                  Eliminar adjunto
                </Button>
              )}
              <Button onClick={closeInvoiceDialog}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={savingInvoice || !canWrite}>
                {editingInvoiceId ? 'Actualizar' : 'Guardar'}
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAttachmentOpen} onClose={() => setDeleteAttachmentOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>Eliminar adjunto</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            ¿Confirmas eliminar el adjunto de esta factura?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAttachmentOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDeleteInvoiceAttachment} disabled={!canWrite || savingInvoice}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteInvoiceOpen} onClose={closeDeleteInvoice} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>Eliminar factura</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            ¿Confirmas eliminar esta factura? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteInvoice}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDeleteInvoice} disabled={!canDelete || deletingInvoice}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '', severity: 'warning' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ open: false, message: '', severity: 'warning' })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default Finance;
