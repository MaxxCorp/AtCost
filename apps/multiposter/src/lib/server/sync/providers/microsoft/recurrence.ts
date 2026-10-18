import { RRule } from '#lib/utils/rrule-compat.js';

export const RRULE_WEEKDAY_TO_GRAPH: Record<number, string> = {
	0: 'monday',
	1: 'tuesday',
	2: 'wednesday',
	3: 'thursday',
	4: 'friday',
	5: 'saturday',
	6: 'sunday'
};

export const GRAPH_DAY_TO_RRULE: Record<string, string> = {
	monday: 'MO',
	tuesday: 'TU',
	wednesday: 'WE',
	thursday: 'TH',
	friday: 'FR',
	saturday: 'SA',
	sunday: 'SU'
};

export function formatLocal(date: Date, timeZone: string): string {
	try {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		}).formatToParts(date);

		const p: Record<string, string> = {};
		for (const part of parts) p[part.type] = part.value;

		if (p.hour === '24') p.hour = '00';

		return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
	} catch (e) {
		return date.toISOString().split('.')[0];
	}
}

export function getDayOfWeekInTimeZone(date: Date, timeZone: string): string {
	try {
		return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(date).toLowerCase();
	} catch {
		const jsDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
		return jsDays[date.getUTCDay()];
	}
}

export function getDayOfMonthInTimeZone(date: Date, timeZone: string): number {
	try {
		const val = parseInt(new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(date), 10);
		return isNaN(val) ? date.getUTCDate() : val;
	} catch {
		return date.getUTCDate();
	}
}

