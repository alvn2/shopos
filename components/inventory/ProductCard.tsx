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

  // Calculations based on settings - FIXED field names
  const exchangeRate = settings?.aed_rate || 36.5;
  const conversionPercent = settings?.conversion_percent || 13;
  const overheadFactor = 1 + conversionPercent / 100;

  const landedCost = item.aed_buying_price * exchangeRate * overheadFactor;
  const profit = item.selling_price - landedCost;
  const margin = item.selling_price > 0 ? (profit / item.selling_price) * 100 : 0;

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
    <div className="group bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/60 dark:border-slate-700/60 hover:border-brand-300 dark:hover:border-brand-700 shadow-sm hover:shadow-glow hover:shadow-brand-500/20 transition-all duration-300 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 p-16 bg-gradient-to-bl from-brand-500/10 to-transparent dark:from-brand-500/5 rounded-bl-full pointer-events-none transition-opacity opacity-0 group-hover:opacity-100" />

      <div className="relative z-10 w-full flex flex-col h-full justify-between">
        {/* Header: Part # and Badge */}
        <div className="flex justify-between items-start mb-3">
          <span className="font-mono text-sm text-slate-500 dark:text-slate-400 font-bold tracking-wider bg-slate-100 dark:bg-slate-900/60 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700/50">
            {item.part_number}
          </span>
          <div className={`flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${stockColor}`}>
            <StockIcon size={14} className="mr-1.5" />
            {stockText}
          </div>
        </div>

        {/* Product Name */}
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5 leading-snug line-clamp-2 pr-6">
          {item.name}
        </h3>

        {/* Price and Action */}
        <div className="flex justify-between items-end mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/50">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Price</div>
            <div className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-400 dark:to-indigo-400 tracking-tight">
              KES {item.selling_price.toLocaleString()}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 bg-slate-50 dark:bg-slate-900 hover:bg-brand-50 dark:hover:bg-brand-900/40 rounded-xl transition-colors active:scale-95"
            >
              {showAdmin ? <EyeOff strokeWidth={2.5} size={20} /> : <Eye strokeWidth={2.5} size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <div
          className={`relative z-10 glass-panel mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all duration-300 ease-in-out overflow-hidden shadow-inner ${showAdmin ? 'max-h-64 opacity-100 mt-4' : 'max-h-0 opacity-0 !mt-0 !border-transparent'
            }`}
        >
          <div className="p-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">AED Cost:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.aed_buying_price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Landed Cost:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">KES {landedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Est. Profit:</span>
              <span className={`font-mono font-black ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {profit >= 0 ? '+' : ''}KES {profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Margin:</span>
              <span className={`font-mono font-black border px-2 py-0.5 rounded-md ${margin >= 20 ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-700/50 dark:text-emerald-300' : margin > 0 ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/40 dark:border-amber-700/50 dark:text-amber-300' : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/40 dark:border-rose-700/50 dark:text-rose-300'}`}>
                {margin.toFixed(1)}%
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-3 pt-2 font-mono uppercase text-center border-t border-dashed border-slate-200 dark:border-slate-700">
              AED × {exchangeRate} × {overheadFactor.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCard;