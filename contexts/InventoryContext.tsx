import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { InventoryItem, Settings } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface InventoryContextType {
  loading: boolean;
  settings: Settings | null;
  refreshSettings: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const fetchedSettings = await api.settings.get();
      setSettings(fetchedSettings);
    } catch (error) {
      console.error('Failed to fetch settings', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated, fetchSettings]);

  return (
    <InventoryContext.Provider value={{ loading, settings, refreshSettings: fetchSettings }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within an InventoryProvider');
  return context;
};