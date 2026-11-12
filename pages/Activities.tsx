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
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import LaptopMacOutlinedIcon from '@mui/icons-material/LaptopMacOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { addActivity, getActivities, getAssets, getSites, updateActivity } from '../services/api';
import type { Activity, Asset, Site } from '../types';
import { useAuth } from '../auth/AuthContext';
import { exportToCsv } from '../utils/exportCsv';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { printReport } from '../utils/printReport';
import { compareSiteNames } from '../utils/sortSites';

const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map((v) => Number(v));
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d);
};

const getPriorityColor = (priority: Activity['priority']) => {
  if (priority === 'alta') return 'error';
  if (priority === 'media') return 'warning';
  return 'success';
};

const activityReportColumns = [
  { key: 'Fecha', label: 'Fecha' },
  { key: 'Tipo', label: 'Tipo' },
  { key: 'Prioridad', label: 'Prioridad' },
  { key: 'Tecnico', label: 'Técnico' },
  { key: 'Sede', label: 'Sede' },
  { key: 'Activo', label: 'Activo' },
  { key: 'Descripcion', label: 'Descripción' },
] as const;

const createInitialFormState = (): Partial<Activity> => ({
  date: new Date().toISOString().split('T')[0],
  type: 'Soporte Usuario',
  priority: 'media',
  techName: '',
  siteId: '',
  assetId: '',
  description: '',
});

type ActivityListProps = {
  activities: Activity[];
  sites: Site[];
  assets: Asset[];
  canWrite: boolean;
  onEdit: (activity: Activity) => void;
};

const ActivityList = React.memo(function ActivityList({ activities, sites, assets, canWrite, onEdit }: ActivityListProps) {
  return (
    <Box>
      {activities.map((activity) => {
        const assetInfo = activity.assetId ? assets.find((a) => a.id === activity.assetId) : null;
        const siteName = sites.find((s) => s.id === activity.siteId)?.name || 'Sede N/A';

        return (
          <Box component="article" key={activity.id} sx={{ px: { xs: 2, sm: 2.5 }, py: 2, borderTop: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.25, sm: 2.5 }} alignItems={{ sm: 'flex-start' }}>
              <Stack direction={{ xs: 'row', sm: 'column' }} spacing={{ xs: 1, sm: 0.25 }} alignItems={{ xs: 'center', sm: 'flex-start' }} sx={{ flexShrink: 0, minWidth: { sm: 116 } }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <CalendarTodayOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  <Typography variant="body2" sx={{ fontWeight: 750 }}>{activity.date}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize', pl: { sm: 2.75 } }}>
                  {format(parseLocalDate(activity.date), 'EEEE', { locale: es })}
                </Typography>
              </Stack>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                  <Stack direction="row" useFlexGap flexWrap="wrap" spacing={0.75} sx={{ minWidth: 0 }}>
                    <Chip size="small" label={activity.type} variant="outlined" sx={{ fontWeight: 650, maxWidth: '100%' }} />
                    <Chip size="small" label={`Prioridad ${activity.priority}`} color={getPriorityColor(activity.priority)} sx={{ fontWeight: 700, textTransform: 'capitalize' }} />
                  </Stack>
                  {canWrite && (
                    <Tooltip title="Editar actividad">
                      <IconButton size="small" onClick={() => onEdit(activity)} aria-label="Editar actividad" sx={{ flexShrink: 0 }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Typography variant="body2" sx={{ fontWeight: 650, mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {activity.description}
                </Typography>
                <Stack direction="row" useFlexGap flexWrap="wrap" columnGap={2} rowGap={0.75} sx={{ mt: 1.25, color: 'text.secondary' }}>
                  <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ minWidth: 0 }}><PersonOutlineOutlinedIcon sx={{ fontSize: 16 }} /><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>Técnico: {activity.techName}</Typography></Stack>
                  <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ minWidth: 0 }}><LocationOnOutlinedIcon sx={{ fontSize: 16 }} /><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{siteName}</Typography></Stack>
                  {assetInfo && <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ minWidth: 0 }}><LaptopMacOutlinedIcon sx={{ fontSize: 16 }} /><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{assetInfo.fixedAssetId} · {assetInfo.brand} {assetInfo.model}</Typography></Stack>}
                </Stack>
              </Box>
            </Stack>
          </Box>
        );
      })}

      {activities.length === 0 && (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 6, px: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          No se encontraron actividades con los filtros seleccionados.
        </Typography>
      )}
    </Box>
  );
});

