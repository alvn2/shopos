import React, { ErrorInfo, ReactNode, useState, useEffect, useCallback } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Error Boundary Component for ShopOS
 * Catches JavaScript errors in child components and displays a fallback UI
 */
const ErrorBoundary: React.FC<Props> = ({ children, fallback, onError }) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

    const handleError = useCallback((error: Error, info: ErrorInfo) => {
        setHasError(true);
        setError(error);
        setErrorInfo(info);
        if (onError) {
            onError(error, info);
        }
    }, [onError]);

    useEffect(() => {
        const errorHandler = (event: ErrorEvent) => {
            handleError(event.error || new Error(event.message), { componentStack: 'Global Error' } as ErrorInfo);
        };
        const promiseRejectionHandler = (event: PromiseRejectionEvent) => {
            handleError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), { componentStack: 'Unhandled Promise Rejection' } as ErrorInfo);
        };

        window.addEventListener('error', errorHandler);
        window.addEventListener('unhandledrejection', promiseRejectionHandler);

        return () => {
            window.removeEventListener('error', errorHandler);
            window.removeEventListener('unhandledrejection', promiseRejectionHandler);
        };
    }, [handleError]);


    const handleReset = () => {
        setHasError(false);
        setError(null);
        setErrorInfo(null);
    };

    if (hasError) {
        if (fallback) {
            return fallback;
        }

        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
                <div className="glass-panel rounded-3xl p-8 max-w-lg w-full text-center border border-slate-200 dark:border-slate-800 shadow-xl">
                    <div className="text-rose-500 text-6xl mb-4">⚠️</div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
                        Something went wrong
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">
                        An unexpected error occurred. Please try refreshing the page.
                    </p>

                    {/* Error details in development */}
                    {import.meta.env.DEV && error && (
                        <div className="bg-rose-50 dark:bg-rose-900/30 rounded-xl p-4 mb-6 text-left overflow-auto max-h-48 border border-rose-100 dark:border-rose-800">
                            <p className="font-mono text-xs font-bold text-rose-700 dark:text-rose-300">
                                {error.toString()}
                            </p>
                            {errorInfo && (
                                <pre className="mt-2 text-xs text-rose-600/80 dark:text-rose-400/80 overflow-x-auto">
                                    {errorInfo.componentStack}
                                </pre>
                            )}
                        </div>
                    )}

                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={handleReset}
                            className="px-6 py-2.5 bg-brand-600 font-bold text-white rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:bg-brand-700 transition-all active:scale-95"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-all active:scale-95"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

/**
 * Higher-order component variant for wrapping functional components
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundaryWrapper(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}

/**
 * Hook-like pattern for handling async errors
 * Usage: wrapAsync(async () => { ... })
 */
export function createAsyncErrorHandler(
    onError: (error: Error) => void
) {
    return function wrapAsync<T>(
        asyncFn: () => Promise<T>
    ): Promise<T | undefined> {
        return asyncFn().catch((error: Error) => {
            onError(error);
            return undefined;
        });
    };
}

export default ErrorBoundary;
