import React, { useState, useEffect } from 'react';
import Header from '../components/common/Header';
import BottomNav from '../components/common/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { FileText, User, Calendar, Search, Download, ChevronDown, ChevronUp, RefreshCw, Shield } from 'lucide-react';

interface AuditLog {
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
    LOGIN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    LOGOUT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    LOGOUT_ALL_DEVICES: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    STOCK_UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    SALE_RECORDED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    SALE_STOCK_DEDUCTION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    INVENTORY_UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    INVENTORY_CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    INVENTORY_DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    SETTINGS_UPDATED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    LOGIN_FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const AuditLog: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
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
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <Shield size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Admin Access Required</h1>
                    <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view the audit log.</p>
                </div>
            </div>
        );
    }

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // For now, use mock data since we don't have real API connected yet
            const mockLogs: AuditLog[] = [
                {
                    timestamp: new Date().toISOString(),
                    user: 'admin',
                    action: 'LOGIN',
                    entity_type: 'AUTH',
                    entity_id: 'sess_abc123',
                    old_value: '',
                    new_value: '{"device_info":"Chrome on Windows"}',
                    ip_address: '192.168.1.1',
                    device_info: 'Chrome/120.0'
                },
                {
                    timestamp: new Date(Date.now() - 3600000).toISOString(),
                    user: 'admin',
                    action: 'STOCK_UPDATE',
                    entity_type: 'INVENTORY',
                    entity_id: '550e8400-e29b-41d4-a716-446655440000',
                    old_value: '{"stock_qty":15}',
                    new_value: '{"stock_qty":12}',
                    ip_address: '192.168.1.1',
                    device_info: 'Chrome/120.0'
                },
                {
                    timestamp: new Date(Date.now() - 7200000).toISOString(),
                    user: 'counter',
                    action: 'SALE_RECORDED',
                    entity_type: 'SALES',
                    entity_id: 'RCPT-0042',
                    old_value: '',
                    new_value: '{"total_kes":4500}',
                    ip_address: '192.168.1.5',
                    device_info: 'Safari/iOS'
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
            if (
                !log.entity_id.toLowerCase().includes(search) &&
                !log.user.toLowerCase().includes(search) &&
                !log.action.toLowerCase().includes(search)
            ) return false;
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
        const rows = filteredLogs.map(log => [
            log.timestamp,
            log.user,
            log.action,
            log.entity_type,
            log.entity_id,
            log.old_value,
            log.new_value,
            log.ip_address,
            log.device_info
        ]);

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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            <Header
                title={
                    <div className="flex items-center gap-2">
                        <FileText size={20} />
                        <span>Audit Log</span>
                    </div>
                }
            />

            {/* Filters */}
            <div className="p-4 space-y-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                {/* Search */}
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search entity ID, user..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                </div>

                {/* Dropdowns */}
                <div className="grid grid-cols-2 gap-2">
                    <select
                        value={filterUser}
                        onChange={e => setFilterUser(e.target.value)}
                        className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                        {uniqueUsers.map(u => (
                            <option key={u} value={u}>{u === 'All' ? 'All Users' : u}</option>
                        ))}
                    </select>
                    <select
                        value={filterAction}
                        onChange={e => setFilterAction(e.target.value)}
                        className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                        {uniqueActions.map(a => (
                            <option key={a} value={a}>{a === 'All' ? 'All Actions' : a}</option>
                        ))}
                    </select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="date"
                        value={filterFrom}
                        onChange={e => setFilterFrom(e.target.value)}
                        className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="From"
                    />
                    <input
                        type="date"
                        value={filterTo}
                        onChange={e => setFilterTo(e.target.value)}
                        className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="To"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={fetchLogs}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={exportCSV}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-brand-600 text-white rounded-lg"
                    >
                        <Download size={16} />
                        Export
                    </button>
                </div>
            </div>

            {/* Logs List */}
            <div className="p-4 space-y-2 max-w-lg mx-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <RefreshCw className="animate-spin mb-3" size={32} />
                        <p>Loading logs...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                        <FileText size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No audit logs found</p>
                    </div>
                ) : (
                    filteredLogs.map((log, index) => (
                        <div
                            key={index}
                            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
                        >
                            <button
                                onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                                className="w-full p-3 text-left"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${actionColors[log.action] || 'bg-gray-100 text-gray-700'}`}>
                                            {log.action}
                                        </span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            {formatTime(log.timestamp)}
                                        </span>
                                    </div>
                                    {expandedRow === index ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 text-sm">
                                    <User size={14} className="text-gray-400" />
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{log.user}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-gray-600 dark:text-gray-300 truncate">
                                        {log.entity_type}: {log.entity_id.substring(0, 12)}...
                                    </span>
                                </div>
                            </button>

                            {expandedRow === index && (
                                <div className="px-3 pb-3 pt-0 text-sm space-y-2 border-t dark:border-gray-700">
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2">
                                        <div>IP: {log.ip_address}</div>
                                        <div className="truncate">Device: {log.device_info}</div>
                                    </div>
                                    <div className="text-xs">
                                        <span className="text-gray-500">Full timestamp: </span>
                                        <span className="text-gray-700 dark:text-gray-300">{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                    {log.old_value && (
                                        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-xs">
                                            <div className="text-red-600 dark:text-red-400 font-medium mb-1">Old Value:</div>
                                            <code className="text-red-700 dark:text-red-300 break-all">{log.old_value}</code>
                                        </div>
                                    )}
                                    {log.new_value && (
                                        <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-xs">
                                            <div className="text-green-600 dark:text-green-400 font-medium mb-1">New Value:</div>
                                            <code className="text-green-700 dark:text-green-300 break-all">{log.new_value}</code>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <BottomNav />
        </div>
    );
};

export default AuditLog;
