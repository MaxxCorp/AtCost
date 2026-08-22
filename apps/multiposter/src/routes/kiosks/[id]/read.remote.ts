import { query } from '$app/server';
import { db } from '@ac/db';
import { kiosk, kioskLocation, location } from '@ac/db';
import { eq, inArray } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { resolveLocationContactSync } from '$lib/server/contact-resolution';

export const getKiosk = query(v.string(), async (id: string) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'kiosks');

    console.log("getKiosk called for id:", id);
    const [result] = await db.select().from(kiosk).where(eq(kiosk.id, id));
    console.log("getKiosk result from db:", result ? "found" : "not found");

    if (!result) return null;

    const locations = await db
        .select({ id: kioskLocation.locationId })
        .from(kioskLocation)
        .where(eq(kioskLocation.kioskId, id));

    const finalData = {
        ...result,
        locationIds: locations.map((l: any) => l.id),
    };
    console.log("getKiosk returning:", finalData);
    return finalData;
});

export const getKioskForDisplay = query(v.string(), async (id: string) => {
    // Public access allowed for Kiosk display

    const [result] = await db.select().from(kiosk).where(eq(kiosk.id, id));

    if (!result) return null;

    const locations = await db.query.location.findMany({
        where: inArray(
            location.id,
            db.select({ id: kioskLocation.locationId })
                .from(kioskLocation)
                .where(eq(kioskLocation.kioskId, id))
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
        locations: locations.map((l: any) => ({
            id: l.id,
            name: l.name,
            street: l.street,
            houseNumber: l.houseNumber,
            zip: l.zip,
            city: l.city,
            country: l.country,
            contact: resolveLocationContactSync(l, { filterWorkOnly: true, fallbackToFirst: true })
        })),
    };
});
