import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, Settings, Menu, X, Package, Warehouse, Building2 } from 'lucide-react';
import { useWarehouse } from '../contexts/WarehouseContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { activeWarehouseId, setActiveWarehouseId, warehouses } = useWarehouse();

  const navItems = [
    { path: '/', label: '库存查询', icon: <LayoutDashboard size={20} /> },
    { path: '/outbound', label: '出库管理', icon: <LogOut size={20} /> },
    { path: '/categories', label: '库存管理', icon: <Settings size={20} /> },
    { path: '/warehouses', label: '仓库管理', icon: <Building2 size={20} /> },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-2 font-bold text-xl">
                <Package className="text-blue-400" />
                <span>LiteWMS</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="lg:hidden text-slate-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Warehouse Switcher */}
            <div className="p-4 border-b border-slate-800">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block flex items-center gap-2">
                    <Warehouse size={14} /> 当前仓库
                </label>
                <select
                    value={activeWarehouseId}
                    onChange={(e) => setActiveWarehouseId(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:bg-slate-750"
                >
                    {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                </select>
            </div>

            {/* Nav */}
            <nav className="p-4 space-y-2 flex-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive(item.path) 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="p-4 text-xs text-slate-500 text-center">
                Keen 2025
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h1 className="font-semibold text-gray-800">
             {navItems.find(i => i.path === location.pathname)?.label || 'CableFlow'}
          </h1>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

