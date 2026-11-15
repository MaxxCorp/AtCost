import { delCache, bumpNamespaceVersion } from './service';
import { createHash } from 'node:crypto';

export const CACHE_NAMESPACES = {
    GOALS: 'goals',
    LOCATIONS: 'locations',
    TAGS: 'tags',
} as const;

export function hashParams(params: unknown): string {
    return createHash('sha256').update(JSON.stringify(params ?? {})).digest('hex').slice(0, 16);
}

export const cacheKeys = {
    goal: (id: string) => `cache:goal:${id}`,
    goalsList: (version: number, hash: string) => `cache:goal:list:v${version}:${hash}`,
    location: (id: string) => `cache:location:${id}`,
    locationsList: (version: number, hash: string) => `cache:location:list:v${version}:${hash}`,
};

export async function invalidateGoal(goalIds?: string | string[]): Promise<void> {
    const ids = goalIds ? (Array.isArray(goalIds) ? goalIds : [goalIds]) : [];
    const keys = ids.map((id) => cacheKeys.goal(id));
    await Promise.all([
        keys.length > 0 ? delCache(keys) : Promise.resolve(),
        bumpNamespaceVersion(CACHE_NAMESPACES.GOALS),
    ]);
}

export async function invalidateLocation(locationIds?: string | string[]): Promise<void> {
    const ids = locationIds ? (Array.isArray(locationIds) ? locationIds : [locationIds]) : [];
    const keys = ids.map((id) => cacheKeys.location(id));
    await Promise.all([
        keys.length > 0 ? delCache(keys) : Promise.resolve(),
        bumpNamespaceVersion(CACHE_NAMESPACES.LOCATIONS),
    ]);
}

export async function invalidateAllKioskViews(): Promise<void> {
    // No-op for goals app
}
