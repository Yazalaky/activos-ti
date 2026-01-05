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
  FormControl,
  Grid,
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
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import type { Role, UserProfile } from '../types';
import { createUserAccount } from '../services/adminApi';
import { listUsers, updateUserRole } from '../services/users';

const roleLabel: Record<Role, string> = {
  admin: 'Administrador',
  tech: 'Técnico',
  auditor: 'Auditor',
  management: 'Gerencia',
};

const roleColor = (role: Role) => {
  if (role === 'admin') return 'primary';
  if (role === 'tech') return 'success';
  if (role === 'management') return 'info';
  return 'default';
};

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [form, setForm] = useState<{ email: string; password: string; name: string; role: Role }>({
    email: '',
    password: '',
    name: '',
    role: 'tech',
  });

  const load = async () => {
    const data = await listUsers();
    data.sort((a, b) => a.email.localeCompare(b.email));
    setUsers(data);
  };

  useEffect(() => {
    load();
  }, []);

  const roleOptions = useMemo(() => (['tech', 'management'] as Role[]), []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.name) {
      setSnackbar({ open: true, message: 'Complete email, contraseña y nombre.', severity: 'warning' });
      return;
    }
    if (!roleOptions.includes(form.role)) {
      setSnackbar({ open: true, message: 'Rol inválido para creación desde la app.', severity: 'warning' });
      return;
    }

    try {
      setCreating(true);
      await createUserAccount(form);
      setSnackbar({ open: true, message: 'Usuario creado correctamente.', severity: 'success' });
      setDialogOpen(false);
      setForm({ email: '', password: '', name: '', role: 'tech' });
      await load();
    } catch (error: any) {
      console.error('Create user error:', error);
      const msg = error?.message || 'No se pudo crear el usuario (requiere Cloud Function createUser).';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleChangeRole = async (uid: string, role: Role) => {
    try {
      await updateUserRole(uid, role);
      setSnackbar({ open: true, message: 'Rol actualizado.', severity: 'success' });
      await load();
    } catch (error) {
      console.error('Update role error:', error);
      setSnackbar({ open: true, message: 'No se pudo actualizar el rol.', severity: 'error' });
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Usuarios
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Crea usuarios (solo admin) y asigna roles.
          </Typography>
        </Box>

        <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={() => setDialogOpen(true)}>
          Crear usuario
        </Button>
      </Stack>

      <Alert severity="info">
        Para crear usuarios desde la app necesitas desplegar una Cloud Function callable llamada <strong>createUser</strong>.
        Si aún no la has desplegado, dime y te dejo el paso a paso.
      </Alert>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Rol</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.uid} hover>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={roleLabel[u.role]} color={roleColor(u.role) as any} size="small" />
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel id={`role-${u.uid}`}>Cambiar rol</InputLabel>
                        <Select
                          labelId={`role-${u.uid}`}
                          label="Cambiar rol"
                          value={u.role}
                          onChange={(e) => handleChangeRole(u.uid, e.target.value as Role)}
                        >
                          {(['admin', 'tech', 'management', 'auditor'] as Role[]).map((r) => (
                            <MenuItem key={r} value={r}>
                              {roleLabel[r]}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}

              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary" align="center">
                      No hay usuarios.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Crear usuario</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleCreate} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  label="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  type="email"
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Contraseña (temporal)"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  type="password"
                  fullWidth
                  required
                  helperText="Comparte esta contraseña por un canal seguro; el usuario puede cambiarla en Firebase Auth."
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Nombre"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={12}>
                <FormControl fullWidth>
                  <InputLabel id="new-user-role">Rol</InputLabel>
                  <Select
                    labelId="new-user-role"
                    label="Rol"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  >
                    {roleOptions.map((r) => (
                      <MenuItem key={r} value={r}>
                        {roleLabel[r]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <DialogActions sx={{ px: 0, mt: 2 }}>
              <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="contained" startIcon={<AddOutlinedIcon />} disabled={creating}>
                Crear
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default AdminUsers;

