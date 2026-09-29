import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
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
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { addAsset, bulkDecommissionAssetsForSite, decommissionAsset, getAssets, getSites, moveAssetToSite, updateAsset, getMaintenances } from '../services/api';
import type { Asset, AssetType, Assignment, Site, Status, Maintenance } from '../types';
import { uploadFileToStorage } from '../services/storageUpload';
import { useAuth } from '../auth/AuthContext';
import { deleteStoragePath } from '../services/storageFiles';
import { exportToCsv } from '../utils/exportCsv';
import { printReport } from '../utils/printReport';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';

const statusLabel: Record<Status, string> = {
  bodega: 'Bodega',
  asignado: 'Asignado',
  mantenimiento: 'Mantenimiento',
  baja: 'De baja',
};

const MAX_ASSET_IMAGE_SIZE = 5 * 1024 * 1024;
const supportedAssetImageExtensions = /\.(avif|gif|jpe?g|png|webp)$/i;

const getAssetImageValidationMessage = (file?: File | null) => {
  if (!file) return '';
  const isImage = file.type.startsWith('image/') || supportedAssetImageExtensions.test(file.name);
  if (!isImage) return 'La foto debe ser una imagen válida (JPG, PNG, WEBP, GIF o AVIF).';
  if (file.size >= MAX_ASSET_IMAGE_SIZE) return 'La foto debe pesar menos de 5 MB.';
  return '';
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

const assetReportColumns = [
  { key: 'ActivoFijo', label: 'Activo fijo' },
  { key: 'Tipo', label: 'Tipo' },
  { key: 'Marca', label: 'Marca' },
  { key: 'Modelo', label: 'Modelo' },
  { key: 'Serial', label: 'Serial' },
  { key: 'Sede', label: 'Sede' },
  { key: 'Estado', label: 'Estado' },
  { key: 'AsignadoA', label: 'Asignado a' },
  { key: 'Cargo', label: 'Cargo' },
  { key: 'Costo', label: 'Costo' },
  { key: 'MotivoBaja', label: 'Motivo de baja' },
  { key: 'FechaBaja', label: 'Fecha de baja' },
] as const;

type AssetTableProps = {
  assets: Asset[];
  sites: Site[];
  canWrite: boolean;
  onView: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onAssign: (asset: Asset) => void;
  onReturn: (asset: Asset) => void;
  onDecommission: (asset: Asset) => void;
};

const AssetTable = React.memo(function AssetTable({ assets, sites, canWrite, onView, onEdit, onAssign, onReturn, onDecommission }: AssetTableProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const visibleAssets = assets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  useEffect(() => {
    setPage(0);
  }, [assets]);

  return (
    <>
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
        {visibleAssets.map((asset) => {
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
                  {asset.status === 'baja' && asset.decommissionReason && (
                    <Typography variant="caption" color="error.main" sx={{ maxWidth: 220 }}>
                      {asset.decommissionReason}
                    </Typography>
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
                      {canWrite && asset.status !== 'baja' && (
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
                      <Button
                        onClick={() => onDecommission(asset)}
                        aria-label="Dar de baja"
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<BlockOutlinedIcon />}
                        sx={{ minWidth: 0 }}
                      >
                        Baja
                      </Button>
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
    <TablePagination
      component="div"
      count={assets.length}
      page={page}
      rowsPerPage={rowsPerPage}
      rowsPerPageOptions={[25, 50, 100]}
      labelRowsPerPage="Filas por página"
      onPageChange={(_event, nextPage) => setPage(nextPage)}
      onRowsPerPageChange={(event) => {
        setRowsPerPage(Number(event.target.value));
        setPage(0);
      }}
    />
    </>
  );
});

const Assets = () => {
  const { role, profile } = useAuth();
  const canWrite = role === 'admin' || role === 'tech';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [filterText, setFilterText] = useState('');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<AssetType | ''>('');
  const [assetViewFilter, setAssetViewFilter] = useState<'active' | 'baja' | 'all'>('active');
  const deferredFilterText = useDeferredValue(filterText);

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
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [decommissionOpen, setDecommissionOpen] = useState(false);
  const [decommissionTarget, setDecommissionTarget] = useState<Asset | null>(null);
  const [decommissionReason, setDecommissionReason] = useState('');
  const [decommissionSaving, setDecommissionSaving] = useState(false);

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

  const [assignmentData, setAssignmentData] = useState({ name: '', position: '', responsible: '' });
  const [inlineAssignment, setInlineAssignment] = useState({ name: '', position: '', responsible: '' });

  const [assetMaintenances, setAssetMaintenances] = useState<Maintenance[]>([]);
  const loadMaintenances = useCallback(async (assetId: string) => {
    const all = await getMaintenances();
    const forAsset = all.filter(m => m.assetId === assetId && !m.isDeleted).sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || ''));
    setAssetMaintenances(forAsset.slice(0, 3)); // top 3
  }, []);

  const clearFilters = () => {
    setFilterText('');
    setSelectedSiteFilter('');
    setSelectedTypeFilter('');
    setAssetViewFilter('active');
  };

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteFilter) || null,
    [sites, selectedSiteFilter]
  );

  const bodegaAssetsForSite = useMemo(
    () => assets.filter((asset) => asset.siteId === selectedSiteFilter && asset.status === 'bodega'),
    [assets, selectedSiteFilter]
  );

  const bulkConfirmPhrase = useMemo(() => {
    const prefix = selectedSite?.prefix ? selectedSite.prefix.toUpperCase() : '';
    return prefix ? `DAR DE BAJA ${prefix}` : 'DAR DE BAJA';
  }, [selectedSite]);

  const loadData = async () => {
    const [a, s] = await Promise.all([getAssets(), getSites()]);
    setAssets(a);
    setSites(s);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAssets = useMemo(() => {
    const search = deferredFilterText.trim().toLowerCase();
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
      const matchesView =
        assetViewFilter === 'all' ||
        (assetViewFilter === 'baja' ? a.status === 'baja' : a.status !== 'baja');
      return matchesText && matchesSite && matchesType && matchesView;
    });
  }, [assets, deferredFilterText, selectedSiteFilter, selectedTypeFilter, assetViewFilter]);

  const inventoryReportRows = useMemo(
    () => filteredAssets.map((asset) => {
      const site = sites.find((siteItem) => siteItem.id === asset.siteId);
      return {
        ActivoFijo: asset.fixedAssetId,
        Tipo: asset.type,
        Marca: asset.brand,
        Modelo: asset.model,
        Serial: asset.serial,
        Sede: site?.name || '',
        Estado: asset.status,
        AsignadoA: asset.currentAssignment?.assignedToName || '',
        Cargo: asset.currentAssignment?.assignedToPosition || '',
        Costo: asset.cost || 0,
        MotivoBaja: asset.decommissionReason || '',
        FechaBaja: asset.decommissionedAt ? new Date(asset.decommissionedAt).toLocaleString('es-CO') : '',
      };
    }),
    [filteredAssets, sites],
  );

  const inventoryReportName = assetViewFilter === 'baja' ? 'Activos_De_Baja' : 'Activos';

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
    setInlineAssignment({ name: '', position: '', responsible: '' });
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
      responsible: asset.currentAssignment?.assignedToResponsible ?? '',
    });
    setMoveSiteId(asset.siteId);
    setPreviewImage(asset.imageUrl || null);
    setImageFile(null);
    setImageUploadPct(0);
    setEditorOpen(true);
    loadMaintenances(asset.id);
  }, []);

  const openView = useCallback((asset: Asset) => {
    setEditingId(asset.id);
    setEditorMode('view');
    setFormData(asset);
    setInlineAssignment({
      name: asset.currentAssignment?.assignedToName ?? '',
      position: asset.currentAssignment?.assignedToPosition ?? '',
      responsible: asset.currentAssignment?.assignedToResponsible ?? '',
    });
    setMoveSiteId(asset.siteId);
    setPreviewImage(asset.imageUrl || null);
    setImageFile(null);
    setImageUploadPct(0);
    setEditorOpen(true);
    loadMaintenances(asset.id);
  }, []);

  const closeEditor = () => {
    if (previewImage?.startsWith('blob:')) {
      URL.revokeObjectURL(previewImage);
    }
    setEditorOpen(false);
    setEditingId(null);
    setEditorMode('create');
    setFormData(initialFormState);
    setInlineAssignment({ name: '', position: '', responsible: '' });
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
      const result = await moveAssetToSite(editingId, nextSiteId, profile?.uid);
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
    const validationMessage = getAssetImageValidationMessage(file);
    if (validationMessage) {
      setSnackbar({ open: true, message: validationMessage, severity: 'warning' });
      return;
    }
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
      await updateAsset(editingId, { imageUrl: null, imagePath: null } as any, profile?.uid);
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
      if (!inlineAssignment.name.trim() || !inlineAssignment.position.trim() || !inlineAssignment.responsible.trim()) {
        setSnackbar({ open: true, message: 'Para estado Asignado, complete Nombre completo, Cargo y Responsable.', severity: 'warning' });
        return;
      }
    }

    const imageValidationMessage = getAssetImageValidationMessage(imageFile);
    if (imageValidationMessage) {
      setSnackbar({ open: true, message: imageValidationMessage, severity: 'warning' });
      return;
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
        assignedToResponsible: inlineAssignment.responsible.trim(),
        assignedAt: typeof existingAssignedAt === 'number' ? existingAssignedAt : Date.now(),
      };
    } else {
      dataToSave.currentAssignment = null;
    }

    let uploadedImagePath = '';
    let previousImagePath = '';
    let createdAssetId = '';
    let imageMetadataSaved = false;
    let savePhase = 'validación';

    try {
      setSaving(true);

      if (editingId) {
        const { id, fixedAssetId, createdAt, ...updatePayload } = dataToSave;

        if (imageFile) {
          savePhase = 'subida de imagen';
          previousImagePath = String(formData.imagePath || '').trim();
          const ts = Date.now();
          const result = await uploadFileToStorage(
            `assets/${editingId}/photos/${ts}-${imageFile.name}`,
            imageFile,
            setImageUploadPct
          );
          uploadedImagePath = result.path;

          // Guardar primero la foto evita que la validación estricta de campos
          // antiguos del activo bloquee el cambio de imagen.
          savePhase = 'guardar metadatos de imagen';
          await updateAsset(editingId, { imageUrl: result.url, imagePath: result.path }, profile?.uid);
          imageMetadataSaved = true;

          if (previousImagePath && previousImagePath !== uploadedImagePath) {
            await deleteStoragePath(previousImagePath).catch(() => undefined);
          }
        }

        delete updatePayload.imageUrl;
        delete updatePayload.imagePath;
        try {
          savePhase = 'guardar datos del activo';
          await updateAsset(editingId, updatePayload, profile?.uid);
        } catch (assetUpdateError) {
          if (!imageMetadataSaved) throw assetUpdateError;

          console.error('Asset fields update after image error:', assetUpdateError);
          setSnackbar({
            open: true,
            message: 'Foto actualizada. Algunos datos antiguos no se pudieron actualizar.',
            severity: 'warning',
          });
          closeEditor();
          loadData();
          return;
        }

        setSnackbar({ open: true, message: 'Activo actualizado.', severity: 'success' });
      } else {
        const { id, fixedAssetId, createdAt, imageUrl, imagePath, ...createPayload } = dataToSave;
        savePhase = 'crear activo';
        const docRef: any = await addAsset(createPayload as any, profile?.uid);
        createdAssetId = docRef.id;

        if (imageFile) {
          savePhase = 'subida de imagen';
          const ts = Date.now();
          const result = await uploadFileToStorage(
            `assets/${docRef.id}/photos/${ts}-${imageFile.name}`,
            imageFile,
            setImageUploadPct
          );
          uploadedImagePath = result.path;
          savePhase = 'guardar metadatos de imagen';
          await updateAsset(docRef.id, { imageUrl: result.url, imagePath: result.path }, profile?.uid);
        }

        setSnackbar({ open: true, message: 'Activo creado.', severity: 'success' });
      }
      closeEditor();
      loadData();
    } catch (error) {
      if (uploadedImagePath) {
        await deleteStoragePath(uploadedImagePath).catch(() => undefined);
      }
      const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error saving asset:', { phase: savePhase, code: errorCode, message: errorMessage }, error);
      const message = errorCode.startsWith('storage/')
        ? createdAssetId
          ? 'El activo fue creado, pero la foto no pudo cargarse. Verifica que sea una imagen menor de 5 MB.'
          : 'La foto no pudo cargarse. Verifica que sea una imagen menor de 5 MB.'
        : createdAssetId && imageFile
          ? 'El activo fue creado, pero no se pudo guardar la foto.'
          : 'No se pudo guardar el activo.';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openAssign = useCallback((asset: Asset) => {
    setAssignAsset(asset);
    setAssignmentData({ name: '', position: '', responsible: '' });
    setAssignOpen(true);
  }, []);

  const handleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignAsset) return;

    if (!assignmentData.name || !assignmentData.position || !assignmentData.responsible) {
      setSnackbar({ open: true, message: 'Complete nombre completo, cargo y responsable.', severity: 'warning' });
      return;
    }

    const newAssignment: Assignment = {
      assignedToName: assignmentData.name,
      assignedToPosition: assignmentData.position,
      assignedToResponsible: assignmentData.responsible,
      assignedAt: Date.now(),
    };

    await updateAsset(assignAsset.id, {
      status: 'asignado',
      currentAssignment: newAssignment,
    }, profile?.uid);

    setAssignOpen(false);
    setAssignAsset(null);
    setSnackbar({ open: true, message: 'Activo asignado.', severity: 'success' });
    loadData();
  };

  const confirmReturn = useCallback((asset: Asset) => {
    setReturnAsset(asset);
    setReturnOpen(true);
  }, []);

  const openDecommission = useCallback((asset: Asset) => {
    setDecommissionTarget(asset);
    setDecommissionReason('');
    setDecommissionOpen(true);
  }, []);

  const closeDecommission = useCallback(() => {
    if (decommissionSaving) return;
    setDecommissionOpen(false);
    setDecommissionTarget(null);
    setDecommissionReason('');
  }, [decommissionSaving]);

  const handleDecommission = async () => {
    if (!canWrite || !decommissionTarget) return;
    const reason = decommissionReason.trim();
    if (reason.length < 5) {
      setSnackbar({ open: true, message: 'Escribe un motivo de baja de al menos 5 caracteres.', severity: 'warning' });
      return;
    }

    try {
      setDecommissionSaving(true);
      await decommissionAsset(decommissionTarget.id, reason, profile?.uid);
      setSnackbar({ open: true, message: 'Equipo dado de baja correctamente.', severity: 'success' });
      setDecommissionOpen(false);
      setDecommissionTarget(null);
      setDecommissionReason('');
      await loadData();
    } catch (error) {
      console.error('Decommission asset error:', error);
      setSnackbar({ open: true, message: 'No se pudo dar de baja el equipo.', severity: 'error' });
    } finally {
      setDecommissionSaving(false);
    }
  };

  const openBulkDelete = useCallback(() => {
    setBulkDeleteConfirm('');
    setBulkDeleteOpen(true);
  }, []);

  const closeBulkDelete = useCallback(() => {
    setBulkDeleteOpen(false);
    setBulkDeleteConfirm('');
  }, []);

  const handleBulkDelete = async () => {
    if (!canWrite || !selectedSiteFilter) return;
    if (bodegaAssetsForSite.length === 0) {
      setSnackbar({ open: true, message: 'No hay activos en bodega para eliminar.', severity: 'warning' });
      return;
    }
    if (bulkDeleteConfirm.trim().toUpperCase() !== bulkConfirmPhrase) {
      setSnackbar({ open: true, message: 'La frase de confirmación no coincide.', severity: 'warning' });
      return;
    }

    try {
      setBulkDeleting(true);
      const assetIds = bodegaAssetsForSite.map((asset) => asset.id);
      await bulkDecommissionAssetsForSite(selectedSiteFilter, assetIds, profile?.uid);

      setSnackbar({ open: true, message: 'Activos dados de baja correctamente.', severity: 'success' });
      closeBulkDelete();
      loadData();
    } catch (error) {
      console.error('Bulk delete error:', error);
      setSnackbar({ open: true, message: 'No se pudieron dar de baja los activos.', severity: 'error' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleReturn = async () => {
    if (!returnAsset) return;
    await updateAsset(returnAsset.id, { status: 'bodega', currentAssignment: null }, profile?.uid);
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
            <Grid size={{ xs: 12, md: 2 }}>
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
            <Grid size={{ xs: 12, md: 2 }}>
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
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel id="filter-view">Vista</InputLabel>
                <Select
                  labelId="filter-view"
                  label="Vista"
                  value={assetViewFilter}
                  onChange={(e) => setAssetViewFilter(e.target.value as 'active' | 'baja' | 'all')}
                  startAdornment={
                    <InputAdornment position="start">
                      <FilterAltOutlinedIcon />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="active">En inventario</MenuItem>
                  <MenuItem value="baja">Equipos de baja</MenuItem>
                  <MenuItem value="all">Todos</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadOutlinedIcon />}
                disabled={!inventoryReportRows.length}
                onClick={() => exportToCsv(inventoryReportName, inventoryReportRows)}
              >
                CSV
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintOutlinedIcon />}
                disabled={!inventoryReportRows.length}
                onClick={() => printReport(`Reporte de inventario - ${inventoryReportName}`, assetReportColumns, inventoryReportRows)}
              >
                PDF / Imprimir
              </Button>
              {(filterText || selectedSiteFilter || selectedTypeFilter || assetViewFilter !== 'active') && (
                <Button
                  variant="text"
                  color="error"
                  startIcon={<DeleteOutlineOutlinedIcon />}
                  onClick={clearFilters}
                >
                  Limpiar
                </Button>
              )}
            </Grid>
            {canWrite && selectedSiteFilter && assetViewFilter !== 'baja' && (
              <Grid size={{ xs: 12, md: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<BlockOutlinedIcon />}
                  onClick={openBulkDelete}
                  disabled={bodegaAssetsForSite.length === 0}
                >
                  Dar de baja equipos en bodega
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
            onDecommission={openDecommission}
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
            {formData.status === 'baja' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <strong>Equipo dado de baja.</strong>{' '}
                {formData.decommissionReason || 'No se registró un motivo.'}
                {formData.decommissionedAt && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    Fecha: {new Date(formData.decommissionedAt).toLocaleString('es-CO')}
                  </Typography>
                )}
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
                        setInlineAssignment({ name: '', position: '', responsible: '' });
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
                      <TextField
                        label="Responsable"
                        value={inlineAssignment.responsible}
                        onChange={(e) => setInlineAssignment((prev) => ({ ...prev, responsible: e.target.value }))}
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
                        <input
                          hidden
                          type="file"
                          accept="image/*,.avif"
                          onChange={(e) => {
                            handleImageChange(e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
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

                {(editingId && isViewMode) && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                      Últimos mantenimientos
                    </Typography>
                    {assetMaintenances.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No hay registros.</Typography>
                    ) : (
                      <Stack spacing={1}>
                        {assetMaintenances.map(m => (
                          <Card key={m.id} variant="outlined">
                            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{m.scheduledDate}</Typography>
                                <Chip size="small" label={m.type.toUpperCase()} variant="outlined" />
                              </Stack>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>{m.findings || 'Sin hallazgos detallados'}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Costo: ${Number(m.cost || 0).toLocaleString()} · Est: {m.status}</Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </>
                )}
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

      <Dialog open={bulkDeleteOpen} onClose={closeBulkDelete} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Dar de baja activos en bodega</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              Esta acción dará de baja <strong>{bodegaAssetsForSite.length}</strong> activo(s) en bodega de la sede{' '}
              <strong>{selectedSite?.name || 'seleccionada'}</strong>. Se conservarán sus características y fotos históricas.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Para confirmar, escribe: <strong>{bulkConfirmPhrase}</strong>
            </Typography>
            <TextField
              label="Confirmación"
              value={bulkDeleteConfirm}
              onChange={(e) => setBulkDeleteConfirm(e.target.value)}
              fullWidth
              disabled={bulkDeleting}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBulkDelete} disabled={bulkDeleting}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBulkDelete}
            disabled={bulkDeleting || bulkDeleteConfirm.trim().toUpperCase() !== bulkConfirmPhrase}
          >
            Dar de baja
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={decommissionOpen} onClose={closeDecommission} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>Dar de baja equipo</DialogTitle>
        <DialogContent>
          {decommissionTarget && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  {decommissionTarget.imageUrl ? (
                    <Box
                      component="img"
                      src={decommissionTarget.imageUrl}
                      alt={`Foto de ${decommissionTarget.fixedAssetId}`}
                      sx={{ width: '100%', maxHeight: 210, objectFit: 'contain', borderRadius: 3, bgcolor: 'rgba(0,0,0,0.04)' }}
                    />
                  ) : (
                    <Box sx={{ minHeight: 160, display: 'grid', placeItems: 'center', borderRadius: 3, bgcolor: 'rgba(0,0,0,0.04)' }}>
                      <PhotoCameraOutlinedIcon color="disabled" sx={{ fontSize: 48 }} />
                    </Box>
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <Stack spacing={0.75}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {decommissionTarget.fixedAssetId}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {decommissionTarget.brand} {decommissionTarget.model}
                    </Typography>
                    <Typography variant="body2">Tipo: {decommissionTarget.type}</Typography>
                    <Typography variant="body2">Serial: {decommissionTarget.serial || '—'}</Typography>
                    <Typography variant="body2">
                      Sede: {sites.find((site) => site.id === decommissionTarget.siteId)?.name || 'Sin sede'}
                    </Typography>
                    <Typography variant="body2">
                      Hardware: {[decommissionTarget.processor, decommissionTarget.ram, decommissionTarget.storage].filter(Boolean).join(' · ') || '—'}
                    </Typography>
                    {decommissionTarget.currentAssignment && (
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={`Asignado a ${decommissionTarget.currentAssignment.assignedToName}`}
                        sx={{ width: 'fit-content', mt: 0.5 }}
                      />
                    )}
                  </Stack>
                </Grid>
              </Grid>

              <Alert severity="warning">
                Al confirmar, el equipo desaparecerá de la vista <strong>En inventario</strong>, conservará su sede y foto, y se retirará cualquier asignación actual.
              </Alert>

              <TextField
                label="Motivo de baja"
                value={decommissionReason}
                onChange={(e) => setDecommissionReason(e.target.value)}
                required
                fullWidth
                multiline
                minRows={3}
                disabled={decommissionSaving}
                placeholder="Ejemplo: equipo obsoleto, daño irreparable, reemplazo tecnológico..."
                helperText="Este motivo quedará asociado al historial del equipo."
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDecommission} disabled={decommissionSaving}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDecommission}
            disabled={decommissionSaving || decommissionReason.trim().length < 5}
            startIcon={<BlockOutlinedIcon />}
          >
            Confirmar baja
          </Button>
        </DialogActions>
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
              <TextField
                label="Responsable"
                value={assignmentData.responsible}
                onChange={(e) => setAssignmentData({ ...assignmentData, responsible: e.target.value })}
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
