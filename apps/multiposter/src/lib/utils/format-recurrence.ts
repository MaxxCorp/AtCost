import { RRule } from "#lib/utils/rrule-compat.js";
import * as m from "#lib/paraglide/messages.js";
import { getLocale } from "#lib/paraglide/runtime.js";

/**
 * Options for the single, standardized recurrence text generator.
 *
 * Matrix: `short` (abbreviated vs. long form) x `includeEnd` (series end shown or omitted).
 *
 * Usage pattern:
 * - Internal views and forms: `{ includeEnd: true }` (long form + runtime)
 * - External views (public views, kiosk templates except the flat list): `includeEnd` omitted;
 *   kiosk templates additionally use `short: true`.
 */
export interface FormatRecurrenceOptions {
    /** Extremely short form with abbreviations/symbols, e.g. "monatl. 1. & 2. Fr - 31.12.26". */
    short?: boolean;
    /** Append the series end (until-date or count). Internal views and forms ONLY. */
    includeEnd?: boolean;
    /** Override the active locale. */
    locale?: string;
}

function formatOrdinalEn(pos: number): string {
    if (pos === 1) return '1st';
    if (pos === 2) return '2nd';
    if (pos === 3) return '3rd';
    if (pos === 4) return '4th';
    if (pos === -1) return 'last';
    return `${pos}th`;
}

