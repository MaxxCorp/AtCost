/**
 * Shared pure utilities for event sign-up management, closure date checks,
 * and default "Kontakt" contact resolution.
 */

import { parseDateTime, toZoned } from '@internationalized/date';

export const DEFAULT_SIGN_UP_CLOSURE_TIME = '23:59';

export function parseBoolFlag(val: unknown): boolean {
	return val === true || val === 'true' || val === 'on' || val === '1' || val === 1;
}

/**
 * Combines a local YYYY-MM-DD date, optional HH:mm time (defaulting to 23:59),
 * and an optional IANA timezone (defaulting to runtime local timezone) into a UTC ISO string.
 */
export function combineSignUpClosureDateTime(
	dateStr: string | null | undefined,
	timeStr?: string | null,
	timeZone?: string | null
): string {
	const cleanDate = (dateStr || '').trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return '';

	const rawTime = (timeStr || '').trim();
	const normalizedTime = /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime)
		? rawTime.length === 5
			? `${rawTime}:00`
			: rawTime
		: `${DEFAULT_SIGN_UP_CLOSURE_TIME}:00`;

	const dString = `${cleanDate}T${normalizedTime}`;
	const calendarDate = parseDateTime(dString);

	const candidates = [
		(timeZone || '').trim(),
		Intl.DateTimeFormat().resolvedOptions().timeZone
	].filter(Boolean);

	for (const tz of candidates) {
		try {
			return toZoned(calendarDate, tz).toDate().toISOString();
		} catch {
			// Ignore invalid/partial timezone while typing and try fallback
		}
	}

	const fallback = new Date(dString);
	return isNaN(fallback.getTime()) ? '' : fallback.toISOString();
}

/**
 * Parses a signup closure date/timestamp into a Date instant (or null if empty/invalid).
 * Bare YYYY-MM-DD strings without a time component default to 23:59 UTC.
 */
export function parseSignUpClosureDate(val: string | Date | null | undefined): Date | null {
	if (!val) return null;
	if (val instanceof Date) {
		return isNaN(val.getTime()) ? null : val;
	}
	const trimmed = String(val).trim();
	if (!trimmed) return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		const d = new Date(`${trimmed}T${DEFAULT_SIGN_UP_CLOSURE_TIME}:00.000Z`);
		return isNaN(d.getTime()) ? null : d;
	}
	const parsed = new Date(trimmed);
	return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Extracts `{ date: 'YYYY-MM-DD', time: 'HH:mm' }` for a signup closure timestamp
 * in the given IANA timezone (or the runtime local timezone if omitted).
 */
