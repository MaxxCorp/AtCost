import type { Event, Announcement } from "@ac/validations";

/**
 * Checks if an event or item belongs to a recurring series.
 * Recurring series events can be identified by:
 * - isCompressedSeries flag (used in compressed kiosk flyer views)
 * - isSeries flag
 * - seriesId present
 * - recurringEventId present (links instance to master)
 * - recurrence array with at least one recurrence rule
 * - 'Series' tag
 */
export function isSeriesItem(item: any): boolean {
    if (!item) return false;
    // Announcements never have startDateTime and aren't event series
    if ("content" in item && !("startDateTime" in item)) {
        return false;
    }
    return Boolean(
        item.isCompressedSeries ||
        item.isSeries ||
        item.seriesId ||
        item.recurringEventId ||
        item.isException ||
        item.originalStartTime ||
        (typeof item.id === "string" && item.id.includes("_inst_")) ||
        (Array.isArray(item.recurrence) && item.recurrence.length > 0) ||
        (typeof item.recurrence === "string" && item.recurrence.trim().length > 0) ||
        (Array.isArray(item.tags) && item.tags.some((t: any) => (typeof t === "string" ? t : t?.name) === "Series"))
    );
}

/**
 * Checks if an item is a non-series event (a rare highlight / exception to the standard programme).
 * Returns true only if item is an Event and NOT part of any recurring series.
 */
export function isNonSeriesEvent(item: any): boolean {
    if (!item) return false;
    const isEvent = "startDateTime" in item;
    return isEvent && !isSeriesItem(item);
}

/**
 * Checks if a given ID string matches the virtual occurrence pattern (${masterId}_inst_${iso}).
 */
export function isVirtualInstanceId(id: string | null | undefined): boolean {
    return typeof id === "string" && id.includes("_inst_");
}

/**
 * Splits a virtual instance composite ID into { masterId, iso } or returns null if invalid.
 */
export function parseVirtualInstanceId(id: string | null | undefined): { masterId: string; iso: string } | null {
    if (!isVirtualInstanceId(id)) return null;
    const parts = (id as string).split("_inst_");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { masterId: parts[0], iso: decodeURIComponent(parts[1]) };
}

/**
 * Checks if an event is a series master event (defines recurrence and is not an instance/exception).
 */
export function isSeriesMaster(event: any): boolean {
    if (!event) return false;
    const hasRecurrence = Boolean(
        (Array.isArray(event.recurrence) && event.recurrence.length > 0) ||
        (typeof event.recurrence === "string" && event.recurrence.trim().length > 0) ||
        event.seriesId
    );
    return hasRecurrence && !event.recurringEventId && !event.isException && !isVirtualInstanceId(event.id);
}

/**
 * Checks if an event is an instance of a series (either a virtual instance or a materialized exception).
 */
export function isSeriesInstance(event: any): boolean {
    if (!event) return false;
    return Boolean(
        isVirtualInstanceId(event.id) ||
        event.recurringEventId ||
        event.isException ||
        event.originalStartTime
    );
}

/**
 * Checks if an event is a persisted materialized exception of a recurring series
 * (as opposed to a virtual instance or series master).
 */
export function isMaterializedException(event: any): boolean {
    if (!event) return false;
    return Boolean(
        !isVirtualInstanceId(event.id) &&
        event.recurringEventId &&
        (event.isException || event.originalStartTime)
    );
}

/**
 * Resolves the root series master UUID from a master event, a virtual instance, or a materialized exception.
 */
export function getSeriesRootId(event: any): string | null {
    if (!event) return null;
    if (typeof event === "string") {
        const parsed = parseVirtualInstanceId(event);
        return parsed ? parsed.masterId : event;
    }
    if (isVirtualInstanceId(event.id)) {
        const parsed = parseVirtualInstanceId(event.id);
        if (parsed) return parsed.masterId;
    }
    return event.recurringEventId || event.id || null;
}

