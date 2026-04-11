import { query } from '$app/server';
import { db } from '$lib/server/db';
import { kiosk, kioskLocation, location, contactEmail, contactPhone } from '@ac/db';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const getKiosk = query(v.string(), async (id: string) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'kiosks');

    const result = await db.query.kiosk.findFirst({
        where: eq(kiosk.id, id),
    });

    if (!result) return null;

    const locations = await db
        .select({ id: kioskLocation.locationId })
        .from(kioskLocation)
        .where(eq(kioskLocation.kioskId, id));

    return {
        ...result,
        locationIds: locations.map((l: any) => l.id),
    };
});

export const getKioskForDisplay = query(v.string(), async (id: string) => {
    // Public access allowed for Kiosk display

    const result = await db.query.kiosk.findFirst({
        where: eq(kiosk.id, id),
    });

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
                            emails: { where: eq(contactEmail.type, 'work'), limit: 1 },
                            phones: { where: eq(contactPhone.type, 'work'), limit: 1 },
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
        locations: locations.map((l: any) => {
            // Find the contact with the "Employee" tag
            const employeeLocContact = l.locationContacts.find((lc: any) => 
                lc.contact.tags.some((t: any) => t.tag.name === 'Employee')
            ) || l.locationContacts[0]; // Fallback to first contact if no Employee tag found

            const contactDetails = employeeLocContact?.contact;

            return {
                id: l.id,
                name: l.name,
                street: l.street,
                houseNumber: l.houseNumber,
                zip: l.zip,
                city: l.city,
                country: l.country,
                contact: contactDetails ? {
                    name: contactDetails.displayName || `${contactDetails.givenName || ''} ${contactDetails.familyName || ''}`.trim(),
                    email: contactDetails.emails[0]?.value,
                    phone: contactDetails.phones[0]?.value,
                    qrCodePath: contactDetails.qrCodePath ? (contactDetails.qrCodePath.includes('_public') ? contactDetails.qrCodePath : contactDetails.qrCodePath.replace('/qr.png', '/qr_public.png')) : undefined,
                } : null
            };
        }),
    };
});
