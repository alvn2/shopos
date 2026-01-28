import React, { useState } from 'react';
import Layout from '../components/common/Layout';
import { useInventory } from '../contexts/InventoryContext';
import { api } from '../services/api';
import { v4 as uuidv4 } from 'uuid';
import { Save, X, Package, AlertCircle, Check } from 'lucide-react';

const AddItem: React.FC = () => {
    const { refreshInventory } = useInventory();

    // Form state
    const [partNumber, setPartNumber] = useState('');
    const [name, setName] = useState('');
    const [tags, setTags] = useState('');
    const [aedBuyingPrice, setAedBuyingPrice] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [stockQty, setStockQty] = useState('');
    const [minStock, setMinStock] = useState('5');

    // UI state
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const resetForm = () => {
        setPartNumber('');
        setName('');
        setTags('');
        setAedBuyingPrice('');
        setSellingPrice('');
        setStockQty('');
        setMinStock('5');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!partNumber.trim()) {
            setError('Part number is required');
            return;
        }
        if (!name.trim()) {
            setError('Item name is required');
            return;
        }
        if (!aedBuyingPrice || parseFloat(aedBuyingPrice) <= 0) {
            setError('Valid buying price (AED) is required');
            return;
        }
        if (!sellingPrice || parseFloat(sellingPrice) <= 0) {
            setError('Valid selling price (KES) is required');
            return;
        }

        setSubmitting(true);

        try {
            const newItem = {
                uuid: uuidv4(),
                part_number: partNumber.trim().toUpperCase(),
                name: name.trim(),
                tags: tags.trim(),
                aed_buying_price: parseFloat(aedBuyingPrice),
                selling_price: parseFloat(sellingPrice),
                stock_qty: parseInt(stockQty) || 0,
                min_stock: parseInt(minStock) || 5
            };

            await api.inventory.create(newItem);
            await refreshInventory();

            setSuccess(`"${name}" added to inventory!`);
            resetForm();

            setTimeout(() => setSuccess(null), 4000);
        } catch (err: any) {
            setError(err.message || 'Failed to add item');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate estimated profit margin
    const estimatedLandedCost = aedBuyingPrice ? parseFloat(aedBuyingPrice) * 36.5 * 1.35 : 0;
    const estimatedProfit = sellingPrice ? parseFloat(sellingPrice) - estimatedLandedCost : 0;
    const marginPercent = sellingPrice && estimatedLandedCost ? ((estimatedProfit / parseFloat(sellingPrice)) * 100) : 0;

    return (
        <Layout title="Add Item">
            <div className="p-4 lg:p-6 max-w-2xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Inventory Item</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Fill in the details to add a new part to your inventory</p>
                </div>

                {/* Success Message */}
                {success && (
                    <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl text-green-800 dark:text-green-200 flex items-center gap-3">
                        <Check size={20} />
                        <span>{success}</span>
                        <button onClick={() => setSuccess(null)} className="ml-auto"><X size={18} /></button>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl text-red-800 dark:text-red-200 flex items-center gap-3">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto"><X size={18} /></button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                        <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Package size={18} />
                            Part Information
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Part Number *
                                </label>
                                <input
                                    type="text"
                                    value={partNumber}
                                    onChange={e => setPartNumber(e.target.value)}
                                    placeholder="e.g. 90915-YZZD2"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-mono uppercase"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Item Name *
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Oil Filter 1KD"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    required
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Tags (comma separated)
                                </label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={e => setTags(e.target.value)}
                                    placeholder="e.g. Service, LC70, Toyota"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Pricing</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Buying Price (AED) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={aedBuyingPrice}
                                    onChange={e => setAedBuyingPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    required
                                />
                                {aedBuyingPrice && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        Est. landed cost: KES {estimatedLandedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Selling Price (KES) *
                                </label>
                                <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={sellingPrice}
                                    onChange={e => setSellingPrice(e.target.value)}
                                    placeholder="0"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    required
                                />
                                {sellingPrice && aedBuyingPrice && (
                                    <p className={`mt-1 text-xs ${marginPercent >= 20 ? 'text-green-600' : 'text-red-600'}`}>
                                        Margin: {marginPercent.toFixed(1)}% ({estimatedProfit >= 0 ? '+' : ''}{estimatedProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} KES)
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stock */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Stock Levels</h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Current Stock
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={stockQty}
                                    onChange={e => setStockQty(e.target.value)}
                                    placeholder="0"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Minimum Stock (Alert)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={minStock}
                                    onChange={e => setMinStock(e.target.value)}
                                    placeholder="5"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Clear Form
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center transition-all ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 active:scale-[0.98]'
                                }`}
                        >
                            {submitting ? 'Adding...' : (
                                <>
                                    <Save size={20} className="mr-2" />
                                    Add to Inventory
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
