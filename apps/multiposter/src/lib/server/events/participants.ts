import { event, eventContact, eq, inArray, sql } from '@ac/db';
import { getContactHeadcount } from '#lib/utils/participants.js';

/**
 * Applies a relative participant count delta to an event row,
 * avoiding negative SQL bind parameters and clamping at 0.
 */
export async function applyEventParticipantsDelta(
	client: any,
	targetEventId: string,
	delta: number
): Promise<void> {
	const truncated = Math.trunc(delta);
	if (!Number.isFinite(truncated) || truncated === 0) {
		return;
	}

	await client
		.update(event)
		.set({
			participantsCount:
				truncated > 0
					? sql`${event.participantsCount} + ${truncated}`
					: sql`GREATEST(0, ${event.participantsCount} - ${Math.abs(truncated)})`,
			updatedAt: new Date(),
		})
		.where(eq(event.id, targetEventId));
}

/**
 * Sums the effective participant headcount from `eventContact` rows on an event.
 */
export async function getStoredEventContactsHeadcount(
	client: any,
	targetEventId: string
): Promise<number> {
	const rows = await client
		.select({
			partySize: eventContact.partySize,
			participationStatus: eventContact.participationStatus,
		})
		.from(eventContact)
		.where(eq(eventContact.eventId, targetEventId));

	return rows.reduce((sum: number, row: any) => sum + getContactHeadcount(row), 0);
}

/**
 * Groups the effective headcount contributed by `contactIds` per `eventId`.
 * Used before deleting contacts so linked events decrement cleanly.
 */
export async function getEventHeadcountsByContactIds(
	client: any,
	contactIds: string[]
): Promise<Map<string, number>> {
	const totals = new Map<string, number>();
	if (contactIds.length === 0) return totals;

	const assocs = await client
		.select({
			eventId: eventContact.eventId,
			partySize: eventContact.partySize,
			participationStatus: eventContact.participationStatus,
		})
		.from(eventContact)
		.where(inArray(eventContact.contactId, contactIds));

	for (const assoc of assocs) {
		const headcount = getContactHeadcount(assoc);
		if (headcount > 0) {
			totals.set(assoc.eventId, (totals.get(assoc.eventId) ?? 0) + headcount);
		}
	}

	return totals;
}

/**
 * Ensures an event's stored `participantsCount` is consistent with its linked
 * contacts after a create/update mutation.
 */
export async function reconcileEventParticipantsCount(
	client: any,
	targetEventId: string,
	options: {
		submittedCount?: unknown;
		previousContactsHeadcount?: number;
	}
): Promise<void> {
	const actualHeadcount = await getStoredEventContactsHeadcount(client, targetEventId);

	if (options.submittedCount !== undefined && options.submittedCount !== null && options.submittedCount !== '') {
		const parsed = Math.max(0, Math.trunc(Number(options.submittedCount) || 0));
		const nextCount = Math.max(actualHeadcount, parsed);
		await client
			.update(event)
			.set({ participantsCount: nextCount, updatedAt: new Date() })
			.where(eq(event.id, targetEventId));
		return;
	}

	if (options.previousContactsHeadcount !== undefined) {
		const delta = actualHeadcount - options.previousContactsHeadcount;
		if (delta !== 0) {
			await applyEventParticipantsDelta(client, targetEventId, delta);
		}
		// Ensure participantsCount never falls below actual active contacts
		const [evtRow] = await client
			.select({ participantsCount: event.participantsCount })
			.from(event)
			.where(eq(event.id, targetEventId));
		if (evtRow && (evtRow.participantsCount ?? 0) < actualHeadcount) {
			await client
				.update(event)
				.set({ participantsCount: actualHeadcount, updatedAt: new Date() })
				.where(eq(event.id, targetEventId));
		}
	}
}
