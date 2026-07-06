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
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { addMaintenance, getAssets, getMaintenances, getSites, getSuppliers, softDeleteMaintenance, updateMaintenance } from '../services/api';
import type { Asset, Maintenance, Site, Supplier } from '../types';
import { useAuth } from '../auth/AuthContext';
import { exportToCsv } from '../utils/exportCsv';

const statusMap: Record<Maintenance['status'], { label: string; color: any }> = {
  programado: { label: 'Programado', color: 'info' },
  en_proceso: { label: 'En Proceso', color: 'warning' },
  realizado: { label: 'Realizado', color: 'success' },
  cancelado: { label: 'Cancelado', color: 'error' },
};

const createInitialState = (): Partial<Maintenance> => ({
  type: 'preventivo',
  status: 'programado',
  siteId: '',
  assetId: '',
  scheduledDate: new Date().toISOString().split('T')[0],
  cost: 0,
});

const Maintenances = () => {
  const { role, profile } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';
  const canDelete = role === 'admin';
  
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Maintenance>>(createInitialState());

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
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

  const openCreate = () => {
    setEditingId(null);
    setFormData(createInitialState());
    setDialogOpen(true);
  };

  const openEdit = (m: Maintenance) => {
    setEditingId(m.id);
    setFormData(m);
    setDialogOpen(true);
  };
  
  const closeDialog = () => {
    setDialogOpen(false);
    setFormData(createInitialState());
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siteId || !formData.assetId) {
      setSnackbar({ open: true, message: 'Seleccione Sede y Activo.', severity: 'warning' });
      return;
    }
    try {
      if (editingId) {
        await updateMaintenance(editingId, formData, profile?.uid);
        setSnackbar({ open: true, message: 'Mantenimiento actualizado.', severity: 'success' });
      } else {
        await addMaintenance(formData as Omit<Maintenance, 'id'>, profile?.uid);
        setSnackbar({ open: true, message: 'Mantenimiento creado.', severity: 'success' });
      }
      closeDialog();
      loadData();
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Error al guardar.', severity: 'error' });
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
    const data = filteredMaintenances.map(m => {
      const s = sites.find(x => x.id === m.siteId);
      const a = assets.find(x => x.id === m.assetId);
      const sup = suppliers.find(x => x.id === m.supplierId);
      return {
        FechaProg: m.scheduledDate,
        FechaReal: m.completedDate || '',
        Tipo: m.type,
        Estado: m.status,
        Sede: s?.name || '',
        Activo: a?.fixedAssetId || '',
        Proveedor: sup?.name || '',
        Tecnico: m.technicianName || '',
        Costo: m.cost || 0,
        Hallazgos: m.findings || '',
        Acciones: m.actionsTaken || '',
        ProximaFecha: m.nextMaintenanceDate || ''
      };
    });
    exportToCsv('Mantenimientos', data);
  };

  const siteAssets = useMemo(() => assets.filter(a => a.siteId === formData.siteId && a.status !== 'baja'), [assets, formData.siteId]);

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Mantenimientos</Typography>
          <Typography variant="body2" color="text.secondary">Gestión de mantenimientos preventivos y correctivos</Typography>
        </Box>
        {canWrite && (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>Nuevo mantenimiento</Button>
        )}
      </Stack>

      <Card>
        <CardContent>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField label="Desde" type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField label="Hasta" type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Sede</InputLabel>
                <Select value={filterSite} label="Sede" onChange={e => setFilterSite(e.target.value)}>
                  <MenuItem value="">Todas</MenuItem>
                  {sites.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select value={filterType} label="Tipo" onChange={e => setFilterType(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="preventivo">Preventivo</MenuItem>
                  <MenuItem value="correctivo">Correctivo</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Estado</InputLabel>
                <Select value={filterStatus} label="Estado" onChange={e => setFilterStatus(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {Object.entries(statusMap).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }} sx={{ display: 'flex', gap: 1 }}>
              {(filterStartDate || filterEndDate || filterSite || filterType || filterStatus) && (
                <Button variant="text" color="error" onClick={clearFilters}>Limpiar</Button>
              )}
              <Button variant="outlined" onClick={exportData} startIcon={<DownloadOutlinedIcon />}>Exportar</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha Prog.</TableCell>
                <TableCell>Activo</TableCell>
                <TableCell>Sede</TableCell>
                <TableCell>Tipo / Estado</TableCell>
                <TableCell align="right">Costo</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMaintenances.map(m => {
                const s = sites.find(x => x.id === m.siteId);
                const a = assets.find(x => x.id === m.assetId);
                return (
                  <TableRow key={m.id} hover>
                    <TableCell>{m.scheduledDate || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{a?.fixedAssetId || 'Desconocido'}</Typography>
                      <Typography variant="caption">{a?.brand} {a?.model}</Typography>
                    </TableCell>
                    <TableCell>{s?.name}</TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" sx={{ textTransform: 'uppercase' }}>{m.type}</Typography>
                        <Chip size="small" label={statusMap[m.status]?.label} color={statusMap[m.status]?.color} />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">${Number(m.cost || 0).toLocaleString()}</TableCell>
                    <TableCell align="right">
                      {canWrite && (
                        <IconButton size="small" onClick={() => openEdit(m)}><EditOutlinedIcon /></IconButton>
                      )}
                      {canDelete && (
                        <IconButton size="small" color="error" onClick={() => handleDelete(m.id)}><DeleteOutlineOutlinedIcon /></IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredMaintenances.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>No hay mantenimientos registrados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>{editingId ? 'Editar mantenimiento' : 'Nuevo mantenimiento'}</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSave} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Sede</InputLabel>
                  <Select value={formData.siteId} label="Sede" onChange={e => setFormData({ ...formData, siteId: e.target.value, assetId: '' })}>
                    {sites.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required disabled={!formData.siteId}>
                  <InputLabel>Activo</InputLabel>
                  <Select value={formData.assetId} label="Activo" onChange={e => setFormData({ ...formData, assetId: e.target.value })}>
                    {siteAssets.map(a => <MenuItem key={a.id} value={a.id}>{a.fixedAssetId} - {a.brand} {a.model}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Tipo</InputLabel>
                  <Select value={formData.type} label="Tipo" onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                    <MenuItem value="preventivo">Preventivo</MenuItem>
                    <MenuItem value="correctivo">Correctivo</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Estado</InputLabel>
                  <Select value={formData.status} label="Estado" onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
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
                  <InputLabel>Proveedor (Opcional)</InputLabel>
                  <Select value={formData.supplierId || ''} label="Proveedor (Opcional)" onChange={e => setFormData({ ...formData, supplierId: e.target.value })}>
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
            </Grid>
            <DialogActions sx={{ px: 0, mt: 2 }}>
              <Button onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" variant="contained">Guardar</Button>
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
