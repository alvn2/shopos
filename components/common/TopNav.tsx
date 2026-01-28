import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, Package, FileText, BarChart2, Menu, Settings, AlertTriangle, LogOut, Smartphone, ChevronDown, X, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';

const TopNav: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [moreOpen, setMoreOpen] = useState(false);

    const navItemClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${isActive
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg">
                        <Package className="text-white" size={22} />
                    </div>
                    <span className="font-bold text-xl text-gray-900 dark:text-white">ShopOS</span>
                </div>

                {/* Main Navigation */}
                <nav className="flex items-center gap-2">
                    <NavLink to="/" className={navItemClass}>
                        <Search size={18} />
                        <span>Search</span>
                    </NavLink>

                    <NavLink to="/inventory" className={navItemClass}>
                        <Package size={18} />
                        <span>Inventory</span>
                    </NavLink>

                    <NavLink to="/sales" className={navItemClass}>
                        <FileText size={18} />
                        <span>Sales Records</span>
                    </NavLink>

                    <NavLink to="/reports" className={navItemClass}>
                        <BarChart2 size={18} />
                        <span>Reports</span>
                    </NavLink>

                    <NavLink to="/low-stock" className={navItemClass}>
                        <AlertTriangle size={18} />
                        <span>Low Stock</span>
                    </NavLink>
                </nav>

                {/* User Menu */}
                <div className="relative">
                    <button
                        onClick={() => setMoreOpen(!moreOpen)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center">
                            <User size={16} className="text-brand-600 dark:text-brand-300" />
                        </div>
                        <span className="font-medium text-gray-700 dark:text-gray-200">{user?.full_name}</span>
                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {moreOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                                    <div className="font-medium text-gray-900 dark:text-white">{user?.full_name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</div>
                                </div>

                                <div className="py-1">
                                    <NavLink
                                        to="/active-sessions"
                                        onClick={() => setMoreOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                        <Smartphone size={18} />
                                        <span>Active Sessions</span>
                                    </NavLink>

                                    {user?.role === UserRole.ADMIN && (
                                        <>
                                            <NavLink
                                                to="/settings"
                                                onClick={() => setMoreOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                <Settings size={18} />
                                                <span>Settings</span>
                                            </NavLink>

                                            <NavLink
                                                to="/audit-log"
                                                onClick={() => setMoreOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                <FileText size={18} />
                                                <span>Audit Log</span>
                                            </NavLink>
                                        </>
                                    )}

                                    <div className="border-t dark:border-gray-700 my-1" />

                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        <LogOut size={18} />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopNav;
