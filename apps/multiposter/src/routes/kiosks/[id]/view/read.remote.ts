import { query } from '$app/server';
import { listEvents } from '../../../events/list.remote';
import { listAnnouncements } from '../../../announcements/list.remote';
import { db } from '@ac/db';
import { kiosk, kioskLocation, location } from '@ac/db';
import { eq } from '@ac/db';
import * as v from 'valibot';

import { resolveLocationContactSync } from '$lib/server/contact-resolution';

export const readKioskView = query(v.string(), async (kioskId) => {
    const kioskData = await db.query.kiosk.findFirst({
        where: eq(kiosk.id, kioskId),
    });

    if (!kioskData) return null;

    const kioskLocationsData = await db.query.kioskLocation.findMany({
        where: eq(kioskLocation.kioskId, kioskId),
        with: {
            location: {
                with: {
                    locationContacts: {
                        with: {
                            contact: {
                                with: {
                                    emails: true,
                                    phones: true,
                                    tags: {
                                        with: {
                                            tag: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const locations = kioskLocationsData.map(kl => {
        const loc = kl.location;
        const resolvedContact = resolveLocationContactSync(loc, {
            filterWorkOnly: true,
            fallbackToFirst: true
        });

        return {
            id: loc.id,
            name: loc.name,
            street: loc.street,
            houseNumber: loc.houseNumber,
            addressSuffix: loc.addressSuffix,
            zip: loc.zip,
            city: loc.city,
            state: loc.state,
            country: loc.country,
            roomId: loc.roomId,
            capacity: loc.capacity,
            inclusivitySupport: loc.inclusivitySupport,
            what3words: loc.what3words,
            latitude: loc.latitude,
            longitude: loc.longitude,
            heroImage: loc.heroImage,
            description: loc.description,
            contact: resolvedContact
        };
    });

    const kioskWithLocations = {
        ...kioskData,
        locations: locations
    };

    const locationIds = locations.map(l => l.id);
    
    const now = new Date();
    let startDate: string | undefined;
    let endDate: string | undefined;
    
    if (kioskData.rangeMode === 'fixed') {
        if (kioskData.startDate) startDate = kioskData.startDate.toISOString();
        if (kioskData.endDate) endDate = kioskData.endDate.toISOString();
    } else {
        let lookAheadSeconds = kioskData.lookAhead;
        if ((kioskData.uiMode === 'flat_list' || kioskData.uiMode === 'folded_flyer') && lookAheadSeconds <= 604800) {
            lookAheadSeconds = 2592000; // 30 days default for monthly listings
        }
        startDate = new Date(now.getTime() - (kioskData.lookPast * 1000)).toISOString();
        endDate = new Date(now.getTime() + (lookAheadSeconds * 1000)).toISOString();
    }

    // If kioskData.excludeSeries is false, ensure 'Series' tag is not excluded
    let effectiveExcludedTags = kioskData.excludedTags || [];
    if (!kioskData.excludeSeries) {
        effectiveExcludedTags = effectiveExcludedTags.filter(t => t !== 'Series');
    }

    const eventsResult = await listEvents({
        limit: 250,
        locationId: locationIds.length > 0 ? locationIds : undefined,
        startDate,
        endDate,
        excludeTentative: kioskData.excludeTentative,
        excludeCancelled: kioskData.excludeCancelled,
        excludeNonPublic: kioskData.excludeNonPublic,
        excludeSeries: kioskData.excludeSeries,
        includeSeriesEntries: !kioskData.excludeSeries,
        excludedEventIds: kioskData.excludedEventIds || [],
        includedEventIds: kioskData.includedEventIds || [],
        excludedTags: effectiveExcludedTags,
        includedTags: kioskData.includedTags || [],
        sortField: 'startDateTime',
        sortOrder: 'asc'
    });

    const announcementsResult = await listAnnouncements({
        limit: 100,
        locationId: locationIds.length > 0 ? locationIds : undefined,
        excludedAnnouncementIds: kioskData.excludedAnnouncementIds || [],
        includedAnnouncementIds: kioskData.includedAnnouncementIds || [],
        excludedTags: effectiveExcludedTags,
        includedTags: kioskData.includedTags || [],
    });

    const locationIdSet = new Set(locationIds);
    const validEvents = locationIds.length > 0
        ? eventsResult.data.filter((e: any) => {
            const eLocIds = new Set<string>();
            for (const l of (e.locations || [])) {
                const id = l?.id || l?.locationId || l?.location?.id;
                if (id) eLocIds.add(id);
            }
            for (const r of (e.resources || [])) {
                const id = r?.locationId || r?.resource?.locationId || r?.location?.id;
                if (id) eLocIds.add(id);
            }
            for (const id of (e.locationIds || [])) {
                if (id) eLocIds.add(id);
            }
            return Array.from(eLocIds).some(id => locationIdSet.has(id));
        })
        : eventsResult.data;

    const validAnnouncements = locationIds.length > 0
        ? announcementsResult.data.filter((a: any) => {
            const aLocIds = new Set<string>();
            for (const l of (a.locations || [])) {
                const id = l?.id || l?.locationId || l?.location?.id;
                if (id) aLocIds.add(id);
            }
            for (const id of (a.locationIds || [])) {
                if (id) aLocIds.add(id);
            }
            // General announcements without specific location are permitted
            if (aLocIds.size === 0) return true;
            return Array.from(aLocIds).some(id => locationIdSet.has(id));
        })
        : announcementsResult.data;

    const items = [...validEvents, ...validAnnouncements].sort((a, b) => {
        const timeA = "startDateTime" in a && a.startDateTime ? new Date(a.startDateTime).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        const timeB = "startDateTime" in b && b.startDateTime ? new Date(b.startDateTime).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        return timeA - timeB;
    });

    return {
        kiosk: kioskWithLocations,
        items
    };
});
