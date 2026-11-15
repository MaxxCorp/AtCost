import { getRedisClient, isCircuitOpen, recordFailure, recordSuccess } from './redis';

const memVersionCache = new Map<string, { version: number; expiresAt: number }>();
const MEM_VERSION_TTL_MS = 5000;

export async function getCache<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client || isCircuitOpen()) return null;
    try {
        const raw = await client.get(key);
        if (raw === null) return null;
        recordSuccess();
        return JSON.parse(raw) as T;
    } catch (err) {
        recordFailure(err);
        return null;
    }
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const client = getRedisClient();
    if (!client || isCircuitOpen()) return;
    try {
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        recordSuccess();
    } catch (err) {
        recordFailure(err);
    }
}

export async function delCache(keys: string | string[]): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    if (keyArray.length === 0) return;
    const client = getRedisClient();
    if (!client || isCircuitOpen()) return;
    try {
        await client.del(...keyArray);
        recordSuccess();
    } catch (err) {
        recordFailure(err);
    }
}

export async function cached<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const cachedValue = await getCache<T>(key);
    if (cachedValue !== null) return cachedValue;
    const result = await fetcher();
    if (result !== undefined && result !== null) {
        void setCache(key, result, ttlSeconds);
    }
    return result;
}

export async function getNamespaceVersion(namespace: string): Promise<number> {
    const entry = memVersionCache.get(namespace);
    if (entry && Date.now() <= entry.expiresAt) return entry.version;

    const client = getRedisClient();
    if (!client || isCircuitOpen()) return 1;
    try {
        const versionStr = await client.get(`version:${namespace}`);
        const version = versionStr ? parseInt(versionStr, 10) : 1;
        recordSuccess();
        const validVersion = isNaN(version) ? 1 : version;
        memVersionCache.set(namespace, { version: validVersion, expiresAt: Date.now() + MEM_VERSION_TTL_MS });
        return validVersion;
    } catch (err) {
        recordFailure(err);
        return 1;
    }
}

export async function bumpNamespaceVersion(namespace: string): Promise<number> {
    memVersionCache.delete(namespace);
    const client = getRedisClient();
    if (!client || isCircuitOpen()) return 1;
    try {
        const newVersion = await client.incr(`version:${namespace}`);
        recordSuccess();
        memVersionCache.set(namespace, { version: newVersion, expiresAt: Date.now() + MEM_VERSION_TTL_MS });
        return newVersion;
    } catch (err) {
        recordFailure(err);
        return 1;
    }
}
