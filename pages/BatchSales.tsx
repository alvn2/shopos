import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Layout from '../components/common/Layout';
import { useInventory } from '../contexts/InventoryContext';
import { InventoryItem } from '../types';
import { Plus, Trash2, Search, FileText, Calendar, Hash, X, Check, AlertCircle, Percent, CreditCard, Camera } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import BarcodeScanner from '../components/common/BarcodeScanner';
import { toast } from 'react-hot-toast';

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
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;

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

  // Discount State
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');

  // Split Payment State
  const [splitPayment, setSplitPayment] = useState(false);
  const [primaryPaymentAmount, setPrimaryPaymentAmount] = useState('');
  const [secondaryMethod, setSecondaryMethod] = useState<'Cash' | 'M-Pesa' | 'Credit'>('M-Pesa');

  // Customer Auto-suggest
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

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

  // Computed discount
  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (val <= 0) return 0;
    if (discountType === 'percent') return Math.round(totals.revenue * (val / 100));
    return Math.min(val, totals.revenue);
  }, [discountType, discountValue, totals.revenue]);

  const finalTotal = totals.revenue - discountAmount;

  // Split payment calculations
  const primaryAmount = splitPayment ? (parseFloat(primaryPaymentAmount) || 0) : finalTotal;
  const secondaryAmount = splitPayment ? Math.max(0, finalTotal - primaryAmount) : 0;

  // Customer search effect
  useEffect(() => {
    if (customerName.length < 2) { setCustomerResults([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const results = await api.customers.search(customerName);
        setCustomerResults(results);
        setShowCustomerDropdown(true);
      } catch { setCustomerResults([]); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerName]);

  // Barcode scan handler
  const handleBarcodeScan = useCallback((code: string) => {
    const item = items.find(i => i.part_number.toUpperCase() === code.toUpperCase());
    if (item) {
      addItem(item);
      toast.success(`Added: ${item.name}`);
    } else {
      toast.error(`Item not found: ${code}`);
    }
  }, [items]);

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

  // Select customer from dropdown
  const selectCustomer = (customer: any) => {
    setCustomerName(customer.name);
    setSelectedCustomerId(customer.id);
    setShowCustomerDropdown(false);
    setCustomerResults([]);
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

    // Validate split payment
    if (splitPayment && Math.abs(primaryAmount + secondaryAmount - finalTotal) > 1) {
      setError('Split payment amounts must equal the total');
      setSubmitting(false);
      return;
    }

    try {
      const paymentsArray = splitPayment
        ? [{ method: paymentMethod, amount: primaryAmount }, { method: secondaryMethod, amount: secondaryAmount }]
        : [{ method: paymentMethod, amount: finalTotal }];

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
        total_kes: finalTotal,
        payment_method: splitPayment ? `${paymentMethod}+${secondaryMethod}` : paymentMethod,
        customer_name: customerName,
        customer_id: selectedCustomerId || undefined,
        notes: notes,
        discount_type: discountAmount > 0 ? discountType : undefined,
        discount_value: discountAmount > 0 ? parseFloat(discountValue) : undefined,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        payments: paymentsArray
      };

      await api.sales.create(payload);

      // If credit sale with a customer, add credit entry
      if (selectedCustomerId && (paymentMethod === 'Credit' || (splitPayment && secondaryMethod === 'Credit'))) {
        const creditAmount = paymentMethod === 'Credit' ? primaryAmount : secondaryAmount;
        if (creditAmount > 0) {
          try {
            await api.customers.recordPayment(selectedCustomerId, { amount: -creditAmount, reference: receiptNo });
          } catch { /* Credit tracking is best-effort */ }
        }
      }

      await refreshInventory();

      setSuccessMsg(`Sale #${receiptNo} recorded! Total: KES ${finalTotal.toLocaleString()}`);

      // Reset form
      setLineItems([]);
      setReceiptNo('');
      setCustomerName('');
      setSelectedCustomerId(null);
      setNotes('');
      setDiscountValue('');
      setSplitPayment(false);
      setPrimaryPaymentAmount('');

      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="Record Sale">
      <div className="p-4 lg:p-8 max-w-4xl mx-auto animate-enter">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Record a Sale</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Enter completed sales to keep records and automatically deduct stock</p>
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Receipt Details */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-5 flex items-center gap-3 text-lg">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                <FileText size={20} />
              </div>
              Receipt Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Sale Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full p-3 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Receipt # <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={receiptNo}
                  onChange={e => setReceiptNo(e.target.value)}
                  placeholder="e.g. 0042"
                  required
                  className="w-full p-3 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Payment</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="w-full p-3 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all shadow-inner"
                >
                  <option value="Cash">Cash</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>

              <div className="space-y-1.5 relative">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Customer</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => { setCustomerName(e.target.value); setSelectedCustomerId(null); }}
                  onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
                  placeholder="Type to search..."
                  className="w-full p-3 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all shadow-inner"
                />
                {selectedCustomerId && <span className="absolute right-3 top-8 text-xs text-emerald-500 font-bold">✓ Linked</span>}
                {showCustomerDropdown && customerResults.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 glass-dropdown rounded-xl overflow-hidden animate-enter">
                    {customerResults.map((c: any) => (
                      <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/50 last:border-0 transition-colors text-sm">
                        <span className="font-bold text-slate-900 dark:text-white">{c.name}</span>
                        {c.phone && <span className="text-slate-400 ml-2">{c.phone}</span>}
                        {c.total_credit > 0 && <span className="text-rose-500 ml-2 font-bold">Owes KES {c.total_credit.toLocaleString()}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Split Payment */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
              <button type="button" onClick={() => setSplitPayment(!splitPayment)} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors ${splitPayment ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <CreditCard size={14} />
                Split Payment {splitPayment ? '(On)' : ''}
              </button>
              {splitPayment && (
                <div className="grid grid-cols-2 gap-3 mt-3 animate-slide-up">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">{paymentMethod} Amount</label>
                    <input type="number" value={primaryPaymentAmount} onChange={e => setPrimaryPaymentAmount(e.target.value)} placeholder="Amount" className="input-modern !py-2.5" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Second Method</label>
                    <select value={secondaryMethod} onChange={e => setSecondaryMethod(e.target.value as any)} className="input-modern !py-2.5">
                      {['Cash', 'M-Pesa', 'Credit'].filter(m => m !== paymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {secondaryAmount > 0 && <div className="text-xs font-bold text-brand-600 dark:text-brand-400">= KES {secondaryAmount.toLocaleString()}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3 text-lg">
                <div className="p-2 bg-brand-100 dark:bg-brand-900/40 rounded-lg text-brand-600 dark:text-brand-400">
                  <Hash size={20} />
                </div>
                Items Sold
              </h3>
              <div className="flex items-center gap-2">
                <BarcodeScanner onScan={handleBarcodeScan} label="Scan" />
                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{lineItems.length} items</span>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search inventory to add..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all shadow-inner"
              />

              {showSearch && searchResults.length > 0 && (
                <div className="absolute z-30 w-full mt-2 glass-dropdown rounded-2xl overflow-hidden animate-enter origin-top">
                  {searchResults.map(item => (
                    <button
                      key={item.uuid}
                      type="button"
                      onClick={() => addItem(item)}
                      className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/50 last:border-0 transition-colors group"
                    >
                      <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{item.name}</div>
                      <div className="flex justify-between items-center text-xs mt-1.5">
                        <span className="font-mono font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{item.part_number}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-700 dark:text-slate-300">KES {item.selling_price.toLocaleString()}</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${item.stock_qty > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30'}`}>Stock: {item.stock_qty}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Line Items */}
            {lineItems.length > 0 ? (
              <div className="space-y-4">
                {lineItems.map(item => (
                  <div key={item.uuid} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm relative group transition-all hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 w-full">
                    {/* Item Remove Button (Absolute) */}
                    <button type="button" onClick={() => removeItem(item.uuid)} className="absolute -right-2 -top-2 w-8 h-8 bg-white dark:bg-slate-700 rounded-full shadow border border-slate-200 dark:border-slate-600 flex items-center justify-center text-rose-500 hover:text-white hover:bg-rose-500 dark:hover:bg-rose-500 transition-all z-10 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100">
                      <X size={14} className="stroke-[3]" />
                    </button>

                    <div className="flex flex-col md:flex-row gap-4 w-full">
                      {/* Item Info side */}
                      <div className="flex-1">
                        <div className="font-bold text-sm text-slate-900 dark:text-white mb-1 leading-tight pr-6">{item.name}</div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-xs text-slate-500 font-mono font-bold bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">{item.part_number}</div>
                          {isAdmin && <div className="text-xs text-slate-400 font-medium">Buy: AED {item.buying_price_aed}</div>}
                        </div>
                      </div>

                      {/* Inputs Side */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1 text-center">
                          <label className="block text-xs font-bold text-slate-500 tracking-wide uppercase">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={e => updateLineItem(item.uuid, 'qty', parseInt(e.target.value) || 1)}
                            className="w-full lg:w-20 p-2.5 mx-auto bg-slate-50/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-brand-500 outline-none shadow-inner"
                          />
                        </div>
                        <div className="space-y-1 text-center font-bold">
                          <label className="block text-xs font-bold text-slate-500 tracking-wide uppercase">Price (KES)</label>
                          <input
                            type="number"
                            min="0"
                            value={item.sold_for}
                            onChange={e => updateLineItem(item.uuid, 'sold_for', parseFloat(e.target.value) || 0)}
                            className="w-full lg:w-32 p-2.5 mx-auto bg-slate-50/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-brand-500 outline-none shadow-inner"
                          />
                        </div>
                        <div className="space-y-1 text-center">
                          <label className="block text-xs font-bold text-slate-500 tracking-wide uppercase">Subtotal</label>
                          <div className="p-2.5 border border-transparent flex items-center justify-center text-sm font-black text-brand-600 dark:text-brand-400">
                            {(item.sold_for * item.qty).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 px-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <Search size={32} className="mx-auto mb-3 text-slate-400 opacity-50" />
                <p className="font-bold text-slate-500 dark:text-slate-400">Search and add items that were sold</p>
                <p className="text-sm text-slate-400 mt-1">Select from the dropdown above to build the receipt</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1 mb-1.5">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this sale (e.g., delivered by bike)..."
              rows={2}
              className="w-full p-3 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-500/50 outline-none resize-none shadow-inner"
            />
          </div>

          {/* Discount */}
          {lineItems.length > 0 && (
            <div className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400">
                  <Percent size={18} />
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Discount</span>
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shrink-0">
                  <button type="button" onClick={() => setDiscountType('percent')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${discountType === 'percent' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>%</button>
                  <button type="button" onClick={() => setDiscountType('fixed')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${discountType === 'fixed' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>KES</button>
                </div>
                <input type="number" min="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 500'} className="input-modern flex-1 !py-2.5" />
                {discountAmount > 0 && (
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    -KES {discountAmount.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary & Submit */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 mt-8 mb-4">
            <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-4 mb-6 text-center divide-x divide-slate-200 dark:divide-slate-700/50`}>
              <div className="flex flex-col items-center justify-center py-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Total Items</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {lineItems.reduce((sum, i) => sum + i.qty, 0)}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center py-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{discountAmount > 0 ? 'Final Total' : 'Gross Revenue'}</div>
                <div className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-400 dark:to-indigo-400">
                  KES {finalTotal.toLocaleString()}
                </div>
                {discountAmount > 0 && (
                  <div className="text-xs text-slate-400 mt-1 line-through">KES {totals.revenue.toLocaleString()}</div>
                )}
              </div>
              {isAdmin && (
              <div className="flex flex-col items-center justify-center py-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Est. Profit</div>
                <div className={`text-xl font-black ${totals.profit - discountAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {totals.profit - discountAmount >= 0 ? '+' : ''}KES {Math.round(totals.profit - discountAmount).toLocaleString()}
                </div>
              </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || lineItems.length === 0}
              className={`w-full py-4 rounded-2xl font-black text-white text-lg flex items-center justify-center transition-all duration-300 ${submitting || lineItems.length === 0
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:shadow-glow hover:shadow-brand-500/40 active:scale-[0.98]'
                }`}
            >
              {submitting ? 'Recording...' : (
                <>
                  <Check strokeWidth={3} size={22} className="mr-2" />
                  Record Sale — KES {finalTotal.toLocaleString()}
                </>
              )}
            </button>

            <p className="text-xs font-bold text-slate-400 text-center mt-4 tracking-wide uppercase">
              Stock will be deducted automatically for each item
            </p>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default RecordSale;