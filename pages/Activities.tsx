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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import LaptopMacOutlinedIcon from '@mui/icons-material/LaptopMacOutlined';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { addActivity, getActivities, getAssets, getSites } from '../services/api';
import type { Activity, Asset, Site } from '../types';
import { useAuth } from '../auth/AuthContext';

const Activities = () => {
  const { role } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const [formData, setFormData] = useState<Partial<Activity>>({
    date: new Date().toISOString().split('T')[0],
    type: 'Soporte Usuario',
    priority: 'media',
    techName: '',
    siteId: '',
    assetId: '',
    description: '',
  });

  const loadData = async () => {
    const [acts, s, a] = await Promise.all([getActivities(), getSites(), getAssets()]);
    setActivities(acts);
    setSites(s);
    setAssets(a);
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

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

    await addActivity(dataToSave as Omit<Activity, 'id'>);
    setDialogOpen(false);

    setFormData((prev) => ({
      ...prev,
      description: '',
      assetId: '',
      type: 'Soporte Usuario',
      priority: 'media',
    }));

    loadData();
  };

  const getPriorityColor = (priority: Activity['priority']) => {
    if (priority === 'alta') return 'error';
    if (priority === 'media') return 'warning';
    return 'success';
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Bitácora de sistemas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Registra y consulta actividades de soporte
          </Typography>
        </Box>

        {canWrite && (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setDialogOpen(true)}>
            Nuevo registro
          </Button>
        )}
      </Stack>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-end' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 220 }}>
              <FilterAltOutlinedIcon color="action" />
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Filtrar periodo
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

            {(startDate || endDate) && (
              <Button variant="text" color="error" startIcon={<ClearOutlinedIcon />} onClick={clearFilters} sx={{ ml: 'auto' }}>
                Limpiar
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        {filteredActivities.map((activity) => {
          const assetInfo = activity.assetId ? assets.find((a) => a.id === activity.assetId) : null;
          const siteName = sites.find((s) => s.id === activity.siteId)?.name || 'Sede N/A';

          return (
            <Card key={activity.id}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 3, md: 2 }}>
                    <Box
                      sx={{
                        borderRadius: 3,
                        p: 1.5,
                        bgcolor: 'rgba(0,0,0,0.03)',
                        border: '1px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CalendarTodayOutlinedIcon color="action" fontSize="small" />
                        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                          {activity.date}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {format(new Date(activity.date), 'EEEE', { locale: es })}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 9, md: 10 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip label={activity.type} variant="outlined" />
                        <Chip label={activity.priority.toUpperCase()} color={getPriorityColor(activity.priority)} />
                        <Chip
                          icon={<PersonOutlineOutlinedIcon />}
                          label={`Tec: ${activity.techName}`}
                          variant="outlined"
                        />
                        <Chip label={siteName} variant="outlined" />
                        {assetInfo && (
                          <Chip
                            icon={<LaptopMacOutlinedIcon />}
                            label={`${assetInfo.fixedAssetId} · ${assetInfo.brand} ${assetInfo.model}`}
                            variant="outlined"
                          />
                        )}
                      </Stack>

                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {activity.description}
                      </Typography>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          );
        })}

        {filteredActivities.length === 0 && (
          <Card sx={{ borderStyle: 'dashed' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" align="center">
                No se encontraron actividades con los filtros seleccionados.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>Registrar actividad</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSave} sx={{ mt: 1, pointerEvents: canWrite ? 'auto' : 'none' }}>
            {!canWrite && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Modo solo lectura (Gerencia/Auditoría). No puedes crear actividades.
              </Alert>
            )}
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
                    {sites.map((s) => (
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

            <Divider sx={{ my: 2 }} />
            <DialogActions sx={{ px: 0 }}>
              <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="contained">
                Guardar
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
