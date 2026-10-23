import { type Event, type Announcement } from "@ac/validations";
import { formatRecurrenceText } from "./format-recurrence.js";
import { isSeriesItem, getSeriesRootId } from "./event-series.js";
import { getNextWeekRange, getThisWeekRange, getNextMonthRange, getThisMonthRange } from "./kiosk-dates.js";
import * as m from "#lib/paraglide/messages.js";

export type SeriesInstanceInfo = {
    id: string;
    startDateTime: string;
    endDateTime?: string | null;
    status?: string | null;
    isAllDay?: boolean;
};

export type EnrichedEvent = Event & {
    qrCodeDataUrl?: string;
    isCompressedSeries?: boolean;
    seriesDates?: string[];
    seriesInstances?: SeriesInstanceInfo[];
    recurrenceText?: string;
    instanceCount?: number;
};

export type EnrichedAnnouncement = Announcement & {
    qrCodeDataUrl?: string;
};

export interface VisibleComponentsState {
    contacts: boolean;      // All associated contacts with roles & details
    participants: boolean;  // Number of participants & occupancy
    publicStatus: boolean;  // Public or internal badge
    descriptions: boolean;  // Event descriptions
    qrCodes: boolean;       // QR codes
    ticketPrice: boolean;   // Ticket prices & free badges
    rooms: boolean;         // Rooms & facilities
    tags: boolean;          // Tags
    internalNotes: boolean; // Staff internal notes
    heroImage: boolean;     // Hero image
    openingHours: boolean;  // Location opening hours & accessibility notes
}

export const defaultVisibleComponents: VisibleComponentsState = {
    contacts: false,
    participants: false,
    publicStatus: false,
    descriptions: true,
    qrCodes: true,
    ticketPrice: true,
    rooms: true,
    tags: true,
    internalNotes: false,
    heroImage: false,
    openingHours: true,
};

// --- Contact resolution helpers ---

export function getAllEventContacts(event: Event): any[] {
    const contactsList: any[] = [];
    const seenIds: string[] = [];
    const seenNames: string[] = [];

    function registerAndAdd(c: any) {
        if (!c) return;
        const cObj = c.contact || c;
        const id = cObj.id;
        const name = getContactName(cObj).trim().toLowerCase();

        const hasSeenId = Boolean(id && seenIds.includes(id));
        const hasSeenName = Boolean(name && seenNames.includes(name));

        if (hasSeenId || hasSeenName) {
            return;
        }

        if (id) seenIds.push(id);
        if (name) seenNames.push(name);

        contactsList.push(cObj);
    }

    if (Array.isArray((event as any).contacts)) {
        for (const c of (event as any).contacts) {
            registerAndAdd(c);
        }
    }

    if (event.resolvedContact) {
        registerAndAdd(event.resolvedContact);
    }

    return contactsList;
}

export function getContactName(c: any): string {
    if (!c) return "";
    return c.displayName || [c.givenName, c.familyName].filter(Boolean).join(" ") || c.company || c.name || m.unnamed_contact?.() || "Unnamed Contact";
}

export function getContactRoles(c: any): string[] {
    if (!c) return [];
    if (Array.isArray(c.roles) && c.roles.length > 0) {
        return c.roles.map((r: any) => (typeof r === "object" && r ? r.name || r.id : String(r)));
    }
    if (c.role) return [String(c.role)];
    return [];
}

export function getContactEmail(c: any): string | null {
    if (!c) return null;
    if (c.email) return c.email;
    if (Array.isArray(c.emails) && c.emails[0]) {
        const primary = c.emails.find((e: any) => e.primary || e.isPrimary);
        return primary?.value || primary?.email || c.emails[0].value || c.emails[0].email || null;
    }
    return null;
}

export function getContactPhone(c: any): string | null {
    if (!c) return null;
    if (c.phone) return c.phone;
    if (Array.isArray(c.phones) && c.phones[0]) {
        const primary = c.phones.find((p: any) => p.primary || p.isPrimary);
        return primary?.value || primary?.phone || c.phones[0].value || c.phones[0].phone || null;
    }
    return null;
}

// --- Date & Grouping helpers ---

export function getDayKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getWeekInfo(date: Date): { year: number; week: number; weekKey: string; startOfWeek: Date; endOfWeek: Date } {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    target.setDate(target.getDate() - dayNr + 3); // Nearest Thursday
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    const isoYear = new Date(firstThursday).getFullYear();

    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayNr);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return {
        year: isoYear,
        week: weekNumber,
        weekKey: `${isoYear}-W${String(weekNumber).padStart(2, '0')}`,
        startOfWeek,
        endOfWeek
    };
}

export function getBucketKey(date: Date, smallest: "day" | "week" | "month" | "none"): string {
    if (smallest === "day") return getDayKey(date);
    if (smallest === "week") return getWeekInfo(date).weekKey;
    if (smallest === "month") return getMonthKey(date);
    return "all";
}

