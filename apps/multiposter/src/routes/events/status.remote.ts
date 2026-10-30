import { command, requested } from '$app/server';
import { db, event, eventLocation, eventResource, eventContact, eventContactRole, eventTag, eventPrice, campaign } from '@ac/db';
import { inArray, eq, and, or, sql } from '@ac/db';
import { listEvents } from './list.remote';
import { readEvent } from './[id]/read.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { syncService } from '#lib/server/sync/service.js';
import { publishEventChange } from '#lib/server/realtime.js';
import { invalidateEvent } from '#lib/server/cache/index.js';
import { updateEventsStatusSchema } from '#lib/validations/events.js';
import type { CampaignContent } from '@ac/validations';

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
								heroImage: master.heroImage,
								startDateTime: targetStart,
								startTimeZone: master.startTimeZone,
								endDateTime: targetEnd,
								endTimeZone: master.endTimeZone,
								isAllDay: master.isAllDay,
								status,
								campaignId: master.campaignId,
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

						// Copy associations from master
						const masterLocs = await db.select().from(eventLocation).where(eq(eventLocation.eventId, masterId));
						if (masterLocs.length > 0) {
							await db.insert(eventLocation).values(masterLocs.map((l) => ({ eventId: newException.id, locationId: l.locationId })));
						}
						const masterRess = await db.select().from(eventResource).where(eq(eventResource.eventId, masterId));
						if (masterRess.length > 0) {
							await db.insert(eventResource).values(masterRess.map((r) => ({ eventId: newException.id, resourceId: r.resourceId })));
						}
						const masterCtcs = await db.select().from(eventContact).where(eq(eventContact.eventId, masterId));
						if (masterCtcs.length > 0) {
							await db.insert(eventContact).values(masterCtcs.map((c) => ({ eventId: newException.id, contactId: c.contactId, participationStatus: c.participationStatus })));
						}
						const masterRoles = await db.select().from(eventContactRole).where(eq(eventContactRole.eventId, masterId));
						if (masterRoles.length > 0) {
							await db.insert(eventContactRole).values(masterRoles.map((r) => ({ eventId: newException.id, contactId: r.contactId, roleId: r.roleId })));
						}
						const masterTags = await db.select().from(eventTag).where(eq(eventTag.eventId, masterId));
						if (masterTags.length > 0) {
							await db.insert(eventTag).values(masterTags.map((t) => ({ eventId: newException.id, tagId: t.tagId })));
						}
						const masterPrices = await db.select().from(eventPrice).where(eq(eventPrice.eventId, masterId));
						if (masterPrices.length > 0) {
							await db.insert(eventPrice).values(masterPrices.map((m) => ({ eventId: newException.id, priceId: m.priceId })));
						}

						// Migrate campaign sync state if master has campaign
						if (master.campaignId) {
							const [camp] = await db.select().from(campaign).where(eq(campaign.id, master.campaignId));
							if (camp && (camp.content as any)?.version === 1) {
								const cContent = camp.content as CampaignContent;
								const candidateVids = [vId, `${masterId}_inst_${decodedIso}`, `${masterId}_inst_${new Date(decodedIso).toISOString()}`];
								let foundVid: string | null = null;
								for (const cVid of candidateVids) {
									if (cContent.items?.[cVid]?.syncs) {
										foundVid = cVid;
										break;
									}
								}
								if (foundVid && cContent.items?.[foundVid]) {
									if (!cContent.items) cContent.items = {};
									cContent.items[newException.id] = {
										entityType: 'event',
										syncs: { ...cContent.items[foundVid].syncs }
									};
									if (cContent.externalIds) {
										for (const [extId, mapping] of Object.entries(cContent.externalIds)) {
											if (mapping.itemId === foundVid) {
												mapping.itemId = newException.id;
											}
										}
									}
									delete cContent.items[foundVid];
									await db.update(campaign).set({ content: cContent, updatedAt: new Date() }).where(eq(campaign.id, camp.id));
								}
							}
						}
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

		const syncTargets = [...new Set([...affectedEventIds, ...affectedMasterIds])];
		for (const targetId of syncTargets) {
			await syncService.syncItems(user.id, [targetId], 'event').catch(console.error);
		}

		try {
			await requested(listEvents, 20).refreshAll();
		} catch (e) {
			console.warn('[updateEventsStatus] requested refresh warning:', e);
		}
		try {
			await requested(readEvent, 20).refreshAll();
		} catch { /* ignore */ }
		for (const id of [...new Set([...affectedEventIds, ...ids])]) {
			void readEvent(id).refresh();
		}
		void listEvents().refresh();
		void listEvents({}).refresh();

		return { success: true, count: affectedEventIds.length };
	}
);
