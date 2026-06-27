import { command } from '$app/server';
import { db } from '@ac/db';
import { event, recurringSeries } from '@ac/db';
import { eq, and, inArray } from '@ac/db';
import { listEvents } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { publishEventChange } from '$lib/server/realtime';
import { syncService } from '$lib/server/sync/service';

/**
 * Command: Delete events by ID
 */
export const deleteEvents = command(
	v.object({
		ids: v.pipe(v.array(v.string()), v.minLength(1)),
		deleteSeries: v.optional(v.boolean())
	}),
	async (params) => {
		const { ids, deleteSeries } = params;
		const user = getAuthenticatedUser();
		ensureAccess(user, 'events');

		console.log(`[deleteEvents] Starting deletion. ids=${ids}, deleteSeries=${deleteSeries}`);

		// If deleteSeries is true, we should find all instances of the series and delete them
		let idsToDelete = [...ids];
		let seriesIdsToDelete: string[] = [];
		
		if (deleteSeries) {
			const events = await db.select({ id: event.id, seriesId: event.seriesId }).from(event).where(inArray(event.id, ids));
			const seriesIds = events.map(e => e.seriesId).filter((id): id is string => id !== null);
			if (seriesIds.length > 0) {
				seriesIdsToDelete = seriesIds;
				const seriesEvents = await db.select({ id: event.id }).from(event).where(inArray(event.seriesId, seriesIds));
				idsToDelete = [...new Set([...idsToDelete, ...seriesEvents.map(e => e.id)])];
			}
		}

		// Trigger sync deletion first (before local event is gone)
		await syncService.deleteEventMappings(user.id, idsToDelete);

		await db
			.delete(event)
			.where(inArray(event.id, idsToDelete));

		if (seriesIdsToDelete.length > 0) {
			await db.delete(recurringSeries).where(inArray(recurringSeries.id, seriesIdsToDelete));
		}

		// We assume all were deleted for notification purposes, or we could fetch existing before delete
		await publishEventChange('delete', idsToDelete);

		await listEvents().refresh();
		console.log(`[deleteEvents] Successfully deleted events.`);
		return { success: true };
	});
