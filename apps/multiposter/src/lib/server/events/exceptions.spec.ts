import { describe, it, expect } from 'vitest';
import { hasVirtualInstanceChanged, type VirtualInstanceDiffInput } from './exceptions';

describe('hasVirtualInstanceChanged', () => {
	const baseMaster = {
		summary: 'Weekly Team Standup',
		description: 'Regular sync meeting',
		internalNotes: 'Internal room notes',
		status: 'CONFIRMED',
		categoryBerlinDotDe: 'Business',
		heroImage: 'https://example.com/banner.jpg',
		ticketPrice: '10.00',
		ticketPriceUnknown: false,
		isAllDay: false,
		isPublic: true,
		guestsCanInviteOthers: false,
		guestsCanModify: false,
		guestsCanSeeOtherGuests: true,
		participantsCount: 5,
		startDateTime: new Date('2026-10-01T10:00:00Z'),
		endDateTime: new Date('2026-10-01T11:00:00Z'),
		reminders: [{ method: 'popup', minutes: 10 }]
	};

	const baseTargetStart = new Date('2026-10-08T10:00:00Z');
	const baseTargetEnd = new Date('2026-10-08T11:00:00Z');

	const baseAssociations = {
		masterLocationIds: ['loc-1', 'loc-2'],
		submittedLocationIds: ['loc-1', 'loc-2'],
		masterResourceIds: ['res-1'],
		submittedResourceIds: ['res-1'],
		masterContactIds: ['ctc-1'],
		submittedContactIds: ['ctc-1'],
		masterTags: ['Meeting', 'Series'],
		submittedTags: ['Meeting'],
		masterSyncIds: ['sync-1'],
		submittedSyncIds: ['sync-1']
	};

	it('returns false when no fields or associations have changed', () => {
		const input: VirtualInstanceDiffInput = {
			master: baseMaster,
			submitted: {
				summary: 'Weekly Team Standup',
				description: 'Regular sync meeting',
				internalNotes: 'Internal room notes',
				status: 'CONFIRMED',
				categoryBerlinDotDe: 'Business',
				heroImage: 'https://example.com/banner.jpg',
				ticketPrice: '10.00',
				ticketPriceUnknown: false,
				isAllDay: false,
				isPublic: true,
				guestsCanInviteOthers: false,
				guestsCanModify: false,
				guestsCanSeeOtherGuests: true,
				participantsCount: 5,
				reminders: [{ method: 'popup', minutes: 10 }]
			},
			targetStart: baseTargetStart,
			targetEnd: baseTargetEnd,
			submittedStart: new Date('2026-10-08T10:00:00Z'),
			submittedEnd: new Date('2026-10-08T11:00:00Z'),
			associations: baseAssociations
		};

		expect(hasVirtualInstanceChanged(input)).toBe(false);
	});

	it('returns true when summary is modified', () => {
		const input: VirtualInstanceDiffInput = {
			master: baseMaster,
			submitted: {
				summary: 'Special Retrospective Meeting'
			},
			targetStart: baseTargetStart,
			targetEnd: baseTargetEnd,
			submittedStart: baseTargetStart,
			submittedEnd: baseTargetEnd
		};

		expect(hasVirtualInstanceChanged(input)).toBe(true);
	});

	it('returns true when start time is shifted', () => {
		const input: VirtualInstanceDiffInput = {
			master: baseMaster,
			submitted: {
				summary: baseMaster.summary
			},
			targetStart: baseTargetStart,
			targetEnd: baseTargetEnd,
			submittedStart: new Date('2026-10-08T10:30:00Z'),
			submittedEnd: baseTargetEnd
		};

		expect(hasVirtualInstanceChanged(input)).toBe(true);
	});

	it('returns true when ticket price is modified', () => {
		const input: VirtualInstanceDiffInput = {
			master: baseMaster,
			submitted: {
				summary: baseMaster.summary,
				ticketPrice: '15.00'
			},
			targetStart: baseTargetStart,
			targetEnd: baseTargetEnd,
			submittedStart: baseTargetStart,
			submittedEnd: baseTargetEnd
		};

		expect(hasVirtualInstanceChanged(input)).toBe(true);
	});

	it('returns true when locations are modified', () => {
		const input: VirtualInstanceDiffInput = {
			master: baseMaster,
			submitted: {
				summary: baseMaster.summary
			},
			targetStart: baseTargetStart,
			targetEnd: baseTargetEnd,
			submittedStart: baseTargetStart,
			submittedEnd: baseTargetEnd,
			associations: {
				...baseAssociations,
				submittedLocationIds: ['loc-1', 'loc-3']
			}
		};

		expect(hasVirtualInstanceChanged(input)).toBe(true);
	});

	it('returns true when reminders are modified', () => {
		const input: VirtualInstanceDiffInput = {
			master: baseMaster,
			submitted: {
				summary: baseMaster.summary,
				reminders: [{ method: 'email', minutes: 60 }]
			},
			targetStart: baseTargetStart,
			targetEnd: baseTargetEnd,
			submittedStart: baseTargetStart,
			submittedEnd: baseTargetEnd
		};

		expect(hasVirtualInstanceChanged(input)).toBe(true);
	});

	it('ignores whitespace differences when checking text fields', () => {
		const input: VirtualInstanceDiffInput = {
			master: {
				...baseMaster,
				description: 'Regular sync meeting'
			},
			submitted: {
				summary: baseMaster.summary,
				description: '  Regular sync meeting  '
			},
			targetStart: baseTargetStart,
			targetEnd: baseTargetEnd,
			submittedStart: baseTargetStart,
			submittedEnd: baseTargetEnd
		};

		expect(hasVirtualInstanceChanged(input)).toBe(false);
	});
});
