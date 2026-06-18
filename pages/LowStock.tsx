import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/common/Layout';
import { useInventory } from '../contexts/InventoryContext';
import { api } from '../services/api';
import { InventoryItem } from '../types';
import { AlertTriangle, Package, MessageCircle, ArrowUpDown, RefreshCw, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

const LowStock: React.FC = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'stock' | 'name' | 'part'>('stock');
    const [sortAsc, setSortAsc] = useState(true);

    const fetchLowStock = async () => {
        setLoading(true);
        try {
            const res = await api.inventory.getPaginated(1, 2000, '', true) as any;
            setItems(Array.isArray(res) ? res : (res.items || []));
        } catch (err) {
            toast.error('Failed to load low stock items');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLowStock();
    }, []);

    const lowStockItems = useMemo(() => {
        return [...items].sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'stock') comparison = a.stock_qty - b.stock_qty;
            else if (sortBy === 'name') comparison = a.name.localeCompare(b.name);
            else comparison = a.part_number.localeCompare(b.part_number);
            return sortAsc ? comparison : -comparison;
        });
    }, [items, sortBy, sortAsc]);

    const outOfStock = lowStockItems.filter(i => i.stock_qty === 0);
    const needsReorder = lowStockItems.filter(i => i.stock_qty > 0);

    const handleSort = (field: 'stock' | 'name' | 'part') => {
        if (sortBy === field) setSortAsc(!sortAsc);
        else { setSortBy(field); setSortAsc(true); }
    };

    const handleReorder = (item: InventoryItem) => {
        const suggestedQty = item.min_stock * 2;
        const message = encodeURIComponent(
            `Hi, I need to reorder:\n\nPart: ${item.part_number}\nName: ${item.name}\nQuantity: ${suggestedQty}\nCurrent Stock: ${item.stock_qty}`
        );
        window.open(`https://wa.me/?text=${message}`, '_blank');
    };

    const exportToExcel = () => {
        const data = lowStockItems.map(item => ({
            'Part Number': item.part_number,
            'Make': item.make,
            'Name': item.name,
            'Current Stock': item.stock_qty,
            'Min Stock': item.min_stock,
            'Suggested Order': item.min_stock * 2 > item.stock_qty ? (item.min_stock * 2) - item.stock_qty : item.min_stock * 2
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Things to Buy");
        
        XLSX.writeFile(workbook, `Shopping_List_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <Layout title="Low Stock">
            <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6 animate-enter">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={24} />
                        </div>
                        Low Stock Alerts
                    </h1>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="card-modern p-5 border-l-4 border-l-rose-500">
                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-widest mb-2">
                            <Package size={16} />
                            Out of Stock
                        </div>
                        <div className="text-3xl font-extrabold text-rose-700 dark:text-rose-300">{outOfStock.length}</div>
                    </div>
                    <div className="card-modern p-5 border-l-4 border-l-amber-500">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">
                            <AlertTriangle size={16} />
                            Low Stock
                        </div>
                        <div className="text-3xl font-extrabold text-amber-700 dark:text-amber-300">{needsReorder.length}</div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button onClick={fetchLowStock} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button onClick={exportToExcel} className="flex-1 btn-primary flex items-center justify-center gap-2">
                        <FileSpreadsheet size={16} />
                        Export Excel
                    </button>
                </div>

                {/* Sort Controls */}
                <div className="flex gap-2 text-sm">
                    <span className="text-slate-500 dark:text-slate-400 font-medium py-2">Sort by:</span>
                    {(['stock', 'name', 'part'] as const).map(field => (
                        <button
                            key={field}
                            onClick={() => handleSort(field)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-all ${sortBy === field
                                ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            {field === 'stock' ? 'Stock' : field === 'name' ? 'Name' : 'Part #'}
                            {sortBy === field && <ArrowUpDown size={12} className={sortAsc ? 'rotate-180' : ''} />}
                        </button>
                    ))}
                </div>

                {/* Items List */}
                <div className="space-y-3">
                    {loading && lowStockItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <RefreshCw className="animate-spin mb-3" size={32} />
                            <p className="font-medium">Loading inventory...</p>
                        </div>
                    ) : lowStockItems.length === 0 ? (
                        <div className="text-center py-20 card-modern p-8">
                            <Package size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">All Stocked Up! 🎉</p>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">No items are below minimum stock levels.</p>
                        </div>
                    ) : (
                        lowStockItems.map(item => (
                            <div
                                key={item.uuid}
                                className={`card-modern p-5 border-l-4 ${item.stock_qty === 0 ? 'border-l-rose-500' : 'border-l-amber-500'}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg truncate">{item.name}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{item.part_number}</p>
                                    </div>
                                    <span className={`text-sm font-extrabold px-3 py-1.5 rounded-lg ${item.stock_qty === 0
                                        ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50'
                                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                                        }`}>
                                        {item.stock_qty === 0 ? 'OUT' : item.stock_qty}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center text-sm">
                                    <div className="text-slate-500 dark:text-slate-400 font-medium">
                                        Min: <span className="font-bold">{item.min_stock}</span> • Suggest order: <span className="font-bold text-slate-700 dark:text-slate-300">{item.min_stock * 2}</span>
                                    </div>
                                    <button
                                        onClick={() => handleReorder(item)}
                                        className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        <MessageCircle size={16} />
                                        Reorder
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default LowStock;
