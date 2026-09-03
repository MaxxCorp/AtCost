import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { eventBaseSchema, createEventSchema, updateEventSchema } from '$lib/validations/events';

describe('Participants count calculation and synchronization algorithm', () => {
	function createParticipantState(initialParticipants?: number, initialContactIds: string[] = []) {
		let currentContactIds = [...initialContactIds];
		let baseline = initialParticipants !== undefined
			? Math.max(0, initialParticipants - initialContactIds.length)
			: 0;

		return {
			getBaseline: () => baseline,
			getContactIds: () => currentContactIds,
			getTotal: () => baseline + currentContactIds.length,
			shiftBaseline: (delta: number) => {
				baseline = Math.max(0, baseline + delta);
			},
			linkContact: (contactId: string) => {
				if (!currentContactIds.includes(contactId)) {
					currentContactIds.push(contactId);
				}
			},
			unlinkContact: (contactId: string) => {
				currentContactIds = currentContactIds.filter(id => id !== contactId);
			},
			setContactIds: (ids: string[]) => {
				currentContactIds = [...ids];
			},
			setManualTotal: (total: number) => {
				baseline = Math.max(0, total - currentContactIds.length);
			}
		};
	}

	it('initializes with 0 for a new event with no contacts', () => {
		const state = createParticipantState(undefined, []);
		expect(state.getTotal()).toBe(0);
		expect(state.getBaseline()).toBe(0);
	});

	it('initializes with contacts count when participantsCount was not explicitly set', () => {
		const state = createParticipantState(undefined, ['c1', 'c2']);
		expect(state.getBaseline()).toBe(0);
		expect(state.getTotal()).toBe(2);
	});

	it('calculates baseline from existing participantsCount and contactIds', () => {
		const state = createParticipantState(5, ['c1', 'c2']);
		expect(state.getBaseline()).toBe(3); // 5 - 2 = 3
		expect(state.getTotal()).toBe(5);
	});

	it('increases total count by 1 when a new contact is linked', () => {
		const state = createParticipantState(5, ['c1', 'c2']);
		state.linkContact('c3');
		expect(state.getContactIds()).toHaveLength(3);
		expect(state.getBaseline()).toBe(3);
		expect(state.getTotal()).toBe(6); // 3 + 3 = 6
	});

	it('decreases total count by 1 when a contact is unlinked', () => {
		const state = createParticipantState(5, ['c1', 'c2']);
		state.unlinkContact('c1');
		expect(state.getContactIds()).toHaveLength(1);
		expect(state.getBaseline()).toBe(3);
		expect(state.getTotal()).toBe(4); // 3 + 1 = 4
	});

	it('shifts baseline with addition (+) button', () => {
		const state = createParticipantState(2, ['c1', 'c2']);
		expect(state.getBaseline()).toBe(0);
		expect(state.getTotal()).toBe(2);

		state.shiftBaseline(1);
		expect(state.getBaseline()).toBe(1);
		expect(state.getTotal()).toBe(3);

		state.shiftBaseline(1);
		expect(state.getBaseline()).toBe(2);
		expect(state.getTotal()).toBe(4);
	});

	it('shifts baseline with subtraction (-) button and enforces baseline >= 0 constraint', () => {
		const state = createParticipantState(4, ['c1', 'c2']);
		expect(state.getBaseline()).toBe(2);
		expect(state.getTotal()).toBe(4);

		state.shiftBaseline(-1);
		expect(state.getBaseline()).toBe(1);
		expect(state.getTotal()).toBe(3);

		state.shiftBaseline(-1);
		expect(state.getBaseline()).toBe(0);
		expect(state.getTotal()).toBe(2);

		// Baseline floor: cannot decrease below 0
		state.shiftBaseline(-1);
		expect(state.getBaseline()).toBe(0);
		expect(state.getTotal()).toBe(2);
	});

	it('adapts baseline when manual total is input', () => {
		const state = createParticipantState(2, ['c1', 'c2']);
		state.setManualTotal(10);
		expect(state.getBaseline()).toBe(8); // 10 - 2 = 8
		expect(state.getTotal()).toBe(10);

		// Subsequent contact unlinking adapts from the new baseline
		state.unlinkContact('c1');
		expect(state.getTotal()).toBe(9); // 8 + 1 = 9
	});
});

describe('Event schema validation for participantsCount', () => {
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
