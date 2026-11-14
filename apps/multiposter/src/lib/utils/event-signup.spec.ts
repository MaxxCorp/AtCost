import { describe, it, expect } from 'vitest';
import {
	parseSignUpClosureDate,
	combineSignUpClosureDateTime,
	extractSignUpClosureParts,
	formatSignUpClosureDateYmd,
	formatSignUpClosureDateDisplay,
	isSignUpClosureDefaultTime,
	isSignUpClosed,
	extractSignUpFields,
	findDefaultKontaktContact,
	isKontaktRoleName,
	formatSignUpClosureDateShort,
	formatKioskSignUpCompact
} from './event-signup';

describe('event-signup utilities', () => {
	describe('date, time, timezone & display formatting', () => {
		it('combines date, optional time (default 23:59), and client timezone into ISO string', () => {
			// Europe/Berlin in November is UTC+1
			expect(combineSignUpClosureDateTime('2026-11-20', '', 'Europe/Berlin')).toBe(
				'2026-11-20T22:59:00.000Z'
			);
			expect(combineSignUpClosureDateTime('2026-11-20', '18:30', 'Europe/Berlin')).toBe(
				'2026-11-20T17:30:00.000Z'
			);
			expect(combineSignUpClosureDateTime('', '18:30', 'Europe/Berlin')).toBe('');
		});

		it('parses full timestamps preserving time and defaults bare YYYY-MM-DD to 23:59 UTC', () => {
			const bare = parseSignUpClosureDate('2026-11-20');
			expect(bare).toBeInstanceOf(Date);
			expect(bare?.toISOString()).toBe('2026-11-20T23:59:00.000Z');

			const full = parseSignUpClosureDate('2026-11-20T17:30:00.000Z');
			expect(full?.toISOString()).toBe('2026-11-20T17:30:00.000Z');

			expect(extractSignUpClosureParts(full, 'Europe/Berlin')).toEqual({
				date: '2026-11-20',
				time: '18:30'
			});
			expect(formatSignUpClosureDateYmd('2026-11-20T22:59:00.000Z', 'Europe/Berlin')).toBe('2026-11-20');
			expect(parseSignUpClosureDate('')).toBeNull();
			expect(parseSignUpClosureDate(null)).toBeNull();
		});

		it('omits time in display/short formats when time is 23:59, and shows time only when it differs', () => {
			// 2026-11-20 23:59 Europe/Berlin
			const defaultIso = '2026-11-20T22:59:00.000Z';
			// 2026-11-20 18:30 Europe/Berlin
			const customIso = '2026-11-20T17:30:00.000Z';

			expect(isSignUpClosureDefaultTime(defaultIso, 'Europe/Berlin')).toBe(true);
			expect(isSignUpClosureDefaultTime(customIso, 'Europe/Berlin')).toBe(false);

			const defaultFullDe = formatSignUpClosureDateDisplay(defaultIso, 'de-DE', 'Europe/Berlin');
			expect(defaultFullDe).not.toContain('23:59');

			const customFullDe = formatSignUpClosureDateDisplay(customIso, 'de-DE', 'Europe/Berlin');
			expect(customFullDe).toContain('18:30');

			const defaultShortDe = formatSignUpClosureDateShort(defaultIso, 'de-DE', 'Europe/Berlin');
			expect(defaultShortDe).toBe('20.11.26');

			const customShortDe = formatSignUpClosureDateShort(customIso, 'de-DE', 'Europe/Berlin');
			expect(customShortDe).toBe('20.11.26 18:30');
		});

		it('enforces closure at the exact closure timestamp and only for required mode', () => {
			expect(isSignUpClosed('off', '2020-01-01', new Date('2026-11-20T12:00:00Z'))).toBe(false);
			expect(isSignUpClosed('recommended', '2020-01-01', new Date('2026-11-20T12:00:00Z'))).toBe(false);
			expect(isSignUpClosed('required', null, new Date('2026-11-20T12:00:00Z'))).toBe(false);
			// Custom closure 2026-11-20 18:30 Berlin (17:30Z)
			const customClosure = '2026-11-20T17:30:00.000Z';
			expect(isSignUpClosed('required', customClosure, new Date('2026-11-20T17:29:59Z'))).toBe(false);
			expect(isSignUpClosed('required', customClosure, new Date('2026-11-20T17:30:00Z'))).toBe(true);
		});
	});

	describe('extractSignUpFields', () => {
		it('clears closure date, recurrence, and signup contact when signUpMode is not required', () => {
			expect(
				extractSignUpFields({
					signUpMode: 'recommended',
					signUpClosureDate: '2026-11-20',
					signUpRecurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
					signUpContactId: 'c-1',
					signUpContactOverridden: 'true'
				})
			).toEqual({
				signUpMode: 'recommended',
				signUpClosureDate: null,
				signUpRecurrence: null,
				signUpContactId: null,
				signUpContactOverridden: false
			});
		});

		it('preserves closure timestamp, signUpRecurrence, signup contact, and override flag for required mode', () => {
			const res = extractSignUpFields({
				signUpMode: 'required',
				signUpClosureDate: '2026-11-20T17:30:00.000Z',
				signUpRecurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
				signUpContactId: '  c-42 ',
				signUpContactOverridden: 'true'
			});
			expect(res.signUpMode).toBe('required');
			expect(res.signUpClosureDate?.toISOString()).toBe('2026-11-20T17:30:00.000Z');
			expect(res.signUpRecurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO']);
			expect(res.signUpContactId).toBe('c-42');
			expect(res.signUpContactOverridden).toBe(true);

			// signUpRecurrence requires a closure date anchor
			const noDate = extractSignUpFields({
				signUpMode: 'required',
				signUpClosureDate: '',
				signUpRecurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO'
			});
			expect(noDate.signUpClosureDate).toBeNull();
			expect(noDate.signUpRecurrence).toBeNull();
		});
	});

	describe('findDefaultKontaktContact', () => {
		const roles = [
			{ id: 'r-pm', name: 'Project Manager' },
			{ id: 'r-kontakt', name: 'Kontakt' },
			{ id: 'r-contact', name: 'Contact' }
		];

		it('matches Kontakt role case-insensitively', () => {
			expect(isKontaktRoleName('Kontakt')).toBe(true);
			expect(isKontaktRoleName(' contact ')).toBe(true);
			expect(isKontaktRoleName('Moderator')).toBe(false);
		});

		it('prefers exact Kontakt role and updates cleanly when role assignments change', () => {
			const alice = { id: 'c-alice', displayName: 'Alice' };
			const bob = { id: 'c-bob', displayName: 'Bob' };

			const first = findDefaultKontaktContact([alice, bob], { 'c-alice': ['r-kontakt'] }, roles);
			expect(first?.id).toBe('c-alice');

			const moved = findDefaultKontaktContact(
				[alice, bob],
				{ 'c-alice': ['r-pm'], 'c-bob': ['r-kontakt'] },
				roles
			);
			expect(moved?.id).toBe('c-bob');

			const cleared = findDefaultKontaktContact(
				[alice, bob],
				{ 'c-alice': ['r-pm'], 'c-bob': [] },
				roles
			);
			expect(cleared).toBeNull();
		});

		it('falls back to Contact alias if Kontakt is absent and handles empty availableRoles on initial load', () => {
			const alice = { id: 'c-alice', displayName: 'Alice', roles: [{ id: 'r-kontakt', name: 'Kontakt' }] };
			const bob = { id: 'c-bob', displayName: 'Bob' };

			expect(findDefaultKontaktContact([alice, bob], { 'c-alice': ['r-kontakt'] }, [])?.id).toBe('c-alice');
			expect(findDefaultKontaktContact([alice, bob], { 'c-bob': ['r-contact'] }, roles)?.id).toBe('c-bob');
		});
	});

	describe('formatKioskSignUpCompact', () => {
		const labels = {
			req: 'Anmeldung über QR Code',
			by: (d: string) => `Anmeldung bis ${d} über QR Code`,
			orContact: (c: string) => ` oder ${c}`,
			closed: 'Anmeldung geschl.',
			reqPlain: 'Anmeldung erf.',
			reqContact: (c: string) => `Anmeldung über ${c}`,
			byPlain: (d: string) => `Anmeldung bis ${d}`,
			viaContact: (c: string) => ` über ${c}`
		};

		it('returns empty string when signUpMode is not required', () => {
			expect(formatKioskSignUpCompact({ signUpMode: 'off' }, labels, 'de')).toBe('');
			expect(formatKioskSignUpCompact({ signUpMode: 'recommended' }, labels, 'de')).toBe('');
		});

		it('omits contact name, directs to QR code, omits 23:59, and shows custom time', () => {
			const futureDefault = '2099-12-12T22:59:00.000Z';
			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: futureDefault,
						resolvedSignUpContact: {
							name: 'Anna',
							phone: '+49(0)305405659',
							email: 'anna@example.org'
						}
					},
					labels,
					'de-DE',
					'Europe/Berlin'
				)
			).toBe('Anmeldung bis 12.12.99 über QR Code oder +49(0)305405659');

			const futureCustom = '2099-12-12T11:00:00.000Z';
			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: futureCustom,
						resolvedSignUpContact: {
							name: 'Anna',
							phone: '+49(0)305405659',
							email: 'anna@example.org'
						}
					},
					labels,
					'de-DE',
					'Europe/Berlin'
				)
			).toBe('Anmeldung bis 12.12.99 12:00 über QR Code oder +49(0)305405659');

			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: null,
						resolvedSignUpContact: null
					},
					labels,
					'de-DE',
					'Europe/Berlin'
				)
			).toBe('Anmeldung über QR Code');
		});

		it('falls back to email when phone is absent, omits name, and marks closed when date is past', () => {
			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: '2020-01-10T00:00:00.000Z',
						resolvedSignUpContact: {
							name: 'Desk',
							phone: '',
							email: 'desk@example.org'
						}
					},
					labels,
					'de'
				)
			).toBe('Anmeldung geschl. (desk@example.org)');
		});

		it('uses recurringDeadlineLabel on multi-occurrence compressed series unless all occurrences are closed', () => {
			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: '2020-01-10T11:00:00.000Z',
						signUpRecurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
						resolvedSignUpContact: {
							phone: '+49(0)305405659'
						}
					},
					labels,
					'de',
					undefined,
					{
						recurringDeadlineLabel: 'wöchentl. Mo 12:00',
						allOccurrencesClosed: false
					}
				)
			).toBe('Anmeldung bis wöchentl. Mo 12:00 über QR Code oder +49(0)305405659');

			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: '2020-01-10T11:00:00.000Z',
						signUpRecurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
						resolvedSignUpContact: {
							phone: '+49(0)305405659'
						}
					},
					labels,
					'de',
					undefined,
					{
						recurringDeadlineLabel: 'wöchentl. Mo 12:00',
						allOccurrencesClosed: true
					}
				)
			).toBe('Anmeldung geschl. (+49(0)305405659)');
		});

		it('omits QR code phrasing when QR codes are inactive for the item', () => {
			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: '2099-12-12T11:00:00.000Z',
						resolvedSignUpContact: { phone: '+49(0)305405659' }
					},
					labels,
					'de-DE',
					'Europe/Berlin',
					{ showQrCode: false }
				)
			).toBe('Anmeldung bis 12.12.99 12:00 über +49(0)305405659');

			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: '2099-12-12T22:59:00.000Z',
						resolvedSignUpContact: null
					},
					labels,
					'de-DE',
					'Europe/Berlin',
					{ showQrCode: false }
				)
			).toBe('Anmeldung bis 12.12.99');

			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: null,
						resolvedSignUpContact: { email: 'desk@example.org' }
					},
					labels,
					'de-DE',
					'Europe/Berlin',
					{ showQrCode: false }
				)
			).toBe('Anmeldung über desk@example.org');

			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: null,
						resolvedSignUpContact: null
					},
					labels,
					'de-DE',
					'Europe/Berlin',
					{ showQrCode: false }
				)
			).toBe('Anmeldung erf.');

			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: '2099-12-12T11:00:00.000Z',
						signUpRecurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
						resolvedSignUpContact: { phone: '+49(0)305405659' }
					},
					labels,
					'de',
					undefined,
					{
						recurringDeadlineLabel: 'wöchentl. Mo 12:00',
						showQrCode: false
					}
				)
			).toBe('Anmeldung bis wöchentl. Mo 12:00 über +49(0)305405659');
		});
	});
});
