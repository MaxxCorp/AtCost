import { command, query } from '$app/server';
import { db } from '@ac/db';
import { eventResource, resource, announcementResource, kioskResource, resourceLocation } from '@ac/db';
import { eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { resourceAssociationSchema, getResourceAssociationsSchema } from '@ac/validations';
import { addAssociation as dbAddAssociation, removeAssociation as dbRemoveAssociation } from '$lib/server/associations';

const tableMap = {
    event: eventResource,
    announcement: announcementResource,
    kiosk: kioskResource,
    location: resourceLocation
} as const;

const fieldMap = {
    event: 'eventId',
    announcement: 'announcementId',
    kiosk: 'kioskId',
    location: 'locationId'
} as const;

import { syncService } from '$lib/server/sync/service';

export const addResourceAssociation = command(resourceAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'resources');

    const { type, entityId, resourceId } = data;
    
    await dbAddAssociation({
        type,
        entityId,
        itemId: resourceId,
        tableMap,
        fieldMap,
        itemField: 'resourceId'
    });
    
    if (type === 'event' && user?.id) {
        await syncService.syncResourceAssociationsChange(user.id, entityId, resourceId, 'link');
    }

    await fetchEntityResources({ type, entityId }).refresh();
    return { success: true };
});

export const removeResourceAssociation = command(resourceAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'resources');

    const { type, entityId, resourceId } = data;
    
    await dbRemoveAssociation({
        type,
        entityId,
        itemId: resourceId,
        tableMap,
        fieldMap,
        itemField: 'resourceId'
    });
    
    if (type === 'event' && user?.id) {
        await syncService.syncResourceAssociationsChange(user.id, entityId, resourceId, 'unlink');
    }

    await fetchEntityResources({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityResources = query(getResourceAssociationsSchema, async (data) => {
    const { type, entityId } = data;
    
    const table = tableMap[type as keyof typeof tableMap];
    const entityField = fieldMap[type as keyof typeof fieldMap];

    if (!table || !entityField) {
        throw new Error(`Unsupported entity type: ${type}`);
    }

    const results = await db.select({ resource: resource })
        .from(table as any)
        .innerJoin(resource, eq((table as any).resourceId, resource.id))
        .where(eq((table as any)[entityField], entityId));
    
    return results.map(r => ({
        ...r.resource,
        createdAt: r.resource.createdAt.toISOString(),
        updatedAt: r.resource.updatedAt.toISOString(),
    }));
});
