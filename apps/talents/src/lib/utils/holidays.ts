/**
 * Statutory Public Holidays & Working Day Calculations
 * Default jurisdiction: Germany (including Berlin state holidays like Frauentag March 8)
 * Accounts for Easter-dependent movable holidays, statutory fixed holidays, and eve days (Heiligabend/Silvester).
 */

export interface PublicHoliday {
    date: string; // YYYY-MM-DD
    name: string;
    nameDe: string;
    isStateSpecific?: boolean;
    state?: string;
    isEveDay?: boolean;
}

export interface AbsenceCalculationResult {
    calendarDays: number;
    weekendDays: number;
    holidayDays: number;
    eveDays: number;
    workingDays: number;
    holidays: PublicHoliday[];
}

/**
 * Computes Easter Sunday for a given year using the Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
 */
export function getEasterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addDaysUtc(base: Date, days: number): Date {
    const d = new Date(base.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

/**
 * Returns all public holidays and notable eve days for a specific year in Germany / Berlin.
 */
export function getPublicHolidays(year: number): PublicHoliday[] {
    const easter = getEasterSunday(year);

    const goodFriday = addDaysUtc(easter, -2);
    const easterMonday = addDaysUtc(easter, 1);
    const ascensionDay = addDaysUtc(easter, 39);
    const whitMonday = addDaysUtc(easter, 50);

    const holidays: PublicHoliday[] = [
        {
            date: `${year}-01-01`,
            name: "New Year's Day",
            nameDe: "Neujahr",
        },
        {
            date: `${year}-03-08`,
            name: "International Women's Day",
            nameDe: "Internationaler Frauentag",
            isStateSpecific: true,
            state: "Berlin",
        },
        {
            date: formatDateKey(goodFriday),
            name: "Good Friday",
            nameDe: "Karfreitag",
        },
        {
            date: formatDateKey(easterMonday),
            name: "Easter Monday",
            nameDe: "Ostermontag",
        },
        {
            date: `${year}-05-01`,
            name: "Labour Day",
            nameDe: "Tag der Arbeit",
        },
        {
            date: formatDateKey(ascensionDay),
            name: "Ascension Day",
            nameDe: "Christi Himmelfahrt",
        },
        {
            date: formatDateKey(whitMonday),
            name: "Whit Monday",
            nameDe: "Pfingstmontag",
        },
        {
            date: `${year}-10-03`,
            name: "German Unity Day",
            nameDe: "Tag der Deutschen Einheit",
        },
        {
            date: `${year}-12-24`,
            name: "Christmas Eve",
            nameDe: "Heiligabend",
            isEveDay: true,
        },
        {
            date: `${year}-12-25`,
            name: "Christmas Day",
            nameDe: "1. Weihnachtstag",
        },
        {
            date: `${year}-12-26`,
            name: "Boxing Day",
            nameDe: "2. Weihnachtstag",
        },
        {
            date: `${year}-12-31`,
            name: "New Year's Eve",
            nameDe: "Silvester",
            isEveDay: true,
        },
    ];

    holidays.sort((a, b) => a.date.localeCompare(b.date));
    return holidays;
}

/**
 * Returns public holidays falling within the given date range.
 */
export function getHolidaysInRange(
    startDate: Date | string,
    endDate: Date | string,
    options?: { includeEveDays?: boolean }
): PublicHoliday[] {
    const start = normalizeToUtcDate(startDate);
    const end = normalizeToUtcDate(endDate);

    if (start > end) return [];

    const startYear = start.getUTCFullYear();
    const endYear = end.getUTCFullYear();

    const allHolidays: PublicHoliday[] = [];
    for (let y = startYear; y <= endYear; y++) {
        allHolidays.push(...getPublicHolidays(y));
    }

    const startKey = formatDateKey(start);
    const endKey = formatDateKey(end);

    return allHolidays.filter(h => {
        if (!options?.includeEveDays && h.isEveDay) return false;
        return h.date >= startKey && h.date <= endKey;
    });
}

function normalizeToUtcDate(date: Date | string): Date {
    if (typeof date === 'string') {
        const parts = date.split('T')[0].split('-');
        if (parts.length === 3) {
            return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
        }
        return new Date(date);
    }
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Calculates calendar days, weekend days, public holidays, and net working days.
 */
export function calculateAbsenceDays(
    startDate: Date | string,
    endDate: Date | string,
    options?: {
        workDaysPerWeek?: number; // default 5 (Mon-Fri)
        eveDaysFree?: boolean;    // default true (Dec 24 and Dec 31 treated as non-working days)
    }
): AbsenceCalculationResult {
    const start = normalizeToUtcDate(startDate);
    const end = normalizeToUtcDate(endDate);

    if (start > end) {
        return {
            calendarDays: 0,
            weekendDays: 0,
            holidayDays: 0,
            eveDays: 0,
            workingDays: 0,
            holidays: [],
        };
    }

    const holidaysInRange = getHolidaysInRange(start, end, { includeEveDays: true });
    const holidayDateMap = new Map<string, PublicHoliday>();
    for (const h of holidaysInRange) {
        holidayDateMap.set(h.date, h);
    }

    let calendarDays = 0;
    let weekendDays = 0;
    let holidayDays = 0;
    let eveDays = 0;
    let workingDays = 0;
    const encounteredHolidays: PublicHoliday[] = [];

    const cur = new Date(start.getTime());
    while (cur <= end) {
        calendarDays++;
        const dayOfWeek = cur.getUTCDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const key = formatDateKey(cur);
        const hol = holidayDateMap.get(key);

        if (isWeekend) {
            weekendDays++;
        } else if (hol) {
            if (hol.isEveDay) {
                if (options?.eveDaysFree !== false) {
                    eveDays++;
                    encounteredHolidays.push(hol);
                } else {
                    workingDays++;
                }
            } else {
                holidayDays++;
                encounteredHolidays.push(hol);
            }
        } else {
            workingDays++;
        }

        cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return {
        calendarDays,
        weekendDays,
        holidayDays,
        eveDays,
        workingDays,
        holidays: encounteredHolidays,
    };
}
