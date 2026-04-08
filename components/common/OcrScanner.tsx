import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, AlertCircle, RefreshCw, Type, Check } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { toast } from 'react-hot-toast';

export interface OcrResult {
    partNumber: string;
    name?: string;
    rawText: string;
}

interface OcrScannerProps {
    onScan: (result: OcrResult) => void;
    label?: string;
}

const OcrScanner: React.FC<OcrScannerProps> = ({ onScan, label = 'Scan Sticker' }) => {
    const [cameraOpen, setCameraOpen] = useState(false);
    const [error, setError] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startCamera = useCallback(async () => {
        setError('');
        setCameraOpen(true);
        setIsAnalyzing(false);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            streamRef.current = stream;
            
            // Allow time for modal to render video element
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
            
        } catch (err: any) {
            console.error('Camera access error:', err);
            setError('Camera permission denied or camera not found.');
            setCameraOpen(false);
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCameraOpen(false);
        setIsAnalyzing(false);
    }, []);

    const captureImage = async () => {
        if (!videoRef.current) return;
        
        setIsAnalyzing(true);
        setError('');
        
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setError('Failed to capture frame');
            setIsAnalyzing(false);
            return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/png');
        
        try {
            toast.loading('Extracting text...', { id: 'ocr-toast' });
            const result = await Tesseract.recognize(imageData, 'eng', {
                logger: info => console.log(info) // Optional: for debugging loading progress
            });
            
            toast.success('Extraction complete', { id: 'ocr-toast' });
            
            const rawText = result.data.text;
            console.log('Extracted Text:\n', rawText);
            
            parseExtractedText(rawText);
            
        } catch (err) {
            console.error('OCR Error:', err);
            setError('Failed to extract text from image');
            toast.error('Extraction failed', { id: 'ocr-toast' });
            setIsAnalyzing(false);
        }
    };

    const parseExtractedText = (text: string) => {
        // Find part numbers: e.g. 04495-60080, 43530-60130, D2177M-01
        // Generic pattern: word boundaries, alphanumeric mixed with dashes
        const partNumberRegex = /\b[A-Z0-9]{4,10}-[A-Z0-9]{2,8}\b/g;
        const matches = text.match(partNumberRegex);
        
        let foundPartNumber = '';
        if (matches && matches.length > 0) {
            // Take the first or most likely match
            foundPartNumber = matches[0];
        }

        // Try to guess a name: usually ALL CAPS strings that are not part numbers
        // e.g., "FREE WHEEL HUB", "SHOE KIT"
        let guessedName = '';
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
        const potentialNames = lines.filter(line => 
            !partNumberRegex.test(line) && 
            /^[A-Z\s]+$/.test(line) && 
            !line.includes('TOYOTA') && 
            !line.includes('CORPORATION')
        );

        if (potentialNames.length > 0) {
            guessedName = potentialNames[0];
        }

        if (!foundPartNumber && !guessedName) {
            toast.error('No valid data found on sticker');
            setIsAnalyzing(false);
            return;
        }

        // Stop camera and pass result
        stopCamera();
        onScan({
            partNumber: foundPartNumber || '',
            name: guessedName || '',
            rawText: text
        });
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    return (
        <div>
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
                                {isAnalyzing ? <RefreshCw size={18} className="animate-spin" /> : <Type size={18} />}
                                <span className="font-bold">{isAnalyzing ? 'Extracting Text...' : 'Scan Part Sticker'}</span>
                            </div>
                            <button onClick={stopCamera} disabled={isAnalyzing} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scanner viewport */}
                        <div className="relative bg-black flex-1 min-h-[300px]">
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                className={`w-full h-full object-cover transition-opacity duration-300 ${isAnalyzing ? 'opacity-50 grayscale' : 'opacity-100'}`}
                            />
                            
                            {/* Overlay Guides */}
                            {!isAnalyzing && (
                                <div className="absolute inset-0 pointer-events-none flex flex-col">
                                    <div className="flex-1 bg-black/40"></div>
                                    <div className="h-[200px] flex">
                                        <div className="flex-1 bg-black/40"></div>
                                        <div className="w-[300px] border-2 border-violet-400/80 rounded-xl relative shadow-[0_0_0_4000px_rgba(0,0,0,0.4)]">
                                            {/* Corner brackets */}
                                            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                                            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                                            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                                            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-full h-0.5 bg-violet-400/50 animate-pulse shadow-[0_0_8px_2px_rgba(167,139,250,0.6)]"></div>
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-black/40"></div>
                                    </div>
                                    <div className="flex-1 bg-black/40 flex items-end justify-center pb-8">
                                        <div className="bg-black/60 px-4 py-2 rounded-full text-white text-sm font-medium backdrop-blur-sm border border-white/10">
                                            Align text within frame
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Analyzing Overlay */}
                            {isAnalyzing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-violet-900/40 backdrop-blur-sm">
                                    <RefreshCw size={40} className="animate-spin text-white mb-4" />
                                    <p className="font-bold text-lg">Reading Text...</p>
                                    <p className="text-sm opacity-80 mt-2">Hold still</p>
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 flex justify-center border-t border-slate-200 dark:border-slate-800">
                            <button
                                onClick={captureImage}
                                disabled={isAnalyzing}
                                className="w-16 h-16 rounded-full border-4 border-violet-500 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 bg-violet-50 dark:bg-violet-900/30 group"
                            >
                                <div className="w-12 h-12 bg-violet-500 rounded-full flex items-center justify-center group-hover:bg-violet-600 transition-colors">
                                    <Camera size={24} className="text-white" />
                                </div>
                            </button>
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

export default OcrScanner;
