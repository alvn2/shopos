import React, { useState, useEffect } from 'react';
import Layout from '../components/common/Layout';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { FileText, User, Search, Download, ChevronDown, ChevronUp, RefreshCw, Shield } from 'lucide-react';

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
    SALE_RECORDED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800/50',
    SALE_STOCK_DEDUCTION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800/50',
    INVENTORY_UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    INVENTORY_CREATE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    INVENTORY_DELETE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    SETTINGS_UPDATED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    LOGIN_FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
};

const AuditLog: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    // Filters
    const [filterUser, setFilterUser] = useState('All');
    const [filterAction, setFilterAction] = useState('All');
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

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

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const mockLogs: AuditLogEntry[] = [
                {
                    timestamp: new Date().toISOString(), user: 'admin', action: 'LOGIN',
                    entity_type: 'AUTH', entity_id: 'sess_abc123', old_value: '',
                    new_value: '{"device_info":"Chrome on Windows"}', ip_address: '192.168.1.1', device_info: 'Chrome/120.0'
                },
                {
                    timestamp: new Date(Date.now() - 3600000).toISOString(), user: 'admin', action: 'STOCK_UPDATE',
                    entity_type: 'INVENTORY', entity_id: '550e8400-e29b-41d4-a716-446655440000',
                    old_value: '{"stock_qty":15}', new_value: '{"stock_qty":12}',
                    ip_address: '192.168.1.1', device_info: 'Chrome/120.0'
                },
                {
                    timestamp: new Date(Date.now() - 7200000).toISOString(), user: 'counter', action: 'SALE_RECORDED',
                    entity_type: 'SALES', entity_id: 'RCPT-0042', old_value: '',
                    new_value: '{"total_kes":4500}', ip_address: '192.168.1.5', device_info: 'Safari/iOS'
                }
            ];
            setLogs(mockLogs);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        if (filterUser !== 'All' && log.user !== filterUser) return false;
        if (filterAction !== 'All' && log.action !== filterAction) return false;
        if (filterFrom && new Date(log.timestamp) < new Date(filterFrom)) return false;
        if (filterTo && new Date(log.timestamp) > new Date(filterTo)) return false;
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            if (!log.entity_id.toLowerCase().includes(search) && !log.user.toLowerCase().includes(search) && !log.action.toLowerCase().includes(search)) return false;
        }
        return true;
    });

    const uniqueUsers = ['All', ...new Set(logs.map(l => l.user))];
    const uniqueActions = ['All', ...new Set(logs.map(l => l.action))];

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
        const rows = filteredLogs.map(log => [log.timestamp, log.user, log.action, log.entity_type, log.entity_id, log.old_value, log.new_value, log.ip_address, log.device_info]);
        const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

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
                        <input type="text" placeholder="Search entity ID, user..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-modern !pl-12" />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="input-modern !py-2.5">
                            {uniqueUsers.map(u => <option key={u} value={u}>{u === 'All' ? 'All Users' : u}</option>)}
                        </select>
                        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="input-modern !py-2.5">
                            {uniqueActions.map(a => <option key={a} value={a}>{a === 'All' ? 'All Actions' : a}</option>)}
                        </select>
                        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="input-modern !py-2.5" />
                        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="input-modern !py-2.5" />
                    </div>
                </div>

                {/* Logs List */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <RefreshCw className="animate-spin mb-3" size={32} />
                            <p className="font-medium">Loading logs...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="text-center py-20 card-modern p-8">
                            <FileText size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">No audit logs found</p>
                        </div>
                    ) : (
                        filteredLogs.map((log, index) => (
                            <div key={index} className="card-modern overflow-hidden">
                                <button onClick={() => setExpandedRow(expandedRow === index ? null : index)} className="w-full p-5 text-left">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${actionColors[log.action] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
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
                                        <span className="text-slate-600 dark:text-slate-300 truncate font-mono text-xs">{log.entity_type}: {log.entity_id.substring(0, 16)}...</span>
                                    </div>
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
                        ))
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default AuditLog;
