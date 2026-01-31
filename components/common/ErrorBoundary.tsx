import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component for ShopOS
 * Catches JavaScript errors in child components and displays a fallback UI
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Update state with error details
        this.setState({ errorInfo });

        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // In production, you could send this to an error tracking service
        if (import.meta.env.PROD) {
            // Example: Sentry, LogRocket, etc.
            // logErrorToService(error, errorInfo);
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
                    <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full text-center">
                        <div className="text-red-500 text-6xl mb-4">⚠️</div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">
                            Something went wrong
                        </h1>
                        <p className="text-gray-600 mb-6">
                            An unexpected error occurred. Please try refreshing the page.
                        </p>

                        {/* Error details in development */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="bg-red-50 rounded p-4 mb-6 text-left overflow-auto max-h-48">
                                <p className="font-mono text-sm text-red-700">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <pre className="mt-2 text-xs text-red-600 overflow-x-auto">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

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
