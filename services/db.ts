import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'shopos_db';
const DB_VERSION = 1;

interface ShopDB {
  keyval: {
    key: string;
    value: any;
  };
  sync_queue: {
    key: string;
    value: any;
    indexes: { 'by-timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
}

export const idbStorage = {
  async get<T>(key: string): Promise<T | null> {
    const db = await getDB();
    const val = await db.get('keyval', key);
    return val !== undefined ? val : null;
  },
  
  async set(key: string, value: any): Promise<void> {
    const db = await getDB();
    await db.put('keyval', value, key);
  },
  
  async remove(key: string): Promise<void> {
    const db = await getDB();
    await db.delete('keyval', key);
  },
  
  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('keyval');
  }
};

export const idbSyncQueue = {
  async add(action: any): Promise<void> {
    const db = await getDB();
    await db.put('sync_queue', {
      ...action,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    });
  },
  
  async getAll(): Promise<any[]> {
    const db = await getDB();
    return db.getAllFromIndex('sync_queue', 'by-timestamp');
  },
  
  async remove(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('sync_queue', id);
  },
  
  async count(): Promise<number> {
    const db = await getDB();
    return db.count('sync_queue');
  }
};
