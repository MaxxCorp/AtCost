import { command } from '$app/server';
import { db } from '@ac/db';
import { event, recurringSeries } from '@ac/db';
import { inArray, or, eq, and, sql } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { syncService } from '#lib/server/sync/service.js';
import { getStorageProvider } from '#lib/server/blob-storage/index.js';
import { revertMaterializedExceptions } from '#lib/server/events/exceptions.js';
import { commitEventChange } from '#lib/server/events/sync-commit.js';

export const deleteEvents = command(
	v.object({
		ids: v.array(v.string()),
		deleteSeries: v.optional(v.boolean()),
		deleteException: v.optional(v.boolean())
	}),
	async ({ ids, deleteSeries, deleteException }) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'events');

		if (ids.length === 0) return { success: true, deletedCount: 0, revertedVirtualIds: [] as string[] };

		if (deleteException) {
			const result = await revertMaterializedExceptions({
				userId: user.id,
				eventIds: ids
			});

			await commitEventChange({
				action: 'delete',
				ids: [...ids, ...result.deletedIds, ...result.revertedVirtualIds],
				masterIds: result.affectedMasterIds,
				user
			});

			return {
				success: true,
				deletedCount: result.deletedIds.length,
				revertedVirtualIds: result.revertedVirtualIds
			};
		}

		const storage = getStorageProvider();

		// Handle virtual instances (e.g. `${masterId}_inst_${iso}`)
		const virtualIds = ids.filter(id => id.includes('_inst_'));
		const realIds = ids.filter(id => !id.includes('_inst_'));
		const affectedMasterIds = new Set<string>();
		const deletedVirtualExceptionIds: string[] = [];

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
					affectedMasterIds.add(masterId);
					const decodedIso = decodeURIComponent(isoDate);
					const [master] = await db.select().from(event).where(eq(event.id, masterId));
					if (master) {
						const existingExdates: string[] = Array.isArray(master.exdates) ? (master.exdates as string[]) : [];
						if (!existingExdates.includes(decodedIso)) {
							await db.update(event).set({ exdates: [...existingExdates, decodedIso] }).where(eq(event.id, masterId));
						}
					}

					// Also check if an exception row existed in DB for this slot and clean it up
					const [existingException] = await db
						.select({ id: event.id })
						.from(event)
						.where(
							and(
								eq(event.recurringEventId, masterId),
								or(
									sql`${event.originalStartTime}->>'dateTime' = ${isoDate}`,
									sql`${event.originalStartTime}->>'dateTime' = ${decodedIso}`
								)
							)
						);
					if (existingException) {
						await syncService.deleteEventMappings(user.id, [existingException.id]).catch(console.error);
						await db.delete(event).where(eq(event.id, existingException.id));
						deletedVirtualExceptionIds.push(existingException.id);
					}
				}
			}

			if (virtualIds.length > 0) {
				await syncService.deleteEventMappings(user.id, virtualIds).catch(console.error);
				for (const mId of affectedMasterIds) {
					await syncService.syncItems(user.id, [mId], 'event').catch(console.error);
				}
			}

			if (realIds.length === 0) {
				await commitEventChange({
					action: 'delete',
					ids: [...virtualIds, ...deletedVirtualExceptionIds],
					masterIds: affectedMasterIds,
					user
				});
				return { success: true, deletedCount: virtualIds.length, revertedVirtualIds: [] as string[] };
			}
		}

		// Fetch the initial events to determine if they belong to a series
		const targetEvents = await db.query.event.findMany({
			where: (table, { inArray }) => inArray(table.id, realIds),
			columns: { id: true, seriesId: true, recurringEventId: true, startDateTime: true, originalStartTime: true }
		});

		let eventIdsToDelete: string[] = [];

		if (deleteSeries) {
			// Find all series IDs and master IDs
			const seriesIds = [...new Set(targetEvents.map(e => e.seriesId).filter(Boolean) as string[])];
			const masterIds = [...new Set(targetEvents.map(e => e.recurringEventId || e.id))];
			for (const mId of masterIds) affectedMasterIds.add(mId);

			// Fetch ALL events that belong to these series or masters so we can clean up storage/sync
			const allAffectedEvents = await db.query.event.findMany({
				where: (table, { inArray, or }) => {
					const conditions = [];
					if (seriesIds.length > 0) conditions.push(inArray(table.seriesId, seriesIds));
					if (masterIds.length > 0) {
						conditions.push(inArray(table.id, masterIds));
						conditions.push(inArray(table.recurringEventId, masterIds));
					}
					return conditions.length > 0 ? or(...conditions) : eq(table.id, '00000000-0000-0000-0000-000000000000');
				},
				columns: { id: true, qrCodePath: true, iCalPath: true }
			});

			eventIdsToDelete = allAffectedEvents.map(e => e.id);

			// Clean up associated files from storage
			for (const e of allAffectedEvents) {
				if (e.qrCodePath?.startsWith('http')) await storage.delete(e.qrCodePath).catch(() => {});
				if (e.iCalPath?.startsWith('http')) await storage.delete(e.iCalPath).catch(() => {});
			}

			// Trigger sync deletion FIRST (before local events and relations like rooms/resources are gone)
			if (eventIdsToDelete.length > 0) {
				await syncService.deleteEventMappings(user.id, eventIdsToDelete).catch(console.error);
			}

			// Delete from Database
			if (eventIdsToDelete.length > 0) {
				await db.delete(event).where(inArray(event.id, eventIdsToDelete));
			}
			if (seriesIds.length > 0) {
				await db.delete(recurringSeries).where(inArray(recurringSeries.id, seriesIds));
			}
		} else {
			// Just delete the specific IDs requested
			eventIdsToDelete = realIds;

			const eventsToDelete = await db.query.event.findMany({
				where: (table, { inArray }) => inArray(table.id, realIds),
				columns: { id: true, qrCodePath: true, iCalPath: true, recurringEventId: true, startDateTime: true, originalStartTime: true }
			});

			// If deleting an instance of a series, record its date in master's exdates so it doesn't resurrect
			const physicalMasterIds = new Set<string>();
			for (const e of eventsToDelete) {
				if (e.recurringEventId && e.startDateTime) {
					physicalMasterIds.add(e.recurringEventId);
					affectedMasterIds.add(e.recurringEventId);
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

			for (const e of eventsToDelete) {
				if (e.qrCodePath?.startsWith('http')) await storage.delete(e.qrCodePath).catch(() => {});
				if (e.iCalPath?.startsWith('http')) await storage.delete(e.iCalPath).catch(() => {});
			}

			// Trigger sync deletion FIRST (before local events and relations like rooms/resources are gone)
			if (eventIdsToDelete.length > 0) {
				await syncService.deleteEventMappings(user.id, eventIdsToDelete).catch(console.error);
			}

			await db.delete(event).where(inArray(event.id, realIds));

			for (const mId of physicalMasterIds) {
				await syncService.syncItems(user.id, [mId], 'event').catch(console.error);
			}
		}

		await commitEventChange({
			action: 'delete',
			ids: [...eventIdsToDelete, ...deletedVirtualExceptionIds, ...ids],
			masterIds: affectedMasterIds,
			user
		});
		return { success: true, deletedCount: eventIdsToDelete.length + deletedVirtualExceptionIds.length, revertedVirtualIds: [] as string[] };
	}
);


