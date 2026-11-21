import { describe, it, expect } from 'vitest';
import {
	parseLocalYmdStart,
	parseLocalYmdEnd,
	formatLocalYmd,
	isDateFilterActive,
	getDateFilterBounds,
	formatDateFilterSummary,
	getTodayDateFilterValue,
	getThisWeekDateFilterValue,
	getThisMonthDateFilterValue,
} from '@ac/ui';

describe('@ac/ui dateFilter utilities', () => {
	it('parses valid YYYY-MM-DD strings into local start/end of day and rejects invalid dates', () => {
		const s = parseLocalYmdStart('2026-11-21');
		expect(s).not.toBeNull();
		expect(s?.getFullYear()).toBe(2026);
		expect(s?.getMonth()).toBe(10);
		expect(s?.getDate()).toBe(21);
		expect(s?.getHours()).toBe(0);
		expect(s?.getMinutes()).toBe(0);
		expect(s?.getSeconds()).toBe(0);
		expect(s?.getMilliseconds()).toBe(0);

		const e = parseLocalYmdEnd('2026-11-21');
		expect(e).not.toBeNull();
		expect(e?.getFullYear()).toBe(2026);
		expect(e?.getMonth()).toBe(10);
		expect(e?.getDate()).toBe(21);
		expect(e?.getHours()).toBe(23);
		expect(e?.getMinutes()).toBe(59);
		expect(e?.getSeconds()).toBe(59);
		expect(e?.getMilliseconds()).toBe(999);

		// Invalid calendar dates & malformed strings
		expect(parseLocalYmdStart('2026-02-31')).toBeNull();
		expect(parseLocalYmdEnd('2026-13-01')).toBeNull();
		expect(parseLocalYmdStart('not-a-date')).toBeNull();
		expect(parseLocalYmdStart('')).toBeNull();
		expect(parseLocalYmdStart(null)).toBeNull();
	});

	it('formats local dates as YYYY-MM-DD', () => {
		expect(formatLocalYmd(new Date(2026, 0, 5, 14, 30))).toBe('2026-01-05');
	});

	it('detects active date filters accurately for single and range modes', () => {
		expect(isDateFilterActive(null)).toBe(false);
		expect(isDateFilterActive({ mode: 'single', from: '', to: '' })).toBe(false);
		expect(isDateFilterActive({ mode: 'single', from: '2026-02-30', to: '' })).toBe(false);
		expect(isDateFilterActive({ mode: 'single', from: '2026-11-21', to: '' })).toBe(true);

		expect(isDateFilterActive({ mode: 'range', from: '', to: '' })).toBe(false);
		expect(isDateFilterActive({ mode: 'range', from: '2026-11-21', to: '' })).toBe(true);
		expect(isDateFilterActive({ mode: 'range', from: '', to: '2026-11-25' })).toBe(true);
	});

	it('computes local bounds for single, open-ended, normal, and inverted ranges', () => {
		const single = getDateFilterBounds({ mode: 'single', from: '2026-11-21', to: '' });
		expect(single.start?.getDate()).toBe(21);
		expect(single.start?.getHours()).toBe(0);
		expect(single.end?.getDate()).toBe(21);
		expect(single.end?.getHours()).toBe(23);

		const openFrom = getDateFilterBounds({ mode: 'range', from: '2026-11-21', to: '' });
		expect(openFrom.start?.getDate()).toBe(21);
		expect(openFrom.end).toBeNull();

		const openTo = getDateFilterBounds({ mode: 'range', from: '', to: '2026-11-25' });
		expect(openTo.start).toBeNull();
		expect(openTo.end?.getDate()).toBe(25);
		expect(openTo.end?.getHours()).toBe(23);

		// Inverted range swaps bounds cleanly
		const inverted = getDateFilterBounds({ mode: 'range', from: '2026-11-28', to: '2026-11-20' });
		expect(inverted.start?.getDate()).toBe(20);
		expect(inverted.start?.getHours()).toBe(0);
		expect(inverted.end?.getDate()).toBe(28);
		expect(inverted.end?.getHours()).toBe(23);
	});

	it('formats concise summaries for single, identical, range, inverted, and open-ended filters', () => {
		const singleSummary = formatDateFilterSummary(
			{ mode: 'single', from: '2026-11-21', to: '' },
			undefined,
			'en-US',
		);
		expect(singleSummary).toContain('21');
		expect(singleSummary).toContain('2026');

		const sameDayRange = formatDateFilterSummary(
			{ mode: 'range', from: '2026-11-21', to: '2026-11-21' },
			undefined,
			'en-US',
		);
		expect(sameDayRange).toBe(singleSummary);

		const twoDayRange = formatDateFilterSummary(
			{ mode: 'range', from: '2026-11-20', to: '2026-11-25' },
			undefined,
			'en-US',
		);
		expect(twoDayRange).toContain('–');

		const invertedRange = formatDateFilterSummary(
			{ mode: 'range', from: '2026-11-25', to: '2026-11-20' },
			undefined,
			'en-US',
		);
		expect(invertedRange).toBe(twoDayRange);

		expect(
			formatDateFilterSummary(
				{ mode: 'range', from: '2026-11-20', to: '' },
				{ fromLabel: 'From' },
				'en-US',
			),
		).toMatch(/^From /);

		expect(
			formatDateFilterSummary(
				{ mode: 'range', from: '', to: '2026-11-25' },
				{ toLabel: 'To' },
				'en-US',
			),
		).toMatch(/^To /);
	});

	it('builds accurate presets for Today, This week, and This month', () => {
		// Saturday Nov 21, 2026 -> week is Mon Nov 16 .. Sun Nov 22
		const refSat = new Date(2026, 10, 21, 17, 45);
		expect(getTodayDateFilterValue(refSat)).toEqual({
			mode: 'single',
			from: '2026-11-21',
			to: '',
		});
		expect(getThisWeekDateFilterValue(refSat)).toEqual({
			mode: 'range',
			from: '2026-11-16',
			to: '2026-11-22',
		});
		expect(getThisMonthDateFilterValue(refSat)).toEqual({
			mode: 'range',
			from: '2026-11-01',
			to: '2026-11-30',
		});

		// Sunday Nov 22, 2026 -> week is still Mon Nov 16 .. Sun Nov 22
		const refSun = new Date(2026, 10, 22, 10, 0);
		expect(getThisWeekDateFilterValue(refSun)).toEqual({
			mode: 'range',
			from: '2026-11-16',
			to: '2026-11-22',
		});
	});
});
