import { describe, expect, it } from 'vitest';
import {
	normalizeEmail,
	normalizePhoneDigits,
	phonesMatch,
	getPhoneMatchSuffix
} from '@ac/validations';

describe('contact-matching normalization', () => {
	it('normalizes emails case-insensitively and trims whitespace', () => {
		expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
		expect(normalizeEmail('')).toBe('');
		expect(normalizeEmail(null)).toBe('');
	});

	it('normalizes phone numbers with country codes, (0) trunk prefixes, and formatting', () => {
		expect(normalizePhoneDigits('+49 (0)176 5405659')).toBe('491765405659');
		expect(normalizePhoneDigits('0049 176 5405659')).toBe('491765405659');
		expect(normalizePhoneDigits('0176 5405659')).toBe('1765405659');
		expect(normalizePhoneDigits('5405659')).toBe('5405659');
		expect(normalizePhoneDigits('030 / 540-56-59')).toBe('305405659');
	});

	it('matches local number against full international number in both directions', () => {
		expect(phonesMatch('5405659', '+49 (0)176 5405659')).toBe(true);
		expect(phonesMatch('+49 (0)176 5405659', '5405659')).toBe(true);
		expect(phonesMatch('0176 5405659', '+49 (0)176 5405659')).toBe(true);
		expect(phonesMatch('0049 176 540-56-59', '01765405659')).toBe(true);
	});

	it('does not falsely match different area codes or different subscriber numbers', () => {
		expect(phonesMatch('030 5405659', '+49 (0)176 5405659')).toBe(false);
		expect(phonesMatch('+49 176 5405659', '+49 176 5405658')).toBe(false);
		expect(phonesMatch('123', '+49 176 5405123')).toBe(false);
	});

	it('computes SQL candidate suffix', () => {
		expect(getPhoneMatchSuffix('+49 (0)176 5405659')).toBe('405659');
		expect(getPhoneMatchSuffix('5405659')).toBe('405659');
		expect(getPhoneMatchSuffix('123')).toBeNull();
	});
});
