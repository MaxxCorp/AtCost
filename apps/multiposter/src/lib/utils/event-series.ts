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

