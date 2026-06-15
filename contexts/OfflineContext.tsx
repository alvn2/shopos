import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../services/api';

interface OfflineContextType {
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime: Date | null;
    syncNow: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    // Load initial state
    useEffect(() => {
        const loadInitialState = async () => {
            setPendingCount(await api.sync.getPendingCount());
            setLastSyncTime(await api.sync.getLastSyncTime());
        };
        loadInitialState();
    }, []);

    // Listen for online/offline events
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Auto-sync when coming back online
            setTimeout(() => syncNow(), 1000);
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Sync function
    const syncNow = useCallback(async () => {
        if (!navigator.onLine || isSyncing) return;

        const pending = await api.sync.getPendingCount();
        if (pending === 0) {
            setLastSyncTime(new Date());
            return;
        }

        setIsSyncing(true);
        try {
            const result = await api.sync.syncAll();
            console.log(`Synced ${result.synced} actions, ${result.failed} failed`);
            setPendingCount(await api.sync.getPendingCount());
            setLastSyncTime(await api.sync.getLastSyncTime());
        } catch (e) {
            console.error('Sync failed:', e);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    // Periodic sync check
    useEffect(() => {
        const interval = setInterval(async () => {
            const pendingCount = await api.sync.getPendingCount();
            setPendingCount(pendingCount);
            if (navigator.onLine && pendingCount > 0) {
                syncNow();
            }
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [syncNow]);

    return (
        <OfflineContext.Provider value={{
            isOnline,
            isSyncing,
            pendingCount,
            lastSyncTime,
            syncNow
        }}>
            {children}
        </OfflineContext.Provider>
    );
};

export const useOffline = () => {
    const context = useContext(OfflineContext);
    if (!context) {
        throw new Error('useOffline must be used within an OfflineProvider');
    }
    return context;
};

// Sync Status Indicator Component
export const SyncIndicator: React.FC = () => {
    const { isOnline, isSyncing, pendingCount, lastSyncTime, syncNow } = useOffline();

    const getStatusColor = () => {
        if (!isOnline) return 'bg-red-500';
        if (isSyncing) return 'bg-yellow-500 animate-pulse';
        if (pendingCount > 0) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getStatusText = () => {
        if (!isOnline) return 'Offline';
        if (isSyncing) return 'Syncing...';
        if (pendingCount > 0) return `${pendingCount} pending`;
        return 'Synced';
    };

    return (
        <button
            onClick={() => syncNow()}
            disabled={!isOnline || isSyncing}
            className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
            title={lastSyncTime ? `Last sync: ${lastSyncTime.toLocaleTimeString()}` : 'Click to sync'}
        >
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className={`${!isOnline ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                {getStatusText()}
            </span>
        </button>
    );
};
