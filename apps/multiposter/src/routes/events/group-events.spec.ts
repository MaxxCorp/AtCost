import { describe, it, expect } from 'vitest';
import {
	getAllSeriesOccurrences,
	groupSeriesEvents,
	unrollSeriesEvents,
} from '#lib/utils/event-series.js';

describe('groupEvents instance ordering', () => {
	it('orders event series instances by start date ascending', () => {
		const rawEvents = [
			{ id: 'master1', summary: 'Series Master', recurringEventId: null },
			{ id: 'inst3', summary: 'Instance 3', recurringEventId: 'master1', startDateTime: '2026-08-15T10:00:00Z' },
			{ id: 'inst1', summary: 'Instance 1', recurringEventId: 'master1', startDateTime: '2026-08-01T10:00:00Z' },
			{ id: 'inst2', summary: 'Instance 2', recurringEventId: 'master1', startDateTime: '2026-08-08T10:00:00Z' },
		];

		const grouped = groupSeriesEvents(rawEvents);
		expect(grouped).toHaveLength(1);
		expect(grouped[0].instances).toHaveLength(3);
		expect(grouped[0].instances[0].id).toBe('inst1');
		expect(grouped[0].instances[1].id).toBe('inst2');
		expect(grouped[0].instances[2].id).toBe('inst3');
	});

	it('merges hydrated child instance fields over slim master.instances stubs', () => {
		const rawEvents = [
			{
				id: 'master1',
				summary: 'Series Master',
				recurringEventId: null,
				rooms: ['Room A'],
				resources: [{ id: 'res-a', name: 'Room A', type: 'room' }],
				instances: [
					{ id: 'inst1', summary: 'Series Master', startDateTime: '2026-08-01T10:00:00Z', status: 'confirmed' },
				],
			},
			{
				id: 'inst1',
				summary: 'Instance 1 Custom',
				recurringEventId: 'master1',
				startDateTime: '2026-08-01T10:00:00Z',
				rooms: ['Room B'],
				resources: [{ id: 'res-b', name: 'Room B', type: 'room' }],
				prepMinutes: 15,
			},
		];

		const grouped = groupSeriesEvents(rawEvents);
		expect(grouped).toHaveLength(1);
		expect(grouped[0].instances).toHaveLength(1);
		expect(grouped[0].instances[0].rooms).toEqual(['Room B']);
		expect(grouped[0].instances[0].resources).toEqual([{ id: 'res-b', name: 'Room B', type: 'room' }]);
		expect(grouped[0].instances[0].prepMinutes).toBe(15);
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

		const grouped = groupSeriesEvents(filteredRaw);
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

	it('preserves and unrolls all instances in compact mode when legacy series changes from count to until date', () => {
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

		const grouped = groupSeriesEvents(rawEvents);
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

describe('unrollSeriesEvents instance field preservation', () => {
	const masterBase = {
		id: 'master-1',
		summary: 'Weekly Choir',
		startDateTime: '2026-11-02T18:00:00Z',
		endDateTime: '2026-11-02T20:00:00Z',
		status: 'confirmed',
		recurrence: ['RRULE:FREQ=WEEKLY;COUNT=3'],
		isAllDay: false,
		prepMinutes: 30,
		teardownMinutes: 15,
		locations: [{ id: 'loc-a', name: 'Hall A' }],
		resources: [{ id: 'res-a', name: 'Room 101', type: 'room', locationId: 'loc-a' }],
		rooms: ['Room 101'],
		locationIds: ['loc-a'],
		tags: [{ id: 'tag-series', name: 'Series' }, { id: 'tag-music', name: 'Music' }],
		user: { id: 'user-1', name: 'Alice' },
		createdAt: '2026-10-01T08:00:00Z',
		updatedAt: '2026-10-01T08:00:00Z',
	};

	it('preserves overridden instance fields on materialized exceptions while inheriting master defaults on virtual instances', () => {
		const rawEvents = [
			{
				...masterBase,
				instances: [
					{
						id: 'inst-exc-1',
						summary: 'Weekly Choir (Special)',
						startDateTime: '2026-11-09T18:00:00Z',
						endDateTime: '2026-11-09T20:30:00Z',
						status: 'tentative',
						isAllDay: true,
						prepMinutes: 0,
						teardownMinutes: 0,
						locations: [{ id: 'loc-b', name: 'Hall B' }],
						resources: [{ id: 'res-b', name: 'Room 202', type: 'room', locationId: 'loc-b' }],
						rooms: ['Room 202'],
						locationIds: ['loc-b'],
						tags: [{ id: 'tag-series', name: 'Series' }],
						user: { id: 'user-2', name: 'Bob' },
						createdAt: '2026-10-10T09:00:00Z',
						updatedAt: '2026-10-12T10:00:00Z',
					},
					{
						id: 'master-1_inst_2026-11-16T18:00:00.000Z',
						startDateTime: '2026-11-16T18:00:00.000Z',
						endDateTime: '2026-11-16T20:00:00.000Z',
					},
				],
			},
		];

		const unrolled = unrollSeriesEvents(rawEvents, { sortField: 'startDateTime', sortOrder: 'asc' });
		expect(unrolled).toHaveLength(3);

		// Occurrence #1 (Master)
		expect(unrolled[0].id).toBe('master-1');
		expect(unrolled[0].rooms).toEqual(['Room 101']);
		expect(unrolled[0].locations).toEqual([{ id: 'loc-a', name: 'Hall A' }]);
		expect(unrolled[0].prepMinutes).toBe(30);

		// Occurrence #2 (Materialized exception keeps its own overrides)
		expect(unrolled[1].id).toBe('inst-exc-1');
		expect(unrolled[1].summary).toBe('Weekly Choir (Special)');
		expect(unrolled[1].status).toBe('tentative');
		expect(unrolled[1].isAllDay).toBe(true);
		expect(unrolled[1].prepMinutes).toBe(0);
		expect(unrolled[1].teardownMinutes).toBe(0);
		expect(unrolled[1].rooms).toEqual(['Room 202']);
		expect(unrolled[1].resources).toEqual([{ id: 'res-b', name: 'Room 202', type: 'room', locationId: 'loc-b' }]);
		expect(unrolled[1].locations).toEqual([{ id: 'loc-b', name: 'Hall B' }]);
		expect(unrolled[1].tags).toEqual([{ id: 'tag-series', name: 'Series' }]);
		expect(unrolled[1].user).toEqual({ id: 'user-2', name: 'Bob' });
		expect(unrolled[1].updatedAt).toBe('2026-10-12T10:00:00Z');
		expect(unrolled[1].createdAt).toBe('2026-10-10T09:00:00Z');

		// Occurrence #3 (Virtual instance inherits from master)
		expect(unrolled[2].id).toBe('master-1_inst_2026-11-16T18:00:00.000Z');
		expect(unrolled[2].rooms).toEqual(['Room 101']);
		expect(unrolled[2].locations).toEqual([{ id: 'loc-a', name: 'Hall A' }]);
		expect(unrolled[2].prepMinutes).toBe(30);
	});

	it('preserves explicitly cleared rooms ([]) on materialized exceptions', () => {
		const rawEvents = [
			{
				...masterBase,
				instances: [
					{
						id: 'inst-cleared-room',
						startDateTime: '2026-11-09T18:00:00Z',
						endDateTime: '2026-11-09T20:00:00Z',
						resources: [],
						rooms: [],
					},
				],
			},
		];

		const unrolled = unrollSeriesEvents(rawEvents, { sortField: 'startDateTime', sortOrder: 'asc' });
		expect(unrolled).toHaveLength(2);
		expect(unrolled[1].id).toBe('inst-cleared-room');
		expect(unrolled[1].rooms).toEqual([]);
		expect(unrolled[1].resources).toEqual([]);
	});

	it('applies locationFilter and tagFilter per unrolled occurrence', () => {
		const rawEvents = [
			{
				...masterBase,
				instances: [
					{
						id: 'inst-moved-loc-b',
						startDateTime: '2026-11-09T18:00:00Z',
						endDateTime: '2026-11-09T20:00:00Z',
						locations: [{ id: 'loc-b', name: 'Hall B' }],
						resources: [{ id: 'res-b', name: 'Room 202', type: 'room', locationId: 'loc-b' }],
						rooms: ['Room 202'],
						locationIds: ['loc-b'],
						tags: [{ id: 'tag-series', name: 'Series' }],
					},
				],
			},
		];

		const onlyLocA = unrollSeriesEvents(rawEvents, {
			sortField: 'startDateTime',
			sortOrder: 'asc',
			locationFilter: { include: ['loc-a'] },
		});
		expect(onlyLocA.map((e) => e.id)).toEqual(['master-1']);

		const onlyLocB = unrollSeriesEvents(rawEvents, {
			sortField: 'startDateTime',
			sortOrder: 'asc',
			locationFilter: { include: ['loc-b'] },
		});
		expect(onlyLocB.map((e) => e.id)).toEqual(['inst-moved-loc-b']);

		const onlyMusicTag = unrollSeriesEvents(rawEvents, {
			sortField: 'startDateTime',
			sortOrder: 'asc',
			tagFilter: { include: ['tag-music'] },
		});
		expect(onlyMusicTag.map((e) => e.id)).toEqual(['master-1']);
	});
});
