import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Download } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface BarcodeLabelProps {
    partNumber: string;
    name: string;
    sellingPrice: number;
    onClose: () => void;
}

/**
 * Generates a printable barcode label for an inventory item.
 * Uses JsBarcode to render a Code128 barcode.
 */
const BarcodeLabel: React.FC<BarcodeLabelProps> = ({ partNumber, name, sellingPrice, onClose }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [generated, setGenerated] = useState(false);

    useEffect(() => {
        if (svgRef.current && partNumber) {
            try {
                JsBarcode(svgRef.current, partNumber, {
                    format: 'CODE128',
                    width: 2,
                    height: 60,
                    displayValue: true,
                    fontSize: 14,
                    fontOptions: 'bold',
                    margin: 10,
                    background: '#ffffff',
                    lineColor: '#000000'
                });
                setGenerated(true);
            } catch (e) {
                console.error('Barcode generation failed:', e);
            }
        }
    }, [partNumber]);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=400,height=300');
        if (!printWindow) return;

        const labelHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Barcode - ${partNumber}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
                    .label { text-align: center; padding: 10px; border: 1px dashed #ccc; width: 300px; }
                    .name { font-size: 11px; font-weight: bold; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    .price { font-size: 16px; font-weight: 900; margin-top: 4px; }
                    svg { max-width: 100%; }
                    @media print {
                        .label { border: none; }
                        body { margin: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="label">
                    <div class="name">${name}</div>
                    ${svgRef.current?.outerHTML || ''}
                    <div class="price">KES ${sellingPrice.toLocaleString()}</div>
                </div>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;

        printWindow.document.write(labelHTML);
        printWindow.document.close();
    };

    const handleDownload = () => {
        if (!svgRef.current) return;
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `barcode_${partNumber}.svg`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-enter">
            <div className="card-modern w-full max-w-sm shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-900 dark:text-white">Barcode Label</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                {/* Label Preview */}
                <div className="p-6 bg-white flex flex-col items-center">
                    <div className="text-xs font-bold text-slate-600 mb-2 truncate w-full text-center">{name}</div>
                    <svg ref={svgRef}></svg>
                    {generated && (
                        <div className="text-lg font-black text-slate-900 mt-1">KES {sellingPrice.toLocaleString()}</div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                    <button onClick={handleDownload} className="flex-1 btn-secondary !py-2.5 flex items-center justify-center gap-2">
                        <Download size={16} />
                        Save SVG
                    </button>
                    <button onClick={handlePrint} className="flex-1 btn-primary !py-2.5 flex items-center justify-center gap-2">
                        <Printer size={16} />
                        Print
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BarcodeLabel;
