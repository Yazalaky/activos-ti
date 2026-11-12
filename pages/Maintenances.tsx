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
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  LinearProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { addMaintenance, getAssets, getMaintenances, getSites, getSuppliers, softDeleteMaintenance, updateMaintenance } from '../services/api';
import type { Asset, Maintenance, Site, Supplier } from '../types';
import { useAuth } from '../auth/AuthContext';
import { exportToCsv } from '../utils/exportCsv';
import { printReport } from '../utils/printReport';
import { compareSiteNames } from '../utils/sortSites';
import { uploadFileToStorage } from '../services/storageUpload';
import { deleteStoragePath } from '../services/storageFiles';

const statusMap: Record<Maintenance['status'], { label: string; color: any }> = {
  programado: { label: 'Programado', color: 'info' },
  en_proceso: { label: 'En Proceso', color: 'warning' },
  realizado: { label: 'Realizado', color: 'success' },
  cancelado: { label: 'Cancelado', color: 'error' },
};

const maintenanceReportColumns = [
  { key: 'FechaProg', label: 'Fecha programada' },
  { key: 'FechaReal', label: 'Fecha realizada' },
  { key: 'Tipo', label: 'Tipo' },
  { key: 'Estado', label: 'Estado' },
  { key: 'Sede', label: 'Sede' },
  { key: 'Activo', label: 'Activo' },
  { key: 'Proveedor', label: 'Proveedor' },
  { key: 'Tecnico', label: 'Técnico' },
  { key: 'Costo', label: 'Costo' },
  { key: 'Hallazgos', label: 'Hallazgos' },
  { key: 'Acciones', label: 'Acciones' },
  { key: 'ProximaFecha', label: 'Próxima fecha' },
] as const;

const createInitialState = (): Partial<Maintenance> => ({
  type: 'preventivo',
  status: 'programado',
  siteId: '',
  assetId: '',
  scheduledDate: new Date().toISOString().split('T')[0],
  cost: 0,
});

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

