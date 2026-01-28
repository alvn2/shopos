import React, { useState } from 'react';
import { Eye, EyeOff, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { InventoryItem, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useInventory } from '../../contexts/InventoryContext';

interface ProductCardProps {
  item: InventoryItem;
}

const ProductCard: React.FC<ProductCardProps> = ({ item }) => {
  const { user } = useAuth();
  const { settings } = useInventory();
  const [showAdmin, setShowAdmin] = useState(false);

  const isAdmin = user?.role === UserRole.ADMIN;
  
  // Calculations based on settings
  const exchangeRate = settings?.aed_exchange_rate || 36.5;
  const overhead = settings?.overhead_factor || 1.35;
  
  const landedCost = item.aed_buying_price * exchangeRate * overhead;
  const profit = item.selling_price - landedCost;
  const margin = (profit / item.selling_price) * 100;

  // Stock Status Logic
  let StockIcon = CheckCircle;
  let stockColor = 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
  let stockText = `IN STOCK - ${item.stock_qty}`;

  if (item.stock_qty === 0) {
    StockIcon = XCircle;
    stockColor = 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
    stockText = 'OUT OF STOCK';
  } else if (item.stock_qty <= item.min_stock) {
    StockIcon = AlertTriangle;
    stockColor = 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400';
    stockText = `LOW STOCK - ${item.stock_qty}`;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
      <div className="p-4">
        {/* Header: Part # and Badge */}
        <div className="flex justify-between items-start mb-2">
          <span className="font-mono text-sm text-gray-500 dark:text-gray-400 font-semibold tracking-wide">
            {item.part_number}
          </span>
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-bold ${stockColor}`}>
            <StockIcon size={12} className="mr-1" />
            {stockText}
          </div>
        </div>

        {/* Product Name */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 line-clamp-2">
          {item.name}
        </h3>

        {/* Price and Action */}
        <div className="flex justify-between items-center">
          <div className="text-xl font-bold text-brand-600 dark:text-brand-400">
            KES {item.selling_price.toLocaleString()}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className="p-2 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              {showAdmin ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <div
          className={`bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 transition-all duration-300 ease-in-out overflow-hidden ${
            showAdmin ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">AED Cost:</span>
              <span className="font-mono font-medium dark:text-gray-200">{item.aed_buying_price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Landed Cost:</span>
              <span className="font-mono font-medium dark:text-gray-200">KES {landedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="h-px bg-gray-200 dark:bg-gray-600 my-2"></div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Profit:</span>
              <span className={`font-mono font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                KES {profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Margin:</span>
              <span className={`font-mono font-bold ${margin >= 20 ? 'text-green-600 dark:text-green-400' : margin > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                {margin.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Formula: AED × {exchangeRate} × {overhead}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCard;