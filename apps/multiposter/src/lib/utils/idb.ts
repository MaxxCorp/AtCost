export async function openDB(dbName = 'ac-multiposter-prefs', storeName = 'preferences'): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
        throw new Error('IndexedDB is not available on the server');
    }
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function setPreference<T>(key: string, value: T, dbName = 'ac-multiposter-prefs', storeName = 'preferences'): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB(dbName, storeName);
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn(`Failed to set preference ${key} in IndexedDB:`, e);
    }
}

export async function getPreference<T>(key: string, defaultValue: T, dbName = 'ac-multiposter-prefs', storeName = 'preferences'): Promise<T> {
    if (typeof window === 'undefined') return defaultValue;
    try {
        const db = await openDB(dbName, storeName);
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => {
                if (request.result !== undefined) {
                    resolve(request.result as T);
                } else {
                    resolve(defaultValue);
                }
            };
            request.onerror = () => resolve(defaultValue);
        });
    } catch (e) {
        console.warn(`Failed to get preference ${key} from IndexedDB:`, e);
        return defaultValue;
    }
}
