import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import { useAuth } from '../auth/AuthContext';
import { getActTemplates, upsertActTemplate } from '../services/api';
import { ACT_COMPANIES, defaultTemplateForCompany } from '../services/actTemplates';
import type { ActTemplate } from '../types';

const ActTemplates = () => {
  const { role, profile } = useAuth();
  const theme = useTheme();
  const isAdmin = role === 'admin';
  const [templates, setTemplates] = useState<ActTemplate[]>([]);
  const [companyId, setCompanyId] = useState<string>(ACT_COMPANIES[0].id);
  const [nit, setNit] = useState('');
  const [saving, setSaving] = useState(false);
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
    void load();
  }, []);

  useEffect(() => {
    const template = selectedTemplate || defaultTemplateForCompany(companyId);
    setNit(template.nit || '');
  }, [companyId, selectedTemplate]);

  const handleSave = async () => {
    if (!isAdmin || !nit.trim()) {
      setSnackbar({ open: true, message: 'Ingrese el NIT de la empresa.', severity: 'warning' });
      return;
    }
    try {
      setSaving(true);
      const current = selectedTemplate || defaultTemplateForCompany(companyId);
      const changed = String(current.nit || '').trim() !== nit.trim();
      await upsertActTemplate(companyId, {
        companyId,
        companyName: selectedCompany.label,
        nit: nit.trim(),
        active: true,
        version: selectedTemplate ? (current.version || 1) + (changed ? 1 : 0) : 1,
      }, profile?.uid);
      setSnackbar({ open: true, message: 'NIT de empresa guardado.', severity: 'success' });
      await load();
    } catch (error) {
      console.error('Save act company details error:', error);
      setSnackbar({ open: true, message: 'No se pudo guardar el NIT de la empresa.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return <Alert severity="error">Solo los administradores pueden configurar los datos de las empresas.</Alert>;

  return (
    <Stack spacing={2.25} sx={{ '& > .MuiCard-root': { borderRadius: '16px' }, '& > .MuiStack-root .MuiButton-root, & > .MuiCard-root .MuiButton-root': { borderRadius: '10px' } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} sx={{ pt: { xs: 0.5, md: 1 }, pb: 0.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'secondary.main' }} />
            <Typography variant="inherit" sx={{ fontSize: '0.69rem', color: 'text.secondary', fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Configuración de actas</Typography>
          </Stack>
          <Typography component="h1" variant="inherit" sx={{ fontWeight: 750, fontSize: { xs: '1.6rem', md: '1.95rem' }, letterSpacing: '-0.035em', lineHeight: 1.15 }}>Empresas para actas</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Administra el NIT de cada empresa utilizado en las actas.
          </Typography>
        </Box>
        <Button component={RouterLink} to="/acts" variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>Volver a actas</Button>
      </Stack>

      <Alert severity="info">
        Ya no es necesario cargar archivos DOCX ni preparar PDFs rellenables. Los formatos fuente se conservan en el proyecto y el acta se diligencia desde el formulario.
      </Alert>

      <Card sx={{ maxWidth: 760, width: '100%' }}>
        <CardContent>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '10px', color: 'secondary.main', bgcolor: alpha(theme.palette.secondary.main, 0.1) }}><BusinessOutlinedIcon fontSize="small" /></Box>
            <Box><Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Datos de la empresa</Typography><Typography variant="caption" color="text.secondary">Selecciona una empresa y revisa el NIT registrado</Typography></Box>
          </Stack>
          <Stack spacing={2}>
            <FormControl fullWidth>
            <InputLabel id="act-template-company-label">Empresa</InputLabel>
            <Select labelId="act-template-company-label" label="Empresa" value={companyId} onChange={(event) => setCompanyId(String(event.target.value))} disabled={saving} fullWidth>
              {ACT_COMPANIES.map((company) => <MenuItem key={company.id} value={company.id}>{company.label}</MenuItem>)}
            </Select>
            </FormControl>
            <TextField label="NIT de la empresa" value={nit} onChange={(event) => setNit(event.target.value)} disabled={saving} fullWidth required />
            <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={handleSave} disabled={saving} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>
              {saving ? 'Guardando…' : 'Guardar NIT'}
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
