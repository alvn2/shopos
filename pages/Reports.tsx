import React, { useEffect, useState } from 'react';
import Layout from '../components/common/Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';
import { InventoryItem } from '../types';
import { Filter, RefreshCcw } from 'lucide-react';

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
      const response = await api.reports.getSalesSummary({
        paymentMethod: paymentFilter
      });
      // Handle response structure { metrics, chart_data }
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
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Total Sales</div>
            <div className="text-xl font-bold text-brand-600 mt-1">KES {(totalSales / 1000).toFixed(1)}K</div>
            <div className="text-xs text-green-500 mt-1">↑ 12% vs last week</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Transactions</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">84</div>
            <div className="text-xs text-gray-400 mt-1">Avg KES 1,672</div>
          </div>
        </div>

        {/* Sales Chart with Filters */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Sales Trend</h3>
            <div className="flex items-center space-x-2">
              <Filter size={14} className="text-gray-400" />
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-white"
              >
                <option value="All">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Credit">Credit</option>
              </select>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="sales" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Health with Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-3 sm:space-y-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Inventory Health</h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">Qty:</span>
              <input
                type="number"
                placeholder="Min"
                value={minStockFilter}
                onChange={e => setMinStockFilter(e.target.value)}
                className="w-16 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-white"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                placeholder="Max"
                value={maxStockFilter}
                onChange={e => setMaxStockFilter(e.target.value)}
                className="w-16 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400">Items Matching</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{inventoryHealth?.totalItems || 0}</div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
              <div className="text-xs text-red-500 dark:text-red-400">Low Stock</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{inventoryHealth?.lowStockCount || 0}</div>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 sticky top-0">
                <tr>
                  <th className="px-2 py-2 font-medium">Item</th>
                  <th className="px-2 py-2 font-medium text-right">Stock</th>
                  <th className="px-2 py-2 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {inventoryHealth?.items?.slice(0, 10).map((item) => (
                  <tr key={item.uuid} className="dark:text-gray-300">
                    <td className="px-2 py-2">
                      <div className="font-medium line-clamp-1">{item.name}</div>
                      <div className="text-xs text-gray-400">{item.part_number}</div>
                    </td>
                    <td className={`px-2 py-2 text-right font-bold ${item.stock_qty <= item.min_stock ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                      {item.stock_qty}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-gray-600 dark:text-gray-400">
                      {(item.stock_qty * item.selling_price / 1000).toFixed(1)}k
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inventoryHealth?.items && inventoryHealth.items.length > 10 && (
              <div className="text-center text-xs text-gray-500 mt-2 italic">Showing top 10 of {inventoryHealth.items.length}</div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Reports;