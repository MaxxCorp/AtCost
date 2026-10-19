import { command, requested } from '$app/server';
import { db, event } from '@ac/db';
import { inArray, eq, and, or, sql } from '@ac/db';
import { listEvents } from './list.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { syncService } from '#lib/server/sync/service.js';
import { publishEventChange } from '#lib/server/realtime.js';
import { invalidateEvent } from '#lib/server/cache/index.js';
import { updateEventsStatusSchema } from '#lib/validations/events.js';

export const updateEventsStatus = command(
	updateEventsStatusSchema,
	async ({ ids, status, updateSeries }) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'events');

		if (ids.length === 0) return { success: true, count: 0 };

		const virtualIds = ids.filter((id) => id.includes('_inst_'));
		const realIds = ids.filter((id) => !id.includes('_inst_'));

		const affectedEventIds: string[] = [];
		const affectedMasterIds = new Set<string>();

		if (updateSeries) {
			for (const vId of virtualIds) {
				const [masterId] = vId.split('_inst_');
				if (masterId && !realIds.includes(masterId)) {
					realIds.push(masterId);
				}
			}
		} else {
			for (const vId of virtualIds) {
				const [masterId, isoDate] = vId.split('_inst_');
				if (!masterId || !isoDate) continue;
				affectedMasterIds.add(masterId);
				const decodedIso = decodeURIComponent(isoDate);

				const [existingException] = await db
					.select()
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
					await db
						.update(event)
						.set({ status, updatedAt: new Date(), userId: user.id })
						.where(eq(event.id, existingException.id));
					affectedEventIds.push(existingException.id);
				} else {
					const [master] = await db.select().from(event).where(eq(event.id, masterId));
					if (master) {
						const targetStart = new Date(decodedIso);
						const duration =
							master.startDateTime && master.endDateTime
								? new Date(master.endDateTime).getTime() - new Date(master.startDateTime).getTime()
								: 3600000;
						const targetEnd = new Date(targetStart.getTime() + duration);

						const [newException] = await db
							.insert(event)
							.values({
								userId: user.id,
								summary: master.summary,
								description: master.description,
								internalNotes: master.internalNotes,
								startDateTime: targetStart,
								startTimeZone: master.startTimeZone,
								endDateTime: targetEnd,
								endTimeZone: master.endTimeZone,
								isAllDay: master.isAllDay,
								status,
								recurringEventId: master.id,
								originalStartTime: { dateTime: decodedIso },
								isException: true,
								isPublic: master.isPublic,
								ticketPrice: master.ticketPrice,
								ticketPriceUnknown: master.ticketPriceUnknown,
								categoryBerlinDotDe: master.categoryBerlinDotDe,
							})
							.returning();
						affectedEventIds.push(newException.id);
					}
				}
			}
		}

		if (realIds.length > 0) {
			const targetEvents = await db.query.event.findMany({
				where: (table, { inArray }) => inArray(table.id, realIds),
				columns: { id: true, recurringEventId: true, seriesId: true },
			});

			if (updateSeries) {
				const masterIds = [...new Set(targetEvents.map((e) => e.recurringEventId || e.id))];

				await db
					.update(event)
					.set({ status, updatedAt: new Date(), userId: user.id })
					.where(inArray(event.id, masterIds));

				await db
					.update(event)
					.set({ status, updatedAt: new Date(), userId: user.id })
					.where(inArray(event.recurringEventId, masterIds));

				const childInstances = await db
					.select({ id: event.id })
					.from(event)
					.where(inArray(event.recurringEventId, masterIds));

				affectedEventIds.push(...masterIds, ...childInstances.map((c) => c.id));
				for (const mId of masterIds) {
					affectedMasterIds.add(mId);
				}
			} else {
				await db
					.update(event)
					.set({ status, updatedAt: new Date(), userId: user.id })
					.where(inArray(event.id, realIds));

				affectedEventIds.push(...realIds);
				for (const e of targetEvents) {
					affectedMasterIds.add(e.recurringEventId || e.id);
				}
			}
		}

		if (affectedEventIds.length > 0) {
			await invalidateEvent(affectedEventIds);
			await publishEventChange('update', affectedEventIds).catch(console.error);
		}

		for (const mId of affectedMasterIds) {
			await syncService.syncItems(user.id, [mId], 'event').catch(console.error);
		}

		try {
			await requested(listEvents, 20).refreshAll();
		} catch (e) {
			console.warn('[updateEventsStatus] requested refresh warning:', e);
		}
		try {
			await listEvents().refresh();
		} catch (e) {
			console.warn('[updateEventsStatus] listEvents refresh warning:', e);
		}

		return { success: true, count: affectedEventIds.length };
	}
);
