import { getRedisClient, isCircuitOpen, recordFailure, recordSuccess } from './redis';

const incrementScript = `
local value = redis.call("INCR", KEYS[1])
if value == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return value
`;

const getAndDeleteScript = `
local value = redis.call("GET", KEYS[1])
if value ~= false then
  redis.call("DEL", KEYS[1])
end
return value
`;

export function getBetterAuthSecondaryStorage() {
    const client = getRedisClient();
    if (!client) {
        return undefined;
    }

    let supportsGetDel = true;

    return {
        get: async (key: string): Promise<string | null> => {
            const redis = getRedisClient();
            if (!redis || isCircuitOpen()) return null;
            try {
                const res = await redis.get(`ba:${key}`);
                recordSuccess();
                return res;
            } catch (err) {
                recordFailure(err);
                return null;
            }
        },
        set: async (key: string, value: string, ttl?: number): Promise<void> => {
            const redis = getRedisClient();
            if (!redis || isCircuitOpen()) return;
            try {
                if (typeof ttl === 'number' && ttl > 0) {
                    await redis.set(`ba:${key}`, value, 'EX', Math.floor(ttl));
                } else {
                    await redis.set(`ba:${key}`, value);
                }
                recordSuccess();
            } catch (err) {
                recordFailure(err);
            }
        },
        delete: async (key: string): Promise<void> => {
            const redis = getRedisClient();
            if (!redis || isCircuitOpen()) return;
            try {
                await redis.del(`ba:${key}`);
                recordSuccess();
            } catch (err) {
                recordFailure(err);
            }
        },
        getAndDelete: async (key: string): Promise<string | null> => {
            const redis = getRedisClient();
            if (!redis || isCircuitOpen()) return null;
            try {
                let val: string | null = null;
                if (supportsGetDel) {
                    try {
                        val = (await redis.call('GETDEL', `ba:${key}`)) as string | null;
                    } catch (error: any) {
                        if (error?.message?.toLowerCase().includes('unknown command')) {
                            supportsGetDel = false;
                        } else {
                            throw error;
                        }
                    }
                }
                if (!supportsGetDel) {
                    const res = await redis.eval(getAndDeleteScript, 1, `ba:${key}`);
                    val = (res as string) ?? null;
                }
                recordSuccess();
                return val;
            } catch (err) {
                recordFailure(err);
                return null;
            }
        },
        increment: async (key: string, ttl: number): Promise<number> => {
            const redis = getRedisClient();
            if (!redis || isCircuitOpen()) return 0;
            try {
                const safeTtl = typeof ttl === 'number' && ttl > 0 ? Math.max(1, Math.floor(ttl)) : 60;
                let count: number;
                try {
                    const res = await redis.eval(incrementScript, 1, `ba:${key}`, safeTtl);
                    count = Number(res);
                } catch {
                    count = await redis.incr(`ba:${key}`);
                    if (count === 1) {
                        await redis.expire(`ba:${key}`, safeTtl);
                    }
                }
                recordSuccess();
                return count;
            } catch (err) {
                recordFailure(err);
                return 0; // Fail open on Redis error so auth is not blocked
            }
        },
    };
}