const Activities = () => {
  const { profile } = useAuth();
  const theme = useTheme();
  const canWrite = profile?.role === 'admin' || profile?.role === 'tech';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activityPage, setActivityPage] = useState(1);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const [formData, setFormData] = useState<Partial<Activity>>(createInitialFormState);

  const loadData = async () => {
    const [acts, s, a] = await Promise.all([getActivities(), getSites(), getAssets()]);
    setActivities(acts);
    setSites(s);
    setAssets(a);
  };

  useEffect(() => {
    loadData();
  }, []);

  const sortedSites = useMemo(() => sites.slice().sort(compareSiteNames), [sites]);

  const siteAssets = useMemo(
    () => assets.filter((a) => a.siteId === formData.siteId && a.status !== 'baja'),
    [assets, formData.siteId]
  );

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (startDate && act.date < startDate) return false;
      if (endDate && act.date > endDate) return false;
      return true;
    });
  }, [activities, startDate, endDate]);

  const activityPageSize = 25;

  useEffect(() => {
    setActivityPage(1);
  }, [filteredActivities]);

  const visibleActivities = filteredActivities.slice(
    (activityPage - 1) * activityPageSize,
    activityPage * activityPageSize,
  );

  const activityReportRows = useMemo(
    () => filteredActivities.map((activity) => {
      const site = sites.find((siteItem) => siteItem.id === activity.siteId);
      const asset = assets.find((assetItem) => assetItem.id === activity.assetId);
      return {
        Fecha: activity.date,
        Tipo: activity.type,
        Prioridad: activity.priority,
        Tecnico: activity.techName,
        Sede: site?.name || '',
        Activo: asset?.fixedAssetId || '',
        Descripcion: activity.description,
      };
    }),
    [filteredActivities, sites, assets],
  );

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormData(createInitialFormState());
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((activity: Activity) => {
    setEditingId(activity.id);
    setFormData({
      ...activity,
      assetId: activity.assetId || '',
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setFormData(createInitialFormState());
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.siteId) {
      setSnackbar({ open: true, message: 'Seleccione una sede.' });
      return;
    }
    if (!formData.techName) {
      setSnackbar({ open: true, message: 'Ingrese el nombre del técnico.' });
      return;
    }
    if (!formData.description) {
      setSnackbar({ open: true, message: 'Ingrese una descripción.' });
      return;
    }

    const dataToSave = { ...formData };
    if (!dataToSave.assetId) delete dataToSave.assetId;

    try {
      if (editingId) {
        const { id, ...toUpdate } = dataToSave as any;
        await updateActivity(editingId, toUpdate, profile?.uid);
      } else {
        await addActivity(dataToSave as Omit<Activity, 'id'>, profile?.uid);
      }
      closeDialog();
      loadData();
    } catch (error) {
      console.error('Error saving activity:', error);
      setSnackbar({ open: true, message: 'No se pudo guardar la actividad.' });
    }
  };

  return (
    <Stack spacing={2.25} sx={{ '& > .MuiCard-root': { borderRadius: '16px' }, '& > .MuiStack-root .MuiButton-root, & > .MuiCard-root .MuiButton-root': { borderRadius: '10px' } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }} justifyContent="space-between" sx={{ pt: { xs: 0.5, md: 1 }, pb: 0.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'secondary.main' }} />
            <Typography variant="inherit" sx={{ fontSize: '0.69rem', color: 'text.secondary', fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Gestión de activos TI</Typography>
          </Stack>
          <Typography component="h1" variant="inherit" sx={{ fontWeight: 750, fontSize: { xs: '1.6rem', md: '1.95rem' }, letterSpacing: '-0.035em', lineHeight: 1.15 }}>
            Bitácora de sistemas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Registra y consulta actividades de soporte
          </Typography>
        </Box>

        {canWrite && (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>
            Nuevo registro
          </Button>
        )}
      </Stack>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '10px', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.09) }}><TuneOutlinedIcon fontSize="small" /></Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>Filtrar periodo</Typography>
              <Typography variant="caption" color="text.secondary">Consulta las actividades por rango de fechas</Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap">
            <TextField
              label="Desde"
              size="small"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: '100%', sm: 220 } }}
            />
            <TextField
              label="Hasta"
              size="small"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: '100%', sm: 220 } }}
            />

            {(startDate || endDate) && (
              <Button variant="text" startIcon={<ClearOutlinedIcon />} onClick={clearFilters}>
                Limpiar
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ px: 2.5, py: 2 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '10px', color: 'secondary.main', bgcolor: alpha(theme.palette.secondary.main, 0.1) }}><MenuBookOutlinedIcon fontSize="small" /></Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 750, letterSpacing: '-0.015em' }}>Registro de actividades</Typography>
              <Typography variant="caption" color="text.secondary">{filteredActivities.length.toLocaleString('es-CO')} {filteredActivities.length === 1 ? 'actividad coincide' : 'actividades coinciden'} con el periodo seleccionado</Typography>
            </Box>
          </Stack>
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
            <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />} disabled={!activityReportRows.length} onClick={() => exportToCsv('Bitacora', activityReportRows)}>CSV</Button>
            <Button size="small" variant="outlined" startIcon={<PrintOutlinedIcon />} disabled={!activityReportRows.length} onClick={() => printReport('Reporte de bitácora', activityReportColumns, activityReportRows)}>PDF / Imprimir</Button>
          </Stack>
        </Stack>
        <ActivityList
          activities={visibleActivities}
          sites={sites}
          assets={assets}
          canWrite={canWrite}
          onEdit={openEdit}
        />
        {filteredActivities.length > activityPageSize && (
          <Stack alignItems="center" sx={{ py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Pagination
              color="primary"
              page={activityPage}
              count={Math.ceil(filteredActivities.length / activityPageSize)}
              onChange={(_event, nextPage) => setActivityPage(nextPage)}
            />
          </Stack>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: { xs: '12px', sm: '18px' }, maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' }, m: { xs: 1.5, sm: 4 } } }}>
        <DialogTitle component="div" sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1 }}>
          <Typography component="h2" variant="h6" sx={{ fontWeight: 900 }}>{editingId ? 'Editar actividad' : 'Registrar actividad'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Información de la actividad, responsable y sede.</Typography>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, bgcolor: 'action.hover' }}>
          <Box component="form" onSubmit={handleSave} sx={{ mt: 1 }}>
            {!canWrite && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Modo solo lectura (Gerencia/Auditoría). No puedes crear o editar actividades.
              </Alert>
            )}
            <Box sx={{ p: { xs: 2, sm: 2.25 }, border: '1px solid', borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 750, mb: 0.5 }}>Datos de la actividad</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>El activo es opcional; selecciona una sede para asociarlo.</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Fecha"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="activity-type-label">Tipo</InputLabel>
                  <Select
                    labelId="activity-type-label"
                    label="Tipo"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Activity['type'] })}
                  >
                    <MenuItem value="Soporte Usuario">Soporte Usuario</MenuItem>
                    <MenuItem value="Requerimiento">Requerimiento</MenuItem>
                    <MenuItem value="Capacitacion">Capacitación</MenuItem>
                    <MenuItem value="Otro">Otro</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="activity-priority-label">Prioridad</InputLabel>
                  <Select
                    labelId="activity-priority-label"
                    label="Prioridad"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Activity['priority'] })}
                  >
                    <MenuItem value="baja">Baja</MenuItem>
                    <MenuItem value="media">Media</MenuItem>
                    <MenuItem value="alta">Alta</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Técnico responsable"
                  value={formData.techName || ''}
                  onChange={(e) => setFormData({ ...formData, techName: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel id="activity-site-label">Sede</InputLabel>
                  <Select
                    labelId="activity-site-label"
                    label="Sede"
                    value={formData.siteId || ''}
                    onChange={(e) => setFormData({ ...formData, siteId: e.target.value, assetId: '' })}
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

              <Grid size={12}>
                <FormControl fullWidth disabled={!formData.siteId}>
                  <InputLabel id="activity-asset-label">Activo (opcional)</InputLabel>
                  <Select
                    labelId="activity-asset-label"
                    label="Activo (opcional)"
                    value={formData.assetId || ''}
                    onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
                  >
                    <MenuItem value="">Ninguno / General</MenuItem>
                    {siteAssets.map((asset) => (
                      <MenuItem key={asset.id} value={asset.id}>
                        {asset.fixedAssetId} · {asset.type} · {asset.brand}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {formData.siteId && siteAssets.length === 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    No hay activos registrados en esta sede.
                  </Alert>
                )}
              </Grid>

              <Grid size={12}>
                <TextField
                  label="Descripción detallada"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  fullWidth
                  required
                  multiline
                  minRows={4}
                  placeholder="Qué sucedió, qué se hizo..."
                />
              </Grid>
            </Grid>
            </Box>

            <Divider sx={{ my: 2 }} />
            <DialogActions sx={{ position: 'sticky', bottom: 0, zIndex: 1, px: 1.5, py: 1, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '12px', boxShadow: 2 }}>
              <Button onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={!canWrite}>
                {editingId ? 'Actualizar' : 'Guardar'}
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" onClose={() => setSnackbar({ open: false, message: '' })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default Activities;
