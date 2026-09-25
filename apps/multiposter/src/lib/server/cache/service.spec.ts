import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cached, cachedBinary, getNamespaceVersion, bumpNamespaceVersion } from './service';
import * as redisModule from './redis';

describe('Cache Service', () => {
    let mockStore: Map<string, string>;
    let mockClient: any;

    beforeEach(() => {
        mockStore = new Map();
        mockClient = {
            get: vi.fn(async (key: string) => mockStore.get(key) ?? null),
            set: vi.fn(async (key: string, val: string) => {
                mockStore.set(key, val);
                return 'OK';
            }),
            del: vi.fn(async (...keys: string[]) => {
                for (const k of keys) mockStore.delete(k);
                return keys.length;
            }),
            incr: vi.fn(async (key: string) => {
                const current = parseInt(mockStore.get(key) || '1', 10);
                const next = current + 1;
                mockStore.set(key, String(next));
                return next;
            }),
        };

        vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(mockClient);
        vi.spyOn(redisModule, 'isCircuitOpen').mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns cached data on cache hit without executing fetcher', async () => {
        mockStore.set('test:key', JSON.stringify({ hello: 'world' }));
        const fetcher = vi.fn(async () => ({ hello: 'from-db' }));

        const result = await cached('test:key', 60, fetcher);

        expect(result).toEqual({ hello: 'world' });
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('executes fetcher and caches result on cache miss', async () => {
        const fetcher = vi.fn(async () => ({ id: '123', name: 'Test' }));

        const result = await cached('test:miss', 60, fetcher);

        expect(result).toEqual({ id: '123', name: 'Test' });
        expect(fetcher).toHaveBeenCalledOnce();
        expect(mockClient.set).toHaveBeenCalledWith('test:miss', JSON.stringify({ id: '123', name: 'Test' }), 'EX', 60);
    });

    it('gracefully falls back to fetcher if Redis is not configured (returns null client)', async () => {
        vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(null);
        const fetcher = vi.fn(async () => 'direct-db-value');

        const result = await cached('test:no-redis', 60, fetcher);

        expect(result).toBe('direct-db-value');
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it('gracefully falls back to fetcher if Redis get throws an error', async () => {
        mockClient.get.mockRejectedValueOnce(new Error('Connection timed out'));
        const fetcher = vi.fn(async () => 'resilient-db-value');

        const result = await cached('test:error', 60, fetcher);

        expect(result).toBe('resilient-db-value');
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it('bypasses Redis when circuit breaker is open', async () => {
        vi.spyOn(redisModule, 'isCircuitOpen').mockReturnValue(true);
        const fetcher = vi.fn(async () => 'circuit-open-db-value');

        const result = await cached('test:circuit', 60, fetcher);

        expect(result).toBe('circuit-open-db-value');
        expect(mockClient.get).not.toHaveBeenCalled();
    });

    it('caches and retrieves binary data (e.g. QR codes)', async () => {
        const testBytes = new Uint8Array([1, 2, 3, 4, 5]);
        const fetcher = vi.fn(async () => testBytes);

        // First call: cache miss, runs fetcher
        const res1 = await cachedBinary('test:qr', 60, fetcher);
        expect(res1).toEqual(testBytes);
        expect(fetcher).toHaveBeenCalledOnce();

        // Second call: cache hit, decodes base64 from store
        const res2 = await cachedBinary('test:qr', 60, fetcher);
        expect(res2).toEqual(testBytes);
        expect(fetcher).toHaveBeenCalledOnce(); // Still 1 call!
    });

    it('increments namespace version atomically and reflects in subsequent calls', async () => {
        const v1 = await getNamespaceVersion('test-ns');
        expect(v1).toBe(1);

        const v2 = await bumpNamespaceVersion('test-ns');
        expect(v2).toBe(2);

        const v3 = await getNamespaceVersion('test-ns');
        expect(v3).toBe(2);
    });
});

describe('Better Auth Secondary Storage', () => {
    let mockStore: Map<string, string>;
    let mockClient: any;

    beforeEach(async () => {
        const { getBetterAuthSecondaryStorage } = await import('./auth-storage');
        mockStore = new Map();
        mockClient = {
            get: vi.fn(async (key: string) => mockStore.get(key) ?? null),
            set: vi.fn(async (key: string, val: string) => {
                mockStore.set(key, val);
                return 'OK';
            }),
            del: vi.fn(async (...keys: string[]) => {
                for (const k of keys) mockStore.delete(k);
                return keys.length;
            }),
            getdel: vi.fn(async (key: string) => {
                const val = mockStore.get(key) ?? null;
                mockStore.delete(key);
                return val;
            }),
        };

        vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(mockClient);
        vi.spyOn(redisModule, 'isCircuitOpen').mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sets, gets, and deletes session data with ba: prefix', async () => {
        const { getBetterAuthSecondaryStorage } = await import('./auth-storage');
        const storage = getBetterAuthSecondaryStorage();
        expect(storage).toBeDefined();

        await storage!.set('session-token-123', JSON.stringify({ userId: 'u1' }), 3600);
        expect(mockClient.set).toHaveBeenCalledWith('ba:session-token-123', JSON.stringify({ userId: 'u1' }), 'EX', 3600);

        const fetched = await storage!.get('session-token-123');
        expect(fetched).toEqual(JSON.stringify({ userId: 'u1' }));

        await storage!.delete('session-token-123');
        expect(mockClient.del).toHaveBeenCalledWith('ba:session-token-123');
    });

    it('implements getAndDelete using Redis getdel', async () => {
        const { getBetterAuthSecondaryStorage } = await import('./auth-storage');
        const storage = getBetterAuthSecondaryStorage();
        expect(storage).toBeDefined();

        mockStore.set('ba:verify-token', 'data-val');
        const val = await storage!.getAndDelete!('verify-token');
        expect(val).toBe('data-val');
        expect(mockStore.has('ba:verify-token')).toBe(false);
    });

    it('returns undefined if Redis is not configured', async () => {
        vi.spyOn(redisModule, 'getRedisClient').mockReturnValue(null);
        const { getBetterAuthSecondaryStorage } = await import('./auth-storage');
        const storage = getBetterAuthSecondaryStorage();
        expect(storage).toBeUndefined();
    });
});

