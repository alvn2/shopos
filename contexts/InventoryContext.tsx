import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { InventoryItem, Settings } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface InventoryContextType {
  items: InventoryItem[];
  loading: boolean;
  settings: Settings | null;
  refreshInventory: () => Promise<void>;
  updateLocalItem: (uuid: string, updates: Partial<InventoryItem>) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInventory = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [fetchedItems, fetchedSettings] = await Promise.all([
        api.inventory.getAll(),
        api.settings.get()
      ]);
      setItems(fetchedItems);
      setSettings(fetchedSettings);
    } catch (error) {
      console.error('Failed to fetch inventory', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchInventory();
    }
  }, [isAuthenticated, fetchInventory]);

  const updateLocalItem = (uuid: string, updates: Partial<InventoryItem>) => {
    setItems(prev => prev.map(item => item.uuid === uuid ? { ...item, ...updates } : item));
  };

  return (
    <InventoryContext.Provider value={{ items, loading, settings, refreshInventory: fetchInventory, updateLocalItem }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within an InventoryProvider');
  return context;
};