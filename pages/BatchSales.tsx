import React, { useState, useMemo } from 'react';
import Layout from '../components/common/Layout';
import { useInventory } from '../contexts/InventoryContext';
import { InventoryItem } from '../types';
import { Plus, Trash2, Search, FileText, Calendar, Hash, X, Check, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface SaleLineItem {
  uuid: string;
  part_number: string;
  name: string;
  qty: number;
  buying_price_aed: number;
  selling_price: number;
  sold_for: number;
}

const RecordSale: React.FC = () => {
  const { items, refreshInventory } = useInventory();

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptNo, setReceiptNo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'M-Pesa' | 'Credit'>('Cash');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<SaleLineItem[]>([]);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter inventory for search
  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const s = searchTerm.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(s) ||
      item.part_number.toLowerCase().includes(s)
    ).slice(0, 8);
  }, [searchTerm, items]);

  // Calculate totals
  const totals = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    lineItems.forEach(item => {
      revenue += item.sold_for * item.qty;
      cost += item.buying_price_aed * 36.5 * 1.35 * item.qty;
    });
    return { revenue, cost, profit: revenue - cost };
  }, [lineItems]);

  // Add item to sale
  const addItem = (item: InventoryItem) => {
    const existing = lineItems.find(li => li.uuid === item.uuid);
    if (existing) {
      setLineItems(lineItems.map(li =>
        li.uuid === item.uuid ? { ...li, qty: li.qty + 1 } : li
      ));
    } else {
      setLineItems([...lineItems, {
        uuid: item.uuid,
        part_number: item.part_number,
        name: item.name,
        qty: 1,
        buying_price_aed: item.aed_buying_price,
        selling_price: item.selling_price,
        sold_for: item.selling_price
      }]);
    }
    setSearchTerm('');
    setShowSearch(false);
  };

  // Update line item
  const updateLineItem = (uuid: string, field: keyof SaleLineItem, value: any) => {
    setLineItems(lineItems.map(li =>
      li.uuid === uuid ? { ...li, [field]: value } : li
    ));
  };

  // Remove line item
  const removeItem = (uuid: string) => {
    setLineItems(lineItems.filter(li => li.uuid !== uuid));
  };

  // Submit sale record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lineItems.length === 0) {
      setError('Add at least one item to the sale');
      return;
    }
    if (!receiptNo.trim()) {
      setError('Receipt number is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        date: new Date(date).toISOString(),
        batch_id: receiptNo,
        items: lineItems.map(li => ({
          uuid: li.uuid,
          name: li.name,
          part_number: li.part_number,
          qty: li.qty,
          unit_price: li.sold_for,
          buying_price_aed: li.buying_price_aed
        })),
        total_kes: totals.revenue,
        payment_method: paymentMethod,
        customer_name: customerName,
        notes: notes
      };

      await api.sales.create(payload);
      await refreshInventory();

      setSuccessMsg(`Sale #${receiptNo} recorded! Stock updated.`);

      // Reset form
      setLineItems([]);
      setReceiptNo('');
      setCustomerName('');
      setNotes('');

      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="Record Sale">
      <div className="p-4 lg:p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Record a Sale</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Enter completed sales to keep records and update stock</p>
        </div>

        {/* Messages */}
        {successMsg && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl text-green-800 dark:text-green-200 flex items-center gap-3">
            <Check size={20} />
            <span className="flex-1">{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)}><X size={18} /></button>
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl text-red-800 dark:text-red-200 flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X size={18} /></button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Receipt Details */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <FileText size={18} />
              Receipt Details
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Sale Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Receipt # *</label>
                <input
                  type="text"
                  value={receiptNo}
                  onChange={e => setReceiptNo(e.target.value)}
                  placeholder="e.g. 0042"
                  required
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Payment</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Customer</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Optional"
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Items Sold</h3>

            {/* Search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search to add item..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />

              {showSearch && searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 max-h-60 overflow-y-auto">
                  {searchResults.map(item => (
                    <button
                      key={item.uuid}
                      type="button"
                      onClick={() => addItem(item)}
                      className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b dark:border-gray-700 last:border-0"
                    >
                      <div className="font-medium text-sm dark:text-white">{item.name}</div>
                      <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                        <span className="font-mono">{item.part_number}</span>
                        <span>KES {item.selling_price.toLocaleString()} • Stock: {item.stock_qty}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Line Items */}
            {lineItems.length > 0 ? (
              <div className="space-y-3">
                {lineItems.map(item => (
                  <div key={item.uuid} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-sm dark:text-white">{item.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{item.part_number}</div>
                        <div className="text-xs text-gray-400 mt-1">Buy: AED {item.buying_price_aed}</div>
                      </div>
                      <button type="button" onClick={() => removeItem(item.uuid)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={e => updateLineItem(item.uuid, 'qty', parseInt(e.target.value) || 1)}
                          className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm dark:text-white text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Price (KES)</label>
                        <input
                          type="number"
                          min="0"
                          value={item.sold_for}
                          onChange={e => updateLineItem(item.uuid, 'sold_for', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm dark:text-white text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Subtotal</label>
                        <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded text-sm font-bold dark:text-white text-center">
                          {(item.sold_for * item.qty).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Search size={32} className="mx-auto mb-2 opacity-50" />
                <p>Search and add items that were sold</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this sale..."
              rows={2}
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white resize-none"
            />
          </div>

          {/* Summary & Submit */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
              <div>
                <div className="text-xs text-gray-500 mb-1">Items</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {lineItems.reduce((sum, i) => sum + i.qty, 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Total</div>
                <div className="text-xl font-bold text-brand-600 dark:text-brand-400">
                  KES {totals.revenue.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Est. Profit</div>
                <div className={`text-lg font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totals.profit >= 0 ? '+' : ''}{Math.round(totals.profit).toLocaleString()}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || lineItems.length === 0}
              className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center justify-center transition-all ${submitting || lineItems.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700 active:scale-[0.98]'
                }`}
            >
              {submitting ? 'Recording...' : (
                <>
                  <Check size={20} className="mr-2" />
                  Record Sale & Update Stock
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 text-center mt-2">
              Stock will be deducted automatically for each item
            </p>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default RecordSale;