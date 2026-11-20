import React, { useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { saveAssetType } from '../services/assetTypes';
import { DEFAULT_ASSET_TYPES, type AssetTypeOption } from '../utils/assetTypes';

type Props = { open: boolean; onClose: () => void; types: AssetTypeOption[]; ready: boolean };

const AssetTypesDialog = ({ open, onClose, types, ready }: Props) => {
  const [editing, setEditing] = useState<AssetTypeOption | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const clear = () => { setEditing(null); setName(''); setError(''); };
  const close = () => { if (!busy) { clear(); setMessage(''); onClose(); } };
  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 60) { setError('Escribe un nombre de hasta 60 caracteres.'); return; }
    const repeated = types.some((type) => type.id !== editing?.id
      && type.name.localeCompare(trimmed, 'es-CO', { sensitivity: 'base' }) === 0);
    if (repeated) { setError('Ya existe un tipo con ese nombre, incluso si está desactivado.'); return; }
    if (editing && editing.name !== trimmed && DEFAULT_ASSET_TYPES.some((type) => type.id === editing.id)
        && !window.confirm('El nombre cambiará, pero este tipo conservará su categoría original en las actas y equipos. ¿Deseas continuar?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await saveAssetType(editing?.id || null, trimmed, editing?.active ?? true);
      setMessage(editing ? 'Tipo actualizado.' : 'Tipo agregado.');
      clear();
    } catch { setError('No se pudo guardar el tipo. Verifica la conexión y los permisos.'); }
    finally { setBusy(false); }
  };
  const toggle = async (type: AssetTypeOption) => {
    if (type.active && !window.confirm(`¿Desactivar «${type.name}»? Los equipos existentes se conservarán, pero no se podrá seleccionar para equipos nuevos.`)) return;
    setBusy(true); setError(''); setMessage('');
    try { await saveAssetType(type.id, type.name, !type.active); setMessage(type.active ? 'Tipo desactivado.' : 'Tipo reactivado.'); if (editing?.id === type.id) clear(); }
    catch { setError('No se pudo actualizar el estado del tipo.'); }
    finally { setBusy(false); }
  };

  return <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
    <DialogTitle>Administrar tipos de equipo</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity="info">Desactivar un tipo no elimina ni modifica los equipos existentes. Solo los administradores pueden cambiar este catálogo.</Alert>
        {!ready && <Alert severity="error">No se pudo consultar el catálogo. Verifica la conexión y vuelve a intentarlo.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField label={editing ? 'Editar nombre' : 'Nuevo tipo'} value={name} onChange={(event) => setName(event.target.value)} inputProps={{ maxLength: 60 }} fullWidth size="small" disabled={busy || !ready} />
          <Button variant="contained" onClick={() => void save()} disabled={busy || !ready}>{editing ? 'Guardar' : 'Agregar'}</Button>
          {editing && <Button onClick={clear} disabled={busy}>Cancelar</Button>}
        </Stack>
        <Box sx={{ maxHeight: 370, overflowY: 'auto' }}>
          {types.map((type) => <Stack key={type.id} direction="row" spacing={1} alignItems="center" sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ flex: 1, overflowWrap: 'anywhere' }}>{type.name}</Typography>
            <Chip size="small" label={type.active ? 'Activo' : 'Inactivo'} color={type.active ? 'success' : 'default'} />
            <Button size="small" onClick={() => { setEditing(type); setName(type.name); setError(''); setMessage(''); }} disabled={busy || !ready}>Editar</Button>
            <Button size="small" color={type.active ? 'error' : 'primary'} onClick={() => void toggle(type)} disabled={busy || !ready}>{type.active ? 'Desactivar' : 'Activar'}</Button>
          </Stack>)}
        </Box>
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={close} disabled={busy}>Cerrar</Button></DialogActions>
  </Dialog>;
};

export default AssetTypesDialog;
