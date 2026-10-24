import { command, requested } from '$app/server';
import { db, eventResource, syncMapping } from '@ac/db';
import { resource } from '@ac/db';
import { inArray } from '@ac/db';
import { listResources } from '../list.remote';
import { listResourcesWithHierarchy } from '../list-with-hierarchy.remote';
import { fetchEntityResources } from '../associate.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { syncService } from '#lib/server/sync/service.js';
import * as v from 'valibot';

export const deleteResource = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'resources');

    // Find affected events before deletion
    const linkedEvents = await db
        .select({ eventId: eventResource.eventId })
        .from(eventResource)
        .where(inArray(eventResource.resourceId, ids));

    const eventIds = Array.from(new Set(linkedEvents.map(e => e.eventId)));

    // Clean up resource mappings
    await db
        .delete(syncMapping)
        .where(inArray(syncMapping.resourceId, ids));

    // Delete the resources
    await db
        .delete(resource)
        .where(inArray(resource.id, ids));

    // Re-sync affected events if any
    if (user?.id && eventIds.length > 0) {
        await syncService.syncItems(user.id, eventIds, 'event');
    }

    try {
        await requested(listResources, 20).refreshAll();
        await requested(listResourcesWithHierarchy, 20).refreshAll();
        await requested(fetchEntityResources, 20).refreshAll();
    } catch { /* ignore */ }
    void listResources().refresh();
    void listResources({}).refresh();
    void listResourcesWithHierarchy().refresh();
    void listResourcesWithHierarchy({}).refresh();
    return { success: true };
});
