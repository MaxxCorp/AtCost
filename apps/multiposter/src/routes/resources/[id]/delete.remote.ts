import { command } from '$app/server';
import { db, eventResource, syncMapping } from '@ac/db';
import { resource } from '@ac/db';
import { eq, and, inArray } from '@ac/db';
import { listResources } from '../list.remote';
import { listResourcesWithHierarchy } from '../list-with-hierarchy.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { syncService } from '$lib/server/sync/service';
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

    await listResources().refresh();
    await listResourcesWithHierarchy().refresh();
    return { success: true };
});