export function getMonthInTimeZone(date: Date, timeZone: string): number {
	try {
		const val = parseInt(new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric' }).format(date), 10);
		return isNaN(val) ? date.getUTCMonth() + 1 : val;
	} catch {
		return date.getUTCMonth() + 1;
	}
}

export function mapPositionToIndex(pos?: number): 'first' | 'second' | 'third' | 'fourth' | 'last' {
	if (pos === 1) return 'first';
	if (pos === 2) return 'second';
	if (pos === 3) return 'third';
	if (pos === 4) return 'fourth';
	if (pos === -1 || pos === 5) return 'last';
	return 'first';
}

export function mapIndexToPosition(index?: string): number | null {
	switch (index?.toLowerCase()) {
		case 'first': return 1;
		case 'second': return 2;
		case 'third': return 3;
		case 'fourth': return 4;
		case 'last': return -1;
		default: return null;
	}
}

export function mapRRuleToMicrosoftRecurrence(rruleStr: string, start: Date, startTimeZone: string): any {
	try {
		const firstLine = rruleStr.split(/\r?\n/)[0].trim();
		const cleanStr = firstLine.replace(/^RRULE:/i, '').trim();
		const options = RRule.parseString(cleanStr);

		const startDate = formatLocal(start, startTimeZone).split('T')[0];
		const range: any = {
			startDate,
			recurrenceTimeZone: startTimeZone
		};

		if (options.until) {
			range.type = 'endDate';
			const endDate = formatLocal(new Date(options.until), startTimeZone).split('T')[0];
			range.endDate = endDate < startDate ? startDate : endDate;
		} else if (options.count && typeof options.count === 'number' && options.count > 0) {
			range.type = 'numbered';
			range.numberOfOccurrences = options.count;
		} else {
			range.type = 'noEnd';
		}

		const interval = options.interval || 1;
		const pattern: any = { interval };

		const byweekday = options.byweekday
			? Array.isArray(options.byweekday) ? options.byweekday : [options.byweekday]
			: [];
		const daysOfWeek = byweekday.map((w: any) => {
			const num = typeof w === 'number' ? w : w.weekday;
			return RRULE_WEEKDAY_TO_GRAPH[num];
		}).filter(Boolean);

		const wkstObj = options.wkst;
		const wkstNum = typeof wkstObj === 'object' && wkstObj !== null ? wkstObj.weekday : wkstObj;
		const firstDayOfWeek = wkstNum !== undefined && wkstNum !== null && RRULE_WEEKDAY_TO_GRAPH[wkstNum] ? RRULE_WEEKDAY_TO_GRAPH[wkstNum] : 'sunday';
		const isRelative = byweekday.some((w: any) => typeof w !== 'number' && w.n !== undefined) || options.bysetpos !== null && options.bysetpos !== undefined;
		let pos: number | undefined = undefined;
		if (options.bysetpos !== null && options.bysetpos !== undefined) {
			pos = Array.isArray(options.bysetpos) ? options.bysetpos[0] : options.bysetpos;
		} else if (byweekday.length > 0 && typeof byweekday[0] !== 'number' && byweekday[0].n !== undefined) {
			pos = byweekday[0].n;
		}

		switch (options.freq) {
			case 3: // DAILY
				pattern.type = 'daily';
				break;
			case 2: // WEEKLY
				pattern.type = 'weekly';
				pattern.daysOfWeek = daysOfWeek.length > 0 ? daysOfWeek : [getDayOfWeekInTimeZone(start, startTimeZone)];
				pattern.firstDayOfWeek = firstDayOfWeek;
				break;
			case 1: // MONTHLY
				if (isRelative) {
					pattern.type = 'relativeMonthly';
					pattern.daysOfWeek = daysOfWeek.length > 0 ? daysOfWeek : [getDayOfWeekInTimeZone(start, startTimeZone)];
					pattern.index = mapPositionToIndex(pos);
				} else {
					pattern.type = 'absoluteMonthly';
					pattern.dayOfMonth = options.bymonthday
						? Array.isArray(options.bymonthday) ? options.bymonthday[0] : options.bymonthday
						: getDayOfMonthInTimeZone(start, startTimeZone);
				}
				break;
			case 0: // YEARLY
				if (isRelative) {
					pattern.type = 'relativeYearly';
					pattern.daysOfWeek = daysOfWeek.length > 0 ? daysOfWeek : [getDayOfWeekInTimeZone(start, startTimeZone)];
					pattern.index = mapPositionToIndex(pos);
					pattern.month = options.bymonth
						? Array.isArray(options.bymonth) ? options.bymonth[0] : options.bymonth
						: getMonthInTimeZone(start, startTimeZone);
				} else {
					pattern.type = 'absoluteYearly';
					pattern.dayOfMonth = options.bymonthday
						? Array.isArray(options.bymonthday) ? options.bymonthday[0] : options.bymonthday
						: getDayOfMonthInTimeZone(start, startTimeZone);
					pattern.month = options.bymonth
						? Array.isArray(options.bymonth) ? options.bymonth[0] : options.bymonth
						: getMonthInTimeZone(start, startTimeZone);
				}
				break;
			default:
				return undefined;
		}

		return { pattern, range };
	} catch (e) {
		console.warn('[MicrosoftCalendar] Failed to parse recurrence rule:', rruleStr, e);
		return undefined;
	}
}

export function mapMicrosoftRecurrenceToRRule(recurrence: any): string | undefined {
	const pattern = recurrence?.pattern;
	const range = recurrence?.range;
	if (!pattern) return undefined;

	const parts: string[] = [];

	switch (pattern.type?.toLowerCase()) {
		case 'daily':
			parts.push('FREQ=DAILY');
			break;
		case 'weekly':
			parts.push('FREQ=WEEKLY');
			if (pattern.daysOfWeek && Array.isArray(pattern.daysOfWeek) && pattern.daysOfWeek.length > 0) {
				const days = pattern.daysOfWeek
					.map((d: string) => GRAPH_DAY_TO_RRULE[d.toLowerCase()])
					.filter(Boolean);
				if (days.length > 0) {
					parts.push(`BYDAY=${days.join(',')}`);
				}
			}
			if (pattern.firstDayOfWeek) {
				const wkst = GRAPH_DAY_TO_RRULE[pattern.firstDayOfWeek.toLowerCase()];
				if (wkst) parts.push(`WKST=${wkst}`);
			}
			break;
		case 'absolutemonthly':
			parts.push('FREQ=MONTHLY');
			if (pattern.dayOfMonth) {
				parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
			}
			break;
		case 'relativemonthly': {
			parts.push('FREQ=MONTHLY');
			const pos = mapIndexToPosition(pattern.index);
			const days = (pattern.daysOfWeek || [])
				.map((d: string) => GRAPH_DAY_TO_RRULE[d.toLowerCase()])
				.filter(Boolean);
			if (days.length === 1 && pos !== null) {
				parts.push(`BYDAY=${pos}${days[0]}`);
			} else if (days.length > 0) {
				parts.push(`BYDAY=${days.join(',')}`);
				if (pos !== null) parts.push(`BYSETPOS=${pos}`);
			}
			break;
		}
		case 'absoluteyearly':
			parts.push('FREQ=YEARLY');
			if (pattern.month) {
				parts.push(`BYMONTH=${pattern.month}`);
			}
			if (pattern.dayOfMonth) {
				parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
			}
			break;
		case 'relativeyearly': {
			parts.push('FREQ=YEARLY');
			if (pattern.month) {
				parts.push(`BYMONTH=${pattern.month}`);
			}
			const pos = mapIndexToPosition(pattern.index);
			const days = (pattern.daysOfWeek || [])
				.map((d: string) => GRAPH_DAY_TO_RRULE[d.toLowerCase()])
				.filter(Boolean);
			if (days.length === 1 && pos !== null) {
				parts.push(`BYDAY=${pos}${days[0]}`);
			} else if (days.length > 0) {
				parts.push(`BYDAY=${days.join(',')}`);
				if (pos !== null) parts.push(`BYSETPOS=${pos}`);
			}
			break;
		}
		default:
			return undefined;
	}

	if (pattern.interval && pattern.interval > 1) {
		parts.push(`INTERVAL=${pattern.interval}`);
	}

	if (range) {
		if (range.type === 'endDate' && range.endDate) {
			const cleanEnd = range.endDate.replace(/-/g, '');
			parts.push(`UNTIL=${cleanEnd}T235959Z`);
		} else if (range.type === 'numbered' && range.numberOfOccurrences) {
			parts.push(`COUNT=${range.numberOfOccurrences}`);
		}
	}

	return `RRULE:${parts.join(';')}`;
}
