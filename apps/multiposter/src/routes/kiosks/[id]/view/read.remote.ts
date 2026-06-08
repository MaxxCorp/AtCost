import { query } from '$app/server';
import { listKioskEvents } from '../../../events/list-public.remote';
import { listKioskAnnouncements } from '../../../announcements/list.remote';
import { db } from '@ac/db';
import { kiosk, kioskLocation, location } from '@ac/db';
import { eq } from '@ac/db';
import * as v from 'valibot';

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
                                    phones: true
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
        const mainContact = loc.locationContacts?.[0]?.contact;
        let publicQrCodePath = mainContact?.qrCodePath;
        if (mainContact && (!publicQrCodePath || !publicQrCodePath.includes('/api/'))) {
            publicQrCodePath = `/api/contacts/${mainContact.id}/qr.png`;
        }
        return {
            id: loc.id,
            name: loc.name,
            street: loc.street,
            houseNumber: loc.houseNumber,
            zip: loc.zip,
            city: loc.city,
            country: loc.country,
            contact: mainContact ? {
                name: mainContact.displayName || `${mainContact.givenName || ''} ${mainContact.familyName || ''}`.trim(),
                email: mainContact.emails?.find((e: any) => e.type === 'work')?.value || mainContact.emails?.[0]?.value,
                phone: mainContact.phones?.find((p: any) => p.type === 'work')?.value || mainContact.phones?.[0]?.value,
                qrCodePath: publicQrCodePath
            } : null
        };
    });

    const kioskWithLocations = {
        ...kioskData,
        locations: locations
    };

    const locationIds = locations.map(l => l.id);
    
    const eventsResult = await listKioskEvents(kioskId);
    const announcementsResult = await listKioskAnnouncements({
        limit: 100,
        locationId: locationIds.length > 0 ? locationIds : undefined
    });

    const items = [...eventsResult, ...announcementsResult.data].sort((a, b) => {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

    return {
        kiosk: kioskWithLocations,
        items
    };
});
