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
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import type { AccessScope, Role, Site, UserProfile } from '../types';
import { createUserAccount, setUserStatus } from '../services/adminApi';
import { getSites } from '../services/api';
import { listUsers, updateUserAccess, updateUserRole } from '../services/users';
import { useAuth } from '../auth/AuthContext';
import { compareSiteNames } from '../utils/sortSites';

const roleLabel: Record<Role, string> = {
  admin: 'Administrador',
  tech: 'Técnico',
  auditor: 'Auditor',
  management: 'Gerencia',
};

const AdminUsers = () => {
  const { profile } = useAuth();
  const theme = useTheme();
  const showTable = useMediaQuery(theme.breakpoints.up('lg'));
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
  const sortedSites = useMemo(() => sites.slice().sort(compareSiteNames), [sites]);

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

  const renderRole = (user: UserProfile) => (
    <Stack spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <FormControl size="small" fullWidth>
        <InputLabel id={`role-${user.uid}`}>Cambiar rol</InputLabel>
        <Select labelId={`role-${user.uid}`} label="Cambiar rol" value={user.role} onChange={(e) => void handleChangeRole(user.uid, e.target.value as Role)}>
          {(['admin', 'tech', 'management', 'auditor'] as Role[]).map((role) => <MenuItem key={role} value={role}>{roleLabel[role]}</MenuItem>)}
        </Select>
      </FormControl>
    </Stack>
  );

  const renderAccess = (user: UserProfile) => user.accessScope === 'sites' ? (
    <Stack spacing={0.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Chip label="Por sede" size="small" color="warning" sx={{ fontWeight: 700 }} />
      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{(user.siteIds || []).map(siteName).join(', ') || 'Sin sedes'}</Typography>
    </Stack>
  ) : <Chip label="Global" size="small" color="info" sx={{ fontWeight: 700 }} />;

  const renderActions = (user: UserProfile) => {
    const active = user.active !== false;
    return (
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" alignItems="center">
        <Button size="small" variant="outlined" startIcon={<SettingsOutlinedIcon />} onClick={() => openAccessDialog(user)}>Sedes</Button>
        <FormControlLabel sx={{ mr: 0 }} control={<Switch checked={active} disabled={user.uid === profile?.uid || busyUid === user.uid} onChange={() => void handleToggleStatus(user)} inputProps={{ 'aria-label': `Cambiar estado de ${user.name}` }} />} label={active ? 'Activo' : 'Inactivo'} />
      </Stack>
    );
  };

  return (
    <Stack spacing={2.25} sx={{ '& > .MuiCard-root': { borderRadius: '16px' }, '& > .MuiStack-root .MuiButton-root, & > .MuiCard-root .MuiButton-root': { borderRadius: '10px' } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} sx={{ pt: { xs: 0.5, md: 1 }, pb: 0.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'secondary.main' }} />
            <Typography variant="inherit" sx={{ fontSize: '0.69rem', color: 'text.secondary', fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Gestión de activos TI</Typography>
          </Stack>
          <Typography component="h1" variant="inherit" sx={{ fontWeight: 750, fontSize: { xs: '1.6rem', md: '1.95rem' }, letterSpacing: '-0.035em', lineHeight: 1.15 }}>Usuarios</Typography>
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
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 2.5, py: 2 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '10px', color: 'secondary.main', bgcolor: alpha(theme.palette.secondary.main, 0.1) }}><PeopleOutlineOutlinedIcon fontSize="small" /></Box>
            <Box><Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Directorio de usuarios</Typography><Typography variant="caption" color="text.secondary">{users.length.toLocaleString('es-CO')} {users.length === 1 ? 'usuario registrado' : 'usuarios registrados'}</Typography></Box>
          </Stack>
          {showTable ? (
          <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 850, tableLayout: 'fixed', '& .MuiTableCell-root': { px: 1.25, py: 1.25 }, '& .MuiTableCell-head': { fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' } }}>
            <colgroup><col style={{ width: '24%' }} /><col style={{ width: '18%' }} /><col style={{ width: '11%' }} /><col style={{ width: '22%' }} /><col style={{ width: 185 }} /></colgroup>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Usuario</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Rol</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Acceso</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const active = u.active !== false;
                return (
                  <TableRow key={u.uid} hover>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 750, overflowWrap: 'anywhere' }}>{u.name}</Typography><Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{u.email}</Typography></TableCell>
                    <TableCell>{renderRole(u)}</TableCell>
                    <TableCell>
                      <Chip label={active ? 'Activo' : 'Inactivo'} color={active ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>{renderAccess(u)}</TableCell>
                    <TableCell>{renderActions(u)}</TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary" align="center">No hay usuarios.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </Box>
          ) : (
          <Box sx={{ px: 2 }}>
            {users.map((user) => {
              const active = user.active !== false;
              return (
                <Box component="article" key={user.uid} sx={{ py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}><Typography variant="subtitle2" sx={{ fontWeight: 750, overflowWrap: 'anywhere' }}>{user.name}</Typography><Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{user.email}</Typography></Box>
                    <Chip label={active ? 'Activo' : 'Inactivo'} color={active ? 'success' : 'default'} size="small" sx={{ fontWeight: 700 }} />
                  </Stack>
                  <Box sx={{ mt: 1.5 }}>{renderRole(user)}</Box>
                  <Box sx={{ mt: 1.5 }}><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Acceso</Typography>{renderAccess(user)}</Box>
                  <Box sx={{ mt: 1.25 }}>{renderActions(user)}</Box>
                </Box>
              );
            })}
            {users.length === 0 && <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 6 }}>No hay usuarios.</Typography>}
          </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => !creating && setDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: { xs: '12px', sm: '18px' }, maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' }, m: { xs: 1.5, sm: 4 } } }}>
        <DialogTitle component="div" sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1 }}>
          <Typography component="h2" variant="h6" sx={{ fontWeight: 900 }}>Crear usuario</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Datos de acceso, rol y sedes autorizadas.</Typography>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, bgcolor: 'action.hover' }}>
          <Box component="form" onSubmit={handleCreate} sx={{ mt: 1 }}>
            <Box sx={{ p: { xs: 2, sm: 2.25 }, border: '1px solid', borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
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
                      sx={{ '& .MuiSelect-select': { whiteSpace: 'normal', overflowWrap: 'anywhere' } }}
                    >
                      {sortedSites.map((site) => <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>
            </Box>
            <DialogActions sx={{ position: 'sticky', bottom: 0, zIndex: 1, mt: 2, px: 1.5, py: 1, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '12px', boxShadow: 2 }}>
              <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="contained" startIcon={<AddOutlinedIcon />} disabled={creating}>Crear</Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(accessUser)} onClose={() => !savingAccess && setAccessUser(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: { xs: '12px', sm: '18px' }, maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' }, m: { xs: 1.5, sm: 4 } } }}>
        <DialogTitle component="div" sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1 }}><Typography component="h2" variant="h6" sx={{ fontWeight: 900 }}>Configurar acceso por sede</Typography></DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
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
                sx={{ '& .MuiSelect-select': { whiteSpace: 'normal', overflowWrap: 'anywhere' } }}
              >
                {sortedSites.map((site) => <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>)}
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
