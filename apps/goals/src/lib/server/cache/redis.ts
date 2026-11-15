import Redis from 'ioredis';
import { REDIS_URL } from '$app/env/private';

declare global {
    // eslint-disable-next-line no-var
    var __ac_goals_redis_client: Redis | null | undefined;
}

let loggedInit = false;
let failureCount = 0;
let lastFailureTime = 0;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 30000;

export function isCircuitOpen(): boolean {
    if (failureCount < CIRCUIT_THRESHOLD) return false;
    const elapsed = Date.now() - lastFailureTime;
    return elapsed < CIRCUIT_COOLDOWN_MS;
}

export function recordFailure(err?: unknown): void {
    failureCount++;
    lastFailureTime = Date.now();
    const message = err instanceof Error ? err.message : String(err);
    if (failureCount === CIRCUIT_THRESHOLD) {
        console.warn(`[Cache] Redis circuit breaker OPENED: ${message}`);
    }
}

export function recordSuccess(): void {
    if (failureCount > 0) {
        failureCount = 0;
    }
}

export function getRedisClient(): Redis | null {
    if (globalThis.__ac_goals_redis_client !== undefined) {
        return globalThis.__ac_goals_redis_client;
    }

    const redisUrl = REDIS_URL;
    if (!redisUrl || redisUrl.trim() === '') {
        if (!loggedInit) {
            loggedInit = true;
        }
        globalThis.__ac_goals_redis_client = null;
        return null;
    }

    try {
        const client = new Redis(redisUrl.trim(), {
            lazyConnect: true,
            maxRetriesPerRequest: 2,
            connectTimeout: 5000,
            commandTimeout: 5000,
            enableAutoPipelining: true,
            retryStrategy(times) {
                return Math.min(times * 200, 5000);
            }
        });

        client.on('error', (err) => recordFailure(err));
        client.on('ready', () => recordSuccess());

        globalThis.__ac_goals_redis_client = client;
        return client;
    } catch (err) {
        recordFailure(err);
        globalThis.__ac_goals_redis_client = null;
        return null;
    }
}
