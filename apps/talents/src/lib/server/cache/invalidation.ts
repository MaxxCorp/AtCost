import { delCache, bumpNamespaceVersion } from './service';
import { createHash } from 'node:crypto';

export const CACHE_NAMESPACES = {
    TALENTS: 'talents',
    LOCATIONS: 'locations',
    TAGS: 'tags',
    CONTACTS: 'contacts',
} as const;

export function hashParams(params: unknown): string {
    return createHash('sha256').update(JSON.stringify(params ?? {})).digest('hex').slice(0, 16);
}

export const cacheKeys = {
    talent: (id: string) => `cache:talent:${id}`,
    talentsList: (version: number, hash: string) => `cache:talent:list:v${version}:${hash}`,
    location: (id: string) => `cache:location:${id}`,
    locationsList: (version: number, hash: string) => `cache:location:list:v${version}:${hash}`,
    contact: (id: string) => `cache:contact:${id}`,
    contactsList: (version: number, hash: string) => `cache:contact:list:v${version}:${hash}`,
};

export async function invalidateTalent(talentIds?: string | string[]): Promise<void> {
    const ids = talentIds ? (Array.isArray(talentIds) ? talentIds : [talentIds]) : [];
    const keys = ids.map((id) => cacheKeys.talent(id));

    await Promise.all([
        delCache(keys),
        bumpNamespaceVersion(CACHE_NAMESPACES.TALENTS),
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

export async function invalidateContact(contactIds?: string | string[]): Promise<void> {
    const ids = contactIds ? (Array.isArray(contactIds) ? contactIds : [contactIds]) : [];
    const keys = ids.map((id) => cacheKeys.contact(id));

    await Promise.all([
        keys.length > 0 ? delCache(keys) : Promise.resolve(),
        bumpNamespaceVersion(CACHE_NAMESPACES.CONTACTS),
    ]);
}

export async function invalidateAllKioskViews(): Promise<void> {
    // No-op for talents app
}

