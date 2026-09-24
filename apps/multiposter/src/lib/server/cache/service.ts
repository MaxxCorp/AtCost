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
    const client = getRedisClient();
    if (!client || isCircuitOpen()) return;

    const keyList = Array.isArray(keys) ? keys : [keys];
    if (keyList.length === 0) return;

    try {
        await client.del(...keyList);
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
 * @param ttlSeconds TTL in seconds for successful non-null results
 * @param fetcher Async function to execute if cache misses
 * @param negativeTtlSeconds Optional TTL for null results (default 30s) to prevent DB stampede from bots
 */
export async function cached<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    negativeTtlSeconds = 30
): Promise<T> {
    const cachedData = await getCache<T>(key);
    if (cachedData !== null) {
        return cachedData;
    }

    const freshData = await fetcher();

    // Cache the result
    if (freshData !== undefined) {
        const effectiveTtl = freshData === null ? negativeTtlSeconds : ttlSeconds;
        // Non-blocking write to cache so response is fast
        setCache(key, freshData, effectiveTtl).catch(() => {});
    }

    return freshData;
}

/**
 * Cached getter for binary buffers (e.g. QR code PNG images).
 * Stores base64 string in Redis, returns Uint8Array.
 */
export async function cachedBinary(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<Uint8Array | Buffer>
): Promise<Uint8Array> {
    const client = getRedisClient();
    if (!client || isCircuitOpen()) {
        const raw = await fetcher();
        return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    }

    try {
        const base64 = await client.get(key);
        if (base64 !== null) {
            recordSuccess();
            return new Uint8Array(Buffer.from(base64, 'base64'));
        }
    } catch (err) {
        recordFailure(err);
    }

    const raw = await fetcher();
    const uint8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw);

    try {
        const base64 = Buffer.from(uint8).toString('base64');
        client.set(key, base64, 'EX', ttlSeconds).catch(() => {});
    } catch {
        // Ignore cache write errors
    }

    return uint8;
}

/**
 * Get current version integer for a namespace (e.g. 'kiosks').
 * Defaults to 1 if not set or Redis is unavailable.
 */
export async function getNamespaceVersion(namespace: string): Promise<number> {
    const cachedVer = getMemVersion(namespace);
    if (cachedVer !== null) return cachedVer;

    const client = getRedisClient();
    if (!client || isCircuitOpen()) return 1;

    try {
        const key = `cache:version:${namespace}`;
        const raw = await client.get(key);
        const ver = raw ? parseInt(raw, 10) : 1;
        const finalVer = isNaN(ver) || ver < 1 ? 1 : ver;
        setMemVersion(namespace, finalVer);
        recordSuccess();
        return finalVer;
    } catch (err) {
        recordFailure(err);
        return 1;
    }
}

/**
 * Increment the namespace version integer.
 * This instantly invalidates all versioned cache keys in this namespace in O(1) time.
 */
export async function bumpNamespaceVersion(namespace: string): Promise<number> {
    clearMemVersion(namespace);
    const client = getRedisClient();
    if (!client || isCircuitOpen()) return 1;

    try {
        const key = `cache:version:${namespace}`;
        const nextVer = await client.incr(key);
        setMemVersion(namespace, nextVer);
        recordSuccess();
        return nextVer;
    } catch (err) {
        recordFailure(err);
        return 1;
    }
}
