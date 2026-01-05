import React from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Activities from './pages/Activities';
import Finance from './pages/Finance';
import AdminUsers from './pages/AdminUsers';
import { useAuth } from './auth/AuthContext';

const RequireAuth = ({ children }: { children?: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!profile) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Tu usuario no tiene perfil asignado en Firestore (`users/{'{uid}'}`). Contacta al administrador para asignar un rol.
        </Alert>
      </Box>
    );
  }

  return <>{children}</>;
};

const RequireAdmin = ({ children }: { children?: React.ReactNode }) => {
  const { role } = useAuth();
  if (role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">No tienes permisos para acceder a esta sección.</Alert>
      </Box>
    );
  }
  return <>{children}</>;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <RequireAuth>
            <Layout>
              <Dashboard />
            </Layout>
          </RequireAuth>
        } />
        
        <Route path="/assets" element={
          <RequireAuth>
            <Layout>
              <Assets />
            </Layout>
          </RequireAuth>
        } />

        <Route path="/activities" element={
          <RequireAuth>
            <Layout>
              <Activities />
            </Layout>
          </RequireAuth>
        } />

        <Route path="/finance" element={
          <RequireAuth>
            <Layout>
              <Finance />
            </Layout>
          </RequireAuth>
        } />

        <Route
          path="/admin/users"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Layout>
                  <AdminUsers />
                </Layout>
              </RequireAdmin>
            </RequireAuth>
          }
        />

      </Routes>
    </HashRouter>
  );
}

export default App;
