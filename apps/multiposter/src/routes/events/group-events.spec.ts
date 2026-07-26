import { describe, it, expect } from 'vitest';

function groupEvents(rawEvents: any[]) {
	return rawEvents
		.filter((e: any) => !e.recurringEventId)
		.map((master: any) => {
			const instances = rawEvents
				.filter((e: any) => e.recurringEventId === master.id)
				.sort((a: any, b: any) => {
					const dateA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
					const dateB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
					return dateA - dateB;
				});
			return { ...master, instances };
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
});
