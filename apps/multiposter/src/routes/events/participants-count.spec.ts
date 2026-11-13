import { describe, it, expect, vi } from 'vitest';
import * as v from 'valibot';
import { eventBaseSchema } from '#lib/validations/events.js';
import {
	createParticipantState,
	getContactHeadcount,
	extractContactParticipantState,
	computeInitialBaseline,
} from '#lib/utils/participants.js';
import {
	applyEventParticipantsDelta,
	getStoredEventContactsHeadcount,
	getEventHeadcountsByContactIds,
	reconcileEventParticipantsCount,
} from '#lib/server/events/participants.js';

describe('Participants count calculation and synchronization algorithm', () => {
	it('initializes with 0 for a new event with no contacts', () => {
		const state = createParticipantState(undefined, [], []);
		expect(state.getTotal()).toBe(0);
		expect(state.getBaseline()).toBe(0);
		expect(state.getContactsHeadcount()).toBe(0);
	});

	it('initializes with contacts count when participantsCount was not explicitly set', () => {
		const state = createParticipantState(undefined, [], ['c1', 'c2']);
		expect(state.getBaseline()).toBe(0);
		expect(state.getTotal()).toBe(2);
	});

	it('calculates baseline from existing participantsCount and contactIds', () => {
		const state = createParticipantState(5, [], ['c1', 'c2']);
		expect(state.getBaseline()).toBe(3); // 5 - 2 = 3
		expect(state.getTotal()).toBe(5);
	});

	it('computes baseline = 0 when initial contacts carry partySize > 1 (self sign-up case)', () => {
		// Regression test: previously initialContactsHeadcount counted string IDs as 1 each,
		// inflating baseline to 4 and causing total to stay > 0 after unlinking.
		const state = createParticipantState(
			5,
			[{ id: 'c1', partySize: 5, participationStatus: 'accepted' }],
			['c1']
		);
		expect(state.getContactsHeadcount()).toBe(5);
		expect(state.getBaseline()).toBe(0);
		expect(state.getTotal()).toBe(5);

		// Unlinking the self-signed-up party of 5 drops total cleanly to 0
		state.unlinkContact('c1');
		expect(state.getContactsHeadcount()).toBe(0);
		expect(state.getTotal()).toBe(0);
	});

	it('supports EntityManager de-association via setContactsFromManager without phantom remainder', () => {
		const state = createParticipantState(
			7,
			[
				{ contact: { id: 'c1' }, partySize: 4, participationStatus: 'accepted' },
				{ contact: { id: 'c2' }, partySize: 1, participationStatus: 'needsAction' },
			],
			['c1', 'c2']
		);
		// Baseline is 7 - (4 + 1) = 2
		expect(state.getBaseline()).toBe(2);
		expect(state.getTotal()).toBe(7);

		// De-associate c1 -> drops by 4 down to 3
		state.setContactsFromManager(['c2'], [{ id: 'c2', partySize: 1, participationStatus: 'needsAction' }]);
		expect(state.getTotal()).toBe(3);

		// Re-add c3 with partySize 2 -> increases to 5
		state.setContactsFromManager(
			['c2', 'c3'],
			[
				{ id: 'c2', partySize: 1, participationStatus: 'needsAction' },
				{ id: 'c3', partySize: 2, participationStatus: 'accepted' },
			]
		);
		expect(state.getTotal()).toBe(5);
	});

	it('decreases total when partySize is reduced and increases when raised', () => {
		const state = createParticipantState(
			6,
			[{ id: 'c1', partySize: 6, participationStatus: 'accepted' }],
			['c1']
		);
		expect(state.getTotal()).toBe(6);

		state.setPartySize('c1', 2);
		expect(state.getContactsHeadcount()).toBe(2);
		expect(state.getTotal()).toBe(2);

		state.setPartySize('c1', 4);
		expect(state.getTotal()).toBe(4);
	});

	it('counts declined contacts as 0 and restores partySize when un-declined', () => {
		const state = createParticipantState(
			3,
			[
				{ id: 'c1', partySize: 3, participationStatus: 'declined' },
				{ id: 'c2', partySize: 2, participationStatus: 'accepted' },
			],
			['c1', 'c2']
		);
		// c1 is declined (0) + c2 accepted (2) => headcount 2, baseline = 3 - 2 = 1
		expect(state.getContactsHeadcount()).toBe(2);
		expect(state.getBaseline()).toBe(1);
		expect(state.getTotal()).toBe(3);

		// Un-decline c1 -> adds all 3 spots
		state.setParticipationStatus('c1', 'accepted');
		expect(state.getTotal()).toBe(6);

		// Decline c2 -> removes 2 spots
		state.setParticipationStatus('c2', 'declined');
		expect(state.getTotal()).toBe(4);
	});

	it('increases and decreases total count when linking/unlinking contacts', () => {
		const state = createParticipantState(5, [], ['c1', 'c2']);
		state.linkContact({ id: 'c3', partySize: 3 });
		expect(state.getContactIds()).toHaveLength(3);
		expect(state.getBaseline()).toBe(3);
		expect(state.getTotal()).toBe(8);

		state.unlinkContact('c1');
		expect(state.getContactIds()).toHaveLength(2);
		expect(state.getBaseline()).toBe(3);
		expect(state.getTotal()).toBe(7);

		state.unlinkContact('c3');
		expect(state.getTotal()).toBe(4);
	});

	it('shifts baseline with addition (+) and subtraction (-) buttons, flooring baseline at 0', () => {
		const state = createParticipantState(4, [], ['c1', 'c2']);
		expect(state.getBaseline()).toBe(2);
		expect(state.getTotal()).toBe(4);

		state.shiftBaseline(-1);
		expect(state.getBaseline()).toBe(1);
		expect(state.getTotal()).toBe(3);

		state.shiftBaseline(-1);
		expect(state.getBaseline()).toBe(0);
		expect(state.getTotal()).toBe(2);

		state.shiftBaseline(-1);
		expect(state.getBaseline()).toBe(0);
		expect(state.getTotal()).toBe(2);

		state.shiftBaseline(1);
		expect(state.getBaseline()).toBe(1);
		expect(state.getTotal()).toBe(3);
	});

	it('adapts baseline when manual total is input and clamps below contactsHeadcount', () => {
		const state = createParticipantState(
			2,
			[{ id: 'c1', partySize: 2, participationStatus: 'accepted' }],
			['c1']
		);
		state.setManualTotal(10);
		expect(state.getBaseline()).toBe(8);
		expect(state.getTotal()).toBe(10);

		state.unlinkContact('c1');
		expect(state.getTotal()).toBe(8);

		// Adding back c2 (partySize 3), trying manual total 1 clamps baseline to 0 and total to 3
		state.linkContact({ id: 'c2', partySize: 3 });
		state.setManualTotal(1);
		expect(state.getBaseline()).toBe(0);
		expect(state.getTotal()).toBe(3);
	});

	it('handles helper edge cases for getContactHeadcount and extractContactParticipantState', () => {
		expect(getContactHeadcount('c1')).toBe(1);
		expect(getContactHeadcount({ partySize: 0, participationStatus: 'accepted' })).toBe(1);
		expect(getContactHeadcount({ partySize: 4, participationStatus: 'declined' })).toBe(0);
		expect(getContactHeadcount({ contact: { id: 'c1', partySize: 3, participationStatus: 'tentative' } })).toBe(3);

		const extracted = extractContactParticipantState(
			[{ contact: { id: 'c1' }, partySize: 4, participationStatus: 'accepted' }],
			['c1', 'c2']
		);
		expect(extracted.contactIds).toEqual(['c1', 'c2']);
		expect(extracted.partySizes).toEqual({ c1: 4, c2: 1 });
		expect(computeInitialBaseline('6', [{ id: 'c1', partySize: 4 }], ['c1', 'c2'])).toBe(1);
	});
});

