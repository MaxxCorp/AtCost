import { db, event, recurringSeries, inArray, eq, asc } from '@ac/db';
import { expandRecurrence } from './recurrence';

export interface SeriesInstanceItem {
	id: string;
	summary?: string | null;
	startDateTime: string | null;
	endDateTime: string | null;
	status?: string | null;
}

export interface SeriesMasterSummary {
	id: string;
	summary?: string | null;
	startDateTime: string | null;
	endDateTime: string | null;
	recurrence?: string[] | null;
}

function toIsoSafe(d: any): string | null {
	if (!d) return null;
	if (d instanceof Date) return d.toISOString();
	const parsed = new Date(d);
	return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Returns all instances (real DB exceptions + projected virtual occurrences) for a given master event.
 */
export async function getSeriesInstances(
	master: {
		id: string;
		summary?: string | null;
		startDateTime?: Date | string | null;
		endDateTime?: Date | string | null;
		recurrence?: string[] | null;
		exdates?: string[] | null;
		startTimeZone?: string | null;
		recurringEventId?: string | null;
		seriesId?: string | null;
	},
	maxProjected: number = 20
): Promise<SeriesInstanceItem[]> {
	const masterId = master.id;
	if (!masterId) return [];

	const fetchedInstances = await db.query.event.findMany({
		where: eq(event.recurringEventId, masterId),
		orderBy: [asc(event.startDateTime)],
	});

	const instances: SeriesInstanceItem[] = fetchedInstances.map((inst: any) => ({
		id: inst.id,
		summary: inst.summary,
		startDateTime: toIsoSafe(inst.startDateTime),
		endDateTime: toIsoSafe(inst.endDateTime),
		status: inst.status,
	}));

	let rruleStr: string | null = null;
	if (master.recurrence && Array.isArray(master.recurrence) && master.recurrence[0]) {
		rruleStr = master.recurrence[0];
	} else if (master.seriesId) {
		const [seriesRecord] = await db.select().from(recurringSeries).where(eq(recurringSeries.id, master.seriesId));
		if (seriesRecord?.rrule) rruleStr = seriesRecord.rrule;
	}

	if (rruleStr && master.startDateTime) {
		const exdates = Array.isArray(master.exdates) ? (master.exdates as string[]) : [];
		const startDate = master.startDateTime instanceof Date ? master.startDateTime : new Date(master.startDateTime);
		const endDate = master.endDateTime
			? (master.endDateTime instanceof Date ? master.endDateTime : new Date(master.endDateTime))
			: null;

		const projected = expandRecurrence(
			rruleStr,
			startDate,
			endDate,
			maxProjected,
			true,
			master.startTimeZone || undefined,
			exdates
		);

		const existingTimes = new Set(instances.map((i) => (i.startDateTime ? new Date(i.startDateTime).getTime() : 0)));
		for (const inst of fetchedInstances) {
			if (inst.originalStartTime && typeof inst.originalStartTime === 'object' && 'dateTime' in (inst.originalStartTime as any)) {
				const origTime = new Date((inst.originalStartTime as any).dateTime).getTime();
				if (!isNaN(origTime)) {
					existingTimes.add(origTime);
				}
			}
		}

		for (const p of projected) {
			const pTime = p.date.getTime();
			if (!existingTimes.has(pTime)) {
				instances.push({
					id: `${masterId}_inst_${p.date.toISOString()}`,
					summary: master.summary,
					startDateTime: p.date.toISOString(),
					endDateTime: p.end ? p.end.toISOString() : null,
					status: 'published',
				});
				existingTimes.add(pTime);
			}
		}

		instances.sort((a, b) => new Date(a.startDateTime || 0).getTime() - new Date(b.startDateTime || 0).getTime());
	}

	return instances;
}

/**
 * Batch populates `instances` and `seriesMaster` onto a list of events.
 * Executes a single DB query for all recurring masters in the list, then calculates
 * recurrence projections in-memory.
 */
export async function populateSeriesInstances(events: any[], maxProjected: number = 20): Promise<void> {
	if (!events || events.length === 0) return;

	// Find all master events that are recurring series
	const seriesMasters = events.filter((e) => {
		const isMaster = !e.recurringEventId;
		const hasRecurrence = Boolean(e.recurrence && Array.isArray(e.recurrence) && e.recurrence.length > 0);
		const hasSeriesId = Boolean(e.seriesId);
		return isMaster && (hasRecurrence || hasSeriesId || e.isSeries);
	});

	if (seriesMasters.length === 0) return;

	const masterIds = seriesMasters.map((m) => m.id);

	// Fetch all real database instances (exceptions) in a single query
	const allDbInstances = await db.query.event.findMany({
		where: inArray(event.recurringEventId, masterIds),
		orderBy: [asc(event.startDateTime)],
	});

	// Group DB instances by recurringEventId
	const dbInstancesByMaster = new Map<string, any[]>();
	for (const inst of allDbInstances) {
		if (inst.recurringEventId) {
			const list = dbInstancesByMaster.get(inst.recurringEventId) || [];
			list.push(inst);
			dbInstancesByMaster.set(inst.recurringEventId, list);
		}
	}

	// For each master event, build the instances list
	for (const master of seriesMasters) {
		const fetchedInstances = dbInstancesByMaster.get(master.id) || [];
		const instances: SeriesInstanceItem[] = fetchedInstances.map((inst: any) => ({
			id: inst.id,
			summary: inst.summary,
			startDateTime: toIsoSafe(inst.startDateTime),
			endDateTime: toIsoSafe(inst.endDateTime),
			status: inst.status,
		}));

		let rruleStr: string | null = null;
		if (master.recurrence && Array.isArray(master.recurrence) && master.recurrence[0]) {
			rruleStr = master.recurrence[0];
		} else if (master.seriesId) {
			const [seriesRecord] = await db.select().from(recurringSeries).where(eq(recurringSeries.id, master.seriesId));
			if (seriesRecord?.rrule) rruleStr = seriesRecord.rrule;
		}

		if (rruleStr && master.startDateTime) {
			const exdates = Array.isArray(master.exdates) ? (master.exdates as string[]) : [];
			const startDate = master.startDateTime instanceof Date ? master.startDateTime : new Date(master.startDateTime);
			const endDate = master.endDateTime
				? (master.endDateTime instanceof Date ? master.endDateTime : new Date(master.endDateTime))
				: null;

			const projected = expandRecurrence(
				rruleStr,
				startDate,
				endDate,
				maxProjected,
				true,
				master.startTimeZone || undefined,
				exdates
			);

			const existingTimes = new Set(instances.map((i) => (i.startDateTime ? new Date(i.startDateTime).getTime() : 0)));
			for (const inst of fetchedInstances) {
				if (inst.originalStartTime && typeof inst.originalStartTime === 'object' && 'dateTime' in (inst.originalStartTime as any)) {
					const origTime = new Date((inst.originalStartTime as any).dateTime).getTime();
					if (!isNaN(origTime)) {
						existingTimes.add(origTime);
					}
				}
			}

			for (const p of projected) {
				const pTime = p.date.getTime();
				if (!existingTimes.has(pTime)) {
					instances.push({
						id: `${master.id}_inst_${p.date.toISOString()}`,
						summary: master.summary,
						startDateTime: p.date.toISOString(),
						endDateTime: p.end ? p.end.toISOString() : null,
						status: 'published',
					});
					existingTimes.add(pTime);
				}
			}

			instances.sort((a, b) => new Date(a.startDateTime || 0).getTime() - new Date(b.startDateTime || 0).getTime());
		}

		master.instances = instances;
		master.seriesMaster = {
			id: master.id,
			summary: master.summary,
			startDateTime: toIsoSafe(master.startDateTime),
			endDateTime: toIsoSafe(master.endDateTime),
			recurrence: master.recurrence,
		};
	}
}
