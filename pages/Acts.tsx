import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../auth/AuthContext';
import { addAct, getActs, getActTemplates, getAssets, getSites, updateAct } from '../services/api';
import { uploadFileToStorage } from '../services/storageUpload';
import { generateActPdf, signActPdfElectronically, signatureFileToDataUrl } from '../services/actPdf';
import { companyLabel } from '../services/actTemplates';
import { isLegacyActPending } from '../services/actLegacy';
import type { Act, ActStatus, ActTemplate, Asset, Site } from '../types';

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

const MAX_ACT_PDF_SIZE = 10 * 1024 * 1024;

const Acts = () => {
  const { role, profile } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';

  const [acts, setActs] = useState<Act[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [templates, setTemplates] = useState<ActTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<ActStatus | ''>('');
  const [filterSiteId, setFilterSiteId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createSiteId, setCreateSiteId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPosition, setRecipientPosition] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientDocument, setRecipientDocument] = useState('');
  const [recipientArea, setRecipientArea] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientExtension, setRecipientExtension] = useState('');
  const [recipientNetworkUser, setRecipientNetworkUser] = useState('');
  const [observations, setObservations] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAct, setUploadAct] = useState<Act | null>(null);
  const [uploadMode, setUploadMode] = useState<'issued' | 'signed' | 'replace_signed'>('signed');
  const [replacementReason, setReplacementReason] = useState('');
  const [generatingActId, setGeneratingActId] = useState<string | null>(null);
  const [signingAct, setSigningAct] = useState<Act | null>(null);
  const [signing, setSigning] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingSignature = useRef(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const load = async () => {
    setLoading(true);
    const [a, s, ac, t] = await Promise.all([getAssets(), getSites(), getActs(), getActTemplates()]);
    setAssets(a);
    setSites(s);
    setActs(ac);
    setTemplates(t);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedAsset = useMemo(() => assets.find((a) => a.id === assetId) || null, [assets, assetId]);
  const selectedSite = useMemo(() => sites.find((s) => s.id === createSiteId) || null, [sites, createSiteId]);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.companyId === selectedSite?.companyId && template.active !== false) || null,
    [templates, selectedSite?.companyId]
  );
  const assetsForCreateSite = useMemo(
    () => assets
      .filter((asset) => !createSiteId || asset.siteId === createSiteId)
      .filter((asset) => asset.status === 'asignado' && Boolean(asset.currentAssignment?.assignedToName && asset.currentAssignment?.assignedToPosition && asset.currentAssignment?.assignedToResponsible))
      .slice()
      .sort((a, b) => String(a.fixedAssetId).localeCompare(String(b.fixedAssetId))),
    [assets, createSiteId]
  );

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
    setCreateSiteId('');
    setAssetId('');
    setRecipientName('');
    setRecipientPosition('');
    setRecipientEmail('');
    setRecipientDocument('');
    setRecipientArea('');
    setRecipientPhone('');
    setRecipientExtension('');
    setRecipientNetworkUser('');
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
    if (!recipientName.trim() || !recipientPosition.trim() || !recipientDocument.trim()) {
      setSnackbar({ open: true, message: 'Complete nombre completo, documento y cargo.', severity: 'warning' });
      return;
    }

    const asset = assets.find((a) => a.id === assetId);
    if (!asset) {
      setSnackbar({ open: true, message: 'Activo no encontrado.', severity: 'error' });
      return;
    }
    const site = sites.find((s) => s.id === asset.siteId);
    if (!createSiteId || asset.siteId !== createSiteId) {
      setSnackbar({ open: true, message: 'Seleccione una sede y un activo de esa misma sede.', severity: 'warning' });
      return;
    }
    if (!site?.companyId) {
      setSnackbar({ open: true, message: 'La sede no tiene empresa asignada. Configura companyId en Sedes.', severity: 'warning' });
      return;
    }
    if (asset.status !== 'asignado' || !asset.currentAssignment?.assignedToName || !asset.currentAssignment?.assignedToPosition || !asset.currentAssignment?.assignedToResponsible) {
      setSnackbar({ open: true, message: 'Solo se pueden crear actas para activos asignados con asignación completa.', severity: 'warning' });
      return;
    }
    if (acts.some((act) => act.assetId === asset.id && act.status !== 'void')) {
      setSnackbar({ open: true, message: 'El activo ya tiene un acta vigente. Anule la anterior antes de crear otra.', severity: 'warning' });
      return;
    }

    try {
      setCreating(true);
      const payload = stripUndefinedDeep({
        assetId: asset.id,
        siteId: asset.siteId,
        companyId: site.companyId,
        templateId: site.companyId,
        templateVersion: selectedTemplate?.version,
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
          documentNumber: recipientDocument.trim(),
          area: recipientArea.trim() || undefined,
          phone: recipientPhone.trim() || undefined,
          extension: recipientExtension.trim() || undefined,
          networkUser: recipientNetworkUser.trim() || undefined,
        },
        observations: observations.trim() || undefined,
        status: 'draft',
      }) as Omit<Act, 'id'>;
      await addAct(payload, profile?.uid);
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

  const openUpload = (act: Act, mode: 'issued' | 'signed' | 'replace_signed' = 'signed') => {
    setUploadAct(act);
    setUploadMode(mode);
    setUploadFile(null);
    setUploadPct(0);
    setReplacementReason('');
    setUploadOpen(true);
  };

  const handleGeneratePdf = async (act: Act) => {
    if (!canWrite || isLegacyActPending(act) || act.status === 'signed' || act.status === 'void') return;
    const site = sites.find((item) => item.id === act.siteId);
    const template = templates.find((item) => item.companyId === act.companyId && item.active !== false);
    if (!site || !template) {
      setSnackbar({ open: true, message: 'No se encontró la sede o plantilla activa de la empresa.', severity: 'warning' });
      return;
    }
    if (!template.pdfTemplateUrl) {
      setSnackbar({ open: true, message: 'La empresa no tiene PDF operativo. Un administrador debe cargar la plantilla rellenable.', severity: 'warning' });
      return;
    }

    try {
      setGeneratingActId(act.id);
      const file = await generateActPdf(act, site, template);
      const result = await uploadFileToStorage(`acts/${act.id}/generated/${Date.now()}-${file.name}`, file);
      const generatedPdf = {
        url: result.url,
        path: result.path,
        name: result.name,
        contentType: result.contentType,
        size: result.size,
        createdAt: Date.now(),
        createdByUid: profile?.uid,
      };
      await updateAct(act.id, {
        generatedPdf,
        templateVersion: template.version,
        pdfUrl: result.url,
        pdfPath: result.path,
        pdfName: result.name,
        pdfContentType: result.contentType,
        pdfSize: result.size,
        status: 'issued',
        issuedAt: act.issuedAt ?? Date.now(),
      } as any, profile?.uid);
      setSnackbar({ open: true, message: 'PDF generado y acta emitida.', severity: 'success' });
      await load();
    } catch (error) {
      console.error('Generate act PDF error:', error);
      setSnackbar({ open: true, message: error instanceof Error ? error.message : 'No se pudo generar el PDF.', severity: 'error' });
    } finally {
      setGeneratingActId(null);
    }
  };

  const openElectronicSignature = (act: Act) => {
    if (isLegacyActPending(act) || act.status !== 'issued' || act.signatureMethod) return;
    setSigningAct(act);
    setSignatureDataUrl('');
    window.setTimeout(() => {
      const canvas = signatureCanvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = '#222222';
      context.lineWidth = 2;
      context.lineCap = 'round';
    }, 0);
  };

  const getSignaturePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleSignaturePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext('2d');
    if (!context) return;
    const point = getSignaturePoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawingSignature.current = true;
  };

  const handleSignaturePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingSignature.current) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = getSignaturePoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const handleSignaturePointerUp = () => {
    drawingSignature.current = false;
    const canvas = signatureCanvasRef.current;
    if (canvas) setSignatureDataUrl(canvas.toDataURL('image/png'));
  };

  const handleElectronicSignature = async () => {
    if (!canWrite || !signingAct || isLegacyActPending(signingAct) || signingAct.status !== 'issued' || signingAct.signatureMethod) return;
    if (!signatureDataUrl) {
      setSnackbar({ open: true, message: 'Dibuje o cargue una firma antes de continuar.', severity: 'warning' });
      return;
    }
    const template = templates.find((item) => item.companyId === signingAct.companyId && item.active !== false);
    if (!template) {
      setSnackbar({ open: true, message: 'No se encontró la plantilla de firma de la empresa.', severity: 'warning' });
      return;
    }
    try {
      setSigning(true);
      const file = await signActPdfElectronically(signingAct, template, signatureDataUrl);
      const result = await uploadFileToStorage(`acts/${signingAct.id}/signed/${Date.now()}-${file.name}`, file);
      const signedPdf = {
        url: result.url,
        path: result.path,
        name: result.name,
        contentType: result.contentType,
        size: result.size,
        createdAt: Date.now(),
        createdByUid: profile?.uid,
      };
      await updateAct(signingAct.id, {
        signedPdf,
        signatureMethod: 'electronic',
        signedByUid: profile?.uid,
        signedAt: Date.now(),
        pdfUrl: result.url,
        pdfPath: result.path,
        pdfName: result.name,
        pdfContentType: result.contentType,
        pdfSize: result.size,
        status: 'signed',
      } as any, profile?.uid);
      setSigningAct(null);
      setSnackbar({ open: true, message: 'Acta firmada electrónicamente.', severity: 'success' });
      await load();
    } catch (error) {
      console.error('Electronic act signature error:', error);
      setSnackbar({ open: true, message: error instanceof Error ? error.message : 'No se pudo firmar el acta.', severity: 'error' });
    } finally {
      setSigning(false);
    }
  };

  const handleUploadPdf = async () => {
    if (!canWrite) return;
    if (!uploadAct) return;
    if (!uploadFile) {
      setSnackbar({ open: true, message: 'Seleccione un archivo PDF.', severity: 'warning' });
      return;
    }
    if (uploadFile.type !== 'application/pdf' && !uploadFile.name.toLowerCase().endsWith('.pdf')) {
      setSnackbar({ open: true, message: 'El archivo debe ser un PDF.', severity: 'warning' });
      return;
    }
    if (uploadFile.size > MAX_ACT_PDF_SIZE) {
      setSnackbar({ open: true, message: 'El PDF no puede superar los 10 MB.', severity: 'warning' });
      return;
    }
    if (uploadMode === 'replace_signed' && replacementReason.trim().length < 5) {
      setSnackbar({ open: true, message: 'Indique un motivo de al menos 5 caracteres para reemplazar el PDF firmado.', severity: 'warning' });
      return;
    }
    if (uploadMode === 'replace_signed' && !profile?.uid) {
      setSnackbar({ open: true, message: 'No se pudo identificar al usuario que realiza el reemplazo.', severity: 'error' });
      return;
    }

    try {
      setUploading(true);
      const ts = Date.now();
      if (isLegacyActPending(uploadAct) && uploadMode !== 'replace_signed') {
        throw new Error('El acta antigua debe ser clasificada por un administrador antes de cargar o firmar un PDF.');
      }
      if (uploadMode === 'signed' && (uploadAct.status !== 'issued' || uploadAct.signatureMethod)) {
        throw new Error('El acta no está disponible para recibir otra firma.');
      }
      if (uploadMode === 'replace_signed' && (uploadAct.status !== 'signed' || uploadAct.signatureMethod !== 'uploaded_pdf' || !uploadAct.signedPdf)) {
        throw new Error('Solo se puede reemplazar un PDF firmado que fue cargado manualmente.');
      }
      const kind = uploadMode === 'issued' ? 'generated' : 'signed';
      const result = await uploadFileToStorage(`acts/${uploadAct.id}/${kind}/${ts}-${uploadFile.name}`, uploadFile, setUploadPct);
      const fileInfo = {
        url: result.url,
        path: result.path,
        name: result.name,
        contentType: result.contentType,
        size: result.size,
        createdAt: Date.now(),
        createdByUid: profile?.uid,
      };
      const update: Record<string, unknown> = {
        pdfUrl: result.url,
        pdfPath: result.path,
        pdfName: result.name,
        pdfContentType: result.contentType,
        pdfSize: result.size,
      };
      if (uploadMode === 'signed') {
        update.signedPdf = fileInfo;
        update.signatureMethod = 'uploaded_pdf';
        update.signedByUid = profile?.uid;
        update.signedAt = Date.now();
        update.status = 'signed';
      } else if (uploadMode === 'replace_signed') {
        const previousPdf = uploadAct.signedPdf;
        update.signedPdf = fileInfo;
        update.signedPdfHistory = [
          ...(uploadAct.signedPdfHistory || []),
          {
            ...previousPdf,
            replacedAt: Date.now(),
            replacedByUid: profile.uid,
            replacementReason: replacementReason.trim(),
          },
        ].slice(-10);
        update.signedAt = Date.now();
        update.status = 'signed';
      } else {
        update.generatedPdf = fileInfo;
        update.status = 'issued';
        update.issuedAt = uploadAct.issuedAt ?? Date.now();
      }
      await updateAct(uploadAct.id, update as Partial<Act>, profile?.uid);

      setSnackbar({
        open: true,
        message: uploadMode === 'signed'
          ? 'PDF firmado cargado y acta cerrada.'
          : uploadMode === 'replace_signed'
            ? 'PDF firmado reemplazado. La versión anterior se conservó.'
            : 'PDF emitido cargado correctamente.',
        severity: 'success',
      });
      setUploadOpen(false);
      await load();
    } catch (error) {
      console.error('Upload act PDF error:', error);
      setSnackbar({ open: true, message: error instanceof Error ? error.message : 'No se pudo guardar el PDF.', severity: 'error' });
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
                  const legacyPending = isLegacyActPending(act);
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
                        <Chip label={companyLabel(act.companyId)} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          <Chip label={statusLabel[act.status]} color={statusColor(act.status) as any} />
                          {legacyPending && <Chip label="Revisión pendiente" color="warning" variant="outlined" />}
                        </Stack>
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
                        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                          {canWrite && act.status === 'draft' && !legacyPending && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<DescriptionOutlinedIcon />}
                              onClick={() => handleGeneratePdf(act)}
                              disabled={generatingActId === act.id}
                            >
                              {generatingActId === act.id ? 'Generando…' : 'Generar PDF'}
                            </Button>
                          )}
                          {canWrite && act.status === 'draft' && act.pdfUrl && !act.generatedPdf && !legacyPending && (
                            <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => openUpload(act, 'issued')}>
                              Registrar PDF emitido
                            </Button>
                          )}
                          {canWrite && act.status === 'issued' && !act.signatureMethod && !legacyPending && (
                            <>
                              <Button size="small" variant="outlined" startIcon={<DrawOutlinedIcon />} onClick={() => openElectronicSignature(act)}>
                                Firma electrónica
                              </Button>
                              <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => openUpload(act, 'signed')}>
                                Cargar firmado
                              </Button>
                            </>
                          )}
                          {act.status === 'signed' && act.signatureMethod === 'uploaded_pdf' && canWrite && (
                            <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => openUpload(act, 'replace_signed')}>
                              Reemplazar PDF firmado
                            </Button>
                          )}
                          {act.status === 'signed' && (
                            <>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<DrawOutlinedIcon />}
                                disabled
                              >
                                Firma electrónica
                              </Button>
                              <Chip
                                size="small"
                                icon={<LockOutlinedIcon />}
                                label={act.signatureMethod === 'uploaded_pdf' ? 'Firmada por PDF' : 'Firma electrónica aplicada'}
                                variant="outlined"
                              />
                            </>
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
                <InputLabel id="act-create-site-label">Sede</InputLabel>
                <Select
                  labelId="act-create-site-label"
                  label="Sede"
                  value={createSiteId}
                  onChange={(e) => {
                    const siteId = String(e.target.value);
                    setCreateSiteId(siteId);
                    setAssetId('');
                    setRecipientName('');
                    setRecipientPosition('');
                    setRecipientEmail('');
                    setRecipientDocument('');
                    setRecipientArea('');
                    setRecipientPhone('');
                    setRecipientExtension('');
                    setRecipientNetworkUser('');
                  }}
                >
                  <MenuItem value="">Seleccione una sede...</MenuItem>
                  {sites
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((site) => {
                      const siteAssetCount = assets.filter((asset) => asset.siteId === site.id && asset.status === 'asignado' && Boolean(asset.currentAssignment?.assignedToName && asset.currentAssignment?.assignedToPosition && asset.currentAssignment?.assignedToResponsible)).length;
                      return (
                        <MenuItem key={site.id} value={site.id}>
                          {site.name} · {siteAssetCount} activo{siteAssetCount === 1 ? '' : 's'}
                        </MenuItem>
                      );
                    })}
                </Select>
              </FormControl>

              <FormControl fullWidth required disabled={!canWrite || creating || !createSiteId}>
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
                  <MenuItem value="">
                    {!createSiteId
                      ? 'Seleccione primero una sede'
                      : assetsForCreateSite.length === 0
                        ? 'No hay activos en esta sede'
                        : 'Seleccione un activo...'}
                  </MenuItem>
                  {assetsForCreateSite.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.fixedAssetId} · {a.brand} {a.model} · S/N: {a.serial} · Estado: {a.status}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {selectedAsset && (
                <Alert severity={selectedSite?.companyId ? 'info' : 'warning'}>
                  {selectedSite?.companyId
                    ? `Plantilla del acta: ${companyLabel(selectedSite.companyId)}${selectedTemplate?.pdfTemplateUrl ? '' : ' (PDF operativo pendiente)'} · Sede: ${selectedSite.name}`
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
                label="Documento de identidad"
                value={recipientDocument}
                onChange={(e) => setRecipientDocument(e.target.value)}
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
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Área (opcional)" value={recipientArea} onChange={(e) => setRecipientArea(e.target.value)} fullWidth disabled={!canWrite || creating} />
                </Grid>
                <Grid size={{ xs: 8, sm: 4 }}>
                  <TextField label="Teléfono (opcional)" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} fullWidth disabled={!canWrite || creating} />
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
                  <TextField label="Ext." value={recipientExtension} onChange={(e) => setRecipientExtension(e.target.value)} fullWidth disabled={!canWrite || creating} />
                </Grid>
              </Grid>
              <TextField label="Usuario de red (opcional)" value={recipientNetworkUser} onChange={(e) => setRecipientNetworkUser(e.target.value)} fullWidth disabled={!canWrite || creating} />
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

      <Dialog open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {uploadMode === 'signed' ? 'Cargar PDF firmado' : uploadMode === 'replace_signed' ? 'Reemplazar PDF firmado' : 'Registrar PDF emitido'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              {uploadMode === 'signed'
                ? 'Esta opción cierra el acta como Firmada. Después de cargar el archivo no se podrá firmar electrónicamente. Si se cargó el archivo equivocado, un usuario autorizado podrá reemplazarlo conservando la versión anterior.'
                : uploadMode === 'replace_signed'
                  ? 'El acta ya está firmada mediante un PDF cargado. El archivo anterior no se eliminará: quedará conservado como versión reemplazada y la firma electrónica seguirá deshabilitada.'
                : 'Usa esta opción únicamente para conservar compatibilidad con actas antiguas que ya tenían un PDF emitido fuera del sistema.'}
            </Alert>
            {uploadAct?.pdfUrl && (
              <Typography variant="body2" color="text.secondary">
                Archivo actual: <strong>{uploadAct.pdfName || 'PDF del acta'}</strong>
              </Typography>
            )}
            {uploadMode === 'replace_signed' && (
              <TextField
                label="Motivo del reemplazo"
                value={replacementReason}
                onChange={(event) => setReplacementReason(event.target.value)}
                helperText="Registre por qué se reemplaza el PDF firmado."
                required
                fullWidth
                multiline
                minRows={2}
                disabled={uploading}
              />
            )}
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
                  e.target.value = '';
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
            {uploadMode === 'signed' ? 'Cerrar acta como firmada' : uploadMode === 'replace_signed' ? 'Reemplazar PDF firmado' : 'Registrar PDF emitido'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(signingAct)} onClose={() => !signing && setSigningAct(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Firma electrónica simple</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              Esta es una firma electrónica simple, sin certificado criptográfico. Al finalizar, el PDF quedará firmado y se deshabilitará la carga de otro PDF firmado.
            </Alert>
            <Box
              component="canvas"
              ref={signatureCanvasRef}
              width={720}
              height={220}
              onPointerDown={handleSignaturePointerDown}
              onPointerMove={handleSignaturePointerMove}
              onPointerUp={handleSignaturePointerUp}
              onPointerLeave={handleSignaturePointerUp}
              sx={{ width: '100%', height: 220, border: '1px solid', borderColor: 'divider', borderRadius: 2, backgroundColor: '#fff', touchAction: 'none', cursor: 'crosshair' }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Button
                size="small"
                onClick={() => {
                  const canvas = signatureCanvasRef.current;
                  const context = canvas?.getContext('2d');
                  if (canvas && context) {
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                  }
                  setSignatureDataUrl('');
                }}
                disabled={signing}
              >
                Limpiar firma
              </Button>
              <Button component="label" size="small" variant="outlined" disabled={signing}>
                Insertar imagen de firma
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    try {
                      setSignatureDataUrl(await signatureFileToDataUrl(file));
                    } catch (error) {
                      setSnackbar({ open: true, message: error instanceof Error ? error.message : 'No se pudo cargar la firma.', severity: 'warning' });
                    }
                  }}
                />
              </Button>
              {signatureDataUrl && <Typography variant="caption" color="success.main">Firma lista para insertar</Typography>}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSigningAct(null)} disabled={signing}>Cancelar</Button>
          <Button variant="contained" startIcon={<DrawOutlinedIcon />} onClick={handleElectronicSignature} disabled={signing || !signatureDataUrl}>
            {signing ? 'Firmando…' : 'Firmar acta'}
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
