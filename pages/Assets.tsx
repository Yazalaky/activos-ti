import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
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
  IconButton,
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
  Tooltip,
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { addAsset, getAssets, getSites, moveAssetToSite, updateAsset } from '../services/api';
import type { Asset, AssetType, Assignment, Site, Status } from '../types';
import { uploadFileToStorage } from '../services/storageUpload';
import { useAuth } from '../auth/AuthContext';
import { deleteStoragePath } from '../services/storageFiles';

const statusLabel: Record<Status, string> = {
  bodega: 'Bodega',
  asignado: 'Asignado',
  mantenimiento: 'Mantenimiento',
  baja: 'De baja',
};

const statusColor = (status: Status) => {
  switch (status) {
    case 'asignado':
      return 'success';
    case 'bodega':
      return 'info';
    case 'mantenimiento':
      return 'warning';
    case 'baja':
      return 'error';
    default:
      return 'default';
  }
};

type AssetTableProps = {
  assets: Asset[];
  sites: Site[];
  canWrite: boolean;
  onView: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onAssign: (asset: Asset) => void;
  onReturn: (asset: Asset) => void;
};

const AssetTable = React.memo(function AssetTable({ assets, sites, canWrite, onView, onEdit, onAssign, onReturn }: AssetTableProps) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 800 }}>Activo fijo / Tipo</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Equipo</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Ubicación</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Hardware</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
          <TableCell sx={{ fontWeight: 800 }} align="right">
            Acciones
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {assets.map((asset) => {
          const siteName = sites.find((s) => s.id === asset.siteId)?.name || 'Sin sede';
          const hardware =
            asset.type === 'laptop' || asset.type === 'desktop'
              ? [asset.processor && `CPU: ${asset.processor}`, asset.ram && `RAM: ${asset.ram}`, asset.storage && `DISCO: ${asset.storage}`]
                  .filter(Boolean)
                  .join(' · ')
              : '—';

          return (
            <TableRow key={asset.id} hover>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'primary.main' }}>
                  {asset.fixedAssetId || 'PEND'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  {asset.type}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {asset.brand} {asset.model}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  S/N: {asset.serial}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{siteName}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {hardware || '—'}
                </Typography>
              </TableCell>
              <TableCell>
                <Stack spacing={0.5}>
                  <Chip label={statusLabel[asset.status]} color={statusColor(asset.status) as any} sx={{ fontWeight: 800, width: 'fit-content' }} />
                  {asset.currentAssignment && (
                    <Chip size="small" variant="outlined" label={asset.currentAssignment.assignedToName} sx={{ width: 'fit-content' }} />
                  )}
                </Stack>
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Tooltip title="Ver detalle">
                    <IconButton onClick={() => onView(asset)} aria-label="Ver" size="small">
                      <VisibilityOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                  {canWrite && (
                    <>
                      <Tooltip title="Editar">
                        <IconButton onClick={() => onEdit(asset)} aria-label="Editar" size="small">
                          <EditOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                      {asset.status === 'bodega' && (
                        <Tooltip title="Asignar">
                          <IconButton onClick={() => onAssign(asset)} aria-label="Asignar" size="small">
                            <PersonAddAltOutlinedIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {asset.status === 'asignado' && (
                        <Tooltip title="Retornar a bodega">
                          <IconButton onClick={() => onReturn(asset)} aria-label="Retornar" size="small">
                            <KeyboardReturnOutlinedIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          );
        })}

        {assets.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} sx={{ py: 6 }}>
              <Typography variant="body2" color="text.secondary" align="center">
                No se encontraron activos.
              </Typography>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
});

const Assets = () => {
  const { role } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [filterText, setFilterText] = useState('');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<AssetType | ''>('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | 'view'>('create');
  const [moveSiteOpen, setMoveSiteOpen] = useState(false);
  const [moveSiteId, setMoveSiteId] = useState('');
  const [movingSite, setMovingSite] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignAsset, setAssignAsset] = useState<Asset | null>(null);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnAsset, setReturnAsset] = useState<Asset | null>(null);

  const [deleteImageOpen, setDeleteImageOpen] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'warning',
  });

  const initialFormState: Partial<Asset> = {
    type: 'laptop',
    status: 'bodega',
    siteId: '',
    brand: '',
    model: '',
    serial: '',
    purchaseDate: '',
    cost: 0,
    processor: '',
    ram: '',
    storage: '',
    os: '',
    monitorBrand: '',
    monitorSize: '',
    monitorSerial: '',
    notes: '',
    imageUrl: '',
  };

  const [formData, setFormData] = useState<Partial<Asset>>(initialFormState);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploadPct, setImageUploadPct] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const [assignmentData, setAssignmentData] = useState({ name: '', position: '' });
  const [inlineAssignment, setInlineAssignment] = useState({ name: '', position: '' });

  const clearFilters = () => {
    setFilterText('');
    setSelectedSiteFilter('');
    setSelectedTypeFilter('');
  };

  const loadData = async () => {
    const [a, s] = await Promise.all([getAssets(), getSites()]);
    setAssets(a);
    setSites(s);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAssets = useMemo(() => {
    const search = filterText.trim().toLowerCase();
    return assets.filter((a) => {
      const assignedTo = a.currentAssignment?.assignedToName?.toLowerCase?.() || '';
      const matchesText =
        !search ||
        a.serial.toLowerCase().includes(search) ||
        a.model.toLowerCase().includes(search) ||
        (a.fixedAssetId && a.fixedAssetId.toLowerCase().includes(search)) ||
        (assignedTo && assignedTo.includes(search));
      const matchesSite = selectedSiteFilter ? a.siteId === selectedSiteFilter : true;
      const matchesType = selectedTypeFilter ? a.type === selectedTypeFilter : true;
      return matchesText && matchesSite && matchesType;
    });
  }, [assets, filterText, selectedSiteFilter, selectedTypeFilter]);

  const nextFixedIdPreview = useMemo(() => {
    if (!formData.siteId) return '';
    const site = sites.find((s) => s.id === formData.siteId);
    if (!site) return '';
    const nextSeq = (site.assetSeq ?? 0) + 1;
    return `${site.prefix}-${String(nextSeq).padStart(3, '0')}`;
  }, [formData.siteId, sites]);

  const isComputer = formData.type === 'laptop' || formData.type === 'desktop';
  const isDesktop = formData.type === 'desktop';
  const isViewMode = editorMode === 'view';
  const readOnly = !canWrite || isViewMode;

  const openCreate = () => {
    setEditingId(null);
    setEditorMode('create');
    setFormData(initialFormState);
    setInlineAssignment({ name: '', position: '' });
    setPreviewImage(null);
    setImageFile(null);
    setImageUploadPct(0);
    setEditorOpen(true);
  };

  const openEdit = useCallback((asset: Asset) => {
    setEditingId(asset.id);
    setEditorMode('edit');
    setFormData(asset);
    setInlineAssignment({
      name: asset.currentAssignment?.assignedToName ?? '',
      position: asset.currentAssignment?.assignedToPosition ?? '',
    });
    setMoveSiteId(asset.siteId);
    setPreviewImage(asset.imageUrl || null);
    setImageFile(null);
    setImageUploadPct(0);
    setEditorOpen(true);
  }, []);

  const openView = useCallback((asset: Asset) => {
    setEditingId(asset.id);
    setEditorMode('view');
    setFormData(asset);
    setInlineAssignment({
      name: asset.currentAssignment?.assignedToName ?? '',
      position: asset.currentAssignment?.assignedToPosition ?? '',
    });
    setMoveSiteId(asset.siteId);
    setPreviewImage(asset.imageUrl || null);
    setImageFile(null);
    setImageUploadPct(0);
    setEditorOpen(true);
  }, []);

  const closeEditor = () => {
    if (previewImage?.startsWith('blob:')) {
      URL.revokeObjectURL(previewImage);
    }
    setEditorOpen(false);
    setEditingId(null);
    setEditorMode('create');
    setFormData(initialFormState);
    setInlineAssignment({ name: '', position: '' });
    setMoveSiteOpen(false);
    setMoveSiteId('');
    setMovingSite(false);
    setPreviewImage(null);
    setImageFile(null);
    setImageUploadPct(0);
    setSaving(false);
  };

  const openMoveSite = () => {
    if (!editingId) return;
    setMoveSiteId(String(formData.siteId || ''));
    setMoveSiteOpen(true);
  };

  const handleConfirmMoveSite = async () => {
    if (!editingId) return;
    const nextSiteId = String(moveSiteId || '').trim();
    if (!nextSiteId) {
      setSnackbar({ open: true, message: 'Seleccione una sede.', severity: 'warning' });
      return;
    }
    if (nextSiteId === String(formData.siteId || '')) {
      setMoveSiteOpen(false);
      return;
    }

    try {
      setMovingSite(true);
      const result = await moveAssetToSite(editingId, nextSiteId);
      if (result.changed) {
        setFormData((prev) => ({
          ...prev,
          siteId: result.siteId,
          fixedAssetId: result.fixedAssetId,
        }));
        setSnackbar({ open: true, message: `Sede actualizada. Nuevo código: ${result.fixedAssetId}`, severity: 'success' });
        loadData();
      }
      setMoveSiteOpen(false);
    } catch (error) {
      console.error('Move site error:', error);
      setSnackbar({ open: true, message: 'No se pudo cambiar la sede del activo.', severity: 'error' });
    } finally {
      setMovingSite(false);
    }
  };

  const handleImageChange = (file?: File) => {
    if (!file) return;
    if (previewImage?.startsWith('blob:')) {
      URL.revokeObjectURL(previewImage);
    }
    setImageFile(file);
    setImageUploadPct(0);
    setPreviewImage(URL.createObjectURL(file));
  };

  const clearSelectedImage = () => {
    if (previewImage?.startsWith('blob:')) {
      URL.revokeObjectURL(previewImage);
    }
    setImageFile(null);
    setImageUploadPct(0);
    setPreviewImage(formData.imageUrl || null);
  };

  const handleDeleteImage = async () => {
    if (!canWrite) return;
    if (!editingId) {
      clearSelectedImage();
      setFormData((prev) => ({ ...prev, imageUrl: '', imagePath: '' }));
      setDeleteImageOpen(false);
      return;
    }

    try {
      setSaving(true);
      const path = String(formData.imagePath || '').trim();
      if (path) {
        await deleteStoragePath(path);
      }
      await updateAsset(editingId, { imageUrl: null, imagePath: null } as any);
      setFormData((prev) => ({ ...prev, imageUrl: '', imagePath: '' }));
      setPreviewImage(null);
      setImageFile(null);
      setSnackbar({ open: true, message: 'Imagen eliminada.', severity: 'success' });
    } catch (error) {
      console.error('Delete asset image error:', error);
      setSnackbar({ open: true, message: 'No se pudo eliminar la imagen.', severity: 'error' });
    } finally {
      setSaving(false);
      setDeleteImageOpen(false);
    }
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    if (!formData.siteId) {
      setSnackbar({ open: true, message: 'Seleccione una sede.', severity: 'warning' });
      return;
    }
    if (!formData.brand || !formData.model || !formData.serial) {
      setSnackbar({ open: true, message: 'Complete marca, modelo y serial.', severity: 'warning' });
      return;
    }
    if (formData.status === 'asignado') {
      if (!inlineAssignment.name.trim() || !inlineAssignment.position.trim()) {
        setSnackbar({ open: true, message: 'Para estado Asignado, complete Nombre completo y Cargo.', severity: 'warning' });
        return;
      }
    }

    const dataToSave: any = { ...formData };

    if (dataToSave.type !== 'desktop') {
      delete dataToSave.monitorBrand;
      delete dataToSave.monitorSize;
      delete dataToSave.monitorSerial;
    }
    if (dataToSave.type !== 'laptop' && dataToSave.type !== 'desktop') {
      delete dataToSave.processor;
      delete dataToSave.ram;
      delete dataToSave.storage;
      delete dataToSave.os;
    }

    if (dataToSave.status === 'asignado') {
      const existingAssignedAt = dataToSave.currentAssignment?.assignedAt;
      dataToSave.currentAssignment = {
        assignedToName: inlineAssignment.name.trim(),
        assignedToPosition: inlineAssignment.position.trim(),
        assignedAt: typeof existingAssignedAt === 'number' ? existingAssignedAt : Date.now(),
      };
    } else {
      dataToSave.currentAssignment = null;
    }

    try {
      setSaving(true);

      if (editingId) {
        const { id, fixedAssetId, createdAt, ...updatePayload } = dataToSave;

        if (imageFile) {
          const prevPath = String(formData.imagePath || '').trim();
          const ts = Date.now();
          const result = await uploadFileToStorage(
            `assets/${editingId}/photos/${ts}-${imageFile.name}`,
            imageFile,
            setImageUploadPct
          );
          updatePayload.imageUrl = result.url;
          updatePayload.imagePath = result.path;

          // Best-effort cleanup of previous image
          if (prevPath && prevPath !== result.path) {
            deleteStoragePath(prevPath).catch(() => undefined);
          }
        }

        await updateAsset(editingId, updatePayload);
        setSnackbar({ open: true, message: 'Activo actualizado.', severity: 'success' });
      } else {
        const { id, fixedAssetId, createdAt, imageUrl, imagePath, ...createPayload } = dataToSave;
        const docRef: any = await addAsset(createPayload as any);

        if (imageFile) {
          const ts = Date.now();
          const result = await uploadFileToStorage(
            `assets/${docRef.id}/photos/${ts}-${imageFile.name}`,
            imageFile,
            setImageUploadPct
          );
          await updateAsset(docRef.id, { imageUrl: result.url, imagePath: result.path });
        }

        setSnackbar({ open: true, message: 'Activo creado.', severity: 'success' });
      }
      closeEditor();
      loadData();
    } catch (error) {
      console.error('Error saving asset:', error);
      setSnackbar({ open: true, message: 'No se pudo guardar el activo.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openAssign = useCallback((asset: Asset) => {
    setAssignAsset(asset);
    setAssignmentData({ name: '', position: '' });
    setAssignOpen(true);
  }, []);

  const handleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignAsset) return;

    if (!assignmentData.name || !assignmentData.position) {
      setSnackbar({ open: true, message: 'Complete nombre completo y cargo.', severity: 'warning' });
      return;
    }

    const newAssignment: Assignment = {
      assignedToName: assignmentData.name,
      assignedToPosition: assignmentData.position,
      assignedAt: Date.now(),
    };

    await updateAsset(assignAsset.id, {
      status: 'asignado',
      currentAssignment: newAssignment,
    });

    setAssignOpen(false);
    setAssignAsset(null);
    setSnackbar({ open: true, message: 'Activo asignado.', severity: 'success' });
    loadData();
  };

  const confirmReturn = useCallback((asset: Asset) => {
    setReturnAsset(asset);
    setReturnOpen(true);
  }, []);

  const handleReturn = async () => {
    if (!returnAsset) return;
    await updateAsset(returnAsset.id, { status: 'bodega', currentAssignment: null });
    setReturnOpen(false);
    setReturnAsset(null);
    setSnackbar({ open: true, message: 'Activo retornado a bodega.', severity: 'success' });
    loadData();
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Inventario de activos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Gestión de equipos, asignaciones y estados
          </Typography>
        </Box>

        {canWrite && (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>
            Nuevo activo
          </Button>
        )}
      </Stack>

      <Card>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Buscar"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Serial, activo fijo, modelo..."
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
                <InputLabel id="filter-site">Sede</InputLabel>
                <Select
                  labelId="filter-site"
                  label="Sede"
                  value={selectedSiteFilter}
                  onChange={(e) => setSelectedSiteFilter(String(e.target.value))}
                  startAdornment={
                    <InputAdornment position="start">
                      <FilterAltOutlinedIcon />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="">Todas</MenuItem>
                  {sites.map((site) => (
                    <MenuItem key={site.id} value={site.id}>
                      {site.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="filter-type">Tipo</InputLabel>
                <Select
                  labelId="filter-type"
                  label="Tipo"
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value as AssetType | '')}
                  startAdornment={
                    <InputAdornment position="start">
                      <FilterAltOutlinedIcon />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="laptop">Laptop</MenuItem>
                  <MenuItem value="desktop">Desktop</MenuItem>
                  <MenuItem value="monitor">Monitor</MenuItem>
                  <MenuItem value="keyboard">Teclado</MenuItem>
                  <MenuItem value="mouse">Mouse</MenuItem>
                  <MenuItem value="printer">Impresora</MenuItem>
                  <MenuItem value="scanner">Scanner</MenuItem>
                  <MenuItem value="network">Red</MenuItem>
                  <MenuItem value="other">Otro</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {(filterText || selectedSiteFilter || selectedTypeFilter) && (
              <Grid size={{ xs: 12, md: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="text"
                  color="error"
                  startIcon={<DeleteOutlineOutlinedIcon />}
                  onClick={clearFilters}
                >
                  Limpiar
                </Button>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <AssetTable
            assets={filteredAssets}
            sites={sites}
            canWrite={canWrite}
            onView={openView}
            onEdit={openEdit}
            onAssign={openAssign}
            onReturn={confirmReturn}
          />
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onClose={closeEditor} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {isViewMode ? 'Detalle del activo' : editingId ? 'Editar activo' : 'Registrar nuevo activo'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSaveAsset} sx={{ mt: 1 }}>
            {!canWrite && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Modo solo lectura (Gerencia/Auditoría). No puedes crear o editar activos.
              </Alert>
            )}
            {isViewMode && canWrite && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Vista rápida (solo lectura). Para modificar, usa el botón Editar en la tabla.
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Información general
                </Typography>

                <FormControl fullWidth required sx={{ mb: 2 }}>
                  <InputLabel id="asset-site-label">Sede</InputLabel>
                  <Select
                    labelId="asset-site-label"
                    label="Sede"
                    value={formData.siteId || ''}
                    onChange={(e) => setFormData({ ...formData, siteId: String(e.target.value) })}
                    disabled={readOnly || !!editingId}
                  >
                    <MenuItem value="">Seleccione...</MenuItem>
                    {sites.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name} ({s.prefix})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {editingId && !readOnly && (
                  <Button variant="text" size="small" onClick={openMoveSite} sx={{ mb: 2, alignSelf: 'flex-start' }}>
                    Cambiar sede…
                  </Button>
                )}

                {!editingId && formData.siteId && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Se generará código: <strong>{nextFixedIdPreview || '—'}</strong>
                  </Alert>
                )}

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="asset-type-label">Tipo</InputLabel>
                  <Select
                    labelId="asset-type-label"
                    label="Tipo"
                    value={formData.type || 'laptop'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as AssetType })}
                    disabled={readOnly}
                  >
                    <MenuItem value="laptop">Laptop</MenuItem>
                    <MenuItem value="desktop">Desktop</MenuItem>
                    <MenuItem value="monitor">Monitor</MenuItem>
                    <MenuItem value="keyboard">Teclado</MenuItem>
                    <MenuItem value="mouse">Mouse</MenuItem>
                    <MenuItem value="printer">Impresora</MenuItem>
                    <MenuItem value="scanner">Scanner</MenuItem>
                    <MenuItem value="network">Red</MenuItem>
                    <MenuItem value="other">Otro</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="asset-status-label">Estado</InputLabel>
                  <Select
                    labelId="asset-status-label"
                    label="Estado"
                    value={formData.status || 'bodega'}
                    onChange={(e) => {
                      const nextStatus = e.target.value as Status;
                      setFormData((prev) => ({
                        ...prev,
                        status: nextStatus,
                        ...(nextStatus !== 'asignado' ? { currentAssignment: null } : {}),
                      }));
                      if (nextStatus !== 'asignado') {
                        setInlineAssignment({ name: '', position: '' });
                      }
                    }}
                    disabled={readOnly}
                  >
                    <MenuItem value="bodega">Bodega</MenuItem>
                    <MenuItem value="asignado">Asignado</MenuItem>
                    <MenuItem value="mantenimiento">Mantenimiento</MenuItem>
                    <MenuItem value="baja">De baja</MenuItem>
                  </Select>
                </FormControl>

                {formData.status === 'asignado' && (
                  <Box
                    sx={{
                      mb: 2,
                      p: 2,
                      borderRadius: 4,
                      bgcolor: 'rgba(0,0,0,0.02)',
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                      Asignación
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        label="Nombre completo"
                        value={inlineAssignment.name}
                        onChange={(e) => setInlineAssignment((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        fullWidth
                        disabled={readOnly}
                      />
                      <TextField
                        label="Cargo"
                        value={inlineAssignment.position}
                        onChange={(e) => setInlineAssignment((prev) => ({ ...prev, position: e.target.value }))}
                        required
                        fullWidth
                        disabled={readOnly}
                      />
                    </Stack>
                  </Box>
                )}

                <TextField
                  label="Marca"
                  value={formData.brand || ''}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  required
                  fullWidth
                  disabled={readOnly}
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Modelo"
                  value={formData.model || ''}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  required
                  fullWidth
                  disabled={readOnly}
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Serial"
                  value={formData.serial || ''}
                  onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                  required
                  fullWidth
                  disabled={readOnly}
                  sx={{ mb: 2 }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Compra y costos
                </Typography>
                <TextField
                  label="Fecha compra"
                  type="date"
                  value={formData.purchaseDate || ''}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  disabled={readOnly}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Costo"
                  type="number"
                  value={formData.cost ?? ''}
                  onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                  disabled={readOnly}
                  fullWidth
                  sx={{ mb: 2 }}
                />

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Hardware (computadores)
                </Typography>
                <TextField
                  label="Procesador"
                  value={formData.processor || ''}
                  onChange={(e) => setFormData({ ...formData, processor: e.target.value })}
                  fullWidth
                  disabled={readOnly || !isComputer}
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="RAM"
                  value={formData.ram || ''}
                  onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                  fullWidth
                  disabled={readOnly || !isComputer}
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Almacenamiento"
                  value={formData.storage || ''}
                  onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                  fullWidth
                  disabled={readOnly || !isComputer}
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Sistema operativo"
                  value={formData.os || ''}
                  onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                  fullWidth
                  disabled={readOnly || !isComputer}
                />

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Monitor (solo desktop)
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Marca monitor"
                      value={formData.monitorBrand || ''}
                      onChange={(e) => setFormData({ ...formData, monitorBrand: e.target.value })}
                      fullWidth
                      disabled={readOnly || !isDesktop}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Tamaño"
                      value={formData.monitorSize || ''}
                      onChange={(e) => setFormData({ ...formData, monitorSize: e.target.value })}
                      fullWidth
                      disabled={readOnly || !isDesktop}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Serial monitor"
                      value={formData.monitorSerial || ''}
                      onChange={(e) => setFormData({ ...formData, monitorSerial: e.target.value })}
                      fullWidth
                      disabled={readOnly || !isDesktop}
                    />
                  </Grid>
                </Grid>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Evidencia y notas
                </Typography>

                {(saving && imageFile) && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Subiendo imagen… {imageUploadPct}%
                    </Typography>
                    <LinearProgress variant="determinate" value={imageUploadPct} sx={{ mt: 0.5, borderRadius: 99 }} />
                  </Box>
                )}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                  <Avatar
                    variant="rounded"
                    src={previewImage || undefined}
                    sx={{ width: 96, height: 96, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.06)' }}
                  />
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                    sx={{ minWidth: 0, width: { xs: '100%', sm: 'auto' } }}
                  >
                    {!readOnly && (
                      <Button component="label" variant="outlined" startIcon={<PhotoCameraOutlinedIcon />} disabled={saving}>
                        {formData.imageUrl || imageFile ? 'Reemplazar foto' : 'Cargar foto'}
                        <input hidden type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files?.[0])} />
                      </Button>
                    )}

                    {(formData.imageUrl || previewImage) && (
                      <Tooltip title="Ver foto">
                        <IconButton
                          aria-label="Ver foto"
                          onClick={() => {
                            const url = previewImage || formData.imageUrl;
                            if (url) window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <OpenInNewOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    )}

                    {!readOnly && (formData.imageUrl || imageFile) && (
                      <Tooltip title="Eliminar foto">
                        <IconButton
                          aria-label="Eliminar foto"
                          color="error"
                          disabled={saving}
                          onClick={() => setDeleteImageOpen(true)}
                        >
                          <DeleteOutlineOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Stack>

                <TextField
                  label="Notas"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  fullWidth
                  multiline
                  minRows={4}
                  disabled={readOnly}
                  sx={{ mt: 2 }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <DialogActions sx={{ px: 0 }}>
              <Button onClick={closeEditor}>{readOnly ? 'Cerrar' : 'Cancelar'}</Button>
              {!readOnly && (
                <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={saving}>
                  {editingId ? 'Actualizar' : 'Guardar'}
                </Button>
              )}
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Asignar activo</DialogTitle>
        <DialogContent>
          {assignAsset && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {assignAsset.brand} {assignAsset.model} ({assignAsset.fixedAssetId})
            </Alert>
          )}
	          <Box component="form" onSubmit={handleAssignment}>
	            <Stack spacing={2} sx={{ mt: 1 }}>
	              <TextField
	                label="Nombre completo"
	                value={assignmentData.name}
	                onChange={(e) => setAssignmentData({ ...assignmentData, name: e.target.value })}
	                required
	                fullWidth
	              />
	              <TextField
	                label="Cargo"
	                value={assignmentData.position}
	                onChange={(e) => setAssignmentData({ ...assignmentData, position: e.target.value })}
	                required
	                fullWidth
	              />
	            </Stack>

            <DialogActions sx={{ px: 0, mt: 2 }}>
              <Button onClick={() => setAssignOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="contained" startIcon={<PersonAddAltOutlinedIcon />}>
                Confirmar
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onClose={() => setReturnOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>Retornar a bodega</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            ¿Confirmas retornar este activo a bodega?
          </Typography>
          {returnAsset && (
            <Typography variant="subtitle2" sx={{ fontWeight: 900, mt: 1 }}>
              {returnAsset.fixedAssetId} · {returnAsset.brand} {returnAsset.model}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="warning" onClick={handleReturn} startIcon={<KeyboardReturnOutlinedIcon />}>
            Retornar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteImageOpen} onClose={() => setDeleteImageOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>Eliminar foto</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            ¿Confirmas eliminar la foto del activo?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteImageOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDeleteImage} disabled={!canWrite || saving}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moveSiteOpen} onClose={() => setMoveSiteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Cambiar sede</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Cambiar la sede genera un nuevo consecutivo (código de activo fijo) para la sede destino. El código anterior se conserva como historial.
          </Alert>
          <FormControl fullWidth>
            <InputLabel id="move-site-label">Nueva sede</InputLabel>
            <Select
              labelId="move-site-label"
              label="Nueva sede"
              value={moveSiteId}
              onChange={(e) => setMoveSiteId(String(e.target.value))}
              disabled={movingSite}
            >
              {sites.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s.prefix})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Actual: {String(formData.siteId || '—')} · Código: {String((formData as any).fixedAssetId || '—')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveSiteOpen(false)} disabled={movingSite}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleConfirmMoveSite} disabled={movingSite}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '', severity: 'warning' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ open: false, message: '', severity: 'warning' })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default Assets;
