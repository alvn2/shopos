import React, { useState, useMemo } from 'react';
import Header from '../components/common/Header';
import BottomNav from '../components/common/BottomNav';
import ProductCard from '../components/inventory/ProductCard';
import { useInventory } from '../contexts/InventoryContext';
import { Search, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Home: React.FC = () => {
  const { items, loading, refreshInventory } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

  // Search Logic
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;

    const terms = searchTerm.toLowerCase().split(' ');

    return items.filter(item => {
      const searchString = `${item.part_number} ${item.name} ${item.tags}`.toLowerCase();
      return terms.every(term => searchString.includes(term));
    }).sort((a, b) => {
      // Prioritize exact part number match
      const aExact = a.part_number.toLowerCase() === searchTerm.toLowerCase();
      const bExact = b.part_number.toLowerCase() === searchTerm.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });
  }, [items, searchTerm]);

  // Low stock alert for banner
  const lowStockCount = items.filter(i => i.stock_qty <= i.min_stock).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <Header
        title={
          <div className="relative w-full max-w-md mx-auto group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400 group-focus-within:text-brand-500 transition-colors" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search part #, name, or tag..."
              className="block w-full pl-11 pr-10 py-3 border border-slate-200/60 dark:border-slate-700/60 rounded-full font-medium bg-slate-100/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all shadow-inner focus:shadow-glow focus:shadow-brand-500/20"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        }
      />

      {/* Low Stock Banner */}
      {lowStockCount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-b border-amber-200/60 dark:border-amber-700/50 px-4 py-3 flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center text-amber-800 dark:text-amber-200 text-sm font-bold">
            <span className="mr-2.5 text-lg shadow-sm bg-white dark:bg-amber-900/50 rounded-full h-6 w-6 flex items-center justify-center">⚠️</span>
            {lowStockCount} items running low on stock
          </div>
          <button className="text-xs text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider shadow-sm transition-colors active:scale-95">Review</button>
        </div>
      )}

      <main className="p-4 max-w-lg mx-auto space-y-4 relative z-10 pb-24">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <RefreshCw className="animate-spin mb-4 text-brand-500" size={36} />
            <p className="font-bold tracking-wide">Syncing Inventory...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-slate-50/50 dark:bg-slate-900/20 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <Search size={40} className="mx-auto mb-3 text-slate-400 opacity-50" />
            <p className="text-lg font-bold text-slate-500 dark:text-slate-400">No items found</p>
            <p className="text-sm text-slate-400 mt-1">Try searching with a different term.</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div key={item.uuid} className="animate-fade-in-up" style={{ animationFillMode: 'both' }}>
              <ProductCard item={item} />
            </div>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Home;