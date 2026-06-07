import { command } from '$app/server';
import { db } from '@ac/db';
import { event, recurringSeries } from '@ac/db';
import { inArray, or, eq } from '@ac/db';
import { listEvents } from './list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { syncService } from '$lib/server/sync/service';
import { publishEventChange } from '$lib/server/realtime';
import { getStorageProvider } from '$lib/server/blob-storage';

export const deleteEvents = command(
	v.object({
		ids: v.array(v.string()),
		deleteSeries: v.optional(v.boolean())
	}),
	async ({ ids, deleteSeries }) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'events');

		if (ids.length === 0) return { success: true, deletedCount: 0 };

		const storage = getStorageProvider();

		// Fetch the initial events to determine if they belong to a series
		const targetEvents = await db.query.event.findMany({
			where: (table, { inArray }) => inArray(table.id, ids),
			columns: { id: true, seriesId: true, recurringEventId: true }
		});

		let eventIdsToDelete: string[] = [];

		if (deleteSeries) {
			// Find all series IDs and legacy master IDs
			const seriesIds = [...new Set(targetEvents.map(e => e.seriesId).filter(Boolean) as string[])];
			const legacyMasterIds = [...new Set(targetEvents.map(e => e.recurringEventId || e.id))];

			// Fetch ALL events that belong to these series or masters so we can clean up storage/sync
			const allAffectedEvents = await db.query.event.findMany({
				where: (table, { inArray, or }) => {
					const conditions = [];
					if (seriesIds.length > 0) conditions.push(inArray(table.seriesId, seriesIds));
					if (legacyMasterIds.length > 0) {
						conditions.push(inArray(table.id, legacyMasterIds));
						conditions.push(inArray(table.recurringEventId, legacyMasterIds));
					}
					return conditions.length > 0 ? or(...conditions) : eq(table.id, '00000000-0000-0000-0000-000000000000'); // dummy fallback
				},
				columns: { id: true, qrCodePath: true, iCalPath: true }
			});

			eventIdsToDelete = allAffectedEvents.map(e => e.id);

			// Clean up associated files from storage
			for (const e of allAffectedEvents) {
				if (e.qrCodePath?.startsWith('http')) await storage.delete(e.qrCodePath).catch(() => {});
				if (e.iCalPath?.startsWith('http')) await storage.delete(e.iCalPath).catch(() => {});
			}

			// Delete from Database
			// Note: Because of ON DELETE CASCADE, deleting recurringSeries deletes related events.
			// However, to be safe and handle legacy data without seriesId, we explicitly delete the events too.
			if (eventIdsToDelete.length > 0) {
				await db.delete(event).where(inArray(event.id, eventIdsToDelete));
			}
			if (seriesIds.length > 0) {
				await db.delete(recurringSeries).where(inArray(recurringSeries.id, seriesIds));
			}

		} else {
			// Just delete the specific IDs requested
			eventIdsToDelete = ids;
			
			const eventsToDelete = await db.query.event.findMany({
				where: (table, { inArray }) => inArray(table.id, ids),
				columns: { id: true, qrCodePath: true, iCalPath: true }
			});

			for (const e of eventsToDelete) {
				if (e.qrCodePath?.startsWith('http')) await storage.delete(e.qrCodePath).catch(() => {});
				if (e.iCalPath?.startsWith('http')) await storage.delete(e.iCalPath).catch(() => {});
			}

			await db.delete(event).where(inArray(event.id, ids));
		}

		// Perform external cleanup for all deleted event IDs
		if (eventIdsToDelete.length > 0) {
			await syncService.deleteEventMappings(user.id, eventIdsToDelete).catch(console.error);
			await publishEventChange('delete', eventIdsToDelete).catch(console.error);
		}

		void listEvents().refresh();
		return { success: true, deletedCount: eventIdsToDelete.length };
	}
);
