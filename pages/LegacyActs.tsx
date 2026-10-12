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
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { useAuth } from '../auth/AuthContext';
import { getActs, getSites, updateAct } from '../services/api';
import { getLegacyPdfFile, isLegacyActPending } from '../services/actLegacy';
import type { Act, ActLegacyClassification, Site } from '../types';

const classificationLabel: Record<ActLegacyClassification, string> = {
  pending: 'Mantener pendiente',
  issued: 'PDF emitido',
  signed_uploaded: 'PDF firmado manualmente',
};

const LegacyActs = () => {
  const { role, profile } = useAuth();
  const isAdmin = role === 'admin';
  const [acts, setActs] = useState<Act[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [filterSiteId, setFilterSiteId] = useState('');
  const [selectedAct, setSelectedAct] = useState<Act | null>(null);
  const [classification, setClassification] = useState<ActLegacyClassification>('pending');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const load = async () => {
    setLoading(true);
    const [loadedActs, loadedSites] = await Promise.all([getActs(), getSites()]);
    setActs(loadedActs);
    setSites(loadedSites);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);
  const pendingActs = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    return acts
      .filter(isLegacyActPending)
      .filter((act) => !filterSiteId || act.siteId === filterSiteId)
      .filter((act) => {
        if (!query) return true;
        const siteName = siteById.get(act.siteId)?.name || '';
        return [act.fixedAssetIdSnapshot, act.recipient?.fullName, act.companyId, siteName]
          .some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [acts, filterSiteId, filterText, siteById]);

  const openReview = (act: Act) => {
    setSelectedAct(act);
    setClassification(act.status === 'signed' ? 'signed_uploaded' : act.legacyClassification || 'pending');
    setReason(act.legacyClassificationReason || '');
  };

  const closeReview = () => {
    if (saving) return;
    setSelectedAct(null);
    setReason('');
    setClassification('pending');
  };

  const handleClassify = async () => {
    if (!isAdmin || !profile?.uid || !selectedAct) return;
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 5) {
      setSnackbar({ open: true, message: 'Registre una observación de al menos 5 caracteres.', severity: 'warning' });
      return;
    }

    if (classification === 'pending' && selectedAct.status === 'signed') {
      setSnackbar({ open: true, message: 'Este registro ya figura como firmado. Debe clasificarlo como PDF firmado manualmente.', severity: 'warning' });
      return;
    }

    const legacyPdf = getLegacyPdfFile(selectedAct);
    if (classification !== 'pending' && !legacyPdf) {
      setSnackbar({ open: true, message: 'El PDF antiguo no tiene metadatos completos. Debe volver a cargarse desde el módulo de Actas.', severity: 'error' });
      return;
    }

    const now = Date.now();
    const update: Record<string, unknown> = {
      legacyClassification: classification,
      legacyClassificationReason: normalizedReason,
      legacyClassifiedAt: now,
      legacyClassifiedByUid: profile.uid,
      legacySignatureDateUnknown: classification === 'signed_uploaded' && !selectedAct.signedAt,
      legacySignerUnknown: classification === 'signed_uploaded',
    };

    if (classification === 'issued' && legacyPdf) {
      update.generatedPdf = legacyPdf;
      update.status = 'issued';
      update.issuedAt = selectedAct.issuedAt ?? selectedAct.createdAt ?? now;
    } else if (classification === 'signed_uploaded' && legacyPdf) {
      update.signedPdf = legacyPdf;
      update.signatureMethod = 'uploaded_pdf';
      update.signedByUid = profile.uid;
      update.signedAt = selectedAct.signedAt ?? selectedAct.issuedAt ?? selectedAct.createdAt ?? now;
      update.status = 'signed';
    }

    try {
      setSaving(true);
      await updateAct(selectedAct.id, update, profile.uid);
      setSnackbar({
        open: true,
        message: classification === 'pending'
          ? 'El acta quedó pendiente de revisión con la observación registrada.'
          : 'El acta antigua fue clasificada correctamente.',
        severity: 'success',
      });
      closeReview();
      await load();
    } catch (error) {
      console.error('Legacy act classification error:', error);
      setSnackbar({ open: true, message: error instanceof Error ? error.message : 'No se pudo clasificar el acta.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return <Alert severity="error">Solo los administradores pueden clasificar actas antiguas.</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Revisión de actas antiguas</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Clasifica los PDFs cargados antes del nuevo flujo de firma sin volver a subirlos.
          </Typography>
        </Box>
        <Chip icon={<FactCheckOutlinedIcon />} label={`${pendingActs.length} pendientes`} color={pendingActs.length ? 'warning' : 'success'} />
      </Stack>

      <Alert severity="info">
        La clasificación solo actualiza los metadatos del acta. El PDF original no se elimina ni se reemplaza.
      </Alert>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Buscar"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="Activo, colaborador, empresa..."
              fullWidth
              InputProps={{ startAdornment: <SearchOutlinedIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
            <FormControl sx={{ minWidth: { md: 280 } }}>
              <InputLabel id="legacy-act-site-label">Sede</InputLabel>
              <Select labelId="legacy-act-site-label" label="Sede" value={filterSiteId} onChange={(event) => setFilterSiteId(String(event.target.value))}>
                <MenuItem value="">Todas</MenuItem>
                {sites
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((site) => <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ p: 3 }}><Typography color="text.secondary">Cargando actas pendientes…</Typography></Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Activo</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Colaborador</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Sede</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>PDF</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Observación actual</TableCell>
                  <TableCell sx={{ fontWeight: 900 }} align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingActs.map((act) => {
                  const site = siteById.get(act.siteId);
                  const hasCompleteMetadata = Boolean(getLegacyPdfFile(act));
                  return (
                    <TableRow key={act.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'primary.main' }}>{act.fixedAssetIdSnapshot || '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{act.assetSnapshot?.brand} {act.assetSnapshot?.model}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{act.recipient?.fullName || '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{act.recipient?.position || '—'}</Typography>
                      </TableCell>
                      <TableCell>{site?.name || '—'}</TableCell>
                      <TableCell>
                        <Stack spacing={0.5} alignItems="flex-start">
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<OpenInNewOutlinedIcon />}
                            disabled={!act.pdfUrl}
                            onClick={() => act.pdfUrl && window.open(act.pdfUrl, '_blank', 'noopener,noreferrer')}
                          >
                            Abrir PDF
                          </Button>
                          {!hasCompleteMetadata && <Chip size="small" label="Metadatos incompletos" color="error" variant="outlined" />}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {act.legacyClassificationReason || 'Sin observación'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button variant="outlined" size="small" onClick={() => openReview(act)}>
                          Clasificar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pendingActs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 6 }}>
                      <Typography align="center" color="text.secondary">No hay actas antiguas pendientes de clasificación.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedAct)} onClose={closeReview} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Clasificar acta antigua</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              Revisa el PDF antes de clasificarlo. La decisión define si el acta podrá firmarse electrónicamente o si quedará cerrada como firmada manualmente.
            </Alert>
            {selectedAct && (
              <Box>
                <Typography variant="body2"><strong>Activo:</strong> {selectedAct.fixedAssetIdSnapshot}</Typography>
                <Typography variant="body2"><strong>Colaborador:</strong> {selectedAct.recipient?.fullName || '—'}</Typography>
                <Button
                  size="small"
                  sx={{ mt: 1 }}
                  startIcon={<OpenInNewOutlinedIcon />}
                  onClick={() => selectedAct.pdfUrl && window.open(selectedAct.pdfUrl, '_blank', 'noopener,noreferrer')}
                >
                  Abrir PDF para revisar
                </Button>
              </Box>
            )}
            {selectedAct && !getLegacyPdfFile(selectedAct) && classification !== 'pending' && (
              <Alert severity="error">Este registro no tiene todos los metadatos requeridos. Debe reemplazar el PDF desde el módulo de Actas antes de clasificarlo.</Alert>
            )}
            <FormControl fullWidth>
              <InputLabel id="legacy-classification-label">Clasificación</InputLabel>
              <Select
                labelId="legacy-classification-label"
                label="Clasificación"
                value={classification}
                onChange={(event) => setClassification(event.target.value as ActLegacyClassification)}
                disabled={saving}
              >
                <MenuItem value="issued">PDF emitido, aún pendiente de firma</MenuItem>
                <MenuItem value="signed_uploaded">PDF firmado manualmente</MenuItem>
                <MenuItem value="pending">Mantener pendiente de revisión</MenuItem>
              </Select>
            </FormControl>
            <Alert severity={classification === 'signed_uploaded' ? 'success' : classification === 'issued' ? 'info' : 'warning'}>
              {classification === 'signed_uploaded'
                ? 'El acta quedará clasificada como firmada manualmente y podrá reemplazarse el PDF si fue cargado por error. El sistema registrará al administrador como responsable de la clasificación, no como firmante original.'
                : classification === 'issued'
                  ? 'El acta seguirá emitida; podrá imprimirse desde Actas y luego cargar el PDF con las firmas manuales.'
                  : 'El acta seguirá bloqueada para firma hasta que exista una clasificación definitiva.'}
            </Alert>
            <TextField
              label="Observación de la clasificación"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              helperText="Explique por qué se tomó la decisión. Mínimo 5 caracteres."
              required
              fullWidth
              multiline
              minRows={3}
              disabled={saving}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeReview} disabled={saving}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleClassify}
            disabled={saving || !selectedAct || (classification !== 'pending' && !getLegacyPdfFile(selectedAct))}
          >
            {saving ? 'Guardando…' : 'Guardar clasificación'}
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

export default LegacyActs;
