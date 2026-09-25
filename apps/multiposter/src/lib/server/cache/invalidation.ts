import { delCache, bumpNamespaceVersion } from './service';
import { createHash } from 'node:crypto';

export const CACHE_NAMESPACES = {
    EVENTS: 'events',
    CONTACTS: 'contacts',
    ANNOUNCEMENTS: 'announcements',
    LOCATIONS: 'locations',
    KIOSKS: 'kiosks',
    CMS: 'cms',
} as const;

export function hashParams(params: unknown): string {
    return createHash('sha256').update(JSON.stringify(params ?? {})).digest('hex').slice(0, 16);
}

/**
 * Cache key generators
 */
export const cacheKeys = {
    kioskView: (kioskId: string, version: number) => `cache:kiosk:view:${kioskId}:v${version}`,
    kioskDisplay: (kioskId: string) => `cache:kiosk:display:${kioskId}`,
    publicEvent: (eventId: string) => `cache:event:public:${eventId}`,
    eventsList: (access: string, version: number, hash: string) => `cache:event:list:${access}:v${version}:${hash}`,
    eventQr: (eventId: string) => `cache:event:qr:${eventId}`,
    eventIcs: (eventId: string) => `cache:event:ics:${eventId}`,
    publicContact: (contactId: string) => `cache:contact:public:${contactId}`,
    contactsList: (version: number, hash: string) => `cache:contact:list:v${version}:${hash}`,
    contactQr: (contactId: string) => `cache:contact:qr:${contactId}`,
    contactVcf: (contactId: string) => `cache:contact:vcf:public:${contactId}`,
    publicAnnouncement: (announcementId: string) => `cache:announcement:public:${announcementId}`,
    announcementsList: (version: number, hash: string) => `cache:announcement:list:v${version}:${hash}`,
    location: (locationId: string) => `cache:location:${locationId}`,
    locationsList: (version: number, hash: string) => `cache:location:list:v${version}:${hash}`,
    cmsContent: (pageSlug: string, slotName: string, language: string, branch: string, version: number) =>
        `cache:cms:${pageSlug}:${slotName}:${language}:${branch}:v${version}`,
};

/**
 * Invalidate all cached data for one or more events, and invalidate kiosk views and event lists.
 */
export async function invalidateEvent(eventIds: string | string[]): Promise<void> {
    const ids = Array.isArray(eventIds) ? eventIds : [eventIds];
    if (ids.length === 0) return;

    const keys: string[] = [];
    for (const id of ids) {
        keys.push(
            cacheKeys.publicEvent(id),
            cacheKeys.eventQr(id),
            cacheKeys.eventIcs(id)
        );
    }

    await Promise.all([
        delCache(keys),
        bumpNamespaceVersion(CACHE_NAMESPACES.EVENTS),
        bumpNamespaceVersion(CACHE_NAMESPACES.KIOSKS)
    ]);
}

/**
 * Invalidate all cached data for one or more contacts, and bump kiosk and contacts versions.
 */
export async function invalidateContact(contactIds: string | string[]): Promise<void> {
    const ids = Array.isArray(contactIds) ? contactIds : [contactIds];
    if (ids.length === 0) return;

    const keys: string[] = [];
    for (const id of ids) {
        keys.push(
            cacheKeys.publicContact(id),
            cacheKeys.contactQr(id),
            cacheKeys.contactVcf(id)
        );
    }

    await Promise.all([
        delCache(keys),
        bumpNamespaceVersion(CACHE_NAMESPACES.CONTACTS),
        bumpNamespaceVersion(CACHE_NAMESPACES.KIOSKS)
    ]);
}

/**
 * Invalidate cached data for one or more announcements, and bump kiosk and announcements versions.
 */
export async function invalidateAnnouncement(announcementIds: string | string[]): Promise<void> {
    const ids = Array.isArray(announcementIds) ? announcementIds : [announcementIds];
    if (ids.length === 0) return;

    const keys = ids.map((id) => cacheKeys.publicAnnouncement(id));

    await Promise.all([
        delCache(keys),
        bumpNamespaceVersion(CACHE_NAMESPACES.ANNOUNCEMENTS),
        bumpNamespaceVersion(CACHE_NAMESPACES.KIOSKS)
    ]);
}

/**
 * Invalidate one or more locations, and bump location and kiosk versions.
 */
export async function invalidateLocation(locationIds?: string | string[]): Promise<void> {
    const ids = locationIds ? (Array.isArray(locationIds) ? locationIds : [locationIds]) : [];
    const keys = ids.map((id) => cacheKeys.location(id));

    await Promise.all([
        delCache(keys),
        bumpNamespaceVersion(CACHE_NAMESPACES.LOCATIONS),
        bumpNamespaceVersion(CACHE_NAMESPACES.KIOSKS),
    ]);
}

/**
 * Invalidate a specific kiosk or all kiosks.
 */
export async function invalidateKiosk(kioskId?: string): Promise<void> {
    const promises: Promise<unknown>[] = [bumpNamespaceVersion(CACHE_NAMESPACES.KIOSKS)];
    if (kioskId) {
        promises.push(delCache(cacheKeys.kioskDisplay(kioskId)));
    }
    await Promise.all(promises);
}

/**
 * Invalidate all kiosk views and locations (e.g. after location change or mass sync).
 */
export async function invalidateAllKioskViews(): Promise<void> {
    await Promise.all([
        bumpNamespaceVersion(CACHE_NAMESPACES.LOCATIONS),
        bumpNamespaceVersion(CACHE_NAMESPACES.KIOSKS),
    ]);
}

/**
 * Invalidate CMS published content cache.
 */
export async function invalidateCms(): Promise<void> {
    await bumpNamespaceVersion(CACHE_NAMESPACES.CMS);
}

