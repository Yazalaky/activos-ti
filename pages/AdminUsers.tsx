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
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Snackbar,
  Stack,
  Switch,
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
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import type { AccessScope, Role, Site, UserProfile } from '../types';
import { createUserAccount, setUserStatus } from '../services/adminApi';
import { getSites } from '../services/api';
import { listUsers, updateUserAccess, updateUserRole } from '../services/users';
import { useAuth } from '../auth/AuthContext';

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
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accessUser, setAccessUser] = useState<UserProfile | null>(null);
  const [accessScope, setAccessScope] = useState<AccessScope>('global');
  const [accessSiteIds, setAccessSiteIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [form, setForm] = useState<{
    email: string;
    password: string;
    name: string;
    role: Role;
    accessScope: AccessScope;
    siteIds: string[];
  }>({
    email: '',
    password: '',
    name: '',
    role: 'tech',
    accessScope: 'global',
    siteIds: [],
  });

  const roleOptions = useMemo(() => (['tech', 'management'] as Role[]), []);

  const load = async () => {
    const [userData, siteData] = await Promise.all([listUsers(), getSites()]);
    userData.sort((a, b) => a.email.localeCompare(b.email));
    setUsers(userData);
    setSites(siteData);
  };

  useEffect(() => {
    void load();
  }, []);

  const siteName = (siteId: string) => sites.find((site) => site.id === siteId)?.name || siteId;

  const resetForm = () => {
    setForm({ email: '', password: '', name: '', role: 'tech', accessScope: 'global', siteIds: [] });
  };

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
    if (form.accessScope === 'sites' && form.siteIds.length === 0) {
      setSnackbar({ open: true, message: 'Seleccione al menos una sede.', severity: 'warning' });
      return;
    }

    try {
      setCreating(true);
      await createUserAccount(form);
      setSnackbar({ open: true, message: 'Usuario creado correctamente.', severity: 'success' });
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (error: any) {
      console.error('Create user error:', error);
      const msg = error?.message || 'No se pudo crear el usuario.';
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

  const openAccessDialog = (user: UserProfile) => {
    setAccessUser(user);
    setAccessScope(user.accessScope === 'sites' ? 'sites' : 'global');
    setAccessSiteIds(user.siteIds || []);
  };

  const handleSaveAccess = async () => {
    if (!accessUser) return;
    if (accessScope === 'sites' && accessSiteIds.length === 0) {
      setSnackbar({ open: true, message: 'Seleccione al menos una sede.', severity: 'warning' });
      return;
    }

    try {
      setSavingAccess(true);
      await updateUserAccess(accessUser.uid, accessScope, accessSiteIds);
      setSnackbar({ open: true, message: 'Acceso por sede actualizado.', severity: 'success' });
      setAccessUser(null);
      await load();
    } catch (error) {
      console.error('Update access error:', error);
      setSnackbar({ open: true, message: 'No se pudo actualizar el acceso.', severity: 'error' });
    } finally {
      setSavingAccess(false);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const currentlyActive = user.active !== false;
    const action = currentlyActive ? 'inactivar' : 'activar';
    if (!window.confirm(`¿Desea ${action} a ${user.name}?`)) return;

    try {
      setBusyUid(user.uid);
      await setUserStatus({ uid: user.uid, disabled: currentlyActive });
      setSnackbar({ open: true, message: `Usuario ${currentlyActive ? 'inactivado' : 'activado'}.`, severity: 'success' });
      await load();
    } catch (error: any) {
      console.error('Update status error:', error);
      setSnackbar({ open: true, message: error?.message || 'No se pudo actualizar el estado.', severity: 'error' });
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Usuarios</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Administre roles, sedes autorizadas y estado de acceso.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={() => setDialogOpen(true)}>
          Crear usuario
        </Button>
      </Stack>

      <Alert severity="info">
        Los usuarios con alcance restringido solo pueden consultar y operar información de las sedes asignadas.
      </Alert>

      <Card>
        <CardContent sx={{ p: 0, overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Rol</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Acceso</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const active = u.active !== false;
                const restricted = u.accessScope === 'sites';
                return (
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
                            onChange={(e) => void handleChangeRole(u.uid, e.target.value as Role)}
                          >
                            {(['admin', 'tech', 'management', 'auditor'] as Role[]).map((r) => (
                              <MenuItem key={r} value={r}>{roleLabel[r]}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip label={active ? 'Activo' : 'Inactivo'} color={active ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      {restricted ? (
                        <Stack spacing={0.25}>
                          <Chip label="Por sede" size="small" color="warning" />
                          <Typography variant="caption" color="text.secondary">
                            {(u.siteIds || []).map(siteName).join(', ') || 'Sin sedes'}
                          </Typography>
                        </Stack>
                      ) : (
                        <Chip label="Global" size="small" color="info" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button size="small" variant="outlined" startIcon={<SettingsOutlinedIcon />} onClick={() => openAccessDialog(u)}>
                          Sedes
                        </Button>
                        <FormControlLabel
                          sx={{ mr: 0 }}
                          control={(
                            <Switch
                              checked={active}
                              disabled={u.uid === profile?.uid || busyUid === u.uid}
                              onChange={() => void handleToggleStatus(u)}
                            />
                          )}
                          label={active ? 'Activo' : 'Inactivo'}
                        />
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary" align="center">No hay usuarios.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => !creating && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Crear usuario</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleCreate} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" fullWidth required />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Contraseña temporal"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  type="password"
                  fullWidth
                  required
                  helperText="Debe tener entre 8 y 128 caracteres."
                />
              </Grid>
              <Grid size={12}>
                <TextField label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth required />
              </Grid>
              <Grid size={12}>
                <FormControl fullWidth>
                  <InputLabel id="new-user-role">Rol</InputLabel>
                  <Select labelId="new-user-role" label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                    {roleOptions.map((r) => <MenuItem key={r} value={r}>{roleLabel[r]}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={12}>
                <FormControl fullWidth>
                  <InputLabel id="new-user-scope">Alcance</InputLabel>
                  <Select
                    labelId="new-user-scope"
                    label="Alcance"
                    value={form.accessScope}
                    onChange={(e) => setForm({ ...form, accessScope: e.target.value as AccessScope, siteIds: e.target.value === 'global' ? [] : form.siteIds })}
                  >
                    <MenuItem value="global">Todas las sedes</MenuItem>
                    <MenuItem value="sites">Sedes específicas</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {form.accessScope === 'sites' && (
                <Grid size={12}>
                  <FormControl fullWidth required>
                    <InputLabel id="new-user-sites">Sedes</InputLabel>
                    <Select
                      labelId="new-user-sites"
                      multiple
                      value={form.siteIds}
                      onChange={(e) => setForm({ ...form, siteIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
                      input={<OutlinedInput label="Sedes" />}
                      renderValue={(selected) => (selected as string[]).map(siteName).join(', ')}
                    >
                      {sites.map((site) => <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>
            <DialogActions sx={{ px: 0, mt: 2 }}>
              <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="contained" startIcon={<AddOutlinedIcon />} disabled={creating}>Crear</Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(accessUser)} onClose={() => !savingAccess && setAccessUser(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Configurar acceso por sede</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {accessUser?.name} · {accessUser?.email}
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="access-scope">Alcance</InputLabel>
            <Select labelId="access-scope" label="Alcance" value={accessScope} onChange={(e) => setAccessScope(e.target.value as AccessScope)}>
              <MenuItem value="global">Todas las sedes</MenuItem>
              <MenuItem value="sites">Sedes específicas</MenuItem>
            </Select>
          </FormControl>
          {accessScope === 'sites' && (
            <FormControl fullWidth required sx={{ mt: 2 }}>
              <InputLabel id="access-sites">Sedes autorizadas</InputLabel>
              <Select
                labelId="access-sites"
                multiple
                value={accessSiteIds}
                onChange={(e) => setAccessSiteIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                input={<OutlinedInput label="Sedes autorizadas" />}
                renderValue={(selected) => (selected as string[]).map(siteName).join(', ')}
              >
                {sites.map((site) => <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccessUser(null)} disabled={savingAccess}>Cancelar</Button>
          <Button onClick={() => void handleSaveAccess()} variant="contained" disabled={savingAccess}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}>{snackbar.message}</Alert>
      </Snackbar>
    </Stack>
  );
};

export default AdminUsers;
