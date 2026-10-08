/**
 * Utilities for computing dynamic calendar windows and formatting dates for kiosks.
 */

/**
 * Formats a Date object to a string suitable for HTML datetime-local input (YYYY-MM-DDTHH:mm).
 */
export function formatForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Returns the upcoming calendar week (Monday 00:00:00.000 to Sunday 23:59:59.999).
 */
export function getNextWeekRange(now: Date = new Date()): { start: Date; end: Date } {
    const day = now.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    // Distance to next Monday (1-7 days away):
    const diffToNextMonday = ((7 - day + 1) % 7) || 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToNextMonday, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    return { start, end };
}

/**
 * Returns the current calendar week (Monday 00:00:00.000 to Sunday 23:59:59.999).
 */
export function getThisWeekRange(now: Date = new Date()): { start: Date; end: Date } {
    const day = now.getDay();
    // Distance back to this Monday:
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    return { start, end };
}

/**
 * Returns the upcoming calendar month (1st 00:00:00.000 to last day 23:59:59.999).
 */
export function getNextMonthRange(now: Date = new Date()): { start: Date; end: Date } {
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
    return { start, end };
}

/**
 * Returns the current calendar month (1st 00:00:00.000 to last day 23:59:59.999).
 */
export function getThisMonthRange(now: Date = new Date()): { start: Date; end: Date } {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

/**
 * Formats a Date range for display in the kiosk configuration UI.
 */
export function formatDateRangeDisplay(start: Date, end: Date, locale = 'en'): string {
    try {
        const startStr = start.toLocaleDateString(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        const endStr = end.toLocaleDateString(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        return `${startStr} – ${endStr}`;
    } catch {
        return `${start.toDateString()} – ${end.toDateString()}`;
    }
}
