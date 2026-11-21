import type { DateFilterValue } from "../components/EntityManager.types.js";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a `YYYY-MM-DD` string into a local Date at 00:00:00.000, rejecting invalid calendar dates.
 */
export function parseLocalYmdStart(ymd: string | null | undefined): Date | null {
    if (!ymd || typeof ymd !== "string") return null;
    const match = YMD_RE.exec(ymd.trim());
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const d = new Date(year, month - 1, day, 0, 0, 0, 0);
    d.setFullYear(year);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
        return null;
    }
    return d;
}

/**
 * Parses a `YYYY-MM-DD` string into a local Date at 23:59:59.999, rejecting invalid calendar dates.
 */
export function parseLocalYmdEnd(ymd: string | null | undefined): Date | null {
    if (!ymd || typeof ymd !== "string") return null;
    const match = YMD_RE.exec(ymd.trim());
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const d = new Date(year, month - 1, day, 23, 59, 59, 999);
    d.setFullYear(year);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
        return null;
    }
    return d;
}

/**
 * Formats a Date into a local `YYYY-MM-DD` string.
 */
export function formatLocalYmd(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Returns true if the given DateFilterValue specifies at least one valid date bound.
 */
export function isDateFilterActive(value: DateFilterValue | null | undefined): boolean {
    if (!value) return false;
    if (value.mode === "single") {
        return Boolean(parseLocalYmdStart(value.from));
    }
    if (value.mode === "range") {
        return Boolean(parseLocalYmdStart(value.from) || parseLocalYmdEnd(value.to));
    }
    return false;
}

/**
 * Converts a DateFilterValue into local inclusive start/end Date bounds (swapping inverted ranges).
 */
export function getDateFilterBounds(value: DateFilterValue | null | undefined): { start: Date | null; end: Date | null } {
    if (!value) return { start: null, end: null };

    if (value.mode === "single") {
        const s = parseLocalYmdStart(value.from);
        const e = parseLocalYmdEnd(value.from);
        return { start: s, end: e };
    }

    if (value.mode === "range") {
        let start = parseLocalYmdStart(value.from);
        let end = parseLocalYmdEnd(value.to);
        if (start && end && start.getTime() > end.getTime()) {
            start = parseLocalYmdStart(value.to);
            end = parseLocalYmdEnd(value.from);
        }
        return { start, end };
    }

    return { start: null, end: null };
}

/**
 * Formats a human-readable summary for a DateFilterValue (used in filter badges and chips).
 */
export function formatDateFilterSummary(
    value: DateFilterValue,
    labels?: { fromLabel?: string; toLabel?: string },
    locale?: string,
): string {
    if (!value) return "";

    const fmt = (d: Date) =>
        d.toLocaleDateString(locale || undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
        });

    if (value.mode === "single") {
        const d = parseLocalYmdStart(value.from);
        return d ? fmt(d) : "";
    }

    const fromDate = parseLocalYmdStart(value.from);
    const toDate = parseLocalYmdStart(value.to);

    if (fromDate && toDate) {
        if (fromDate.getTime() === toDate.getTime()) {
            return fmt(fromDate);
        }
        if (fromDate.getTime() > toDate.getTime()) {
            return `${fmt(toDate)} – ${fmt(fromDate)}`;
        }
        return `${fmt(fromDate)} – ${fmt(toDate)}`;
    }

    if (fromDate) {
        return `${labels?.fromLabel ?? "From"} ${fmt(fromDate)}`;
    }

    if (toDate) {
        return `${labels?.toLabel ?? "Until"} ${fmt(toDate)}`;
    }

    return "";
}

/**
 * Returns a single-date DateFilterValue for today in local time.
 */
export function getTodayDateFilterValue(now: Date = new Date()): DateFilterValue {
    return {
        mode: "single",
        from: formatLocalYmd(now),
        to: "",
    };
}

/**
 * Returns a date-range DateFilterValue covering Monday..Sunday of the current local week.
 */
export function getThisWeekDateFilterValue(now: Date = new Date()): DateFilterValue {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return {
        mode: "range",
        from: formatLocalYmd(monday),
        to: formatLocalYmd(sunday),
    };
}

/**
 * Returns a date-range DateFilterValue covering the 1st through last day of the current local month.
 */
export function getThisMonthDateFilterValue(now: Date = new Date()): DateFilterValue {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
        mode: "range",
        from: formatLocalYmd(first),
        to: formatLocalYmd(last),
    };
}