export interface SeriesOccurrenceItem {
    id: string;
    summary?: string | null;
    startDateTime: string | null;
    endDateTime?: string | null;
    status?: string | null;
    isMaster?: boolean;
    isSeriesInstance?: boolean;
    recurringEventId?: string | null;
    seriesMaster?: any;
    [key: string]: any;
}

/**
 * Merges a series occurrence/exception onto a master event without letting
 * `undefined` properties override master defaults, while ensuring explicit
 * overrides (including `[]`, `0`, `false`, `""`, or `null`) take precedence.
 */
export function mergeOccurrenceWithMaster(master: any, inst: any): any {
    const merged: Record<string, any> = master ? { ...master } : {};
    if (inst && typeof inst === "object") {
        for (const [key, value] of Object.entries(inst)) {
            if (key === "instances" || key === "seriesMaster") continue;
            if (value !== undefined) {
                merged[key] = value;
            }
        }
    }
    return merged;
}

/**
 * Returns the complete chronological sequence of occurrences for a series master event,
 * explicitly including Occurrence #1 (the master event entry itself) along with any
 * child exceptions and projected virtual instances.
 */
export function getAllSeriesOccurrences(masterEvent: any): SeriesOccurrenceItem[] {
    if (!masterEvent) return [];

    // If an instance is passed, resolve to its series master
    const rootMaster = ((masterEvent.isSeriesInstance || masterEvent.recurringEventId) && masterEvent.seriesMaster)
        ? {
            ...masterEvent.seriesMaster,
            instances: Array.isArray(masterEvent.instances) && masterEvent.instances.length > 0
                ? masterEvent.instances
                : masterEvent.seriesMaster.instances
        }
        : masterEvent;

    const toIso = (d: any): string | null => {
        if (!d) return null;
        if (typeof d === "string") return d;
        if (d instanceof Date) return isNaN(d.getTime()) ? null : d.toISOString();
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };

    const occurrences: SeriesOccurrenceItem[] = [];
    const seenTimes = new Set<number>();
    const seenIds = new Set<string>();

    // 1. Initial occurrence (Occurrence #1 - Master event entry)
    if (rootMaster.startDateTime) {
        const masterIso = toIso(rootMaster.startDateTime);
        const masterTime = masterIso ? new Date(masterIso).getTime() : 0;
        if (masterIso && !isNaN(masterTime)) {
            occurrences.push({
                ...rootMaster,
                id: rootMaster.id,
                summary: rootMaster.summary,
                startDateTime: masterIso,
                endDateTime: toIso(rootMaster.endDateTime),
                status: rootMaster.status || 'confirmed',
                isMaster: true,
                isSeriesMaster: true,
                isSeriesInstance: false,
                recurringEventId: null
            });
            seenTimes.add(masterTime);
            seenIds.add(rootMaster.id);
        }
    }

    // 2. Child instances (materialized exceptions and virtual instances)
    const childInstances = Array.isArray(rootMaster.instances)
        ? rootMaster.instances
        : Array.isArray(rootMaster.seriesMaster?.instances)
            ? rootMaster.seriesMaster.instances
            : [];
    for (const inst of childInstances) {
        if (!inst) continue;
        const instIso = toIso(inst.startDateTime);
        const instTime = instIso ? new Date(instIso).getTime() : 0;
        if (!instIso || isNaN(instTime)) continue;

        if (seenIds.has(inst.id) || seenTimes.has(instTime)) {
            continue;
        }

        occurrences.push({
            ...mergeOccurrenceWithMaster(rootMaster, inst),
            id: inst.id,
            summary: inst.summary || rootMaster.summary,
            startDateTime: instIso,
            endDateTime: inst.endDateTime !== undefined
                ? toIso(inst.endDateTime)
                : (isVirtualInstanceId(inst.id) ? null : toIso(rootMaster.endDateTime)),
            status: inst.status || rootMaster.status || 'confirmed',
            isMaster: false,
            isSeriesMaster: false,
            isSeriesInstance: true,
            recurringEventId: rootMaster.id,
            seriesMaster: rootMaster
        });
        seenTimes.add(instTime);
        seenIds.add(inst.id);
    }

    // Sort chronologically ascending
    occurrences.sort((a, b) => {
        const timeA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
        const timeB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
        return timeA - timeB;
    });

    return occurrences;
}

