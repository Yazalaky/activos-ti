import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Typography } from '@mui/material';
import { deleteMySignature, getMySignature, prepareSignature, saveMySignature } from '../services/userSignature';

type Props = { open: boolean; onClose: () => void };

const SignatureDialog = ({ open, onClose }: Props) => {
  const [existing, setExisting] = useState<Blob | null>(null);
  const [pending, setPending] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setExisting(null);
    setPending(null);
    setAuthorized(false);
    setMessage('');
    setError('');
    setBusy(true);
    getMySignature().then((value) => { if (!cancelled) setExisting(value); })
      .catch(() => { if (!cancelled) setError('No se pudo consultar tu firma. Verifica tu conexión e inténtalo de nuevo.'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    const blob = pending || existing;
    if (!open || !blob) { setPreview(''); return; }
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [open, pending, existing]);

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setMessage('');
    setPending(null);
    setAuthorized(false);
    try { setPending(await prepareSignature(file)); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo leer la imagen.'); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!pending || !authorized) return;
    setBusy(true);
    setError('');
    try {
      await saveMySignature(pending);
      setExisting(pending);
      setPending(null);
      setAuthorized(false);
      setMessage('Firma guardada. Se usará al generar actas creadas por tu usuario.');
    } catch { setError('No se pudo guardar tu firma. Revisa los permisos e inténtalo de nuevo.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm('¿Quieres retirar tu firma? Las nuevas impresiones de tus actas ya no la incluirán. Las copias existentes no se modificarán.')) return;
    setBusy(true);
    setError('');
    try {
      await deleteMySignature();
      setExisting(null);
      setPending(null);
      setAuthorized(false);
      setMessage('Firma retirada. Las copias existentes no se modificaron.');
    } catch { setError('No se pudo retirar tu firma. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Mi firma para actas</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Tu firma se incluirá en las actas creadas por tu usuario, incluso si otra persona autorizada las imprime. No se modifican las actas firmadas ni los PDF ya descargados.</Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}
          {preview ? <Box sx={{ p: 1.5, bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 2, textAlign: 'center' }}>
            <Box component="img" src={preview} alt="Vista previa de tu firma" sx={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain' }} />
          </Box> : <Typography variant="body2" color="text.secondary">No hay una firma para mostrar.</Typography>}
          <Button variant="outlined" component="label" disabled={busy}>
            {existing ? 'Seleccionar otra imagen' : 'Seleccionar imagen de firma'}
            <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = ''; }} />
          </Button>
          <Typography variant="caption" color="text.secondary">PNG, JPG o WEBP; máximo 5 MB. La imagen se ajusta para su uso en el documento.</Typography>
          {pending && <FormControlLabel control={<Checkbox checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} disabled={busy} />}
            label="Autorizo usar esta firma en las actas creadas por mi usuario, incluso cuando otro usuario autorizado las imprima." />}
        </Stack>
      </DialogContent>
      <DialogActions>
        {existing && <Button color="error" onClick={() => void remove()} disabled={busy}>Retirar firma</Button>}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={busy}>Cerrar</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !pending || !authorized}>Guardar firma</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SignatureDialog;
