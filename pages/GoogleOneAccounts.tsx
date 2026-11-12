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
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import { useAuth } from '../auth/AuthContext';
import { addGoogleOneAccount, getGoogleOneAccounts, updateGoogleOneAccount } from '../services/api';
import type { GoogleOneAccount } from '../types';

type AccountForm = {
  accountEmail: string;
  cardLastFour: string;
  plan: string;
  storage: string;
  monthlyPrice: string;
  billingDay: string;
  active: boolean;
};

type StatusFilter = 'all' | 'active' | 'inactive';

const emptyForm = (): AccountForm => ({
  accountEmail: '',
  cardLastFour: '',
  plan: '',
  storage: '',
  monthlyPrice: '',
  billingDay: '1',
  active: true,
});

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const formatCop = (value?: number) => typeof value === 'number' && Number.isFinite(value)
  ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
  : 'Sin registrar';

const GoogleOneAccounts = () => {
  const { role, profile } = useAuth();
  const theme = useTheme();
  const canRead = role === 'admin'
    || role === 'management'
    || role === 'auditor'
    || (role === 'tech' && profile?.accessScope !== 'sites');
  const canManage = role === 'admin' || (role === 'tech' && profile?.accessScope !== 'sites');

  const [accounts, setAccounts] = useState<GoogleOneAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GoogleOneAccount | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadAccounts = async () => {
    setLoading(true);
    try {
      setAccounts(await getGoogleOneAccounts());
    } catch (error) {
      console.error('Error loading Google One accounts:', error);
      setSnackbar({ open: true, message: 'No se pudieron cargar las cuentas de Google One.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) void loadAccounts();
    else setLoading(false);
  }, [canRead]);

  const visibleAccounts = useMemo(() => accounts.filter((account) => {
    const matchesSearch = !search || normalize([
      account.accountEmail,
      account.plan,
      account.storage,
      account.monthlyPrice === undefined ? '' : String(account.monthlyPrice),
      account.cardLastFour,
    ].join(' ')).includes(normalize(search));
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' ? account.active : !account.active);
    return matchesSearch && matchesStatus;
  }), [accounts, search, statusFilter]);

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingAccount(null);
    setForm(emptyForm());
  };

  const openCreate = () => {
    setEditingAccount(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (account: GoogleOneAccount) => {
    setEditingAccount(account);
    setForm({
      accountEmail: account.accountEmail,
      cardLastFour: account.cardLastFour,
      plan: account.plan,
      storage: account.storage,
      monthlyPrice: account.monthlyPrice === undefined ? '' : String(account.monthlyPrice),
      billingDay: String(account.billingDay),
      active: account.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;

    const accountEmail = form.accountEmail.trim().toLowerCase();
    const monthlyPrice = Number(form.monthlyPrice);
    const billingDay = Number(form.billingDay);
    if (!/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(accountEmail)) {
      setSnackbar({ open: true, message: 'Ingresa un correo de Google válido.', severity: 'warning' });
      return;
    }
    if (!/^\d{4}$/.test(form.cardLastFour)) {
      setSnackbar({ open: true, message: 'La tarjeta debe identificarse con exactamente sus últimos 4 dígitos.', severity: 'warning' });
      return;
    }
    if (!form.plan.trim() || !form.storage.trim()) {
      setSnackbar({ open: true, message: 'Indica el plan y el almacenamiento contratado.', severity: 'warning' });
      return;
    }
    if (!form.monthlyPrice.trim() || !Number.isInteger(monthlyPrice) || monthlyPrice < 0 || monthlyPrice > 999999999) {
      setSnackbar({ open: true, message: 'Ingresa el valor mensual en pesos colombianos, sin decimales.', severity: 'warning' });
      return;
    }
    if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
      setSnackbar({ open: true, message: 'El día de cobro debe estar entre 1 y 31.', severity: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const accountData = {
        accountEmail,
        cardLastFour: form.cardLastFour,
        plan: form.plan.trim(),
        storage: form.storage.trim(),
        monthlyPrice,
        billingDay,
        active: form.active,
      };
      if (editingAccount) {
        await updateGoogleOneAccount(editingAccount.id, {
          cardLastFour: accountData.cardLastFour,
          plan: accountData.plan,
          storage: accountData.storage,
          monthlyPrice: accountData.monthlyPrice,
          billingDay: accountData.billingDay,
          active: accountData.active,
        }, profile?.uid);
      } else {
        await addGoogleOneAccount(accountData, profile?.uid);
      }
      await loadAccounts();
      setDialogOpen(false);
      setEditingAccount(null);
      setForm(emptyForm());
      setSnackbar({
        open: true,
        message: editingAccount ? 'Cuenta de Google One actualizada.' : 'Cuenta de Google One registrada.',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error saving Google One account:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'No se pudo guardar la cuenta.',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) return <Alert severity="error">No tienes permisos para consultar este registro financiero.</Alert>;

  return (
    <Stack spacing={2.25} sx={{ '& > .MuiCard-root': { borderRadius: '16px' }, '& > .MuiStack-root .MuiButton-root, & > .MuiCard-root .MuiButton-root': { borderRadius: '10px' } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 750 }}>Cuentas Google One</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Registro de cuentas, plan, valor mensual, tarjeta corporativa y día de cobro.
          </Typography>
        </Box>
        {canManage && <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>Nueva cuenta</Button>}
      </Stack>

      <Alert severity="info">
        Solo se guardan los últimos cuatro dígitos de la tarjeta. No ingreses el número completo ni el código de seguridad.
      </Alert>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '10px', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.09) }}><TuneOutlinedIcon fontSize="small" /></Box>
            <Box><Typography variant="subtitle2" sx={{ fontWeight: 750 }}>Filtros de consulta</Typography><Typography variant="caption" color="text.secondary">Busca por cuenta, plan, almacenamiento o tarjeta</Typography></Box>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              label="Buscar cuenta"
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              placeholder="Correo, plan, almacenamiento o tarjeta..."
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlinedIcon /></InputAdornment> }}
            />
            <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 210 } }}>
              <InputLabel id="google-one-status-label">Estado</InputLabel>
              <Select
                labelId="google-one-status-label"
                label="Estado"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <MenuItem value="active">Activas</MenuItem>
                <MenuItem value="inactive">Inactivas</MenuItem>
                <MenuItem value="all">Todas</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        {loading && <LinearProgress />}
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 2.5, py: 2 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '10px', color: 'secondary.main', bgcolor: alpha(theme.palette.secondary.main, 0.1) }}><CloudOutlinedIcon fontSize="small" /></Box>
            <Box><Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Registro de cuentas</Typography><Typography variant="caption" color="text.secondary">{loading ? 'Consultando cuentas…' : `${visibleAccounts.length.toLocaleString('es-CO')} ${visibleAccounts.length === 1 ? 'cuenta coincide' : 'cuentas coinciden'} con los filtros actuales`}</Typography></Box>
          </Stack>
          <Box sx={{ display: { xs: 'none', lg: 'block' }, overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 850, tableLayout: 'fixed', '& .MuiTableCell-root': { px: 1.25, py: 1.25 }, '& .MuiTableCell-head': { fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' } }}>
              <colgroup><col style={{ width: '26%' }} /><col style={{ width: '18%' }} /><col style={{ width: '19%' }} /><col style={{ width: '19%' }} /><col style={{ width: 80 }} /></colgroup>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Cuenta Google</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Plan / capacidad</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Tarjeta / Cobro</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Valor / Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleAccounts.map((account) => (
                  <TableRow key={account.id} hover>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{account.accountEmail}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{account.plan}</Typography><Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{account.storage}</Typography></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <CreditCardOutlinedIcon fontSize="small" color="action" />
                        <Typography variant="body2">•••• {account.cardLastFour}</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">Día {account.billingDay} de cada mes</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{formatCop(account.monthlyPrice)}</Typography>
                      <Chip size="small" color={account.active ? 'success' : 'default'} label={account.active ? 'Activa' : 'Inactiva'} sx={{ mt: 0.5, fontWeight: 700 }} />
                    </TableCell>
                    <TableCell align="right">
                      {canManage && <Tooltip title="Editar cuenta"><IconButton size="small" aria-label="Editar cuenta" onClick={() => openEdit(account)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && visibleAccounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">
                        {accounts.length ? 'No hay cuentas que coincidan con los filtros.' : 'Aún no hay cuentas de Google One registradas.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
          <Box sx={{ display: { xs: 'block', lg: 'none' }, px: 2 }}>
            {visibleAccounts.map((account) => (
              <Box component="article" key={account.id} sx={{ py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 750, overflowWrap: 'anywhere', minWidth: 0 }}>{account.accountEmail}</Typography>
                  <Chip size="small" color={account.active ? 'success' : 'default'} label={account.active ? 'Activa' : 'Inactiva'} sx={{ fontWeight: 700 }} />
                </Stack>
                <Typography variant="body2" sx={{ mt: 1, overflowWrap: 'anywhere' }}>{account.plan} · {account.storage}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>{formatCop(account.monthlyPrice)} / mes</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Tarjeta: •••• {account.cardLastFour} · Cobro mensual: día {account.billingDay}</Typography>
                {canManage && <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(account)} sx={{ mt: 0.75 }}>Editar</Button>}
              </Box>
            ))}
            {!loading && visibleAccounts.length === 0 && <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 6 }}>{accounts.length ? 'No hay cuentas que coincidan con los filtros.' : 'Aún no hay cuentas de Google One registradas.'}</Typography>}
          </Box>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: { xs: '12px', sm: '18px' }, maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' }, m: { xs: 1.5, sm: 4 } } }}>
        <DialogTitle component="div" sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1 }}>
          <Typography component="h2" variant="h6" sx={{ fontWeight: 900 }}>{editingAccount ? 'Editar cuenta Google One' : 'Registrar cuenta Google One'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Datos del plan y del cobro mensual.</Typography>
        </DialogTitle>
        <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <DialogContent sx={{ px: { xs: 2, sm: 3 }, bgcolor: 'action.hover' }}>
            <Stack spacing={2} sx={{ p: { xs: 2, sm: 2.25 }, mt: 1, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
              <TextField
                label="Correo de Google"
                type="email"
                required
                fullWidth
                value={form.accountEmail}
                onChange={(event) => setForm((current) => ({ ...current, accountEmail: event.target.value }))}
                inputProps={{ maxLength: 254 }}
                disabled={saving || Boolean(editingAccount)}
                helperText={editingAccount ? 'El correo identifica el registro y no se puede cambiar.' : 'Admite Gmail y cuentas Google Workspace.'}
              />
              <TextField
                label="Últimos 4 dígitos"
                required
                fullWidth
                value={form.cardLastFour}
                onChange={(event) => setForm((current) => ({ ...current, cardLastFour: event.target.value.replace(/\D/g, '').slice(0, 4) }))}
                inputProps={{ inputMode: 'numeric', maxLength: 4 }}
                InputProps={{ startAdornment: <InputAdornment position="start">••••</InputAdornment> }}
                helperText="De la tarjeta corporativa. No ingreses el número completo ni el CVV."
                disabled={saving}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Plan" required fullWidth value={form.plan} inputProps={{ maxLength: 120 }} onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))} disabled={saving} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Almacenamiento" required fullWidth value={form.storage} placeholder="Ej. 2 TB" inputProps={{ maxLength: 80 }} onChange={(event) => setForm((current) => ({ ...current, storage: event.target.value }))} disabled={saving} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Valor mensual (COP)"
                    type="number"
                    required
                    fullWidth
                    value={form.monthlyPrice}
                    inputProps={{ min: 0, max: 999999999, step: 1 }}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                    helperText="Valor cobrado cada mes, en pesos colombianos."
                    onChange={(event) => setForm((current) => ({ ...current, monthlyPrice: event.target.value }))}
                    disabled={saving}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Día de cobro mensual" type="number" required fullWidth value={form.billingDay} inputProps={{ min: 1, max: 31, step: 1 }} onChange={(event) => setForm((current) => ({ ...current, billingDay: event.target.value }))} disabled={saving} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    control={<Switch checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} disabled={saving} />}
                    label={form.active ? 'Suscripción activa' : 'Suscripción inactiva'}
                  />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          {saving && <LinearProgress />}
          <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={closeDialog} disabled={saving}>Cancelar</Button>
            {canManage && <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Guardando…' : editingAccount ? 'Guardar cambios' : 'Registrar cuenta'}</Button>}
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6500} onClose={() => setSnackbar((current) => ({ ...current, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((current) => ({ ...current, open: false }))} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Stack>
  );
};

export default GoogleOneAccounts;
