import React, { useState, useRef, useEffect, useMemo } from 'react';
import Layout from '../components/common/Layout';
import { useInventory } from '../contexts/InventoryContext';
import { api } from '../services/api';
import { v4 as uuidv4 } from 'uuid';
import { Save, Package, AlertCircle, Check, Zap, RefreshCw, ArrowRight, Layers } from 'lucide-react';
import { PartMake, InventoryItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import OcrScanner, { OcrResult } from '../components/common/OcrScanner';
import { toast } from 'react-hot-toast';

const AddItem: React.FC = () => {
    const { items, addLocalItem, updateLocalItem, settings, refreshInventory } = useInventory();
    const { user } = useAuth();
    const partNumberRef = useRef<HTMLInputElement>(null);

    // Form state
    const [partNumber, setPartNumber] = useState('');
    const [name, setName] = useState('');
    const [tags, setTags] = useState('');
    const [make, setMake] = useState<PartMake>('Genuine');
    const [aedBuyingPrice, setAedBuyingPrice] = useState('');
    const [kshBuyingPrice, setKshBuyingPrice] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [stockQty, setStockQty] = useState('');
    const [minStock, setMinStock] = useState('5');

    // UI state
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentlyAdded, setRecentlyAdded] = useState<string[]>([]);

    // Auto-focus on mount
    useEffect(() => {
        partNumberRef.current?.focus();
    }, []);

    const aedRate = settings?.aed_rate || 36.5;
    const conversionPercent = settings?.conversion_percent || 13;

    // =============================
    // DUPLICATE DETECTION
    // =============================
    // Items are uniquely identified by part_number + make combo.
    // Same part_number can exist as Genuine, Aftermarket, Japan, etc.
    const existingMatch = useMemo(() => {
        if (!partNumber.trim()) return null;
        const normalizedPN = partNumber.trim().replace(/[\s\-\/]/g, '').toUpperCase();
        const normalizedMake = (make || 'Genuine').trim().toLowerCase();
        return items.find(item => {
            const itemPN = item.part_number.replace(/[\s\-\/]/g, '').toUpperCase();
            const itemMake = (item.make || 'Genuine').trim().toLowerCase();
            return itemPN === normalizedPN && itemMake === normalizedMake;
        }) || null;
    }, [partNumber, make, items]);

    // Also find other makes with same part number (for info display)
    const otherMakes = useMemo(() => {
        if (!partNumber.trim()) return [];
        const normalizedPN = partNumber.trim().replace(/[\s\-\/]/g, '').toUpperCase();
        const normalizedMake = (make || 'Genuine').trim().toLowerCase();
        return items.filter(item => {
            const itemPN = item.part_number.replace(/[\s\-\/]/g, '').toUpperCase();
            const itemMake = (item.make || 'Genuine').trim().toLowerCase();
            return itemPN === normalizedPN && itemMake !== normalizedMake;
        });
    }, [partNumber, make, items]);

    // Handle OCR scan
    const handleOcrScan = (result: OcrResult) => {
        if (result.partNumber) {
            setPartNumber(result.partNumber);
        }
        if (result.name) {
            setName(result.name);
        }
        if (result.partNumber || result.name) {
            toast.success('Sticker data extracted');
        } else {
            // Give user raw info if nothing matched cleanly
            toast.success('Sticker scanned, check part number field');
        }
    };

    const resetForm = () => {
        setPartNumber('');
        setName('');
        setTags('');
        setMake('Genuine');
        setAedBuyingPrice('');
        setKshBuyingPrice('');
        setSellingPrice('');
        setStockQty('');
        setMinStock('5');
    };

    const handleSubmit = async (e: React.FormEvent, continueAdding = false) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!partNumber.trim()) { setError('Part number is required'); return; }
        if (!name.trim()) { setError('Item name is required'); return; }

        const hasAedPrice = aedBuyingPrice && parseFloat(aedBuyingPrice) > 0;
        const hasKshPrice = kshBuyingPrice && parseFloat(kshBuyingPrice) > 0;
        if (!hasAedPrice && !hasKshPrice) { setError('Please enter a buying price (AED or KSH)'); return; }
        if (!sellingPrice || parseFloat(sellingPrice) <= 0) { setError('Valid selling price (KES) is required'); return; }

        setSubmitting(true);

        try {
            if (existingMatch) {
                // =============================
                // UPDATE EXISTING ITEM
                // Merge: add stock, update prices if provided
                // =============================
                const addQty = parseInt(stockQty) || 0;
                const updatedFields: Partial<InventoryItem> = {
                    stock_qty: existingMatch.stock_qty + addQty,
                    last_updated: new Date().toISOString(),
                    updated_by: user?.username || 'unknown'
                };

                // Update prices if they differ from existing
                const newAedPrice = parseFloat(aedBuyingPrice) || 0;
                const newKshPrice = parseFloat(kshBuyingPrice) || 0;
                const newSellingPrice = parseFloat(sellingPrice);

                if (newAedPrice > 0 && newAedPrice !== existingMatch.aed_buying_price) {
                    updatedFields.aed_buying_price = newAedPrice;
                }
                if (newKshPrice > 0 && newKshPrice !== existingMatch.ksh_buying_price) {
                    updatedFields.ksh_buying_price = newKshPrice;
                }
                if (newSellingPrice > 0 && newSellingPrice !== existingMatch.selling_price) {
                    updatedFields.selling_price = newSellingPrice;
                }
                if (name.trim() !== existingMatch.name) {
                    updatedFields.name = name.trim();
                }
                if (tags.trim() && tags.trim() !== existingMatch.tags) {
                    updatedFields.tags = tags.trim();
                }
                if (parseInt(minStock) !== existingMatch.min_stock) {
                    updatedFields.min_stock = parseInt(minStock) || 5;
                }

                // Optimistic update
                updateLocalItem(existingMatch.uuid, updatedFields);

                const feedbackParts = [];
                if (addQty > 0) feedbackParts.push(`+${addQty} stock`);
                if (updatedFields.selling_price) feedbackParts.push(`price → KES ${newSellingPrice.toLocaleString()}`);
                if (updatedFields.aed_buying_price) feedbackParts.push(`AED → ${newAedPrice}`);
                const feedbackMsg = feedbackParts.length > 0
                    ? `Updated "${existingMatch.name}" (${make}): ${feedbackParts.join(', ')}`
                    : `"${existingMatch.name}" already exists with same values`;

                setRecentlyAdded(prev => [feedbackMsg, ...prev.slice(0, 4)]);
                resetForm();

                if (continueAdding) {
                    setTimeout(() => partNumberRef.current?.focus(), 50);
                }

                // Background API sync
                api.inventory.update(existingMatch.uuid, updatedFields).catch(err => {
                    console.error('Background update failed:', err);
                    setError(`Update for "${existingMatch.name}" may not have synced — check inventory`);
                });

            } else {
                // =============================
                // CREATE NEW ITEM
                // =============================
                const newItem: InventoryItem = {
                    uuid: uuidv4(),
                    part_number: partNumber.trim().toUpperCase(),
                    name: name.trim(),
                    tags: tags.trim(),
                    make: make,
                    aed_buying_price: parseFloat(aedBuyingPrice) || 0,
                    ksh_buying_price: parseFloat(kshBuyingPrice) || 0,
                    selling_price: parseFloat(sellingPrice),
                    stock_qty: parseInt(stockQty) || 0,
                    min_stock: parseInt(minStock) || 5,
                    last_updated: new Date().toISOString(),
                    updated_by: user?.username || 'unknown'
                };

                // Optimistic update
                addLocalItem(newItem);
                setRecentlyAdded(prev => [`Added "${newItem.name}" (${make}) — new item`, ...prev.slice(0, 4)]);
                resetForm();

                if (continueAdding) {
                    setTimeout(() => partNumberRef.current?.focus(), 50);
                }

                // Background API sync
                api.inventory.create({
                    uuid: newItem.uuid,
                    part_number: newItem.part_number,
                    name: newItem.name,
                    tags: newItem.tags,
                    make: newItem.make,
                    aed_buying_price: newItem.aed_buying_price,
                    ksh_buying_price: newItem.ksh_buying_price,
                    selling_price: newItem.selling_price,
                    stock_qty: newItem.stock_qty,
                    min_stock: newItem.min_stock
                }).catch(err => {
                    console.error('Background save failed:', err);
                    setError(`"${newItem.name}" may not have saved to server — please check inventory`);
                });
            }
        } catch (err: any) {
            setError(err.message || 'Failed to process item');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate estimated profit margin
    const estimatedLandedCost = aedBuyingPrice ? parseFloat(aedBuyingPrice) * aedRate * (1 + conversionPercent / 100) : 0;
    const estimatedProfit = sellingPrice ? parseFloat(sellingPrice) - estimatedLandedCost : 0;
    const marginPercent = sellingPrice && estimatedLandedCost ? ((estimatedProfit / parseFloat(sellingPrice)) * 100) : 0;

    return (
        <Layout title="Add Item">
            <div className="p-4 lg:p-8 max-w-2xl mx-auto animate-enter">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Add New Item</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Fill in the details to add a new part to your inventory</p>
                </div>

                {/* Recently Added Stack */}
                {recentlyAdded.length > 0 && (
                    <div className="mb-6 space-y-2">
                        {recentlyAdded.map((msg, i) => (
                            <div
                                key={`${msg}-${i}`}
                                className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium animate-slide-up ${msg.includes('Updated') ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 text-blue-700 dark:text-blue-300' : 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300'}`}
                                style={{ opacity: 1 - i * 0.2, animationDelay: `${i * 50}ms` }}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center animate-success-pop shrink-0 ${msg.includes('Updated') ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                                    <Check size={14} className="text-white" strokeWidth={3} />
                                </div>
                                {msg}
                            </div>
                        ))}
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl text-red-700 dark:text-red-300 flex items-center gap-3 animate-slide-up">
                        <AlertCircle size={20} className="shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 p-1">&times;</button>
                    </div>
                )}

                <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
                    {/* Basic Info */}
                    <div className="card-modern p-5 lg:p-6">
                        <h2 className="font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2 text-lg">
                            <div className="p-2 bg-brand-100 dark:bg-brand-900/40 rounded-lg text-brand-600 dark:text-brand-400">
                                <Package size={18} />
                            </div>
                            Part Information
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 pt-1">
                                <label className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1 mb-1.5">
                                    <span>Part Number <span className="text-rose-500">*</span></span>
                                    <OcrScanner onScan={handleOcrScan} label="Scan Sticker" />
                                </label>
                                <input
                                    ref={partNumberRef}
                                    type="text"
                                    value={partNumber}
                                    onChange={e => setPartNumber(e.target.value)}
                                    placeholder="e.g. 90915-YZZD2"
                                    className="input-modern font-mono uppercase"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                                    Item Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Oil Filter 1KD"
                                    className="input-modern"
                                    required
                                />
                            </div>

                            <div className="md:col-span-2 space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                                    Tags (comma separated)
                                </label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={e => setTags(e.target.value)}
                                    placeholder="e.g. Service, LC70, Toyota"
                                    className="input-modern"
                                />
                            </div>

                            <div className="md:col-span-2 space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                                    Make / Quality <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={make}
                                    onChange={e => setMake(e.target.value)}
                                    placeholder="e.g. Genuine, Aftermarket, Taiho, MK"
                                    className="input-modern"
                                />
                                <p className="text-xs text-slate-400 pl-1 mt-1">
                                    Items with same part number but different make are stored separately
                                </p>
                            </div>
                        </div>

                        {/* =============================
                            DUPLICATE DETECTION BANNER
                        ============================= */}
                        {existingMatch && (
                            <div className="mt-5 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl animate-slide-up">
                                <div className="flex items-start gap-3">
                                    <Layers size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-amber-800 dark:text-amber-200 text-sm">
                                            This item already exists!
                                        </p>
                                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                            <span className="font-mono font-bold">{existingMatch.part_number}</span> ({existingMatch.make}) — "{existingMatch.name}"
                                        </p>
                                        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                                            <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2">
                                                <span className="text-amber-600 dark:text-amber-400 font-semibold block">Current Stock</span>
                                                <span className="font-bold text-slate-900 dark:text-white text-base">{existingMatch.stock_qty}</span>
                                            </div>
                                            <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2">
                                                <span className="text-amber-600 dark:text-amber-400 font-semibold block">Buy AED</span>
                                                <span className="font-bold text-slate-900 dark:text-white text-base">{existingMatch.aed_buying_price}</span>
                                            </div>
                                            <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2">
                                                <span className="text-amber-600 dark:text-amber-400 font-semibold block">Sell KES</span>
                                                <span className="font-bold text-slate-900 dark:text-white text-base">{existingMatch.selling_price.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 font-semibold flex items-center gap-1">
                                            <ArrowRight size={12} />
                                            Submitting will add stock & update prices if different
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Other makes info */}
                        {otherMakes.length > 0 && !existingMatch && (
                            <div className="mt-5 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl text-xs">
                                <span className="text-slate-500 dark:text-slate-400 font-semibold">
                                    This part # exists in {otherMakes.length} other make{otherMakes.length > 1 ? 's' : ''}:
                                </span>
                                <div className="flex gap-2 mt-1.5 flex-wrap">
                                    {otherMakes.map(item => (
                                        <span key={item.uuid} className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md font-bold text-slate-700 dark:text-slate-300">
                                            {item.make} (×{item.stock_qty})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pricing */}
                    <div className="card-modern p-5 lg:p-6">
                        <h2 className="font-bold text-slate-900 dark:text-white mb-5 text-lg">Pricing</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                                    Buying Price (AED)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={aedBuyingPrice}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setAedBuyingPrice(val);
                                        if (!sellingPrice) {
                                            let cost = 0;
                                            if (kshBuyingPrice && parseFloat(kshBuyingPrice) > 0) {
                                                cost = parseFloat(kshBuyingPrice);
                                            } else if (val && parseFloat(val) > 0) {
                                                cost = parseFloat(val) * aedRate * (1 + conversionPercent / 100);
                                            }
                                            if (cost > 0) setSellingPrice((cost * 1.5).toFixed(0));
                                        }
                                    }}
                                    placeholder={existingMatch ? `Current: ${existingMatch.aed_buying_price}` : '0.00'}
                                    className="input-modern"
                                />
                                {aedBuyingPrice && (
                                    <p className="text-xs text-slate-500 pl-1">
                                        Est. landed: <span className="font-bold text-slate-700 dark:text-slate-300">KES {estimatedLandedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                                    Buying Price (KSH) — Optional
                                </label>
                                <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={kshBuyingPrice}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setKshBuyingPrice(val);
                                        if (!sellingPrice) {
                                            let cost = 0;
                                            if (val && parseFloat(val) > 0) {
                                                cost = parseFloat(val);
                                            } else if (aedBuyingPrice && parseFloat(aedBuyingPrice) > 0) {
                                                cost = parseFloat(aedBuyingPrice) * aedRate * (1 + conversionPercent / 100);
                                            }
                                            if (cost > 0) setSellingPrice((cost * 1.5).toFixed(0));
                                        }
                                    }}
                                    placeholder={existingMatch ? `Current: ${existingMatch.ksh_buying_price || 0}` : '0'}
                                    className="input-modern"
                                />
                                <p className="text-xs text-slate-400 pl-1">Use when purchased directly in KSH</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                                    Selling Price (KES) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={sellingPrice}
                                    onChange={e => setSellingPrice(e.target.value)}
                                    placeholder={existingMatch ? `Current: ${existingMatch.selling_price}` : '0'}
                                    className="input-modern"
                                    required
                                />
                                {sellingPrice && aedBuyingPrice && (
                                    <p className={`text-xs pl-1 font-bold ${marginPercent >= 20 ? 'text-emerald-600 dark:text-emerald-400' : marginPercent > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                                        Margin: {marginPercent.toFixed(1)}% ({estimatedProfit >= 0 ? '+' : ''}{estimatedProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} KES)
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stock */}
                    <div className="card-modern p-5 lg:p-6">
                        <h2 className="font-bold text-slate-900 dark:text-white mb-5 text-lg">Stock Levels</h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                                    {existingMatch ? 'Stock to ADD' : 'Current Stock'}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={stockQty}
                                    onChange={e => setStockQty(e.target.value)}
                                    placeholder={existingMatch ? `Adds to existing ${existingMatch.stock_qty}` : '0'}
                                    className="input-modern"
                                />
                                {existingMatch && stockQty && parseInt(stockQty) > 0 && (
                                    <p className="text-xs text-blue-600 dark:text-blue-400 pl-1 font-bold">
                                        New total: {existingMatch.stock_qty} + {stockQty} = {existingMatch.stock_qty + parseInt(stockQty)}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                                    Minimum Stock (Alert)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={minStock}
                                    onChange={e => setMinStock(e.target.value)}
                                    placeholder="5"
                                    className="input-modern"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="btn-secondary"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(e as any, true)}
                            disabled={submitting}
                            className="flex-1 btn-secondary flex items-center justify-center gap-2 !border-emerald-300 dark:!border-emerald-700 hover:!bg-emerald-50 dark:hover:!bg-emerald-900/30"
                        >
                            <Zap size={18} />
                            {existingMatch ? 'Update & Continue' : 'Add & Continue'}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 btn-primary"
                        >
                            {submitting ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <Save size={18} className="mr-2" />
                                    {existingMatch ? 'Update Item' : 'Add Item'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
};

export default AddItem;
