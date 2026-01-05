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
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { useAuth } from '../auth/AuthContext';
import { addSite, deleteSite, getSites, updateSite } from '../services/api';
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
  const { role } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';

  const [sites, setSites] = useState<Site[]>([]);
  const [filterText, setFilterText] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Site>>({ name: '', city: '', address: '', prefix: '' });
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
        s.city.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.prefix.toLowerCase().includes(q)
      );
    });
  }, [sites, filterText]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', city: '', address: '', prefix: '' });
    setEditorOpen(true);
  };

  const openEdit = (site: Site) => {
    setEditingId(site.id);
    setForm({ name: site.name, city: site.city, address: site.address, prefix: site.prefix, assetSeq: site.assetSeq });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setForm({ name: '', city: '', address: '', prefix: '' });
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
      };

      if (editingId) {
        await updateSite(editingId, payload);
        setSnackbar({ open: true, message: 'Sede actualizada.', severity: 'success' });
      } else {
        await addSite(payload as any);
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
      await deleteSite(deleteTarget.id);
      setSnackbar({ open: true, message: 'Sede eliminada.', severity: 'success' });
      setDeleteOpen(false);
      setDeleteTarget(null);
      load();
    } catch (error) {
      console.error('Delete site error:', error);
      setSnackbar({ open: true, message: 'No se pudo eliminar la sede.', severity: 'error' });
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
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
          <TextField
            label="Buscar"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Nombre, ciudad, prefijo..."
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Ciudad</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Dirección</TableCell>
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
                  <TableCell sx={{ fontWeight: 800 }}>{s.name}</TableCell>
                  <TableCell>{s.city}</TableCell>
                  <TableCell>{s.address}</TableCell>
                  <TableCell>
                    <Chip label={s.prefix} variant="outlined" />
                  </TableCell>
                  <TableCell>{s.assetSeq ?? 0}</TableCell>
                  <TableCell align="right">
                    {canWrite && (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <IconButton size="small" onClick={() => openEdit(s)} aria-label="Editar">
                          <EditOutlinedIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => confirmDelete(s)} aria-label="Eliminar" color="error">
                          <DeleteOutlineOutlinedIcon />
                        </IconButton>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {filteredSites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary" align="center">
                      No hay sedes.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onClose={closeEditor} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>{editingId ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSave} sx={{ mt: 1 }}>
            <Stack spacing={2}>
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
              />
              <Divider />
              {!editingId && computedPrefix.note && <Alert severity="info">{computedPrefix.note}</Alert>}
            </Stack>

            <DialogActions sx={{ px: 0, mt: 2 }}>
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
