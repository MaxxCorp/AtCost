/**
 * Extracts and deduplicates room names associated with an event strictly
 * based on associated object ID relations:
 * 1. Resources associated with the event where type === 'room'
 * 2. Locations associated with the event where roomId is set
 */
export function getEventRooms(evt: any): string[] {
	if (!evt) return [];
	const rooms: string[] = [];

	// 1. Check explicit rooms array if already calculated
	if (Array.isArray(evt.rooms)) {
		for (const r of evt.rooms) {
			if (typeof r === 'string' && r.trim() && !rooms.includes(r.trim())) {
				rooms.push(r.trim());
			}
		}
	}

	// 2. Check associated resources (linked via eventResource ID)
	const resources = evt.resources?.map((r: any) => r.resource || r).filter(Boolean) || [];
	for (const res of resources) {
		if (res && typeof res === 'object' && res.type === 'room' && res.name) {
			const name = String(res.name).trim();
			if (name && !rooms.includes(name)) {
				rooms.push(name);
			}
		}
	}

	// 3. Check associated locations (linked via eventLocation ID)
	const locations = evt.locations?.map((l: any) => l.location || l).filter(Boolean) || [];
	for (const loc of locations) {
		if (loc && typeof loc === 'object' && loc.roomId && typeof loc.roomId === 'string') {
			const rId = loc.roomId.trim();
			if (rId && !rooms.includes(rId)) {
				rooms.push(rId);
			}
		}
	}

	return rooms;
}
