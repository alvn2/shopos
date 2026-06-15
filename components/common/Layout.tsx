import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Package, FileText, BarChart2, ClipboardList, AlertTriangle, Plus, Settings, LogOut, User, ChevronDown, Smartphone, History, Moon, Sun, Users } from 'lucide-react';
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
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const isWorker = user?.role === UserRole.WORKER;

    // Dark mode state — persisted to localStorage
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('shopos-theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true; // default dark
    });

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('shopos-theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('shopos-theme', 'light');
        }
    }, [isDark]);

    const toggleDark = useCallback(() => setIsDark(prev => !prev), []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 ${isActive
            ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
        }`;

    const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
        `flex flex-col items-center justify-center py-2 text-xs font-semibold transition-colors duration-200 ${isActive
            ? 'text-slate-900 dark:text-white scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
            {/* ===== DESKTOP TOP NAV ===== */}
            <header className="hidden lg:block fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 h-16 transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-5">
                        <NavLink to="/" className="flex items-center gap-3 group">
                            <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                                <Package className="text-white dark:text-slate-900" size={18} />
                            </div>
                            <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">ShopOS</span>
                        </NavLink>
                    </div>

                    {/* Main Nav */}
                    <nav className="flex items-center gap-1.5">
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
                        <NavLink to="/customers" className={navLinkClass}>
                            <Users size={16} />
                            Customers
                        </NavLink>
                    </nav>

                    {/* Dark Mode + User Menu */}
                    <div className="flex items-center gap-3">
                    <button
                        onClick={toggleDark}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {isDark ? (
                            <Sun size={18} className="hover:text-amber-400 transition-colors" />
                        ) : (
                            <Moon size={18} className="hover:text-slate-900 transition-colors" />
                        )}
                    </button>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        >
                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                <User size={14} className="text-slate-600 dark:text-slate-300" />
                            </div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{user?.full_name}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${user?.role === UserRole.ADMIN ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{user?.role}</span>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {userMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 animate-enter origin-top-right z-50">
                                    <div className="px-4 py-2 mb-1 border-b border-slate-100 dark:border-slate-800">
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Signed in as</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.username}</p>
                                    </div>
                                    <NavLink
                                        to="/active-sessions"
                                        onClick={() => setUserMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <Smartphone size={16} />
                                        Active Sessions
                                    </NavLink>
                                    {user?.role === UserRole.ADMIN && (
                                        <>
                                            <NavLink
                                                to="/settings"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                <Settings size={16} />
                                                Settings
                                            </NavLink>
                                            <NavLink
                                                to="/audit-log"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                <ClipboardList size={16} />
                                                Audit Log
                                            </NavLink>
                                        </>
                                    )}
                                    <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-3 w-full px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                    >
                                        <LogOut size={16} />
                                        Logout
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    </div> {/* end flex items-center gap-3 */}
                </div>
            </header>

            {/* ===== MOBILE HEADER ===== */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-5 transition-colors duration-300">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center">
                        <Package className="text-white dark:text-slate-900" size={16} />
                    </div>
                    <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">{title || 'ShopOS'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleDark}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        {isDark ? <Sun size={18} className="text-slate-400" /> : <Moon size={18} className="text-slate-500" />}
                    </button>
                </div>
            </header>

            {/* ===== MAIN CONTENT ===== */}
            <main className="relative pt-20 pb-24 lg:pt-24 lg:pb-10 z-10 transition-all duration-300">
                {children}
            </main>

            {/* ===== MOBILE BOTTOM NAV ===== */}
            <nav className="lg:hidden fixed bottom-6 left-4 right-4 z-40 glass-dropdown rounded-2xl h-16 border-white/20">
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
                            <NavLink to="/customers" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                <Users size={18} className="text-teal-500" /> Customers
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
