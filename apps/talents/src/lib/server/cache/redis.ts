import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

declare global {
    // eslint-disable-next-line no-var
    var __ac_talents_redis_client: Redis | null | undefined;
}

let loggedInit = false;
let failureCount = 0;
let lastFailureTime = 0;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 30000; // 30 seconds

/**
 * Check if the circuit breaker is currently open (bypassing Redis)
 */
export function isCircuitOpen(): boolean {
    if (failureCount < CIRCUIT_THRESHOLD) {
        return false;
    }
    const elapsed = Date.now() - lastFailureTime;
    if (elapsed < CIRCUIT_COOLDOWN_MS) {
        return true;
    }
    // Cooldown elapsed: allow half-open trial
    return false;
}

/**
 * Record a Redis operation failure for the circuit breaker
 */
export function recordFailure(err?: unknown): void {
    failureCount++;
    lastFailureTime = Date.now();
    const message = err instanceof Error ? err.message : String(err);
    if (failureCount === CIRCUIT_THRESHOLD) {
        console.warn(`[Cache] Redis circuit breaker OPENED: Bypassing cache for ${CIRCUIT_COOLDOWN_MS / 1000}s. Error: ${message}`);
    } else if (failureCount < CIRCUIT_THRESHOLD) {
        console.warn(`[Cache] Redis warning (${failureCount}/${CIRCUIT_THRESHOLD}): ${message}`);
    }
}

/**
 * Record a successful Redis operation to reset the circuit breaker
 */
export function recordSuccess(): void {
    if (failureCount > 0) {
        if (failureCount >= CIRCUIT_THRESHOLD) {
            console.log('[Cache] Redis circuit breaker CLOSED: Cache service restored.');
        }
        failureCount = 0;
    }
}

/**
 * Get or initialize the singleton Redis client.
 * Returns null if REDIS_URL is not configured.
 */
export function getRedisClient(): Redis | null {
    if (globalThis.__ac_talents_redis_client !== undefined) {
        return globalThis.__ac_talents_redis_client;
    }

    const redisUrl = env.REDIS_URL;
    if (!redisUrl || redisUrl.trim() === '') {
        if (!loggedInit) {
            console.log('[Cache] REDIS_URL not configured. Read caching is disabled (fallback to DB).');
            loggedInit = true;
        }
        globalThis.__ac_talents_redis_client = null;
        return null;
    }

    try {
        const client = new Redis(redisUrl.trim(), {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            connectTimeout: 3000,
            commandTimeout: 2000,
            enableAutoPipelining: true,
            retryStrategy(times) {
                return Math.min(times * 200, 5000);
            }
        });

        client.on('error', (err) => {
            recordFailure(err);
        });

        client.on('ready', () => {
            recordSuccess();
            console.log('[Cache] Connected to Redis successfully.');
        });

        globalThis.__ac_talents_redis_client = client;
        if (!loggedInit) {
            console.log('[Cache] Redis client initialized with REDIS_URL.');
            loggedInit = true;
        }
        return client;
    } catch (err) {
        console.error('[Cache] Failed to initialize Redis client:', err);
        recordFailure(err);
        globalThis.__ac_talents_redis_client = null;
        return null;
    }
}
