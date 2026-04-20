import { command, query } from '$app/server';
import { db } from '$lib/server/db';
import { 
    userContact, locationContact, resourceContact, eventContact, announcementContact,
    contact, contactEmail, contactPhone, contactAddress, contactRelation, contactTag, tag
} from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess, hasAccess } from '$lib/server/authorization';
import { type Contact, associationSchema, updateAssociationSchema, getAssociationsSchema } from '$lib/validations/contacts';
import { getEntityContacts } from '$lib/server/contacts';

export const addAssociation = command(associationSchema, async (data) => {
    const user = getAuthenticatedUser();
    const { type, entityId, contactId } = data;

    // Authorization check
    if (!hasAccess(user, 'contacts') && !(type === 'event' && hasAccess(user, 'events')) && !(type === 'announcement' && hasAccess(user, 'announcements'))) {
        throw new Error('Forbidden');
    }

    const tableMap = {
        user: userContact,
        location: locationContact,
        resource: resourceContact,
        event: eventContact,
        announcement: announcementContact
    } as const;

    const fieldMap = {
        user: 'userId',
        location: 'locationId',
        resource: 'resourceId',
        event: 'eventId',
        announcement: 'announcementId'
    } as const;

    const table = tableMap[type as keyof typeof tableMap];
    const entityField = fieldMap[type as keyof typeof fieldMap];

    await (db.insert(table as any) as any).values({
        [entityField as any]: entityId,
        contactId
    }).onConflictDoNothing();

    await fetchEntityContacts({ type, entityId }).refresh();
    return { success: true };
});

export const removeAssociation = command(associationSchema, async (data) => {
    const user = getAuthenticatedUser();
    const { type, entityId, contactId } = data;

    // Authorization check
    if (!hasAccess(user, 'contacts') && !(type === 'event' && hasAccess(user, 'events')) && !(type === 'announcement' && hasAccess(user, 'announcements'))) {
        throw new Error('Forbidden');
    }

    const tableMap = {
        user: userContact,
        location: locationContact,
        resource: resourceContact,
        event: eventContact,
        announcement: announcementContact
    } as const;

    const fieldMap = {
        user: 'userId',
        location: 'locationId',
        resource: 'resourceId',
        event: 'eventId',
        announcement: 'announcementId'
    } as const;

    const table = tableMap[type as keyof typeof tableMap];
    const entityField = fieldMap[type as keyof typeof fieldMap];

    await db.delete(table as any).where(and(
        eq((table as any)[entityField as any], entityId),
        eq((table as any).contactId, contactId)
    ));

    await fetchEntityContacts({ type, entityId }).refresh();
    return { success: true };
});

export const updateAssociationStatus = command(updateAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    const { type, entityId, contactId, status } = data;

    if (!hasAccess(user, 'contacts') && !hasAccess(user, 'events')) {
        throw new Error('Forbidden');
    }

    if (type !== 'event') {
        throw new Error('Only event associations support participation status');
    }

    await db.update(eventContact)
        .set({ participationStatus: status })
        .where(and(
            eq(eventContact.eventId, entityId),
            eq(eventContact.contactId, contactId)
        ));

    await fetchEntityContacts({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityContacts = query(getAssociationsSchema, async (data): Promise<Contact[]> => {
    const { type, entityId } = data;
    
    // Auth check
    const user = getAuthenticatedUser();
    if (!hasAccess(user, 'contacts') && !(type === 'event' && hasAccess(user, 'events')) && !(type === 'announcement' && hasAccess(user, 'announcements'))) {
        throw new Error('Forbidden');
    }

    return await getEntityContacts(type, entityId);
});
