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
    const isWorker = user?.role === UserRole.WORKER;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${isActive
            ? 'bg-white/90 text-brand-700 shadow-sm dark:bg-slate-800/80 dark:text-brand-300 border border-black/5 dark:border-white/5'
            : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-sm'
        }`;

    const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
        `flex flex-col items-center justify-center py-2 text-xs font-medium transition-all duration-300 ${isActive
            ? 'text-brand-600 dark:text-brand-400 scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
            {/* Background Accents (Visible in both modes but prominent in dark) */}
            <div className="fixed inset-0 pointer-events-none opacity-40 dark:opacity-20 transition-opacity duration-500 mix-blend-multiply dark:mix-blend-screen bg-mesh-light dark:bg-mesh-dark"></div>

            {/* ===== DESKTOP TOP NAV ===== */}
            <header className="hidden lg:block fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 h-16 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
                    {/* Logo + Sync Indicator */}
                    <div className="flex items-center gap-5">
                        <NavLink to="/" className="flex items-center gap-3 group">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-brand-500 to-cyan-400 rounded-xl shadow-glow shadow-brand-500/30 flex items-center justify-center transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3">
                                <Package className="text-white" size={20} />
                            </div>
                            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">ShopOS</span>
                        </NavLink>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <SyncIndicator />
                    </div>

                    {/* Main Nav */}
                    <nav className="flex items-center gap-1">
                        <NavLink to="/" className={navLinkClass} end>
                            <Package size={16} />
                            Inventory
                        </NavLink>
                        {/* Desktop Add Item Nav */}
                        {!isWorker && (
                            <NavLink to="/add-item" className={navLinkClass}>
                                <Plus size={16} />
                                Add Item
                            </NavLink>
                        )}
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
                            className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full glass-panel hover:shadow-md transition-all duration-300"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 border border-white/40 dark:border-white/10 flex items-center justify-center shadow-sm">
                                <User size={16} className="text-slate-600 dark:text-slate-300" />
                            </div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{user?.full_name}</span>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {userMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                <div className="absolute right-0 top-full mt-3 w-56 glass-dropdown rounded-2xl py-2 animate-enter origin-top-right">
                                    <div className="px-4 py-2 mb-1 border-b border-slate-100/50 dark:border-slate-700/50">
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Signed in as</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.username}</p>
                                    </div>
                                    <NavLink
                                        to="/active-sessions"
                                        onClick={() => setUserMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors"
                                    >
                                        <Smartphone size={16} />
                                        Active Sessions
                                    </NavLink>
                                    {user?.role === UserRole.ADMIN && (
                                        <>
                                            <NavLink
                                                to="/settings"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors"
                                            >
                                                <Settings size={16} />
                                                Settings
                                            </NavLink>
                                            <NavLink
                                                to="/audit-log"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors"
                                            >
                                                <ClipboardList size={16} />
                                                Audit Log
                                            </NavLink>
                                        </>
                                    )}
                                    <div className="border-t border-slate-100/50 dark:border-slate-700/50 my-1" />
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
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
            <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 h-16 flex items-center justify-between px-5 transition-all duration-300">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-brand-500 to-cyan-400 rounded-xl shadow-glow shadow-brand-500/30 flex items-center justify-center">
                        <Package className="text-white" size={18} />
                    </div>
                    <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">{title || 'ShopOS'}</span>
                </div>
                <SyncIndicator />
            </header>

            {/* ===== MAIN CONTENT ===== */}
            <main className="relative pt-20 pb-24 lg:pt-24 lg:pb-10 z-10 transition-all duration-300">
                {children}
            </main>

            {/* ===== MOBILE BOTTOM NAV ===== */}
            <nav className="lg:hidden fixed bottom-6 left-4 right-4 z-50 glass-dropdown rounded-2xl h-16 border-white/20">
                <div className={`grid h-full ${isWorker ? 'grid-cols-4' : 'grid-cols-5'}`}>
                    <NavLink to="/" className={mobileNavClass} end>
                        <Package size={22} />
                        <span>Inventory</span>
                    </NavLink>
                    {!isWorker && (
                        <NavLink to="/add-item" className={mobileNavClass}>
                            <Plus size={22} />
                            <span>Add</span>
                        </NavLink>
                    )}
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
                        className={`flex flex-col items-center justify-center py-2 text-xs font-medium transition-all duration-300 ${userMenuOpen ? 'text-brand-600 dark:text-brand-400 scale-105' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Settings size={22} />
                        <span className="mt-1">More</span>
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {userMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm" onClick={() => setUserMenuOpen(false)}>
                    <div className="absolute bottom-24 right-4 w-64 glass-dropdown rounded-2xl overflow-hidden py-2 animate-enter origin-bottom-right">
                        <div className="px-5 py-3 border-b border-slate-100/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50">
                            <div className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-0.5">Account</div>
                            <div className="font-bold text-slate-900 dark:text-white truncate">{user?.full_name}</div>
                        </div>

                        <div className="py-2">
                            <NavLink to="/reports" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                <BarChart2 size={18} className="text-slate-400 dark:text-slate-500" /> Reports
                            </NavLink>
                            <NavLink to="/low-stock" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                <AlertTriangle size={18} className="text-amber-500" /> Alerts
                            </NavLink>

                            {user?.role === UserRole.ADMIN && (
                                <>
                                    <NavLink to="/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                        <Settings size={18} className="text-slate-400 dark:text-slate-500" /> Settings
                                    </NavLink>
                                    <NavLink to="/audit-log" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                        <ClipboardList size={18} className="text-slate-400 dark:text-slate-500" /> Audit Log
                                    </NavLink>
                                </>
                            )}

                            <div className="border-t border-slate-100/50 dark:border-slate-700/50 my-2"></div>

                            <NavLink to="/active-sessions" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                <Smartphone size={18} className="text-slate-400 dark:text-slate-500" /> Active Sessions
                            </NavLink>

                            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-left mt-1">
                                <LogOut size={18} /> Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
