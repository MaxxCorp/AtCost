import { query } from '$app/server';
import { db } from '@ac/db';
import { kiosk, kioskLocation, location } from '@ac/db';
import { eq, inArray, and } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { resolveLocationContactSync } from '#lib/server/contact-resolution.js';
import { cached, cacheKeys } from '#lib/server/cache/index.js';

function toSafeDate(date: Date | string | null | undefined): Date | null {
    if (!date) return null;
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return null;
        const year = d.getFullYear();
        if (year < 1970 || year > 2100) return null;
        d.toISOString();
        return d;
    } catch {
        return null;
    }
}

export const getKiosk = query(v.string(), async (id: string) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'kiosks');

    const [result] = await db.select().from(kiosk).where(eq(kiosk.id, id));

    if (!result) return null;

    const locations = await db
        .select({ id: kioskLocation.locationId })
        .from(kioskLocation)
        .where(eq(kioskLocation.kioskId, id));

    const finalData = {
        ...result,
        startDate: toSafeDate(result.startDate),
        endDate: toSafeDate(result.endDate),
        locationIds: locations.map((l: any) => l.id),
    };
    return finalData;
});

export const getKioskForDisplay = query(v.string(), async (id: string) => {
    // Public access allowed for Kiosk display: strictly filter to public locations and public work contacts
    return cached(cacheKeys.kioskDisplay(id), 600, async () => {
        const [result] = await db.select().from(kiosk).where(eq(kiosk.id, id));

        if (!result) return null;

        const locations = await db.query.location.findMany({
            where: and(
                eq(location.isPublic, true),
                inArray(
                    location.id,
                    db.select({ id: kioskLocation.locationId })
                        .from(kioskLocation)
                        .where(eq(kioskLocation.kioskId, id))
                )
            ),
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
        });

        return {
            ...result,
            startDate: toSafeDate(result.startDate),
            endDate: toSafeDate(result.endDate),
            locations: locations
                .filter((l: any) => l.isPublic === true)
                .map((l: any) => ({
                    id: l.id,
                    name: l.name,
                    street: l.street,
                    houseNumber: l.houseNumber,
                    zip: l.zip,
                    city: l.city,
                    country: l.country,
                    openingHours: l.openingHours,
                    inclusivitySupport: l.inclusivitySupport,
                    contact: resolveLocationContactSync(l, {
                        filterWorkOnly: true,
                        publicOnly: true,
                        fallbackToFirst: true
                    })
                })),
        };
    });
});