function joinOrdinalsEn(positions: number[]): string {
    const parts = positions.map(formatOrdinalEn);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

interface ShortLabels {
    freq: string[]; // indexed by RRule frequency: YEARLY, MONTHLY, WEEKLY, DAILY
    every: (n: number, freq: number) => string;
    days: string[]; // Monday-first
    months: string[];
    last: string;
    ordinal: (n: number) => string;
    anyDay: string;
    weekday: string;
    weekendDay: string;
    count: (n: number) => string;
    date: (d: Date) => string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const SHORT_DE: ShortLabels = {
    freq: ['jährl.', 'monatl.', 'wöchentl.', 'tägl.'],
    every: (n, f) => `alle ${n} ${['J.', 'Mon.', 'Wo.', 'Tage'][f]}`,
    days: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    months: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    last: 'letzt.',
    ordinal: (n) => `${n}.`,
    anyDay: 'Tag',
    weekday: 'Werktag',
    weekendDay: 'WE-Tag',
    count: (n) => `${n}×`,
    date: (d) => `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${pad2(d.getUTCFullYear() % 100)}`
};

const SHORT_EN: ShortLabels = {
    freq: ['yrly', 'mthly', 'wkly', 'daily'],
    every: (n, f) => `every ${n} ${['yrs', 'mths', 'wks', 'days'][f]}`,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    last: 'last',
    ordinal: formatOrdinalEn,
    anyDay: 'day',
    weekday: 'weekday',
    weekendDay: 'weekend day',
    count: (n) => `${n}×`,
    date: (d) => `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}/${pad2(d.getUTCFullYear() % 100)}`
};

/** Extremely short form built structurally from the parsed rule (abbreviations, symbols, no filler words). */
function formatShort(cleanRule: string, locale: string, includeEnd: boolean): string {
    const L = locale === 'de' ? SHORT_DE : SHORT_EN;
    const o = RRule.fromString(cleanRule).origOptions as {
        freq: number;
        interval?: number;
        byweekday?: Array<{ weekday: number; n?: number } | number> | { weekday: number; n?: number } | number;
        bysetpos?: number | number[];
        bymonthday?: number | number[];
        bymonth?: number | number[];
        until?: Date | null;
        count?: number | null;
    };
    const toArr = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
    const ord = (n: number) => (n === -1 ? L.last : L.ordinal(n));

    const parts: string[] = [];
    const interval = o.interval ?? 1;
    parts.push(interval > 1 ? L.every(interval, o.freq) : L.freq[o.freq]);

    // Weekdays, grouped by their ordinals (e.g. 1FR,2FR -> "1. & 2. Fr")
    const setpos = toArr<number>(o.bysetpos);
    const byDay = new Map<number, number[]>();
    for (const wd of toArr(o.byweekday)) {
        const day = typeof wd === 'number' ? wd : wd.weekday;
        const n = typeof wd === 'number' ? undefined : wd.n;
        const list = byDay.get(day) ?? [];
        if (n) list.push(n);
        byDay.set(day, list);
    }
    const dayNums = [...byDay.keys()].sort((a, b) => a - b);
    const dayKey = (d: number) => (setpos.length ? setpos : byDay.get(d)!).join(',');
    const sameOrdinals = dayNums.every((d) => dayKey(d) === dayKey(dayNums[0]));
    const hasOrdinals = setpos.length > 0 || dayNums.some((d) => byDay.get(d)!.length > 0);

    const dayGroupLabel = (days: number[], withOrdinals: boolean): string => {
        const ordinals = withOrdinals ? (setpos.length ? setpos : byDay.get(days[0])!) : [];
        const prefix = ordinals.length ? ordinals.map(ord).join(' & ') + ' ' : '';
        const set = (d: number[]) => d.length === days.length && d.every((x) => days.includes(x));
        let label: string;
        if (withOrdinals && set([0, 1, 2, 3, 4, 5, 6])) label = L.anyDay;
        else if (withOrdinals && set([0, 1, 2, 3, 4])) label = L.weekday;
        else if (withOrdinals && set([5, 6])) label = L.weekendDay;
        else if (!withOrdinals && set([0, 1, 2, 3, 4])) label = `${L.days[0]}–${L.days[4]}`;
        else if (!withOrdinals && set([0, 1, 2, 3, 4, 5, 6])) label = '';
        else label = days.map((d) => L.days[d]).join(', ');
        return (prefix + label).trim();
    };

    if (dayNums.length > 0) {
        if (sameOrdinals) {
            parts.push(dayGroupLabel(dayNums, hasOrdinals));
        } else {
            parts.push(dayNums.map((d) => dayGroupLabel([d], true)).join(', '));
        }
    }

    const monthDays = toArr<number>(o.bymonthday);
    if (monthDays.length) parts.push(monthDays.map((d) => (d === -1 ? L.last : `${d}.`)).join(', '));
    const months = toArr<number>(o.bymonth);
    if (months.length) parts.push(months.map((mo) => L.months[mo - 1]).join(', '));

    let text = parts.filter(Boolean).join(' ');
    if (includeEnd) {
        if (o.until) text += ` - ${L.date(o.until)}`;
        else if (o.count) text += ` - ${L.count(o.count)}`;
    }
    return text;
}

/**
 * Single, standardized generator for human readable recurrence text.
 * See {@link FormatRecurrenceOptions} for the matrix (short/long x with/without series end).
 */
export function formatRecurrenceText(
    ruleStr: string | string[] | null | undefined,
    options: FormatRecurrenceOptions = {}
): string {
    if (!ruleStr) return m.recurrence();

    const omitLength = !options.includeEnd;
    const localeOverride = options.locale;

    // Extract string if it's an array
    let cleanRule = Array.isArray(ruleStr) ? ruleStr[0] : ruleStr;
    if (!cleanRule) return m.recurrence();

    try {
        if (!cleanRule.startsWith('RRULE:')) {
            cleanRule = 'RRULE:' + cleanRule;
        }

        const currentLocale = localeOverride || getLocale();

        if (options.short) {
            return formatShort(cleanRule, currentLocale, !omitLength);
        }

        // Normalize "BYDAY=1FR,2FR" (same weekday, several ordinals) to "BYDAY=FR;BYSETPOS=1,2" so it reads "1st and 2nd Friday"
        const bydayMatch = cleanRule.match(/BYDAY=((?:[-+]?\d(?:MO|TU|WE|TH|FR|SA|SU),?)+)(?=;|$)/i);
        if (bydayMatch && !/BYSETPOS=/i.test(cleanRule)) {
            const items = bydayMatch[1].split(',').filter(Boolean).map((s) => s.match(/^([-+]?\d)(\w\w)$/)!);
            if (items.length > 1 && new Set(items.map((i) => i[2].toUpperCase())).size === 1) {
                cleanRule = cleanRule.replace(bydayMatch[0], `BYDAY=${items[0][2]};BYSETPOS=${items.map((i) => i[1]).join(',')}`);
            }
        }

        // Generate English string first (strip BYSETPOS temporarily if RRule.toText fails on multi-value BYSETPOS)
        const setposMatch = cleanRule.match(/BYSETPOS=([-+\d,]+)/i);
        const ruleForText = setposMatch
            ? cleanRule.replace(/;?BYSETPOS=[-+\d,]+/i, '').replace(/RRULE:;/, 'RRULE:')
            : cleanRule;
        let textEn = RRule.fromString(ruleForText).toText();

        if (omitLength) {
            textEn = textEn.replace(/,?\s+until\s+.*$/i, '').trim();
            textEn = textEn.replace(/,?\s+for\s+\d+\s+times?$/i, '').trim();
        }

        if (setposMatch) {
            const positions = setposMatch[1]
                .split(',')
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => !isNaN(n));
            if (positions.length > 0) {
                const posStr = joinOrdinalsEn(positions);
                
                if (textEn.includes('Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday')) {
                    textEn = textEn.replace(/on Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday/gi, `on the ${posStr} day`);
                } else if (textEn.includes('Monday, Tuesday, Wednesday, Thursday, Friday') || /on weekdays/i.test(textEn)) {
                    textEn = textEn.replace(/on Monday, Tuesday, Wednesday, Thursday, Friday/gi, `on the ${posStr} weekday`);
                    textEn = textEn.replace(/on weekdays/gi, `on the ${posStr} weekday`);
                    textEn = textEn.replace(/Monday, Tuesday, Wednesday, Thursday, Friday/gi, `${posStr} weekday`);
                } else if (textEn.includes('Saturday, Sunday') || /on weekend/i.test(textEn)) {
                    textEn = textEn.replace(/on Saturday, Sunday/gi, `on the ${posStr} weekend day`);
                    textEn = textEn.replace(/Saturday, Sunday/gi, `${posStr} weekend day`);
                } else if (!/1st|2nd|3rd|4th|last/i.test(textEn)) {
                    textEn = textEn.replace(/on (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi, `on the ${posStr} $1`);
                }
            }
        }

        if (currentLocale === 'de') {
            let textDe = textEn;
            // Singular forms
            textDe = textDe.replace(/every day/g, 'jeden Tag');
            textDe = textDe.replace(/every week/g, 'jede Woche');
            textDe = textDe.replace(/every month/g, 'jeden Monat');
            textDe = textDe.replace(/every year/g, 'jedes Jahr');
            // Plural forms
            textDe = textDe.replace(/every (\d+) days/g, 'alle $1 Tage');
            textDe = textDe.replace(/every (\d+) weeks/g, 'alle $1 Wochen');
            textDe = textDe.replace(/every (\d+) months/g, 'alle $1 Monate');
            textDe = textDe.replace(/every (\d+) years/g, 'alle $1 Jahre');

            // End date as numeric date ("bis 31.12.2026"), before months get translated
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
            textDe = textDe.replace(
                /until (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/gi,
                (_match: string, mon: string, d: string, y: string) =>
                    `bis ${pad2(Number(d))}.${pad2(monthNames.indexOf(mon.toLowerCase()) + 1)}.${y}`
            );

            // Months
            const monthsMap: Record<string, string> = {
                'January': 'Januar', 'February': 'Februar', 'March': 'März', 'April': 'April',
                'May': 'Mai', 'June': 'Juni', 'July': 'Juli', 'August': 'August',
                'September': 'September', 'October': 'Oktober', 'November': 'November', 'December': 'Dezember'
            };
            for (const [en, de] of Object.entries(monthsMap)) {
                textDe = textDe.replace(new RegExp(en, 'gi'), de);
                textDe = textDe.replace(new RegExp('in ' + de, 'gi'), 'im ' + de); // English "in January" -> German "im Januar"
            }

            // Days of week
            const daysMap: Record<string, string> = {
                'Monday': 'Montag', 'Tuesday': 'Dienstag', 'Wednesday': 'Mittwoch',
                'Thursday': 'Donnerstag', 'Friday': 'Freitag', 'Saturday': 'Samstag', 'Sunday': 'Sonntag'
            };
            
            // "on Monday" -> "am Montag"
            textDe = textDe.replace(/on (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi, (_match: string, day: string) => {
                // match might have different casing, so we capitalize first letter
                const d = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
                return `am ${daysMap[d]}`;
            });
            // Replace remaining days (e.g. in lists: "on Monday, Tuesday")
            for (const [en, de] of Object.entries(daysMap)) {
                textDe = textDe.replace(new RegExp(en, 'gi'), de);
            }

            // Ordinals and relative terms
            textDe = textDe.replace(/on the last/gi, 'am letzten');
            textDe = textDe.replace(/on the (\d+)(st|nd|rd|th)/gi, 'am $1.');
            textDe = textDe.replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1.');
            textDe = textDe.replace(/\blast\b/gi, 'letzten');

            textDe = textDe.replace(/weekend days/gi, 'Wochenendtagen');
            textDe = textDe.replace(/weekend day/gi, 'Wochenendtag');
            textDe = textDe.replace(/on weekdays/gi, 'an Wochentagen');
            textDe = textDe.replace(/on a weekday/gi, 'an einem Wochentag');
            textDe = textDe.replace(/weekdays/gi, 'Wochentagen');
            textDe = textDe.replace(/weekday/gi, 'Wochentag');
            textDe = textDe.replace(/(am (?:letzten|\d+\.)(?:(?:,\s*|\s+(?:and|und)\s+)(?:letzten|\d+\.))*)\s+day\b/gi, '$1 Tag');

            // Structural words
            textDe = textDe.replace(/ until /gi, ' bis ');
            textDe = textDe.replace(/ for (\d+) times/gi, ' $1 mal');
            textDe = textDe.replace(/ for 1 time/gi, ' einmal');
            textDe = textDe.replace(/ and /gi, ' und ');
            textDe = textDe.replace(/ or /gi, ' oder ');

            if (omitLength) {
                textDe = textDe.replace(/,?\s+bis\s+(?:zum\s+)?.*$/i, '').trim();
                textDe = textDe.replace(/,?\s+\d+\s*mal.*$/i, '').trim();
                textDe = textDe.replace(/,?\s+einmal.*$/i, '').trim();
            }
            
            return textDe;
        }

        // English default formatting (already generated)
        return textEn;
    } catch (e) {
        console.error('Error formatting recurrence rule', e);
        let fallback = Array.isArray(ruleStr) ? ruleStr[0] : ruleStr;
        if (typeof fallback === 'string' && omitLength) {
            fallback = fallback.replace(/,?\s+(?:until|bis(?:\s+zum)?)\s+.*$/i, '').trim();
            fallback = fallback.replace(/,?\s+(?:for\s+\d+\s+times?|\d+\s*mal).*$/i, '').trim();
        }
        return fallback;
    }
}
