import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, Package, PlusCircle, BarChart2, Menu, Settings, AlertTriangle, LogOut, Smartphone, FileText, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';

const BottomNav: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive
      ? 'text-brand-600 dark:text-brand-500'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
    }`;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`fixed bottom-16 right-0 w-64 bg-white dark:bg-gray-800 rounded-tl-2xl shadow-2xl z-50 transform transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{user?.full_name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</div>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="p-2 text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="py-2">
          <NavLink
            to="/low-stock"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <AlertTriangle size={20} />
            <span>Low Stock Alerts</span>
          </NavLink>

          <NavLink
            to="/active-sessions"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Smartphone size={20} />
            <span>Active Sessions</span>
          </NavLink>

          {user?.role === UserRole.ADMIN && (
            <>
              <NavLink
                to="/settings"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Settings size={20} />
                <span>Settings</span>
              </NavLink>

              <NavLink
                to="/audit-log"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FileText size={20} />
                <span>Audit Log</span>
              </NavLink>
            </>
          )}

          <div className="border-t dark:border-gray-700 mt-2 pt-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 h-16 pb-safe">
        <div className="grid grid-cols-5 h-full max-w-lg mx-auto">
          <NavLink to="/" className={navItemClass}>
            <Search size={24} />
            <span className="text-[10px] font-medium">Search</span>
          </NavLink>

          <NavLink to="/inventory" className={navItemClass}>
            <Package size={24} />
            <span className="text-[10px] font-medium">Inventory</span>
          </NavLink>

          <NavLink to="/sales" className={navItemClass}>
            <div className="relative -mt-4 bg-brand-600 rounded-full p-3 shadow-lg">
              <PlusCircle size={28} className="text-white" />
            </div>
          </NavLink>

          <NavLink to="/reports" className={navItemClass}>
            <BarChart2 size={24} />
            <span className="text-[10px] font-medium">Reports</span>
          </NavLink>

          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${drawerOpen
              ? 'text-brand-600 dark:text-brand-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
          >
            <Menu size={24} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;