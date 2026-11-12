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
  Divider,
  IconButton,
  InputAdornment,
  FormControl,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined';
import { useAuth } from '../auth/AuthContext';
import { addSite, deleteSite, getSites, updateSite } from '../services/api';
import { ACT_COMPANIES, companyLabel } from '../services/actTemplates';
import type { Site } from '../types';

const STOP_WORDS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'E', 'EN', 'EL', 'AL']);

const tokenizeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean)
    .filter((w) => !STOP_WORDS.has(w));

const normalizePrefix = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(4, 'X')
    .slice(0, 4);

const generatePrefix = (name: string) => {
  const tokens = tokenizeName(name);
  if (tokens.length === 0) return 'XXXX';
  if (tokens.length === 1) return (tokens[0].slice(0, 4) + 'XXXX').slice(0, 4);

  const last = tokens[tokens.length - 1];
  const initials = tokens
    .slice(0, -1)
    .map((t) => t[0])
    .join('')
    .slice(0, 3);

  const remaining = Math.max(1, 4 - initials.length);
  const lastPart = (last.slice(0, remaining) + 'XXXX').slice(0, remaining);
  return (initials + lastPart).slice(0, 4);
};

const generatePrefixCandidates = (name: string) => {
  const tokens = tokenizeName(name);
  if (tokens.length === 0) return ['XXXX'];

  // Default algorithm first (keeps existing behavior for most names)
  const candidates: string[] = [generatePrefix(name)];

  // For 2-token names (Empresa + Sede), expand letters from Empresa if there's a collision.
  if (tokens.length === 2) {
    const company = tokens[0];
    const site = tokens[1];
    for (const companyLen of [1, 2, 3, 4]) {
      const siteLen = Math.max(0, 4 - companyLen);
      candidates.push(normalizePrefix(company.slice(0, companyLen) + site.slice(0, siteLen)));
    }
  } else {
    // Fallbacks: first token + last token with different splits
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    for (const companyLen of [1, 2, 3]) {
      const siteLen = Math.max(0, 4 - companyLen);
      candidates.push(normalizePrefix(first.slice(0, companyLen) + last.slice(0, siteLen)));
    }
  }

  // Unique preserve order
  return [...new Set(candidates)].filter((p) => /^[A-Z0-9]{4}$/.test(p));
};

const pickUniquePrefix = (name: string, used: Set<string>) => {
  const candidates = generatePrefixCandidates(name);
  const base = candidates[0] || 'XXXX';

  for (const candidate of candidates) {
    if (!used.has(candidate)) {
      const note = candidate !== base ? `Prefijo ajustado automáticamente: ${base} ya existe, se usará ${candidate}.` : '';
      return { prefix: candidate, unique: true, note };
    }
  }

  return {
    prefix: base,
    unique: false,
    note: `No se pudo generar un prefijo único (ej: ${base}). Cambia el nombre o contacta al administrador.`,
  };
};

