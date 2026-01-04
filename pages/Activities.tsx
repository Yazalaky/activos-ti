import React, { useState, useEffect } from 'react';
import { getActivities, getSites, addActivity, getAssets } from '../services/api';
import { Activity, Site, Asset } from '../types';
import { Plus, Calendar, User, Laptop, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const Activities = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showModal, setShowModal] = useState(false);
  
  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [formData, setFormData] = useState<Partial<Activity>>({
    date: new Date().toISOString().split('T')[0],
    type: 'Soporte Usuario',
    priority: 'media',
    techName: '',
    siteId: '',
    assetId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [acts, s, a] = await Promise.all([getActivities(), getSites(), getAssets()]);
    setActivities(acts);
    setSites(s);
    setAssets(a);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siteId) {
        alert("Seleccione Sede");
        return;
    }
    if (!formData.techName) {
        alert("Ingrese el nombre del técnico");
        return;
    }

    // Prepare data (remove assetId if empty string to avoid saving empty string in DB)
    const dataToSave = { ...formData };
    if (!dataToSave.assetId) delete dataToSave.assetId;

    await addActivity(dataToSave as Omit<Activity, 'id'>);
    setShowModal(false);
    
    // Reset form but keep date/tech
    setFormData({
        ...formData,
        description: '',
        assetId: '',
        type: 'Soporte Usuario'
    });
    
    loadData();
  };

  // Filter assets based on selected site in form
  const siteAssets = assets.filter(a => a.siteId === formData.siteId && a.status !== 'baja');

  // Filter Activities by Date Range
  const filteredActivities = activities.filter(act => {
      if (startDate && act.date < startDate) return false;
      if (endDate && act.date > endDate) return false;
      return true;
  });

  const clearFilters = () => {
      setStartDate('');
      setEndDate('');
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Bitácora de Sistemas</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={18} /> Nuevo Registro
        </button>
      </div>

      {/* Date Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Filter size={18} /> <span className="font-semibold text-sm">Filtrar periodo:</span>
          </div>
          <div>
              <label className="block text-xs text-gray-500 mb-1">Desde</label>
              <input 
                type="date" 
                className="border p-1.5 rounded text-sm text-gray-700 focus:outline-blue-500"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
          </div>
          <div>
              <label className="block text-xs text-gray-500 mb-1">Hasta</label>
              <input 
                type="date" 
                className="border p-1.5 rounded text-sm text-gray-700 focus:outline-blue-500"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
          </div>
          {(startDate || endDate) && (
              <button 
                onClick={clearFilters}
                className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 pb-2"
              >
                  <X size={16} /> Limpiar
              </button>
          )}
      </div>

      <div className="space-y-4">
        {filteredActivities.map(activity => {
            const assetInfo = activity.assetId ? assets.find(a => a.id === activity.assetId) : null;
            
            return (
          <div key={activity.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
            <div className="flex flex-col items-center justify-center bg-gray-50 p-2 rounded min-w-[100px] text-center">
               <Calendar size={20} className="text-gray-400 mb-1"/>
               <span className="font-bold text-gray-700">{activity.date}</span>
               <span className="text-xs text-gray-500 uppercase">{format(new Date(activity.date), 'EEEE', {locale: es})}</span>
            </div>
            
            <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
                        ${activity.type === 'Soporte Usuario' ? 'bg-blue-100 text-blue-700' : 
                          activity.type === 'Requerimiento' ? 'bg-purple-100 text-purple-700' :
                          activity.type === 'Capacitacion' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {activity.type}
                    </span>
                    <span className="text-sm text-gray-500 font-medium">
                        {sites.find(s => s.id === activity.siteId)?.name || 'N/A'}
                    </span>
                    {activity.techName && (
                         <span className="flex items-center text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border">
                            <User size={10} className="mr-1"/> Tec: {activity.techName}
                         </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border
                        ${activity.priority === 'alta' ? 'bg-red-50 text-red-700 border-red-200' : 
                          activity.priority === 'media' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                          'bg-green-50 text-green-700 border-green-200'}`}>
                        {activity.priority}
                    </span>
                </div>
                
                <p className="text-gray-800 font-medium">{activity.description}</p>
                
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                    {assetInfo && (
                        <div className="flex items-center gap-1 text-blue-600">
                             <Laptop size={12} /> 
                             Activo: {assetInfo.fixedAssetId} ({assetInfo.brand} {assetInfo.model})
                        </div>
                    )}
                </div>
            </div>
          </div>
        )})}
        {filteredActivities.length === 0 && (
            <div className="text-center p-8 text-gray-500 bg-white rounded-lg border border-dashed">
                No se encontraron actividades en este rango de fechas.
            </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg my-8">
            <h2 className="text-xl font-bold mb-4">Registrar Actividad</h2>
            <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Fecha</label>
                        <input type="date" className="w-full border p-2 rounded" required
                            value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Tipo Actividad</label>
                        <select className="w-full border p-2 rounded"
                            value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                            <option value="Soporte Usuario">Soporte Usuario</option>
                            <option value="Requerimiento">Requerimiento</option>
                            <option value="Capacitacion">Capacitación</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>
                </div>

                <div>
                     <label className="block text-sm font-medium mb-1">Técnico Responsable</label>
                     <div className="relative">
                        <User className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            className="w-full pl-9 pr-4 py-2 border rounded"
                            placeholder="Nombre del técnico"
                            value={formData.techName || ''}
                            onChange={e => setFormData({...formData, techName: e.target.value})}
                            required
                        />
                     </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Sede</label>
                        <select className="w-full border p-2 rounded" required
                            value={formData.siteId || ''} 
                            onChange={e => setFormData({...formData, siteId: e.target.value, assetId: ''})}>
                            <option value="">Seleccione...</option>
                            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                         <label className="block text-sm font-medium mb-1">Activo (Opcional)</label>
                         <select 
                            className="w-full border p-2 rounded disabled:bg-gray-100 disabled:text-gray-400" 
                            disabled={!formData.siteId}
                            value={formData.assetId || ''}
                            onChange={e => setFormData({...formData, assetId: e.target.value})}
                         >
                            <option value="">- Ninguno / General -</option>
                            {siteAssets.map(asset => (
                                <option key={asset.id} value={asset.id}>
                                    {asset.fixedAssetId} - {asset.type} {asset.brand}
                                </option>
                            ))}
                         </select>
                         {formData.siteId && siteAssets.length === 0 && (
                             <p className="text-xs text-orange-500 mt-1">No hay activos registrados en esta sede.</p>
                         )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Descripción Detallada</label>
                    <textarea className="w-full border p-2 rounded h-24" required
                        value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} 
                        placeholder="Qué sucedió, qué se hizo..." />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Prioridad</label>
                    <select className="w-full border p-2 rounded"
                        value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}>
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                    </select>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold">Guardar Registro</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Activities;