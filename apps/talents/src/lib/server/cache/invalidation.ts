import { delCache, bumpNamespaceVersion } from './service';
import { createHash } from 'node:crypto';

export const CACHE_NAMESPACES = {
    TALENTS: 'talents',
    LOCATIONS: 'locations',
    TAGS: 'tags',
} as const;

export function hashParams(params: unknown): string {
    return createHash('sha256').update(JSON.stringify(params ?? {})).digest('hex').slice(0, 16);
}

export const cacheKeys = {
    talent: (id: string) => `cache:talent:${id}`,
    talentsList: (version: number, hash: string) => `cache:talent:list:v${version}:${hash}`,
    location: (id: string) => `cache:location:${id}`,
    locationsList: (version: number, hash: string) => `cache:location:list:v${version}:${hash}`,
};

export async function invalidateTalent(talentIds?: string | string[]): Promise<void> {
    const ids = talentIds ? (Array.isArray(talentIds) ? talentIds : [talentIds]) : [];
    const keys = ids.map((id) => cacheKeys.talent(id));

    await Promise.all([
        delCache(keys),
        bumpNamespaceVersion(CACHE_NAMESPACES.TALENTS),
    ]);
}
