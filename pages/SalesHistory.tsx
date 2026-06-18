import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/common/Layout';
import { api } from '../services/api';
import { History, Search, Calendar, Download, RefreshCw, ChevronDown, ChevronUp, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

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
            const data = await api.sales.getAll() as any;
            if (Array.isArray(data)) {
                setSales(data);
            } else if (data && Array.isArray(data.sales)) {
                setSales(data.sales);
            } else {
                setSales([]);
            }
        } catch (error) {
            console.error('Failed to fetch sales:', error);
            setSales([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredSales = useMemo(() => {
        if (!Array.isArray(sales)) return [];
        return sales.filter(sale => {
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                const matchesReceipt = sale.batch_id.toLowerCase().includes(s);
                const matchesCustomer = (sale.customer_name || '').toLowerCase().includes(s);
                const matchesItems = sale.items.some(i =>
                    i.name.toLowerCase().includes(s) || i.part_number.toLowerCase().includes(s)
                );
                if (!matchesReceipt && !matchesCustomer && !matchesItems) return false;
            }
            if (dateFrom && new Date(sale.date) < new Date(dateFrom)) return false;
            if (dateTo && new Date(sale.date) > new Date(dateTo + 'T23:59:59')) return false;
            if (paymentFilter !== 'All' && sale.payment_method !== paymentFilter) return false;
            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [sales, searchTerm, dateFrom, dateTo, paymentFilter]);

    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total_kes, 0);
    const totalTransactions = filteredSales.length;

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const exportToExcel = () => {
        const data = filteredSales.map(s => ({
            'Date': formatDate(s.date),
            'Time': formatTime(s.date),
            'Receipt #': s.batch_id,
            'Items': s.items.map(i => `${i.qty}x ${i.name}`).join('; '),
            'Total (KES)': s.total_kes,
            'Payment': s.payment_method,
            'Customer': s.customer_name || '',
            'Sold By': s.sold_by
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sales History");

        XLSX.writeFile(workbook, `Sales_History_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const paymentBadgeClass = (method: string) => {
        switch (method) {
            case 'Cash': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50';
            case 'M-Pesa': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/50';
            default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/50';
        }
    };

    return (
        <Layout title="Sales History">
            <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6 animate-enter">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Sales History</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">View all recorded sales transactions</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchSales} className="btn-secondary flex items-center gap-2 !py-2.5">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button onClick={exportToExcel} className="btn-primary !py-2.5 flex items-center gap-2">
                            <FileSpreadsheet size={16} />
                            Export Excel
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="card-modern p-5 space-y-4">
                    <div className="relative group">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by receipt #, customer, or item..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="input-modern !pl-12"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">From</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-modern !py-2.5" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">To</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-modern !py-2.5" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Payment</label>
                            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="input-modern !py-2.5">
                                <option value="All">All Methods</option>
                                <option value="Cash">Cash</option>
                                <option value="M-Pesa">M-Pesa</option>
                                <option value="Credit">Credit</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); setPaymentFilter('All'); }}
                                className="w-full py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="card-modern p-5">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Revenue</div>
                        <div className="text-2xl font-extrabold text-brand-600 dark:text-brand-400">KES {totalRevenue.toLocaleString()}</div>
                    </div>
                    <div className="card-modern p-5">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Transactions</div>
                        <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalTransactions}</div>
                    </div>
                </div>

                {/* Sales List */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <RefreshCw className="animate-spin mb-3" size={32} />
                            <p className="font-medium">Loading sales...</p>
                        </div>
                    ) : filteredSales.length === 0 ? (
                        <div className="text-center py-20 card-modern p-8">
                            <History size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">No sales found</p>
                            <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or record a new sale</p>
                        </div>
                    ) : (
                        filteredSales.map(sale => (
                            <div key={sale.batch_id} className="card-modern overflow-hidden hover:border-brand-300 dark:hover:border-brand-500/50 transition-colors">
                                <button
                                    onClick={() => setExpandedId(expandedId === sale.batch_id ? null : sale.batch_id)}
                                    className="w-full p-5 text-left"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="font-bold text-slate-900 dark:text-white text-lg">#{sale.batch_id}</span>
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${paymentBadgeClass(sale.payment_method)}`}>
                                                    {sale.payment_method}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                                                {formatDate(sale.date)} at {formatTime(sale.date)}
                                                {sale.customer_name && <span> • <span className="text-slate-700 dark:text-slate-300">{sale.customer_name}</span></span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="font-extrabold text-lg text-slate-900 dark:text-white">KES {sale.total_kes.toLocaleString()}</div>
                                                <div className="text-xs text-slate-400 font-medium">{sale.items.reduce((sum, i) => sum + i.qty, 0)} items</div>
                                            </div>
                                            <div className="text-slate-400">
                                                {expandedId === sale.batch_id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                {expandedId === sale.batch_id && (
                                    <div className="border-t border-slate-200 dark:border-slate-700 p-5 bg-slate-50/50 dark:bg-slate-900/50 animate-slide-up space-y-3">
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Items Sold</div>
                                        <div className="space-y-2">
                                            {sale.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-sm">
                                                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                                                        {item.qty}× {item.name} <span className="text-slate-400 font-mono text-xs">({item.part_number})</span>
                                                    </span>
                                                    <span className="font-bold text-slate-900 dark:text-white">KES {(item.unit_price * item.qty).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {sale.notes && (
                                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                                <div className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Notes</div>
                                                <div className="text-sm text-slate-700 dark:text-slate-300">{sale.notes}</div>
                                            </div>
                                        )}
                                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 font-medium">
                                            Recorded by: <span className="text-slate-600 dark:text-slate-300">{sale.sold_by}</span>
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
