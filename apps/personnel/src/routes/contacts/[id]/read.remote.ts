import { query } from '$app/server';
import { db } from '$lib/server/db';
import { contact } from '$lib/server/db/schema';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const readContact = query(v.string(), async (id: string) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    const contactData = await db.query.contact.findFirst({
        where: (table, { eq }) => eq(table.id, id),
        with: {
            emails: true,
            phones: true,
            addresses: true,
            locationAssociations: {
                with: {
                    location: true
                }
            },
            relations: {
                with: {
                    targetContact: true
                }
            },
            tags: {
                with: {
                    tag: true
                }
            }
        }
    });

    if (!contactData) return null;

    return {
        contact: {
            ...contactData,
            birthday: contactData.birthday ? contactData.birthday.toISOString() : null,
            createdAt: contactData.createdAt.toISOString(),
            updatedAt: contactData.updatedAt.toISOString(),
        },
        emails: contactData.emails,
        phones: contactData.phones,
        addresses: contactData.addresses,
        locationAssociations: contactData.locationAssociations,
        locationIds: contactData.locationAssociations?.map(la => la.locationId) || [],
        relations: (contactData.relations || []).map(r => ({
            id: r.id,
            targetContactId: r.targetContactId,
            relationType: r.relationType,
            targetContact: r.targetContact
        })),
        tags: (contactData.tags || []).map(t => ({
            id: t.tag.id,
            name: t.tag.name
        })),
    };
});
