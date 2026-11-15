import { parseSignUpClosureDate } from '#lib/utils/event-signup.js';
import { computeOccurrenceSignUpClosureDate } from './recurrence.js';

export interface VirtualInstanceDiffInput {
	master: {
		summary?: string | null;
		description?: string | null;
		internalNotes?: string | null;
		status?: string | null;
		categoryBerlinDotDe?: string | null;
		heroImage?: string | null;
		ticketPrice?: string | null;
		ticketPriceUnknown?: boolean | null;
		currency?: string | null;
		isAllDay?: boolean | null;
		isPublic?: boolean | null;
		guestsCanInviteOthers?: boolean | null;
		guestsCanModify?: boolean | null;
		guestsCanSeeOtherGuests?: boolean | null;
		participantsCount?: number | null;
		signUpMode?: string | null;
		signUpClosureDate?: Date | string | null;
		signUpContactId?: string | null;
		signUpContactOverridden?: boolean | null;
		prepMinutes?: number | null;
		teardownMinutes?: number | null;
		startDateTime?: Date | string | null;
		endDateTime?: Date | string | null;
		reminders?: any;
	};
	submitted: {
		summary?: string | null;
		description?: string | null;
		internalNotes?: string | null;
		status?: string | null;
		categoryBerlinDotDe?: string | null;
		heroImage?: string | null;
		ticketPrice?: string | null;
		ticketPriceUnknown?: boolean | string | null;
		currency?: string | null;
		isAllDay?: boolean | string | null;
		isPublic?: boolean | string | null;
		guestsCanInviteOthers?: boolean | string | null;
		guestsCanModify?: boolean | string | null;
		guestsCanSeeOtherGuests?: boolean | string | null;
		participantsCount?: number | string | null;
		signUpMode?: string | null;
		signUpClosureDate?: Date | string | null;
		signUpContactId?: string | null;
		signUpContactOverridden?: boolean | string | null;
		prepMinutes?: number | string | null;
		teardownMinutes?: number | string | null;
		reminders?: any;
	};
	targetStart: Date;
	targetEnd: Date;
	targetSignUpClosureDate?: Date | string | null;
	submittedStart?: Date | null;
	submittedEnd?: Date | null;
	associations?: {
		masterLocationIds?: string[];
		submittedLocationIds?: string[];
		masterResourceIds?: string[];
		submittedResourceIds?: string[];
		masterContactIds?: string[];
		submittedContactIds?: string[];
		masterContactRoles?: Record<string, string[]>;
		submittedContactRoles?: Record<string, string[]>;
		masterTags?: string[];
		submittedTags?: string[];
		masterSyncIds?: string[];
		submittedSyncIds?: string[];
		masterPriceIds?: string[];
		submittedPriceIds?: string[];
	};
}

const strNorm = (v: any) => (v === undefined || v === null ? '' : String(v)).trim();

/**
 * Compares a submitted update against the master event's inherited fields
 * for a virtual recurrence occurrence.
 * Returns true if ANY field or association has changed, signifying that
 * a real database exception should be created.
 * Returns false if all submitted values match the virtual instance defaults,
 * meaning no new exception row is needed.
 */
