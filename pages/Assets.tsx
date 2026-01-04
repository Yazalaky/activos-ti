import React, { useState, useEffect } from 'react';
import { getAssets, getSites, addAsset, updateAsset, addSite } from '../services/api';
import { Asset, Site, AssetType, Status, Assignment } from '../types';
import { Plus, Search, Filter, User, Building, Image as ImageIcon, Cpu, HardDrive, Monitor, Save, Pencil } from 'lucide-react';

const Assets = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [filterText, setFilterText] = useState('');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState(''); // Nuevo estado para el filtro de sede
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<Asset | null>(null);
  
  // State for Editing
  const [editingId, setEditingId] = useState<string | null>(null);

  // Initial Form State
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
    imageUrl: ''
  };

  const [formData, setFormData] = useState<Partial<Asset>>(initialFormState);
  const [assignmentData, setAssignmentData] = useState({ name: '', doc: '', position: '' });
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [a, s] = await Promise.all([getAssets(), getSites()]);
    setAssets(a);
    setSites(s);
  };

  const handleEdit = (asset: Asset) => {
    setFormData(asset);
    setPreviewImage(asset.imageUrl || null);
    setEditingId(asset.id);
    setShowModal(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siteId) {
      alert("Seleccione una sede");
      return;
    }
    
    const dataToSave = { ...formData };
    
    // Clean up desktop specific fields if not desktop
    if (dataToSave.type !== 'desktop') {
        delete dataToSave.monitorBrand;
        delete dataToSave.monitorSize;
        delete dataToSave.monitorSerial;
    }

    // Clean up computer specs if not laptop or desktop
    if (dataToSave.type !== 'laptop' && dataToSave.type !== 'desktop') {
        delete dataToSave.processor;
        delete dataToSave.ram;
        delete dataToSave.storage;
        delete dataToSave.os;
    }

    if (editingId) {
        await updateAsset(editingId, dataToSave);
    } else {
        await addAsset(dataToSave as any); // Cast to any because fixedAssetId is generated in backend
    }

    setShowModal(false);
    setFormData(initialFormState);
    setPreviewImage(null);
    setEditingId(null);
    loadData();
  };

  const closeModal = () => {
      setShowModal(false);
      setFormData(initialFormState);
      setPreviewImage(null);
      setEditingId(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        // For MVP/Demo: Create a local URL. 
        // In Prod: Upload to Firebase Storage and get URL.
        const url = URL.createObjectURL(file);
        setFormData({ ...formData, imageUrl: url });
        setPreviewImage(url);
    }
  };

  const handleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal) return;

    const newAssignment: Assignment = {
      assignedToName: assignmentData.name,
      assignedToDoc: assignmentData.doc,
      assignedToPosition: assignmentData.position,
      assignedAt: Date.now()
    };

    await updateAsset(showAssignModal.id, {
      status: 'asignado',
      currentAssignment: newAssignment
    });

    setShowAssignModal(null);
    loadData();
  };

  const handleReturnAsset = async (asset: Asset) => {
    if (confirm('¿Confirmar retorno a bodega?')) {
        await updateAsset(asset.id, {
            status: 'bodega',
            currentAssignment: null
        });
        loadData();
    }
  };

  // Logic de filtrado combinada
  const filteredAssets = assets.filter(a => {
    const matchesText = 
        a.serial.toLowerCase().includes(filterText.toLowerCase()) ||
        a.model.toLowerCase().includes(filterText.toLowerCase()) ||
        (a.fixedAssetId && a.fixedAssetId.toLowerCase().includes(filterText.toLowerCase()));
    
    const matchesSite = selectedSiteFilter ? a.siteId === selectedSiteFilter : true;

    return matchesText && matchesSite;
  });

  // Helper to determine if asset is a computer
  const isComputer = formData.type === 'laptop' || formData.type === 'desktop';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inventario de Activos</h1>
        <button 
          onClick={() => { setFormData(initialFormState); setPreviewImage(null); setEditingId(null); setShowModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 shadow-sm"
        >
          <Plus size={18} /> Nuevo Activo
        </button>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4">
        {/* Text Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar por serial, activo fijo, modelo..."
            className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
          />
        </div>

        {/* Site Filter */}
        <div className="relative min-w-[250px]">
           <Filter className="absolute left-3 top-2.5 text-gray-400" size={20} />
           <select 
             className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none focus:border-blue-500 appearance-none bg-white"
             value={selectedSiteFilter}
             onChange={e => setSelectedSiteFilter(e.target.value)}
           >
             <option value="">Todas las Sedes</option>
             {sites.map(site => (
                 <option key={site.id} value={site.id}>{site.name}</option>
             ))}
           </select>
           {/* Custom arrow if needed, but appearance-none removes default. Browsers usually handle select nicely now, or just leave default */}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
            <tr>
              <th className="p-4">Activo Fijo / Tipo</th>
              <th className="p-4">Detalles Equipo</th>
              <th className="p-4">Ubicación</th>
              <th className="p-4">Hardware</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAssets.map(asset => {
                const siteName = sites.find(s => s.id === asset.siteId)?.name || 'Sin sede';
                return (
              <tr key={asset.id} className="hover:bg-gray-50">
                <td className="p-4">
                  <div className="font-bold text-blue-700">{asset.fixedAssetId || 'PEND'}</div>
                  <div className="text-xs uppercase font-semibold text-gray-500 mt-1">{asset.type}</div>
                </td>
                <td className="p-4">
                  <div className="font-medium text-gray-800">{asset.brand} {asset.model}</div>
                  <div className="text-sm text-gray-500">S/N: {asset.serial}</div>
                </td>
                <td className="p-4 text-sm">
                    <div className="flex items-center gap-1 text-gray-700">
                        <Building size={14} /> {siteName}
                    </div>
                </td>
                 <td className="p-4 text-sm text-gray-600">
                    { (asset.type === 'laptop' || asset.type === 'desktop') ? (
                        <div className="flex flex-col gap-1 text-xs">
                           {asset.processor && <span>CPU: {asset.processor}</span>}
                           {asset.ram && <span>RAM: {asset.ram}</span>}
                           {asset.storage && <span>HDD: {asset.storage}</span>}
                        </div>
                    ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                    )}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold
                    ${asset.status === 'bodega' ? 'bg-indigo-100 text-indigo-800' :
                      asset.status === 'asignado' ? 'bg-green-100 text-green-800' :
                      asset.status === 'mantenimiento' ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'}`}>
                    {asset.status.toUpperCase()}
                  </span>
                  {asset.currentAssignment && (
                      <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                          <User size={12} /> {asset.currentAssignment.assignedToName}
                      </div>
                  )}
                </td>
                <td className="p-4 flex flex-col gap-2">
                    <button 
                        onClick={() => handleEdit(asset)}
                        className="flex items-center gap-1 text-gray-600 hover:text-blue-600 text-sm"
                    >
                        <Pencil size={14} /> Editar
                    </button>
                    {asset.status === 'bodega' && (
                        <button 
                            onClick={() => setShowAssignModal(asset)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                            <User size={14}/> Asignar
                        </button>
                    )}
                    {asset.status === 'asignado' && (
                        <button 
                            onClick={() => handleReturnAsset(asset)}
                            className="flex items-center gap-1 text-orange-600 hover:text-orange-800 text-sm font-medium"
                        >
                            <Building size={14}/> Retornar
                        </button>
                    )}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        {filteredAssets.length === 0 && (
            <div className="p-8 text-center text-gray-500">No se encontraron activos.</div>
        )}
      </div>

      {/* New Asset Modal - Wide Version */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-8">
            <div className="bg-slate-50 px-6 py-4 rounded-t-xl border-b flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Activo' : 'Registrar Nuevo Activo'}</h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleSaveAsset} className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Column 1: General Info */}
                    <div className="lg:col-span-1 space-y-4">
                        <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2 mb-3">Información General</h3>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">Sede {editingId ? '(No editable para mantener consecutivo)' : ''}</label>
                            <select className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100" required
                                disabled={!!editingId}
                                value={formData.siteId} onChange={e => setFormData({...formData, siteId: e.target.value})}>
                                <option value="">Seleccione Sede...</option>
                                {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.prefix})</option>)}
                            </select>
                            {formData.siteId && !editingId && (
                                <p className="text-xs text-blue-600 mt-1">
                                    Se generará código: <strong>{sites.find(s=>s.id === formData.siteId)?.prefix}-XXX</strong>
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Tipo de Equipo</label>
                            <select className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-200 outline-none" 
                                value={formData.type} 
                                onChange={e => setFormData({...formData, type: e.target.value as AssetType})}>
                                <option value="laptop">Laptop / Portátil</option>
                                <option value="desktop">Desktop / Escritorio</option>
                                <option value="monitor">Monitor</option>
                                <option value="printer">Impresora</option>
                                <option value="scanner">Escáner</option>
                                <option value="network">Redes (Switch/Router)</option>
                                <option value="other">Otro</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Marca</label>
                            <input className="w-full border p-2 rounded" required
                                value={formData.brand || ''} onChange={e => setFormData({...formData, brand: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Modelo</label>
                            <input className="w-full border p-2 rounded" required
                                value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Serial</label>
                            <input className="w-full border p-2 rounded" required
                                value={formData.serial || ''} onChange={e => setFormData({...formData, serial: e.target.value})} />
                        </div>
                    </div>

                    {/* Column 2: Hardware & Purchase */}
                    <div className="lg:col-span-1 space-y-4">
                        <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2 mb-3">Especificaciones & Costos</h3>
                        
                        {isComputer && (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                     <div>
                                        <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Cpu size={14}/> Procesador</label>
                                        <input className="w-full border p-2 rounded" placeholder="Ej: Core i5"
                                            value={formData.processor || ''} onChange={e => setFormData({...formData, processor: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">RAM</label>
                                        <input className="w-full border p-2 rounded" placeholder="Ej: 16GB"
                                            value={formData.ram || ''} onChange={e => setFormData({...formData, ram: e.target.value})} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-2">
                                     <div>
                                        <label className="block text-sm font-medium mb-1 flex items-center gap-1"><HardDrive size={14}/> Disco</label>
                                        <input className="w-full border p-2 rounded" placeholder="Ej: 512GB SSD"
                                            value={formData.storage || ''} onChange={e => setFormData({...formData, storage: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Sist. Operativo</label>
                                        <input className="w-full border p-2 rounded" placeholder="Ej: Win 11 Pro"
                                            value={formData.os || ''} onChange={e => setFormData({...formData, os: e.target.value})} />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className={`grid grid-cols-2 gap-2 ${isComputer ? 'pt-2 border-t mt-2' : ''}`}>
                             <div>
                                <label className="block text-sm font-medium mb-1">Fecha Compra</label>
                                <input type="date" className="w-full border p-2 rounded" 
                                    value={formData.purchaseDate || ''} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Costo (COP)</label>
                                <input type="number" className="w-full border p-2 rounded" placeholder="0"
                                    value={formData.cost || ''} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} />
                            </div>
                        </div>
                    </div>

                    {/* Column 3: Conditional Desktop & Extras */}
                    <div className="lg:col-span-1 space-y-4">
                         {formData.type === 'desktop' && (
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                                <h3 className="text-sm font-bold text-blue-700 uppercase mb-3 flex items-center gap-2">
                                    <Monitor size={16}/> Datos del Monitor
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-blue-600 mb-1">Marca Monitor</label>
                                        <input className="w-full border border-blue-200 p-2 rounded text-sm"
                                            value={formData.monitorBrand || ''} onChange={e => setFormData({...formData, monitorBrand: e.target.value})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-bold text-blue-600 mb-1">Pulgadas</label>
                                            <input className="w-full border border-blue-200 p-2 rounded text-sm" placeholder='Ej: 24"'
                                                value={formData.monitorSize || ''} onChange={e => setFormData({...formData, monitorSize: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-blue-600 mb-1">Serial Mon.</label>
                                            <input className="w-full border border-blue-200 p-2 rounded text-sm"
                                                value={formData.monitorSerial || ''} onChange={e => setFormData({...formData, monitorSerial: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2 mb-3">Evidencia y Notas</h3>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1 flex items-center gap-1"><ImageIcon size={14}/> Foto del Activo</label>
                            <input type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                            {previewImage && (
                                <div className="mt-2 h-32 w-full bg-gray-100 rounded flex items-center justify-center overflow-hidden border">
                                    <img src={previewImage} alt="Preview" className="h-full object-contain" />
                                </div>
                            )}
                        </div>

                        <div>
                             <label className="block text-sm font-medium mb-1">Notas Adicionales</label>
                             <textarea className="w-full border p-2 rounded h-20 text-sm"
                                value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />
                        </div>

                    </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                    <button type="button" onClick={closeModal} className="px-6 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold flex items-center gap-2">
                        <Save size={18} /> {editingId ? 'Actualizar Activo' : 'Guardar Activo'}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Modal (Unchanged) */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Asignar Activo</h2>
            <p className="text-sm text-gray-500 mb-4">{showAssignModal.brand} {showAssignModal.model} ({showAssignModal.fixedAssetId})</p>
            <form onSubmit={handleAssignment} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Nombre Funcionario</label>
                    <input className="w-full border p-2 rounded" required
                        value={assignmentData.name} onChange={e => setAssignmentData({...assignmentData, name: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Documento (CC)</label>
                    <input className="w-full border p-2 rounded" required
                        value={assignmentData.doc} onChange={e => setAssignmentData({...assignmentData, doc: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Cargo</label>
                    <input className="w-full border p-2 rounded" required
                        value={assignmentData.position} onChange={e => setAssignmentData({...assignmentData, position: e.target.value})} />
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button type="button" onClick={() => setShowAssignModal(null)} className="px-4 py-2 border rounded text-gray-600">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Confirmar Asignación</button>
                </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Assets;