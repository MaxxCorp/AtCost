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
            zip: loc.zip,
            city: loc.city,
            country: loc.country,
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
        if (kioskData.uiMode === 'flat_list' && lookAheadSeconds <= 604800) {
            lookAheadSeconds = 2592000; // 30 days default for monthly listings
        }
        startDate = new Date(now.getTime() - (kioskData.lookPast * 1000)).toISOString();
        endDate = new Date(now.getTime() + (lookAheadSeconds * 1000)).toISOString();
    }

    const eventsResult = await listEvents({
        limit: 100,
        locationId: locationIds.length > 0 ? locationIds : undefined,
        startDate,
        endDate,
        excludeTentative: kioskData.excludeTentative,
        excludeCancelled: kioskData.excludeCancelled,
        excludeNonPublic: kioskData.excludeNonPublic,
        excludeSeries: kioskData.excludeSeries,
        excludedEventIds: kioskData.excludedEventIds || [],
        includedEventIds: kioskData.includedEventIds || [],
        excludedTags: kioskData.excludedTags || [],
        includedTags: kioskData.includedTags || [],
    });

    const announcementsResult = await listAnnouncements({
        limit: 100,
        locationId: locationIds.length > 0 ? locationIds : undefined,
        excludedAnnouncementIds: kioskData.excludedAnnouncementIds || [],
        includedAnnouncementIds: kioskData.includedAnnouncementIds || [],
        excludedTags: kioskData.excludedTags || [],
        includedTags: kioskData.includedTags || [],
    });

    const items = [...eventsResult.data, ...announcementsResult.data].sort((a, b) => {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

    return {
        kiosk: kioskWithLocations,
        items
    };
});