describe('Server event participant helpers', () => {
	function createMockDb(rows: any[] = []) {
		const updates: any[] = [];
		const db = {
			updates,
			update: vi.fn(() => ({
				set: vi.fn((values: any) => ({
					where: vi.fn(async (cond: any) => {
						updates.push({ values, cond });
					}),
				})),
			})),
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(async () => rows),
				})),
			})),
		};
		return db;
	}

	it('skips update when delta is 0 and executes update for positive/negative deltas', async () => {
		const db = createMockDb();
		await applyEventParticipantsDelta(db, 'evt-1', 0);
		expect(db.update).not.toHaveBeenCalled();

		await applyEventParticipantsDelta(db, 'evt-1', 3);
		await applyEventParticipantsDelta(db, 'evt-1', -2);
		expect(db.updates).toHaveLength(2);
	});

	it('sums stored event contact headcounts ignoring declined contacts', async () => {
		const db = createMockDb([
			{ partySize: 4, participationStatus: 'accepted' },
			{ partySize: 3, participationStatus: 'declined' },
			{ partySize: 2, participationStatus: 'needsAction' },
		]);
		const headcount = await getStoredEventContactsHeadcount(db, 'evt-1');
		expect(headcount).toBe(6);
	});

	it('aggregates event headcounts by contact IDs for cascade deletion decrement', async () => {
		const db = createMockDb([
			{ eventId: 'evt-1', partySize: 3, participationStatus: 'accepted' },
			{ eventId: 'evt-1', partySize: 2, participationStatus: 'tentative' },
			{ eventId: 'evt-2', partySize: 4, participationStatus: 'declined' },
		]);
		const map = await getEventHeadcountsByContactIds(db, ['c1', 'c2']);
		expect(map.get('evt-1')).toBe(5);
		expect(map.has('evt-2')).toBe(false);
	});

	it('reconciles event participantsCount from submittedCount and actual stored headcount', async () => {
		const db = createMockDb([
			{ partySize: 5, participationStatus: 'accepted' },
		]);
		await reconcileEventParticipantsCount(db, 'evt-1', { submittedCount: 3 });
		expect(db.updates[0].values.participantsCount).toBe(5);

		await reconcileEventParticipantsCount(db, 'evt-1', { submittedCount: 8 });
		expect(db.updates[1].values.participantsCount).toBe(8);
	});
});

describe('Event schema validation for participantsCount and contactParticipationStatusesJson', () => {
	it('accepts number participantsCount in eventBaseSchema', () => {
		const validData = {
			summary: 'Community Meetup',
			startDate: '2026-09-10',
			endDate: '2026-09-10',
			ticketPrice: '10',
			participantsCount: 42
		};
		const result = v.safeParse(eventBaseSchema, validData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.output.participantsCount).toBe(42);
		}
	});

	it('accepts string participantsCount in eventBaseSchema for form submissions', () => {
		const validData = {
			summary: 'Community Meetup',
			startDate: '2026-09-10',
			endDate: '2026-09-10',
			ticketPrice: '10',
			participantsCount: '15'
		};
		const result = v.safeParse(eventBaseSchema, validData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.output.participantsCount).toBe('15');
		}
	});

	it('defaults participantsCount to undefined/optional when not provided', () => {
		const validData = {
			summary: 'Community Meetup',
			startDate: '2026-09-10',
			endDate: '2026-09-10',
			ticketPrice: '10'
		};
		const result = v.safeParse(eventBaseSchema, validData);
		expect(result.success).toBe(true);
	});
});
