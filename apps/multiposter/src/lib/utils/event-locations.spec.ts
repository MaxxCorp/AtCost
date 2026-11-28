import { describe, it, expect } from 'vitest';
import {
	getVisibleEventLocations,
	getEventLocationNames,
	getAdditionalSeriesLocations
} from './event-locations.js';

describe('event-locations helpers', () => {
	const locPublicA = {
		id: 'loc-a',
		name: 'Main Hall',
		street: 'Main St',
		houseNumber: '1',
		zip: '10115',
		city: 'Berlin',
		isPublic: true
	};

	const locPublicB = {
		id: 'loc-b',
		name: 'Garden Annex',
		street: 'Garden Ave',
		houseNumber: '2',
		zip: '10117',
		city: 'Berlin',
		isPublic: true
	};

	const locPrivateC = {
		id: 'loc-c',
		name: 'Staff Room',
		street: 'Back Alley',
		houseNumber: '3',
		zip: '10119',
		city: 'Berlin',
		isPublic: false
	};

	it('returns all visible public locations and excludes non-public locations when allowInternal is false', () => {
		const evt = {
			id: 'evt-1',
			locations: [locPublicA, { location: locPublicB }, locPrivateC]
		};

		const publicOnly = getVisibleEventLocations(evt, { allowInternal: false });
		expect(publicOnly.map((l) => l.id)).toEqual(['loc-a', 'loc-b']);

		const withInternal = getVisibleEventLocations(evt, { allowInternal: true });
		expect(withInternal.map((l) => l.id)).toEqual(['loc-a', 'loc-b', 'loc-c']);
	});

	it('includes room resource locations and deduplicates against direct event locations', () => {
		const evt = {
			id: 'evt-2',
			locations: [locPublicA],
			resources: [
				{ id: 'res-1', name: 'Room 1', type: 'room', location: locPublicA },
				{ id: 'res-2', name: 'Room 2', type: 'room', location: locPublicB },
				{ id: 'res-3', name: 'Projector', type: 'equipment', location: locPrivateC }
			]
		};

		const locs = getVisibleEventLocations(evt, { allowInternal: true });
		expect(locs.map((l) => l.id)).toEqual(['loc-a', 'loc-b']);
		expect(getEventLocationNames(evt, { allowInternal: true })).toEqual(['Main Hall', 'Garden Annex']);
	});

	it('collects additional locations configured on other series instances or seriesMaster', () => {
		const seriesMaster = {
			id: 'master-1',
			startDateTime: '2026-12-01T10:00:00.000Z',
			locations: [locPublicA],
			instances: [
				{
					id: 'inst-1',
					startDateTime: '2026-12-08T10:00:00.000Z',
					locations: [locPublicA, locPublicB]
				},
				{
					id: 'inst-2',
					startDateTime: '2026-12-15T10:00:00.000Z',
					locations: [locPublicB, locPrivateC]
				}
			]
		};

		const masterVisible = getVisibleEventLocations(seriesMaster, { allowInternal: false });
		expect(masterVisible.map((l) => l.id)).toEqual(['loc-a']);

		const publicAdditional = getAdditionalSeriesLocations(seriesMaster, masterVisible, { allowInternal: false });
		expect(publicAdditional).toHaveLength(1);
		expect(publicAdditional[0].location.id).toBe('loc-b');
		expect(publicAdditional[0].occurrences.map((o) => o.id)).toEqual(['inst-1', 'inst-2']);

		const internalAdditional = getAdditionalSeriesLocations(seriesMaster, masterVisible, { allowInternal: true });
		expect(internalAdditional.map((g) => g.location.id)).toEqual(['loc-b', 'loc-c']);
		expect(internalAdditional[1].occurrences.map((o) => o.id)).toEqual(['inst-2']);
	});

	it('collects master and sibling locations when viewing a single series instance', () => {
		const instanceEvent = {
			id: 'inst-2',
			recurringEventId: 'master-1',
			startDateTime: '2026-12-15T10:00:00.000Z',
			locations: [locPublicB],
			seriesMaster: {
				id: 'master-1',
				startDateTime: '2026-12-01T10:00:00.000Z',
				locations: [locPublicA],
				instances: [
					{
						id: 'inst-2',
						startDateTime: '2026-12-15T10:00:00.000Z',
						locations: [locPublicB]
					}
				]
			}
		};

		const currentLocs = getVisibleEventLocations(instanceEvent, { allowInternal: false });
		expect(currentLocs.map((l) => l.id)).toEqual(['loc-b']);

		const otherLocs = getAdditionalSeriesLocations(instanceEvent, currentLocs, { allowInternal: false });
		expect(otherLocs).toHaveLength(1);
		expect(otherLocs[0].location.id).toBe('loc-a');
		expect(otherLocs[0].occurrences.map((o) => o.id)).toEqual(['master-1']);
	});
});
