/**
 * ShopOS Hybrid API Service
 * 
 * - Primary: Backend API (connected to Google Sheets)
 * - Fallback: localStorage (offline mode)
 * - Auto-syncs when coming back online
 */

import { InventoryItem, LoginResponse, SaleRecord, Settings, User, UserRole, Session } from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Backend API URL - defaults to localhost in development
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Storage keys for offline cache
const CACHE_KEYS = {
  INVENTORY: 'shopos_cache_inventory',
  SETTINGS: 'shopos_cache_settings',
  USERS: 'shopos_cache_users',
  SALES: 'shopos_cache_sales',
  SESSION: 'shopos_session',
  USER: 'shopos_user',
  SYNC_QUEUE: 'shopos_sync_queue',
  LAST_SYNC: 'shopos_last_sync'
};

// ============================================================================
// SAFE STORAGE (handles iframe/private mode restrictions)
// ============================================================================

class SafeStorage {
  private memoryStorage: Map<string, string>;
  private isSupported: boolean;

  constructor() {
    this.memoryStorage = new Map();
    this.isSupported = false;
    try {
      const testKey = '__shopos_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      this.isSupported = true;
    } catch (e) {
      this.isSupported = false;
    }
  }

  getItem(key: string): string | null {
    if (this.isSupported) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return this.memoryStorage.get(key) || null;
      }
    }
    return this.memoryStorage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    if (this.isSupported) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) { /* ignore quota/security errors */ }
    }
    this.memoryStorage.set(key, value);
  }

  removeItem(key: string): void {
    if (this.isSupported) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) { /* ignore */ }
    }
    this.memoryStorage.delete(key);
  }

  clear(): void {
    if (this.isSupported) {
      try {
        window.localStorage.clear();
      } catch (e) { /* ignore */ }
    }
    this.memoryStorage.clear();
  }
}

export const storage = new SafeStorage();

// ============================================================================
// SYNC QUEUE (for offline actions)
// ============================================================================

interface SyncAction {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  timestamp: number;
}

