import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useAuth } from '../auth/AuthContext';
import { getActTemplates, upsertActTemplate } from '../services/api';
import { ACT_COMPANIES, defaultTemplateForCompany } from '../services/actTemplates';
import type { ActTemplate } from '../types';

const ActTemplates = () => {
  const { role, profile } = useAuth();
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
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Empresas para actas</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          El formato común y los logos ya están integrados al sistema. Aquí solo se administra el NIT que se imprime en el acta.
        </Typography>
      </Box>

      <Alert severity="info">
        Ya no es necesario cargar archivos DOCX ni preparar PDFs rellenables. Los formatos fuente se conservan en el proyecto y el acta se diligencia desde el formulario.
      </Alert>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Select value={companyId} onChange={(event) => setCompanyId(String(event.target.value))} disabled={saving} fullWidth>
              {ACT_COMPANIES.map((company) => <MenuItem key={company.id} value={company.id}>{company.label}</MenuItem>)}
            </Select>
            <TextField label="NIT de la empresa" value={nit} onChange={(event) => setNit(event.target.value)} disabled={saving} fullWidth required />
            <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={handleSave} disabled={saving}>
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
