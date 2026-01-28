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
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search part #, name, or tag..."
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-1 focus:ring-brand-500 sm:text-sm transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        } 
      />

      {/* Low Stock Banner */}
      {lowStockCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-900/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center text-yellow-800 dark:text-yellow-200 text-sm font-medium">
            <span className="mr-2">⚠️</span>
            {lowStockCount} items low on stock.
          </div>
          <span className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold uppercase tracking-wider">Review</span>
        </div>
      )}

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <RefreshCw className="animate-spin mb-3" size={32} />
            <p>Loading Inventory...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <p className="text-lg font-medium">No items found</p>
            <p className="text-sm">Try searching for something else.</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <ProductCard key={item.uuid} item={item} />
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Home;