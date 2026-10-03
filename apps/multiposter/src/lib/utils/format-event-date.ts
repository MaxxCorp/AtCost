/**
 * Utility functions for detecting and formatting single-day and multi-day events.
 */

export interface DateRangeParts {
	isMultiDay: boolean;
	totalDays: number;
	startDay: string;
	startMonth: string;
	startWeekday: string;
	startYear: string;
	endDay?: string;
	endMonth?: string;
	endWeekday?: string;
	endYear?: string;
	rangeText: string;
	timeRangeText: string;
}

/**
 * Checks whether an event or date range spans multiple calendar days.
 */
export function isMultiDayEvent(eventOrStart: any, endOrNull?: any): boolean {
	let startVal = eventOrStart;
	let endVal = endOrNull;
	let isAllDay = false;

	if (eventOrStart && typeof eventOrStart === "object" && "startDateTime" in eventOrStart) {
		startVal = eventOrStart.startDateTime;
		endVal = eventOrStart.endDateTime;
		isAllDay = Boolean(eventOrStart.isAllDay);
	}

	if (!startVal || !endVal) return false;

	const start = new Date(startVal);
	const end = new Date(endVal);

	if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
	if (end.getTime() <= start.getTime()) return false;

	const diffMs = end.getTime() - start.getTime();

	// Check if the ISO date strings (UTC) match
	const startIsoDate = start.toISOString().split("T")[0];
	const endIsoDate = end.toISOString().split("T")[0];

	// Check if local date strings match
	const startLocalDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
	const endLocalDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

	if (startIsoDate === endIsoDate || startLocalDate === endLocalDate) {
		return false;
	}

	// If end time is midnight 00:00:00 (local or UTC) and duration <= 24 hours, it's an exclusive 1-day boundary
	if (
		((end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) ||
		 (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0)) &&
		diffMs <= 24 * 60 * 60 * 1000
	) {
		return false;
	}

	// For all-day events: a single day event runs 00:00:00 to 23:59:59 (duration < 24h)
	if (isAllDay && diffMs <= 24 * 60 * 60 * 1000) {
		return false;
	}

	return true;
}

/**
 * Computes how many calendar days an event spans.
 */
export function getEventDurationDays(eventOrStart: any, endOrNull?: any): number {
	let startVal = eventOrStart;
	let endVal = endOrNull;

	if (eventOrStart && typeof eventOrStart === "object" && "startDateTime" in eventOrStart) {
		startVal = eventOrStart.startDateTime;
		endVal = eventOrStart.endDateTime;
	}

	if (!startVal || !endVal) return 1;

	const start = new Date(startVal);
	const end = new Date(endVal);

	if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
		return 1;
	}

	if (!isMultiDayEvent(eventOrStart, endOrNull)) {
		return 1;
	}

	const diffMs = end.getTime() - start.getTime();
	const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
	return Math.max(2, days);
}

/**
 * Extracts structured date parts for badges and cards.
 */
export function getEventDateParts(event: any, locale?: string): DateRangeParts {
	const loc = locale || undefined;
	const isMulti = isMultiDayEvent(event);
	const days = isMulti ? getEventDurationDays(event) : 1;

	const start = event?.startDateTime ? new Date(event.startDateTime) : null;
	const end = event?.endDateTime ? new Date(event.endDateTime) : null;

	if (!start || isNaN(start.getTime())) {
		return {
			isMultiDay: false,
			totalDays: 1,
			startDay: "--",
			startMonth: "---",
			startWeekday: "---",
			startYear: "----",
			rangeText: "---",
			timeRangeText: "",
		};
	}

	const startDay = start.toLocaleDateString(loc, { day: "2-digit" });
	const startMonth = start.toLocaleDateString(loc, { month: "short" });
	const startWeekday = start.toLocaleDateString(loc, { weekday: "short" });
	const startYear = start.toLocaleDateString(loc, { year: "numeric" });

	if (!isMulti || !end || isNaN(end.getTime())) {
		const sTime = start.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
		const eTime = end && !isNaN(end.getTime()) ? end.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }) : null;
		const timeRangeText = event.isAllDay ? "All Day" : eTime ? `${sTime} – ${eTime}` : sTime;

		return {
			isMultiDay: false,
			totalDays: 1,
			startDay,
			startMonth,
			startWeekday,
			startYear,
			rangeText: `${startDay}. ${startMonth}`,
			timeRangeText,
		};
	}

	const endDay = end.toLocaleDateString(loc, { day: "2-digit" });
	const endMonth = end.toLocaleDateString(loc, { month: "short" });
	const endWeekday = end.toLocaleDateString(loc, { weekday: "short" });
	const endYear = end.toLocaleDateString(loc, { year: "numeric" });

	let rangeText = "";
	if (startMonth === endMonth && startYear === endYear) {
		rangeText = `${startDay}. – ${endDay}. ${startMonth}`;
	} else if (startYear === endYear) {
		rangeText = `${startDay}. ${startMonth} – ${endDay}. ${endMonth}`;
	} else {
		rangeText = `${startDay}. ${startMonth} ${startYear} – ${endDay}. ${endMonth} ${endYear}`;
	}

	const sTime = start.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
	const eTime = end.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
	const timeRangeText = event.isAllDay ? `All Day (${days} days)` : `${sTime} – ${eTime}`;

	return {
		isMultiDay: true,
		totalDays: days,
		startDay,
		startMonth,
		startWeekday,
		startYear,
		endDay,
		endMonth,
		endWeekday,
		endYear,
		rangeText,
		timeRangeText,
	};
}

/**
 * Formats a friendly readable time string for listing cards and headers.
 */
export function formatFriendlyEventTime(
	event: any,
	i18n?: {
		all_day?: string;
		on?: string;
		to?: string;
		until?: string;
		days_count?: (count: number) => string;
		loading?: string;
	},
	locale?: string
): string {
	if (!event?.startDateTime) return i18n?.loading || "Loading...";

	const start = new Date(event.startDateTime);
	if (isNaN(start.getTime())) return i18n?.loading || "Loading...";

	const loc = locale || undefined;
	const isMulti = isMultiDayEvent(event);
	const allDayLabel = i18n?.all_day || "All-day";

	const startDateStr = start.toLocaleDateString(loc, {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	});

	if (event.isAllDay) {
		if (isMulti && event.endDateTime) {
			const end = new Date(event.endDateTime);
			const endDateStr = end.toLocaleDateString(loc, {
				weekday: "short",
				day: "numeric",
				month: "short",
				year: "numeric",
			});
			const days = getEventDurationDays(event);
			const daysSuffix = i18n?.days_count ? ` (${i18n.days_count(days)})` : ` (${days} days)`;
			return `${allDayLabel}: ${startDateStr} – ${endDateStr}${daysSuffix}`;
		}
		return `${allDayLabel} ${i18n?.on || "on"} ${startDateStr}`;
	}

	const startTime = start.toLocaleTimeString(loc, {
		hour: "2-digit",
		minute: "2-digit",
	});

	if (event.endDateTime) {
		const end = new Date(event.endDateTime);
		if (!isNaN(end.getTime())) {
			const endTime = end.toLocaleTimeString(loc, {
				hour: "2-digit",
				minute: "2-digit",
			});

			if (isMulti) {
				const endDateStr = end.toLocaleDateString(loc, {
					weekday: "short",
					day: "numeric",
					month: "short",
					year: "numeric",
				});
				return `${startDateStr}, ${startTime} – ${endDateStr}, ${endTime}`;
			}

			return `${startDateStr}, ${startTime} – ${endTime}`;
		}
	}

	return `${startDateStr}, ${startTime}`;
}
