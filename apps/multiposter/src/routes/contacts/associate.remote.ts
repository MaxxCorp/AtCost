import { command, query } from '$app/server';
import { db } from '@ac/db';
import { 
    userContact, locationContact, resourceContact, eventContact, announcementContact,
    eventContact as eventContactTable, eventContactRole
} from '@ac/db';
import { eq, and } from '@ac/db';
import { getAuthenticatedUser, hasAccess } from '#lib/server/authorization.js';
import { type Contact, associationSchema, updateAssociationSchema, getAssociationsSchema } from '#lib/validations/contacts.js';
import { updateContactRolesSchema } from '@ac/validations';
import { getEntityContacts } from '#lib/server/contacts.js';
import { addAssociation as dbAddAssociation, removeAssociation as dbRemoveAssociation } from '#lib/server/associations.js';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';

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

export const addAssociation = command(associationSchema, async (data) => {
    const user = getAuthenticatedUser();
    const { type, entityId, contactId } = data;

    // Authorization check
    const isAuthorized = 
        hasAccess(user, 'contacts') ||
        (type === 'event' && hasAccess(user, 'events')) ||
        (type === 'announcement' && hasAccess(user, 'announcements')) ||
        (type === 'location' && hasAccess(user, 'locations')) ||
        (type === 'resource' && hasAccess(user, 'resources'));

    if (!isAuthorized) {
        throw new Error('Forbidden');
    }

    await dbAddAssociation({
        type,
        entityId,
        itemId: contactId,
        tableMap,
        fieldMap,
        itemField: 'contactId',
        userId: user?.id
    });

    await fetchEntityContacts({ type, entityId }).refresh();
    return { success: true };
});

export const removeAssociation = command(associationSchema, async (data) => {
    const user = getAuthenticatedUser();
    const { type, entityId, contactId } = data;

    // Authorization check
    const isAuthorized = 
        hasAccess(user, 'contacts') ||
        (type === 'event' && hasAccess(user, 'events')) ||
        (type === 'announcement' && hasAccess(user, 'announcements')) ||
        (type === 'location' && hasAccess(user, 'locations')) ||
        (type === 'resource' && hasAccess(user, 'resources'));

    if (!isAuthorized) {
        throw new Error('Forbidden');
    }

    await dbRemoveAssociation({
        type,
        entityId,
        itemId: contactId,
        tableMap,
        fieldMap,
        itemField: 'contactId',
        userId: user?.id
    });

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

    let targetEntityId = entityId;
    if (type === 'event' && entityId.includes('_inst_')) {
        targetEntityId = await resolveEventIdForAssociations(entityId, { materializeIfVirtual: true, userId: user?.id });
    }

    await db.update(eventContactTable)
        .set({ participationStatus: status })
        .where(and(
            eq(eventContactTable.eventId, targetEntityId),
            eq(eventContactTable.contactId, contactId)
        ));

    await fetchEntityContacts({ type, entityId }).refresh();
    return { success: true };
});

export const updateContactRoles = command(updateContactRolesSchema, async (data) => {
    const user = getAuthenticatedUser();
    if (!hasAccess(user, 'contacts') && !hasAccess(user, 'events')) {
        throw new Error('Forbidden');
    }

    const { eventId, contactId, roleIds } = data;

    let targetEntityId = eventId;
    if (eventId.includes('_inst_')) {
        targetEntityId = await resolveEventIdForAssociations(eventId, { materializeIfVirtual: true, userId: user?.id });
    }

    await db.delete(eventContactRole).where(and(
        eq(eventContactRole.eventId, targetEntityId),
        eq(eventContactRole.contactId, contactId)
    ));

    if (roleIds.length > 0) {
        await db.insert(eventContactRole).values(
            roleIds.map(roleId => ({
                eventId: targetEntityId,
                contactId,
                roleId,
            }))
        );
    }

    await fetchEntityContacts({ type: 'event', entityId: targetEntityId }).refresh();
    return { success: true };
});


export const fetchEntityContacts = query(getAssociationsSchema, async (data): Promise<Contact[]> => {
    const { type, entityId } = data;
    
    // Auth check
    const user = getAuthenticatedUser();
    const isAuthorized = 
        hasAccess(user, 'contacts') ||
        (type === 'event' && hasAccess(user, 'events')) ||
        (type === 'announcement' && hasAccess(user, 'announcements')) ||
        (type === 'location' && hasAccess(user, 'locations')) ||
        (type === 'resource' && hasAccess(user, 'resources'));

    if (!isAuthorized) {
        throw new Error('Forbidden');
    }

    return await getEntityContacts(type, entityId);
});
