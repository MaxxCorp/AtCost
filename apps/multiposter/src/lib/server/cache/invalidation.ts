import { delCache, bumpNamespaceVersion } from './service';

export const CACHE_NAMESPACES = {
    KIOSKS: 'kiosks',
    CMS: 'cms',
} as const;

/**
 * Cache key generators
 */
export const cacheKeys = {
    kioskView: (kioskId: string, version: number) => `cache:kiosk:view:${kioskId}:v${version}`,
    kioskDisplay: (kioskId: string) => `cache:kiosk:display:${kioskId}`,
    publicEvent: (eventId: string) => `cache:event:public:${eventId}`,
    eventQr: (eventId: string) => `cache:event:qr:${eventId}`,
    eventIcs: (eventId: string) => `cache:event:ics:${eventId}`,
    publicContact: (contactId: string) => `cache:contact:public:${contactId}`,
    contactQr: (contactId: string) => `cache:contact:qr:${contactId}`,
    contactVcf: (contactId: string) => `cache:contact:vcf:public:${contactId}`,
    publicAnnouncement: (announcementId: string) => `cache:announcement:public:${announcementId}`,
    cmsContent: (pageSlug: string, slotName: string, language: string, branch: string, version: number) =>
        `cache:cms:${pageSlug}:${slotName}:${language}:${branch}:v${version}`,
};

/**
 * Invalidate all cached data for one or more events, and invalidate kiosk views that display events.
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
        bumpNamespaceVersion(CACHE_NAMESPACES.KIOSKS)
    ]);
}

/**
 * Invalidate all cached data for one or more contacts, and bump kiosk version.
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
        bumpNamespaceVersion(CACHE_NAMESPACES.KIOSKS)
    ]);
}

/**
 * Invalidate cached data for one or more announcements, and bump kiosk version.
 */
export async function invalidateAnnouncement(announcementIds: string | string[]): Promise<void> {
    const ids = Array.isArray(announcementIds) ? announcementIds : [announcementIds];
    if (ids.length === 0) return;

    const keys = ids.map((id) => cacheKeys.publicAnnouncement(id));

    await Promise.all([
        delCache(keys),
        bumpNamespaceVersion(CACHE_NAMESPACES.KIOSKS)
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
 * Invalidate all kiosk views (e.g. after location change or mass sync).
 */
export async function invalidateAllKioskViews(): Promise<void> {
    await bumpNamespaceVersion(CACHE_NAMESPACES.KIOSKS);
}

/**
 * Invalidate CMS published content cache.
 */
export async function invalidateCms(): Promise<void> {
    await bumpNamespaceVersion(CACHE_NAMESPACES.CMS);
}