export function hasVirtualInstanceChanged(input: VirtualInstanceDiffInput): boolean {
	const { master, submitted, targetStart, targetEnd, submittedStart, submittedEnd, associations } = input;

	// Check dates and times (allow small tolerance for second/subsecond differences)
	if (submittedStart && Math.abs(submittedStart.getTime() - targetStart.getTime()) >= 1000) {
		return true;
	}
	if (submittedEnd && Math.abs(submittedEnd.getTime() - targetEnd.getTime()) >= 1000) {
		return true;
	}

	// Text and basic metadata
	if (submitted.summary !== undefined && strNorm(submitted.summary) !== strNorm(master.summary)) return true;
	if (submitted.description !== undefined && strNorm(submitted.description) !== strNorm(master.description)) return true;
	if (submitted.internalNotes !== undefined && strNorm(submitted.internalNotes) !== strNorm(master.internalNotes)) return true;
	if (submitted.status !== undefined && strNorm(submitted.status) !== strNorm(master.status)) return true;
	if (submitted.categoryBerlinDotDe !== undefined && strNorm(submitted.categoryBerlinDotDe) !== strNorm(master.categoryBerlinDotDe)) return true;
	if (submitted.heroImage !== undefined && strNorm(submitted.heroImage) !== strNorm(master.heroImage)) return true;

	// Pricing & participants
	if (submitted.ticketPrice !== undefined && strNorm(submitted.ticketPrice) !== strNorm(master.ticketPrice)) return true;
	if (submitted.ticketPriceUnknown !== undefined && Boolean(submitted.ticketPriceUnknown) !== Boolean(master.ticketPriceUnknown)) return true;
	if (submitted.currency !== undefined && strNorm(submitted.currency || 'EUR') !== strNorm(master.currency || 'EUR')) return true;
	if (submitted.participantsCount !== undefined && Number(submitted.participantsCount || 0) !== Number(master.participantsCount || 0)) return true;
	if (submitted.signUpMode !== undefined && strNorm(submitted.signUpMode || 'off') !== strNorm(master.signUpMode || 'off')) return true;
	if (submitted.signUpClosureDate !== undefined) {
		const normClosure = (v: Date | string | null | undefined) => parseSignUpClosureDate(v)?.getTime() ?? null;
		const expectedClosure =
			input.targetSignUpClosureDate !== undefined
				? input.targetSignUpClosureDate
				: master.signUpClosureDate;
		if (normClosure(submitted.signUpClosureDate) !== normClosure(expectedClosure)) return true;
	}
	if (submitted.signUpContactId !== undefined && strNorm(submitted.signUpContactId) !== strNorm(master.signUpContactId)) return true;
	if (submitted.signUpContactOverridden !== undefined) {
		const subOverridden = submitted.signUpContactOverridden === true || submitted.signUpContactOverridden === 'true' || submitted.signUpContactOverridden === 'on';
		if (subOverridden !== Boolean(master.signUpContactOverridden)) return true;
	}
	if (submitted.prepMinutes !== undefined && Number(submitted.prepMinutes || 0) !== Number(master.prepMinutes || 0)) return true;
	if (submitted.teardownMinutes !== undefined && Number(submitted.teardownMinutes || 0) !== Number(master.teardownMinutes || 0)) return true;

	// Booleans
	if (submitted.isAllDay !== undefined && Boolean(submitted.isAllDay) !== Boolean(master.isAllDay)) return true;
	if (submitted.isPublic !== undefined && Boolean(submitted.isPublic) !== Boolean(master.isPublic)) return true;
	if (submitted.guestsCanInviteOthers !== undefined && Boolean(submitted.guestsCanInviteOthers) !== Boolean(master.guestsCanInviteOthers)) return true;
	if (submitted.guestsCanModify !== undefined && Boolean(submitted.guestsCanModify) !== Boolean(master.guestsCanModify)) return true;
	if (submitted.guestsCanSeeOtherGuests !== undefined && Boolean(submitted.guestsCanSeeOtherGuests) !== Boolean(master.guestsCanSeeOtherGuests)) return true;

	// Reminders
	if (submitted.reminders !== undefined) {
		if (JSON.stringify(submitted.reminders || null) !== JSON.stringify(master.reminders || null)) {
			return true;
		}
	}

	// Associations
	if (associations) {
		const {
			masterLocationIds,
			submittedLocationIds,
			masterResourceIds,
			submittedResourceIds,
			masterContactIds,
			submittedContactIds,
			masterContactRoles,
			submittedContactRoles,
			masterTags,
			submittedTags,
			masterSyncIds,
			submittedSyncIds,
			masterPriceIds,
			submittedPriceIds,
		} = associations;

		if (submittedLocationIds !== undefined && masterLocationIds !== undefined) {
			const mSet = new Set(masterLocationIds);
			const sSet = new Set(submittedLocationIds);
			if (mSet.size !== sSet.size || [...mSet].some(id => !sSet.has(id))) return true;
		}

		if (submittedResourceIds !== undefined && masterResourceIds !== undefined) {
			const mSet = new Set(masterResourceIds);
			const sSet = new Set(submittedResourceIds);
			if (mSet.size !== sSet.size || [...mSet].some(id => !sSet.has(id))) return true;
		}

		if (submittedContactIds !== undefined && masterContactIds !== undefined) {
			const mSet = new Set(masterContactIds);
			const sSet = new Set(submittedContactIds);
			if (mSet.size !== sSet.size || [...mSet].some(id => !sSet.has(id))) return true;
		}

		if (submittedContactRoles !== undefined && masterContactRoles !== undefined) {
			const mKeys = Object.keys(masterContactRoles);
			const sKeys = Object.keys(submittedContactRoles);
			if (mKeys.length !== sKeys.length) return true;
			for (const key of mKeys) {
				const mRoles = new Set(masterContactRoles[key] || []);
				const sRoles = new Set(submittedContactRoles[key] || []);
				if (mRoles.size !== sRoles.size || [...mRoles].some(r => !sRoles.has(r))) return true;
			}
		}

		if (submittedTags !== undefined && masterTags !== undefined) {
			const mSet = new Set(masterTags.filter(n => n !== 'Series'));
			const sSet = new Set(submittedTags.filter(n => n !== 'Series'));
			if (mSet.size !== sSet.size || [...mSet].some(n => !sSet.has(n))) return true;
		}

		if (submittedSyncIds !== undefined && masterSyncIds !== undefined) {
			const mSet = new Set(masterSyncIds);
			const sSet = new Set(submittedSyncIds);
			if (mSet.size !== sSet.size || [...mSet].some(id => !sSet.has(id))) return true;
		}

		if (submittedPriceIds !== undefined && masterPriceIds !== undefined) {
			const mSet = new Set(masterPriceIds);
			const sSet = new Set(submittedPriceIds);
			if (mSet.size !== sSet.size || [...mSet].some(id => !sSet.has(id))) return true;
		}
	}

	return false;
}

