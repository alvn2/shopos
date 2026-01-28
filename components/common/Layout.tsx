import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Package, FileText, BarChart2, ClipboardList, AlertTriangle, Plus, Settings, LogOut, User, ChevronDown, Smartphone, History } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SyncIndicator } from '../../contexts/OfflineContext';
import { UserRole } from '../../types';

interface LayoutProps {
    children: React.ReactNode;
    title?: string;
}

/**
 * Main Layout - Provides consistent navigation across all pages
 * - Desktop: Top navigation bar
 * - Mobile: Bottom navigation bar
 */
const Layout: React.FC<LayoutProps> = ({ children, title }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [userMenuOpen, setUserMenuOpen] = React.useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`;

    const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
        `flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${isActive
            ? 'text-brand-600 dark:text-brand-400'
            : 'text-gray-500 dark:text-gray-400'
        }`;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* ===== DESKTOP TOP NAV ===== */}
            <header className="hidden lg:block fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    {/* Logo + Sync Indicator */}
                    <div className="flex items-center gap-4">
                        <NavLink to="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
                                <Package className="text-white" size={18} />
                            </div>
                            <span className="font-bold text-lg text-gray-900 dark:text-white">ShopOS</span>
                        </NavLink>
                        <SyncIndicator />
                    </div>

                    {/* Main Nav */}
                    <nav className="flex items-center gap-1">
                        <NavLink to="/" className={navLinkClass} end>
                            <Package size={16} />
                            Inventory
                        </NavLink>
                        <NavLink to="/add-item" className={navLinkClass}>
                            <Plus size={16} />
                            Add Item
                        </NavLink>
                        <NavLink to="/sales" className={navLinkClass}>
                            <FileText size={16} />
                            Record Sale
                        </NavLink>
                        <NavLink to="/sales-history" className={navLinkClass}>
                            <History size={16} />
                            Sales History
                        </NavLink>
                        <NavLink to="/reports" className={navLinkClass}>
                            <BarChart2 size={16} />
                            Reports
                        </NavLink>
                        <NavLink to="/low-stock" className={navLinkClass}>
                            <AlertTriangle size={16} />
                            Alerts
                        </NavLink>
                    </nav>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center">
                                <User size={14} className="text-brand-600 dark:text-brand-300" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.full_name}</span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {userMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1">
                                    <NavLink
                                        to="/active-sessions"
                                        onClick={() => setUserMenuOpen(false)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                        <Smartphone size={16} />
                                        Active Sessions
                                    </NavLink>
                                    {user?.role === UserRole.ADMIN && (
                                        <>
                                            <NavLink
                                                to="/settings"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                <Settings size={16} />
                                                Settings
                                            </NavLink>
                                            <NavLink
                                                to="/audit-log"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                <ClipboardList size={16} />
                                                Audit Log
                                            </NavLink>
                                        </>
                                    )}
                                    <div className="border-t dark:border-gray-700 my-1" />
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        <LogOut size={16} />
                                        Logout
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* ===== MOBILE HEADER ===== */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-14 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
                        <Package className="text-white" size={18} />
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">{title || 'ShopOS'}</span>
                </div>
                <SyncIndicator />
            </header>

            {/* ===== MAIN CONTENT ===== */}
            <main className="pt-14 pb-20 lg:pb-6">
                {children}
            </main>

            {/* ===== MOBILE BOTTOM NAV ===== */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 h-16">
                <div className="grid grid-cols-5 h-full">
                    <NavLink to="/" className={mobileNavClass} end>
                        <Package size={22} />
                        <span>Inventory</span>
                    </NavLink>
                    <NavLink to="/add-item" className={mobileNavClass}>
                        <Plus size={22} />
                        <span>Add</span>
                    </NavLink>
                    <NavLink to="/sales" className={mobileNavClass}>
                        <FileText size={22} />
                        <span>Record</span>
                    </NavLink>
                    <NavLink to="/sales-history" className={mobileNavClass}>
                        <History size={22} />
                        <span>History</span>
                    </NavLink>

                    <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)} // Reuse userMenuOpen state for mobile menu
                        className={`flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${userMenuOpen ? 'text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        <Settings size={22} />
                        <span>More</span>
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {userMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setUserMenuOpen(false)}>
                    <div className="absolute bottom-16 right-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden py-1">
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Menu</div>
                            <div className="font-medium truncate">{user?.full_name}</div>
                        </div>

                        <NavLink to="/reports" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <BarChart2 size={18} /> Reports
                        </NavLink>
                        <NavLink to="/low-stock" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <AlertTriangle size={18} /> Alerts
                        </NavLink>

                        {user?.role === UserRole.ADMIN && (
                            <>
                                <NavLink to="/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <Settings size={18} /> Settings
                                </NavLink>
                                <NavLink to="/audit-log" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <ClipboardList size={18} /> Audit Log
                                </NavLink>
                            </>
                        )}

                        <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>

                        <NavLink to="/active-sessions" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <Smartphone size={18} /> Active Sessions
                        </NavLink>

                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-left">
                            <LogOut size={18} /> Logout
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
