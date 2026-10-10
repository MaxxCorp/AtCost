import { describe, it, expect } from 'vitest';
import { formatEventStatus, getStatusBadgeClass, getStatusDotClass } from './format-event-status';

describe('formatEventStatus', () => {
	it('returns empty string for null or undefined or empty', () => {
		expect(formatEventStatus(null)).toBe('');
		expect(formatEventStatus(undefined)).toBe('');
		expect(formatEventStatus('')).toBe('');
	});

	it('returns localized or capitalized label for statuses', () => {
		expect(formatEventStatus('confirmed')).toBe('Confirmed');
		expect(formatEventStatus('CONFIRMED')).toBe('Confirmed');
		expect(formatEventStatus('cancelled')).toBe('Cancelled');
		expect(formatEventStatus('canceled')).toBe('Cancelled');
		expect(formatEventStatus('tentative')).toBe('Tentative');
		expect(formatEventStatus('draft')).toBe('Draft');
		expect(formatEventStatus('custom_status')).toBe('Custom_status');
	});
});

describe('getStatusBadgeClass', () => {
	it('returns correct class for each status', () => {
		expect(getStatusBadgeClass('confirmed')).toContain('text-emerald-700');
		expect(getStatusBadgeClass('cancelled')).toContain('text-rose-700');
		expect(getStatusBadgeClass('canceled')).toContain('text-rose-700');
		expect(getStatusBadgeClass('tentative')).toContain('text-amber-700');
		expect(getStatusBadgeClass('draft')).toContain('text-slate-700');
		expect(getStatusBadgeClass('other')).toContain('text-gray-700');
	});
});

describe('getStatusDotClass', () => {
	it('returns correct dot color for each status', () => {
		expect(getStatusDotClass('confirmed')).toBe('bg-emerald-500');
		expect(getStatusDotClass('cancelled')).toBe('bg-rose-500');
		expect(getStatusDotClass('canceled')).toBe('bg-rose-500');
		expect(getStatusDotClass('tentative')).toContain('bg-amber-500');
		expect(getStatusDotClass('draft')).toBe('bg-slate-400');
		expect(getStatusDotClass('other')).toBe('bg-gray-400');
	});
});
