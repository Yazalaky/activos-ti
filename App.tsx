import React, { Suspense, lazy } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';

const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Assets = lazy(() => import('./pages/Assets'));
const Activities = lazy(() => import('./pages/Activities'));
const Acts = lazy(() => import('./pages/Acts'));
const Finance = lazy(() => import('./pages/Finance'));
const Sites = lazy(() => import('./pages/Sites'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));

const FullPageLoader = () => (
  <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
    <CircularProgress />
  </Box>
);

const AppLayout = ({ children }: { children?: React.ReactNode }) => (
  <Suspense fallback={<FullPageLoader />}>
    <Layout>{children}</Layout>
  </Suspense>
);

const RequireAuth = ({ children }: { children?: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <FullPageLoader />;
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
        <Route
          path="/login"
          element={
            <Suspense fallback={<FullPageLoader />}>
              <Login />
            </Suspense>
          }
        />
        
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </RequireAuth>
          }
        />
        
        <Route
          path="/assets"
          element={
            <RequireAuth>
              <AppLayout>
                <Assets />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/activities"
          element={
            <RequireAuth>
              <AppLayout>
                <Activities />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/acts"
          element={
            <RequireAuth>
              <AppLayout>
                <Acts />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/sites"
          element={
            <RequireAuth>
              <AppLayout>
                <Sites />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/finance"
          element={
            <RequireAuth>
              <AppLayout>
                <Finance />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/admin/users"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AppLayout>
                  <AdminUsers />
                </AppLayout>
              </RequireAdmin>
            </RequireAuth>
          }
        />

      </Routes>
    </HashRouter>
  );
}

export default App;
