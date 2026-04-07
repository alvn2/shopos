import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Zap, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
    onScan: (code: string) => void;
    label?: string;
}

/**
 * Phone Camera Barcode Scanner
 * Uses html5-qrcode library for camera-based barcode scanning.
 * Also supports hardware USB/Bluetooth barcode scanners via keyboard input.
 */
const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, label = 'Scan Barcode' }) => {
    const [cameraOpen, setCameraOpen] = useState(false);
    const [error, setError] = useState('');
    const scannerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // Hardware scanner detection state
    const keystrokeBuffer = useRef('');
    const keystrokeTimer = useRef<ReturnType<typeof setTimeout>>();

    // Camera scanning
    const startCamera = useCallback(async () => {
        setError('');
        setCameraOpen(true);

        // Dynamically import html5-qrcode to avoid SSR issues
        try {
            const { Html5Qrcode } = await import('html5-qrcode');

            // Small delay to let the DOM render the container
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!document.getElementById('barcode-reader')) {
                setError('Scanner container not ready');
                setCameraOpen(false);
                return;
            }

            const html5QrCode = new Html5Qrcode('barcode-reader');
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: 'environment' }, // Rear camera
                {
                    fps: 10,
                    qrbox: { width: 280, height: 120 },
                    aspectRatio: 1.0,
                },
                (decodedText: string) => {
                    // Success — stop scanner and pass result
                    html5QrCode.stop().catch(() => {});
                    scannerRef.current = null;
                    setCameraOpen(false);
                    onScan(decodedText.trim().toUpperCase());
                },
                () => {} // Ignore scan failures (no barcode detected yet)
            );
        } catch (err: any) {
            console.error('Camera scanner error:', err);
            if (err?.message?.includes('NotAllowedError') || err?.message?.includes('Permission')) {
                setError('Camera permission denied. Please allow camera access in your browser settings.');
            } else if (err?.message?.includes('NotFoundError')) {
                setError('No camera found on this device.');
            } else {
                setError(err.message || 'Failed to start camera scanner.');
            }
            setCameraOpen(false);
        }
    }, [onScan]);

    const stopCamera = useCallback(() => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {});
            scannerRef.current = null;
        }
        setCameraOpen(false);
    }, []);

    // Hardware barcode scanner detection via keyboard
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input field
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
                return;
            }

            if (e.key === 'Enter' && keystrokeBuffer.current.length >= 3) {
                // We have a barcode!
                onScan(keystrokeBuffer.current.trim().toUpperCase());
                keystrokeBuffer.current = '';
                return;
            }

            if (e.key.length === 1) {
                keystrokeBuffer.current += e.key;
                // Reset timer  
                if (keystrokeTimer.current) clearTimeout(keystrokeTimer.current);
                keystrokeTimer.current = setTimeout(() => {
                    keystrokeBuffer.current = '';
                }, 100); // Hardware scanners type within 100ms
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (keystrokeTimer.current) clearTimeout(keystrokeTimer.current);
        };
    }, [onScan]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
            }
        };
    }, []);

    return (
        <div ref={containerRef}>
            {/* Scan Button */}
            {!cameraOpen && (
                <button
                    onClick={startCamera}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                    type="button"
                >
                    <Camera size={18} />
                    {label}
                </button>
            )}

            {/* Camera View */}
            {cameraOpen && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-enter">
                    <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 text-white">
                            <div className="flex items-center gap-2">
                                <Zap size={18} className="animate-pulse" />
                                <span className="text-sm font-bold">Scanning...</span>
                            </div>
                            <button onClick={stopCamera} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Scanner viewport */}
                        <div className="relative bg-black">
                            <div id="barcode-reader" className="w-full" style={{ minHeight: '300px' }}></div>
                            {/* Scan line overlay */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-[280px] h-[120px] border-2 border-violet-400/60 rounded-lg relative">
                                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-violet-400 animate-pulse opacity-60"></div>
                                </div>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Point your camera at a barcode
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mt-2 flex items-center gap-2 text-sm text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-800/50">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}
        </div>
    );
};

export default BarcodeScanner;
