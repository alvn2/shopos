import React, { useState, useMemo, useEffect, useCallback, memo, useTransition } from 'react';
import Layout from '../components/common/Layout';
import BulkImport from '../components/inventory/BulkImport';
import { useAuth } from '../contexts/AuthContext';
import { useInventory } from '../contexts/InventoryContext';
import { InventoryItem, PartMake, UserRole } from '../types';
import { Minus, Plus, Save, RotateCcw, Package, Search, Trash2, Edit2, X, Calculator, Upload, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { Toaster, toast } from 'react-hot-toast';

const ITEMS_PER_PAGE = 50;

// Memoized inventory row to prevent unnecessary re-renders
const InventoryRow = memo<{
  item: InventoryItem;
  original: InventoryItem | undefined;
  isModified: boolean;
  isWorker: boolean;
  landedCostKES: number;
  profitMargin: number;
  onAdjust: (uuid: string, delta: number) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (uuid: string) => void;
}>(({ item, original, isModified, isWorker, landedCostKES, profitMargin, onAdjust, onEdit, onDelete }) => (
  <div className={`relative overflow-hidden group card-modern p-5 lg:p-6 transition-all duration-200 ${isModified ? 'border-amber-400 dark:border-amber-500/50 ring-2 ring-amber-500/10' : 'hover:border-brand-300 dark:hover:border-brand-500/50'}`}>

    {/* Item Header */}
    <div className="flex flex-col md:flex-row justify-between items-start gap-3 mb-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-600">{item.part_number}</span>
          {item.stock_qty === 0 && (
            <span className="text-xs font-bold tracking-wide bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-800/50">OUT OF STOCK</span>
          )}
          {item.stock_qty > 0 && item.stock_qty <= item.min_stock && (
            <span className="text-xs font-bold tracking-wide bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800/50">LOW STOCK</span>
          )}
          {item.make && item.make !== 'Genuine' && (
            <span className={`text-xs font-bold tracking-wide px-2.5 py-1 rounded-md border ${item.make === 'Japan' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
              {item.make}
            </span>
          )}
          {isModified && (
            <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">Modified</span>
          )}
        </div>
        <div className="font-extrabold text-slate-900 dark:text-white text-lg leading-tight truncate">{item.name}</div>
        {item.tags && <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">{item.tags}</div>}
      </div>

      {/* Action buttons - always visible on mobile */}
      {!isWorker && (
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onEdit(item)}
            className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-brand-100 hover:text-brand-600 dark:hover:bg-brand-900/50 dark:hover:text-brand-400 rounded-lg transition-colors"
            title="Edit item"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(item.uuid)}
            className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/50 dark:hover:text-rose-400 rounded-lg transition-colors"
            title="Delete item"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Pricing Block */}
      <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/50">
        {!isWorker && (
          <div className="flex items-center justify-between text-sm mb-3 pb-3 border-b border-slate-200 dark:border-slate-700/50">
            <span className="text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Buy:</span> AED {item.aed_buying_price}
              <span className="mx-2 text-slate-300 dark:text-slate-600">→</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">KES {landedCostKES.toLocaleString()}</span>
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-xs tracking-widest block mb-1">Sell Price</span>
            <span className="text-brand-600 dark:text-brand-400 font-extrabold text-2xl tracking-tight">KES {item.selling_price.toLocaleString()}</span>
          </div>
          {!isWorker && (
            <div className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-wide ${profitMargin > 30 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : profitMargin > 10 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
              {profitMargin > 0 ? '+' : ''}{profitMargin}% MARGIN
            </div>
          )}
        </div>
        {!isWorker && (
          <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Profit: KES {(item.selling_price - landedCostKES).toLocaleString()} / unit
          </div>
        )}
      </div>

      {/* Stock Controls */}
      <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-xs tracking-widest">Current Stock</span>
          <span className="text-xs font-semibold text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded">Min: {item.min_stock}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-400 dark:text-slate-500">
            {isModified && original ? <span className="text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20 px-2 py-1 rounded">Was: {original.stock_qty}</span> : ''}
          </div>
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-1 shadow-sm">
            {!isWorker && (
              <button
                onClick={() => onAdjust(item.uuid, -1)}
                className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all"
              >
                <Minus size={18} />
              </button>
            )}
            <span className="text-2xl font-black w-14 text-center text-slate-900 dark:text-white font-mono">{item.stock_qty}</span>
            {!isWorker && (
              <button
                onClick={() => onAdjust(item.uuid, 1)}
                className="w-10 h-10 rounded-lg bg-brand-500 dark:bg-brand-600 text-white flex items-center justify-center shadow-glow hover:bg-brand-600 dark:hover:bg-brand-500 active:scale-95 transition-all"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
));

InventoryRow.displayName = 'InventoryRow';

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const isWorker = user?.role === UserRole.WORKER;
  const { items, loading, settings, refreshInventory, removeLocalItem } = useInventory();

  const [localItems, setLocalItems] = useState<InventoryItem[]>([]);
  const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Settings
  const aedRate = settings?.aed_rate || 36.5;
  const conversionPercent = settings?.conversion_percent || 13;

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    part_number: '', name: '', tags: '', make: 'Genuine' as PartMake,
    aed_buying_price: '', ksh_buying_price: '', selling_price: '', min_stock: ''
  });
  const [editSaving, setEditSaving] = useState(false);

  // Debounce search to prevent jank on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(searchTerm);
        setCurrentPage(1); // Reset to page 1 on new search
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const calcLandedCost = useCallback((aedPrice: number) =>
    Math.round(aedPrice * aedRate * (1 + conversionPercent / 100)), [aedRate, conversionPercent]);

  const handleAdjust = useCallback((uuid: string, delta: number) => {
    setLocalItems(prev => prev.map(item => {
      if (item.uuid === uuid) {
        const newQty = Math.max(0, item.stock_qty + delta);
        setModifiedIds(prevIds => {
          const next = new Set(prevIds);
          const original = items.find(i => i.uuid === uuid);
          if (newQty !== original?.stock_qty) {
            next.add(uuid);
          } else {
            next.delete(uuid);
          }
          return next;
        });
        return { ...item, stock_qty: newQty };
      }
      return item;
    }));
  }, [items]);

  const handleSave = async () => {
    if (modifiedIds.size === 0) return;
    setSaving(true);
    const updates = localItems
      .filter(item => modifiedIds.has(item.uuid))
      .map(item => ({ uuid: item.uuid, stock_qty: item.stock_qty }));
    try {
      await api.inventory.updateBatch(updates);
      setModifiedIds(new Set());
      toast.success(`${updates.length} item${updates.length > 1 ? 's' : ''} updated`);
      await refreshInventory();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback((uuid: string) => {
    const item = localItems.find(i => i.uuid === uuid);
    toast((t) => (
      <div className="flex items-center gap-3">
        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
        <div>
          <p className="font-semibold text-sm">Delete "{item?.name}"?</p>
          <p className="text-xs text-slate-500">This cannot be undone</p>
        </div>
        <div className="flex gap-2 ml-2">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                removeLocalItem(uuid);
                await api.inventory.delete(uuid);
                toast.success('Item deleted');
              } catch (e: any) {
                toast.error(e?.message || 'Delete failed');
                refreshInventory();
              }
            }}
            className="px-3 py-1.5 text-xs font-bold bg-rose-500 text-white rounded-lg"
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 8000 });
  }, [localItems, removeLocalItem, refreshInventory]);

  const openEditModal = useCallback((item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      part_number: item.part_number, name: item.name, tags: item.tags || '',
      make: item.make || 'Genuine', aed_buying_price: item.aed_buying_price.toString(),
      ksh_buying_price: (item.ksh_buying_price || 0).toString(),
      selling_price: item.selling_price.toString(), min_stock: item.min_stock.toString()
    });
  }, []);

  const closeEditModal = () => {
    setEditingItem(null);
    setEditForm({ part_number: '', name: '', tags: '', make: 'Genuine', aed_buying_price: '', ksh_buying_price: '', selling_price: '', min_stock: '' });
  };

  const handleEditSave = async () => {
    if (!editingItem) return;
    setEditSaving(true);
    try {
      await api.inventory.update(editingItem.uuid, {
        part_number: editForm.part_number.trim().toUpperCase(),
        name: editForm.name.trim(), tags: editForm.tags.trim(), make: editForm.make,
        aed_buying_price: parseFloat(editForm.aed_buying_price) || 0,
        ksh_buying_price: parseFloat(editForm.ksh_buying_price) || 0,
        selling_price: parseFloat(editForm.selling_price) || 0,
        min_stock: parseInt(editForm.min_stock) || 5
      });
      toast.success('Item updated');
      await refreshInventory();
      closeEditModal();
    } catch (e) {
      toast.error('Failed to update item');
    } finally {
      setEditSaving(false);
    }
  };

  // Filtered + paginated list
  const filteredList = useMemo(() => {
    return localItems.filter(item => {
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        if (!item.name.toLowerCase().includes(s) && !item.part_number.toLowerCase().includes(s) && !(item.tags || '').toLowerCase().includes(s)) {
          return false;
        }
      }
      if (filter === 'low') return item.stock_qty > 0 && item.stock_qty <= item.min_stock;
      if (filter === 'out') return item.stock_qty === 0;
      return true;
    });
  }, [localItems, debouncedSearch, filter]);

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredList, currentPage]);

  const lowStockCount = items.filter(i => i.stock_qty <= i.min_stock && i.stock_qty > 0).length;
  const outOfStockCount = items.filter(i => i.stock_qty === 0).length;

  // Edit modal calculations
  const editLandedCost = parseFloat(editForm.aed_buying_price) ? calcLandedCost(parseFloat(editForm.aed_buying_price)) : 0;
  const editSellingPrice = parseFloat(editForm.selling_price) || 0;
  const editProfitMargin = editLandedCost > 0 ? Math.round((editSellingPrice - editLandedCost) / editLandedCost * 100) : 0;

  return (
    <Layout title="Inventory">
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6 animate-enter">
        {/* Rate Info Banner */}
        {!isWorker && (
          <div className="p-4 bg-gradient-to-r from-indigo-50/50 to-cyan-50/50 dark:from-indigo-900/20 dark:to-cyan-900/20 glass-panel rounded-2xl flex items-center gap-4 text-sm text-slate-700 dark:text-slate-300 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <Calculator size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <span>
              <strong>Base Exchange:</strong> AED × <span className="text-brand-600 dark:text-brand-400 font-mono font-bold">{aedRate}</span> × (1 + <span className="text-brand-600 dark:text-brand-400 font-mono font-bold">{conversionPercent}%</span>) = <strong className="text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md bg-white/50 dark:bg-slate-800">{(aedRate * (1 + conversionPercent / 100)).toFixed(2)} KES/AED</strong>
            </span>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Inventory Management</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
              <span className="text-slate-900 dark:text-white font-bold">{items.length}</span> items • <span className="text-amber-600 dark:text-amber-400 font-bold">{lowStockCount}</span> low stock • <span className="text-rose-600 dark:text-rose-400 font-bold">{outOfStockCount}</span> out of stock
            </p>
          </div>
          {!isWorker && (
            <button
              onClick={() => setShowBulkImport(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Upload size={18} />
              Import Data
            </button>
          )}
        </div>

        {/* Search & Filters */}
        <div className="sticky top-4 z-30 glass-panel rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl shadow-brand-900/5 backdrop-blur-2xl">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={20} className="text-slate-400 group-focus-within:text-brand-500 transition-colors duration-300" />
            </div>
            <input
              type="text"
              placeholder="Search by name, part number, or tags..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-3.5 input-modern !rounded-xl"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-1 gap-1 relative overflow-hidden">
            <button onClick={() => startTransition(() => { setFilter('all'); setCurrentPage(1); })} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${filter === 'all' ? 'bg-white text-slate-900 dark:bg-slate-700 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              All Items
            </button>
            <button onClick={() => startTransition(() => { setFilter('low'); setCurrentPage(1); })} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${filter === 'low' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              Low Stock
            </button>
            <button onClick={() => startTransition(() => { setFilter('out'); setCurrentPage(1); })} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${filter === 'out' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              Out of Stock
            </button>
            {isPending && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-500 animate-pulse"></div>}
          </div>
        </div>

        {/* Inventory List */}
        <div className="space-y-3">
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <RotateCcw className="animate-spin mb-3" size={32} />
              <p className="font-medium">Loading inventory...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-20 card-modern p-8">
              <Package size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {debouncedSearch ? 'No items match your search' : 'No items in this category'}
              </p>
            </div>
          ) : (
            paginatedList.map(item => {
              const isModified = modifiedIds.has(item.uuid);
              const original = items.find(i => i.uuid === item.uuid);
              const landedCostKES = calcLandedCost(item.aed_buying_price);
              const profitMargin = landedCostKES > 0 ? Math.round((item.selling_price - landedCostKES) / landedCostKES * 100) : 0;

              return (
                <InventoryRow
                  key={item.uuid}
                  item={item}
                  original={original}
                  isModified={isModified}
                  isWorker={isWorker}
                  landedCostKES={landedCostKES}
                  profitMargin={profitMargin}
                  onAdjust={handleAdjust}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                />
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Page <span className="text-slate-900 dark:text-white">{currentPage}</span> of <span className="text-slate-900 dark:text-white">{totalPages}</span>
              <span className="text-slate-400 ml-2">({filteredList.length} items)</span>
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Sticky Save Bar */}
        {modifiedIds.size > 0 && (
          <div className="fixed bottom-24 lg:bottom-10 left-1/2 -translate-x-1/2 lg:w-96 w-[calc(100%-2rem)] p-4 glass-dropdown rounded-2xl z-40 flex items-center justify-between animate-slide-up">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {modifiedIds.size} item{modifiedIds.size > 1 ? 's' : ''} modified
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setLocalItems(items); setModifiedIds(new Set()); }}
                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary !py-2.5 !px-6"
              >
                {saving ? <RotateCcw className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                Confirm
              </button>
            </div>
          </div>
        )}

        <Toaster position="top-right" toastOptions={{
          style: { borderRadius: '12px', background: '#1e293b', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: '#fff' } }
        }} />
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card-modern shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Item</h2>
              <button onClick={closeEditModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Part Number</label>
                <input type="text" value={editForm.part_number} onChange={e => setEditForm({ ...editForm, part_number: e.target.value })} className="input-modern font-mono uppercase" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="input-modern" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tags</label>
                <input type="text" value={editForm.tags} onChange={e => setEditForm({ ...editForm, tags: e.target.value })} placeholder="e.g. Service,LC200,Brakes" className="input-modern" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Make / Quality</label>
                <input type="text" value={editForm.make} onChange={e => setEditForm({ ...editForm, make: e.target.value })} className="input-modern" />
              </div>

              {/* Pricing Section */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-4 border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                  <Calculator size={14} />
                  Pricing Calculator
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-500">Buying Price (AED)</label>
                  <input type="number" step="0.01" value={editForm.aed_buying_price} onChange={e => setEditForm({ ...editForm, aed_buying_price: e.target.value })} className="input-modern" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-500">Buying Price (KSH) — Optional</label>
                  <input type="number" step="1" value={editForm.ksh_buying_price} onChange={e => setEditForm({ ...editForm, ksh_buying_price: e.target.value })} className="input-modern" />
                </div>

                {/* Landed Cost Display */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Landed Cost (KES)</div>
                  <div className="text-xl font-bold text-blue-700 dark:text-blue-300">KES {editLandedCost.toLocaleString()}</div>
                  <div className="text-xs text-blue-500 mt-1">= AED {editForm.aed_buying_price || 0} × {aedRate} × (1 + {conversionPercent}%)</div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-500">Selling Price (KES)</label>
                  <input type="number" value={editForm.selling_price} onChange={e => setEditForm({ ...editForm, selling_price: e.target.value })} className="input-modern" />
                </div>

                {editLandedCost > 0 && editSellingPrice > 0 && (
                  <div className={`p-3 rounded-lg border ${editProfitMargin > 20 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/50' : editProfitMargin > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/50' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200/50 dark:border-rose-800/50'}`}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Profit per unit:</span>
                      <span className={`font-bold ${editProfitMargin > 20 ? 'text-emerald-600 dark:text-emerald-400' : editProfitMargin > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        KES {(editSellingPrice - editLandedCost).toLocaleString()} ({editProfitMargin}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Minimum Stock Level</label>
                <input type="number" value={editForm.min_stock} onChange={e => setEditForm({ ...editForm, min_stock: e.target.value })} className="input-modern" />
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              <button onClick={closeEditModal} className="flex-1 btn-secondary !py-2.5">Cancel</button>
              <button onClick={handleEditSave} disabled={editSaving} className="flex-1 btn-primary !py-2.5">
                {editSaving ? <RotateCcw className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkImport
          onComplete={() => { setShowBulkImport(false); refreshInventory(); }}
          onClose={() => setShowBulkImport(false)}
        />
      )}
    </Layout>
  );
};

export default Inventory;