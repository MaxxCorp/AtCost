export interface OfflineEntry {
    id?: number;
    talentId: string;
    type: 'qr' | 'manual' | 'gps';
    locationId?: string;
    latitude?: number;
    longitude?: number;
    startTime: string;
    endTime?: string;
    synced: boolean;
}

const DB_NAME = 'ac-talents-offline';
const STORE_NAME = 'timesheets';

export async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveOfflineEntry(entry: OfflineEntry) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(entry);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getUnsyncedEntries(): Promise<OfflineEntry[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const all = request.result as OfflineEntry[];
            resolve(all.filter(e => !e.synced));
        };
        request.onerror = () => reject(request.error);
    });
}

export async function markAsSynced(id: number) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}
