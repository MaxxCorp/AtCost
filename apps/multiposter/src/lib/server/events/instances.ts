import { db, event, recurringSeries, inArray, eq, asc } from '@ac/db';
import { expandRecurrence } from './recurrence';

export interface SeriesInstanceItem {
	id: string;
	summary?: string | null;
	startDateTime: string | null;
	endDateTime: string | null;
	status?: string | null;
	isPublic?: boolean;
}

export interface SeriesMasterSummary {
	id: string;
	summary?: string | null;
	startDateTime: string | null;
	endDateTime: string | null;
	recurrence?: string[] | null;
	isPublic?: boolean;
	instances?: SeriesInstanceItem[];
}

function toIsoSafe(d: any): string | null {
	if (!d) return null;
	if (d instanceof Date) return d.toISOString();
	const parsed = new Date(d);
	return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Returns all instances (real DB exceptions + projected virtual occurrences) for a given master event.
 * When `options.publicOnly` is true, non-public materialized exceptions (`isPublic !== true`) are excluded
 * from the returned list while still blocking their time slots so virtual public occurrences are not synthesized over them.
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
		isPublic?: boolean | null;
	},
	maxProjected: number = 100,
	options: { publicOnly?: boolean } = {}
): Promise<SeriesInstanceItem[]> {
	const masterId = master.id;
	if (!masterId) return [];
	if (options.publicOnly && master.isPublic === false) return [];

	const fetchedInstances = await db.query.event.findMany({
		where: eq(event.recurringEventId, masterId),
		orderBy: [asc(event.startDateTime)],
	});

	const visibleDbInstances = options.publicOnly
		? fetchedInstances.filter((inst: any) => inst.isPublic === true)
		: fetchedInstances;

	const instances: SeriesInstanceItem[] = visibleDbInstances.map((inst: any) => ({
		id: inst.id,
		summary: inst.summary,
		startDateTime: toIsoSafe(inst.startDateTime),
		endDateTime: toIsoSafe(inst.endDateTime),
		status: inst.status,
		isPublic: Boolean(inst.isPublic),
	}));

	const rec: any = master.recurrence;
	let rruleStr: string | null = null;
	if (rec && Array.isArray(rec) && rec[0]) {
		rruleStr = rec[0];
	} else if (typeof rec === 'string' && rec.trim().length > 0) {
		rruleStr = rec.trim();
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

		// Register ALL DB exceptions (even non-public ones) in existingTimes so virtual public slots aren't synthesized over privatized exceptions
		const existingTimes = new Set<number>();
		for (const inst of fetchedInstances) {
			if (inst.startDateTime) {
				const instTime = new Date(inst.startDateTime).getTime();
				if (!isNaN(instTime)) existingTimes.add(instTime);
			}
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
					isPublic: master.isPublic !== false,
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
export async function populateSeriesInstances(
	events: any[],
	maxProjected: number = 100,
	options: { publicOnly?: boolean } = {}
): Promise<void> {
	if (!events || events.length === 0) return;

	// Find all master events that are recurring series
	const seriesMasters = events.filter((e) => {
		if (options.publicOnly && e.isPublic === false) return false;
		const isMaster = !e.recurringEventId;
		const rec: any = e.recurrence;
		const hasRecurrence = Boolean(
			(rec && Array.isArray(rec) && rec.length > 0) ||
			(typeof rec === 'string' && rec.trim().length > 0)
		);
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

	// Batch fetch all recurringSeries records for masters that have seriesId
	const seriesIds = Array.from(
		new Set(
			seriesMasters
				.map((m) => m.seriesId)
				.filter((id): id is string => Boolean(id))
		)
	);
	const seriesMap = new Map<string, string>();
	if (seriesIds.length > 0) {
		const seriesRecords = await db
			.select({ id: recurringSeries.id, rrule: recurringSeries.rrule })
			.from(recurringSeries)
			.where(inArray(recurringSeries.id, seriesIds));
		for (const s of seriesRecords) {
			if (s.rrule) seriesMap.set(s.id, s.rrule);
		}
	}

	// For each master event, build the instances list
	for (const master of seriesMasters) {
		const fetchedInstances = dbInstancesByMaster.get(master.id) || [];
		const visibleDbInstances = options.publicOnly
			? fetchedInstances.filter((inst: any) => inst.isPublic === true)
			: fetchedInstances;

		const instances: SeriesInstanceItem[] = visibleDbInstances.map((inst: any) => ({
			id: inst.id,
			summary: inst.summary,
			startDateTime: toIsoSafe(inst.startDateTime),
			endDateTime: toIsoSafe(inst.endDateTime),
			status: inst.status,
			isPublic: Boolean(inst.isPublic),
		}));

		const rec: any = master.recurrence;
		let rruleStr: string | null = null;
		if (rec && Array.isArray(rec) && rec[0]) {
			rruleStr = rec[0];
		} else if (typeof rec === 'string' && rec.trim().length > 0) {
			rruleStr = rec.trim();
		} else if (master.seriesId) {
			rruleStr = seriesMap.get(master.seriesId) || null;
		}

		if (rruleStr && (!master.recurrence || (Array.isArray(master.recurrence) && master.recurrence.length === 0))) {
			master.recurrence = [rruleStr];
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

			const existingTimes = new Set<number>();
			for (const inst of fetchedInstances) {
				if (inst.startDateTime) {
					const instTime = new Date(inst.startDateTime).getTime();
					if (!isNaN(instTime)) existingTimes.add(instTime);
				}
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
						isPublic: master.isPublic !== false,
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
			isPublic: master.isPublic !== false,
			instances,
		};
	}
}
