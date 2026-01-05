import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DevicesOtherOutlinedIcon from '@mui/icons-material/DevicesOtherOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { Pie, PieChart, Cell, Legend, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getActivities, getAssets, getSites } from '../services/api';
import type { Activity, Asset, Site } from '../types';

const KpiCard = ({
  label,
  value,
  icon,
  helper,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  helper?: string;
}) => (
  <Card>
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(103,80,164,0.12)',
            color: 'primary.main',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            {value}
          </Typography>
          {helper && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {helper}
            </Typography>
          )}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const formatPct = (value: number) => `${Math.round(value * 100)}%`;

const yyyyMmDd = (d: Date) => d.toISOString().split('T')[0];

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const Dashboard = () => {
  const { role } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');

  const defaultEnd = useMemo(() => yyyyMmDd(new Date()), []);
  const defaultStart = useMemo(() => yyyyMmDd(addDays(new Date(), -30)), []);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadError('');
        const [assetsData, activitiesData, sitesData] = await Promise.all([getAssets(), getActivities(), getSites()]);
        setAssets(assetsData);
        setActivities(activitiesData);
        setSites(sitesData);
      } catch (error) {
        console.error('Dashboard load error:', error);
        setAssets([]);
        setActivities([]);
        setSites([]);
        setLoadError('No se pudieron cargar datos. Revisa permisos de Firestore (rules) y tu usuario.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const selectedSite = useMemo(() => sites.find((s) => s.id === selectedSiteId) || null, [sites, selectedSiteId]);

  const filteredAssets = useMemo(() => {
    if (!selectedSiteId) return assets;
    return assets.filter((a) => a.siteId === selectedSiteId);
  }, [assets, selectedSiteId]);

  const filteredActivities = useMemo(() => {
    const start = startDate || '';
    const end = endDate || '';
    if (start && end && start > end) return [];
    return activities.filter((act) => {
      if (selectedSiteId && act.siteId !== selectedSiteId) return false;
      if (start && act.date < start) return false;
      if (end && act.date > end) return false;
      return true;
    });
  }, [activities, selectedSiteId, startDate, endDate]);

  const stats = useMemo(() => {
    const totalAssets = filteredAssets.length;
    const assignedAssets = filteredAssets.filter((a) => a.status === 'asignado').length;
    const maintenanceAssets = filteredAssets.filter((a) => a.status === 'mantenimiento').length;
    const stockAssets = filteredAssets.filter((a) => a.status === 'bodega').length;
    const retiredAssets = filteredAssets.filter((a) => a.status === 'baja').length;
    const missingEvidence = filteredAssets.filter((a) => !a.imageUrl).length;

    return {
      totalAssets,
      assignedAssets,
      maintenanceAssets,
      stockAssets,
      retiredAssets,
      missingEvidence,
    };
  }, [filteredAssets]);

  const chartData = useMemo(
    () => [
      { name: 'Asignados', value: stats.assignedAssets, color: '#2E7D32' },
      { name: 'En Bodega', value: stats.stockAssets, color: '#1565C0' },
      { name: 'Mantenimiento', value: stats.maintenanceAssets, color: '#ED6C02' },
      { name: 'De Baja', value: stats.retiredAssets, color: '#D32F2F' },
    ],
    [stats]
  );

  const recentActivities = filteredActivities.slice(0, 6);

  const bySite = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      counts.set(a.siteId, (counts.get(a.siteId) ?? 0) + 1);
    }
    return sites
      .map((s) => ({ id: s.id, name: s.name, count: counts.get(s.id) ?? 0 }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [assets, sites]);

  const isFiltered = selectedSiteId !== '' || startDate !== defaultStart || endDate !== defaultEnd;
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);

  const clearFilters = () => {
    setSelectedSiteId('');
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return <Alert severity="error">{loadError}</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }} justifyContent="space-between">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap">
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel id="dashboard-site-label">Sede</InputLabel>
                <Select
                  labelId="dashboard-site-label"
                  label="Sede"
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(String(e.target.value))}
                >
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

              <TextField
                label="Desde"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: '100%', sm: 190 } }}
              />
              <TextField
                label="Hasta"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: '100%', sm: 190 } }}
              />
              {isFiltered && (
                <Button size="small" variant="text" color="error" onClick={clearFilters}>
                  Limpiar
                </Button>
              )}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', lg: 'auto' } }}>
              <Button
                component={RouterLink}
                to="/assets"
                variant="contained"
                startIcon={<AddOutlinedIcon />}
                endIcon={<ArrowForwardOutlinedIcon />}
                disabled={!canWrite}
              >
                Nuevo activo
              </Button>
              <Button
                component={RouterLink}
                to="/activities"
                variant="outlined"
                startIcon={<ListAltOutlinedIcon />}
                endIcon={<ArrowForwardOutlinedIcon />}
                disabled={!canWrite}
              >
                Nueva actividad
              </Button>
              <Button
                component={RouterLink}
                to="/finance"
                variant="outlined"
                startIcon={<ReceiptLongOutlinedIcon />}
                endIcon={<ArrowForwardOutlinedIcon />}
                disabled={!canWrite}
              >
                Nueva factura
              </Button>
            </Stack>
          </Stack>

          {invalidRange && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              El rango de fechas es inválido: “Desde” no puede ser mayor que “Hasta”.
            </Alert>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                setStartDate(yyyyMmDd(addDays(new Date(), -30)));
                setEndDate(yyyyMmDd(new Date()));
              }}
            >
              Últimos 30 días
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                const now = new Date();
                setStartDate(yyyyMmDd(new Date(now.getFullYear(), 0, 1)));
                setEndDate(yyyyMmDd(new Date()));
              }}
            >
              Año actual
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                const t = yyyyMmDd(new Date());
                setStartDate(t);
                setEndDate(t);
              }}
            >
              Hoy
            </Button>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {selectedSite ? `Contexto: ${selectedSite.name}` : 'Contexto: Todas las sedes'}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            label="Total activos"
            value={stats.totalAssets}
            icon={<DevicesOtherOutlinedIcon />}
            helper={selectedSite ? selectedSite.prefix : 'Consolidado'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard label="Asignados" value={stats.assignedAssets} icon={<CheckCircleOutlineOutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard label="En bodega" value={stats.stockAssets} icon={<Inventory2OutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard label="Mantenimiento" value={stats.maintenanceAssets} icon={<BuildCircleOutlinedIcon />} />
        </Grid>
      </Grid>

      <Grid container spacing={2} alignItems="stretch">
        <Grid size={{ xs: 12 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Estado del inventario
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Distribución por estado {selectedSite ? `· ${selectedSite.prefix}` : ''}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={`De baja: ${stats.retiredAssets}`} color={stats.retiredAssets ? 'error' : 'default'} variant="outlined" />
                  <Chip
                    label={`Sin evidencia: ${stats.missingEvidence}`}
                    color={stats.missingEvidence ? 'info' : 'default'}
                    variant="outlined"
                  />
                </Stack>
              </Stack>

              {stats.totalAssets === 0 ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
                  <Stack spacing={1.5} alignItems="flex-start" sx={{ maxWidth: 560 }}>
                    <Typography variant="body1" sx={{ fontWeight: 900 }}>
                      No hay activos para el contexto actual.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ajusta los filtros o registra el primer activo para ver métricas y distribución.
                    </Typography>
                    <Button
                      component={RouterLink}
                      to="/assets"
                      variant="contained"
                      startIcon={<AddOutlinedIcon />}
                      endIcon={<ArrowForwardOutlinedIcon />}
                      disabled={!canWrite}
                    >
                      Registrar activo
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <Box sx={{ height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={78}
                            outerRadius={116}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Stack spacing={1.25} sx={{ pt: { md: 2 } }}>
                      {chartData.map((item) => {
                        const pct = stats.totalAssets ? item.value / stats.totalAssets : 0;
                        return (
                          <Box key={item.name}>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: 99, bgcolor: item.color }} />
                                <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                                  {item.name}
                                </Typography>
                              </Stack>
                              <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                {item.value}{' '}
                                <Typography component="span" variant="caption" color="text.secondary">
                                  ({formatPct(pct)})
                                </Typography>
                              </Typography>
                            </Stack>
                          </Box>
                        );
                      })}
                      {bySite.length > 0 && !selectedSiteId && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                            Top sedes por activos
                          </Typography>
                          <Stack spacing={0.75}>
                            {bySite.map((s) => (
                              <Stack key={s.id} direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" color="text.secondary" noWrap>
                                  {s.name}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                  {s.count}
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </>
                      )}
                    </Stack>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Actividad reciente
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {startDate && endDate ? `Periodo: ${startDate} a ${endDate}` : 'Bitácora del periodo'}
              </Typography>
            </Box>
            {!canWrite && (
              <Button component={RouterLink} to="/activities" variant="outlined" endIcon={<ArrowForwardOutlinedIcon />}>
                Ver bitácora
              </Button>
            )}
          </Stack>

          {recentActivities.length === 0 ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
              <Stack spacing={1.5} alignItems="flex-start">
                <Typography variant="body1" sx={{ fontWeight: 900 }}>
                  No hay registros en el periodo.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ajusta los filtros o registra una actividad.
                </Typography>
                {canWrite && (
                  <Button
                    component={RouterLink}
                    to="/activities"
                    variant="contained"
                    startIcon={<ListAltOutlinedIcon />}
                    endIcon={<ArrowForwardOutlinedIcon />}
                  >
                    Registrar actividad
                  </Button>
                )}
              </Stack>
            </Box>
          ) : (
            <Stack spacing={1.25} sx={{ mt: 2 }}>
              {recentActivities.map((activity, idx) => {
                const siteName = sites.find((s) => s.id === activity.siteId)?.name || 'Sede N/A';
                const dotColor =
                  activity.priority === 'alta' ? 'error.main' : activity.priority === 'media' ? 'warning.main' : 'success.main';
                return (
                  <Box key={activity.id}>
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <Box sx={{ width: 10, height: 10, borderRadius: 99, bgcolor: dotColor, mt: '6px' }} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                          {activity.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {activity.date} · {siteName} · {activity.type} · {activity.techName}
                        </Typography>
                      </Box>
                      <Chip label={activity.priority.toUpperCase()} color={activity.priority === 'alta' ? 'error' : activity.priority === 'media' ? 'warning' : 'success'} size="small" />
                    </Stack>
                    {idx !== recentActivities.length - 1 && <Divider sx={{ mt: 1.25 }} />}
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
};

export default Dashboard;
