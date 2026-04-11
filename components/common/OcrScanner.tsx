import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, AlertCircle, RefreshCw, ScanLine, Check } from 'lucide-react';
import { createWorker, Worker } from 'tesseract.js';
import { toast } from 'react-hot-toast';

export interface OcrResult {
    partNumber: string;
    name?: string;
    rawText?: string;
}

interface OcrScannerProps {
    onScan: (result: OcrResult) => void;
    label?: string;
}

interface PartialResult {
    partNumber: string | null;
    name: string | null;
}

const OcrScanner: React.FC<OcrScannerProps> = ({ onScan, label = 'Scan Sticker' }) => {
    const [cameraOpen, setCameraOpen] = useState(false);
    const [error, setError] = useState('');
    const [statusText, setStatusText] = useState('Initializing Scanner...');
    // Realtime display state for partial finds
    const [livePartNumber, setLivePartNumber] = useState<string | null>(null);
    const [liveName, setLiveName] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const workerRef = useRef<Worker | null>(null);
    
    // Scanning state
    const isScanningRef = useRef(false);
    const foundDataRef = useRef<PartialResult>({ partNumber: null, name: null });
    const scanStartTimeRef = useRef(0);

    const initTesseract = async () => {
        if (workerRef.current) return;
        try {
            setStatusText('Loading OCR engine...');
            const worker = await createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'initializing tesseract' || m.status === 'loading language traineddata') {
                        // ignore loader logs to avoid spam
                    }
                }
            });
            workerRef.current = worker;
            setStatusText('Ready to scan');
            startContinuousScanning();
        } catch (err) {
            console.error('Tesseract init error:', err);
            setError('Failed to initialize OCR engine');
        }
    };

    const startCamera = useCallback(async () => {
        setError('');
        setCameraOpen(true);
        setLivePartNumber(null);
        setLiveName(null);
        setStatusText('Starting camera...');
        foundDataRef.current = { partNumber: null, name: null };
        isScanningRef.current = true;
        scanStartTimeRef.current = Date.now();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            streamRef.current = stream;
            
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.error("Video play error:", e));
                    initTesseract();
                }
            }, 100);
            
        } catch (err: any) {
            console.error('Camera access error:', err);
            setError('Camera permission denied or camera not found.');
            setCameraOpen(false);
            isScanningRef.current = false;
        }
    }, []);

    const stopCamera = useCallback(() => {
        isScanningRef.current = false;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
        setCameraOpen(false);
    }, []);

    const extractDetails = (text: string) => {
        // Find part numbers: e.g. 04495-60080, 43530-60130, D2177M-01
        const partNumberRegex = /\b[A-Z0-9]{4,10}-[A-Z0-9]{2,8}\b/g;
        const matches = text.match(partNumberRegex);
        
        let foundPartNumber = matches ? matches[0] : null;

        let guessedName = null;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length >= 3);
        const potentialNames = lines.filter(line => 
            !partNumberRegex.test(line) && 
            /^[A-Z0-9\s]+$/.test(line) && 
            !line.includes('TOYOTA') && 
            !line.includes('CORPORATION') &&
            !line.includes('GENUINE') &&
            !line.includes('PARTS') &&
            !line.includes('QTY')
        );

        if (potentialNames.length > 0) {
            guessedName = potentialNames[0];
        }

        return { partNumber: foundPartNumber, name: guessedName, rawText: text };
    };

    const runFrameCheck = async () => {
        if (!isScanningRef.current || !videoRef.current || !workerRef.current) return;
        
        const video = videoRef.current;
        if (video.readyState !== video.HAVE_ENOUGH_DATA) {
            setTimeout(runFrameCheck, 200);
            return;
        }

        setStatusText('Analyzing frame...');

        // 1. Barcode Check (if supported natively - iOS 17+, Chrome Android)
        if ('BarcodeDetector' in window) {
            try {
                // @ts-ignore
                const barcodeDetector = new window.BarcodeDetector({ formats: ['code_128', 'code_39', 'ean_13', 'qr_code'] });
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                    let rawValue = barcodes[0].rawValue;
                    if (rawValue.match(/^[A-Z0-9]{4,10}-[A-Z0-9]{2,8}$/i)) {
                        foundDataRef.current.partNumber = rawValue.toUpperCase();
                        setLivePartNumber(rawValue.toUpperCase());
                    } else if (!foundDataRef.current.partNumber) {
                        foundDataRef.current.partNumber = rawValue.toUpperCase();
                        setLivePartNumber(rawValue.toUpperCase());
                    }
                }
            } catch (err) {
                // Not supported or error, ignore and fall back to OCR
                console.log('Barcode skipped', err);
            }
        }

        // 2. OCR Check wrapper
        try {
            const canvas = document.createElement('canvas');
            const scale = Math.min(800 / video.videoWidth, 1);
            canvas.width = video.videoWidth * scale;
            canvas.height = video.videoHeight * scale;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                // Apply slight contrast adjustment for better OCR
                ctx.filter = 'contrast(1.2) grayscale(100%) brightness(1.1)';
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const imageData = canvas.toDataURL('image/jpeg', 0.9);
                
                const result = await workerRef.current.recognize(imageData);
                const text = result.data.text;
                
                const extracted = extractDetails(text);
                
                if (extracted.partNumber && !foundDataRef.current.partNumber) {
                    foundDataRef.current.partNumber = extracted.partNumber;
                    setLivePartNumber(extracted.partNumber);
                }
                if (extracted.name && !foundDataRef.current.name) {
                    foundDataRef.current.name = extracted.name;
                    setLiveName(extracted.name);
                }
            }
        } catch (e) {
            console.error('OCR loop error', e);
        }

        const data = foundDataRef.current;
        const timeScanning = Date.now() - scanStartTimeRef.current;

        // Auto Stop Evaluation
        let shouldStop = false;
        if (data.partNumber && data.name) {
            shouldStop = true; // Perfect match
        } else if (data.partNumber && timeScanning > 4000) {
            shouldStop = true; // Wait 4s to find name. If none, just return part number
        } else if (timeScanning > 15000) {
            shouldStop = true; // 15s absolute timeout to avoid infinite run
        }

        if (shouldStop) {
            if (data.partNumber || data.name) {
                toast.success('Successfully scanned sticker details!');
                onScan({ partNumber: data.partNumber || '', name: data.name || '' });
            } else {
                toast.error('Could not autodetect details. Frame may be blurry.');
            }
            stopCamera();
            return;
        }

        // Continue loop if still scanning
        if (isScanningRef.current) {
            setTimeout(runFrameCheck, 300); // short pause before next expensive cycle
        }
    };

    const startContinuousScanning = () => {
        if (!isScanningRef.current) return;
        runFrameCheck();
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    return (
        <div>
            {/* Inject Animation Context */}
            <style>
                {`
                @keyframes scan-line {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(198px); }
                    100% { transform: translateY(0); }
                }
                .animate-scan-line {
                    animation: scan-line 2.5s linear infinite;
                }
                `}
            </style>

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

            {/* Camera View Modal */}
            {cameraOpen && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-enter">
                    <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-500 to-indigo-500 text-white">
                            <div className="flex items-center gap-2">
                                <ScanLine size={18} className="animate-pulse" />
                                <span className="font-bold">Auto-Scanning Sticker...</span>
                            </div>
                            <button onClick={stopCamera} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scanner viewport */}
                        <div className="relative bg-black flex-1 min-h-[400px]">
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                muted
                                className="w-full h-full object-cover"
                            />
                            
                            {/* Overlay Guides */}
                            <div className="absolute inset-0 pointer-events-none flex flex-col">
                                <div className="flex-1 bg-black/40"></div>
                                <div className="h-[200px] flex">
                                    <div className="flex-1 bg-black/40"></div>
                                    <div className="w-[300px] border-2 border-violet-400/80 rounded-xl relative shadow-[0_0_0_4000px_rgba(0,0,0,0.4)] overflow-hidden">
                                        {/* Scanner Line */}
                                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-violet-400 shadow-[0_0_8px_2px_rgba(167,139,250,0.6)] animate-scan-line"></div>
                                        
                                        {/* Corner brackets */}
                                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                                    </div>
                                    <div className="flex-1 bg-black/40"></div>
                                </div>
                                <div className="flex-1 bg-black/40 flex flex-col items-center justify-end pb-8 p-4">
                                    <div className="bg-black/60 px-4 py-3 rounded-2xl text-white text-sm font-medium backdrop-blur-sm border border-white/10 text-center w-full max-w-[280px]">
                                        <div className="text-violet-300 font-bold mb-1 flex items-center justify-center gap-2">
                                            {statusText.includes('Analyzing') && <RefreshCw className="animate-spin" size={14} />}
                                            {statusText}
                                        </div>
                                        <p className="text-xs text-white/70">Point at sticker. We will auto-read <br/>the part number and name.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Found Details Overlay */}
                        {(livePartNumber || liveName) && (
                            <div className="p-4 bg-violet-50 dark:bg-slate-900 border-t border-violet-100 dark:border-slate-800 animate-slide-up">
                                <div className="flex items-center gap-2 mb-2">
                                    <RefreshCw size={14} className="animate-spin text-violet-600 dark:text-violet-400" />
                                    <span className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider">Partial Scan Found...</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="block text-xs text-slate-500 mb-0.5">Part Number</span>
                                            <span className="font-bold font-mono text-slate-900 dark:text-white">{livePartNumber || '--'}</span>
                                        </div>
                                        {livePartNumber && <Check size={16} className="text-emerald-500" />}
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                        <div className="overflow-hidden min-w-0">
                                            <span className="block text-xs text-slate-500 mb-0.5">Name</span>
                                            <span className="font-bold truncate block text-slate-900 dark:text-white">{liveName || '--'}</span>
                                        </div>
                                        {liveName && <Check size={16} className="text-emerald-500 shrink-0" />}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mt-3 flex items-center gap-2 text-sm text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-3 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800/50">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default OcrScanner;
