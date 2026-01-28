import React, { useState, useMemo, useEffect } from 'react';
import Layout from '../components/common/Layout';
import { useInventory } from '../contexts/InventoryContext';
import { InventoryItem, Settings } from '../types';
import { Minus, Plus, Save, RotateCcw, Check, Package, Search, Trash2, Edit2, X, Calculator } from 'lucide-react';
import { api } from '../services/api';

const Inventory: React.FC = () => {
  const { items, loading, refreshInventory } = useInventory();
  const [localItems, setLocalItems] = useState<InventoryItem[]>([]);
  const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
    aed_buying_price: '',
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

  // Edit Modal Functions
  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      part_number: item.part_number,
      name: item.name,
      tags: item.tags || '',
      aed_buying_price: item.aed_buying_price.toString(),
      selling_price: item.selling_price.toString(),
      min_stock: item.min_stock.toString()
    });
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditForm({ part_number: '', name: '', tags: '', aed_buying_price: '', selling_price: '', min_stock: '' });
  };

  const handleEditSave = async () => {
    if (!editingItem) return;
    setEditSaving(true);

    try {
      await api.inventory.updateBatch([{
        uuid: editingItem.uuid,
        part_number: editForm.part_number.trim().toUpperCase(),
        name: editForm.name.trim(),
        tags: editForm.tags.trim(),
        aed_buying_price: parseFloat(editForm.aed_buying_price) || 0,
        selling_price: parseFloat(editForm.selling_price) || 0,
        min_stock: parseInt(editForm.min_stock) || 5
      }]);
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
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        {/* Rate Info Banner */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg flex items-center gap-3 text-sm">
          <Calculator size={18} className="text-blue-500" />
          <span className="text-blue-800 dark:text-blue-200">
            <strong>Rate:</strong> AED × {aedRate} × (1 + {conversionPercent}%) = <strong>{(aedRate * (1 + conversionPercent / 100)).toFixed(2)} KES/AED landed</strong>
          </span>
        </div>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {items.length} items • {lowStockCount} low stock • {outOfStockCount} out of stock
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-6 space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, part number, or tag..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setFilter('all')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-100' : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700'}`}>
              All ({items.length})
            </button>
            <button onClick={() => setFilter('low')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${filter === 'low' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700'}`}>
              Low ({lowStockCount})
            </button>
            <button onClick={() => setFilter('out')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${filter === 'out' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700'}`}>
              Out ({outOfStockCount})
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
                <div key={item.uuid} className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border transition-colors ${isModified ? 'border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                  {/* Item Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{item.part_number}</span>
                        {item.stock_qty === 0 && (
                          <span className="text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">OUT</span>
                        )}
                        {item.stock_qty > 0 && item.stock_qty <= item.min_stock && (
                          <span className="text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded">LOW</span>
                        )}
                        {isModified && (
                          <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">Modified</span>
                        )}
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white text-lg">{item.name}</div>
                      {item.tags && <div className="text-xs text-gray-400 mt-1">{item.tags}</div>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                        title="Edit item"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.uuid)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete item"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Pricing Row - Enhanced with KES buying price */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Buy:</span> AED {item.aed_buying_price}
                        <span className="mx-1">→</span>
                        <span className="text-gray-700 dark:text-gray-300 font-bold">KES {landedCostKES.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 ml-1">(landed)</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 font-medium">Sell:</span>
                        <span className="ml-2 text-brand-600 dark:text-brand-400 font-bold text-lg">KES {item.selling_price.toLocaleString()}</span>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-bold ${profitMargin > 30 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : profitMargin > 10 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {profitMargin > 0 ? '+' : ''}{profitMargin}% margin
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 flex justify-between">
                      <span>Min stock: {item.min_stock}</span>
                      <span>Profit: KES {(item.selling_price - landedCostKES).toLocaleString()}/unit</span>
                    </div>
                  </div>

                  {/* Stock Controls */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                      {isModified && original ? `Was: ${original.stock_qty}` : 'Stock'}
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleAdjust(item.uuid, -1)}
                        className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center active:scale-95 transition-transform hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        <Minus size={20} />
                      </button>
                      <span className="text-2xl font-bold w-16 text-center dark:text-white">{item.stock_qty}</span>
                      <button
                        onClick={() => handleAdjust(item.uuid, 1)}
                        className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 flex items-center justify-center active:scale-95 transition-transform hover:bg-brand-200 dark:hover:bg-brand-800"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Save Bar */}
        {modifiedIds.size > 0 && (
          <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-40 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {modifiedIds.size} item{modifiedIds.size > 1 ? 's' : ''} modified
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setLocalItems(items); setModifiedIds(new Set()); }}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-md hover:bg-brand-700 active:scale-95 transition-all flex items-center"
              >
                {saving ? <RotateCcw className="animate-spin mr-2" size={18} /> : <Check className="mr-2" size={18} />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
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
      )}
    </Layout>
  );
};

export default Inventory;