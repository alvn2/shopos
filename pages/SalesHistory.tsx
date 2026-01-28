import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/common/Layout';
import { api } from '../services/api';
import { History, Search, Calendar, Filter, Eye, ChevronDown, ChevronUp, Download, RefreshCw } from 'lucide-react';

interface SaleRecord {
    date: string;
    batch_id: string;
    items: Array<{
        name: string;
        part_number: string;
        qty: number;
        unit_price: number;
    }>;
    total_kes: number;
    payment_method: string;
    customer_name?: string;
    notes?: string;
    sold_by: string;
}

const SalesHistory: React.FC = () => {
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('All');

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        setLoading(true);
        try {
            const data = await api.sales.getAll();
            setSales(data);
        } catch (error) {
            console.error('Failed to fetch sales:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter sales
    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            // Search filter
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                const matchesReceipt = sale.batch_id.toLowerCase().includes(s);
                const matchesCustomer = (sale.customer_name || '').toLowerCase().includes(s);
                const matchesItems = sale.items.some(i =>
                    i.name.toLowerCase().includes(s) ||
                    i.part_number.toLowerCase().includes(s)
                );
                if (!matchesReceipt && !matchesCustomer && !matchesItems) return false;
            }

            // Date filter
            if (dateFrom && new Date(sale.date) < new Date(dateFrom)) return false;
            if (dateTo && new Date(sale.date) > new Date(dateTo + 'T23:59:59')) return false;

            // Payment filter
            if (paymentFilter !== 'All' && sale.payment_method !== paymentFilter) return false;

            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [sales, searchTerm, dateFrom, dateTo, paymentFilter]);

    // Totals
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total_kes, 0);
    const totalTransactions = filteredSales.length;

    const formatDate = (iso: string) => {
        const date = new Date(iso);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatTime = (iso: string) => {
        const date = new Date(iso);
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    const exportCSV = () => {
        const headers = ['Date', 'Receipt #', 'Items', 'Total (KES)', 'Payment', 'Customer', 'Sold By'];
        const rows = filteredSales.map(s => [
            formatDate(s.date),
            s.batch_id,
            s.items.map(i => `${i.qty}x ${i.name}`).join('; '),
            s.total_kes.toString(),
            s.payment_method,
            s.customer_name || '',
            s.sold_by
        ]);

        const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales_history_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <Layout title="Sales History">
            <div className="p-4 lg:p-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <History size={24} />
                            Sales History
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">View all recorded sales</p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={fetchSales}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button
                            onClick={exportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-6 space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by receipt #, customer, or item..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Payment</label>
                            <select
                                value={paymentFilter}
                                onChange={e => setPaymentFilter(e.target.value)}
                                className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                            >
                                <option value="All">All Methods</option>
                                <option value="Cash">Cash</option>
                                <option value="M-Pesa">M-Pesa</option>
                                <option value="Credit">Credit</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); setPaymentFilter('All'); }}
                                className="w-full p-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</div>
                        <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                            KES {totalRevenue.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Transactions</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {totalTransactions}
                        </div>
                    </div>
                </div>

                {/* Sales List */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <RefreshCw className="animate-spin mb-3" size={32} />
                            <p>Loading sales...</p>
                        </div>
                    ) : filteredSales.length === 0 ? (
                        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                            <History size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">No sales found</p>
                            <p className="text-sm">Try adjusting your filters or record a new sale</p>
                        </div>
                    ) : (
                        filteredSales.map(sale => (
                            <div
                                key={sale.batch_id}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                                {/* Sale Header */}
                                <button
                                    onClick={() => setExpandedId(expandedId === sale.batch_id ? null : sale.batch_id)}
                                    className="w-full p-4 text-left"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 dark:text-white">#{sale.batch_id}</span>
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${sale.payment_method === 'Cash' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                        sale.payment_method === 'M-Pesa' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                    }`}>
                                                    {sale.payment_method}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                {formatDate(sale.date)} at {formatTime(sale.date)}
                                                {sale.customer_name && <span> • {sale.customer_name}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="font-bold text-lg text-gray-900 dark:text-white">
                                                    KES {sale.total_kes.toLocaleString()}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {sale.items.reduce((sum, i) => sum + i.qty, 0)} items
                                                </div>
                                            </div>
                                            {expandedId === sale.batch_id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {expandedId === sale.batch_id && (
                                    <div className="border-t dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/50">
                                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Items Sold:</div>
                                        <div className="space-y-2">
                                            {sale.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">
                                                        {item.qty}x {item.name} <span className="text-gray-400 font-mono">({item.part_number})</span>
                                                    </span>
                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                        KES {(item.unit_price * item.qty).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {sale.notes && (
                                            <div className="mt-3 pt-3 border-t dark:border-gray-600">
                                                <div className="text-xs text-gray-500 mb-1">Notes:</div>
                                                <div className="text-sm text-gray-700 dark:text-gray-300">{sale.notes}</div>
                                            </div>
                                        )}
                                        <div className="mt-3 pt-3 border-t dark:border-gray-600 text-xs text-gray-500">
                                            Recorded by: {sale.sold_by}
                                        </div>
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

export default SalesHistory;
