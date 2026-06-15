import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Zap, AlertCircle, Type, Image as ImageIcon, Loader2 } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface BarcodeScannerProps {
    onScan: (code: string) => void;
    label?: string;
}

type ScanMode = 'barcode' | 'ocr';

/**
 * Smart Scanner
 * Supports both standard Barcodes/QR Codes (html5-qrcode) and Printed Text OCR (Tesseract.js)
 */
const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, label = 'Scan Barcode' }) => {
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanMode, setScanMode] = useState<ScanMode>('barcode');
    const [error, setError] = useState('');
    const [isProcessingOcr, setIsProcessingOcr] = useState(false);
    
    // Barcode refs
    const scannerRef = useRef<any>(null);
    
    // OCR refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    
    // Hardware scanner detection
    const keystrokeBuffer = useRef('');
    const keystrokeTimer = useRef<ReturnType<typeof setTimeout>>();

    const stopCamera = useCallback(() => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {});
            scannerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCameraOpen(false);
        setIsProcessingOcr(false);
    }, []);

    // ===== BARCODE MODE =====
    const startBarcodeScanner = async () => {
        try {
            const { Html5Qrcode } = await import('html5-qrcode');

            await new Promise(resolve => setTimeout(resolve, 100));

            if (!document.getElementById('barcode-reader')) {
                throw new Error('Scanner container not ready');
            }

            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) {
                throw new Error('No camera found on this device.');
            }

            let targetCameraId = cameras[0].id;
            for (const camera of cameras) {
                if (camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('rear') || camera.label.toLowerCase().includes('environment')) {
                    targetCameraId = camera.id;
                    break;
                }
            }

            const html5QrCode = new Html5Qrcode('barcode-reader');
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                targetCameraId,
                {
                    fps: 10,
                    qrbox: { width: 280, height: 120 },
                    aspectRatio: 1.0,
                },
                (decodedText: string) => {
                    html5QrCode.stop().catch(() => {});
                    scannerRef.current = null;
                    setCameraOpen(false);
                    onScan(decodedText.trim().toUpperCase());
                },
                () => {} // Ignore scan failures
            );
        } catch (err: any) {
            handleCameraError(err);
        }
    };

    // ===== OCR TEXT MODE =====
    const startOcrScanner = async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // wait for video element to mount
            if (!videoRef.current) throw new Error('Video container not ready');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            videoRef.current.play();
        } catch (err: any) {
            handleCameraError(err);
        }
    };

    const handleCameraError = (err: any) => {
        console.error('Camera error:', err);
        if (err?.message?.includes('NotAllowedError') || err?.message?.includes('Permission')) {
            setError('Camera permission denied. Please allow camera access in your browser settings.');
        } else if (err?.message?.includes('NotFoundError') || err?.name === 'NotFoundError') {
            setError('No camera found on this device.');
        } else {
            setError(err.message || 'Failed to start camera.');
        }
        setCameraOpen(false);
    };

    const startCamera = async () => {
        setError('');
        setCameraOpen(true);
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError('Camera access requires HTTPS or localhost. If you are on a local network, use a tunnel like ngrok.');
            setCameraOpen(false);
            return;
        }

        if (scanMode === 'barcode') {
            await startBarcodeScanner();
        } else {
            await startOcrScanner();
        }
    };

    const captureAndReadText = async () => {
        if (!videoRef.current) return;
        
        setIsProcessingOcr(true);
        setError('');

        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) throw new Error('Failed to get canvas context');
            
            // Draw current video frame to canvas
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imageDataUrl = canvas.toDataURL('image/png');

            // Recognize text using Tesseract
            const result = await Tesseract.recognize(imageDataUrl, 'eng', {
                logger: m => console.log(m)
            });

            const text = result.data.text.trim();
            if (!text) {
                setError('No readable text found. Please try again with better lighting.');
                setIsProcessingOcr(false);
                return;
            }

            stopCamera();
            onScan(text);
        } catch (err: any) {
            console.error('OCR Error:', err);
            setError('Failed to read text. Please try again.');
            setIsProcessingOcr(false);
        }
    };

    // Hardware barcode scanner detection via keyboard
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
                return;
            }

            if (e.key === 'Enter' && keystrokeBuffer.current.length >= 3) {
                onScan(keystrokeBuffer.current.trim().toUpperCase());
                keystrokeBuffer.current = '';
                return;
            }

            if (e.key.length === 1) {
                keystrokeBuffer.current += e.key;
                if (keystrokeTimer.current) clearTimeout(keystrokeTimer.current);
                keystrokeTimer.current = setTimeout(() => {
                    keystrokeBuffer.current = '';
                }, 100);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (keystrokeTimer.current) clearTimeout(keystrokeTimer.current);
        };
    }, [onScan]);

    // Cleanup on unmount
    useEffect(() => stopCamera, [stopCamera]);

    return (
        <div>
            {/* Start Button & Mode Toggle */}
            {!cameraOpen && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setScanMode('barcode')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${scanMode === 'barcode' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <Zap size={14} /> Barcode
                        </button>
                        <button
                            onClick={() => setScanMode('ocr')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${scanMode === 'ocr' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <Type size={14} /> Text (OCR)
                        </button>
                    </div>

                    <button
                        onClick={startCamera}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all duration-300 ${scanMode === 'barcode' ? 'bg-gradient-to-r from-violet-500 to-indigo-500 shadow-violet-500/25 hover:shadow-violet-500/40' : 'bg-gradient-to-r from-teal-500 to-emerald-500 shadow-teal-500/25 hover:shadow-teal-500/40'}`}
                        type="button"
                    >
                        <Camera size={18} />
                        {scanMode === 'barcode' ? label : 'Read Text from Item'}
                    </button>
                </div>
            )}

            {/* Camera View Modal */}
            {cameraOpen && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-enter">
                    <div className="w-full max-w-sm bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                        {/* Header */}
                        <div className={`flex items-center justify-between px-4 py-3 text-white ${scanMode === 'barcode' ? 'bg-gradient-to-r from-violet-600 to-indigo-600' : 'bg-gradient-to-r from-teal-600 to-emerald-600'}`}>
                            <div className="flex items-center gap-2">
                                {scanMode === 'barcode' ? <Zap size={18} className="animate-pulse" /> : <Type size={18} />}
                                <span className="text-sm font-bold">
                                    {scanMode === 'barcode' ? 'Scanning Barcode...' : 'Reading Text...'}
                                </span>
                            </div>
                            <button onClick={stopCamera} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50" disabled={isProcessingOcr}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Scanner Viewport */}
                        <div className="relative bg-black w-full" style={{ minHeight: '300px' }}>
                            {scanMode === 'barcode' ? (
                                <>
                                    <div id="barcode-reader" className="w-full"></div>
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div className="w-[280px] h-[120px] border-2 border-violet-400/60 rounded-lg relative">
                                            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-violet-400 animate-pulse opacity-60"></div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <video ref={videoRef} className="w-full h-full object-cover" style={{ minHeight: '300px' }} playsInline muted></video>
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                                        <div className="w-full h-full border-2 border-dashed border-teal-400/60 rounded-xl relative flex items-center justify-center">
                                            {isProcessingOcr && (
                                                <div className="bg-black/80 rounded-xl p-4 flex flex-col items-center gap-3 animate-fade-in backdrop-blur-md">
                                                    <Loader2 className="animate-spin text-teal-400" size={32} />
                                                    <span className="text-white text-xs font-bold tracking-wider uppercase">Processing AI...</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* OCR Capture Action */}
                        {scanMode === 'ocr' && (
                            <div className="p-4 bg-slate-900 border-t border-white/5 flex justify-center">
                                <button
                                    onClick={captureAndReadText}
                                    disabled={isProcessingOcr}
                                    className="flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20 w-full justify-center"
                                >
                                    {isProcessingOcr ? 'Analyzing Image...' : (
                                        <>
                                            <ImageIcon size={18} />
                                            Capture & Read Text
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Instructions */}
                        {!isProcessingOcr && (
                            <div className="px-4 py-3 text-center text-xs text-slate-400 font-medium bg-slate-950">
                                {scanMode === 'barcode' ? 'Point your camera at a barcode' : 'Align text in the box and tap Capture'}
                            </div>
                        )}
                    </div>

                    {/* Error overlay inside modal if needed */}
                    {error && (
                        <div className="absolute bottom-6 left-4 right-4 flex items-start gap-2 text-sm text-rose-200 bg-rose-950/90 border border-rose-800/50 p-4 rounded-xl backdrop-blur-md">
                            <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />
                            <div className="flex-1">{error}</div>
                            <button onClick={() => setError('')} className="p-1 hover:bg-white/10 rounded-lg shrink-0">
                                <X size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* In-page Error (before opening modal) */}
            {error && !cameraOpen && (
                <div className="mt-2 flex items-center gap-2 text-sm text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-800/50">
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default BarcodeScanner;
