import { getRedisClient, isCircuitOpen, recordFailure, recordSuccess } from './redis';

// Short in-memory cache for namespace versions to avoid redundant Redis roundtrips
const memVersionCache = new Map<string, { version: number; expiresAt: number }>();
const MEM_VERSION_TTL_MS = 5000; // 5 seconds

function getMemVersion(namespace: string): number | null {
    const entry = memVersionCache.get(namespace);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        memVersionCache.delete(namespace);
        return null;
    }
    return entry.version;
}

function setMemVersion(namespace: string, version: number): void {
    memVersionCache.set(namespace, {
        version,
        expiresAt: Date.now() + MEM_VERSION_TTL_MS
    });
}

function clearMemVersion(namespace: string): void {
    memVersionCache.delete(namespace);
}

/**
 * Get an item from Redis cache.
 * Returns null if not found, Redis is unavailable, or on error.
 */
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

/**
 * Set an item in Redis cache with TTL in seconds.
 * Fails silently to prevent cache errors from affecting business logic.
 */
export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const client = getRedisClient();
    if (!client || isCircuitOpen()) return;

    try {
        const serialized = JSON.stringify(value);
        await client.set(key, serialized, 'EX', ttlSeconds);
        recordSuccess();
    } catch (err) {
        recordFailure(err);
    }
}

/**
 * Delete one or more keys from Redis.
 */
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

/**
 * Wraps any async fetcher function with Redis read-through caching.
 * If Redis is unavailable or fails, gracefully falls back to direct execution of fetcher.
 *
 * @param key The Redis cache key
 * @param ttlSeconds Time-to-live in seconds
 * @param fetcher Async function to fetch data if cache misses
 */
export async function cached<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const cachedValue = await getCache<T>(key);
    if (cachedValue !== null) {
        return cachedValue;
    }

    const result = await fetcher();

    if (result !== undefined && result !== null) {
        void setCache(key, result, ttlSeconds);
    }

    return result;
}

/**
 * Get current version of a cache namespace.
 * Defaults to 1 if not set or Redis is unavailable.
 */
export async function getNamespaceVersion(namespace: string): Promise<number> {
    const mem = getMemVersion(namespace);
    if (mem !== null) return mem;

    const client = getRedisClient();
    if (!client || isCircuitOpen()) return 1;

    try {
        const versionStr = await client.get(`version:${namespace}`);
        const version = versionStr ? parseInt(versionStr, 10) : 1;
        recordSuccess();
        const validVersion = isNaN(version) ? 1 : version;
        setMemVersion(namespace, validVersion);
        return validVersion;
    } catch (err) {
        recordFailure(err);
        return 1;
    }
}

/**
 * Increment the version of a cache namespace.
 * Atomically invalidates all cache keys relying on this namespace version.
 */
export async function bumpNamespaceVersion(namespace: string): Promise<number> {
    clearMemVersion(namespace);

    const client = getRedisClient();
    if (!client || isCircuitOpen()) return 1;

    try {
        const newVersion = await client.incr(`version:${namespace}`);
        recordSuccess();
        setMemVersion(namespace, newVersion);
        return newVersion;
    } catch (err) {
        recordFailure(err);
        return 1;
    }
}
