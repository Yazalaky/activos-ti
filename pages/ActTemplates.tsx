import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { useAuth } from '../auth/AuthContext';
import { getActTemplates, upsertActTemplate } from '../services/api';
import { uploadFileToStorage } from '../services/storageUpload';
import { ACT_COMPANIES, defaultSignaturePlacement, defaultTemplateForCompany } from '../services/actTemplates';
import type { ActTemplate } from '../types';

const MAX_TEMPLATE_SIZE = 20 * 1024 * 1024;

const ActTemplates = () => {
  const { role, profile } = useAuth();
  const isAdmin = role === 'admin';
  const [templates, setTemplates] = useState<ActTemplate[]>([]);
  const [companyId, setCompanyId] = useState<string>(ACT_COMPANIES[0].id);
  const [nit, setNit] = useState('');
  const [active, setActive] = useState(true);
  const [page, setPage] = useState(String(defaultSignaturePlacement.page));
  const [x, setX] = useState(String(defaultSignaturePlacement.x));
  const [y, setY] = useState(String(defaultSignaturePlacement.y));
  const [width, setWidth] = useState(String(defaultSignaturePlacement.width));
  const [height, setHeight] = useState(String(defaultSignaturePlacement.height));
  const [sourceDocx, setSourceDocx] = useState<File | null>(null);
  const [pdfTemplate, setPdfTemplate] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const selectedCompany = useMemo(() => ACT_COMPANIES.find((item) => item.id === companyId) || ACT_COMPANIES[0], [companyId]);
  const selectedTemplate = useMemo(() => templates.find((item) => item.id === companyId), [templates, companyId]);

  const load = async () => {
    const data = await getActTemplates();
    setTemplates(data);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const template = selectedTemplate || defaultTemplateForCompany(companyId);
    setNit(template.nit || '');
    setActive(template.active !== false);
    setPage(String(template.signaturePlacement?.page || defaultSignaturePlacement.page));
    setX(String(template.signaturePlacement?.x ?? defaultSignaturePlacement.x));
    setY(String(template.signaturePlacement?.y ?? defaultSignaturePlacement.y));
    setWidth(String(template.signaturePlacement?.width ?? defaultSignaturePlacement.width));
    setHeight(String(template.signaturePlacement?.height ?? defaultSignaturePlacement.height));
    setSourceDocx(null);
    setPdfTemplate(null);
  }, [companyId, selectedTemplate]);

  const show = (message: string, severity: 'success' | 'warning' | 'error') => setSnackbar({ open: true, message, severity });

  const validateFile = (file: File, kind: 'docx' | 'pdf') => {
    if (file.size > MAX_TEMPLATE_SIZE) return `El archivo no puede superar ${MAX_TEMPLATE_SIZE / 1024 / 1024} MB.`;
    const name = file.name.toLowerCase();
    if (kind === 'docx' && !name.endsWith('.docx')) return 'La plantilla fuente debe ser un archivo DOCX.';
    if (kind === 'pdf' && file.type !== 'application/pdf' && !name.endsWith('.pdf')) return 'La plantilla operativa debe ser un archivo PDF.';
    return '';
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    if (!nit.trim()) {
      show('Ingrese el NIT de la empresa.', 'warning');
      return;
    }
    const pageNumber = Number(page);
    const xNumber = Number(x);
    const yNumber = Number(y);
    const widthNumber = Number(width);
    const heightNumber = Number(height);
    if (![pageNumber, xNumber, yNumber, widthNumber, heightNumber].every((value) => Number.isFinite(value) && value >= 0) || pageNumber < 1 || widthNumber <= 0 || heightNumber <= 0) {
      show('La posición de firma no es válida.', 'warning');
      return;
    }

    const docxError = sourceDocx ? validateFile(sourceDocx, 'docx') : '';
    const pdfError = pdfTemplate ? validateFile(pdfTemplate, 'pdf') : '';
    if (docxError || pdfError) {
      show(docxError || pdfError, 'warning');
      return;
    }

    let sourceResult: Awaited<ReturnType<typeof uploadFileToStorage>> | undefined;
    let pdfResult: Awaited<ReturnType<typeof uploadFileToStorage>> | undefined;
    try {
      setSaving(true);
      setProgress(0);
      const timestamp = Date.now();
      if (sourceDocx) {
        sourceResult = await uploadFileToStorage(`act-templates/${companyId}/source/${timestamp}-${sourceDocx.name}`, sourceDocx, setProgress);
      }
      if (pdfTemplate) {
        pdfResult = await uploadFileToStorage(`act-templates/${companyId}/pdf/${timestamp}-${pdfTemplate.name}`, pdfTemplate, setProgress);
      }
      const current = selectedTemplate || defaultTemplateForCompany(companyId);
      await upsertActTemplate(companyId, {
        companyId,
        companyName: selectedCompany.label,
        nit: nit.trim(),
        active,
        version: (current.version || 0) + (sourceDocx || pdfTemplate ? 1 : 0),
        sourceDocxPath: sourceResult?.path || current.sourceDocxPath,
        sourceDocxName: sourceResult?.name || current.sourceDocxName,
        pdfTemplateUrl: pdfResult?.url || current.pdfTemplateUrl,
        pdfTemplatePath: pdfResult?.path || current.pdfTemplatePath,
        pdfTemplateName: pdfResult?.name || current.pdfTemplateName,
        signaturePlacement: { page: pageNumber, x: xNumber, y: yNumber, width: widthNumber, height: heightNumber },
      }, profile?.uid);
      show('Configuración de plantilla guardada.', 'success');
      await load();
    } catch (error) {
      console.error('Save act template error:', error);
      show('No se pudo guardar la plantilla. Verifique los permisos y el formato de los archivos.', 'error');
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  if (!isAdmin) {
    return <Alert severity="error">Solo los administradores pueden cargar o reemplazar plantillas de actas.</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Plantillas de actas</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Configura una plantilla general por empresa. El DOCX se conserva como fuente y el PDF rellenable se utiliza para generar las actas.
        </Typography>
      </Box>

      <Alert severity="info">
        El PDF operativo debe ser un PDF rellenable con campos estándar como <strong>recipient_full_name</strong>, <strong>asset_fixed_id</strong>, <strong>asset_serial</strong> y <strong>observations</strong>. Un PDF visual sin campos no puede diligenciarse automáticamente.
      </Alert>

      <Card>
        <CardContent>
          <Stack spacing={2.25}>
            <Select value={companyId} onChange={(event) => setCompanyId(String(event.target.value))} disabled={saving} fullWidth>
              {ACT_COMPANIES.map((company) => <MenuItem key={company.id} value={company.id}>{company.label}</MenuItem>)}
            </Select>

            <TextField label="NIT de la empresa" value={nit} onChange={(event) => setNit(event.target.value)} disabled={saving} fullWidth required />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled={saving} fullWidth>
                  {sourceDocx?.name || selectedTemplate?.sourceDocxName || `${selectedCompany.sourceName} (DOCX)`}
                  <input hidden type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setSourceDocx(event.target.files?.[0] || null)} />
                </Button>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Button component="label" variant="outlined" color="secondary" startIcon={<UploadFileOutlinedIcon />} disabled={saving} fullWidth>
                  {pdfTemplate?.name || selectedTemplate?.pdfTemplateName || 'PDF rellenable operativo'}
                  <input hidden type="file" accept="application/pdf,.pdf" onChange={(event) => setPdfTemplate(event.target.files?.[0] || null)} />
                </Button>
              </Grid>
            </Grid>

            <Typography variant="caption" color="text.secondary">
              Archivo fuente: {selectedTemplate?.sourceDocxUrl ? 'configurado' : 'pendiente'} · PDF operativo: {selectedTemplate?.pdfTemplateUrl ? 'configurado' : 'pendiente'}
            </Typography>

            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Ubicación de la firma electrónica</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 2.4 }}><TextField label="Página" type="number" value={page} onChange={(e) => setPage(e.target.value)} fullWidth /></Grid>
              <Grid size={{ xs: 6, md: 2.4 }}><TextField label="X" type="number" value={x} onChange={(e) => setX(e.target.value)} fullWidth /></Grid>
              <Grid size={{ xs: 6, md: 2.4 }}><TextField label="Y" type="number" value={y} onChange={(e) => setY(e.target.value)} fullWidth /></Grid>
              <Grid size={{ xs: 6, md: 2.4 }}><TextField label="Ancho" type="number" value={width} onChange={(e) => setWidth(e.target.value)} fullWidth /></Grid>
              <Grid size={{ xs: 12, md: 2.4 }}><TextField label="Alto" type="number" value={height} onChange={(e) => setHeight(e.target.value)} fullWidth /></Grid>
            </Grid>

            {saving && <LinearProgress variant={progress ? 'determinate' : 'indeterminate'} value={progress} />}
            <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={handleSave} disabled={saving}>
              Guardar configuración
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Stack>
  );
};

export default ActTemplates;