export function formatDateDay(dateStr: string | null | undefined): string {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "--" : d.toLocaleDateString(undefined, { day: '2-digit' });
}

export function formatDateMonth(dateStr: string | null | undefined): string {
    if (!dateStr) return "---";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "---" : d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
}

export function formatDateWeekday(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function formatTime(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeRange(startStr?: string | null, endStr?: string | null, isAllDay = false): string {
    if (isAllDay) return m.all_day_label?.() || "All Day";
    if (!startStr) return "";
    const start = new Date(startStr);
    if (isNaN(start.getTime())) return "";
    const startFormatted = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

    if (!endStr) return startFormatted;
    const end = new Date(endStr);
    if (isNaN(end.getTime())) return startFormatted;
    const endFormatted = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

    return `${startFormatted} – ${endFormatted}`;
}

export function formatFullDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// --- Series Compression ---

export function compressSeriesEvents(
    eventList: EnrichedEvent[],
    smallest: "day" | "week" | "month" | "none" = "none"
): EnrichedEvent[] {
    const seriesGroups = new Map<string, EnrichedEvent[]>();
    const nonSeriesEvents: EnrichedEvent[] = [];

    for (const evt of eventList) {
        if (isSeriesItem(evt)) {
            const sKey = getSeriesRootId(evt) || evt.id;

            let bucketKey = "all";
            if (evt.startDateTime) {
                const d = new Date(evt.startDateTime);
                if (!isNaN(d.getTime())) {
                    bucketKey = getBucketKey(d, smallest);
                }
            }

            const groupKey = `${sKey}__${bucketKey}`;
            const group = seriesGroups.get(groupKey) || [];
            group.push(evt);
            seriesGroups.set(groupKey, group);
        } else {
            nonSeriesEvents.push(evt);
        }
    }

    const compressed: EnrichedEvent[] = [...nonSeriesEvents];

    for (const [groupKey, group] of seriesGroups) {
        group.sort((a, b) => {
            const tA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
            const tB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
            return tA - tB;
        });

        const first = group[0];
        const sKey = (first as any).recurringEventId ||
            ((first as any).seriesId ? `series_${(first as any).seriesId}` : null) ||
            (first.id.includes('_inst_') ? first.id.split('_inst_')[0] : first.id);

        // Deduplicate instances for this bucket by timestamp, recording each instance's status
        const timeToInstance = new Map<number, SeriesInstanceInfo>();
        for (const g of group) {
            if (g.startDateTime) {
                const d = new Date(g.startDateTime);
                if (!isNaN(d.getTime())) {
                    const dTime = d.getTime();
                    const existing = timeToInstance.get(dTime);
                    if (!existing) {
                        timeToInstance.set(dTime, {
                            id: g.id,
                            startDateTime: d.toISOString(),
                            endDateTime: g.endDateTime,
                            status: g.status || 'confirmed',
                            isAllDay: g.isAllDay
                        });
                    } else {
                        if (g.status && g.status !== 'confirmed') {
                            existing.status = g.status;
                        }
                        if (!g.id.includes('_inst_')) {
                            existing.id = g.id;
                        }
                    }
                }
            }
        }

        const instances = Array.from(timeToInstance.values()).sort(
            (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
        );
        const dates = instances.map((inst) => inst.startDateTime);

        let rruleStr: string | null = null;
        for (const g of group) {
            if (g.recurrence && Array.isArray(g.recurrence) && g.recurrence[0]) {
                rruleStr = g.recurrence[0];
                break;
            } else if (typeof (g as any).recurrence === 'string' && (g as any).recurrence.length > 0) {
                rruleStr = (g as any).recurrence;
                break;
            } else if ((g as any).seriesMaster?.recurrence?.[0]) {
                rruleStr = (g as any).seriesMaster.recurrence[0];
                break;
            }
        }

        const recText = formatRecurrenceText(rruleStr, undefined, { omitLength: true });

        if (instances.length >= 1) {
            const allCancelled = instances.every(i => i.status === 'cancelled');
            const allTentative = instances.every(i => i.status === 'tentative');
            const overallStatus = allCancelled ? 'cancelled' : allTentative ? 'tentative' : (first.status === 'cancelled' || first.status === 'tentative' ? 'confirmed' : first.status);

            compressed.push({
                ...first,
                id: instances.length > 1 ? `${sKey}_${groupKey}` : (instances[0].id || `${sKey}_${groupKey}`),
                startDateTime: instances[0].startDateTime || first.startDateTime,
                endDateTime: instances[0].endDateTime || first.endDateTime,
                status: overallStatus,
                isCompressedSeries: true,
                seriesDates: dates,
                seriesInstances: instances,
                recurrenceText: recText,
                instanceCount: instances.length,
                qrCodePath: `/api/events/${sKey}/qr.png`,
                qrCodeDataUrl: undefined
            });
        } else {
            compressed.push({
                ...first,
                recurrenceText: recText
            });
        }
    }

    compressed.sort((a, b) => {
        const timeA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
        const timeB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
        return timeA - timeB;
    });

    return compressed;
}

/**
 * Calculates the ISO calendar week number (1-53) for a given date.
 */
export function getISOWeekNumber(d: Date): number {
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNr = (target.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
    target.setUTCDate(target.getUTCDate() + 4 - dayNr); // Nearest Thursday
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Calculates the poster programme headline by determining the closest time range of the kiosk selection:
 * 1) roughly a week: "Programm • KW<Weeknumber>"
 * 2) roughly a month: "Programm • <Month in numbers>/<Year>"
 * 3) roughly a quarter: "Programm • Q<Quarter> <Year>"
 * 4) roughly a year: "Programm • <Year>"
 */
export function formatPosterProgrammeHeadline(
    kiosk: any,
    items?: any[],
    customTitle?: string
): string {
    if (customTitle && customTitle.trim()) {
        return customTitle.trim();
    }

    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    const rangeMode = kiosk?.rangeMode;

    // 1. Direct rangeMode shortcuts
    if (rangeMode === 'this_week') {
        const range = getThisWeekRange(now);
        startDate = range.start;
        endDate = range.end;
    } else if (rangeMode === 'next_week') {
        const range = getNextWeekRange(now);
        startDate = range.start;
        endDate = range.end;
    } else if (rangeMode === 'this_month') {
        const range = getThisMonthRange(now);
        startDate = range.start;
        endDate = range.end;
    } else if (rangeMode === 'next_month') {
        const range = getNextMonthRange(now);
        startDate = range.start;
        endDate = range.end;
    }

    // 2. Kiosk explicit start/end dates
    if (!startDate && kiosk?.startDate) {
        const s = new Date(kiosk.startDate);
        if (!isNaN(s.getTime())) {
            startDate = s;
            if (kiosk.endDate) {
                const e = new Date(kiosk.endDate);
                if (!isNaN(e.getTime())) {
                    endDate = e;
                }
            }
        }
    }

    // 3. Rolling lookAhead/lookPast (only when explicitly set on kiosk)
    const hasExplicitRolling = (kiosk?.lookAhead !== undefined && kiosk?.lookAhead !== null) ||
        (kiosk?.lookAheadDays !== undefined && kiosk?.lookAheadDays !== null);

    if (!startDate && (rangeMode === 'rolling' || rangeMode === 'relative') && hasExplicitRolling) {
        const lookPastSec = Number(kiosk.lookPast || (kiosk.lookPastDays ? kiosk.lookPastDays * 86400 : 0));
        const lookAheadSec = Number(kiosk.lookAhead || (kiosk.lookAheadDays ? kiosk.lookAheadDays * 86400 : 0));
        startDate = new Date(now.getTime() - lookPastSec * 1000);
        endDate = new Date(now.getTime() + lookAheadSec * 1000);
    }

    // 4. Inspect items if available
    const eventDates: number[] = [];
    if (Array.isArray(items)) {
        for (const it of items) {
            if (it && typeof it === 'object' && 'startDateTime' in it && it.startDateTime) {
                const t = new Date(it.startDateTime).getTime();
                if (!isNaN(t)) eventDates.push(t);
            }
        }
    }

    if (eventDates.length > 0) {
        eventDates.sort((a, b) => a - b);
        if (!startDate) {
            startDate = new Date(eventDates[0]);
            if (!endDate) {
                endDate = new Date(eventDates[eventDates.length - 1]);
            }
        } else if (!endDate) {
            endDate = new Date(eventDates[eventDates.length - 1]);
        }
    }

    if (!startDate) {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (!endDate) {
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    }

    const durationDays = Math.max(1, Math.round(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Target durations:
    // Week: 7 days
    // Month: 30 days
    // Quarter: 91 days
    // Year: 365 days
    const targets = [
        { type: 'week', days: 7 },
        { type: 'month', days: 30 },
        { type: 'quarter', days: 91 },
        { type: 'year', days: 365 }
    ] as const;

    let closest: (typeof targets)[number] = targets[1];
    let minDiff = Infinity;
    for (const t of targets) {
        const diff = Math.abs(durationDays - t.days);
        if (diff < minDiff) {
            minDiff = diff;
            closest = t;
        }
    }

    const refDate = startDate;
    const year = refDate.getFullYear();

    if (closest.type === 'week') {
        const kw = getISOWeekNumber(refDate);
        return `Programm • KW${kw}`;
    }

    if (closest.type === 'month') {
        const monthNum = refDate.getMonth() + 1;
        return `Programm • ${monthNum}/${year}`;
    }

    if (closest.type === 'quarter') {
        const quarter = Math.floor(refDate.getMonth() / 3) + 1;
        return `Programm • Q${quarter} ${year}`;
    }

    return `Programm • ${year}`;
}