import { db, event, eventLocation, eventResource, eventContact, eventContactRole, eventTag, eventPrice, emailCampaign, syncMapping, campaign, announcement, eq, and, or, inArray, sql } from '@ac/db';
import { parseVirtualInstanceId, isVirtualInstanceId } from '#lib/utils/event-series.js';
import { syncService } from '#lib/server/sync/service.js';
import { getStorageProvider } from '#lib/server/blob-storage/index.js';
import { publishEventChange } from '#lib/server/realtime.js';
import { invalidateEvent } from '#lib/server/cache/index.js';
import { restoreInventoryForEvents } from './sales.js';

/**
 * Resolves an event entityId for associations.
 * If entityId is a virtual instance (${masterId}_inst_${iso}):
 * - Checks if an exception row already exists in Postgres. If so, returns the exception's UUID.
 * - If not, and materializeIfVirtual is false (e.g. for queries), returns the master's UUID so associations are read.
 * - If not, and materializeIfVirtual is true (e.g. for mutations), materializes an exception row, copies all master associations, and returns the new exception's UUID.
 */
export async function resolveEventIdForAssociations(
	eventId: string,
	options?: { materializeIfVirtual?: boolean; userId?: string }
): Promise<string> {
	if (!eventId.includes('_inst_')) {
		return eventId;
	}

	const parsed = parseVirtualInstanceId(eventId);
	if (!parsed) {
		return eventId;
	}

	const { masterId, iso } = parsed;
	const occurrenceTime = new Date(iso);
	const instIso = eventId.split('_inst_')[1];
	const decodedIso = iso;

	// Look for existing exception
	const existing = await db.query.event.findFirst({
		where: and(
			eq(event.recurringEventId, masterId),
			or(
				sql`${event.originalStartTime}->>'dateTime' = ${instIso}`,
				sql`${event.originalStartTime}->>'dateTime' = ${decodedIso}`
			)
		)
	});

	if (existing) {
		return existing.id;
	}

	if (!options?.materializeIfVirtual) {
		// Just querying associations, inherit from master ID
		return masterId;
	}

	// Materialize exception in Postgres
	const master = await db.query.event.findFirst({
		where: eq(event.id, masterId)
	});

	if (!master) {
		throw new Error('Master event not found');
	}

	const targetStart = occurrenceTime;
	const duration = (master.startDateTime && master.endDateTime)
		? (new Date(master.endDateTime).getTime() - new Date(master.startDateTime).getTime())
		: 3600000;
	const targetEnd = new Date(targetStart.getTime() + duration);
	const targetSignUpClosureDate = master.signUpMode === 'required'
		? computeOccurrenceSignUpClosureDate({
				masterStart: master.startDateTime,
				masterClosureDate: master.signUpClosureDate,
				signUpRecurrence: master.signUpRecurrence,
				occurrenceStart: targetStart,
				timeZone: master.startTimeZone
			})
		: master.signUpClosureDate;

	const { id: _, createdAt: _c, updatedAt: _u, ...masterRest } = master;
	const [created] = await db.insert(event).values({
		...masterRest,
		recurringEventId: masterId,
		originalStartTime: { dateTime: decodedIso },
		isException: true,
		recurrence: null,
		signUpRecurrence: null,
		signUpClosureDate: targetSignUpClosureDate,
		seriesId: null,
		startDateTime: targetStart,
		endDateTime: targetEnd,
		userId: options?.userId || master.userId
	}).returning();

	// Copy master's associations to the new exception
	const masterLocs = await db.select().from(eventLocation).where(eq(eventLocation.eventId, masterId));
	if (masterLocs.length > 0) {
		await db.insert(eventLocation).values(
			masterLocs.map(l => ({ eventId: created.id, locationId: l.locationId }))
		);
	}

	const masterRess = await db.select().from(eventResource).where(eq(eventResource.eventId, masterId));
	if (masterRess.length > 0) {
		await db.insert(eventResource).values(
			masterRess.map(r => ({ eventId: created.id, resourceId: r.resourceId }))
		);
	}

	const masterCtcs = await db.select().from(eventContact).where(eq(eventContact.eventId, masterId));
	if (masterCtcs.length > 0) {
		await db.insert(eventContact).values(
			masterCtcs.map(c => ({
				eventId: created.id,
				contactId: c.contactId,
				participationStatus: c.participationStatus,
				partySize: c.partySize ?? 1,
				notifyOnChanges: c.notifyOnChanges,
				newsletterSubscribed: c.newsletterSubscribed
			}))
		);
	}

	const masterContactRoles = await db.select().from(eventContactRole).where(eq(eventContactRole.eventId, masterId));
	if (masterContactRoles.length > 0) {
		await db.insert(eventContactRole).values(
			masterContactRoles.map(cr => ({ eventId: created.id, contactId: cr.contactId, roleId: cr.roleId }))
		);
	}

	const masterTags = await db.select().from(eventTag).where(eq(eventTag.eventId, masterId));
	if (masterTags.length > 0) {
		await db.insert(eventTag).values(
			masterTags.map(t => ({ eventId: created.id, tagId: t.tagId }))
		);
	}

	const masterPrices = await db.select().from(eventPrice).where(eq(eventPrice.eventId, masterId));
	if (masterPrices.length > 0) {
		await db.insert(eventPrice).values(
			masterPrices.map(p => ({ eventId: created.id, priceId: p.priceId }))
		);
	}

	return created.id;
}

