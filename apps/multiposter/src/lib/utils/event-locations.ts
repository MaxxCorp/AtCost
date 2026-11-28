export interface EventLocationOccurrenceRef {
	id: string;
	startDateTime: string | null;
}

export interface AdditionalSeriesLocationGroup {
	location: any;
	occurrences: EventLocationOccurrenceRef[];
}

function unwrapLocation(locOrAssoc: any): any | null {
	if (!locOrAssoc || typeof locOrAssoc !== 'object') return null;
	const loc = locOrAssoc.location && typeof locOrAssoc.location === 'object' ? locOrAssoc.location : locOrAssoc;
	if (!loc || (!loc.id && !loc.name)) return null;
	return loc;
}

function getLocationKey(loc: any): string {
	if (loc?.id) return String(loc.id);
	return String(loc?.name || '').trim().toLowerCase();
}

function isLocationVisible(loc: any, allowInternal: boolean): boolean {
	if (!loc) return false;
	return allowInternal || loc.isPublic !== false;
}

/**
 * Extracts all visible, deduplicated locations configured directly on an event
 * or via its associated room resources.
 */
export function getVisibleEventLocations(
	event: any,
	options: { allowInternal?: boolean } = {}
): any[] {
	if (!event) return [];
	const allowInternal = Boolean(options.allowInternal);
	const result: any[] = [];
	const seen = new Set<string>();

	const addLoc = (rawLoc: any) => {
		const loc = unwrapLocation(rawLoc);
		if (!loc || !isLocationVisible(loc, allowInternal)) return;
		const key = getLocationKey(loc);
		if (!key || seen.has(key)) return;
		seen.add(key);
		result.push(loc);
	};

	if (Array.isArray(event.locations)) {
		for (const item of event.locations) {
			addLoc(item);
		}
	}

	if (Array.isArray(event.resources)) {
		for (const rawRes of event.resources) {
			const res = rawRes?.resource || rawRes;
			if (!res || typeof res !== 'object') continue;
			if (res.type === 'room' && res.location) {
				addLoc(res.location);
			}
		}
	}

	return result;
}

/**
 * Formats a concise comma-separated list of visible location names for an event or instance.
 */
export function getEventLocationNames(
	event: any,
	options: { allowInternal?: boolean } = {}
): string[] {
	return getVisibleEventLocations(event, options)
		.map((l) => String(l.name || '').trim())
		.filter(Boolean);
}

/**
 * Collects additional visible locations configured on other occurrences of a series
 * (seriesMaster or sibling instances) that are not already present in `currentLocations`.
 */
export function getAdditionalSeriesLocations(
	event: any,
	currentLocations: any[],
	options: { allowInternal?: boolean } = {}
): AdditionalSeriesLocationGroup[] {
	if (!event) return [];
	const allowInternal = Boolean(options.allowInternal);

	const primaryKeys = new Set<string>();
	for (const loc of currentLocations || []) {
		const unwrapped = unwrapLocation(loc);
		if (unwrapped) {
			const key = getLocationKey(unwrapped);
			if (key) primaryKeys.add(key);
		}
	}

	const groups = new Map<string, AdditionalSeriesLocationGroup>();
	const seenOccurrencesPerLoc = new Map<string, Set<string>>();

	const recordCandidate = (rawItem: any) => {
		if (!rawItem || !rawItem.id) return;
		if (rawItem.id === event.id) return;
		const itemLocs = getVisibleEventLocations(rawItem, { allowInternal });
		for (const loc of itemLocs) {
			const key = getLocationKey(loc);
			if (!key || primaryKeys.has(key)) continue;

			let group = groups.get(key);
			if (!group) {
				group = { location: loc, occurrences: [] };
				groups.set(key, group);
				seenOccurrencesPerLoc.set(key, new Set());
			}
			const occSet = seenOccurrencesPerLoc.get(key)!;
			if (!occSet.has(rawItem.id)) {
				occSet.add(rawItem.id);
				group.occurrences.push({
					id: rawItem.id,
					startDateTime: rawItem.startDateTime ?? null
				});
			}
		}
	};

	if (event.seriesMaster) {
		recordCandidate(event.seriesMaster);
	}

	const instances = Array.isArray(event.instances)
		? event.instances
		: Array.isArray(event.seriesMaster?.instances)
			? event.seriesMaster.instances
			: [];

	for (const inst of instances) {
		recordCandidate(inst);
	}

	return Array.from(groups.values());
}