export function extractSignUpClosureParts(
	val: string | Date | null | undefined,
	timeZone?: string
): { date: string; time: string } {
	const d = parseSignUpClosureDate(val);
	if (!d) return { date: '', time: '' };

	try {
		const formatter = new Intl.DateTimeFormat('en-CA', {
			...(timeZone ? { timeZone } : {}),
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
		const parts = formatter.formatToParts(d);
		const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
		const year = get('year');
		const month = get('month');
		const day = get('day');
		let hour = get('hour');
		if (hour === '24') hour = '00';
		const minute = get('minute');
		if (year && month && day && hour && minute) {
			return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
		}
	} catch {
		// Fall through to local getters if timeZone is invalid
	}

	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	const hours = String(d.getHours()).padStart(2, '0');
	const minutes = String(d.getMinutes()).padStart(2, '0');
	return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

/**
 * Extracts a normalized YYYY-MM-DD string from a Date or ISO/date string in the given
 * timezone (or runtime local timezone), or "" if empty/invalid.
 */
export function formatSignUpClosureDateYmd(
	val: string | Date | null | undefined,
	timeZone?: string
): string {
	return extractSignUpClosureParts(val, timeZone).date;
}

/**
 * Returns true if the closure timestamp resolves to the default end-of-day time (23:59)
 * in the target timezone (or runtime local timezone).
 */
export function isSignUpClosureDefaultTime(
	val: string | Date | null | undefined,
	timeZone?: string
): boolean {
	return extractSignUpClosureParts(val, timeZone).time === DEFAULT_SIGN_UP_CLOSURE_TIME;
}

/**
 * Checks whether online registration has closed for an event.
 * Closure applies only to mandatory sign-up (`signUpMode === 'required'`) with a closure timestamp,
 * closing once `now` reaches or passes the closure instant.
 */
export function isSignUpClosed(
	signUpMode: string | null | undefined,
	signUpClosureDate: string | Date | null | undefined,
	now: Date = new Date()
): boolean {
	if (signUpMode !== 'required') return false;
	const closure = parseSignUpClosureDate(signUpClosureDate);
	if (!closure) return false;
	return now.getTime() >= closure.getTime();
}

/**
 * Formats a signup closure date (and optional time when differing from default 23:59)
 * for UI display in the viewer's local timezone (or explicit `timeZone`).
 */
export function formatSignUpClosureDateDisplay(
	val: string | Date | null | undefined,
	locale?: string,
	timeZone?: string
): string {
	const d = parseSignUpClosureDate(val);
	if (!d) return '';
	const datePart = d.toLocaleDateString(locale || undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		...(timeZone ? { timeZone } : {})
	});
	if (isSignUpClosureDefaultTime(d, timeZone)) {
		return datePart;
	}
	const timePart = d.toLocaleTimeString(locale || undefined, {
		hour: '2-digit',
		minute: '2-digit',
		...(timeZone ? { timeZone } : {})
	});
	return `${datePart}, ${timePart}`;
}

/**
 * Formats a compact closure date string (without year) for space-constrained kiosk layouts,
 * appending the time only when it differs from the default 23:59.
 */
export function formatSignUpClosureDateShort(
	val: string | Date | null | undefined,
	locale?: string,
	timeZone?: string
): string {
	const d = parseSignUpClosureDate(val);
	if (!d) return '';
	const isDe = (locale || '').toLowerCase().startsWith('de');
	const datePart = d.toLocaleDateString(locale || undefined, {
		year: '2-digit',
		month: isDe ? '2-digit' : 'numeric',
		day: isDe ? '2-digit' : 'numeric',
		...(timeZone ? { timeZone } : {})
	});
	if (isSignUpClosureDefaultTime(d, timeZone)) {
		return datePart;
	}
	const timePart = d.toLocaleTimeString(locale || undefined, {
		hour: isDe ? '2-digit' : 'numeric',
		minute: '2-digit',
		...(timeZone ? { timeZone } : {})
	});
	return `${datePart} ${timePart}`;
}

/**
 * Formats only the time part of a signup closure date when it differs from the default 23:59.
 * Returns `""` when unset or equal to default 23:59.
 */
export function formatSignUpClosureTimeText(
	val: string | Date | null | undefined,
	locale?: string,
	timeZone?: string,
	compact = false
): string {
	const d = parseSignUpClosureDate(val);
	if (!d || isSignUpClosureDefaultTime(d, timeZone)) return '';
	const isDe = (locale || '').toLowerCase().startsWith('de');
	return d.toLocaleTimeString(locale || undefined, {
		hour: compact && !isDe ? 'numeric' : '2-digit',
		minute: '2-digit',
		...(timeZone ? { timeZone } : {})
	});
}

/**
 * Normalizes a signup recurrence field (`string | string[] | null | undefined`) into
 * a non-empty `string[]` (matching `event.recurrence`), or `null` when empty.
 */
export function normalizeSignUpRecurrence(
	val: string | string[] | null | undefined
): string[] | null {
	if (!val) return null;
	if (Array.isArray(val)) {
		const cleaned = val
			.map((s) => (typeof s === 'string' ? s.trim() : ''))
			.filter((s) => s.length > 0);
		return cleaned.length > 0 ? cleaned : null;
	}
	if (typeof val === 'string') {
		const trimmed = val.trim();
		return trimmed.length > 0 ? [trimmed] : null;
	}
	return null;
}

/**
 * Produces a single, ultra-compact signup cue string for kiosk layouts when `signUpMode === 'required'`.
 * Returns `""` when not required so callers can guard rendering easily.
 */
export function formatKioskSignUpCompact(
	event: {
		signUpMode?: string | null;
		signUpClosureDate?: string | Date | null;
		signUpRecurrence?: string[] | string | null;
		resolvedSignUpContact?: { name?: string | null; phone?: string | null; email?: string | null } | null;
	} | null | undefined,
	labels: {
		req: string;
		by: (date: string) => string;
		orContact: (contact: string) => string;
		closed: string;
	},
	locale?: string,
	timeZone?: string,
	options?: {
		recurringDeadlineLabel?: string;
		allOccurrencesClosed?: boolean;
	}
): string {
	if (!event || event.signUpMode !== 'required') return '';

	const c = event.resolvedSignUpContact;
	const contactChannel = c?.phone?.trim() || c?.email?.trim() || '';
	const recurringLabel = options?.recurringDeadlineLabel?.trim();

	if (recurringLabel) {
		if (options?.allOccurrencesClosed) {
			return contactChannel ? `${labels.closed} (${contactChannel})` : labels.closed;
		}
		const base = labels.by(recurringLabel);
		return contactChannel ? `${base}${labels.orContact(contactChannel)}` : base;
	}

	const closed = isSignUpClosed(event.signUpMode, event.signUpClosureDate);
	if (closed) {
		return contactChannel ? `${labels.closed} (${contactChannel})` : labels.closed;
	}

	const shortDate = formatSignUpClosureDateShort(event.signUpClosureDate, locale, timeZone);
	const base = shortDate ? labels.by(shortDate) : labels.req;
	return contactChannel ? `${base}${labels.orContact(contactChannel)}` : base;
}

/**
 * Normalizes event sign-up persistence fields. When signUpMode is not `'required'`,
 * closure date, signup recurrence, and signup contact overrides are cleared to null/false.
 */
export function extractSignUpFields(data: {
	signUpMode?: string | null;
	signUpClosureDate?: string | Date | null;
	signUpRecurrence?: string[] | string | null;
	signUpContactId?: string | null;
	signUpContactOverridden?: boolean | string | null;
}) {
	const mode = (data.signUpMode || 'off') as 'off' | 'recommended' | 'required';
	if (mode !== 'required') {
		return {
			signUpMode: mode,
			signUpClosureDate: null as Date | null,
			signUpRecurrence: null as string[] | null,
			signUpContactId: null as string | null,
			signUpContactOverridden: false
		};
	}

	const closureDate = parseSignUpClosureDate(data.signUpClosureDate);
	const rawContactId =
		typeof data.signUpContactId === 'string' ? data.signUpContactId.trim() : '';

	return {
		signUpMode: mode,
		signUpClosureDate: closureDate,
		signUpRecurrence: closureDate ? normalizeSignUpRecurrence(data.signUpRecurrence) : null,
		signUpContactId: rawContactId.length > 0 ? rawContactId : null,
		signUpContactOverridden: parseBoolFlag(data.signUpContactOverridden)
	};
}

/**
 * Matches the primary contact role name ("Kontakt" or English "Contact").
 */
export function isKontaktRoleName(name: string | null | undefined): boolean {
	if (!name) return false;
	const norm = name.trim().toLowerCase();
	return norm === 'kontakt' || norm === 'contact';
}

/**
 * Finds the contact in the event's Contacts Manager that currently has the "Kontakt" role
 * (preferring exact "Kontakt" match, then English "Contact").
 */
export function findDefaultKontaktContact<T extends { id?: string; roles?: any[] }>(
	contacts: T[],
	contactRolesState: Record<string, string[]>,
	availableRoles: Array<{ id: string; name: string }>
): T | null {
	if (!Array.isArray(contacts) || contacts.length === 0) return null;

	const roleNameById = new Map<string, string>();
	for (const r of availableRoles) {
		if (r?.id) roleNameById.set(r.id, (r.name || '').trim().toLowerCase());
	}

	const getContactRoleNames = (c: T): string[] => {
		const id = c?.id;
		const assignedIds = id ? contactRolesState[id] : undefined;
		if (roleNameById.size > 0) {
			if (!Array.isArray(assignedIds) || assignedIds.length === 0) return [];
			return assignedIds.map((rid) => roleNameById.get(rid) || '').filter(Boolean);
		}
		if (Array.isArray(assignedIds) && assignedIds.length === 0) return [];
		// Fallback to embedded roles only while availableRoles hasn't loaded yet
		if (Array.isArray(c?.roles)) {
			return c.roles
				.map((r: any) =>
					(typeof r === 'string' ? r : r?.name || r?.role?.name || '').trim().toLowerCase()
				)
				.filter(Boolean);
		}
		return [];
	};

	let contactAliasMatch: T | null = null;
	for (const c of contacts) {
		const roleNames = getContactRoleNames(c);
		if (roleNames.includes('kontakt')) return c;
		if (!contactAliasMatch && roleNames.includes('contact')) {
			contactAliasMatch = c;
		}
	}
	return contactAliasMatch;
}
