import { getRedisClient, isCircuitOpen, recordFailure, recordSuccess } from './redis';

export function getBetterAuthSecondaryStorage() {
    const client = getRedisClient();
    if (!client) return undefined;

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
        }
    };
}
