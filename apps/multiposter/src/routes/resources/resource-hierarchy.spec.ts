import { describe, it, expect } from 'vitest';
import { sortHierarchically, sortItemsList } from '@ac/ui/utils';

describe('Resource Hierarchy Sorting', () => {
	it('places children directly beneath their parents in pre-order DFS instead of grouping by level', () => {
		const resources = [
			{ id: 'r1', name: 'Room A', maxOccupancy: 100, parentIds: [], childIds: ['c1', 'c2'], level: 0 },
			{ id: 'r2', name: 'Room B', maxOccupancy: 200, parentIds: [], childIds: ['c3'], level: 0 },
			{ id: 'c1', name: 'Section A1', maxOccupancy: 50, parentIds: ['r1'], childIds: [], level: 1 },
			{ id: 'c2', name: 'Section A2', maxOccupancy: 60, parentIds: ['r1'], childIds: ['g1'], level: 1 },
			{ id: 'c3', name: 'Section B1', maxOccupancy: 80, parentIds: ['r2'], childIds: [], level: 1 },
			{ id: 'g1', name: 'Projector', maxOccupancy: null, parentIds: ['c2'], childIds: [], level: 2 },
		];

		const sorted = sortHierarchically(resources, 'maxOccupancy', 'desc');
		expect(sorted.map((r) => ({ id: r.id, level: r.level }))).toEqual([
			{ id: 'r2', level: 0 },
			{ id: 'c3', level: 1 },
			{ id: 'r1', level: 0 },
			{ id: 'c2', level: 1 },
			{ id: 'g1', level: 2 },
			{ id: 'c1', level: 1 },
		]);
	});

	it('keeps children under a parent even when parent has null maxOccupancy and children have occupancy', () => {
		const resources = [
			{ id: 'building', name: 'Main Hall', maxOccupancy: null, parentIds: [], childIds: ['sub1', 'sub2'] },
			{ id: 'standalone', name: 'Meeting Room', maxOccupancy: 40, parentIds: [], childIds: [] },
			{ id: 'sub1', name: 'Wing West', maxOccupancy: 80, parentIds: ['building'], childIds: [] },
			{ id: 'sub2', name: 'Wing East', maxOccupancy: 20, parentIds: ['building'], childIds: [] },
		];

		const sorted = sortHierarchically(resources, 'maxOccupancy', 'desc');
		expect(sorted.map((r) => ({ id: r.id, level: r.level }))).toEqual([
			{ id: 'standalone', level: 0 },
			{ id: 'building', level: 0 },
			{ id: 'sub1', level: 1 },
			{ id: 'sub2', level: 1 },
		]);
	});

	it('recomputes level to 0 when parent is missing from filtered/grouped subset', () => {
		const filtered = [
			{ id: 'c1', name: 'Section A1', maxOccupancy: 50, parentIds: ['missing-parent'], childIds: ['g1'], level: 1 },
			{ id: 'g1', name: 'Projector', maxOccupancy: null, parentIds: ['c1'], childIds: [], level: 2 },
		];

		const sorted = sortHierarchically(filtered, 'maxOccupancy', 'desc');
		expect(sorted.map((r) => ({ id: r.id, level: r.level }))).toEqual([
			{ id: 'c1', level: 0 },
			{ id: 'g1', level: 1 },
		]);
	});

	it('emits multi-parent resources only once and handles cycles safely', () => {
		const dag = [
			{ id: 'p1', name: 'Alpha', parentIds: [], childIds: ['shared'] },
			{ id: 'p2', name: 'Beta', parentIds: [], childIds: ['shared'] },
			{ id: 'shared', name: 'Shared Mic', parentIds: ['p1', 'p2'], childIds: [] },
		];

		const sortedDag = sortHierarchically(dag, 'name', 'asc');
		expect(sortedDag.map((r) => r.id)).toEqual(['p1', 'shared', 'p2']);

		const cycle = [
			{ id: 'a', name: 'A', parentIds: ['b'], childIds: ['b'] },
			{ id: 'b', name: 'B', parentIds: ['a'], childIds: ['a'] },
		];
		const sortedCycle = sortHierarchically(cycle, 'name', 'asc');
		expect(sortedCycle.map((r) => r.id)).toEqual(['a', 'b']);
	});

	it('preserves flat sorting behavior in sortItemsList', () => {
		const items = [
			{ id: '1', name: 'B', maxOccupancy: 10 },
			{ id: '2', name: 'A', maxOccupancy: null },
			{ id: '3', name: 'C', maxOccupancy: 50 },
		];
		expect(sortItemsList(items, 'maxOccupancy', 'desc').map((i) => i.id)).toEqual(['3', '1', '2']);
	});
});
