import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import { auth } from '../firebaseAuth';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';
import { ColorModeContext } from '../theme';

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 264;

const roleLabel: Record<Role, string> = {
  admin: 'Administrador',
  tech: 'Técnico',
  auditor: 'Auditor',
  management: 'Gerencia',
};

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'KPIs y actividad reciente' },
  '/assets': { title: 'Inventario', subtitle: 'Gestión de activos' },
  '/activities': { title: 'Bitácora', subtitle: 'Registro de actividades' },
  '/quotes': { title: 'Cotizaciones', subtitle: 'Registro de cotizaciones por sede' },
  '/acts': { title: 'Actas', subtitle: 'Actas de entrega por activo' },
  '/maintenances': { title: 'Mantenimientos', subtitle: 'Gestión de mantenimientos' },
  '/sites': { title: 'Sedes', subtitle: 'Administración y prefijos' },
  '/finance': { title: 'Finanzas', subtitle: 'Facturas, proveedores y costos' },
  '/contracts': { title: 'Contratos', subtitle: 'Contratos y documentos firmados de proveedores' },
  '/admin/users': { title: 'Usuarios', subtitle: 'Gestión de accesos y roles' },
  '/act-templates': { title: 'Empresas para actas', subtitle: 'Datos legales de impresión' },
  '/act-legacy': { title: 'Revisión de actas antiguas', subtitle: 'Clasificación de PDFs heredados' },
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { toggleColorMode } = React.useContext(ColorModeContext);
  const isDarkMode = theme.palette.mode === 'dark';
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const { profile, role } = useAuth();
  const canReadContracts = role === 'admin'
    || role === 'management'
    || role === 'auditor'
    || (role === 'tech' && profile?.accessScope !== 'sites');
  const userEmail = auth.currentUser?.email ?? '';
  const userInitial = (profile?.name?.trim()[0] || userEmail.trim()[0] || '?').toUpperCase();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const menuGroups = [
    {
      title: 'General',
      items: [
        { path: '/', label: 'Dashboard', icon: <DashboardOutlinedIcon /> },
        { path: '/assets', label: 'Inventario', icon: <Inventory2OutlinedIcon /> },
        { path: '/activities', label: 'Bitácora', icon: <ListAltOutlinedIcon /> },
        { path: '/maintenances', label: 'Mantenimientos', icon: <BuildOutlinedIcon /> },
        { path: '/acts', label: 'Actas', icon: <AssignmentOutlinedIcon /> },
      ],
    },
    {
      title: 'Gestión',
      items: [
        { path: '/quotes', label: 'Cotizaciones', icon: <DescriptionOutlinedIcon /> },
        { path: '/sites', label: 'Sedes', icon: <LocationCityOutlinedIcon /> },
        { path: '/finance', label: 'Proveedores y Costos', icon: <ReceiptLongOutlinedIcon /> },
        ...(canReadContracts ? [{ path: '/contracts', label: 'Contratos', icon: <FolderOutlinedIcon /> }] : []),
      ],
    },
    ...(role === 'admin'
      ? [
          {
            title: 'Administración',
            items: [
              { path: '/admin/users', label: 'Usuarios', icon: <ManageAccountsOutlinedIcon /> },
            ],
          },
        ]
      : []),
  ] as const;

  const meta = routeMeta[location.pathname] ?? { title: 'IT Manager', subtitle: 'Gestión de activos TI' };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#E8F0F5', bgcolor: isDarkMode ? '#101D28' : '#142C3D' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 2.5, borderBottom: '1px solid rgba(218,235,244,0.10)' }}>
        <Box sx={{ width: 42, height: 42, borderRadius: '13px', display: 'grid', placeItems: 'center', color: '#A2E2DA', bgcolor: 'rgba(107,204,195,0.13)', border: '1px solid rgba(147,222,214,0.23)' }}>
          <HubOutlinedIcon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="inherit" sx={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>IT Manager</Typography>
          <Typography variant="inherit" sx={{ color: '#AABDC9', fontSize: '0.72rem', mt: 0.35, letterSpacing: '0.02em' }}>Gestión de activos TI</Typography>
        </Box>
      </Box>

      <Box sx={{ px: 1.5, py: 1.5, flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {menuGroups.map((group) => (
          <List
            key={group.title}
            dense
            subheader={
              <ListSubheader
                component="div"
                sx={{
                  bgcolor: 'transparent',
                  color: '#AABDC9',
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  fontSize: 10,
                  lineHeight: 1,
                  px: 1.5,
                  py: 1,
                }}
              >
                {group.title}
              </ListSubheader>
            }
            sx={{ mb: 1.25, py: 0 }}
          >
            {group.items.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/acts' && ['/act-templates', '/act-legacy'].includes(location.pathname));
              return (
                <ListItemButton
                  key={item.path}
                  component={Link}
                  to={item.path}
                  selected={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    position: 'relative',
                    borderRadius: '9px',
                    mb: 0.25,
                    px: 1.4,
                    py: 0.7,
                    minHeight: 42,
                    color: '#CDDAE2',
                    transition: 'background-color 160ms ease, color 160ms ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#FFFFFF' },
                    '&.Mui-selected': {
                      bgcolor: 'rgba(99,195,188,0.16)',
                      color: '#FFFFFF',
                      '&::before': { content: '""', position: 'absolute', left: 0, top: 9, bottom: 9, width: 3, borderRadius: 4, bgcolor: '#7ED8CD' },
                      '&:hover': { bgcolor: 'rgba(99,195,188,0.22)' },
                      '& .MuiListItemIcon-root': { color: '#9DE1D8' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: isActive ? 'inherit' : '#AABDC9', '& svg': { fontSize: 20 } }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.86rem', fontWeight: isActive ? 700 : 500 }} />
                </ListItemButton>
              );
            })}
          </List>
        ))}
      </Box>

      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(218,235,244,0.10)' }}>
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', px: 1, py: 1 }}>
          <Avatar sx={{ bgcolor: '#31576B', color: '#F3FBFF', width: 36, height: 36, fontSize: '0.9rem', fontWeight: 700 }}>{userInitial}</Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="inherit" sx={{ fontSize: '0.81rem', fontWeight: 700, lineHeight: 1.3 }} noWrap>{profile?.name || userEmail || 'Usuario'}</Typography>
            {role && <Typography variant="inherit" sx={{ color: '#AABDC9', fontSize: '0.72rem' }} noWrap>{roleLabel[role]}</Typography>}
          </Box>
          <Tooltip title="Cerrar sesión">
            <IconButton aria-label="Cerrar sesión" onClick={handleLogout} sx={{ color: '#C5D5DF', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
              <LogoutOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="transparent"
        sx={{
          backdropFilter: 'blur(10px)',
          bgcolor: alpha(theme.palette.background.paper, 0.96),
          borderBottom: `1px solid ${theme.palette.divider}`,
          boxShadow: 'none',
          ml: { md: `${drawerWidth}px` },
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { xs: 64, sm: 68 }, px: { xs: 2, md: 3 } }}>
          {!isMdUp && (
            <IconButton onClick={() => setMobileOpen(true)} aria-label="Abrir menú" edge="start">
              <MenuIcon />
            </IconButton>
          )}

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 750, lineHeight: 1.15, letterSpacing: '-0.015em' }}>
              {meta.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, mt: 0.25 }}>
              {meta.subtitle}
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Tooltip title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
            <IconButton
              onClick={toggleColorMode}
              color="primary"
              sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '11px', width: 40, height: 40 }}
              aria-label={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDarkMode ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title={userEmail || 'Usuario'}>
            <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 36, height: 36 }}>{userInitial}</Avatar>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="Menú lateral"
      >
        <Drawer
          variant={isMdUp ? 'permanent' : 'temporary'}
          open={isMdUp ? true : mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: `1px solid ${theme.palette.divider}`,
              bgcolor: isDarkMode ? '#101D28' : '#142C3D',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          p: { xs: 2, md: 3 },
          mt: { xs: '64px', sm: '68px' },
          minWidth: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
