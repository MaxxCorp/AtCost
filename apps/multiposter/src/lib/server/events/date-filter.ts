import { doesOccurrenceOverlapRange } from '#lib/utils/event-series.js';
import { expandRecurrenceFrom, expandRecurrenceRange } from './recurrence.js';

export interface DateFilterCandidate {
	id: string;
	startDateTime: Date | string | null;
	endDateTime: Date | string | null;
	recurrence?: string[] | string | null;
	exdates?: string[] | null;
	startTimeZone?: string | null;
	seriesId?: string | null;
	status?: string | null;
	isPublic?: boolean | null;
}

export interface DateFilterDbInstance {
	id: string;
	recurringEventId?: string | null;
	startDateTime: Date | string | null;
	endDateTime: Date | string | null;
	originalStartTime?: any;
	status?: string | null;
	isPublic?: boolean | null;
}

export interface DateFilterOptions {
	rangeStart: Date | null;
	rangeEnd: Date | null;
	excludePast?: boolean;
	excludeCancelled?: boolean;
	excludeTentative?: boolean;
	excludeNonPublic?: boolean;
	publicOnly?: boolean;
	now?: Date;
}

function toValidDate(val: Date | string | null | undefined): Date | null {
	if (!val) return null;
	const d = val instanceof Date ? val : new Date(val);
	return isNaN(d.getTime()) ? null : d;
}

/**
 * Evaluates whether a master/single event (together with its persisted DB instances and RRULE)
 * has at least one visible occurrence overlapping `[rangeStart, rangeEnd]` (intersected with `excludePast`),
 * and returns the earliest matching occurrence start timestamp for sorting.
 */
export function findMatchingSeriesOccurrenceStart(
	candidate: DateFilterCandidate,
	rruleStr: string | null,
	dbInstances: DateFilterDbInstance[],
	options: DateFilterOptions,
): { matches: boolean; firstMatchStartMs: number | null } {
	let effectiveStart = options.rangeStart;
	if (options.excludePast) {
		const cutoff = new Date(options.now ? options.now.getTime() : Date.now());
		cutoff.setHours(0, 0, 0, 0);
		effectiveStart =
			effectiveStart && effectiveStart.getTime() > cutoff.getTime() ? effectiveStart : cutoff;
	}
	const effectiveEnd = options.rangeEnd;

	if (effectiveStart && effectiveEnd && effectiveStart.getTime() > effectiveEnd.getTime()) {
		return { matches: false, firstMatchStartMs: null };
	}

	const isVisible = (item: { status?: string | null; isPublic?: boolean | null }) => {
		if (options.publicOnly && item.isPublic !== true) return false;
		if (options.excludeNonPublic && item.isPublic !== true) return false;
		if (options.excludeCancelled && item.status === 'cancelled') return false;
		if (options.excludeTentative && item.status === 'tentative') return false;
		return true;
	};

	const matchedStarts: number[] = [];

	// 1. Check master (Occurrence #1)
	const masterStart = toValidDate(candidate.startDateTime);
	if (
		masterStart &&
		isVisible(candidate) &&
		doesOccurrenceOverlapRange(masterStart, candidate.endDateTime, effectiveStart, effectiveEnd)
	) {
		matchedStarts.push(masterStart.getTime());
	}

	// 2. Check persisted DB child instances / exceptions
	for (const inst of dbInstances) {
		const instStart = toValidDate(inst.startDateTime);
		if (
			instStart &&
			isVisible(inst) &&
			doesOccurrenceOverlapRange(instStart, inst.endDateTime, effectiveStart, effectiveEnd)
		) {
			matchedStarts.push(instStart.getTime());
		}
	}

	// 3. Check RRULE virtual occurrences (excluding slots claimed by ANY DB instance)
	if (rruleStr && masterStart && isVisible(candidate)) {
		const blockedTimes = new Set<number>();
		for (const inst of dbInstances) {
			const instStart = toValidDate(inst.startDateTime);
			if (instStart) blockedTimes.add(instStart.getTime());

			if (
				inst.originalStartTime &&
				typeof inst.originalStartTime === 'object' &&
				'dateTime' in inst.originalStartTime
			) {
				const orig = toValidDate(inst.originalStartTime.dateTime);
				if (orig) blockedTimes.add(orig.getTime());
			}
		}

		const masterEnd = toValidDate(candidate.endDateTime);
		const durationMs = masterEnd ? Math.max(0, masterEnd.getTime() - masterStart.getTime()) : 0;
		const exdates = Array.isArray(candidate.exdates) ? candidate.exdates : undefined;
		const needed = blockedTimes.size + 5;

		let projected: { date: Date; end: Date | null }[] = [];
		if (effectiveStart && effectiveEnd) {
			const paddedStart = new Date(effectiveStart.getTime() - durationMs - 2 * 3600 * 1000);
			const paddedEnd = new Date(effectiveEnd.getTime() + 2 * 3600 * 1000);
			projected = expandRecurrenceRange(
				rruleStr,
				masterStart,
				masterEnd,
				paddedStart,
				paddedEnd,
				candidate.startTimeZone,
				exdates,
				false,
				needed,
			);
		} else if (effectiveStart) {
			projected = expandRecurrenceFrom(
				rruleStr,
				masterStart,
				masterEnd,
				effectiveStart,
				needed,
				candidate.startTimeZone,
				exdates,
				false,
			);
		} else if (effectiveEnd && masterStart.getTime() <= effectiveEnd.getTime()) {
			const paddedEnd = new Date(effectiveEnd.getTime() + 2 * 3600 * 1000);
			projected = expandRecurrenceRange(
				rruleStr,
				masterStart,
				masterEnd,
				masterStart,
				paddedEnd,
				candidate.startTimeZone,
				exdates,
				false,
				needed,
			);
		}

		for (const occ of projected) {
			const occTime = occ.date.getTime();
			if (
				!blockedTimes.has(occTime) &&
				doesOccurrenceOverlapRange(occ.date, occ.end, effectiveStart, effectiveEnd)
			) {
				matchedStarts.push(occTime);
			}
		}
	}

	if (matchedStarts.length === 0) {
		return { matches: false, firstMatchStartMs: null };
	}

	return {
		matches: true,
		firstMatchStartMs: Math.min(...matchedStarts),
	};
}
