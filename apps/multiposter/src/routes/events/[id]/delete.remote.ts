import { command } from '$app/server';
import { db } from '@ac/db';
import { event, recurringSeries } from '@ac/db';
import { eq, and, inArray } from '@ac/db';
import { listEvents } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { publishEventChange } from '$lib/server/realtime';
import { syncService } from '$lib/server/sync/service';
import { invalidateEvent } from '$lib/server/cache';

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

		// Handle virtual instances (e.g. `${masterId}_inst_${iso}`)
		const virtualIds = ids.filter(id => id.includes('_inst_'));
		const realIds = ids.filter(id => !id.includes('_inst_'));

		if (deleteSeries) {
			for (const vId of virtualIds) {
				const [masterId] = vId.split('_inst_');
				if (masterId && !realIds.includes(masterId)) {
					realIds.push(masterId);
				}
			}
		} else {
			for (const vId of virtualIds) {
				const [masterId, isoDate] = vId.split('_inst_');
				if (masterId && isoDate) {
					const decodedIso = decodeURIComponent(isoDate);
					const [master] = await db.select().from(event).where(eq(event.id, masterId));
					if (master) {
						const existingExdates: string[] = Array.isArray(master.exdates) ? (master.exdates as string[]) : [];
						if (!existingExdates.includes(decodedIso)) {
							await db.update(event).set({ exdates: [...existingExdates, decodedIso] }).where(eq(event.id, masterId));
						}
						await invalidateEvent([masterId, vId]);
					}
				}
			}

			if (realIds.length === 0) {
				await listEvents().refresh();
				return { success: true };
			}
		}

		let idsToDelete = [...realIds];
		let seriesIdsToDelete: string[] = [];
		
		if (deleteSeries) {
			const events = await db.select({ id: event.id, seriesId: event.seriesId, recurringEventId: event.recurringEventId }).from(event).where(inArray(event.id, realIds));
			const seriesIds = events.map(e => e.seriesId).filter((id): id is string => id !== null);
			const masterIds = [...new Set(events.map(e => e.recurringEventId || e.id))];

			if (seriesIds.length > 0) {
				seriesIdsToDelete = seriesIds;
				const seriesEvents = await db.select({ id: event.id }).from(event).where(inArray(event.seriesId, seriesIds));
				idsToDelete = [...new Set([...idsToDelete, ...seriesEvents.map(e => e.id)])];
			}

			if (masterIds.length > 0) {
				const childEvents = await db.select({ id: event.id }).from(event).where(inArray(event.recurringEventId, masterIds));
				idsToDelete = [...new Set([...idsToDelete, ...masterIds, ...childEvents.map(e => e.id)])];
			}
		} else {
			// Record exdates for any deleted instance rows so they do not resurrect
			const events = await db.select({
				id: event.id,
				recurringEventId: event.recurringEventId,
				startDateTime: event.startDateTime,
				originalStartTime: event.originalStartTime
			}).from(event).where(inArray(event.id, realIds));

			for (const e of events) {
				if (e.recurringEventId && e.startDateTime) {
					const [master] = await db.select().from(event).where(eq(event.id, e.recurringEventId));
					if (master) {
						const dateIso = e.originalStartTime && typeof e.originalStartTime === 'object' && 'dateTime' in (e.originalStartTime as any)
							? (e.originalStartTime as any).dateTime
							: e.startDateTime.toISOString();
						const existingExdates: string[] = Array.isArray(master.exdates) ? (master.exdates as string[]) : [];
						if (!existingExdates.includes(dateIso)) {
							await db.update(event).set({ exdates: [...existingExdates, dateIso] }).where(eq(event.id, master.id));
						}
					}
				}
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

		await publishEventChange('delete', idsToDelete);
		await invalidateEvent(idsToDelete);
		await listEvents().refresh();
		console.log(`[deleteEvents] Successfully deleted events.`);
		return { success: true };
	});