/**
 * Parses a Date or date-string into a valid Date instance or returns null.
 */
function toValidOccurrenceDate(value: Date | string | number | null | undefined): Date | null {
    if (value === null || value === undefined || value === "") return null;
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Checks whether an occurrence `[start, end)` (or point `[start, start]` when `end` is absent or `<= start`)
 * overlaps a query range `[rangeStart, rangeEnd]`.
 *
 * Uses half-open semantics on positive-duration intervals (`end > rangeStart`) so exclusive-midnight
 * all-day boundaries (e.g., ending at `2026-11-21T00:00:00Z`) do not bleed into the next day.
 */
export function doesOccurrenceOverlapRange(
    start: Date | string | number | null | undefined,
    end: Date | string | number | null | undefined,
    rangeStart: Date | number | null | undefined,
    rangeEnd: Date | number | null | undefined,
): boolean {
    const startDate = toValidOccurrenceDate(start);
    if (!startDate) return false;
    const startMs = startDate.getTime();

    const endDate = toValidOccurrenceDate(end);
    const endMs = endDate ? endDate.getTime() : null;
    const hasPositiveDuration = endMs !== null && endMs > startMs;

    const rangeStartDate = toValidOccurrenceDate(rangeStart);
    if (rangeStartDate) {
        const rsMs = rangeStartDate.getTime();
        if (hasPositiveDuration) {
            if (endMs! <= rsMs) return false;
        } else if (startMs < rsMs) {
            return false;
        }
    }

    const rangeEndDate = toValidOccurrenceDate(rangeEnd);
    if (rangeEndDate) {
        if (startMs > rangeEndDate.getTime()) return false;
    }

    return true;
}

/**
 * Returns the upcoming or most relevant occurrence for an event series,
 * taking into account Occurrence #1 (master) and all subsequent instances.
 * When `rangeStart` or `rangeEnd` is provided, returns the first matching occurrence
 * within that date window (or `null` if none overlap).
 */
export function getUpcomingOccurrence(
    event: any,
    options?: {
        now?: number | Date;
        excludePast?: boolean;
        rangeStart?: number | Date | null;
        rangeEnd?: number | Date | null;
    }
): SeriesOccurrenceItem | null {
    if (!event) return null;

    const occurrences = getAllSeriesOccurrences(event);
    const hasRange = options?.rangeStart != null || options?.rangeEnd != null;

    const nowTime = options?.now
        ? (options.now instanceof Date ? options.now.getTime() : options.now)
        : Date.now();

    if (hasRange) {
        const rangeStartDate = toValidOccurrenceDate(options?.rangeStart);
        const rangeEndDate = toValidOccurrenceDate(options?.rangeEnd);

        if (occurrences.length === 0) {
            return doesOccurrenceOverlapRange(event.startDateTime, event.endDateTime, rangeStartDate, rangeEndDate)
                ? event
                : null;
        }

        const matching = occurrences.filter((occ) => {
            if (!doesOccurrenceOverlapRange(occ.startDateTime, occ.endDateTime, rangeStartDate, rangeEndDate)) {
                return false;
            }
            if (options?.excludePast) {
                const time = occ.endDateTime
                    ? new Date(occ.endDateTime).getTime()
                    : (occ.startDateTime ? new Date(occ.startDateTime).getTime() : 0);
                if (time < nowTime) return false;
            }
            return true;
        });

        return matching[0] ?? null;
    }

    if (occurrences.length === 0) {
        return event;
    }

    const upcoming = occurrences.find((occ) => {
        const time = occ.endDateTime
            ? new Date(occ.endDateTime).getTime()
            : (occ.startDateTime ? new Date(occ.startDateTime).getTime() : 0);
        return time >= nowTime;
    });

    if (upcoming) return upcoming;

    // If no future occurrence found and excludePast is active:
    if (options?.excludePast) {
        return null;
    }

    // Return the latest occurrence if all are past, or the first one as fallback
    return occurrences[occurrences.length - 1] || occurrences[0] || null;
}

export interface SeriesListFilter {
    include?: string[];
    exclude?: string[];
}

export interface SeriesListOptions {
    sortField?: "updatedAt" | "startDateTime" | "createdAt";
    sortOrder?: "asc" | "desc";
    excludePast?: boolean;
    rangeStart?: Date | null;
    rangeEnd?: Date | null;
    now?: Date;
    locationFilter?: SeriesListFilter;
    tagFilter?: SeriesListFilter;
}

function getOccurrenceLocationIds(item: any): Set<string> {
    const ids = new Set<string>();
    for (const l of item?.locations || []) {
        const id = l?.id || l?.locationId || l?.location?.id;
        if (id) ids.add(String(id));
    }
    for (const r of item?.resources || []) {
        const res = r?.resource || r;
        const id = r?.locationId || res?.locationId || res?.location?.id;
        if (id) ids.add(String(id));
    }
    for (const id of item?.locationIds || []) {
        if (id) ids.add(String(id));
    }
    return ids;
}

function getOccurrenceTagIds(item: any): Set<string> {
    const ids = new Set<string>();
    for (const t of item?.tags || []) {
        const id = typeof t === "string" ? t : t?.id || t?.tag?.id || t?.tagId;
        if (id) ids.add(String(id));
    }
    for (const id of item?.tagIds || []) {
        if (id) ids.add(String(id));
    }
    return ids;
}

function matchesIncludeExcludeFilter(ids: Set<string>, filter?: SeriesListFilter): boolean {
    if (!filter) return true;
    const exclude = filter.exclude || [];
    const include = filter.include || [];
    if (exclude.length > 0 && exclude.some((ex) => ids.has(ex))) {
        return false;
    }
    if (include.length > 0) {
        return include.some((inc) => ids.has(inc));
    }
    return true;
}

/**
 * Groups flat event rows (masters + child exceptions) into master cards with sorted `instances`,
 * preserving hydrated child exception properties over slim `master.instances` stubs.
 */
export function groupSeriesEvents(rawEvents: any[], options: SeriesListOptions = {}): any[] {
    const sortField = options.sortField || "updatedAt";
    const sortOrder = options.sortOrder || "desc";

    const grouped = rawEvents
        .filter((e: any) => !e.recurringEventId)
        .map((master: any) => {
            const existingInstances = master.instances || [];
            const rawChildInstances = rawEvents.filter((e: any) => e.recurringEventId === master.id);
            const rawChildById = new Map<string, any>(rawChildInstances.map((child: any) => [child.id, child]));

            const combined: any[] = existingInstances.map((inst: any) => {
                const hydrated = rawChildById.get(inst.id);
                return hydrated ? { ...inst, ...hydrated } : inst;
            });
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
            return {
                ...master,
                instances: combined,
                ...(master.seriesMaster
                    ? { seriesMaster: { ...master.seriesMaster, instances: combined } }
                    : {})
            };
        });

    if (sortField === "startDateTime") {
        grouped.sort((a: any, b: any) => {
            const occA = getUpcomingOccurrence(a, {
                now: options.now,
                excludePast: options.excludePast,
                rangeStart: options.rangeStart,
                rangeEnd: options.rangeEnd,
            });
            const occB = getUpcomingOccurrence(b, {
                now: options.now,
                excludePast: options.excludePast,
                rangeStart: options.rangeStart,
                rangeEnd: options.rangeEnd,
            });
            const timeA = occA?.startDateTime
                ? new Date(occA.startDateTime).getTime()
                : (a.startDateTime ? new Date(a.startDateTime).getTime() : 0);
            const timeB = occB?.startDateTime
                ? new Date(occB.startDateTime).getTime()
                : (b.startDateTime ? new Date(b.startDateTime).getTime() : 0);
            return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
        });
    } else if (sortField === "createdAt") {
        grouped.sort((a: any, b: any) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
        });
    } else {
        grouped.sort((a: any, b: any) => {
            const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
        });
    }

    return grouped;
}

