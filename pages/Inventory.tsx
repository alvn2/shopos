import React, { useState, useMemo, useEffect } from 'react';
import Layout from '../components/common/Layout';
import BulkImport from '../components/inventory/BulkImport';
import { useAuth } from '../contexts/AuthContext';
import { useInventory } from '../contexts/InventoryContext';
import { InventoryItem, PartMake, Settings, UserRole } from '../types';
import { Minus, Plus, Save, RotateCcw, Check, Package, Search, Trash2, Edit2, X, Calculator, Upload } from 'lucide-react';
import { api } from '../services/api';
import { Toaster, toast } from 'react-hot-toast';

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const isWorker = user?.role === UserRole.WORKER;

  const { items, loading, refreshInventory } = useInventory();
  const [localItems, setLocalItems] = useState<InventoryItem[]>([]);
  const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Settings from API
  const [settings, setSettings] = useState<Settings | null>(null);
  const aedRate = settings?.aed_rate || 36.5;
  const conversionPercent = settings?.conversion_percent || 13;

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    part_number: '',
    name: '',
    tags: '',
    make: 'Genuine' as PartMake,
    aed_buying_price: '',
    ksh_buying_price: '',
    selling_price: '',
    min_stock: ''
  });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    api.settings.get().then(setSettings).catch(console.error);
  }, []);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Calculate KES buying price (landed cost) using percentage formula
  const calcLandedCost = (aedPrice: number) => Math.round(aedPrice * aedRate * (1 + conversionPercent / 100));

  const handleAdjust = (uuid: string, delta: number) => {
    setLocalItems(prev => prev.map(item => {
      if (item.uuid === uuid) {
        const newQty = Math.max(0, item.stock_qty + delta);
        if (newQty !== items.find(i => i.uuid === uuid)?.stock_qty) {
          setModifiedIds(prevIds => new Set(prevIds).add(uuid));
        } else {
          const newSet = new Set(modifiedIds);
          newSet.delete(uuid);
          setModifiedIds(newSet);
        }
        return { ...item, stock_qty: newQty };
      }
      return item;
    }));
  };

  const handleSave = async () => {
    if (modifiedIds.size === 0) return;
    setSaving(true);

    const updates = localItems
      .filter(item => modifiedIds.has(item.uuid))
      .map(item => ({ uuid: item.uuid, stock_qty: item.stock_qty }));

    try {
      await api.inventory.updateBatch(updates);
      setModifiedIds(new Set());
      await refreshInventory();
    } catch (e) {
      console.error(e);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (uuid: string) => {
    if (!confirm('Are you sure you want to delete this item? This cannot be undone.')) return;
    try {
      await api.inventory.delete(uuid);
      await refreshInventory();
    } catch (e: any) {
      console.error('Delete failed:', e);
      const message = e?.message || e?.error || 'Failed to delete item. Make sure you are logged in as admin.';
      alert(message);
    }
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      part_number: item.part_number,
      name: item.name,
      tags: item.tags || '',
      make: item.make || 'Genuine',
      aed_buying_price: item.aed_buying_price.toString(),
      ksh_buying_price: (item.ksh_buying_price || 0).toString(),
      selling_price: item.selling_price.toString(),
      min_stock: item.min_stock.toString()
    });
  };

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
        name: editForm.name.trim(),
        tags: editForm.tags.trim(),
        make: editForm.make,
        aed_buying_price: parseFloat(editForm.aed_buying_price) || 0,
        ksh_buying_price: parseFloat(editForm.ksh_buying_price) || 0,
        selling_price: parseFloat(editForm.selling_price) || 0,
        min_stock: parseInt(editForm.min_stock) || 5
      });
      await refreshInventory();
      closeEditModal();
    } catch (e) {
      alert('Failed to update item');
    } finally {
      setEditSaving(false);
    }
  };

  const filteredList = useMemo(() => {
    return localItems.filter(item => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!item.name.toLowerCase().includes(s) && !item.part_number.toLowerCase().includes(s) && !(item.tags || '').toLowerCase().includes(s)) {
          return false;
        }
      }
      if (filter === 'low') return item.stock_qty > 0 && item.stock_qty <= item.min_stock;
      if (filter === 'out') return item.stock_qty === 0;
      return true;
    });
  }, [localItems, searchTerm, filter]);

  const lowStockCount = items.filter(i => i.stock_qty <= i.min_stock && i.stock_qty > 0).length;
  const outOfStockCount = items.filter(i => i.stock_qty === 0).length;

  // Calculate profit margin for edit modal
  const editLandedCost = parseFloat(editForm.aed_buying_price) ? calcLandedCost(parseFloat(editForm.aed_buying_price)) : 0;
  const editSellingPrice = parseFloat(editForm.selling_price) || 0;
  const editProfitMargin = editLandedCost > 0 ? Math.round((editSellingPrice - editLandedCost) / editLandedCost * 100) : 0;

  return (
    <Layout title="Inventory">
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8 animate-enter">
        {/* Rate Info Banner */}
        {!isWorker && (
          <div className="p-4 bg-gradient-to-r from-indigo-50/50 to-cyan-50/50 dark:from-indigo-900/20 dark:to-cyan-900/20 glass-panel rounded-2xl flex items-center gap-4 text-sm text-slate-700 dark:text-slate-300 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <Calculator size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <span>
              <strong>Base Exchange:</strong> AED × <span className="text-brand-600 dark:text-brand-400 font-mono font-bold">{aedRate}</span> × (1 + <span className="text-brand-600 dark:text-brand-400 font-mono font-bold">{conversionPercent}%</span>) = <strong className="text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md bg-white/50 dark:bg-slate-800">{(aedRate * (1 + conversionPercent / 100)).toFixed(2)} KES/AED landed</strong>
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
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:shadow-lg dark:hover:bg-slate-700 shadow-sm border border-slate-200/50 dark:border-slate-700/50 transition-all duration-300 font-semibold focus:ring-2 focus:ring-brand-500/50"
            >
              <Upload size={18} />
              Import Data
            </button>
          )}
        </div>

        {/* Search & Filters */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={20} className="text-slate-400 group-focus-within:text-brand-500 transition-colors duration-300" />
            </div>
            <input
              type="text"
              placeholder="Search by name, part number, or tags..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-3.5 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all duration-300 shadow-inner"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-1 gap-1">
            <button onClick={() => setFilter('all')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${filter === 'all' ? 'bg-white text-slate-900 dark:bg-slate-700 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              All Items
            </button>
            <button onClick={() => setFilter('low')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${filter === 'low' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              Low Stock
            </button>
            <button onClick={() => setFilter('out')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${filter === 'out' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              Out of Stock
            </button>
          </div>
        </div>

        {/* Inventory List */}
        <div className="space-y-3">
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <RotateCcw className="animate-spin mb-3" size={32} />
              <p>Loading inventory...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-20">
              <Package size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {searchTerm ? 'No items match your search' : 'No items in this category'}
              </p>
            </div>
          ) : (
            filteredList.map(item => {
              const isModified = modifiedIds.has(item.uuid);
              const original = items.find(i => i.uuid === item.uuid);
              const landedCostKES = calcLandedCost(item.aed_buying_price);
              const profitMargin = Math.round((item.selling_price - landedCostKES) / landedCostKES * 100);

              return (
                <div key={item.uuid} className={`relative overflow-hidden group bg-white dark:bg-slate-800/90 p-5 lg:p-6 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-1 border ${isModified ? 'border-amber-400 dark:border-amber-500/50 ring-4 ring-amber-500/10' : 'border-slate-200 dark:border-slate-700/50 hover:border-brand-300 dark:hover:border-brand-500/50'}`}>

                  {/* Subtle Gradient wash on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 to-transparent dark:from-brand-900/10 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                  {/* Item Header */}
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-4 mb-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                      <div className="font-extrabold text-slate-900 dark:text-white text-xl leading-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">{item.name}</div>
                      {item.tags && <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1.5">{item.tags}</div>}
                    </div>
                    {!isWorker && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-brand-100 hover:text-brand-600 dark:hover:bg-brand-900/50 dark:hover:text-brand-400 rounded-lg transition-colors"
                          title="Edit item"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.uuid)}
                          className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/50 dark:hover:text-rose-400 rounded-lg transition-colors"
                          title="Delete item"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pricing Block */}
                    <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/50 flex flex-col justify-center">
                      {!isWorker && (
                        <div className="flex items-center justify-between text-sm mb-3 pb-3 border-b border-slate-200 dark:border-slate-700/50">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">
                              <span className="font-semibold">Buy:</span> AED {item.aed_buying_price}
                              <span className="mx-2 text-slate-300 dark:text-slate-600">→</span>
                              <span className="text-slate-800 dark:text-slate-200 font-bold tracking-tight">KES {landedCostKES.toLocaleString()}</span>
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 ml-1">(landed)</span>
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
                        <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400 flex justify-between">
                          <span>Profit: KES {(item.selling_price - landedCostKES).toLocaleString()} / unit</span>
                        </div>
                      )}
                    </div>

                    {/* Stock Controls Block */}
                    <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/50 flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-xs tracking-widest block">Current Stock</span>
                        <span className="text-xs font-semibold text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded">Min: {item.min_stock}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-400 dark:text-slate-500">
                          {isModified && original ? <span className="text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20 px-2 py-1 rounded">Was: {original.stock_qty}</span> : ''}
                        </div>
                        <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-1 shadow-sm">
                          {!isWorker && (
                            <button
                              onClick={() => handleAdjust(item.uuid, -1)}
                              className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all"
                            >
                              <Minus size={20} />
                            </button>
                          )}
                          <span className="text-2xl font-black w-16 text-center text-slate-900 dark:text-white font-mono">{item.stock_qty}</span>
                          {!isWorker && (
                            <button
                              onClick={() => handleAdjust(item.uuid, 1)}
                              className="w-10 h-10 rounded-lg bg-brand-500 dark:bg-brand-600 text-white flex items-center justify-center shadow-glow hover:bg-brand-600 dark:hover:bg-brand-500 active:scale-95 transition-all"
                            >
                              <Plus size={20} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Save Bar */}
        {
          modifiedIds.size > 0 && (
            <div className="fixed bottom-24 lg:bottom-10 left-1/2 -translate-x-1/2 lg:w-96 w-[calc(100%-2rem)] p-4 glass-dropdown rounded-2xl z-40 flex items-center justify-between animate-fade-in-up">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
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
                  className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-glow hover:shadow-brand-500/40 active:scale-95 transition-all flex items-center"
                >
                  {saving ? <RotateCcw className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                  Confirm
                </button>
              </div>
            </div>
          )
        }

        {/* Bulk Import Modal and Toaster stay at the very end */}
        {
          showBulkImport && (
            <BulkImport
              isOpen={showBulkImport}
              onClose={() => setShowBulkImport(false)}
              onImportSuccess={() => {
                setShowBulkImport(false);
                refreshInventory();
              }}
            />
          )
        }
        <Toaster position="top-right" />
      </div>

      {/* Edit Item Modal */}
      {
        editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Item</h2>
                <button onClick={closeEditModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Part Number */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Part Number</label>
                  <input
                    type="text"
                    value={editForm.part_number}
                    onChange={e => setEditForm({ ...editForm, part_number: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white font-mono uppercase"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Tags</label>
                  <input
                    type="text"
                    value={editForm.tags}
                    onChange={e => setEditForm({ ...editForm, tags: e.target.value })}
                    placeholder="e.g. Service,LC200,Brakes"
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>

                {/* Make/Quality */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Make / Quality</label>
                  <input
                    type="text"
                    value={editForm.make}
                    onChange={e => setEditForm({ ...editForm, make: e.target.value })}
                    placeholder="e.g. Genuine, Aftermarket, Taiho, MK"
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Parts with same number but different make are stored separately</p>
                </div>

                {/* Pricing Section */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <Calculator size={14} />
                    Pricing Calculator
                  </div>

                  {/* Buying Price AED */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Buying Price (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.aed_buying_price}
                      onChange={e => setEditForm({ ...editForm, aed_buying_price: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                    />
                  </div>

                  {/* Buying Price KSH (Direct) */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Buying Price (KSH) - Optional</label>
                    <input
                      type="number"
                      step="1"
                      value={editForm.ksh_buying_price}
                      onChange={e => setEditForm({ ...editForm, ksh_buying_price: e.target.value })}
                      placeholder="Direct KSH price if no AED"
                      className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">Use when item was purchased directly in KSH</p>
                  </div>

                  {/* Calculated Landed Cost */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <div className="text-xs text-blue-600 dark:text-blue-400">Landed Cost (KES)</div>
                    <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                      KES {editLandedCost.toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-500 mt-1">
                      = AED {editForm.aed_buying_price || 0} × {aedRate} × (1 + {conversionPercent}%)
                    </div>
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Selling Price (KES)</label>
                    <input
                      type="number"
                      value={editForm.selling_price}
                      onChange={e => setEditForm({ ...editForm, selling_price: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                    />
                  </div>

                  {/* Profit Preview */}
                  {editLandedCost > 0 && editSellingPrice > 0 && (
                    <div className={`p-3 rounded-lg ${editProfitMargin > 20 ? 'bg-green-50 dark:bg-green-900/20' : editProfitMargin > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Profit per unit:</span>
                        <span className={`font-bold ${editProfitMargin > 20 ? 'text-green-600' : editProfitMargin > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          KES {(editSellingPrice - editLandedCost).toLocaleString()} ({editProfitMargin}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Min Stock */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Minimum Stock Level</label>
                  <input
                    type="number"
                    value={editForm.min_stock}
                    onChange={e => setEditForm({ ...editForm, min_stock: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                  />
                </div>
              </div>

              <div className="p-5 border-t dark:border-gray-700 flex gap-3">
                <button
                  onClick={closeEditModal}
                  className="flex-1 py-2.5 text-gray-600 dark:text-gray-300 font-medium bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="flex-1 py-2.5 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 flex items-center justify-center"
                >
                  {editSaving ? <RotateCcw className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Bulk Import Modal */}
      {
        showBulkImport && (
          <BulkImport
            onComplete={refreshInventory}
            onClose={() => setShowBulkImport(false)}
          />
        )
      }
    </Layout >
  );
};

export default Inventory;