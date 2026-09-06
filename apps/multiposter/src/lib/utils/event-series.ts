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
        (Array.isArray(item.recurrence) && item.recurrence.length > 0) ||
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
