import { command, query } from '$app/server';
import { db } from '$lib/server/db';
import { userContact, locationContact, resourceContact, contact, location } from '$lib/server/db/schema';
import { getAuthenticatedUser, ensureAccess, hasAccess } from '$lib/server/authorization';
import { associationSchema, getAssociationsSchema, type Contact } from '@ac/validations/contacts';
import { and, eq } from 'drizzle-orm';
import * as v from 'valibot';

async function performAssociation(type: string, entityId: string, contactId: string, dissociate: boolean = false) {
    const user = getAuthenticatedUser();

    if (!hasAccess(user, 'contacts')) {
        throw new Error('Forbidden');
    }

    const table = {
        user: userContact,
        location: locationContact,
        resource: resourceContact
    }[type as 'user' | 'location' | 'resource'];

    if (!table) throw new Error(`Invalid type: ${type}`);

    const entityField = {
        user: 'userId',
        location: 'locationId',
        resource: 'resourceId'
    }[type as 'user' | 'location' | 'resource'];

    if (dissociate) {
        await db.delete(table).where(and(
            eq((table as any)[entityField], entityId),
            eq(table.contactId, contactId)
        ));
    } else {
        await (db.insert(table) as any).values({
            [entityField]: entityId,
            contactId
        }).onConflictDoNothing();
    }
}

export const addAssociation = command(associationSchema, async (data) => {
    const { type, entityId, contactId } = data;
    await performAssociation(type, entityId, contactId, false);
    await fetchEntityContacts({ type, entityId }).refresh();
    await fetchContactLocations(contactId).refresh();
    return { success: true };
});

export const removeAssociation = command(associationSchema, async (data) => {
    const { type, entityId, contactId } = data;
    await performAssociation(type, entityId, contactId, true);
    await fetchEntityContacts({ type, entityId }).refresh();
    await fetchContactLocations(contactId).refresh();
    return { success: true };
});

export const fetchEntityContacts = query(getAssociationsSchema, async (data): Promise<Contact[]> => {
    const { type, entityId } = data;
    const user = getAuthenticatedUser();

    if (!hasAccess(user, 'contacts')) {
        throw new Error('Forbidden');
    }

    const tableName = {
        user: 'userContact',
        location: 'locationContact',
        resource: 'resourceContact'
    }[type as 'user' | 'location' | 'resource'];

    const entityField = {
        user: 'userId',
        location: 'locationId',
        resource: 'resourceId'
    }[type as 'user' | 'location' | 'resource'];

    const associations = await (db.query as any)[tableName].findMany({
        where: (t: any, { eq }: any) => eq(t[entityField], entityId),
        with: {
            contact: {
                with: {
                    emails: true,
                    phones: true,
                    addresses: true,
                    tags: {
                        with: {
                            tag: true
                        }
                    },
                    relations: {
                        with: {
                            targetContact: true
                        }
                    }
                }
            }
        }
    });

    return associations.map((a: any) => ({
        ...a.contact,
        participationStatus: a.participationStatus || 'needsAction',
        createdAt: a.contact.createdAt.toISOString(),
        updatedAt: a.contact.updatedAt.toISOString(),
        birthday: a.contact.birthday ? a.contact.birthday.toISOString() : null,
        emails: a.contact.emails || [],
        phones: a.contact.phones || [],
        addresses: a.contact.addresses || [],
        relations: (a.contact.relations || []).map((rel: any) => ({
            id: rel.id,
            targetContactId: rel.targetContactId,
            relationType: rel.relationType,
            targetContact: rel.targetContact
        })),
        tags: (a.contact.tags || []).map((t: any) => ({
            id: t.tag.id,
            name: t.tag.name
        }))
    })) as Contact[];
});

export const fetchContactLocations = query(v.string(), async (contactId: string) => {
    const user = getAuthenticatedUser();
    if (!hasAccess(user, 'contacts')) {
        throw new Error('Forbidden');
    }

    const associations = await db.select({
        location: location
    })
        .from(locationContact)
        .innerJoin(location, eq(locationContact.locationId, location.id))
        .where(eq(locationContact.contactId, contactId));

    return associations.map(a => a.location);
});
