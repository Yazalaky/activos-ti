import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Stack,
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
import { getActivities, getAssets } from '../services/api';
import type { Activity, Asset } from '../types';

const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
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
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { role } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadError('');
        const [assetsData, activitiesData] = await Promise.all([getAssets(), getActivities()]);
        setAssets(assetsData);
        setActivities(activitiesData);
      } catch (error) {
        console.error('Dashboard load error:', error);
        setAssets([]);
        setActivities([]);
        setLoadError('No se pudieron cargar datos. Revisa permisos de Firestore (rules) y tu usuario.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const stats = useMemo(() => {
    const totalAssets = assets.length;
    const assignedAssets = assets.filter((a) => a.status === 'asignado').length;
    const maintenanceAssets = assets.filter((a) => a.status === 'mantenimiento').length;
    const stockAssets = assets.filter((a) => a.status === 'bodega').length;
    const retiredAssets = Math.max(0, totalAssets - assignedAssets - maintenanceAssets - stockAssets);

    return {
      totalAssets,
      assignedAssets,
      maintenanceAssets,
      stockAssets,
      retiredAssets,
    };
  }, [assets]);

  const chartData = useMemo(
    () => [
      { name: 'Asignados', value: stats.assignedAssets, color: '#2E7D32' },
      { name: 'En Bodega', value: stats.stockAssets, color: '#1565C0' },
      { name: 'Mantenimiento', value: stats.maintenanceAssets, color: '#ED6C02' },
      { name: 'De Baja', value: stats.retiredAssets, color: '#D32F2F' },
    ],
    [stats]
  );

  const recentActivities = activities.slice(0, 5);

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
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Resumen general
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          KPIs y actividad reciente
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Total activos" value={stats.totalAssets} icon={<DevicesOtherOutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Asignados" value={stats.assignedAssets} icon={<CheckCircleOutlineOutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="En bodega" value={stats.stockAssets} icon={<Inventory2OutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Mantenimiento" value={stats.maintenanceAssets} icon={<BuildCircleOutlinedIcon />} />
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                Accesos rápidos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Acciones comunes para empezar a cargar información.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
        </CardContent>
      </Card>

      <Grid container spacing={2} alignItems="stretch">
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Estado del inventario
              </Typography>

              {stats.totalAssets === 0 ? (
                <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', py: 6 }}>
                  <Stack spacing={1.5} alignItems="flex-start" sx={{ maxWidth: 520 }}>
                    <Typography variant="body1" sx={{ fontWeight: 800 }}>
                      Aún no hay activos registrados.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Registra el primer activo para ver distribución por estado y métricas.
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
                <Box sx={{ flex: 1, height: 360, mt: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={76}
                        outerRadius={112}
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
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Actividad reciente
              </Typography>

              {recentActivities.length === 0 ? (
                <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', py: 6 }}>
                  <Stack spacing={1.5} alignItems="flex-start">
                    <Typography variant="body1" sx={{ fontWeight: 800 }}>
                      No hay actividad reciente.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Registra una actividad para ver la bitácora aquí.
                    </Typography>
                    <Button
                      component={RouterLink}
                      to="/activities"
                      variant="contained"
                      startIcon={<ListAltOutlinedIcon />}
                      endIcon={<ArrowForwardOutlinedIcon />}
                      disabled={!canWrite}
                    >
                      Registrar actividad
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  {recentActivities.map((activity, idx) => (
                    <Box key={activity.id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: 99,
                            bgcolor:
                              activity.priority === 'alta'
                                ? 'error.main'
                                : activity.priority === 'media'
                                ? 'warning.main'
                                : 'success.main',
                            mt: '2px',
                          }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {activity.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {activity.date} · {activity.type}
                          </Typography>
                        </Box>
                      </Stack>
                      {idx !== recentActivities.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default Dashboard;