/**
 * Unrolls recurring series into individual occurrence cards, keeping each materialized
 * exception's own fields (rooms, resources, locations, tags, prep/teardown, timestamps, etc.)
 * instead of overwriting them with master series properties.
 */
export function unrollSeriesEvents(rawEvents: any[], options: SeriesListOptions = {}): any[] {
    const sortField = options.sortField || "updatedAt";
    const sortOrder = options.sortOrder || "desc";
    const isExcludePast = Boolean(options.excludePast);
    const rangeStart = options.rangeStart ?? null;
    const rangeEnd = options.rangeEnd ?? null;

    const grouped = groupSeriesEvents(rawEvents, options);
    const unrolled: any[] = [];
    const now = options.now ? new Date(options.now) : new Date();
    now.setHours(0, 0, 0, 0);
    const hasDateRange = Boolean(rangeStart || rangeEnd);

    for (const master of grouped) {
        const isSeries = Boolean(
            master.isSeriesInstance ||
            master.isSeries ||
            master.recurringEventId ||
            master.seriesId ||
            (master.recurrence && master.recurrence.length > 0) ||
            (master.instances && master.instances.length > 0)
        );
        if (!isSeries) {
            if (
                hasDateRange &&
                !doesOccurrenceOverlapRange(master.startDateTime, master.endDateTime, rangeStart, rangeEnd)
            ) {
                continue;
            }
            if (!matchesIncludeExcludeFilter(getOccurrenceLocationIds(master), options.locationFilter)) {
                continue;
            }
            if (!matchesIncludeExcludeFilter(getOccurrenceTagIds(master), options.tagFilter)) {
                continue;
            }
            unrolled.push(master);
        } else {
            const occurrences = getAllSeriesOccurrences(master);
            for (const occ of occurrences) {
                if (isExcludePast) {
                    const iStart = occ.startDateTime ? new Date(occ.startDateTime) : null;
                    const iEnd = occ.endDateTime ? new Date(occ.endDateTime) : null;
                    const isFuture = (iStart ? iStart >= now : false) || (iEnd ? iEnd >= now : false);
                    if (!isFuture) continue;
                }
                if (
                    hasDateRange &&
                    !doesOccurrenceOverlapRange(occ.startDateTime, occ.endDateTime, rangeStart, rangeEnd)
                ) {
                    continue;
                }
                if (!matchesIncludeExcludeFilter(getOccurrenceLocationIds(occ), options.locationFilter)) {
                    continue;
                }
                if (!matchesIncludeExcludeFilter(getOccurrenceTagIds(occ), options.tagFilter)) {
                    continue;
                }
                unrolled.push({
                    ...mergeOccurrenceWithMaster(master, occ),
                    id: occ.id,
                    summary: occ.summary || master.summary,
                    startDateTime: occ.startDateTime,
                    endDateTime: occ.endDateTime,
                    status: occ.status || master.status,
                    isSeriesInstance: !occ.isMaster,
                    isSeriesMaster: Boolean(occ.isMaster),
                    recurringEventId: occ.isMaster ? null : master.id,
                    seriesMaster: master,
                    instances: master.instances,
                });
            }
        }
    }

    unrolled.sort((a: any, b: any) => {
        if (sortField === "startDateTime") {
            const timeA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
            const timeB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
            return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
        } else if (sortField === "createdAt") {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
        } else {
            const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
        }
    });

    return unrolled;
}

