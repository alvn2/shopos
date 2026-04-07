import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/common/Layout';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { FileText, User, Search, Download, ChevronDown, ChevronUp, RefreshCw, Shield, ArrowRight } from 'lucide-react';

interface AuditLogEntry {
    timestamp: string;
    user: string;
    action: string;
    entity_type: string;
    entity_id: string;
    old_value: string;
    new_value: string;
    ip_address: string;
    device_info: string;
}

const actionColors: Record<string, string> = {
    LOGIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    LOGOUT: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    LOGOUT_ALL_DEVICES: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    STOCK_UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    STOCK_OVERRIDE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800/50',
    PRICE_CHANGE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800/50',
    SALE_RECORDED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800/50',
    SALE_STOCK_DEDUCTION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800/50',
    INVENTORY_UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    INVENTORY_CREATE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    INVENTORY_DELETE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    INVENTORY_SOFT_DELETE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    INVENTORY_BULK_IMPORT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50',
    SETTINGS_UPDATED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    LOGIN_FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    CUSTOMER_CREATE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800/50',
    CUSTOMER_PAYMENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800/50',
};

/** Parse JSON change values into human-readable summaries */
function parseChangeSummary(action: string, oldVal: string, newVal: string): string[] {
    const changes: string[] = [];
    try {
        const oldObj = oldVal ? JSON.parse(oldVal) : {};
        const newObj = newVal ? JSON.parse(newVal) : {};

        // Price changes
        const priceFields = [
            { key: 'Selling_Price', label: 'Selling Price' },
            { key: 'selling_price', label: 'Selling Price' },
            { key: 'AED_Buying_Price', label: 'AED Buy Price' },
            { key: 'aed_buying_price', label: 'AED Buy Price' },
            { key: 'KSH_Buying_Price', label: 'KSH Buy Price' },
            { key: 'ksh_buying_price', label: 'KSH Buy Price' },
        ];

        for (const f of priceFields) {
            if (newObj[f.key] !== undefined && oldObj[f.key] !== undefined && String(newObj[f.key]) !== String(oldObj[f.key])) {
                changes.push(`${f.label}: ${oldObj[f.key]} → ${newObj[f.key]}`);
            } else if (newObj[f.key] !== undefined && oldObj[f.key] === undefined) {
                changes.push(`${f.label} set to ${newObj[f.key]}`);
            }
        }

        // Stock changes
        const stockKeys = ['Stock_Qty', 'stock_qty'];
        for (const k of stockKeys) {
            if (newObj[k] !== undefined && oldObj[k] !== undefined && String(newObj[k]) !== String(oldObj[k])) {
                changes.push(`Stock: ${oldObj[k]} → ${newObj[k]}`);
            }
        }

        // Bulk import stats
        if (action === 'INVENTORY_BULK_IMPORT' && newObj.total_items) {
            changes.push(`${newObj.total_items} items processed`);
            if (newObj.created) changes.push(`${newObj.created} created`);
            if (newObj.updated) changes.push(`${newObj.updated} updated`);
        }

        // Sale total
        if (newObj.total_kes || newObj.Total_KES) {
            const total = newObj.total_kes || newObj.Total_KES;
            changes.push(`Total: KES ${Number(total).toLocaleString()}`);
        }
    } catch {
        // If JSON parsing fails, just return empty
    }
    return changes;
}

