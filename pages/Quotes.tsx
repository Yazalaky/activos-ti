import React, { useEffect, useMemo, useState } from 'react';
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
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { addQuote, deleteQuote, getQuotes, getSites, getSuppliers, updateQuote } from '../services/api';
import { uploadFileToStorage } from '../services/storageUpload';
import { deleteStoragePath } from '../services/storageFiles';
import { useAuth } from '../auth/AuthContext';
import type { Quote, QuoteStatus, Site, Supplier } from '../types';

const statusLabel: Record<QuoteStatus, string> = {
  pending: 'En espera',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const statusColor = (status: QuoteStatus) => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    case 'pending':
    default:
      return 'warning';
  }
};

const Quotes = () => {
  const { role, user } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';
  const canDelete = role === 'admin';

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<QuoteStatus | ''>('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Quote>>({
    date: new Date().toISOString().split('T')[0],
    supplierId: '',
    siteId: '',
    status: 'pending',
    notes: '',
  });

  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'warning',
  });

  const loadData = async () => {
    const [q, s, sup] = await Promise.all([getQuotes(), getSites(), getSuppliers()]);
    setQuotes(q);
    setSites(s);
    setSuppliers(sup);
  };

  useEffect(() => {
    loadData();
  }, []);

  const sortedSuppliers = useMemo(
    () => suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [suppliers]
  );

  const sortedSites = useMemo(
    () => sites.slice().sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [sites]
  );

  const filteredQuotes = useMemo(() => {
    return quotes
      .filter((q) => {
        if (startDate && q.date < startDate) return false;
        if (endDate && q.date > endDate) return false;
        if (selectedSiteFilter && q.siteId !== selectedSiteFilter) return false;
        if (selectedSupplierFilter && q.supplierId !== selectedSupplierFilter) return false;
        if (selectedStatusFilter && q.status !== selectedStatusFilter) return false;
        return true;
      })
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [quotes, startDate, endDate, selectedSiteFilter, selectedSupplierFilter, selectedStatusFilter]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedSiteFilter('');
    setSelectedSupplierFilter('');
    setSelectedStatusFilter('');
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      supplierId: '',
      siteId: '',
      status: 'pending',
      notes: '',
    });
    setQuoteFile(null);
    setUploadPct(0);
    setDialogOpen(true);
  };

  const openEdit = (quote: Quote) => {
    setEditingId(quote.id);
    setFormData(quote);
    setQuoteFile(null);
    setUploadPct(0);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      supplierId: '',
      siteId: '',
      status: 'pending',
      notes: '',
    });
    setQuoteFile(null);
    setUploadPct(0);
  };

  const openDelete = (quote: Quote) => {
    setQuoteToDelete(quote);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setQuoteToDelete(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siteId || !formData.supplierId || !formData.date) {
      setSnackbar({ open: true, message: 'Complete fecha, sede y proveedor.', severity: 'warning' });
      return;
    }
    if (!formData.pdfUrl && !quoteFile) {
      setSnackbar({ open: true, message: 'Adjunta el PDF de la cotización.', severity: 'warning' });
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        const { id, createdAt, ...toUpdate } = formData as any;

        if (quoteFile) {
          const prevPath = String(formData.pdfPath || '').trim();
          const ts = Date.now();
          const result = await uploadFileToStorage(`quotes/${editingId}/attachments/${ts}-${quoteFile.name}`, quoteFile, setUploadPct);
          toUpdate.pdfUrl = result.url;
          toUpdate.pdfPath = result.path;
          toUpdate.pdfName = result.name;
          toUpdate.pdfContentType = result.contentType;
          toUpdate.pdfSize = result.size;
          if (prevPath && prevPath !== result.path) {
            deleteStoragePath(prevPath).catch(() => undefined);
          }
        }

        await updateQuote(editingId, toUpdate);
        setSnackbar({ open: true, message: 'Cotización actualizada.', severity: 'success' });
      } else {
        const { id, createdAt, pdfUrl, pdfPath, pdfName, pdfContentType, pdfSize, ...createPayload } = formData as any;
        const docRef: any = await addQuote({
          ...createPayload,
          status: formData.status || 'pending',
          createdAt: Date.now(),
          createdByUid: user?.uid,
        });

        if (quoteFile) {
          const ts = Date.now();
          const result = await uploadFileToStorage(`quotes/${docRef.id}/attachments/${ts}-${quoteFile.name}`, quoteFile, setUploadPct);
          await updateQuote(docRef.id, {
            pdfUrl: result.url,
            pdfPath: result.path,
            pdfName: result.name,
            pdfContentType: result.contentType,
            pdfSize: result.size,
          });
        }
        setSnackbar({ open: true, message: 'Cotización guardada.', severity: 'success' });
      }

      closeDialog();
      loadData();
    } catch (error) {
      console.error('Error saving quote:', error);
      setSnackbar({ open: true, message: 'No se pudo guardar la cotización.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || !quoteToDelete) return;
    try {
      setSaving(true);
      const path = String(quoteToDelete.pdfPath || '').trim();
      if (path) await deleteStoragePath(path);
      await deleteQuote(quoteToDelete.id);
      setSnackbar({ open: true, message: 'Cotización eliminada.', severity: 'success' });
      closeDelete();
      loadData();
    } catch (error) {
      console.error('Delete quote error:', error);
      setSnackbar({ open: true, message: 'No se pudo eliminar la cotización.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Cotizaciones
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Registro de cotizaciones por sede y proveedor.
          </Typography>
        </Box>

        {canWrite && (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>
            Nueva cotización
          </Button>
        )}
      </Stack>

      {!canWrite && (
        <Alert severity="info">Modo solo lectura (Gerencia/Auditoría). Puedes ver cotizaciones, pero no crear o editar.</Alert>
      )}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-end' }}>
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
            <FormControl sx={{ width: { xs: '100%', sm: 240 } }}>
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
            <FormControl sx={{ width: { xs: '100%', sm: 240 } }}>
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
            <FormControl sx={{ width: { xs: '100%', sm: 200 } }}>
              <InputLabel id="filter-status-label">Estado</InputLabel>
              <Select
                labelId="filter-status-label"
                label="Estado"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter((e.target.value as QuoteStatus) || '')}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="pending">En espera</MenuItem>
                <MenuItem value="approved">Aprobada</MenuItem>
                <MenuItem value="rejected">Rechazada</MenuItem>
              </Select>
            </FormControl>

            {(startDate || endDate || selectedSiteFilter || selectedSupplierFilter || selectedStatusFilter) && (
              <Button variant="text" color="error" onClick={clearFilters} sx={{ ml: 'auto' }}>
                Limpiar
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Proveedor</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Sede</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Observación</TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="right">
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredQuotes.map((quote) => {
                const supplierName = suppliers.find((s) => s.id === quote.supplierId)?.name || 'N/A';
                const siteName = sites.find((s) => s.id === quote.siteId)?.name || 'Sede N/A';
                return (
                  <TableRow key={quote.id} hover>
                    <TableCell>{quote.date}</TableCell>
                    <TableCell>{supplierName}</TableCell>
                    <TableCell>{siteName}</TableCell>
                    <TableCell>
                      <Chip label={statusLabel[quote.status]} color={statusColor(quote.status) as any} size="small" />
                    </TableCell>
                    <TableCell>{quote.notes || '—'}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<OpenInNewOutlinedIcon />}
                          disabled={!quote.pdfUrl}
                          onClick={() => quote.pdfUrl && window.open(quote.pdfUrl, '_blank', 'noopener,noreferrer')}
                        >
                          PDF
                        </Button>
                        {canWrite && (
                          <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(quote)}>
                            Editar
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="small" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => openDelete(quote)}>
                            Eliminar
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredQuotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary" align="center">
                      No hay cotizaciones con los filtros seleccionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>{editingId ? 'Editar cotización' : 'Nueva cotización'}</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSave} sx={{ mt: 1 }}>
            {!canWrite && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Modo solo lectura (Gerencia/Auditoría). No puedes crear o editar cotizaciones.
              </Alert>
            )}

            {saving && quoteFile && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Subiendo adjunto… {uploadPct}%
                </Typography>
                <LinearProgress variant="determinate" value={uploadPct} sx={{ mt: 0.5, borderRadius: 99 }} />
              </Box>
            )}

            {quoteFile && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Archivo seleccionado: <strong>{quoteFile.name}</strong>
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Fecha"
                  type="date"
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth required>
                  <InputLabel id="quote-site-label">Sede</InputLabel>
                  <Select
                    labelId="quote-site-label"
                    label="Sede"
                    value={formData.siteId || ''}
                    onChange={(e) => setFormData({ ...formData, siteId: String(e.target.value) })}
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
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth required>
                  <InputLabel id="quote-supplier-label">Proveedor</InputLabel>
                  <Select
                    labelId="quote-supplier-label"
                    label="Proveedor"
                    value={formData.supplierId || ''}
                    onChange={(e) => setFormData({ ...formData, supplierId: String(e.target.value) })}
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

              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth required>
                  <InputLabel id="quote-status-label">Estado</InputLabel>
                  <Select
                    labelId="quote-status-label"
                    label="Estado"
                    value={formData.status || 'pending'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as QuoteStatus })}
                  >
                    <MenuItem value="pending">En espera</MenuItem>
                    <MenuItem value="approved">Aprobada</MenuItem>
                    <MenuItem value="rejected">Rechazada</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 8 }}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<DescriptionOutlinedIcon />}
                  fullWidth
                  sx={{ height: 56 }}
                  disabled={saving}
                >
                  {formData.pdfUrl || quoteFile ? 'Reemplazar PDF' : 'Cargar cotización (PDF)'}
                  <input
                    hidden
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setQuoteFile(file);
                      setUploadPct(0);
                    }}
                  />
                </Button>
              </Grid>

              <Grid size={12}>
                <TextField
                  label="Observación"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  fullWidth
                  multiline
                  minRows={3}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <DialogActions sx={{ px: 0 }}>
              {formData.pdfUrl && (
                <Button
                  startIcon={<OpenInNewOutlinedIcon />}
                  onClick={() => window.open(String(formData.pdfUrl), '_blank', 'noopener,noreferrer')}
                >
                  Ver PDF
                </Button>
              )}
              <Button onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={!canWrite || saving}>
                {editingId ? 'Actualizar' : 'Guardar'}
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onClose={closeDelete} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>Eliminar cotización</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            ¿Confirmas eliminar esta cotización? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={!canDelete || saving}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ open: false, message: '', severity: 'warning' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ open: false, message: '', severity: 'warning' })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default Quotes;
