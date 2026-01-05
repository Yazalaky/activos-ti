import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const getAuthErrorMessage = (err: unknown) => {
    const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as any).code) : '';

    switch (code) {
      case 'auth/invalid-email':
        return 'El correo no tiene un formato válido.';
      case 'auth/user-disabled':
        return 'Este usuario está deshabilitado.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Credenciales inválidas.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Intenta de nuevo más tarde.';
      case 'auth/network-request-failed':
        return 'Error de red. Revisa tu conexión o firewall.';
      case 'auth/operation-not-allowed':
        return 'Email/Password no está habilitado en Firebase Auth (Sign-in method).';
      case 'auth/invalid-api-key':
      case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
        return 'API Key inválida. Revisa tus variables VITE_FIREBASE_* en .env.local.';
      default:
        return 'No se pudo iniciar sesión. Revisa la configuración de Firebase y la consola del navegador.';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      console.error('Firebase login error:', err);
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Container maxWidth="xs">
        <Paper sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                Inventario TI
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Inicie sesión para continuar
              </Typography>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Box component="form" onSubmit={handleLogin} noValidate>
              <Stack spacing={2}>
                <TextField
                  label="Correo electrónico"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MailOutlineIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  label="Contraseña"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
                  {submitting ? <CircularProgress size={22} color="inherit" /> : 'Ingresar'}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;
