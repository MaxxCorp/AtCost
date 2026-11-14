/**
 * Shared pure utilities for event sign-up management, closure date checks,
 * and default "Kontakt" contact resolution.
 */

export function parseBoolFlag(val: unknown): boolean {
	return val === true || val === 'true' || val === 'on' || val === '1' || val === 1;
}

/**
 * Extracts a normalized YYYY-MM-DD string from a Date or ISO/date string, or "" if empty/invalid.
 */
export function formatSignUpClosureDateYmd(val: string | Date | null | undefined): string {
	if (!val) return '';
	if (val instanceof Date) {
		return isNaN(val.getTime()) ? '' : val.toISOString().slice(0, 10);
	}
	const trimmed = String(val).trim();
	if (!trimmed) return '';
	const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
	if (match) {
		const check = new Date(`${match[1]}T00:00:00.000Z`);
		return isNaN(check.getTime()) ? '' : match[1];
	}
	const parsed = new Date(trimmed);
	return isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

/**
 * Parses a signup closure date into UTC midnight Date (or null if empty/invalid).
 */
export function parseSignUpClosureDate(val: string | Date | null | undefined): Date | null {
	const ymd = formatSignUpClosureDateYmd(val);
	if (!ymd) return null;
	const d = new Date(`${ymd}T00:00:00.000Z`);
	return isNaN(d.getTime()) ? null : d;
}

/**
 * Checks whether online registration has closed for an event.
 * Closure applies only to mandatory sign-up (`signUpMode === 'required'`) with a closure date,
 * and closes after the end of the closure calendar day (UTC).
 */
export function isSignUpClosed(
	signUpMode: string | null | undefined,
	signUpClosureDate: string | Date | null | undefined,
	now: Date = new Date()
): boolean {
	if (signUpMode !== 'required') return false;
	const closureYmd = formatSignUpClosureDateYmd(signUpClosureDate);
	if (!closureYmd) return false;
	const todayYmd = now.toISOString().slice(0, 10);
	return todayYmd > closureYmd;
}

/**
 * Formats a signup closure date for UI display in a timezone-stable UTC calendar format.
 */
export function formatSignUpClosureDateDisplay(
	val: string | Date | null | undefined,
	locale?: string
): string {
	const d = parseSignUpClosureDate(val);
	if (!d) return '';
	return d.toLocaleDateString(locale || undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
}

/**
 * Formats a compact closure date string (without year) for space-constrained kiosk layouts.
 */
export function formatSignUpClosureDateShort(
	val: string | Date | null | undefined,
	locale?: string
): string {
	const d = parseSignUpClosureDate(val);
	if (!d) return '';
	const isDe = (locale || '').toLowerCase().startsWith('de');
	return d.toLocaleDateString(locale || undefined, {
		month: isDe ? '2-digit' : 'short',
		day: isDe ? '2-digit' : 'numeric',
		timeZone: 'UTC'
	});
}

/**
 * Produces a single, ultra-compact signup cue string for kiosk layouts when `signUpMode === 'required'`.
 * Returns `""` when not required so callers can guard rendering easily.
 */
export function formatKioskSignUpCompact(
	event: {
		signUpMode?: string | null;
		signUpClosureDate?: string | Date | null;
		resolvedSignUpContact?: { name?: string | null; phone?: string | null; email?: string | null } | null;
	} | null | undefined,
	labels: {
		req: string;
		by: (date: string) => string;
		closed: string;
	},
	locale?: string
): string {
	if (!event || event.signUpMode !== 'required') return '';

	const closed = isSignUpClosed(event.signUpMode, event.signUpClosureDate);
	const shortDate = formatSignUpClosureDateShort(event.signUpClosureDate, locale);
	const statusPart = closed
		? labels.closed
		: shortDate
			? labels.by(shortDate)
			: labels.req;

	const c = event.resolvedSignUpContact;
	const contactName = c?.name?.trim() || '';
	const contactChannel = c?.phone?.trim() || c?.email?.trim() || '';
	const contactPart = [contactName, contactChannel].filter(Boolean).join(', ');

	if (!contactPart) return statusPart;
	return `${statusPart} (${contactPart})`;
}

/**
 * Normalizes event sign-up persistence fields. When signUpMode is not `'required'`,
 * closure date and signup contact overrides are cleared to null/false.
 */
export function extractSignUpFields(data: {
	signUpMode?: string | null;
	signUpClosureDate?: string | Date | null;
	signUpContactId?: string | null;
	signUpContactOverridden?: boolean | string | null;
}) {
	const mode = (data.signUpMode || 'off') as 'off' | 'recommended' | 'required';
	if (mode !== 'required') {
		return {
			signUpMode: mode,
			signUpClosureDate: null as Date | null,
			signUpContactId: null as string | null,
			signUpContactOverridden: false
		};
	}

	const rawContactId =
		typeof data.signUpContactId === 'string' ? data.signUpContactId.trim() : '';

	return {
		signUpMode: mode,
		signUpClosureDate: parseSignUpClosureDate(data.signUpClosureDate),
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
