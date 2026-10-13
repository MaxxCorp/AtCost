import { describe, it, expect } from 'vitest';

function groupEvents(rawEvents: any[]) {
	return rawEvents
		.filter((e: any) => !e.recurringEventId)
		.map((master: any) => {
			const existingInstances = master.instances || [];
			const rawChildInstances = rawEvents
				.filter((e: any) => e.recurringEventId === master.id);
			const combined = [...existingInstances];
			const existingIds = new Set(combined.map((i: any) => i.id));
			for (const child of rawChildInstances) {
				if (!existingIds.has(child.id)) {
					combined.push(child);
					existingIds.add(child.id);
				}
			}
			combined.sort((a: any, b: any) => {
				const dateA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
				const dateB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
				return dateA - dateB;
			});
			return { ...master, instances: combined };
		});
}

describe('groupEvents instance ordering', () => {
	it('orders event series instances by start date ascending', () => {
		const rawEvents = [
			{ id: 'master1', summary: 'Series Master', recurringEventId: null },
			{ id: 'inst3', summary: 'Instance 3', recurringEventId: 'master1', startDateTime: '2026-08-15T10:00:00Z' },
			{ id: 'inst1', summary: 'Instance 1', recurringEventId: 'master1', startDateTime: '2026-08-01T10:00:00Z' },
			{ id: 'inst2', summary: 'Instance 2', recurringEventId: 'master1', startDateTime: '2026-08-08T10:00:00Z' },
		];

		const grouped = groupEvents(rawEvents);
		expect(grouped).toHaveLength(1);
		expect(grouped[0].instances).toHaveLength(3);
		expect(grouped[0].instances[0].id).toBe('inst1');
		expect(grouped[0].instances[1].id).toBe('inst2');
		expect(grouped[0].instances[2].id).toBe('inst3');
	});

	it('filters out past instances when excludePast filter is applied', () => {
		const now = new Date('2026-08-05T00:00:00Z');
		const rawEvents = [
			{ id: 'master1', summary: 'Series Master', recurringEventId: null, endDateTime: '2026-08-15T12:00:00Z' },
			{ id: 'inst1', summary: 'Past Instance', recurringEventId: 'master1', endDateTime: '2026-08-01T10:00:00Z' },
			{ id: 'inst2', summary: 'Future Instance', recurringEventId: 'master1', endDateTime: '2026-08-10T10:00:00Z' },
		];

		const filteredRaw = rawEvents.filter((e: any) => {
			if (!e.recurringEventId) return true;
			const start = e.startDateTime ? new Date(e.startDateTime) : null;
			const end = e.endDateTime ? new Date(e.endDateTime) : null;
			const isStartFuture = start ? start >= now : false;
			const isEndFuture = end ? end >= now : false;
			return isStartFuture || isEndFuture;
		});

		const grouped = groupEvents(filteredRaw);
		expect(grouped).toHaveLength(1);
		expect(grouped[0].instances).toHaveLength(1);
		expect(grouped[0].instances[0].id).toBe('inst2');
	});

	it('identifies and filters events by series status correctly', () => {
		const rawEvents = [
			{ id: 'single1', summary: 'Single Event', seriesId: null, recurrence: null, recurringEventId: null },
			{ id: 'seriesMaster', summary: 'Series Master', seriesId: 'series-uuid', recurrence: ['RRULE:FREQ=WEEKLY'], recurringEventId: null },
			{ id: 'seriesInst1', summary: 'Series Instance', seriesId: 'series-uuid', recurrence: null, recurringEventId: 'seriesMaster' },
		];

		const isSeries = (e: any) => Boolean(e.seriesId || e.recurringEventId || (e.recurrence && e.recurrence.length > 0));

		// Non-series filter (excludeSeries = true)
		const nonSeriesEvents = rawEvents.filter(e => !isSeries(e));
		expect(nonSeriesEvents).toHaveLength(1);
		expect(nonSeriesEvents[0].id).toBe('single1');

		// Only-series filter (onlySeries = true)
		const onlySeriesEvents = rawEvents.filter(e => isSeries(e));
		expect(onlySeriesEvents).toHaveLength(2);
		expect(onlySeriesEvents.map(e => e.id)).toEqual(['seriesMaster', 'seriesInst1']);
	});

	it('preserves and unrolls all instances in compact mode when legacy series changes from count to until date', async () => {
		const { getAllSeriesOccurrences } = await import('#lib/utils/event-series.js');

		// Master event with 2 legacy physical child instances, extended with 3 virtual instances up to until date
		const legacyMaster = {
			id: 'master-uuid',
			summary: 'Weekly Seminar',
			startDateTime: '2026-10-01T10:00:00Z',
			endDateTime: '2026-10-01T11:00:00Z',
			seriesId: 'series-legacy-uuid',
			recurrence: ['RRULE:FREQ=WEEKLY;UNTIL=20261105T235959Z'],
			instances: [
				{ id: 'inst-physical-1', startDateTime: '2026-10-08T10:00:00Z', endDateTime: '2026-10-08T11:00:00Z' },
				{ id: 'inst-physical-2', startDateTime: '2026-10-15T10:00:00Z', endDateTime: '2026-10-15T11:00:00Z' },
				{ id: 'master-uuid_inst_2026-10-22T10:00:00.000Z', startDateTime: '2026-10-22T10:00:00.000Z', endDateTime: '2026-10-22T11:00:00.000Z' },
				{ id: 'master-uuid_inst_2026-10-29T10:00:00.000Z', startDateTime: '2026-10-29T10:00:00.000Z', endDateTime: '2026-10-29T11:00:00.000Z' },
				{ id: 'master-uuid_inst_2026-11-05T10:00:00.000Z', startDateTime: '2026-11-05T10:00:00.000Z', endDateTime: '2026-11-05T11:00:00.000Z' }
			],
			seriesMaster: {
				id: 'master-uuid',
				summary: 'Weekly Seminar',
				startDateTime: '2026-10-01T10:00:00Z',
				endDateTime: '2026-10-01T11:00:00Z',
				recurrence: ['RRULE:FREQ=WEEKLY;UNTIL=20261105T235959Z']
			}
		};

		const rawEvents = [
			legacyMaster,
			{ id: 'inst-physical-1', recurringEventId: 'master-uuid', startDateTime: '2026-10-08T10:00:00Z' },
			{ id: 'inst-physical-2', recurringEventId: 'master-uuid', startDateTime: '2026-10-15T10:00:00Z' },
		];

		const grouped = groupEvents(rawEvents);
		expect(grouped).toHaveLength(1);
		expect(grouped[0].instances).toHaveLength(5);

		// Compact representation card resolves occurrences for dropdown
		const event = grouped[0];
		const allInstances = getAllSeriesOccurrences(event.isSeriesInstance ? (event.seriesMaster || event) : event);
		// 1 master + 5 instances = 6 total accessible occurrences
		expect(allInstances).toHaveLength(6);
		expect(allInstances[0].id).toBe('master-uuid');
		expect(allInstances[1].id).toBe('inst-physical-1');
		expect(allInstances[2].id).toBe('inst-physical-2');
		expect(allInstances[3].id).toBe('master-uuid_inst_2026-10-22T10:00:00.000Z');
		expect(allInstances[4].id).toBe('master-uuid_inst_2026-10-29T10:00:00.000Z');
		expect(allInstances[5].id).toBe('master-uuid_inst_2026-11-05T10:00:00.000Z');
	});
});
