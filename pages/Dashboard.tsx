import React, { useEffect, useState } from 'react';
import { getAssets, getActivities } from '../services/api';
import { Asset, Activity } from '../types';
import { Monitor, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const Dashboard = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [assetsData, activitiesData] = await Promise.all([getAssets(), getActivities()]);
      setAssets(assetsData);
      setActivities(activitiesData);
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) return <div>Cargando dashboard...</div>;

  // Stats calculation
  const totalAssets = assets.length;
  const assignedAssets = assets.filter(a => a.status === 'asignado').length;
  const maintenanceAssets = assets.filter(a => a.status === 'mantenimiento').length;
  const stockAssets = assets.filter(a => a.status === 'bodega').length;

  const dataStatus = [
    { name: 'Asignados', value: assignedAssets, color: '#10B981' }, // green
    { name: 'En Bodega', value: stockAssets, color: '#6366F1' }, // indigo
    { name: 'Mantenimiento', value: maintenanceAssets, color: '#F59E0B' }, // amber
    { name: 'De Baja', value: assets.length - assignedAssets - maintenanceAssets - stockAssets, color: '#EF4444' } // red
  ];

  const recentActivities = activities.slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Resumen General</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600 mr-4">
            <Monitor size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Activos</p>
            <p className="text-2xl font-bold">{totalAssets}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-green-100 rounded-full text-green-600 mr-4">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Asignados</p>
            <p className="text-2xl font-bold">{assignedAssets}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-indigo-100 rounded-full text-indigo-600 mr-4">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">En Bodega</p>
            <p className="text-2xl font-bold">{stockAssets}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-amber-100 rounded-full text-amber-600 mr-4">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Mantenimiento</p>
            <p className="text-2xl font-bold">{maintenanceAssets}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">Estado del Inventario</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dataStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">Actividad Reciente</h2>
          <div className="space-y-4">
            {recentActivities.map(activity => (
              <div key={activity.id} className="flex items-start pb-4 border-b last:border-0 border-gray-100">
                <div className={`mt-1 w-2 h-2 rounded-full mr-3 ${
                  activity.priority === 'alta' ? 'bg-red-500' : 
                  activity.priority === 'media' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <div>
                  <p className="font-medium text-sm text-gray-800">{activity.description}</p>
                  <p className="text-xs text-gray-500">{activity.date} - {activity.type}</p>
                </div>
              </div>
            ))}
            {recentActivities.length === 0 && <p className="text-gray-500 text-sm">No hay actividad reciente.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