function extractExceptionSlotIso(row: {
	originalStartTime?: any;
	startDateTime?: Date | string | null;
}): { rawIso: string; canonicalIso: string; timestamp: number | null } | null {
	const origDateTime =
		row.originalStartTime && typeof row.originalStartTime === 'object' && 'dateTime' in row.originalStartTime
			? row.originalStartTime.dateTime
			: null;

	let rawIso: string | null = null;
	if (typeof origDateTime === 'string' && origDateTime.trim()) {
		rawIso = origDateTime.trim();
	} else if (row.startDateTime) {
		const dt = row.startDateTime instanceof Date ? row.startDateTime : new Date(row.startDateTime);
		if (!Number.isNaN(dt.getTime())) {
			rawIso = dt.toISOString();
		}
	}

	if (!rawIso) return null;
	const parsed = new Date(rawIso);
	const ts = parsed.getTime();
	return {
		rawIso,
		canonicalIso: Number.isNaN(ts) ? rawIso : parsed.toISOString(),
		timestamp: Number.isNaN(ts) ? null : ts
	};
}

export interface RevertExceptionsResult {
	deletedIds: string[];
	affectedMasterIds: string[];
	revertedVirtualIds: string[];
}

/**
 * Deletes materialized series exception row(s) so each occurrence reverts back to
 * a standard virtual instance of its master series without adding master exdates.
 * Performs full cleanup of sync mappings, storage assets, lazy references, deducted
 * inventory, orphaned campaigns, caches, and triggers master re-sync.
 */
