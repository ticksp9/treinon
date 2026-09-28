// Offline storage utilities for PWA functionality

const DB_NAME = 'tacticaflow-offline';
const DB_VERSION = 1;

interface PendingOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
}

// Open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for cached data
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
      
      // Store for pending operations (to sync when online)
      if (!db.objectStoreNames.contains('pendingOperations')) {
        const store = db.createObjectStore('pendingOperations', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Cache data for offline use
export async function cacheData(key: string, data: unknown): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key, data, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    db.close();
  } catch (error) {
    console.error('Error caching data:', error);
  }
}

// Get cached data
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('cache', 'readonly');
    const store = tx.objectStore('cache');
    
    const result = await new Promise<{ key: string; data: T } | undefined>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    return result?.data ?? null;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
}

// Add pending operation for later sync
export async function addPendingOperation(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: Record<string, unknown>
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('pendingOperations', 'readwrite');
    const store = tx.objectStore('pendingOperations');
    
    const pendingOp: PendingOperation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      table,
      operation,
      data,
      timestamp: Date.now()
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.add(pendingOp);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    db.close();
  } catch (error) {
    console.error('Error adding pending operation:', error);
  }
}

// Get all pending operations
export async function getPendingOperations(): Promise<PendingOperation[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('pendingOperations', 'readonly');
    const store = tx.objectStore('pendingOperations');
    
    const result = await new Promise<PendingOperation[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    return result;
  } catch (error) {
    console.error('Error getting pending operations:', error);
    return [];
  }
}

// Remove pending operation after successful sync
export async function removePendingOperation(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('pendingOperations', 'readwrite');
    const store = tx.objectStore('pendingOperations');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    db.close();
  } catch (error) {
    console.error('Error removing pending operation:', error);
  }
}

// Clear all pending operations
export async function clearPendingOperations(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('pendingOperations', 'readwrite');
    const store = tx.objectStore('pendingOperations');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    db.close();
  } catch (error) {
    console.error('Error clearing pending operations:', error);
  }
}

// Check if there are pending operations
export async function hasPendingOperations(): Promise<boolean> {
  const ops = await getPendingOperations();
  return ops.length > 0;
}
