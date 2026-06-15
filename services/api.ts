/**
 * ShopOS Hybrid API Service
 * 
 * - Primary: Backend API
 * - Fallback: IndexedDB (offline mode)
 * - Auto-syncs when coming back online
 */

import { InventoryItem, LoginResponse, SaleRecord, Settings, User, UserRole, Session } from '../types';
import { idbStorage, idbSyncQueue } from './db';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryStatusCodes: [408, 429, 500, 502, 503, 504]
};

const CACHE_KEYS = {
  INVENTORY: 'shopos_cache_inventory',
  SETTINGS: 'shopos_cache_settings',
  USERS: 'shopos_cache_users',
  SALES: 'shopos_cache_sales',
  SESSION: 'shopos_session',
  USER: 'shopos_user',
  LAST_SYNC: 'shopos_last_sync'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelay
  );
  return delay * (0.8 + Math.random() * 0.4);
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {},
  offlineFallback?: () => Promise<T>
): Promise<T> {
  const sessionId = await idbStorage.get<string>(CACHE_KEYS.SESSION);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (sessionId) {
    headers['Authorization'] = `Bearer ${sessionId}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          await idbStorage.remove(CACHE_KEYS.SESSION);
          await idbStorage.remove(CACHE_KEYS.USER);
          window.dispatchEvent(new Event('shopos:logout'));
          const error = await response.json().catch(() => ({ error: 'Session expired' }));
          throw new Error(error.error || 'Session expired');
        }

        if (RETRY_CONFIG.retryStatusCodes.includes(response.status) && attempt < RETRY_CONFIG.maxRetries - 1) {
          const delay = getBackoffDelay(attempt);
          console.warn(`[API] Request failed with ${response.status}, retrying in ${Math.round(delay)}ms`);
          await sleep(delay);
          continue;
        }

        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        let errorMessage = error.error || `HTTP ${response.status}`;
        if (error.details && Array.isArray(error.details)) {
          errorMessage += `: ${error.details.join(', ')}`;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error: any) {
      lastError = error;

      if (error.message === 'Failed to fetch' || !navigator.onLine) {
        console.warn(`[Offline] ${endpoint} - using cache`);
        if (offlineFallback) {
          return offlineFallback();
        }
        throw error;
      }

      if (error.message?.includes('Session expired') || error.message?.includes('401')) {
        throw error;
      }

      if (attempt < RETRY_CONFIG.maxRetries - 1) {
        const delay = getBackoffDelay(attempt);
        console.warn(`[API] Request failed, retrying in ${Math.round(delay)}ms:`, error.message);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || new Error(`Request to ${endpoint} failed after ${RETRY_CONFIG.maxRetries} attempts`);
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

const cache = {
  inventory: {
    get: async (): Promise<InventoryItem[]> => {
      const data = await idbStorage.get<InventoryItem[]>(CACHE_KEYS.INVENTORY);
      return data || [];
    },
    set: async (items: InventoryItem[]) => {
      await idbStorage.set(CACHE_KEYS.INVENTORY, items);
    }
  },
  settings: {
    get: async (): Promise<Settings> => {
      const data = await idbStorage.get<Settings>(CACHE_KEYS.SETTINGS);
      return data || { aed_rate: 36.5, conversion_percent: 13, default_min_stock: 5 };
    },
    set: async (settings: Settings) => {
      await idbStorage.set(CACHE_KEYS.SETTINGS, settings);
    }
  },
  users: {
    get: async (): Promise<User[]> => {
      const data = await idbStorage.get<User[]>(CACHE_KEYS.USERS);
      return data || [];
    },
    set: async (users: User[]) => {
      await idbStorage.set(CACHE_KEYS.USERS, users);
    }
  },
  sales: {
    get: async (): Promise<any[]> => {
      const data = await idbStorage.get<any[]>(CACHE_KEYS.SALES);
      return data || [];
    },
    set: async (sales: any[]) => {
      await idbStorage.set(CACHE_KEYS.SALES, sales);
    },
    add: async (sale: any) => {
      const sales = await cache.sales.get();
      sales.push(sale);
      await cache.sales.set(sales);
    }
  }
};

// ============================================================================
// API IMPLEMENTATION
// ============================================================================

export const api = {
  // ------ AUTH ------
  auth: {
    login: async (shop_id: string, username: string, password: string, device_info: string): Promise<LoginResponse> => {
      const response = await fetchAPI<{ session_id: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ shop_id, username, password, device_info })
      });

      await idbStorage.set(CACHE_KEYS.SESSION, response.session_id);
      await idbStorage.set(CACHE_KEYS.USER, response.user);

      return {
        session_id: response.session_id,
        user: {
          username: response.user.username,
          shop_id: response.user.shop_id,
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
      } catch (e) { }
      await idbStorage.remove(CACHE_KEYS.SESSION);
      await idbStorage.remove(CACHE_KEYS.USER);
    },

    verify: async (): Promise<boolean> => {
      try {
        const result = await fetchAPI<{ valid: boolean }>('/auth/verify');
        return result.valid;
      } catch (e: any) {
        if (e.message === 'Failed to fetch' || !navigator.onLine) {
          const session = await idbStorage.get(CACHE_KEYS.SESSION);
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

    getStoredUser: async (): Promise<User | null> => {
      return await idbStorage.get<User>(CACHE_KEYS.USER);
    },

    getStoredSession: async (): Promise<string | null> => {
      return await idbStorage.get<string>(CACHE_KEYS.SESSION);
    }
  },

  // ------ INVENTORY ------
  inventory: {
    getAll: async (): Promise<InventoryItem[]> => {
      const items = await fetchAPI<InventoryItem[]>(
        '/inventory',
        {},
        () => cache.inventory.get()
      );

      if (navigator.onLine) {
        await cache.inventory.set(items);
      }
      return items;
    },

    create: async (item: Omit<InventoryItem, 'last_updated' | 'updated_by'>): Promise<{ success: boolean }> => {
      if (!navigator.onLine) {
        await idbSyncQueue.add({ endpoint: '/inventory', method: 'POST', body: item });
        const items = await cache.inventory.get();
        items.push({ ...item, last_updated: new Date().toISOString(), updated_by: 'offline' } as InventoryItem);
        await cache.inventory.set(items);
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
        await idbSyncQueue.add({ endpoint: `/inventory/${uuid}`, method: 'PUT', body: updates });
        const items = await cache.inventory.get();
        const index = items.findIndex(i => i.uuid === uuid);
        if (index !== -1) {
          items[index] = { ...items[index], ...updates, last_updated: new Date().toISOString() };
          await cache.inventory.set(items);
        }
        return { success: true };
      }

      await fetchAPI(`/inventory/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      return { success: true };
    },

    updateBatch: async (updates: Array<{ uuid: string } & Partial<InventoryItem>>): Promise<{ success: boolean; count: number }> => {
      if (!navigator.onLine) {
        await idbSyncQueue.add({ endpoint: '/inventory/batch', method: 'PUT', body: { updates } });
        const items = await cache.inventory.get();
        updates.forEach(update => {
          const index = items.findIndex(i => i.uuid === update.uuid);
          if (index !== -1) {
            items[index] = { ...items[index], ...update, last_updated: new Date().toISOString() };
          }
        });
        await cache.inventory.set(items);
        return { success: true, count: updates.length };
      }

      await fetchAPI('/inventory/batch', {
        method: 'PUT',
        body: JSON.stringify({ updates })
      });
      return { success: true, count: updates.length };
    },

    bulkImport: async (items: Array<Partial<InventoryItem>>, updateExisting = true): Promise<{
      success: boolean;
      created: number;
      updated: number;
      skipped: number;
      errors: Array<{ index: number; part_number: string; error: string }>;
    }> => {
      return fetchAPI('/inventory/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ items, update_existing: updateExisting })
      });
    },

    delete: async (uuid: string): Promise<{ success: boolean }> => {
      if (!navigator.onLine) {
        await idbSyncQueue.add({ endpoint: `/inventory/${uuid}`, method: 'DELETE' });
        const items = (await cache.inventory.get()).filter(i => i.uuid !== uuid);
        await cache.inventory.set(items);
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
        await idbSyncQueue.add({ endpoint: '/sales', method: 'POST', body: saleData });
        await cache.sales.add(saleData);
        if (data.items) {
          const items = await cache.inventory.get();
          data.items.forEach((saleItem: any) => {
            const item = items.find(i => i.uuid === saleItem.uuid);
            if (item) {
              item.stock_qty = Math.max(0, item.stock_qty - saleItem.qty);
            }
          });
          await cache.inventory.set(items);
        }
        return { batch_id: saleData.batch_id };
      }

      return fetchAPI<{ batch_id: string }>('/sales', {
        method: 'POST',
        body: JSON.stringify(saleData)
      });
    },

    getAll: async (): Promise<any[]> => {
      const sales = await fetchAPI<any[]>(
        '/sales',
        {},
        () => cache.sales.get()
      );

      if (navigator.onLine) {
        await cache.sales.set(sales);
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
        await cache.settings.set(settings);
      }
      return settings;
    },

    update: async (settings: Partial<Settings>): Promise<Settings> => {
      if (!navigator.onLine) {
        const current = await cache.settings.get();
        const updated = { ...current, ...settings };
        await cache.settings.set(updated);
        await idbSyncQueue.add({ endpoint: '/settings', method: 'PUT', body: settings });
        return updated;
      }

      const response = await fetchAPI<Settings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });

      await cache.settings.set(response);
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
        await cache.users.set(mapped);
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

    getInventoryHealth: async (params?: { minStock?: number; maxStock?: number }): Promise<any> => {
      const query = new URLSearchParams();
      if (params?.minStock !== undefined) query.set('minStock', params.minStock.toString());
      if (params?.maxStock !== undefined) query.set('maxStock', params.maxStock.toString());
      const queryString = query.toString() ? `?${query.toString()}` : '';
      return fetchAPI(`/reports/inventory-health${queryString}`);
    }
  },

  // ------ CUSTOMERS ------
  customers: {
    getAll: async (): Promise<any[]> => fetchAPI('/customers'),
    create: async (data: { name: string; phone: string; email?: string; notes?: string }): Promise<any> => {
      return fetchAPI('/customers', { method: 'POST', body: JSON.stringify(data) });
    },
    update: async (id: string, updates: any): Promise<any> => {
      return fetchAPI(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    },
    getLedger: async (id: string): Promise<any[]> => fetchAPI(`/customers/${id}/ledger`),
    recordPayment: async (id: string, data: { amount: number; reference?: string }): Promise<any> => {
      return fetchAPI(`/customers/${id}/payment`, { method: 'POST', body: JSON.stringify(data) });
    },
    search: async (query: string): Promise<any[]> => fetchAPI(`/customers?search=${encodeURIComponent(query)}`)
  },

  // ------ SYNC ------
  sync: {
    getPendingCount: async (): Promise<number> => await idbSyncQueue.count(),

    syncAll: async (): Promise<{ synced: number; failed: number }> => {
      const queue = await idbSyncQueue.getAll();
      let synced = 0;
      let failed = 0;

      for (const action of queue) {
        try {
          await fetchAPI(action.endpoint, {
            method: action.method,
            body: action.body ? JSON.stringify(action.body) : undefined
          });
          await idbSyncQueue.remove(action.id);
          synced++;
        } catch (e) {
          console.error(`Sync failed for ${action.endpoint}:`, e);
          failed++;
        }
      }

      if (synced > 0) {
        await idbStorage.set(CACHE_KEYS.LAST_SYNC, new Date().toISOString());
      }

      return { synced, failed };
    },

    getLastSyncTime: async (): Promise<Date | null> => {
      const time = await idbStorage.get<string>(CACHE_KEYS.LAST_SYNC);
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