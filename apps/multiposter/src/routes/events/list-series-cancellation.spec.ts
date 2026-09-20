import { describe, it, expect } from 'vitest';
import { expandRecurrence } from '$lib/server/events/recurrence';

describe('Series Cancellation and Recurrence Filtering', () => {
	it('skips synthesizing virtual instances for slots that already have DB instances (e.g. cancelled)', () => {
		const master = {
			id: 'master-1',
			seriesId: 'series-1',
			startDateTime: new Date('2026-09-01T10:00:00Z'),
			endDateTime: new Date('2026-09-01T11:00:00Z'),
			status: 'confirmed',
			recurrence: ['RRULE:FREQ=WEEKLY;COUNT=4'],
		};

		// In DB, instance 2 (2026-09-08) is cancelled
		const existingDbInstances = [
			{
				id: 'inst-1',
				recurringEventId: 'master-1',
				seriesId: 'series-1',
				startDateTime: new Date('2026-09-01T10:00:00Z'),
				status: 'confirmed',
			},
			{
				id: 'inst-2',
				recurringEventId: 'master-1',
				seriesId: 'series-1',
				startDateTime: new Date('2026-09-08T10:00:00Z'),
				status: 'cancelled',
			},
		];

		// When excludeCancelled is true, rawResults from baseQuery only contains confirmed instances
		const rawResults: any[] = existingDbInstances.filter(i => i.status !== 'cancelled');
		expect(rawResults).toHaveLength(1);
		expect(rawResults[0].id).toBe('inst-1');

		// Build existingKeys tracking ALL existing DB instances (including cancelled)
		const existingKeys = new Set<string>();

		// 1. From rawResults
		for (const r of rawResults) {
			const masterId = r.recurringEventId || r.id;
			if (r.startDateTime) {
				const time = new Date(r.startDateTime).getTime();
				existingKeys.add(`${masterId}_${time}`);
				if (r.seriesId) existingKeys.add(`${r.seriesId}_${time}`);
			}
		}

		// 2. From all DB instances (including cancelled)
		for (const dbInst of existingDbInstances) {
			const masterId = dbInst.recurringEventId || dbInst.seriesId;
			if (dbInst.startDateTime) {
				const time = new Date(dbInst.startDateTime).getTime();
				existingKeys.add(`${masterId}_${time}`);
				if (dbInst.seriesId) existingKeys.add(`${dbInst.seriesId}_${time}`);
			}
		}

		// Verify that the cancelled instance's slot is tracked in existingKeys
		const cancelledTime = new Date('2026-09-08T10:00:00Z').getTime();
		expect(existingKeys.has(`master-1_${cancelledTime}`)).toBe(true);

		// Now simulate recurrence expansion
		const instances = expandRecurrence(
			'FREQ=WEEKLY;COUNT=4',
			master.startDateTime,
			master.endDateTime,
			100,
			false,
			'UTC'
		);

		// Expand occurrences for the range
		const startD = new Date('2026-09-01T00:00:00Z');
		const endD = new Date('2026-09-30T23:59:59Z');

		for (const inst of instances) {
			const instTime = inst.date.getTime();
			if (instTime >= startD.getTime() && instTime <= endD.getTime()) {
				const key = `${master.id}_${instTime}`;
				const seriesKey = master.seriesId ? `${master.seriesId}_${instTime}` : null;
				if (!existingKeys.has(key) && (!seriesKey || !existingKeys.has(seriesKey))) {
					rawResults.push({
						...master,
						id: `${master.id}_inst_${inst.date.toISOString()}`,
						recurringEventId: master.id,
						startDateTime: inst.date,
						endDateTime: inst.end || master.endDateTime
					});
					existingKeys.add(key);
					if (seriesKey) existingKeys.add(seriesKey);
				}
			}
		}

		// Verify results:
		// 1. inst-1 (2026-09-01) is present
		// 2. inst-2 (2026-09-08) is NOT present (was cancelled and NOT re-synthesized)
		// 3. 2026-09-15 is synthesized
		// 4. 2026-09-22 is synthesized
		expect(rawResults).toHaveLength(3);
		const dates = rawResults.map(r => new Date(r.startDateTime).toISOString());
		expect(dates).toContain('2026-09-01T10:00:00.000Z');
		expect(dates).not.toContain('2026-09-08T10:00:00.000Z');
		expect(dates).toContain('2026-09-15T10:00:00.000Z');
		expect(dates).toContain('2026-09-22T10:00:00.000Z');

		// None of the results should be cancelled
		expect(rawResults.every(r => r.status !== 'cancelled')).toBe(true);
	});

	it('defensive filtering eliminates any cancelled event from results', () => {
		const rawResults = [
			{ id: 'evt-1', summary: 'Active Event', status: 'confirmed' },
			{ id: 'evt-2', summary: 'Cancelled Event', status: 'cancelled' },
			{ id: 'inst-3', summary: 'Cancelled Series Instance', status: 'cancelled', recurringEventId: 'master-1' },
		];

		const excludeCancelled = true;
		let results = rawResults;
		if (excludeCancelled) {
			results = results.filter((e: any) => e.status !== 'cancelled');
		}

		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('evt-1');
	});
});
