import React, { useEffect, useState } from 'react';
import Layout from '../components/common/Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';
import { InventoryItem } from '../types';
import { Filter, TrendingUp, ShoppingCart, DollarSign, BarChart3 } from 'lucide-react';

const Reports: React.FC = () => {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [inventoryHealth, setInventoryHealth] = useState<{ items: InventoryItem[], totalItems: number, lowStockCount: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [paymentFilter, setPaymentFilter] = useState<string>('All');
  const [minStockFilter, setMinStockFilter] = useState<string>('');
  const [maxStockFilter, setMaxStockFilter] = useState<string>('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.reports.getSalesSummary({ paymentMethod: paymentFilter });
      if (response && response.chart_data) {
        setSalesData(response.chart_data);
        setMetrics(response.metrics);
      } else {
        setSalesData(Array.isArray(response) ? response : []);
      }

      const health = await api.reports.getInventoryHealth({
        minStock: minStockFilter ? parseInt(minStockFilter) : undefined,
        maxStock: maxStockFilter ? parseInt(maxStockFilter) : undefined
      });
      setInventoryHealth(health);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [paymentFilter, minStockFilter, maxStockFilter]);

  const totalSales = metrics?.total_sales || 0;
  const totalTransactions = metrics?.total_transactions || 0;
  const avgTransaction = metrics?.average_transaction || 0;
  const growthPercent = metrics?.growth_percent || 0;

  return (
    <Layout title="Reports">
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6 animate-enter">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Reports</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Sales analytics and inventory health overview</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-modern p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-brand-100 dark:bg-brand-900/40 rounded-lg text-brand-600 dark:text-brand-400">
                <DollarSign size={16} />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Sales</span>
            </div>
            <div className="text-2xl font-extrabold text-brand-600 dark:text-brand-400">
              KES {totalSales > 0 ? (totalSales / 1000).toFixed(1) + 'K' : '0'}
            </div>
            {growthPercent !== 0 && (
              <div className={`text-xs font-bold mt-1.5 ${growthPercent > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {growthPercent > 0 ? '↑' : '↓'} {Math.abs(growthPercent)}% vs last week
              </div>
            )}
          </div>
          <div className="card-modern p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                <ShoppingCart size={16} />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Transactions</span>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalTransactions}</div>
            {avgTransaction > 0 && (
              <div className="text-xs text-slate-400 font-bold mt-1.5">Avg KES {avgTransaction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            )}
          </div>
          <div className="card-modern p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={16} />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Items</span>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{inventoryHealth?.totalItems || 0}</div>
          </div>
          <div className="card-modern p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/40 rounded-lg text-rose-600 dark:text-rose-400">
                <BarChart3 size={16} />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Low Stock</span>
            </div>
            <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{inventoryHealth?.lowStockCount || 0}</div>
          </div>
        </div>

        {/* Sales Chart */}
        <div className="card-modern p-5 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Sales Trend</h3>
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="input-modern !w-auto !py-2 !px-3 !text-sm"
              >
                <option value="All">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Credit">Credit</option>
              </select>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontWeight: 600 }}
                />
                <Bar dataKey="sales" fill="url(#brandGradient)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={1} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Health */}
        <div className="card-modern p-5 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Inventory Health</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold uppercase">Qty:</span>
              <input
                type="number"
                placeholder="Min"
                value={minStockFilter}
                onChange={e => setMinStockFilter(e.target.value)}
                className="input-modern !w-16 !py-2 !px-2 !text-sm"
              />
              <span className="text-slate-300 dark:text-slate-600 font-bold">–</span>
              <input
                type="number"
                placeholder="Max"
                value={maxStockFilter}
                onChange={e => setMaxStockFilter(e.target.value)}
                className="input-modern !w-16 !py-2 !px-2 !text-sm"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-bold uppercase tracking-widest text-xs">Item</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-widest text-xs text-right">Stock</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-widest text-xs text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {inventoryHealth?.items?.slice(0, 20).map((item) => (
                  <tr key={item.uuid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{item.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{item.part_number}</div>
                    </td>
                    <td className={`px-4 py-3 text-right font-extrabold ${item.stock_qty <= item.min_stock ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                      {item.stock_qty}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-600 dark:text-slate-400">
                      {(item.stock_qty * item.selling_price / 1000).toFixed(1)}k
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inventoryHealth?.items && inventoryHealth.items.length > 20 && (
              <div className="text-center text-xs text-slate-500 py-3 italic border-t border-slate-200 dark:border-slate-700">
                Showing top 20 of {inventoryHealth.items.length}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;