const Maintenances = () => {
  const { role, profile } = useAuth();
  const theme = useTheme();
  const canWrite = role === 'admin' || role === 'tech';
  const canDelete = role === 'admin';
  
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const sortedFilterSites = useMemo(() => sites.slice().sort(compareSiteNames), [sites]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Maintenance>>(createInitialState());
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceUploadPct, setEvidenceUploadPct] = useState(0);
  const [saving, setSaving] = useState(false);

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [tablePage, setTablePage] = useState(0);
  const [tableRowsPerPage, setTableRowsPerPage] = useState(25);
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as any });

  const loadData = async () => {
    const [m, s, a, sup] = await Promise.all([getMaintenances(), getSites(), getAssets(), getSuppliers()]);
    setMaintenances(m.filter(x => !x.isDeleted));
    setSites(s);
    setAssets(a);
    setSuppliers(sup);
  };

  useEffect(() => {
    loadData();
  }, []);

  const clearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterSite('');
    setFilterType('');
    setFilterStatus('');
  };

  const filteredMaintenances = useMemo(() => {
    return maintenances.filter(m => {
      if (filterSite && m.siteId !== filterSite) return false;
      if (filterType && m.type !== filterType) return false;
      if (filterStatus && m.status !== filterStatus) return false;
      if (filterStartDate && m.scheduledDate && m.scheduledDate < filterStartDate) return false;
      if (filterEndDate && m.scheduledDate && m.scheduledDate > filterEndDate) return false;
      return true;
    }).sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || ''));
  }, [maintenances, filterSite, filterType, filterStatus, filterStartDate, filterEndDate]);

  useEffect(() => {
    setTablePage(0);
  }, [filteredMaintenances]);

  const visibleMaintenances = filteredMaintenances.slice(
    tablePage * tableRowsPerPage,
    tablePage * tableRowsPerPage + tableRowsPerPage,
  );

  const maintenanceReportRows = useMemo(
    () => filteredMaintenances.map((maintenance) => {
      const site = sites.find((siteItem) => siteItem.id === maintenance.siteId);
      const asset = assets.find((assetItem) => assetItem.id === maintenance.assetId);
      const supplier = suppliers.find((supplierItem) => supplierItem.id === maintenance.supplierId);
      return {
        FechaProg: maintenance.scheduledDate || '',
        FechaReal: maintenance.completedDate || '',
        Tipo: maintenance.type,
        Estado: maintenance.status,
        Sede: site?.name || '',
        Activo: asset?.fixedAssetId || '',
        Proveedor: supplier?.name || '',
        Tecnico: maintenance.technicianName || '',
        Costo: maintenance.cost || 0,
        Hallazgos: maintenance.findings || '',
        Acciones: maintenance.actionsTaken || '',
        ProximaFecha: maintenance.nextMaintenanceDate || '',
      };
    }),
    [filteredMaintenances, sites, assets, suppliers],
  );

  const openCreate = () => {
    setEditingId(null);
    setFormData(createInitialState());
    setEvidenceFile(null);
    setEvidenceUploadPct(0);
    setDialogOpen(true);
  };

  const openEdit = (m: Maintenance) => {
    setEditingId(m.id);
    setFormData(m);
    setEvidenceFile(null);
    setEvidenceUploadPct(0);
    setDialogOpen(true);
  };
  
  const closeDialog = () => {
    setDialogOpen(false);
    setFormData(createInitialState());
    setEditingId(null);
    setEvidenceFile(null);
    setEvidenceUploadPct(0);
    setSaving(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siteId || !formData.assetId) {
      setSnackbar({ open: true, message: 'Seleccione Sede y Activo.', severity: 'warning' });
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        const dataToUpdate: Partial<Maintenance> = { ...formData };

        if (evidenceFile) {
          const previousPath = String(formData.evidencePath || '').trim();
          const ts = Date.now();
          const result = await uploadFileToStorage(
            `maintenances/${editingId}/attachments/${ts}-${evidenceFile.name}`,
            evidenceFile,
            setEvidenceUploadPct
          );
          dataToUpdate.evidenceUrl = result.url;
          dataToUpdate.evidencePath = result.path;
          dataToUpdate.evidenceName = result.name;
          dataToUpdate.evidenceContentType = result.contentType;
          dataToUpdate.evidenceSize = result.size;

          if (previousPath && previousPath !== result.path) {
            deleteStoragePath(previousPath).catch(() => undefined);
          }
        }

        await updateMaintenance(editingId, dataToUpdate, profile?.uid);
        setSnackbar({ open: true, message: 'Mantenimiento actualizado.', severity: 'success' });
      } else {
        const { evidenceUrl, evidencePath, evidenceName, evidenceContentType, evidenceSize, ...createPayload } = formData as any;
        const docRef: any = await addMaintenance(createPayload as Omit<Maintenance, 'id'>, profile?.uid);

        if (evidenceFile) {
          const ts = Date.now();
          const result = await uploadFileToStorage(
            `maintenances/${docRef.id}/attachments/${ts}-${evidenceFile.name}`,
            evidenceFile,
            setEvidenceUploadPct
          );
          await updateMaintenance(docRef.id, {
            evidenceUrl: result.url,
            evidencePath: result.path,
            evidenceName: result.name,
            evidenceContentType: result.contentType,
            evidenceSize: result.size,
          }, profile?.uid);
        }

        setSnackbar({ open: true, message: 'Mantenimiento creado.', severity: 'success' });
      }
      closeDialog();
      loadData();
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Error al guardar.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar mantenimiento?')) return;
    try {
      await softDeleteMaintenance(id, profile?.uid);
      setSnackbar({ open: true, message: 'Mantenimiento eliminado.', severity: 'success' });
      loadData();
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Error al eliminar.', severity: 'error' });
    }
  };

  const exportData = () => {
    exportToCsv('Mantenimientos', maintenanceReportRows);
  };

  const siteAssets = useMemo(() => assets.filter(a => a.siteId === formData.siteId && a.status !== 'baja'), [assets, formData.siteId]);

  const renderEvidence = (maintenance: Maintenance) => maintenance.evidenceUrl ? (
    <Button size="small" variant="text" href={maintenance.evidenceUrl} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNewOutlinedIcon />}>
      Abrir
    </Button>
  ) : <Typography variant="caption" color="text.secondary">Sin evidencia</Typography>;

  const renderActions = (maintenance: Maintenance) => (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="nowrap">
      {canWrite && <Tooltip title="Editar mantenimiento"><IconButton size="small" aria-label="Editar mantenimiento" onClick={() => openEdit(maintenance)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>}
      {canDelete && <Tooltip title="Eliminar mantenimiento"><IconButton size="small" aria-label="Eliminar mantenimiento" color="error" onClick={() => handleDelete(maintenance.id)}><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton></Tooltip>}
    </Stack>
  );

  return (
    <Stack spacing={2.25} sx={{ '& > .MuiCard-root': { borderRadius: '16px' }, '& > .MuiStack-root .MuiButton-root, & > .MuiCard-root .MuiButton-root': { borderRadius: '10px' } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} sx={{ pt: { xs: 0.5, md: 1 }, pb: 0.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'secondary.main' }} />
            <Typography variant="inherit" sx={{ fontSize: '0.69rem', color: 'text.secondary', fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Gestión de activos TI</Typography>
          </Stack>
          <Typography component="h1" variant="inherit" sx={{ fontWeight: 750, fontSize: { xs: '1.6rem', md: '1.95rem' }, letterSpacing: '-0.035em', lineHeight: 1.15 }}>Mantenimientos</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Gestión de mantenimientos preventivos y correctivos</Typography>
        </Box>
        {canWrite && (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>Nuevo mantenimiento</Button>
        )}
      </Stack>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '10px', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.09) }}><TuneOutlinedIcon fontSize="small" /></Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>Filtros de consulta</Typography>
              <Typography variant="caption" color="text.secondary">Filtra por fecha, sede, tipo o estado</Typography>
            </Box>
          </Stack>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 6, lg: 2.25 }}>
              <TextField label="Desde" size="small" type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.25 }}>
              <TextField label="Hasta" size="small" type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="maintenance-filter-site-label">Sede</InputLabel>
                <Select labelId="maintenance-filter-site-label" value={filterSite} label="Sede" onChange={e => setFilterSite(e.target.value)}>
                  <MenuItem value="">Todas</MenuItem>
                  {sortedFilterSites.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.25 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="maintenance-filter-type-label">Tipo</InputLabel>
                <Select labelId="maintenance-filter-type-label" value={filterType} label="Tipo" onChange={e => setFilterType(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="preventivo">Preventivo</MenuItem>
                  <MenuItem value="correctivo">Correctivo</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.25 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="maintenance-filter-status-label">Estado</InputLabel>
                <Select labelId="maintenance-filter-status-label" value={filterStatus} label="Estado" onChange={e => setFilterStatus(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {Object.entries(statusMap).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {(filterStartDate || filterEndDate || filterSite || filterType || filterStatus) && (
            <Box sx={{ mt: 1.25, display: 'flex', justifyContent: 'flex-end' }}><Button size="small" variant="text" onClick={clearFilters}>Limpiar</Button></Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ px: 2.5, py: 2 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '10px', color: 'secondary.main', bgcolor: alpha(theme.palette.secondary.main, 0.1) }}><BuildOutlinedIcon fontSize="small" /></Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 750, letterSpacing: '-0.015em' }}>Registro de mantenimientos</Typography>
                <Typography variant="caption" color="text.secondary">{filteredMaintenances.length.toLocaleString('es-CO')} {filteredMaintenances.length === 1 ? 'mantenimiento coincide' : 'mantenimientos coinciden'} con los filtros actuales</Typography>
              </Box>
            </Stack>
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
              <Button size="small" variant="outlined" onClick={exportData} startIcon={<DownloadOutlinedIcon />} disabled={!maintenanceReportRows.length}>CSV</Button>
              <Button size="small" variant="outlined" onClick={() => printReport('Reporte de mantenimientos', maintenanceReportColumns, maintenanceReportRows)} startIcon={<PrintOutlinedIcon />} disabled={!maintenanceReportRows.length}>PDF / Imprimir</Button>
            </Stack>
          </Stack>
          <Box sx={{ display: { xs: 'none', lg: 'block' }, overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 850, tableLayout: 'fixed', '& .MuiTableCell-root': { px: 1.25, py: 1.25 }, '& .MuiTableCell-head': { fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' } }}>
            <colgroup>
              <col style={{ width: '12%' }} /><col style={{ width: '20%' }} /><col style={{ width: '17%' }} /><col style={{ width: '14%' }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} /><col style={{ width: 100 }} />
            </colgroup>
            <TableHead>
              <TableRow>
                <TableCell>Fecha Prog.</TableCell>
                <TableCell>Activo</TableCell>
                <TableCell>Sede</TableCell>
                <TableCell>Tipo / Estado</TableCell>
                <TableCell>Evidencia</TableCell>
                <TableCell align="right">Costo</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleMaintenances.map(m => {
                const s = sites.find(x => x.id === m.siteId);
                const a = assets.find(x => x.id === m.assetId);
                return (
                  <TableRow key={m.id} hover>
                    <TableCell>{m.scheduledDate || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 750, overflowWrap: 'anywhere' }}>{a?.fixedAssetId || 'Desconocido'}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{a?.brand} {a?.model}</Typography>
                    </TableCell>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>{s?.name || 'Sin sede'}</TableCell>
                    <TableCell>
                      <Stack spacing={0.5} alignItems="flex-start">
                        <Typography variant="caption" sx={{ textTransform: 'uppercase' }}>{m.type}</Typography>
                        <Chip size="small" label={statusMap[m.status]?.label || m.status} color={statusMap[m.status]?.color} sx={{ fontWeight: 700, fontSize: '0.72rem', maxWidth: '100%' }} />
                      </Stack>
                    </TableCell>
                    <TableCell>{renderEvidence(m)}</TableCell>
                    <TableCell align="right" sx={{ overflowWrap: 'anywhere' }}>${Number(m.cost || 0).toLocaleString()}</TableCell>
                    <TableCell align="right">{renderActions(m)}</TableCell>
                  </TableRow>
                );
              })}
              {filteredMaintenances.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}>No hay mantenimientos registrados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </Box>
          <Box sx={{ display: { xs: 'block', lg: 'none' }, px: 2 }}>
            {visibleMaintenances.map(m => {
              const site = sites.find(item => item.id === m.siteId);
              const asset = assets.find(item => item.id === m.assetId);
              return (
                <Box component="article" key={m.id} sx={{ py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 750, overflowWrap: 'anywhere' }}>{asset?.fixedAssetId || 'Desconocido'}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{asset?.brand} {asset?.model}</Typography>
                    </Box>
                    <Chip size="small" label={statusMap[m.status]?.label || m.status} color={statusMap[m.status]?.color} sx={{ fontWeight: 700 }} />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 1, overflowWrap: 'anywhere' }}>{site?.name || 'Sin sede'}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textTransform: 'capitalize' }}>{m.type} · Programado: {m.scheduledDate || '—'}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Costo: ${Number(m.cost || 0).toLocaleString()}</Typography>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mt: 0.75 }}>
                    {renderEvidence(m)}
                    {renderActions(m)}
                  </Stack>
                </Box>
              );
            })}
            {filteredMaintenances.length === 0 && <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 6 }}>No hay mantenimientos registrados.</Typography>}
          </Box>
          <TablePagination
            component="div"
            count={filteredMaintenances.length}
            page={tablePage}
            rowsPerPage={tableRowsPerPage}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage="Filas por página"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            sx={{ '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', justifyContent: 'flex-end', minHeight: 56 }, '& .MuiTablePagination-spacer': { display: { xs: 'none', sm: 'block' } } }}
            onPageChange={(_event, nextPage) => setTablePage(nextPage)}
            onRowsPerPageChange={(event) => {
              setTableRowsPerPage(Number(event.target.value));
              setTablePage(0);
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: { xs: '12px', sm: '18px' }, maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' }, m: { xs: 1.5, sm: 4 } } }}>
        <DialogTitle component="div" sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1 }}>
          <Typography component="h2" variant="h6" sx={{ fontWeight: 900 }}>{editingId ? 'Editar mantenimiento' : 'Nuevo mantenimiento'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Registra el equipo, las fechas y los detalles del mantenimiento.</Typography>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, bgcolor: 'action.hover' }}>
          <Box component="form" onSubmit={handleSave} sx={{ mt: 1 }}>
            <Box sx={{ p: { xs: 2, sm: 2.25 }, border: '1px solid', borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 750, mb: 0.5 }}>Datos del mantenimiento</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>Selecciona la sede y el activo al que corresponde el trabajo.</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel id="maintenance-form-site-label">Sede</InputLabel>
                  <Select labelId="maintenance-form-site-label" value={formData.siteId} label="Sede" onChange={e => setFormData({ ...formData, siteId: e.target.value, assetId: '' })}>
                    {sortedFilterSites.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required disabled={!formData.siteId}>
                  <InputLabel id="maintenance-form-asset-label">Activo</InputLabel>
                  <Select labelId="maintenance-form-asset-label" value={formData.assetId} label="Activo" onChange={e => setFormData({ ...formData, assetId: e.target.value })}>
                    {siteAssets.map(a => <MenuItem key={a.id} value={a.id}>{a.fixedAssetId} - {a.brand} {a.model}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="maintenance-form-type-label">Tipo</InputLabel>
                  <Select labelId="maintenance-form-type-label" value={formData.type} label="Tipo" onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                    <MenuItem value="preventivo">Preventivo</MenuItem>
                    <MenuItem value="correctivo">Correctivo</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="maintenance-form-status-label">Estado</InputLabel>
                  <Select labelId="maintenance-form-status-label" value={formData.status} label="Estado" onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                    {Object.entries(statusMap).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Fecha programada" type="date" InputLabelProps={{ shrink: true }} value={formData.scheduledDate || ''} onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Fecha de realización" type="date" InputLabelProps={{ shrink: true }} value={formData.completedDate || ''} onChange={e => setFormData({ ...formData, completedDate: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="maintenance-form-supplier-label">Proveedor (Opcional)</InputLabel>
                  <Select labelId="maintenance-form-supplier-label" value={formData.supplierId || ''} label="Proveedor (Opcional)" onChange={e => setFormData({ ...formData, supplierId: e.target.value })}>
                    <MenuItem value="">Ninguno</MenuItem>
                    {suppliers.map(sup => <MenuItem key={sup.id} value={sup.id}>{sup.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Costo" type="number" value={formData.cost || ''} onChange={e => setFormData({ ...formData, cost: Number(e.target.value) })} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Técnico" value={formData.technicianName || ''} onChange={e => setFormData({ ...formData, technicianName: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Próximo mantenimiento" type="date" InputLabelProps={{ shrink: true }} value={formData.nextMaintenanceDate || ''} onChange={e => setFormData({ ...formData, nextMaintenanceDate: e.target.value })} />
              </Grid>
              <Grid size={12}>
                <TextField fullWidth multiline minRows={2} label="Hallazgos" value={formData.findings || ''} onChange={e => setFormData({ ...formData, findings: e.target.value })} />
              </Grid>
              <Grid size={12}>
                <TextField fullWidth multiline minRows={2} label="Acciones realizadas" value={formData.actionsTaken || ''} onChange={e => setFormData({ ...formData, actionsTaken: e.target.value })} />
              </Grid>
              <Grid size={12}>
                <Stack spacing={1}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                    <Button component="label" variant="outlined" startIcon={<AttachFileOutlinedIcon />} disabled={saving}>
                      {evidenceFile ? 'Cambiar evidencia' : 'Adjuntar evidencia'}
                      <input
                        hidden
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file && file.size > MAX_EVIDENCE_BYTES) {
                            setEvidenceFile(null);
                            setEvidenceUploadPct(0);
                            setSnackbar({ open: true, message: 'La evidencia no puede superar 10 MB.', severity: 'warning' });
                            e.target.value = '';
                            return;
                          }
                          setEvidenceFile(file);
                          setEvidenceUploadPct(0);
                          e.target.value = '';
                        }}
                      />
                    </Button>
                    {formData.evidenceUrl && (
                      <Button
                        variant="text"
                        href={formData.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<OpenInNewOutlinedIcon />}
                      >
                        Ver evidencia actual
                      </Button>
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {evidenceFile
                      ? `${evidenceFile.name} (${(evidenceFile.size / 1024 / 1024).toFixed(2)} MB)`
                      : formData.evidenceName || 'PDF o imagen, máximo 10 MB.'}
                  </Typography>
                  {evidenceUploadPct > 0 && evidenceUploadPct < 100 && (
                    <LinearProgress variant="determinate" value={evidenceUploadPct} />
                  )}
                </Stack>
              </Grid>
            </Grid>
            </Box>
            <DialogActions sx={{ position: 'sticky', bottom: 0, zIndex: 1, mt: 2, px: 1.5, py: 1, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '12px', boxShadow: 2 }}>
              <Button onClick={closeDialog} disabled={saving}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity as any} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Stack>
  );
};
export default Maintenances;
