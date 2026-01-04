import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Monitor, 
  ClipboardList, 
  Building2, 
  Users, 
  LogOut, 
  Menu,
  FileText
} from 'lucide-react';
import { auth } from '../firebase';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = React.useState(true);
  
  // Check if we are in demo mode for UI display
  const isDemo = localStorage.getItem('demoMode') === 'true';
  const userEmail = isDemo ? 'demo@local' : auth.currentUser?.email;

  const handleLogout = async () => {
    if (isDemo) {
      localStorage.removeItem('demoMode');
      navigate('/login');
      // Force reload to reset API mode
      window.location.reload();
    } else {
      await auth.signOut();
      navigate('/login');
    }
  };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/assets', label: 'Inventario', icon: Monitor },
    { path: '/activities', label: 'Bitácora', icon: ClipboardList },
    { path: '/finance', label: 'Proveedores y Costos', icon: FileText },
    // { path: '/admin', label: 'Administración', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-white transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
        <div className="h-16 flex items-center justify-center border-b border-slate-700">
          {isSidebarOpen ? <span className="text-xl font-bold tracking-wider">IT Manager</span> : <Monitor size={24} />}
        </div>
        
        <nav className="flex-1 py-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center px-4 py-3 hover:bg-slate-800 transition-colors ${isActive ? 'bg-slate-800 border-l-4 border-blue-500' : ''}`}
                  >
                    <Icon size={20} className="min-w-[20px]" />
                    {isSidebarOpen && <span className="ml-3 truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-2 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="ml-3">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 z-10">
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 rounded hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <div className="flex items-center space-x-4">
            {isDemo && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-bold">MODO DEMO</span>}
            <span className="text-sm text-gray-600">Usuario: {userEmail}</span>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              {userEmail?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;