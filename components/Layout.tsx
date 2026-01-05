import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
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
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import { auth } from '../firebaseAuth';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 280;

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
  '/sites': { title: 'Sedes', subtitle: 'Administración y prefijos' },
  '/finance': { title: 'Finanzas', subtitle: 'Facturas, proveedores y costos' },
  '/admin/users': { title: 'Usuarios', subtitle: 'Gestión de accesos y roles' },
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const { profile, role } = useAuth();
  const userEmail = auth.currentUser?.email ?? '';
  const userInitial = (userEmail.trim()[0] || '?').toUpperCase();

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
      ],
    },
    {
      title: 'Gestión',
      items: [
        { path: '/sites', label: 'Sedes', icon: <LocationCityOutlinedIcon /> },
        { path: '/finance', label: 'Proveedores y Costos', icon: <ReceiptLongOutlinedIcon /> },
      ],
    },
    ...(role === 'admin'
      ? [
          {
            title: 'Administración',
            items: [{ path: '/admin/users', label: 'Usuarios', icon: <ManageAccountsOutlinedIcon /> }],
          },
        ]
      : []),
  ] as const;

  const meta = routeMeta[location.pathname] ?? { title: 'IT Manager', subtitle: 'Gestión de activos TI' };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
          IT Manager
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Gestión de activos TI
        </Typography>

        <Box
          sx={{
            mt: 1.75,
            p: 1.25,
            borderRadius: 4,
            bgcolor: alpha('#FFFFFF', 0.7),
            border: `1px solid ${alpha(theme.palette.common.black, 0.06)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
          }}
        >
          <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>{userInitial}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.15 }} noWrap>
              {profile?.name || userEmail || 'Usuario'}
            </Typography>
            {role && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} noWrap>
                {roleLabel[role]}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ px: 1, py: 1, flex: 1 }}>
        {menuGroups.map((group) => (
          <List
            key={group.title}
            dense
            subheader={
              <ListSubheader
                component="div"
                sx={{
                  bgcolor: 'transparent',
                  color: 'text.secondary',
                  fontWeight: 900,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  fontSize: 11,
                  lineHeight: 1,
                  px: 1.5,
                  py: 1,
                }}
              >
                {group.title}
              </ListSubheader>
            }
            sx={{ mb: 1.25 }}
          >
            {group.items.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <ListItemButton
                  key={item.path}
                  component={Link}
                  to={item.path}
                  selected={isActive}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    borderRadius: 3,
                    mb: 0.5,
                    px: 1.5,
                    py: 1.1,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                    '&.Mui-selected': {
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: 'text.primary',
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
                      '& .MuiListItemIcon-root': { color: 'primary.main' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: isActive ? 'inherit' : 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 800 }} />
                </ListItemButton>
              );
            })}
          </List>
        ))}
      </Box>

      <Divider />

      <Box sx={{ p: 1 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{ borderRadius: 3 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <LogoutOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="Cerrar sesión" primaryTypographyProps={{ fontWeight: 700 }} />
        </ListItemButton>
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
          bgcolor: 'rgba(255,251,254,0.86)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          ml: { md: `${drawerWidth}px` },
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: 72 }}>
          {!isMdUp && (
            <IconButton onClick={() => setMobileOpen(true)} aria-label="Abrir menú" edge="start">
              <MenuIcon />
            </IconButton>
          )}

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.15 }}>
              {meta.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {meta.subtitle}
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="body2" color="text.secondary">
              Usuario: {profile?.name || userEmail}
            </Typography>
            {role && (
              <Typography variant="caption" color="text.secondary">
                Rol: {roleLabel[role]}
              </Typography>
            )}
          </Box>
          <Tooltip title={userEmail || 'Usuario'}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>{userInitial}</Avatar>
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
              borderRight: '1px solid rgba(0,0,0,0.06)',
              bgcolor: '#F3EEF9',
              backgroundImage: 'linear-gradient(180deg, rgba(103,80,164,0.10), rgba(103,80,164,0.00) 35%)',
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
          mt: 9,
          minWidth: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