export async function revertMaterializedExceptions(params: {
	userId: string;
	eventIds: string[];
}): Promise<RevertExceptionsResult> {
	const { userId, eventIds } = params;
	if (!eventIds || eventIds.length === 0) {
		return { deletedIds: [], affectedMasterIds: [], revertedVirtualIds: [] };
	}

	const realIds = new Set<string>();
	for (const id of eventIds) {
		if (!id) continue;
		if (!isVirtualInstanceId(id)) {
			realIds.add(id);
			continue;
		}
		// Resolve virtual ID to an existing materialized exception if one already exists
		const parsed = parseVirtualInstanceId(id);
		if (!parsed) continue;
		const instIso = id.split('_inst_')[1];
		const existing = await db.query.event.findFirst({
			where: and(
				eq(event.recurringEventId, parsed.masterId),
				or(
					sql`${event.originalStartTime}->>'dateTime' = ${instIso}`,
					sql`${event.originalStartTime}->>'dateTime' = ${parsed.iso}`
				)
			)
		});
		if (existing) {
			realIds.add(existing.id);
		}
	}

	const candidateIds = Array.from(realIds);
	if (candidateIds.length === 0) {
		return { deletedIds: [], affectedMasterIds: [], revertedVirtualIds: [] };
	}

	const candidateRows = await db
		.select({
			id: event.id,
			recurringEventId: event.recurringEventId,
			campaignId: event.campaignId,
			qrCodePath: event.qrCodePath,
			iCalPath: event.iCalPath,
			startDateTime: event.startDateTime,
			originalStartTime: event.originalStartTime,
			isException: event.isException
		})
		.from(event)
		.where(inArray(event.id, candidateIds));

	const exceptions = candidateRows.filter((row) =>
		Boolean(row.recurringEventId && (row.isException || row.originalStartTime))
	);
	if (exceptions.length === 0) {
		return { deletedIds: [], affectedMasterIds: [], revertedVirtualIds: [] };
	}

	const exceptionIds = exceptions.map((e) => e.id);
	const affectedMasterIdSet = new Set<string>();
	const candidateCampaignIds = new Set<string>();
	const revertedVirtualIds: string[] = [];
	const slotsByMaster = new Map<string, { rawIsos: Set<string>; timestamps: Set<number> }>();

	for (const exc of exceptions) {
		const masterId = exc.recurringEventId!;
		affectedMasterIdSet.add(masterId);
		if (exc.campaignId) {
			candidateCampaignIds.add(exc.campaignId);
		}
		const slot = extractExceptionSlotIso(exc);
		if (slot) {
			revertedVirtualIds.push(`${masterId}_inst_${slot.canonicalIso}`);
			let entry = slotsByMaster.get(masterId);
			if (!entry) {
				entry = { rawIsos: new Set<string>(), timestamps: new Set<number>() };
				slotsByMaster.set(masterId, entry);
			}
			entry.rawIsos.add(slot.rawIso);
			entry.rawIsos.add(slot.canonicalIso);
			if (slot.timestamp !== null) {
				entry.timestamps.add(slot.timestamp);
			}
		}
	}

	const affectedMasterIds = Array.from(affectedMasterIdSet);

	// 1. Restore any inventory deducted for sales linked to these exceptions before cascade deletion
	await restoreInventoryForEvents(exceptionIds);

	// 2. Clean up external blob storage assets
	const storage = getStorageProvider();
	for (const exc of exceptions) {
		if (exc.qrCodePath?.startsWith('http')) await storage.delete(exc.qrCodePath).catch(() => {});
		if (exc.iCalPath?.startsWith('http')) await storage.delete(exc.iCalPath).catch(() => {});
	}

	// 3. Delete external provider mappings & campaign sync entries BEFORE deleting local rows/relations
	await syncService.deleteEventMappings(userId, exceptionIds).catch(console.error);

	// 4. Clean up lazy / non-FK references to these exception IDs
	await db.delete(emailCampaign).where(inArray(emailCampaign.eventId, exceptionIds));
	await db.delete(syncMapping).where(inArray(syncMapping.eventId, exceptionIds));

	// 5. Ensure restored slots are not suppressed by master.exdates (never add exdates)
	for (const [masterId, slotInfo] of slotsByMaster) {
		const [master] = await db
			.select({ id: event.id, exdates: event.exdates })
			.from(event)
			.where(eq(event.id, masterId));
		if (master && Array.isArray(master.exdates) && master.exdates.length > 0) {
			const existingExdates = master.exdates as string[];
			const filtered = existingExdates.filter((ex) => {
				if (slotInfo.rawIsos.has(ex)) return false;
				const exTs = new Date(ex).getTime();
				if (!Number.isNaN(exTs) && slotInfo.timestamps.has(exTs)) return false;
				return true;
			});
			if (filtered.length !== existingExdates.length) {
				await db.update(event).set({ exdates: filtered }).where(eq(event.id, master.id));
			}
		}
	}

	// 6. Delete local exception rows (FK cascades clean up join tables & prices/sales)
	await db.delete(event).where(inArray(event.id, exceptionIds));

	// 7. Remove any orphaned campaign rows previously owned exclusively by deleted exceptions
	for (const campId of candidateCampaignIds) {
		const remainingEvents = await db
			.select({ id: event.id })
			.from(event)
			.where(eq(event.campaignId, campId));
		if (remainingEvents.length > 0) continue;

		const remainingAnnouncements = await db
			.select({ id: announcement.id })
			.from(announcement)
			.where(eq(announcement.campaignId, campId));
		if (remainingAnnouncements.length > 0) continue;

		await db.delete(campaign).where(eq(campaign.id, campId));
	}

	// 8. Re-sync affected masters so non-native recurrence providers restore the standard instance
	for (const masterId of affectedMasterIds) {
		await syncService.syncItems(userId, [masterId], 'event').catch(console.error);
	}

	// 9. Notify subscribers and invalidate cached event/list entries
	await publishEventChange('delete', exceptionIds).catch(console.error);
	if (affectedMasterIds.length > 0) {
		await publishEventChange('update', affectedMasterIds).catch(console.error);
	}
	await invalidateEvent([...exceptionIds, ...affectedMasterIds, ...revertedVirtualIds]);

	return {
		deletedIds: exceptionIds,
		affectedMasterIds,
		revertedVirtualIds
	};
}


