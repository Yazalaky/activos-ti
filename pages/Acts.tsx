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
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
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
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { useAuth } from '../auth/AuthContext';
import { addAct, getActs, getAssets, getSites, updateAct } from '../services/api';
import { uploadFileToStorage } from '../services/storageUpload';
import type { Act, ActStatus, Asset, Site } from '../types';

const stripUndefinedDeep = (value: any): any => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
      const next = stripUndefinedDeep(child);
      if (next === undefined) continue;
      out[key] = next;
    }
    return out;
  }
  return value;
};

const statusLabel: Record<ActStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  signed: 'Firmada',
  void: 'Anulada',
};

const statusColor = (status: ActStatus) => {
  switch (status) {
    case 'draft':
      return 'default';
    case 'issued':
      return 'info';
    case 'signed':
      return 'success';
    case 'void':
      return 'error';
    default:
      return 'default';
  }
};

const Acts = () => {
  const { role, user } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';

  const [acts, setActs] = useState<Act[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<ActStatus | ''>('');
  const [filterSiteId, setFilterSiteId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPosition, setRecipientPosition] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [observations, setObservations] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAct, setUploadAct] = useState<Act | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const load = async () => {
    setLoading(true);
    const [a, s, ac] = await Promise.all([getAssets(), getSites(), getActs()]);
    setAssets(a);
    setSites(s);
    setActs(ac);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedAsset = useMemo(() => assets.find((a) => a.id === assetId) || null, [assets, assetId]);
  const selectedSite = useMemo(() => sites.find((s) => s.id === selectedAsset?.siteId) || null, [sites, selectedAsset?.siteId]);

  const filteredActs = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return acts.filter((act) => {
      if (filterStatus && act.status !== filterStatus) return false;
      if (filterSiteId && act.siteId !== filterSiteId) return false;
      if (!q) return true;
      const assetCode = String(act.fixedAssetIdSnapshot || '').toLowerCase();
      const person = String(act.recipient?.fullName || '').toLowerCase();
      return assetCode.includes(q) || person.includes(q) || String(act.companyId || '').toLowerCase().includes(q);
    });
  }, [acts, filterText, filterStatus, filterSiteId]);

  const openCreate = () => {
    setAssetId('');
    setRecipientName('');
    setRecipientPosition('');
    setRecipientEmail('');
    setObservations('');
    setCreateOpen(true);
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!assetId) {
      setSnackbar({ open: true, message: 'Seleccione un activo.', severity: 'warning' });
      return;
    }
    if (!recipientName.trim() || !recipientPosition.trim()) {
      setSnackbar({ open: true, message: 'Complete nombre completo y cargo.', severity: 'warning' });
      return;
    }

    const asset = assets.find((a) => a.id === assetId);
    if (!asset) {
      setSnackbar({ open: true, message: 'Activo no encontrado.', severity: 'error' });
      return;
    }
    const site = sites.find((s) => s.id === asset.siteId);
    if (!site?.companyId) {
      setSnackbar({ open: true, message: 'La sede no tiene empresa asignada. Configura companyId en Sedes.', severity: 'warning' });
      return;
    }

    try {
      setCreating(true);
      const payload = stripUndefinedDeep({
        assetId: asset.id,
        siteId: asset.siteId,
        companyId: site.companyId,
        templateId: site.companyId,
        fixedAssetIdSnapshot: asset.fixedAssetId,
        assetSnapshot: {
          type: asset.type,
          brand: asset.brand,
          model: asset.model,
          serial: asset.serial,
          processor: asset.processor,
          ram: asset.ram,
          storage: asset.storage,
          os: asset.os,
        },
        recipient: {
          fullName: recipientName.trim(),
          position: recipientPosition.trim(),
          email: recipientEmail.trim() || undefined,
        },
        observations: observations.trim() || undefined,
        status: 'draft',
        createdAt: Date.now(),
        createdByUid: user?.uid,
      }) as Omit<Act, 'id'>;
      await addAct(payload);
      setSnackbar({ open: true, message: 'Acta creada (borrador).', severity: 'success' });
      setCreateOpen(false);
      await load();
    } catch (error) {
      console.error('Create act error:', error);
      setSnackbar({ open: true, message: 'No se pudo crear el acta.', severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const openUpload = (act: Act) => {
    setUploadAct(act);
    setUploadFile(null);
    setUploadPct(0);
    setUploadOpen(true);
  };

  const handleUploadPdf = async () => {
    if (!canWrite) return;
    if (!uploadAct) return;
    if (!uploadFile) {
      setSnackbar({ open: true, message: 'Seleccione un archivo PDF.', severity: 'warning' });
      return;
    }
    try {
      setUploading(true);
      const ts = Date.now();
      const result = await uploadFileToStorage(`acts/${uploadAct.id}/pdf/${ts}-${uploadFile.name}`, uploadFile, setUploadPct);
      await updateAct(uploadAct.id, {
        pdfUrl: result.url,
        pdfPath: result.path,
        pdfName: result.name,
        pdfContentType: result.contentType,
        pdfSize: result.size,
        status: uploadAct.status === 'draft' ? 'issued' : uploadAct.status,
        issuedAt: uploadAct.issuedAt ?? Date.now(),
      } as any);
      setSnackbar({ open: true, message: 'PDF cargado.', severity: 'success' });
      setUploadOpen(false);
      await load();
    } catch (error) {
      console.error('Upload act PDF error:', error);
      setSnackbar({ open: true, message: 'No se pudo cargar el PDF.', severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Actas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Crea, gestiona y adjunta actas de entrega por activo.
          </Typography>
        </Box>

        {canWrite && (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>
            Nueva acta
          </Button>
        )}
      </Stack>

      {!canWrite && (
        <Alert severity="info">Modo solo lectura (Gerencia/Auditoría). Puedes ver y descargar actas, pero no crear o modificar.</Alert>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Buscar"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Código del activo o nombre del colaborador..."
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="act-status-label">Estado</InputLabel>
                <Select
                  labelId="act-status-label"
                  label="Estado"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus((e.target.value as any) || '')}
                  startAdornment={
                    <InputAdornment position="start">
                      <FilterAltOutlinedIcon />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="draft">Borrador</MenuItem>
                  <MenuItem value="issued">Emitida</MenuItem>
                  <MenuItem value="signed">Firmada</MenuItem>
                  <MenuItem value="void">Anulada</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="act-site-label">Sede</InputLabel>
                <Select labelId="act-site-label" label="Sede" value={filterSiteId} onChange={(e) => setFilterSiteId(String(e.target.value))}>
                  <MenuItem value="">Todas</MenuItem>
                  {sites
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name} ({s.prefix})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Cargando actas…
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Activo</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Colaborador</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Sede</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Empresa</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>PDF</TableCell>
                  <TableCell sx={{ fontWeight: 900 }} align="right">
                    Acciones
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredActs.map((act) => {
                  const site = sites.find((s) => s.id === act.siteId);
                  return (
                    <TableRow key={act.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'primary.main' }}>
                          {act.fixedAssetIdSnapshot || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {act.assetSnapshot?.brand} {act.assetSnapshot?.model} · S/N: {act.assetSnapshot?.serial}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {act.recipient?.fullName || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {act.recipient?.position || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{site?.name || '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={String(act.companyId || '—')} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip label={statusLabel[act.status]} color={statusColor(act.status) as any} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<OpenInNewOutlinedIcon />}
                          disabled={!act.pdfUrl}
                          onClick={() => {
                            if (!act.pdfUrl) return;
                            window.open(act.pdfUrl, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          Abrir
                        </Button>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {canWrite && (
                            <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => openUpload(act)}>
                              Subir PDF
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredActs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 6 }}>
                      <Typography variant="body2" color="text.secondary" align="center">
                        No hay actas.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Nueva acta</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSaveCreate} sx={{ mt: 1 }}>
            <Stack spacing={2}>
              <FormControl fullWidth required disabled={!canWrite || creating}>
                <InputLabel id="act-asset-label">Activo</InputLabel>
                <Select
                  labelId="act-asset-label"
                  label="Activo"
                  value={assetId}
                  onChange={(e) => {
                    const id = String(e.target.value);
                    setAssetId(id);
                    const asset = assets.find((a) => a.id === id);
                    if (asset?.currentAssignment?.assignedToName) setRecipientName(asset.currentAssignment.assignedToName);
                    if (asset?.currentAssignment?.assignedToPosition) setRecipientPosition(asset.currentAssignment.assignedToPosition);
                  }}
                >
                  <MenuItem value="">Seleccione...</MenuItem>
                  {assets
                    .slice()
                    .sort((a, b) => String(a.fixedAssetId).localeCompare(String(b.fixedAssetId)))
                    .map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.fixedAssetId} · {a.brand} {a.model} (S/N: {a.serial})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {selectedAsset && (
                <Alert severity={selectedSite?.companyId ? 'info' : 'warning'}>
                  {selectedSite?.companyId
                    ? `Plantilla del acta: ${selectedSite.companyId} · Sede: ${selectedSite.name}`
                    : 'La sede de este activo no tiene empresa asignada (companyId). Configúrala en Sedes para elegir plantilla.'}
                </Alert>
              )}

              <TextField
                label="Nombre completo"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
                fullWidth
                disabled={!canWrite || creating}
              />
              <TextField
                label="Cargo"
                value={recipientPosition}
                onChange={(e) => setRecipientPosition(e.target.value)}
                required
                fullWidth
                disabled={!canWrite || creating}
              />
              <TextField
                label="Correo (opcional)"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                fullWidth
                disabled={!canWrite || creating}
              />
              <TextField
                label="Observaciones (opcional)"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                disabled={!canWrite || creating}
              />
            </Stack>

            <DialogActions sx={{ px: 0, mt: 2 }}>
              <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={!canWrite || creating}>
                Guardar borrador
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Subir PDF del acta</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Por ahora puedes adjuntar el PDF (emitido o escaneado firmado). La generación automática con plantilla se implementa en el siguiente paso.
            </Alert>
            {uploading && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Subiendo… {uploadPct}%
                </Typography>
                <LinearProgress variant="determinate" value={uploadPct} sx={{ mt: 0.5, borderRadius: 99 }} />
              </Box>
            )}
            <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled={!canWrite || uploading}>
              {uploadFile ? `Archivo: ${uploadFile.name}` : 'Seleccionar PDF'}
              <input
                hidden
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile(file);
                  setUploadPct(0);
                }}
              />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleUploadPdf} disabled={!canWrite || uploading}>
            Subir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default Acts;
