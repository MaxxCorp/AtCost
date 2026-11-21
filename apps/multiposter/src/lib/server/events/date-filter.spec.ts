import { describe, it, expect } from 'vitest';
import {
	findMatchingSeriesOccurrenceStart,
	type DateFilterCandidate,
	type DateFilterDbInstance,
} from './date-filter';

function utc(iso: string): Date {
	return new Date(iso);
}

describe('findMatchingSeriesOccurrenceStart', () => {
	it('matches non-series single event inside and rejects outside single date and range', () => {
		const single: DateFilterCandidate = {
			id: 'evt-1',
			startDateTime: '2026-11-21T14:00:00.000Z',
			endDateTime: '2026-11-21T16:00:00.000Z',
			status: 'confirmed',
			isPublic: true,
		};

		// Inside single day
		expect(
			findMatchingSeriesOccurrenceStart(single, null, [], {
				rangeStart: utc('2026-11-21T00:00:00.000Z'),
				rangeEnd: utc('2026-11-21T23:59:59.999Z'),
			}),
		).toEqual({
			matches: true,
			firstMatchStartMs: utc('2026-11-21T14:00:00.000Z').getTime(),
		});

		// Day before
		expect(
			findMatchingSeriesOccurrenceStart(single, null, [], {
				rangeStart: utc('2026-11-20T00:00:00.000Z'),
				rangeEnd: utc('2026-11-20T23:59:59.999Z'),
			}),
		).toEqual({ matches: false, firstMatchStartMs: null });

		// Multi-day range containing the event
		expect(
			findMatchingSeriesOccurrenceStart(single, null, [], {
				rangeStart: utc('2026-11-18T00:00:00.000Z'),
				rangeEnd: utc('2026-11-25T23:59:59.999Z'),
			}),
		).toEqual({
			matches: true,
			firstMatchStartMs: utc('2026-11-21T14:00:00.000Z').getTime(),
		});
	});

	it('matches multi-day event spanning across a selected single date', () => {
		const multiDay: DateFilterCandidate = {
			id: 'evt-multi',
			startDateTime: '2026-11-19T10:00:00.000Z',
			endDateTime: '2026-11-23T18:00:00.000Z',
			status: 'confirmed',
			isPublic: true,
		};

		// Selecting middle day 2026-11-21
		expect(
			findMatchingSeriesOccurrenceStart(multiDay, null, [], {
				rangeStart: utc('2026-11-21T00:00:00.000Z'),
				rangeEnd: utc('2026-11-21T23:59:59.999Z'),
			}),
		).toEqual({
			matches: true,
			firstMatchStartMs: utc('2026-11-19T10:00:00.000Z').getTime(),
		});
	});

	it('does not bleed exclusive-midnight all-day event into the next day', () => {
		const allDay: DateFilterCandidate = {
			id: 'evt-allday',
			startDateTime: '2026-11-20T00:00:00.000Z',
			endDateTime: '2026-11-21T00:00:00.000Z',
			status: 'confirmed',
			isPublic: true,
		};

		expect(
			findMatchingSeriesOccurrenceStart(allDay, null, [], {
				rangeStart: utc('2026-11-20T00:00:00.000Z'),
				rangeEnd: utc('2026-11-20T23:59:59.999Z'),
			}).matches,
		).toBe(true);

		expect(
			findMatchingSeriesOccurrenceStart(allDay, null, [], {
				rangeStart: utc('2026-11-21T00:00:00.000Z'),
				rangeEnd: utc('2026-11-21T23:59:59.999Z'),
			}).matches,
		).toBe(false);
	});

	it('matches weekly recurring series months after start on matching weekday and excludes non-matching weekday', () => {
		// Master started 2026-01-05 (Monday) 18:00Z, weekly every Monday
		const seriesMaster: DateFilterCandidate = {
			id: 'series-1',
			startDateTime: '2026-01-05T18:00:00.000Z',
			endDateTime: '2026-01-05T19:00:00.000Z',
			recurrence: ['RRULE:FREQ=WEEKLY'],
			startTimeZone: 'UTC',
			status: 'confirmed',
			isPublic: true,
		};

		// Monday 2026-11-16
		const mondayRes = findMatchingSeriesOccurrenceStart(seriesMaster, 'RRULE:FREQ=WEEKLY', [], {
			rangeStart: utc('2026-11-16T00:00:00.000Z'),
			rangeEnd: utc('2026-11-16T23:59:59.999Z'),
		});
		expect(mondayRes.matches).toBe(true);
		expect(mondayRes.firstMatchStartMs).toBe(utc('2026-11-16T18:00:00.000Z').getTime());

		// Tuesday 2026-11-17
		const tuesdayRes = findMatchingSeriesOccurrenceStart(seriesMaster, 'RRULE:FREQ=WEEKLY', [], {
			rangeStart: utc('2026-11-17T00:00:00.000Z'),
			rangeEnd: utc('2026-11-17T23:59:59.999Z'),
		});
		expect(tuesdayRes).toEqual({ matches: false, firstMatchStartMs: null });
	});

	it('excludes recurring series whose COUNT or UNTIL ended before the selected range', () => {
		const countSeries: DateFilterCandidate = {
			id: 'series-count',
			startDateTime: '2026-09-07T10:00:00.000Z',
			endDateTime: '2026-09-07T11:00:00.000Z',
			startTimeZone: 'UTC',
			status: 'confirmed',
			isPublic: true,
		};

		// 3 occurrences: Sep 7, Sep 14, Sep 21 -> ended well before Nov
		expect(
			findMatchingSeriesOccurrenceStart(countSeries, 'RRULE:FREQ=WEEKLY;COUNT=3', [], {
				rangeStart: utc('2026-11-01T00:00:00.000Z'),
				rangeEnd: utc('2026-11-30T23:59:59.999Z'),
			}),
		).toEqual({ matches: false, firstMatchStartMs: null });

		// UNTIL ended Oct 15
		expect(
			findMatchingSeriesOccurrenceStart(
				countSeries,
				'RRULE:FREQ=WEEKLY;UNTIL=20261015T235959Z',
				[],
				{
					rangeStart: utc('2026-11-01T00:00:00.000Z'),
					rangeEnd: utc('2026-11-30T23:59:59.999Z'),
				},
			),
		).toEqual({ matches: false, firstMatchStartMs: null });
	});

	it('handles open-ended From-only range (rangeEnd = null)', () => {
		const ongoing: DateFilterCandidate = {
			id: 'series-ongoing',
			startDateTime: '2026-01-05T18:00:00.000Z',
			endDateTime: '2026-01-05T19:00:00.000Z',
			startTimeZone: 'UTC',
			status: 'confirmed',
			isPublic: true,
		};

		// Open-ended from 2026-11-15 -> next Monday is 2026-11-16
		const resOngoing = findMatchingSeriesOccurrenceStart(ongoing, 'RRULE:FREQ=WEEKLY', [], {
			rangeStart: utc('2026-11-15T00:00:00.000Z'),
			rangeEnd: null,
		});
		expect(resOngoing.matches).toBe(true);
		expect(resOngoing.firstMatchStartMs).toBe(utc('2026-11-16T18:00:00.000Z').getTime());

		// Series that ended in Feb 2026 should NOT match open-ended from 2026-11-15
		const resEnded = findMatchingSeriesOccurrenceStart(
			ongoing,
			'RRULE:FREQ=WEEKLY;COUNT=4',
			[],
			{
				rangeStart: utc('2026-11-15T00:00:00.000Z'),
				rangeEnd: null,
			},
		);
		expect(resEnded).toEqual({ matches: false, firstMatchStartMs: null });
	});

	it('handles open-ended To-only range (rangeStart = null)', () => {
		const earlySeries: DateFilterCandidate = {
			id: 'series-early',
			startDateTime: '2026-10-05T10:00:00.000Z',
			endDateTime: '2026-10-05T11:00:00.000Z',
			startTimeZone: 'UTC',
			status: 'confirmed',
			isPublic: true,
		};
		const lateSeries: DateFilterCandidate = {
			id: 'series-late',
			startDateTime: '2026-12-01T10:00:00.000Z',
			endDateTime: '2026-12-01T11:00:00.000Z',
			startTimeZone: 'UTC',
			status: 'confirmed',
			isPublic: true,
		};

		const endBound = utc('2026-11-20T23:59:59.999Z');

		expect(
			findMatchingSeriesOccurrenceStart(earlySeries, 'RRULE:FREQ=WEEKLY', [], {
				rangeStart: null,
				rangeEnd: endBound,
			}),
		).toEqual({
			matches: true,
			firstMatchStartMs: utc('2026-10-05T10:00:00.000Z').getTime(),
		});

		expect(
			findMatchingSeriesOccurrenceStart(lateSeries, 'RRULE:FREQ=WEEKLY', [], {
				rangeStart: null,
				rangeEnd: endBound,
			}),
		).toEqual({ matches: false, firstMatchStartMs: null });
	});

	it('matches multi-day recurring occurrence starting before rangeStart and ending inside range', () => {
		// Every Monday 10:00Z lasting 48 hours (through Wednesday 10:00Z)
		const multiDaySeries: DateFilterCandidate = {
			id: 'series-multiday',
			startDateTime: '2026-11-02T10:00:00.000Z',
			endDateTime: '2026-11-04T10:00:00.000Z',
			startTimeZone: 'UTC',
			status: 'confirmed',
			isPublic: true,
		};

		// Filter only Tuesday 2026-11-17 -> overlapped by Nov 16 10:00Z .. Nov 18 10:00Z occurrence!
		const res = findMatchingSeriesOccurrenceStart(multiDaySeries, 'RRULE:FREQ=WEEKLY', [], {
			rangeStart: utc('2026-11-17T00:00:00.000Z'),
			rangeEnd: utc('2026-11-17T23:59:59.999Z'),
		});
		expect(res.matches).toBe(true);
		expect(res.firstMatchStartMs).toBe(utc('2026-11-16T10:00:00.000Z').getTime());
	});

	it('excludes series when the only occurrence in range is in exdates', () => {
		const seriesWithExdate: DateFilterCandidate = {
			id: 'series-exdate',
			startDateTime: '2026-11-02T10:00:00.000Z',
			endDateTime: '2026-11-02T11:00:00.000Z',
			exdates: ['2026-11-16T10:00:00.000Z'],
			startTimeZone: 'UTC',
			status: 'confirmed',
			isPublic: true,
		};

		const res = findMatchingSeriesOccurrenceStart(seriesWithExdate, 'RRULE:FREQ=WEEKLY', [], {
			rangeStart: utc('2026-11-16T00:00:00.000Z'),
			rangeEnd: utc('2026-11-16T23:59:59.999Z'),
		});
		expect(res).toEqual({ matches: false, firstMatchStartMs: null });
	});

	it('handles DB exception moved into range and moved out of range', () => {
		const seriesMaster: DateFilterCandidate = {
			id: 'series-exc',
			startDateTime: '2026-11-02T10:00:00.000Z',
			endDateTime: '2026-11-02T11:00:00.000Z',
			startTimeZone: 'UTC',
			status: 'confirmed',
			isPublic: true,
		};

		// Nov 16 Monday occurrence was moved to Nov 18 Wednesday
		const movedException: DateFilterDbInstance = {
			id: 'exc-1',
			recurringEventId: 'series-exc',
			startDateTime: '2026-11-18T15:00:00.000Z',
			endDateTime: '2026-11-18T16:00:00.000Z',
			originalStartTime: { dateTime: '2026-11-16T10:00:00.000Z' },
			status: 'confirmed',
			isPublic: true,
		};

		// Original slot (Nov 16) should NOT match because exception moved it away
		expect(
			findMatchingSeriesOccurrenceStart(seriesMaster, 'RRULE:FREQ=WEEKLY', [movedException], {
				rangeStart: utc('2026-11-16T00:00:00.000Z'),
				rangeEnd: utc('2026-11-16T23:59:59.999Z'),
			}),
		).toEqual({ matches: false, firstMatchStartMs: null });

		// Moved slot (Nov 18) SHOULD match
		expect(
			findMatchingSeriesOccurrenceStart(seriesMaster, 'RRULE:FREQ=WEEKLY', [movedException], {
				rangeStart: utc('2026-11-18T00:00:00.000Z'),
				rangeEnd: utc('2026-11-18T23:59:59.999Z'),
			}),
		).toEqual({
			matches: true,
			firstMatchStartMs: utc('2026-11-18T15:00:00.000Z').getTime(),
		});
	});

	it('respects excludeCancelled for DB exceptions without re-synthesizing virtual occurrence', () => {
		const seriesMaster: DateFilterCandidate = {
			id: 'series-cancel',
			startDateTime: '2026-11-02T10:00:00.000Z',
			endDateTime: '2026-11-02T11:00:00.000Z',
			startTimeZone: 'UTC',
			status: 'confirmed',
			isPublic: true,
		};

		const cancelledException: DateFilterDbInstance = {
			id: 'exc-cancel',
			recurringEventId: 'series-cancel',
			startDateTime: '2026-11-16T10:00:00.000Z',
			endDateTime: '2026-11-16T11:00:00.000Z',
			originalStartTime: { dateTime: '2026-11-16T10:00:00.000Z' },
			status: 'cancelled',
			isPublic: true,
		};

		// excludeCancelled: true -> excluded (must not synthesize virtual slot over cancelled DB row)
		expect(
			findMatchingSeriesOccurrenceStart(
				seriesMaster,
				'RRULE:FREQ=WEEKLY',
				[cancelledException],
				{
					rangeStart: utc('2026-11-16T00:00:00.000Z'),
					rangeEnd: utc('2026-11-16T23:59:59.999Z'),
					excludeCancelled: true,
				},
			),
		).toEqual({ matches: false, firstMatchStartMs: null });

		// excludeCancelled: false -> included
		expect(
			findMatchingSeriesOccurrenceStart(
				seriesMaster,
				'RRULE:FREQ=WEEKLY',
				[cancelledException],
				{
					rangeStart: utc('2026-11-16T00:00:00.000Z'),
					rangeEnd: utc('2026-11-16T23:59:59.999Z'),
					excludeCancelled: false,
				},
			),
		).toEqual({
			matches: true,
			firstMatchStartMs: utc('2026-11-16T10:00:00.000Z').getTime(),
		});
	});

	it('intersects excludePast with date range cleanly', () => {
		const seriesMaster: DateFilterCandidate = {
			id: 'series-past-intersect',
			startDateTime: '2026-11-02T10:00:00.000Z',
			endDateTime: '2026-11-02T11:00:00.000Z',
			startTimeZone: 'UTC',
			status: 'confirmed',
			isPublic: true,
		};

		const now = utc('2026-11-15T12:00:00.000Z');

		// Range completely in the past (Nov 1..Nov 10) with excludePast = true -> no match
		expect(
			findMatchingSeriesOccurrenceStart(seriesMaster, 'RRULE:FREQ=WEEKLY', [], {
				rangeStart: utc('2026-11-01T00:00:00.000Z'),
				rangeEnd: utc('2026-11-10T23:59:59.999Z'),
				excludePast: true,
				now,
			}),
		).toEqual({ matches: false, firstMatchStartMs: null });

		// Range spanning past and future (Nov 1..Nov 25) with excludePast = true -> first match is Nov 16 (not Nov 2 or Nov 9)
		expect(
			findMatchingSeriesOccurrenceStart(seriesMaster, 'RRULE:FREQ=WEEKLY', [], {
				rangeStart: utc('2026-11-01T00:00:00.000Z'),
				rangeEnd: utc('2026-11-25T23:59:59.999Z'),
				excludePast: true,
				now,
			}),
		).toEqual({
			matches: true,
			firstMatchStartMs: utc('2026-11-16T10:00:00.000Z').getTime(),
		});
	});
});