const Sites = () => {
  const { role, profile } = useAuth();
  const theme = useTheme();
  const canWrite = role === 'admin' || role === 'tech';

  const [sites, setSites] = useState<Site[]>([]);
  const [filterText, setFilterText] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Site>>({ name: '', city: '', address: '', prefix: '', companyId: '' });
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const load = async () => {
    const data = await getSites();
    data.sort((a, b) => a.name.localeCompare(b.name));
    setSites(data);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredSites = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        companyLabel(s.companyId).toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.prefix.toLowerCase().includes(q)
      );
    });
  }, [sites, filterText]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', city: '', address: '', prefix: '', companyId: '' });
    setEditorOpen(true);
  };

  const openEdit = (site: Site) => {
    setEditingId(site.id);
    setForm({
      name: site.name,
      city: site.city,
      address: site.address,
      prefix: site.prefix,
      assetSeq: site.assetSeq,
      companyId: site.companyId || '',
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setForm({ name: '', city: '', address: '', prefix: '', companyId: '' });
    setSaving(false);
  };

  const usedPrefixes = useMemo(() => new Set(sites.filter((s) => s.id !== editingId).map((s) => s.prefix)), [sites, editingId]);

  const computedPrefix = useMemo(() => {
    if (editingId) {
      const locked = normalizePrefix(String(form.prefix || sites.find((s) => s.id === editingId)?.prefix || 'XXXX'));
      return { prefix: locked, unique: true, note: 'Prefijo bloqueado: no cambia al editar una sede.' };
    }
    return pickUniquePrefix(String(form.name || ''), usedPrefixes);
  }, [editingId, form.name, form.prefix, sites, usedPrefixes]);

  const validate = () => {
    if (!form.name?.trim()) return 'Ingrese el nombre de la sede.';
    if (!form.city?.trim()) return 'Ingrese la ciudad.';
    if (!form.address?.trim()) return 'Ingrese la dirección.';
    if (!String(form.companyId || '').trim()) return 'Seleccione la empresa para identificar el logo del acta.';
    const tokens = tokenizeName(String(form.name || ''));
    if (tokens.length < 2) return 'El nombre debe incluir empresa y sede (ej: "Medicuc Soacha").';
    if (!/^[A-Z0-9]{4}$/.test(computedPrefix.prefix)) return 'No se pudo generar el prefijo automáticamente.';
    if (!computedPrefix.unique) return computedPrefix.note;

    const duplicated = sites.some((s) => s.id !== editingId && s.prefix === computedPrefix.prefix);
    if (duplicated) return `El prefijo generado (${computedPrefix.prefix}) ya existe en otra sede. Cambia el nombre.`;
    return '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setSnackbar({ open: true, message: err, severity: 'warning' });
      return;
    }

    if (!canWrite) {
      setSnackbar({ open: true, message: 'Modo solo lectura. No puedes modificar sedes.', severity: 'warning' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: String(form.name).trim(),
        city: String(form.city).trim(),
        address: String(form.address).trim(),
        prefix: computedPrefix.prefix,
        companyId: String(form.companyId || '').trim(),
      };

      if (editingId) {
        await updateSite(editingId, payload, profile?.uid);
        setSnackbar({ open: true, message: 'Sede actualizada.', severity: 'success' });
      } else {
        await addSite(payload as any, profile?.uid);
        setSnackbar({ open: true, message: 'Sede creada.', severity: 'success' });
      }
      closeEditor();
      load();
    } catch (error) {
      console.error('Save site error:', error);
      setSnackbar({ open: true, message: 'No se pudo guardar la sede.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (site: Site) => {
    setDeleteTarget(site);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!canWrite) return;
    try {
      await deleteSite(deleteTarget.id, profile?.uid);
      setSnackbar({ open: true, message: 'Sede eliminada.', severity: 'success' });
      setDeleteOpen(false);
      setDeleteTarget(null);
      load();
    } catch (error) {
      console.error('Delete site error:', error);
      setSnackbar({ open: true, message: 'No se pudo eliminar la sede.', severity: 'error' });
    }
  };

  const renderSiteActions = (site: Site, mobile = false) => !canWrite ? null : mobile ? (
    <Stack direction="row" useFlexGap flexWrap="wrap" spacing={0.5}>
      <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(site)}>Editar</Button>
      <Button size="small" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => confirmDelete(site)}>Eliminar</Button>
    </Stack>
  ) : (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
      <Tooltip title="Editar sede"><IconButton size="small" onClick={() => openEdit(site)} aria-label="Editar sede"><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Eliminar sede"><IconButton size="small" onClick={() => confirmDelete(site)} aria-label="Eliminar sede" color="error"><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton></Tooltip>
    </Stack>
  );

  return (
    <Stack spacing={2.25} sx={{ '& > .MuiCard-root': { borderRadius: '16px' }, '& > .MuiStack-root .MuiButton-root, & > .MuiCard-root .MuiButton-root': { borderRadius: '10px' } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} sx={{ pt: { xs: 0.5, md: 1 }, pb: 0.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'secondary.main' }} />
            <Typography variant="inherit" sx={{ fontSize: '0.69rem', color: 'text.secondary', fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Gestión de activos TI</Typography>
          </Stack>
          <Typography component="h1" variant="inherit" sx={{ fontWeight: 750, fontSize: { xs: '1.6rem', md: '1.95rem' }, letterSpacing: '-0.035em', lineHeight: 1.15 }}>
            Sedes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Administración de sedes y prefijos para consecutivos de activos.
          </Typography>
        </Box>

        {canWrite && (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>
            Nueva sede
          </Button>
        )}
      </Stack>

      {!canWrite && (
        <Alert severity="info">Modo solo lectura (Gerencia/Auditoría). Puedes ver sedes, pero no crear/editar/eliminar.</Alert>
      )}

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '10px', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.09) }}><TuneOutlinedIcon fontSize="small" /></Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>Buscar sede</Typography>
              <Typography variant="caption" color="text.secondary">Consulta por nombre, empresa, ciudad, dirección o prefijo</Typography>
            </Box>
          </Stack>
          <TextField
            label="Buscar"
            size="small"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Nombre, empresa, ciudad, prefijo..."
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon />
                </InputAdornment>
              ),
            }}
          />
          {filterText && <Box sx={{ mt: 1.25, display: 'flex', justifyContent: 'flex-end' }}><Button size="small" onClick={() => setFilterText('')}>Limpiar</Button></Box>}
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 2.5, py: 2 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '10px', color: 'secondary.main', bgcolor: alpha(theme.palette.secondary.main, 0.1) }}><LocationCityOutlinedIcon fontSize="small" /></Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 750, letterSpacing: '-0.015em' }}>Listado de sedes</Typography>
              <Typography variant="caption" color="text.secondary">{filteredSites.length.toLocaleString('es-CO')} {filteredSites.length === 1 ? 'sede coincide' : 'sedes coinciden'} con la búsqueda</Typography>
            </Box>
          </Stack>
          <Box sx={{ display: { xs: 'none', lg: 'block' }, overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 850, tableLayout: 'fixed', '& .MuiTableCell-root': { px: 1.25, py: 1.25 }, '& .MuiTableCell-head': { fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' } }}>
            <colgroup><col style={{ width: '28%' }} /><col style={{ width: '31%' }} /><col style={{ width: '13%' }} /><col style={{ width: '13%' }} /><col style={{ width: 90 }} /></colgroup>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Sede / Empresa</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Ciudad / Dirección</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Prefijo</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Consecutivo</TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="right">
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSites.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 750, overflowWrap: 'anywhere' }}>{s.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{companyLabel(s.companyId)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{s.city}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{s.address}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={s.prefix} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                  </TableCell>
                  <TableCell>{s.assetSeq ?? 0}</TableCell>
                  <TableCell align="right">{renderSiteActions(s)}</TableCell>
                </TableRow>
              ))}

              {filteredSites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary" align="center">
                      No hay sedes.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </Box>
          <Box sx={{ display: { xs: 'block', lg: 'none' }, px: 2 }}>
            {filteredSites.map((site) => (
              <Box component="article" key={site.id} sx={{ py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 750, overflowWrap: 'anywhere' }}>{site.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{companyLabel(site.companyId)}</Typography>
                  </Box>
                  <Chip label={site.prefix} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                </Stack>
                <Typography variant="body2" sx={{ mt: 1, overflowWrap: 'anywhere' }}>{site.city}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>{site.address}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>Consecutivo: {site.assetSeq ?? 0}</Typography>
                <Box sx={{ mt: 0.75 }}>{renderSiteActions(site, true)}</Box>
              </Box>
            ))}
            {filteredSites.length === 0 && <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 6 }}>No hay sedes.</Typography>}
          </Box>
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onClose={closeEditor} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: { xs: '12px', sm: '18px' }, maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' }, m: { xs: 1.5, sm: 4 } } }}>
        <DialogTitle component="div" sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1 }}>
          <Typography component="h2" variant="h6" sx={{ fontWeight: 900 }}>{editingId ? 'Editar sede' : 'Nueva sede'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Información de la sede y su prefijo de activos.</Typography>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, bgcolor: 'action.hover' }}>
	          <Box component="form" onSubmit={handleSave} sx={{ mt: 1 }}>
	            <Box sx={{ p: { xs: 2, sm: 2.25 }, border: '1px solid', borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
	            <Typography variant="subtitle2" sx={{ fontWeight: 750, mb: 0.5 }}>Datos de la sede</Typography>
	            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>La empresa define el formato de las actas de esta sede.</Typography>
	            <Stack spacing={2}>
	              <FormControl fullWidth required disabled={!canWrite || saving}>
	                <InputLabel id="site-company-label">Empresa del acta</InputLabel>
	                <Select
	                  labelId="site-company-label"
	                  label="Empresa del acta"
	                  value={String(form.companyId || '')}
	                  onChange={(e) => setForm({ ...form, companyId: String(e.target.value) })}
	                >
	                  <MenuItem value="">Seleccione...</MenuItem>
                  {ACT_COMPANIES.map((c) => (
	                    <MenuItem key={c.id} value={c.id}>
	                      {c.label}
	                    </MenuItem>
	                  ))}
	                </Select>
	              </FormControl>
	              {editingId && !form.companyId && (
	                <Alert severity="warning">
	                  Esta sede no tiene empresa asignada. Es necesario para generar el acta con el logo correcto.
	                </Alert>
	              )}
	              <TextField
	                label="Nombre"
	                value={form.name || ''}
	                onChange={(e) => setForm({ ...form, name: e.target.value })}
	                fullWidth
	                required
	                disabled={!canWrite || saving}
	                helperText='Formato esperado: "Empresa Sede" (ej: "Medicuc Soacha").'
	              />
              <TextField
                label="Ciudad"
                value={form.city || ''}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                fullWidth
                required
                disabled={!canWrite || saving}
              />
              <TextField
                label="Dirección"
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                fullWidth
                required
                disabled={!canWrite || saving}
              />
              <TextField
                label={editingId ? 'Prefijo (bloqueado)' : 'Prefijo (automático)'}
                value={computedPrefix.prefix}
                fullWidth
                required
                helperText={
                  computedPrefix.note ||
                  'Se genera desde el nombre (ej: "Medicuc Soacha" → MSOA, "Salud Familia Sabana" → SFSA).'
                }
                disabled
                sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: theme.palette.text.primary } }}
              />
              <Divider />
              {!editingId && computedPrefix.note && <Alert severity="info">{computedPrefix.note}</Alert>}
            </Stack>
            </Box>

            <DialogActions sx={{ position: 'sticky', bottom: 0, zIndex: 1, mt: 2, px: 1.5, py: 1, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '12px', boxShadow: 2 }}>
              <Button onClick={closeEditor}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={!canWrite || saving} startIcon={<AddOutlinedIcon />}>
                Guardar
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>Eliminar sede</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Esta acción puede dejar activos/facturas referenciando una sede inexistente.
          </Typography>
          {deleteTarget && (
            <Typography variant="subtitle2" sx={{ fontWeight: 900, mt: 1 }}>
              {deleteTarget.name} ({deleteTarget.prefix})
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={!canWrite}>
            Eliminar
          </Button>
        </DialogActions>
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

export default Sites;
