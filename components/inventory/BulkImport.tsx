import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../services/api';
import { PartMake } from '../../types';
import { useInventory } from '../../contexts/InventoryContext';

interface ImportItem {
    part_number: string;
    name: string;
    tags?: string;
    make?: PartMake;
    aed_buying_price?: number;
    ksh_buying_price?: number;
    selling_price?: number;
    stock_qty?: number;
    min_stock?: number;
}

interface ImportResult {
    success: boolean;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ index: number; part_number?: string; error: string }>;
}

interface BulkImportProps {
    onComplete: () => void;
    onClose: () => void;
}

const SAMPLE_CSV = `part_number,name,make,aed_buying_price,ksh_buying_price,selling_price,stock_qty,min_stock,tags
81110-60F50,HEADLIGHT LH,Genuine,150,0,7500,5,2,LC200,Electrical
81110-60F50,HEADLIGHT LH,Japan,80,0,5000,3,2,LC200,Electrical
81110-60F50,HEADLIGHT LH,Aftermarket,40,0,3000,10,3,LC200,Electrical
04465-60320,BRAKE PAD FR,Genuine,85,0,4200,8,3,LC200,Brakes
90915-YZZD4,OIL FILTER,Genuine,12,0,800,20,5,Service`;

const BulkImport: React.FC<BulkImportProps> = ({ onComplete, onClose }) => {
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
    const [items, setItems] = useState<ImportItem[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [updateExisting, setUpdateExisting] = useState(true);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [importing, setImporting] = useState(false);
    
    const { settings } = useInventory();
    const aedRate = settings?.aed_rate || 36.5;
    const conversionPercent = settings?.conversion_percent || 13;

    const parseCSV = useCallback((content: string) => {
        const lines = content.trim().split('\n');
        if (lines.length < 2) {
            setErrors(['CSV must have a header row and at least one data row']);
            return;
        }

        const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => {
            let val = h.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
            }
            return val.toLowerCase().replace(/\s+/g, '_');
        });
        const requiredHeaders = ['part_number', 'name'];
        const missing = requiredHeaders.filter(h => !headers.includes(h));

        if (missing.length) {
            setErrors([`Missing required columns: ${missing.join(', ')}`]);
            return;
        }

        const parseErrors: string[] = [];
        const parsedItems: ImportItem[] = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Robust CSV parsing to handle commas inside quotes
            const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => {
                let val = v.trim();
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.slice(1, -1);
                }
                return val;
            });
            const row: Record<string, string> = {};
            headers.forEach((h, idx) => {
                row[h] = values[idx] || '';
            });

            // Validate required fields
            if (!row.part_number || !row.name) {
                parseErrors.push(`Row ${i + 1}: Missing part_number or name`);
                continue;
            }

            // Accept any make natively directly from the catalog, defaulting to Genuine if blank to match local DB defaults
            const make: PartMake = (row.make || 'Genuine').trim();

            // Concatenate additional catalog columns into tags
            const extraTags = [row.tags, row.vehicle_engine, row.description]
                .filter(Boolean)
                .join(', ');

            const parsedAed = parseFloat(row.aed_buying_price) || 0;
            const parsedKsh = parseFloat(row.ksh_buying_price) || 0;
            let parsedSelling = parseFloat(row.selling_price) || 0;
            
            if (parsedSelling === 0) {
                let cost = 0;
                if (parsedKsh > 0) {
                    cost = parsedKsh;
                } else if (parsedAed > 0) {
                    cost = parsedAed * aedRate * (1 + conversionPercent / 100);
                }
                if (cost > 0) {
                    // Apply 1.5x multiplier and round to nearest whole number
                    parsedSelling = Math.round(cost * 1.5);
                }
            }

            parsedItems.push({
                part_number: row.part_number,
                name: row.name,
                tags: extraTags,
                make,
                aed_buying_price: parsedAed,
                ksh_buying_price: parsedKsh,
                selling_price: parsedSelling,
                stock_qty: parseInt(row.stock_qty) || 0,
                min_stock: parseInt(row.min_stock) || 5
            });
        }

        // Deduplicate parsed items by normalized part_number and make
        const uniqueItemsMap = new Map<string, ImportItem>();
        parsedItems.forEach(item => {
            const normalizedPartNumber = item.part_number.replace(/[\s\-\/]/g, '').toUpperCase();
            const normalizedMake = (item.make || 'Genuine').trim().toLowerCase();
            const key = `${normalizedPartNumber}_${normalizedMake}`;
            if (uniqueItemsMap.has(key)) {
                const existing = uniqueItemsMap.get(key)!;
                existing.stock_qty = (existing.stock_qty || 0) + (item.stock_qty || 0);
                parseErrors.push(`Merged duplicate row for ${item.part_number} (${item.make}) - added stock.`);
            } else {
                uniqueItemsMap.set(key, item);
            }
        });

        const deduplicatedItems = Array.from(uniqueItemsMap.values());

        if (deduplicatedItems.length === 0) {
            setErrors([...parseErrors, 'No valid items found in CSV']);
            return;
        }

        setItems(deduplicatedItems);
        setErrors(parseErrors);
        setStep('preview');
    }, [aedRate, conversionPercent]);

    const processFile = (file: File) => {
        const fileExt = file.name.split('.').pop()?.toLowerCase();

        if (fileExt === 'csv') {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                parseCSV(content);
            };
            reader.readAsText(file);
        } else if (fileExt === 'xlsx' || fileExt === 'xls') {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const csvStr = XLSX.utils.sheet_to_csv(worksheet);
                    parseCSV(csvStr);
                } catch (e: any) {
                    setErrors(['Failed to read Excel file: ' + (e.message || 'Unknown error')]);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            setErrors(['Unsupported file type. Please upload a .CSV, .XLSX, or .XLS file.']);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            processFile(file);
        }
    };

    const handleImport = async () => {
        setImporting(true);
        setStep('importing');

        try {
            const response = await api.inventory.bulkImport(items, updateExisting);
            setResult(response);
            setStep('done');
        } catch (error: any) {
            setErrors([error.message || 'Import failed']);
            setStep('preview');
        } finally {
            setImporting(false);
        }
    };

    const downloadSample = () => {
        const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'inventory_import_sample.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-5 border-b dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet className="text-brand-500" size={24} />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Bulk Import</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            {/* Drop Zone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 transition-colors"
                            >
                                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-600 dark:text-gray-300 mb-2">
                                    Drag & drop a CSV or Excel file here, or
                                </p>
                                <label className="inline-block px-4 py-2 bg-brand-500 text-white rounded-lg cursor-pointer hover:bg-brand-600">
                                    Browse Files
                                    <input
                                        type="file"
                                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                </label>
                            </div>

                            {/* Sample Download */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                                    <strong>Required columns:</strong> part_number, name<br />
                                    <strong>Optional:</strong> make, aed_buying_price, ksh_buying_price, selling_price, stock_qty, min_stock, tags
                                </p>
                                <button
                                    onClick={downloadSample}
                                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                >
                                    <Download size={16} />
                                    Download sample CSV
                                </button>
                            </div>

                            {/* Options */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="updateExisting"
                                    checked={updateExisting}
                                    onChange={(e) => setUpdateExisting(e.target.checked)}
                                    className="rounded text-brand-500"
                                />
                                <label htmlFor="updateExisting" className="text-sm text-gray-600 dark:text-gray-300">
                                    Update existing items (add stock to items with same part number + make)
                                </label>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            {/* Errors */}
                            {errors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                                        <div>
                                            <p className="font-medium text-red-700 dark:text-red-300">Parsing warnings:</p>
                                            <ul className="text-sm text-red-600 dark:text-red-400 mt-1 list-disc list-inside">
                                                {errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                                                {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Preview Table */}
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Preview ({items.length} items)
                                </p>
                                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                    <table className="min-w-full text-xs">
                                        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-2 py-1 text-left">Part #</th>
                                                <th className="px-2 py-1 text-left">Name</th>
                                                <th className="px-2 py-1 text-left">Make</th>
                                                <th className="px-2 py-1 text-right">AED</th>
                                                <th className="px-2 py-1 text-right">KSH</th>
                                                <th className="px-2 py-1 text-right">Sell</th>
                                                <th className="px-2 py-1 text-right">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.slice(0, 20).map((item, i) => (
                                                <tr key={i} className="border-t dark:border-gray-600">
                                                    <td className="px-2 py-1 font-mono">{item.part_number}</td>
                                                    <td className="px-2 py-1 truncate max-w-32">{item.name}</td>
                                                    <td className={`px-2 py-1 ${item.make === 'Genuine' ? 'text-green-600' : item.make === 'Japan' ? 'text-purple-600' : 'text-gray-500'}`}>
                                                        {item.make}
                                                    </td>
                                                    <td className="px-2 py-1 text-right">{item.aed_buying_price}</td>
                                                    <td className="px-2 py-1 text-right">{item.ksh_buying_price}</td>
                                                    <td className="px-2 py-1 text-right">{item.selling_price?.toLocaleString()}</td>
                                                    <td className="px-2 py-1 text-right">{item.stock_qty}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {items.length > 20 && (
                                        <p className="text-center text-gray-500 py-2">...and {items.length - 20} more items</p>
                                    )}
                                </div>
                            </div>

                            {/* Update Option */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="updateExisting2"
                                    checked={updateExisting}
                                    onChange={(e) => setUpdateExisting(e.target.checked)}
                                    className="rounded text-brand-500"
                                />
                                <label htmlFor="updateExisting2" className="text-sm text-gray-600 dark:text-gray-300">
                                    Update existing items (add stock to duplicates)
                                </label>
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <RefreshCw className="animate-spin text-brand-500 mb-4" size={48} />
                            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                                Importing {items.length} items...
                            </p>
                            <p className="text-sm text-gray-500">This may take a moment</p>
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <CheckCircle className="text-green-500" size={24} />
                                <div>
                                    <p className="font-bold text-green-700 dark:text-green-300">Import Complete!</p>
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                        Created: {result.created} | Updated: {result.updated} | Skipped: {result.skipped}
                                    </p>
                                </div>
                            </div>

                            {result.errors.length > 0 && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                                    <p className="font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                                        {result.errors.length} items had errors:
                                    </p>
                                    <ul className="text-sm text-yellow-600 dark:text-yellow-400 list-disc list-inside">
                                        {result.errors.slice(0, 5).map((e, i) => (
                                            <li key={i}>Row {e.index + 1} ({e.part_number}): {e.error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t dark:border-gray-700 flex gap-3 flex-shrink-0">
                    {step === 'upload' && (
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 text-gray-600 dark:text-gray-300 font-medium bg-gray-100 dark:bg-gray-700 rounded-lg"
                        >
                            Cancel
                        </button>
                    )}

                    {step === 'preview' && (
                        <>
                            <button
                                onClick={() => { setStep('upload'); setItems([]); setErrors([]); }}
                                className="flex-1 py-2.5 text-gray-600 dark:text-gray-300 font-medium bg-gray-100 dark:bg-gray-700 rounded-lg"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="flex-1 py-2.5 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700"
                            >
                                Import {items.length} Items
                            </button>
                        </>
                    )}

                    {step === 'done' && (
                        <button
                            onClick={() => { onComplete(); onClose(); }}
                            className="flex-1 py-2.5 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700"
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkImport;
