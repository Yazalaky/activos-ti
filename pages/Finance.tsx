import React, { useState, useEffect } from 'react';
import { getSuppliers, getInvoices, addSupplier, addInvoice, getSites, updateInvoice } from '../services/api';
import { Supplier, Invoice, Site } from '../types';
import { Plus, Download, FileText, Building, Calendar, DollarSign, Pencil, Filter, X, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const Finance = () => {
  const [activeTab, setActiveTab] = useState<'invoices' | 'suppliers' | 'reports'>('invoices');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');

  // Modal states
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  
  // Edit states
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Form states
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({});
  
  const initialInvoiceState: Partial<Invoice> = {
    date: new Date().toISOString().split('T')[0], // Radicación default hoy
    dueDate: '',
    siteId: '',
    supplierId: '',
    number: '',
    description: '',
    total: 0,
    status: 'pending'
  };
  const [invoiceForm, setInvoiceForm] = useState<Partial<Invoice>>(initialInvoiceState);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [sup, inv, s] = await Promise.all([getSuppliers(), getInvoices(), getSites()]);
    setSuppliers(sup);
    // Aseguramos una nueva referencia del array para forzar el re-render en React
    setInvoices([...inv]);
    setSites(s);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    await addSupplier(supplierForm as Omit<Supplier, 'id'>);
    setShowSupplierModal(false);
    loadData();
  };

  const handleEditInvoice = (inv: Invoice) => {
    setInvoiceForm(inv);
    setEditingInvoiceId(inv.id);
    setShowInvoiceModal(true);
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.supplierId || !invoiceForm.siteId) {
        alert("Por favor complete todos los campos requeridos");
        return;
    }

    if (editingInvoiceId) {
        await updateInvoice(editingInvoiceId, invoiceForm);
    } else {
        // Enforce pending on creation unless specified otherwise (in logic default is pending)
        const newInvoice = { ...invoiceForm, status: invoiceForm.status || 'pending' };
        await addInvoice(newInvoice as Omit<Invoice, 'id'>);
    }
    
    closeInvoiceModal();
    loadData();
  };

  const toggleInvoiceStatus = async (inv: Invoice) => {
      const newStatus = inv.status === 'paid' ? 'pending' : 'paid';
      
      // Actualización Optimista: Actualizamos la UI inmediatamente sin esperar al backend
      setInvoices(prevInvoices => prevInvoices.map(item => 
        item.id === inv.id ? { ...item, status: newStatus } : item
      ));

      // Enviamos el cambio al backend (o mockDB)
      await updateInvoice(inv.id, { status: newStatus });
      
      // No es estrictamente necesario llamar a loadData() si confiamos en la actualización local,
      // pero si hay otros usuarios concurrentes o reglas de backend, podríamos hacerlo.
      // Para este caso, la actualización local es suficiente y evita parpadeos.
  };

  const closeInvoiceModal = () => {
      setShowInvoiceModal(false);
      setInvoiceForm(initialInvoiceState);
      setEditingInvoiceId(null);
  }

  const clearFilters = () => {
      setStartDate('');
      setEndDate('');
      setSelectedSiteFilter('');
      setSelectedSupplierFilter('');
  }

  // --- LOGIC FOR DERIVED STATUS ---
  const getDisplayStatus = (inv: Invoice) => {
      if (inv.status === 'paid') return { label: 'Pagado', color: 'bg-green-100 text-green-700', icon: CheckCircle };
      
      const today = new Date().toISOString().split('T')[0];
      if (inv.dueDate && inv.dueDate < today) {
          return { label: 'Vencido', color: 'bg-red-100 text-red-700', icon: AlertCircle };
      }
      
      return { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock };
  };

  // Filter Logic
  const filteredInvoices = invoices.filter(inv => {
      if (startDate && inv.date < startDate) return false;
      if (endDate && inv.date > endDate) return false;
      if (selectedSiteFilter && inv.siteId !== selectedSiteFilter) return false;
      if (selectedSupplierFilter && inv.supplierId !== selectedSupplierFilter) return false;
      return true;
  });

  // Calculate Report Totals
  const totalInvoiced = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalPaid = filteredInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalPending = filteredInvoices
        .filter(inv => inv.status === 'pending')
        .reduce((sum, inv) => sum + Number(inv.total), 0);


  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Gestión Financiera</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button 
          onClick={() => setActiveTab('invoices')}
          className={`px-6 py-3 font-medium text-sm border-b-2 ${activeTab === 'invoices' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Facturas
        </button>
        <button 
          onClick={() => setActiveTab('suppliers')}
          className={`px-6 py-3 font-medium text-sm border-b-2 ${activeTab === 'suppliers' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Proveedores
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`px-6 py-3 font-medium text-sm border-b-2 ${activeTab === 'reports' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Reporte de Costos
        </button>
      </div>

      {/* Common Filter Bar (Used in Invoices and Reports) */}
      {(activeTab === 'invoices' || activeTab === 'reports') && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center gap-2 text-gray-600 mb-3 border-b pb-2">
                <Filter size={18} /> <span className="font-semibold text-sm">Filtros de Búsqueda</span>
            </div>
            
            <div className="flex flex-wrap items-end gap-4">
                {/* Site Filter */}
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Sede</label>
                    <select 
                        className="border p-2 rounded text-sm text-gray-700 focus:outline-blue-500 bg-white min-w-[150px]"
                        value={selectedSiteFilter}
                        onChange={e => setSelectedSiteFilter(e.target.value)}
                    >
                        <option value="">Todas las Sedes</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                {/* Supplier Filter */}
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Proveedor</label>
                    <select 
                        className="border p-2 rounded text-sm text-gray-700 focus:outline-blue-500 bg-white min-w-[150px]"
                        value={selectedSupplierFilter}
                        onChange={e => setSelectedSupplierFilter(e.target.value)}
                    >
                        <option value="">Todos los Proveedores</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Desde</label>
                    <input 
                    type="date" 
                    className="border p-2 rounded text-sm text-gray-700 focus:outline-blue-500"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                    <input 
                    type="date" 
                    className="border p-2 rounded text-sm text-gray-700 focus:outline-blue-500"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    />
                </div>
                
                {(startDate || endDate || selectedSiteFilter || selectedSupplierFilter) && (
                    <button 
                    onClick={clearFilters}
                    className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 pb-1 ml-auto"
                    >
                        <X size={16} /> Limpiar Filtros
                    </button>
                )}
            </div>
        </div>
      )}

      {/* INVOICES TAB */}
      {activeTab === 'invoices' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setEditingInvoiceId(null); setInvoiceForm(initialInvoiceState); setShowInvoiceModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm shadow-sm hover:bg-blue-700">
                <Plus size={16} /> Nueva Factura
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
             <table className="w-full text-left text-sm">
                 <thead className="bg-gray-50 text-gray-600 uppercase border-b">
                     <tr>
                         <th className="p-4">Info Factura</th>
                         <th className="p-4">Detalle / Sede</th>
                         <th className="p-4">Estado</th>
                         <th className="p-4">Fechas</th>
                         <th className="p-4">Valor</th>
                         <th className="p-4">Acciones</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                     {filteredInvoices.map(inv => {
                         const statusInfo = getDisplayStatus(inv);
                         const StatusIcon = statusInfo.icon;
                         
                         return (
                         <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                             <td className="p-4">
                                <div className="font-bold text-gray-800 text-base">{inv.number}</div>
                                <div className="text-xs text-gray-500 mt-1">{suppliers.find(s => s.id === inv.supplierId)?.name || 'N/A'}</div>
                             </td>
                             <td className="p-4">
                                <div className="font-medium text-gray-700 truncate max-w-[200px]" title={inv.description}>{inv.description}</div>
                                <div className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                                    <Building size={12} />
                                    {sites.find(s => s.id === inv.siteId)?.name || 'Sede N/A'}
                                </div>
                             </td>
                             <td className="p-4">
                                 <button 
                                     onClick={() => toggleInvoiceStatus(inv)}
                                     className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color} hover:ring-2 hover:ring-offset-1 hover:ring-opacity-50 focus:outline-none transition-all cursor-pointer`}
                                     title="Clic para alternar estado (Pagado/Pendiente)"
                                 >
                                     <StatusIcon size={12} /> {statusInfo.label}
                                 </button>
                             </td>
                             <td className="p-4 text-gray-600">
                                <div className="text-xs">Rad: {inv.date}</div>
                                {inv.dueDate && <div className={`text-xs mt-1 ${statusInfo.label === 'Vencido' ? 'text-red-600 font-bold' : 'text-gray-500'}`}>Venc: {inv.dueDate}</div>}
                             </td>
                             <td className="p-4 font-bold text-gray-700 text-base">
                                ${Number(inv.total).toLocaleString()}
                             </td>
                             <td className="p-4 flex items-center gap-2">
                                 <button onClick={() => handleEditInvoice(inv)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                                    <Pencil size={18}/>
                                 </button>
                                 <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded" title="Ver PDF">
                                    <FileText size={18}/>
                                 </button>
                             </td>
                         </tr>
                     )})}
                     {filteredInvoices.length === 0 && (
                         <tr><td colSpan={6} className="p-8 text-center text-gray-500">No hay facturas registradas con los filtros seleccionados.</td></tr>
                     )}
                 </tbody>
             </table>
          </div>
        </div>
      )}

      {/* SUPPLIERS TAB */}
      {activeTab === 'suppliers' && (
        <div>
             <div className="flex justify-end mb-4">
            <button onClick={() => setShowSupplierModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm">
                <Plus size={16} /> Nuevo Proveedor
            </button>
          </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {suppliers.map(sup => (
                   <div key={sup.id} className="bg-white p-4 rounded shadow border border-gray-100">
                       <h3 className="font-bold text-gray-800">{sup.name}</h3>
                       <p className="text-xs text-gray-500 mb-2">NIT: {sup.nit}</p>
                       <p className="text-sm">📞 {sup.phone}</p>
                       <p className="text-sm">✉️ {sup.email}</p>
                       <span className="inline-block mt-2 bg-gray-100 px-2 py-1 rounded text-xs">{sup.category}</span>
                   </div>
               ))}
           </div>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
                    <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Total Facturado</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-800">${totalInvoiced.toLocaleString()}</span>
                        <span className="text-xs text-gray-400">en periodo</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-green-500">
                    <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Total Pagado</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-green-700">${totalPaid.toLocaleString()}</span>
                        <span className="text-xs text-gray-400">({filteredInvoices.length > 0 ? Math.round((totalPaid/totalInvoiced)*100) : 0}%)</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-red-500">
                    <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Total Pendiente / Vencido</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-red-700">${totalPending.toLocaleString()}</span>
                        <span className="text-xs text-gray-400">por pagar</span>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Detalle de Costos</h3>
                    <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                        <Download size={16} /> Exportar
                    </button>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-white text-gray-500 uppercase border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-3 font-medium">Fecha</th>
                            <th className="px-6 py-3 font-medium">Factura</th>
                            <th className="px-6 py-3 font-medium">Proveedor</th>
                            <th className="px-6 py-3 font-medium">Sede</th>
                            <th className="px-6 py-3 font-medium">Estado</th>
                            <th className="px-6 py-3 font-medium text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredInvoices.map(inv => {
                            const statusInfo = getDisplayStatus(inv);
                            return (
                                <tr key={inv.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 text-gray-600">{inv.date}</td>
                                    <td className="px-6 py-3 font-medium text-gray-800">{inv.number}</td>
                                    <td className="px-6 py-3 text-gray-600">{suppliers.find(s => s.id === inv.supplierId)?.name}</td>
                                    <td className="px-6 py-3 text-gray-600">{sites.find(s => s.id === inv.siteId)?.name}</td>
                                    <td className="px-6 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono font-medium text-gray-700">
                                        ${Number(inv.total).toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredInvoices.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay datos para mostrar</td></tr>
                        )}
                    </tbody>
                    {filteredInvoices.length > 0 && (
                        <tfoot className="bg-gray-50 font-bold text-gray-800">
                            <tr>
                                <td colSpan={5} className="px-6 py-3 text-right uppercase text-xs tracking-wider">Total Periodo</td>
                                <td className="px-6 py-3 text-right font-mono text-base border-t-2 border-gray-200">
                                    ${totalInvoiced.toLocaleString()}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
      )}

      {/* MODALS */}
      {showSupplierModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
             <div className="bg-white p-6 rounded w-full max-w-md">
                 <h2 className="text-lg font-bold mb-4">Crear Proveedor</h2>
                 <form onSubmit={handleSaveSupplier} className="space-y-3">
                     <input className="w-full border p-2 rounded" placeholder="Nombre" onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} required />
                     <input className="w-full border p-2 rounded" placeholder="NIT" onChange={e => setSupplierForm({...supplierForm, nit: e.target.value})} required />
                     <input className="w-full border p-2 rounded" placeholder="Contacto" onChange={e => setSupplierForm({...supplierForm, contactName: e.target.value})} />
                     <input className="w-full border p-2 rounded" placeholder="Teléfono" onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} />
                     <input className="w-full border p-2 rounded" placeholder="Email" onChange={e => setSupplierForm({...supplierForm, email: e.target.value})} />
                     <button className="w-full bg-blue-600 text-white py-2 rounded mt-2">Guardar</button>
                     <button type="button" onClick={() => setShowSupplierModal(false)} className="w-full text-gray-500 py-2">Cancelar</button>
                 </form>
             </div>
          </div>
      )}
      
       {showInvoiceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
             <div className="bg-white p-6 rounded-lg w-full max-w-lg my-8 shadow-xl">
                 <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">
                     {editingInvoiceId ? 'Editar Factura' : 'Registrar Factura'}
                 </h2>
                 <form onSubmit={handleSaveInvoice} className="space-y-4">
                     
                     {/* Proveedor y Sede */}
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-medium mb-1">Proveedor</label>
                             <select className="w-full border p-2 rounded bg-white" 
                                value={invoiceForm.supplierId}
                                onChange={e => setInvoiceForm({...invoiceForm, supplierId: e.target.value})} required>
                                 <option value="">Seleccione Proveedor...</option>
                                 {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                             </select>
                         </div>
                         <div>
                             <label className="block text-sm font-medium mb-1">Sede</label>
                             <select className="w-full border p-2 rounded bg-white" 
                                value={invoiceForm.siteId}
                                onChange={e => setInvoiceForm({...invoiceForm, siteId: e.target.value})} required>
                                 <option value="">Seleccione Sede...</option>
                                 {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                             </select>
                         </div>
                     </div>

                     {/* Numero y Valor */}
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-medium mb-1">No. Factura</label>
                             <input className="w-full border p-2 rounded" placeholder="Ej: FE-1020" 
                                value={invoiceForm.number}
                                onChange={e => setInvoiceForm({...invoiceForm, number: e.target.value})} required />
                         </div>
                         <div>
                             <label className="block text-sm font-medium mb-1">Valor Total</label>
                             <div className="relative">
                                <DollarSign className="absolute left-2 top-2.5 text-gray-400" size={16} />
                                <input type="number" className="w-full pl-8 pr-4 py-2 border rounded" placeholder="0" 
                                    value={invoiceForm.total || ''}
                                    onChange={e => setInvoiceForm({...invoiceForm, total: Number(e.target.value)})} required />
                             </div>
                         </div>
                     </div>

                     {/* Fechas */}
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-sm font-medium mb-1">Fecha Radicación</label>
                             <input type="date" className="w-full border p-2 rounded" 
                                value={invoiceForm.date} 
                                onChange={e => setInvoiceForm({...invoiceForm, date: e.target.value})} required />
                        </div>
                        <div>
                             <label className="block text-sm font-medium mb-1">Fecha Vencimiento</label>
                             <input type="date" className="w-full border p-2 rounded" 
                                value={invoiceForm.dueDate} 
                                onChange={e => setInvoiceForm({...invoiceForm, dueDate: e.target.value})} />
                        </div>
                     </div>

                     {/* Estado (Solo edición o creación manual si se requiere) */}
                     <div>
                        <label className="block text-sm font-medium mb-1">Estado</label>
                        <select className="w-full border p-2 rounded bg-white"
                            value={invoiceForm.status || 'pending'}
                            onChange={e => setInvoiceForm({...invoiceForm, status: e.target.value as 'paid' | 'pending'})}
                        >
                            <option value="pending">Pendiente</option>
                            <option value="paid">Pagado</option>
                        </select>
                     </div>

                     {/* Descripcion */}
                     <div>
                         <label className="block text-sm font-medium mb-1">Servicio o Descripción</label>
                         <textarea className="w-full border p-2 rounded h-20" 
                            placeholder="Detalle de los servicios o productos facturados..."
                            value={invoiceForm.description}
                            onChange={e => setInvoiceForm({...invoiceForm, description: e.target.value})} required />
                     </div>

                     {/* Archivo */}
                     <div>
                        <label className="block text-sm font-medium mb-1">Cargar Factura (PDF/Imagen)</label>
                        <div className="flex items-center gap-2">
                             <input type="file" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                        </div>
                     </div>
                     
                     <div className="flex gap-3 pt-4 border-t mt-4">
                        <button type="button" onClick={closeInvoiceModal} className="flex-1 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancelar</button>
                        <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-semibold">
                            {editingInvoiceId ? 'Actualizar Factura' : 'Guardar Factura'}
                        </button>
                     </div>
                 </form>
             </div>
          </div>
      )}

    </div>
  );
};

export default Finance;