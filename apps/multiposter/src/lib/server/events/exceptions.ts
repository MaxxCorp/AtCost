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
		isAllDay?: boolean | null;
		isPublic?: boolean | null;
		guestsCanInviteOthers?: boolean | null;
		guestsCanModify?: boolean | null;
		guestsCanSeeOtherGuests?: boolean | null;
		participantsCount?: number | null;
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
		isAllDay?: boolean | string | null;
		isPublic?: boolean | string | null;
		guestsCanInviteOthers?: boolean | string | null;
		guestsCanModify?: boolean | string | null;
		guestsCanSeeOtherGuests?: boolean | string | null;
		participantsCount?: number | string | null;
		reminders?: any;
	};
	targetStart: Date;
	targetEnd: Date;
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
		masterMenuIds?: string[];
		submittedMenuIds?: string[];
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
	if (submitted.participantsCount !== undefined && Number(submitted.participantsCount || 0) !== Number(master.participantsCount || 0)) return true;

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
			masterMenuIds,
			submittedMenuIds,
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

		if (submittedMenuIds !== undefined && masterMenuIds !== undefined) {
			const mSet = new Set(masterMenuIds);
			const sSet = new Set(submittedMenuIds);
			if (mSet.size !== sSet.size || [...mSet].some(id => !sSet.has(id))) return true;
		}
	}

	return false;
}

import { db, event, eventLocation, eventResource, eventContact, eventContactRole, eventTag, eventMenu, eq, and, or, sql } from '@ac/db';
import { parseVirtualInstanceId } from '#lib/utils/event-series.js';

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

	const { id: _, createdAt: _c, updatedAt: _u, ...masterRest } = master;
	const [created] = await db.insert(event).values({
		...masterRest,
		recurringEventId: masterId,
		originalStartTime: { dateTime: decodedIso },
		isException: true,
		recurrence: null,
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
			masterCtcs.map(c => ({ eventId: created.id, contactId: c.contactId, participationStatus: c.participationStatus }))
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

	const masterMenus = await db.select().from(eventMenu).where(eq(eventMenu.eventId, masterId));
	if (masterMenus.length > 0) {
		await db.insert(eventMenu).values(
			masterMenus.map(m => ({ eventId: created.id, menuId: m.menuId }))
		);
	}

	return created.id;
}

