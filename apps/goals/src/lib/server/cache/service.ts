import { getRequestEvent } from '$app/server';
import { getRedisClient, isCircuitOpen, recordFailure, recordSuccess } from './redis';

const requestVersionCache = new WeakMap<Request, Map<string, Promise<number>>>();

function getCurrentRequest(): Request | null {
    try {
        return getRequestEvent()?.request ?? null;
    } catch {
        return null;
    }
}

function getRequestNamespaceMap(req: Request): Map<string, Promise<number>> {
    let map = requestVersionCache.get(req);
    if (!map) {
        map = new Map();
        requestVersionCache.set(req, map);
    }
    return map;
}

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
    const req = getCurrentRequest();
    if (req) {
        const reqMap = getRequestNamespaceMap(req);
        const existing = reqMap.get(namespace);
        if (existing) return existing;
    }

    const fetchVersion = async (): Promise<number> => {
        const client = getRedisClient();
        if (!client || isCircuitOpen()) return 1;
        try {
            const versionStr = await client.get(`version:${namespace}`);
            const version = versionStr ? parseInt(versionStr, 10) : 1;
            recordSuccess();
            return isNaN(version) || version < 1 ? 1 : version;
        } catch (err) {
            recordFailure(err);
            return 1;
        }
    };

    const promise = fetchVersion();
    if (req) {
        getRequestNamespaceMap(req).set(namespace, promise);
    }
    return promise;
}

export async function bumpNamespaceVersion(namespace: string): Promise<number> {
    const req = getCurrentRequest();
    const client = getRedisClient();
    if (!client || isCircuitOpen()) {
        if (req) getRequestNamespaceMap(req).delete(namespace);
        return 1;
    }
    try {
        const newVersion = await client.incr(`version:${namespace}`);
        if (req) {
            getRequestNamespaceMap(req).set(namespace, Promise.resolve(newVersion));
        }
        recordSuccess();
        return newVersion;
    } catch (err) {
        if (req) getRequestNamespaceMap(req).delete(namespace);
        recordFailure(err);
        return 1;
    }
}
