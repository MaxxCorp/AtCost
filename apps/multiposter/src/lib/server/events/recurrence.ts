import { RRule } from '$lib/utils/rrule-compat';
import { parseDateTime, toZoned } from '@internationalized/date';

function getWallClockComponents(date: Date, timeZone?: string | null) {
	const tz = timeZone || 'UTC';
	try {
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: tz,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		});
		const parts = formatter.formatToParts(date);
		const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';
		let hour = getPart('hour');
		if (hour === '24') hour = '00';
		return {
			year: parseInt(getPart('year'), 10),
			month: parseInt(getPart('month'), 10),
			day: parseInt(getPart('day'), 10),
			hour: parseInt(hour, 10),
			minute: parseInt(getPart('minute'), 10),
			second: parseInt(getPart('second'), 10),
		};
	} catch {
		return {
			year: date.getUTCFullYear(),
			month: date.getUTCMonth() + 1,
			day: date.getUTCDate(),
			hour: date.getUTCHours(),
			minute: date.getUTCMinutes(),
			second: date.getUTCSeconds(),
		};
	}
}

export function expandRecurrence(
	recurrenceRule: string,
	start: Date,
	end: Date | null,
	limitCount: number = 50,
	limitYear: boolean = true,
	startTimeZone?: string | null
): { date: Date; end: Date | null }[] {
	try {
		const ruleOptions = RRule.parseString(recurrenceRule);

		// Default safety limits
		if (!ruleOptions.count && !ruleOptions.until) {
			ruleOptions.count = limitCount;
		}

		const tz = startTimeZone || 'UTC';
		const wallClock = getWallClockComponents(start, tz);

		ruleOptions.dtstart = new Date(
			Date.UTC(
				wallClock.year,
				wallClock.month - 1,
				wallClock.day,
				wallClock.hour,
				wallClock.minute,
				wallClock.second
			)
		);

		// Re-create rule with start date context
		const rruleObj = new RRule(ruleOptions);

		const now = new Date();
		const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

		const allDates = rruleObj.all((date: Date, i: number) => {
			if (limitYear && date >= oneYearFromNow) return false;
			return i < limitCount * 2; // Safety break
		});

		// Duration for end time calculation
		const durationMs = end ? end.getTime() - start.getTime() : 0;

		const instances: { date: Date; end: Date | null }[] = [];

		for (const d of allDates) {
			const yearStr = String(d.getUTCFullYear()).padStart(4, '0');
			const monthStr = String(d.getUTCMonth() + 1).padStart(2, '0');
			const dayStr = String(d.getUTCDate()).padStart(2, '0');
			const hourStr = String(d.getUTCHours()).padStart(2, '0');
			const minStr = String(d.getUTCMinutes()).padStart(2, '0');
			const secStr = String(d.getUTCSeconds()).padStart(2, '0');

			let instanceStart: Date;
			if (tz && tz !== 'UTC') {
				try {
					const wallClockIso = `${yearStr}-${monthStr}-${dayStr}T${hourStr}:${minStr}:${secStr}`;
					const calendarDate = parseDateTime(wallClockIso);
					const zonedDate = toZoned(calendarDate, tz);
					instanceStart = zonedDate.toDate();
				} catch {
					instanceStart = new Date(
						Date.UTC(
							d.getUTCFullYear(),
							d.getUTCMonth(),
							d.getUTCDate(),
							d.getUTCHours(),
							d.getUTCMinutes(),
							d.getUTCSeconds()
						)
					);
				}
			} else {
				instanceStart = new Date(
					Date.UTC(
						d.getUTCFullYear(),
						d.getUTCMonth(),
						d.getUTCDate(),
						d.getUTCHours(),
						d.getUTCMinutes(),
						d.getUTCSeconds()
					)
				);
			}

			// Skip the master event instance (same start time)
			if (instanceStart.getTime() === start.getTime()) continue;

			const instanceEnd = end ? new Date(instanceStart.getTime() + durationMs) : null;
			instances.push({ date: instanceStart, end: instanceEnd });

			if (instances.length >= limitCount) break;
		}

		return instances;
	} catch (e) {
		console.error('Error expanding recurrence:', e);
		return [];
	}
}

