import { command, query, requested } from '$app/server';
import { db } from '@ac/db';
import { 
    userContact, locationContact, resourceContact, eventContact, announcementContact,
    eventContact as eventContactTable, eventContactRole, announcementContactRole, locationContactRole
} from '@ac/db';
import { eq, and } from '@ac/db';
import { getAuthenticatedUser, hasAccess } from '#lib/server/authorization.js';
import { type Contact, associationSchema, updateAssociationSchema, getAssociationsSchema } from '#lib/validations/contacts.js';
import { updateContactRolesSchema } from '@ac/validations';
import { getEntityContacts } from '#lib/server/contacts.js';
import { addAssociation as dbAddAssociation, removeAssociation as dbRemoveAssociation } from '#lib/server/associations.js';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';
import { readEvent } from '../events/[id]/read.remote.js';
import { readAnnouncement } from '../announcements/[id]/read.remote.js';
import { readLocation } from '../locations/[id]/read.remote.js';
import { invalidateEvent, invalidateAnnouncement, invalidateLocation } from '#lib/server/cache/index.js';
import { syncService } from '#lib/server/sync/service.js';

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

    if (type === 'event' && user?.id) {
        await syncService.syncContactAssociationsChange(user.id, entityId, contactId, 'link');
    }

    if (type === 'event') {
        await invalidateEvent(entityId);
        void readEvent(entityId).refresh();
    } else if (type === 'announcement') {
        await invalidateAnnouncement(entityId);
        void readAnnouncement(entityId).refresh();
    } else if (type === 'location') {
        await invalidateLocation(entityId);
        void readLocation(entityId).refresh();
    }
    try { await requested(fetchEntityContacts, 20).refreshAll(); } catch { /* ignore */ }
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

    if (type === 'event' && user?.id) {
        await syncService.syncContactAssociationsChange(user.id, entityId, contactId, 'unlink');
    }

    if (type === 'event') {
        await invalidateEvent(entityId);
        void readEvent(entityId).refresh();
    } else if (type === 'announcement') {
        await invalidateAnnouncement(entityId);
        void readAnnouncement(entityId).refresh();
    } else if (type === 'location') {
        await invalidateLocation(entityId);
        void readLocation(entityId).refresh();
    }
    try { await requested(fetchEntityContacts, 20).refreshAll(); } catch { /* ignore */ }
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

    if (type === 'event' && user?.id) {
        await syncService.syncContactAssociationsChange(user.id, targetEntityId, contactId, 'status_update');
    }

    if (type === 'event') {
        await invalidateEvent(entityId);
        void readEvent(entityId).refresh();
    }
    try { await requested(fetchEntityContacts, 20).refreshAll(); } catch { /* ignore */ }
    await fetchEntityContacts({ type, entityId }).refresh();
    return { success: true };
});

export const updateContactRoles = command(updateContactRolesSchema, async (data) => {
    const user = getAuthenticatedUser();
    const type = data.type || 'event';
    const rawEntityId = data.entityId || data.eventId;

    if (!rawEntityId) {
        throw new Error('Entity ID is required');
    }

    const isAuthorized = 
        hasAccess(user, 'contacts') ||
        (type === 'event' && hasAccess(user, 'events')) ||
        (type === 'announcement' && hasAccess(user, 'announcements')) ||
        (type === 'location' && hasAccess(user, 'locations'));

    if (!isAuthorized) {
        throw new Error('Forbidden');
    }

    const { contactId, roleIds } = data;

    let targetEntityId = rawEntityId;
    if (type === 'event' && rawEntityId.includes('_inst_')) {
        targetEntityId = await resolveEventIdForAssociations(rawEntityId, { materializeIfVirtual: true, userId: user?.id });
    }

    if (type === 'event') {
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

        await invalidateEvent(targetEntityId);
        void readEvent(targetEntityId).refresh();

        if (user?.id) {
            await syncService.syncContactAssociationsChange(user.id, targetEntityId, contactId, 'role_update');
        }
    } else if (type === 'announcement') {
        await db.delete(announcementContactRole).where(and(
            eq(announcementContactRole.announcementId, targetEntityId),
            eq(announcementContactRole.contactId, contactId)
        ));

        if (roleIds.length > 0) {
            await db.insert(announcementContactRole).values(
                roleIds.map(roleId => ({
                    announcementId: targetEntityId,
                    contactId,
                    roleId,
                }))
            );
        }

        await invalidateAnnouncement(targetEntityId);
        void readAnnouncement(targetEntityId).refresh();
    } else if (type === 'location') {
        await db.delete(locationContactRole).where(and(
            eq(locationContactRole.locationId, targetEntityId),
            eq(locationContactRole.contactId, contactId)
        ));

        if (roleIds.length > 0) {
            await db.insert(locationContactRole).values(
                roleIds.map(roleId => ({
                    locationId: targetEntityId,
                    contactId,
                    roleId,
                }))
            );
        }

        await invalidateLocation(targetEntityId);
        void readLocation(targetEntityId).refresh();
    }

    await fetchEntityContacts({ type, entityId: targetEntityId }).refresh();
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
