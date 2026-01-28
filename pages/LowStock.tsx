import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/common/Layout';
import { useInventory } from '../contexts/InventoryContext';
import { AlertTriangle, Package, Download, MessageCircle, ArrowUpDown, RefreshCw } from 'lucide-react';

const LowStock: React.FC = () => {
    const { items, loading, refreshInventory } = useInventory();
    const [sortBy, setSortBy] = useState<'stock' | 'name' | 'part'>('stock');
    const [sortAsc, setSortAsc] = useState(true);

    const lowStockItems = useMemo(() => {
        const filtered = items.filter(item => item.stock_qty <= item.min_stock);

        return filtered.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'stock') {
                comparison = a.stock_qty - b.stock_qty;
            } else if (sortBy === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else {
                comparison = a.part_number.localeCompare(b.part_number);
            }
            return sortAsc ? comparison : -comparison;
        });
    }, [items, sortBy, sortAsc]);

    const outOfStock = lowStockItems.filter(i => i.stock_qty === 0);
    const needsReorder = lowStockItems.filter(i => i.stock_qty > 0);

    const handleSort = (field: 'stock' | 'name' | 'part') => {
        if (sortBy === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortBy(field);
            setSortAsc(true);
        }
    };

    const handleReorder = (item: typeof items[0]) => {
        const suggestedQty = item.min_stock * 2;
        const message = encodeURIComponent(
            `Hi, I need to reorder:\n\n` +
            `Part: ${item.part_number}\n` +
            `Name: ${item.name}\n` +
            `Quantity: ${suggestedQty}\n` +
            `Current Stock: ${item.stock_qty}`
        );
        window.open(`https://wa.me/?text=${message}`, '_blank');
    };

    const exportCSV = () => {
        const headers = ['Part Number', 'Name', 'Current Stock', 'Min Stock', 'Suggested Order'];
        const rows = lowStockItems.map(item => [
            item.part_number,
            item.name,
            item.stock_qty.toString(),
            item.min_stock.toString(),
            (item.min_stock * 2).toString()
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `low_stock_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <Layout title="Low Stock">
            <div className="p-4 lg:p-6 max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                    <AlertTriangle className="text-yellow-500" size={24} />
                    Low Stock Alerts
                </h1>

                {/* Summary Cards */}
                <div className="p-4 grid grid-cols-2 gap-3">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-medium mb-1">
                            <Package size={16} />
                            Out of Stock
                        </div>
                        <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                            {outOfStock.length}
                        </div>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm font-medium mb-1">
                            <AlertTriangle size={16} />
                            Low Stock
                        </div>
                        <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                            {needsReorder.length}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="px-4 flex gap-2">
                    <button
                        onClick={refreshInventory}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={exportCSV}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white rounded-lg font-medium"
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                </div>

                {/* Sort Controls */}
                <div className="px-4 py-3 flex gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Sort by:</span>
                    {(['stock', 'name', 'part'] as const).map(field => (
                        <button
                            key={field}
                            onClick={() => handleSort(field)}
                            className={`flex items-center gap-1 px-2 py-1 rounded ${sortBy === field
                                ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                                : 'text-gray-600 dark:text-gray-400'
                                }`}
                        >
                            {field === 'stock' ? 'Stock' : field === 'name' ? 'Name' : 'Part #'}
                            {sortBy === field && (
                                <ArrowUpDown size={12} className={sortAsc ? 'rotate-180' : ''} />
                            )}
                        </button>
                    ))}
                </div>

                {/* Items List */}
                <div className="px-4 space-y-3 max-w-lg mx-auto">
                    {loading && lowStockItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <RefreshCw className="animate-spin mb-3" size={32} />
                            <p>Loading inventory...</p>
                        </div>
                    ) : lowStockItems.length === 0 ? (
                        <div className="text-center py-20">
                            <Package size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <p className="text-xl font-medium text-gray-900 dark:text-gray-100">All Stocked Up! 🎉</p>
                            <p className="text-gray-500 dark:text-gray-400 mt-2">No items are below minimum stock levels.</p>
                        </div>
                    ) : (
                        lowStockItems.map(item => (
                            <div
                                key={item.uuid}
                                className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 ${item.stock_qty === 0
                                    ? 'border-red-500'
                                    : 'border-yellow-500'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{item.part_number}</p>
                                    </div>
                                    <span className={`text-sm font-bold px-2 py-1 rounded ${item.stock_qty === 0
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                        }`}>
                                        {item.stock_qty === 0 ? 'OUT' : item.stock_qty}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                                    <div>
                                        Min: {item.min_stock} | Suggest order: <span className="font-medium text-gray-700 dark:text-gray-300">{item.min_stock * 2}</span>
                                    </div>
                                    <button
                                        onClick={() => handleReorder(item)}
                                        className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium"
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