const AuditLog: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [totalLogs, setTotalLogs] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const logsPerPage = 50;

    // Filters
    const [filterUser, setFilterUser] = useState('All');
    const [filterAction, setFilterAction] = useState('All');
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Available filter options (fetched from API)
    const [availableUsers, setAvailableUsers] = useState<string[]>(['All']);
    const [availableActions, setAvailableActions] = useState<string[]>(['All']);

    // Check if admin
    if (user?.role !== 'admin') {
        return (
            <Layout title="Audit Log">
                <div className="min-h-[60vh] flex items-center justify-center p-4">
                    <div className="text-center">
                        <Shield size={64} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Admin Access Required</h1>
                        <p className="text-slate-500 dark:text-slate-400">You don&apos;t have permission to view the audit log.</p>
                    </div>
                </div>
            </Layout>
        );
    }

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.audit.getLogs({
                user: filterUser,
                action: filterAction,
                from: filterFrom,
                to: filterTo,
                search: searchTerm,
                page: currentPage,
                limit: logsPerPage
            });
            setLogs(result.logs || []);
            setTotalLogs(result.total || 0);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [filterUser, filterAction, filterFrom, filterTo, searchTerm, currentPage]);

    // Fetch filter options on mount
    useEffect(() => {
        const loadFilters = async () => {
            try {
                const [users, actions] = await Promise.all([
                    api.audit.getUsers(),
                    api.audit.getActions()
                ]);
                setAvailableUsers(['All', ...users]);
                setAvailableActions(['All', ...actions]);
            } catch (e) {
                console.error('Failed to load filter options:', e);
            }
        };
        loadFilters();
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const formatTime = (iso: string) => {
        const date = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const exportCSV = () => {
        const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Old Value', 'New Value', 'IP', 'Device'];
        const rows = logs.map(log => [log.timestamp, log.user, log.action, log.entity_type, log.entity_id, log.old_value, log.new_value, log.ip_address, log.device_info]);
        const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const totalPages = Math.ceil(totalLogs / logsPerPage);

    return (
        <Layout title="Audit Log">
            <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6 animate-enter">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400">
                                <FileText size={24} />
                            </div>
                            Audit Log
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">{totalLogs} total entries</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchLogs} className="btn-secondary flex items-center gap-2 !py-2.5">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button onClick={exportCSV} className="btn-primary !py-2.5 flex items-center gap-2">
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="card-modern p-5 space-y-4">
                    <div className="relative group">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input type="text" placeholder="Search entity ID, user..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="input-modern !pl-12" />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setCurrentPage(1); }} className="input-modern !py-2.5">
                            {availableUsers.map(u => <option key={u} value={u}>{u === 'All' ? 'All Users' : u}</option>)}
                        </select>
                        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setCurrentPage(1); }} className="input-modern !py-2.5">
                            {availableActions.map(a => <option key={a} value={a}>{a === 'All' ? 'All Actions' : a}</option>)}
                        </select>
                        <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setCurrentPage(1); }} className="input-modern !py-2.5" />
                        <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setCurrentPage(1); }} className="input-modern !py-2.5" />
                    </div>
                </div>

                {/* Logs List */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <RefreshCw className="animate-spin mb-3" size={32} />
                            <p className="font-medium">Loading logs...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20 card-modern p-8">
                            <FileText size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">No audit logs found</p>
                        </div>
                    ) : (
                        logs.map((log, index) => {
                            const changeSummary = parseChangeSummary(log.action, log.old_value, log.new_value);
                            return (
                            <div key={index} className="card-modern overflow-hidden">
                                <button onClick={() => setExpandedRow(expandedRow === index ? null : index)} className="w-full p-5 text-left">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${actionColors[log.action] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                                                {log.action}
                                            </span>
                                            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">{formatTime(log.timestamp)}</span>
                                        </div>
                                        <div className="text-slate-400">
                                            {expandedRow === index ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 text-sm">
                                        <User size={14} className="text-slate-400" />
                                        <span className="font-bold text-slate-900 dark:text-slate-100">{log.user}</span>
                                        <span className="text-slate-400">→</span>
                                        <span className="text-slate-600 dark:text-slate-300 truncate font-mono text-xs">{log.entity_type}: {(log.entity_id || '').substring(0, 16)}{(log.entity_id || '').length > 16 ? '...' : ''}</span>
                                    </div>
                                    {/* Inline change summary */}
                                    {changeSummary.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2.5">
                                            {changeSummary.map((change, ci) => (
                                                <span key={ci} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    <ArrowRight size={10} />
                                                    {change}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </button>

                                {expandedRow === index && (
                                    <div className="px-5 pb-5 pt-0 text-sm space-y-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 animate-slide-up">
                                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 pt-3 font-medium">
                                            <div>IP: <span className="font-mono">{log.ip_address}</span></div>
                                            <div className="truncate">Device: {log.device_info}</div>
                                        </div>
                                        <div className="text-xs">
                                            <span className="text-slate-500 font-medium">Full timestamp: </span>
                                            <span className="text-slate-700 dark:text-slate-300 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                        {log.old_value && (
                                            <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg border border-rose-200/50 dark:border-rose-800/50 text-xs">
                                                <div className="text-rose-600 dark:text-rose-400 font-bold mb-1">Old Value:</div>
                                                <code className="text-rose-700 dark:text-rose-300 break-all font-mono">{log.old_value}</code>
                                            </div>
                                        )}
                                        {log.new_value && (
                                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50 text-xs">
                                                <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1">New Value:</div>
                                                <code className="text-emerald-700 dark:text-emerald-300 break-all font-mono">{log.new_value}</code>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 py-4">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                        >
                            Previous
                        </button>
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default AuditLog;