const syncQueue = {
  add: (action: Omit<SyncAction, 'id' | 'timestamp'>) => {
    const queue = syncQueue.getAll();
    queue.push({
      ...action,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    });
    storage.setItem(CACHE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  },
  getAll: (): SyncAction[] => {
    const data = storage.getItem(CACHE_KEYS.SYNC_QUEUE);
    return data ? JSON.parse(data) : [];
  },
  clear: () => {
    storage.setItem(CACHE_KEYS.SYNC_QUEUE, '[]');
  },
  remove: (id: string) => {
    const queue = syncQueue.getAll().filter(a => a.id !== id);
    storage.setItem(CACHE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  }
};

// ============================================================================
// HTTP CLIENT with offline fallback
// ============================================================================

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {},
  offlineFallback?: () => T
): Promise<T> {
  const sessionId = storage.getItem(CACHE_KEYS.SESSION);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (sessionId) {
    headers['Authorization'] = `Bearer ${sessionId}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Global handler for invalid session
        storage.removeItem(CACHE_KEYS.SESSION);
        storage.removeItem(CACHE_KEYS.USER);
        window.dispatchEvent(new Event('shopos:logout'));
      }
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    // Network error - we're offline
    if (error.message === 'Failed to fetch' || !navigator.onLine) {
      console.warn(`[Offline] ${endpoint} - using cache`);
      if (offlineFallback) {
        return offlineFallback();
      }
    }
    throw error;
  }
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

const cache = {
  inventory: {
    get: (): InventoryItem[] => {
      const data = storage.getItem(CACHE_KEYS.INVENTORY);
      return data ? JSON.parse(data) : [];
    },
    set: (items: InventoryItem[]) => {
      storage.setItem(CACHE_KEYS.INVENTORY, JSON.stringify(items));
    }
  },
  settings: {
    get: (): Settings => {
      const data = storage.getItem(CACHE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : { aed_rate: 36.5, conversion_percent: 13, default_min_stock: 5 };
    },
    set: (settings: Settings) => {
      storage.setItem(CACHE_KEYS.SETTINGS, JSON.stringify(settings));
    }
  },
  users: {
    get: (): User[] => {
      const data = storage.getItem(CACHE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    },
    set: (users: User[]) => {
      storage.setItem(CACHE_KEYS.USERS, JSON.stringify(users));
    }
  },
  sales: {
    get: (): any[] => {
      const data = storage.getItem(CACHE_KEYS.SALES);
      return data ? JSON.parse(data) : [];
    },
    set: (sales: any[]) => {
      storage.setItem(CACHE_KEYS.SALES, JSON.stringify(sales));
    },
    add: (sale: any) => {
      const sales = cache.sales.get();
      sales.push(sale);
      cache.sales.set(sales);
    }
  }
};

// ============================================================================
// API IMPLEMENTATION (Hybrid: Backend + Offline)
// ============================================================================

export const api = {
  // ------ AUTH ------
  auth: {
    login: async (username: string, password: string, device_info: string): Promise<LoginResponse> => {
      const response = await fetchAPI<{ session_id: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, device_info })
      });

      // Store session locally
      storage.setItem(CACHE_KEYS.SESSION, response.session_id);
      storage.setItem(CACHE_KEYS.USER, JSON.stringify(response.user));

      return {
        session_id: response.session_id,
        user: {
          username: response.user.username,
          role: response.user.role as UserRole,
          full_name: response.user.full_name,
          created_at: response.user.created_at || '',
          last_login: response.user.last_login,
          is_active: true
        }
      };
    },

    logout: async (): Promise<void> => {
      try {
        await fetchAPI('/auth/logout', { method: 'POST' });
      } catch (e) {
        // Ignore errors on logout
      }
      storage.removeItem(CACHE_KEYS.SESSION);
      storage.removeItem(CACHE_KEYS.USER);
    },

    verify: async (): Promise<boolean> => {
      try {
        const result = await fetchAPI<{ valid: boolean }>('/auth/verify');
        return result.valid;
      } catch (e: any) {
        // Only fallback if it's a network error (offline)
        // If server responds with 401/403, the session is invalid -> return false
        if (e.message === 'Failed to fetch' || !navigator.onLine) {
          const session = storage.getItem(CACHE_KEYS.SESSION);
          return !!session;
        }
        return false;
      }
    },

    getSessions: async (): Promise<Session[]> => {
      const response = await fetchAPI<{ sessions: any[] }>('/auth/sessions');
      return response.sessions.map(s => ({
        session_id: s.session_id || s.Session_ID,
        username: s.username || s.Username,
        device_info: s.device_info || s.Device_Info,
        ip_address: s.ip_address || s.IP_Address,
        created_at: s.created_at || s.Created_At,
        last_active: s.last_active || s.Last_Active,
        expires_at: s.expires_at || s.Expires_At,
        is_current: s.is_current
      }));
    },

    deleteSession: async (session_id: string): Promise<void> => {
      await fetchAPI(`/auth/session/${session_id}`, { method: 'DELETE' });
    },

    logoutAll: async (): Promise<number> => {
      const response = await fetchAPI<{ count: number }>('/auth/logout-all', { method: 'POST' });
      return response.count;
    },

    getStoredUser: (): User | null => {
      const data = storage.getItem(CACHE_KEYS.USER);
      return data ? JSON.parse(data) : null;
    },

    getStoredSession: (): string | null => {
      return storage.getItem(CACHE_KEYS.SESSION);
    }
  },

  // ------ INVENTORY ------
  inventory: {
    getAll: async (): Promise<InventoryItem[]> => {
      const items = await fetchAPI<InventoryItem[]>(
        '/inventory',
        {},
        () => cache.inventory.get() // Offline fallback
      );

      // Cache for offline use
      if (navigator.onLine) {
        cache.inventory.set(items);
      }

      return items;
    },

    create: async (item: Omit<InventoryItem, 'last_updated' | 'updated_by'>): Promise<{ success: boolean }> => {
      if (!navigator.onLine) {
        // Queue for sync
        syncQueue.add({ endpoint: '/inventory', method: 'POST', body: item });
        // Add to local cache
        const items = cache.inventory.get();
        items.push({ ...item, last_updated: new Date().toISOString(), updated_by: 'offline' } as InventoryItem);
        cache.inventory.set(items);
        return { success: true };
      }

      await fetchAPI('/inventory', {
        method: 'POST',
        body: JSON.stringify(item)
      });

      return { success: true };
    },

    update: async (uuid: string, updates: Partial<InventoryItem>): Promise<{ success: boolean }> => {
      if (!navigator.onLine) {
        syncQueue.add({ endpoint: `/inventory/${uuid}`, method: 'PUT', body: updates });
        // Update local cache
        const items = cache.inventory.get();
        const index = items.findIndex(i => i.uuid === uuid);
        if (index !== -1) {
          items[index] = { ...items[index], ...updates, last_updated: new Date().toISOString() };
          cache.inventory.set(items);
        }
        return { success: true };
      }

      await fetchAPI(`/inventory/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      return { success: true };
    },

    updateBatch: async (updates: Array<{ uuid: string; stock_qty: number }>): Promise<{ success: boolean; count: number }> => {
      if (!navigator.onLine) {
        syncQueue.add({ endpoint: '/inventory/batch', method: 'PUT', body: updates });
        // Update local cache
        const items = cache.inventory.get();
        updates.forEach(update => {
          const index = items.findIndex(i => i.uuid === update.uuid);
          if (index !== -1) {
            items[index].stock_qty = update.stock_qty;
            items[index].last_updated = new Date().toISOString();
          }
        });
        cache.inventory.set(items);
        return { success: true, count: updates.length };
      }

      await fetchAPI('/inventory/batch', {
        method: 'PUT',
        body: JSON.stringify({ updates })
      });

      return { success: true, count: updates.length };
    },

    delete: async (uuid: string): Promise<{ success: boolean }> => {
      if (!navigator.onLine) {
        syncQueue.add({ endpoint: `/inventory/${uuid}`, method: 'DELETE' });
        // Remove from local cache
        const items = cache.inventory.get().filter(i => i.uuid !== uuid);
        cache.inventory.set(items);
        return { success: true };
      }

      await fetchAPI(`/inventory/${uuid}`, { method: 'DELETE' });
      return { success: true };
    }
  },

  // ------ SALES ------
  sales: {
    create: async (data: any): Promise<{ batch_id: string }> => {
      const saleData = {
        ...data,
        date: data.date || new Date().toISOString(),
        batch_id: data.batch_id || `RCPT-${Date.now().toString(36).toUpperCase()}`
      };

      if (!navigator.onLine) {
        syncQueue.add({ endpoint: '/sales', method: 'POST', body: saleData });
        cache.sales.add(saleData);
        // Also update inventory locally
        if (data.items) {
          const items = cache.inventory.get();
          data.items.forEach((saleItem: any) => {
            const item = items.find(i => i.uuid === saleItem.uuid);
            if (item) {
              item.stock_qty = Math.max(0, item.stock_qty - saleItem.qty);
            }
          });
          cache.inventory.set(items);
        }
        return { batch_id: saleData.batch_id };
      }

      const response = await fetchAPI<{ batch_id: string }>('/sales', {
        method: 'POST',
        body: JSON.stringify(saleData)
      });

      return response;
    },

    getAll: async (): Promise<any[]> => {
      const sales = await fetchAPI<any[]>(
        '/sales',
        {},
        () => cache.sales.get()
      );

      if (navigator.onLine) {
        cache.sales.set(sales);
      }

      return sales;
    }
  },

  // ------ SETTINGS ------
  settings: {
    get: async (): Promise<Settings> => {
      const settings = await fetchAPI<Settings>(
        '/settings',
        {},
        () => cache.settings.get()
      );

      if (navigator.onLine) {
        cache.settings.set(settings);
      }

      return settings;
    },

    update: async (settings: Partial<Settings>): Promise<Settings> => {
      if (!navigator.onLine) {
        const current = cache.settings.get();
        const updated = { ...current, ...settings };
        cache.settings.set(updated);
        syncQueue.add({ endpoint: '/settings', method: 'PUT', body: settings });
        return updated;
      }

      const response = await fetchAPI<Settings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });

      cache.settings.set(response);
      return response;
    }
  },

  // ------ USERS ------  
  users: {
    getAll: async (): Promise<User[]> => {
      const users = await fetchAPI<any[]>(
        '/settings/users',
        {},
        () => cache.users.get()
      );

      const mapped = users.map(u => ({
        username: u.username || u.Username,
        password_hash: u.password_hash || u.Password_Hash,
        role: (u.role || u.Role) as UserRole,
        full_name: u.full_name || u.Full_Name,
        created_at: u.created_at || u.Created_At,
        last_login: u.last_login || u.Last_Login,
        is_active: u.is_active === true || u.Is_Active === 'TRUE'
      }));

      if (navigator.onLine) {
        cache.users.set(mapped);
      }

      return mapped;
    },

    create: async (userData: { username: string; password_hash: string; full_name: string; role: UserRole }): Promise<User> => {
      const response = await fetchAPI<any>('/settings/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      return {
        username: response.username || response.Username,
        role: response.role || response.Role,
        full_name: response.full_name || response.Full_Name,
        created_at: response.created_at || response.Created_At || new Date().toISOString(),
        last_login: null,
        is_active: true
      };
    },

    update: async (username: string, updates: Partial<User>): Promise<User> => {
      const response = await fetchAPI<any>(`/settings/users/${username}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      return {
        username: response.username || response.Username,
        role: response.role || response.Role,
        full_name: response.full_name || response.Full_Name,
        created_at: response.created_at || response.Created_At,
        last_login: response.last_login || response.Last_Login,
        is_active: response.is_active === true || response.Is_Active === 'TRUE'
      };
    },

    delete: async (username: string): Promise<void> => {
      await fetchAPI(`/settings/users/${username}`, { method: 'DELETE' });
    }
  },

  // ------ REPORTS ------
  reports: {
    getSalesSummary: async (params?: { from?: string; to?: string; paymentMethod?: string }): Promise<any> => {
      const query = new URLSearchParams();
      if (params?.from) query.set('from', params.from);
      if (params?.to) query.set('to', params.to);
      if (params?.paymentMethod) query.set('payment_method', params.paymentMethod);

      return fetchAPI(`/reports/sales-summary?${query.toString()}`);
    },

    getInventoryHealth: async (): Promise<any> => {
      return fetchAPI('/reports/inventory-health');
    }
  },

  // ------ SYNC ------
  sync: {
    getPendingCount: (): number => syncQueue.getAll().length,

    syncAll: async (): Promise<{ synced: number; failed: number }> => {
      const queue = syncQueue.getAll();
      let synced = 0;
      let failed = 0;

      for (const action of queue) {
        try {
          await fetchAPI(action.endpoint, {
            method: action.method,
            body: action.body ? JSON.stringify(action.body) : undefined
          });
          syncQueue.remove(action.id);
          synced++;
        } catch (e) {
          console.error(`Sync failed for ${action.endpoint}:`, e);
          failed++;
        }
      }

      if (synced > 0) {
        storage.setItem(CACHE_KEYS.LAST_SYNC, new Date().toISOString());
      }

      return { synced, failed };
    },

    getLastSyncTime: (): Date | null => {
      const time = storage.getItem(CACHE_KEYS.LAST_SYNC);
      return time ? new Date(time) : null;
    }
  }
};

// ============================================================================
// AUTO-SYNC on reconnect
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[ShopOS] Back online - syncing...');
    api.sync.syncAll().then(result => {
      console.log(`[ShopOS] Synced ${result.synced} actions, ${result.failed} failed`);
    });
  });
}