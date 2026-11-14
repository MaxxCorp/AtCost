import { describe, it, expect } from 'vitest';
import {
	parseSignUpClosureDate,
	formatSignUpClosureDateYmd,
	isSignUpClosed,
	extractSignUpFields,
	findDefaultKontaktContact,
	isKontaktRoleName,
	formatSignUpClosureDateShort,
	formatKioskSignUpCompact
} from './event-signup';

describe('event-signup utilities', () => {
	describe('date formatting & parsing', () => {
		it('parses YYYY-MM-DD cleanly into UTC midnight Date and formats back', () => {
			const parsed = parseSignUpClosureDate('2026-11-20');
			expect(parsed).toBeInstanceOf(Date);
			expect(parsed?.toISOString()).toBe('2026-11-20T00:00:00.000Z');
			expect(formatSignUpClosureDateYmd(parsed)).toBe('2026-11-20');
			expect(formatSignUpClosureDateYmd('2026-11-20T23:59:59.000Z')).toBe('2026-11-20');
			expect(parseSignUpClosureDate('')).toBeNull();
			expect(parseSignUpClosureDate(null)).toBeNull();
		});

		it('enforces closure only after the closure calendar day and only for required mode', () => {
			expect(isSignUpClosed('off', '2020-01-01', new Date('2026-11-20T12:00:00Z'))).toBe(false);
			expect(isSignUpClosed('recommended', '2020-01-01', new Date('2026-11-20T12:00:00Z'))).toBe(false);
			expect(isSignUpClosed('required', null, new Date('2026-11-20T12:00:00Z'))).toBe(false);
			// Open before closure day
			expect(isSignUpClosed('required', '2026-11-20', new Date('2026-11-19T23:59:59Z'))).toBe(false);
			// Still open on closure day itself
			expect(isSignUpClosed('required', '2026-11-20', new Date('2026-11-20T23:59:59Z'))).toBe(false);
			// Closed starting the next UTC day
			expect(isSignUpClosed('required', '2026-11-20', new Date('2026-11-21T00:00:00Z'))).toBe(true);
		});
	});

	describe('extractSignUpFields', () => {
		it('clears closure date and signup contact when signUpMode is not required', () => {
			expect(
				extractSignUpFields({
					signUpMode: 'recommended',
					signUpClosureDate: '2026-11-20',
					signUpContactId: 'c-1',
					signUpContactOverridden: 'true'
				})
			).toEqual({
				signUpMode: 'recommended',
				signUpClosureDate: null,
				signUpContactId: null,
				signUpContactOverridden: false
			});
		});

		it('preserves closure date, signup contact, and override flag for required mode', () => {
			const res = extractSignUpFields({
				signUpMode: 'required',
				signUpClosureDate: '2026-11-20',
				signUpContactId: '  c-42 ',
				signUpContactOverridden: 'true'
			});
			expect(res.signUpMode).toBe('required');
			expect(res.signUpClosureDate?.toISOString()).toBe('2026-11-20T00:00:00.000Z');
			expect(res.signUpContactId).toBe('c-42');
			expect(res.signUpContactOverridden).toBe(true);
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
			req: 'Anmeldung erf.',
			by: (d: string) => `Anmeldung bis ${d}`,
			closed: 'Anmeldung geschl.'
		};

		it('returns empty string when signUpMode is not required', () => {
			expect(formatKioskSignUpCompact({ signUpMode: 'off' }, labels, 'de')).toBe('');
			expect(formatKioskSignUpCompact({ signUpMode: 'recommended' }, labels, 'de')).toBe('');
		});

		it('formats compact closure date and prefers phone over email', () => {
			const futureDate = '2099-11-20T00:00:00.000Z';
			expect(
				formatKioskSignUpCompact(
					{
						signUpMode: 'required',
						signUpClosureDate: futureDate,
						resolvedSignUpContact: {
							name: 'Anna',
							phone: '030-1234',
							email: 'anna@example.org'
						}
					},
					labels,
					'de'
				)
			).toBe(`Anmeldung bis ${formatSignUpClosureDateShort(futureDate, 'de')} (Anna, 030-1234)`);
		});

		it('falls back to email when phone is absent and marks closed when date is past', () => {
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
			).toBe('Anmeldung geschl. (Desk, desk@example.org)');
		});
	});
});
