import { command, query, requested } from '$app/server';
import { db } from '@ac/db';
import { eventResource, resource, announcementResource, kioskResource, resourceLocation, resourceRelation } from '@ac/db';
import { eq, inArray, or } from '@ac/db';
import { sortHierarchically } from '@ac/ui/utils';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { resourceAssociationSchema, getResourceAssociationsSchema } from '@ac/validations';
import { addAssociation as dbAddAssociation, removeAssociation as dbRemoveAssociation } from '#lib/server/associations.js';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';
import { commitEventChange } from '#lib/server/events/sync-commit.js';
import { syncService } from '#lib/server/sync/service.js';

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

export const addResourceAssociation = command(resourceAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'resources');

    const { type, entityId, resourceId } = data;
    
    const resolvedEntityId = await dbAddAssociation({
        type,
        entityId,
        itemId: resourceId,
        tableMap,
        fieldMap,
        itemField: 'resourceId',
        userId: user?.id
    });
    
    if (type === 'event') {
        if (user?.id) {
            await syncService.syncResourceAssociationsChange(user.id, resolvedEntityId, resourceId, 'link');
        }
        await commitEventChange({
            action: 'update',
            ids: [entityId, resolvedEntityId],
            user,
            extraRefresh: async () => {
                try {
                    await requested(fetchEntityResources, 20).refreshAll();
                } catch { /* ignore */ }
                await fetchEntityResources({ type, entityId }).refresh();
            }
        });
    } else {
        try {
            await requested(fetchEntityResources, 20).refreshAll();
        } catch { /* ignore */ }
        await fetchEntityResources({ type, entityId }).refresh();
    }
    return { success: true };
});

export const removeResourceAssociation = command(resourceAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'resources');

    const { type, entityId, resourceId } = data;
    
    const resolvedEntityId = await dbRemoveAssociation({
        type,
        entityId,
        itemId: resourceId,
        tableMap,
        fieldMap,
        itemField: 'resourceId',
        userId: user?.id
    });
    
    if (type === 'event') {
        if (user?.id) {
            await syncService.syncResourceAssociationsChange(user.id, resolvedEntityId, resourceId, 'unlink');
        }
        await commitEventChange({
            action: 'update',
            ids: [entityId, resolvedEntityId],
            user,
            extraRefresh: async () => {
                try {
                    await requested(fetchEntityResources, 20).refreshAll();
                } catch { /* ignore */ }
                await fetchEntityResources({ type, entityId }).refresh();
            }
        });
    } else {
        try {
            await requested(fetchEntityResources, 20).refreshAll();
        } catch { /* ignore */ }
        await fetchEntityResources({ type, entityId }).refresh();
    }
    return { success: true };
});

export const fetchEntityResources = query(getResourceAssociationsSchema, async (data) => {
    const { type, entityId } = data;
    
    const table = tableMap[type as keyof typeof tableMap];
    const entityField = fieldMap[type as keyof typeof fieldMap];

    if (!table || !entityField) {
        throw new Error(`Unsupported entity type: ${type}`);
    }

    let targetEntityId = entityId;
    if (type === 'event' && entityId.includes('_inst_')) {
        targetEntityId = await resolveEventIdForAssociations(entityId, { materializeIfVirtual: false });
    }

    const results = await db.select({ resource: resource })
        .from(table as any)
        .innerJoin(resource, eq((table as any).resourceId, resource.id))
        .where(eq((table as any)[entityField], targetEntityId));

    const resourceIds = results.map(r => r.resource.id);
    const parentMap = new Map<string, string[]>();
    const childMap = new Map<string, string[]>();

    if (resourceIds.length > 0) {
        const relations = await db
            .select()
            .from(resourceRelation)
            .where(
                or(
                    inArray(resourceRelation.childResourceId, resourceIds),
                    inArray(resourceRelation.parentResourceId, resourceIds)
                )
            );

        for (const rel of relations) {
            const parents = parentMap.get(rel.childResourceId) || [];
            parents.push(rel.parentResourceId);
            parentMap.set(rel.childResourceId, parents);

            const children = childMap.get(rel.parentResourceId) || [];
            children.push(rel.childResourceId);
            childMap.set(rel.parentResourceId, children);
        }
    }

    const mapped = results.map(r => ({
        ...r.resource,
        parentIds: parentMap.get(r.resource.id) || [],
        childIds: childMap.get(r.resource.id) || [],
        level: 0,
        createdAt: r.resource.createdAt.toISOString(),
        updatedAt: r.resource.updatedAt.toISOString(),
    }));

    return sortHierarchically(mapped, 'name', 'asc');
});
