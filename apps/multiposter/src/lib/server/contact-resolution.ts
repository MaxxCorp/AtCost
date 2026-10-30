import { db } from '@ac/db';
import { getEntityContacts } from './contacts';
import type { ExternalEvent } from './sync/types';

export interface ResolvedContact {
	id?: string;
	name: string;
	email: string;
	phone: string;
	role?: string;
	roles?: string[];
	qrCodePath?: string;
	qrCodeDataUrl?: string;
	isPublic?: boolean;
}

export interface ContactResolutionOptions {
	filterWorkOnly?: boolean;
	publicOnly?: boolean;
	fallbackToLocation?: boolean;
	fallbackToFirst?: boolean;
}

/**
 * Checks whether a contact is eligible for resolution under the given options.
 * - Obfuscated contacts are never eligible.
 * - Contacts explicitly marked `isPublic === false` are never eligible as display/resolved contacts.
 * - When `publicOnly` is true, `contact.isPublic` must be strictly `true`.
 */
export function isContactEligibleForResolution(
	contactOrAssociation: any,
	options: { filterWorkOnly?: boolean; publicOnly?: boolean } = {}
): boolean {
	if (!contactOrAssociation) return false;
	const c = contactOrAssociation.contact || contactOrAssociation;
	if (!c) return false;
	if (c.obfuscationStatus === 'obfuscated') return false;
	if (c.isPublic === false) return false;
	if (options.publicOnly) {
		return c.isPublic === true;
	}
	return true;
}

/**
 * Checks whether a location is eligible for contact resolution under the given options.
 * - Locations explicitly marked `location.isPublic === false` are never eligible.
 * - When `publicOnly` is true, `location.isPublic` must be strictly `true`.
 */
export function isLocationEligibleForResolution(
	locationOrAssociation: any,
	options: { filterWorkOnly?: boolean; publicOnly?: boolean } = {}
): boolean {
	if (!locationOrAssociation) return false;
	const loc = locationOrAssociation.location || locationOrAssociation;
	if (!loc) return false;
	if (loc.isPublic === false) return false;
	if (options.publicOnly) {
		return loc.isPublic === true;
	}
	return true;
}

/**
 * Priority Tier 1: Role "Contact" or "Kontakt" (or "Main Contact" / "Hauptkontakt").
 */
export function isContactRole(contactOrAssociation: any): boolean {
	if (!contactOrAssociation) return false;
	const c = contactOrAssociation.contact || contactOrAssociation;
	const rawRoles = contactOrAssociation.roles || c.roles || contactOrAssociation.eventRoles || c.eventRoles || [];
	const roleNames = rawRoles.map((r: any) => typeof r === 'string' ? r : r.name || r.role?.name || '').filter(Boolean);
	if (c.role) roleNames.push(c.role);

	return roleNames.some((r: string) => {
		const name = r.trim().toLowerCase();
		return (
			name === 'contact' ||
			name === 'kontakt' ||
			name === 'main contact' ||
			name === 'maincontact' ||
			name === 'main_contact' ||
			name === 'hauptkontakt'
		);
	});
}

/**
 * Checks whether a contact has a "Main Contact" role (alias for Tier 1).
 */
export function isMainContact(contactOrAssociation: any): boolean {
	return isContactRole(contactOrAssociation);
}

/**
 * Priority Tier 2: Role "Verantwortlich" or "Responsible".
 */
export function isResponsibleRole(contactOrAssociation: any): boolean {
	if (!contactOrAssociation) return false;
	const c = contactOrAssociation.contact || contactOrAssociation;
	const rawRoles = contactOrAssociation.roles || c.roles || contactOrAssociation.eventRoles || c.eventRoles || [];
	const roleNames = rawRoles.map((r: any) => typeof r === 'string' ? r : r.name || r.role?.name || '').filter(Boolean);
	if (c.role) roleNames.push(c.role);

	return roleNames.some((r: string) => {
		const name = r.trim().toLowerCase();
		return (
			name === 'verantwortlich' ||
			name === 'verantwortlicher' ||
			name === 'verantwortliche' ||
			name === 'responsible'
		);
	});
}

/**
 * Priority Tier 3: Role "Moderator".
 */
export function isModeratorRole(contactOrAssociation: any): boolean {
	if (!contactOrAssociation) return false;
	const c = contactOrAssociation.contact || contactOrAssociation;
	const rawRoles = contactOrAssociation.roles || c.roles || contactOrAssociation.eventRoles || c.eventRoles || [];
	const roleNames = rawRoles.map((r: any) => typeof r === 'string' ? r : r.name || r.role?.name || '').filter(Boolean);
	if (c.role) roleNames.push(c.role);

	return roleNames.some((r: string) => {
		const name = r.trim().toLowerCase();
		return name === 'moderator' || name === 'moderation';
	});
}

/**
 * Priority Tier 4: Tag "Employee" or "Mitarbeiter".
 */
export function isEmployeeContact(contactOrAssociation: any): boolean {
	if (!contactOrAssociation) return false;
	const contact = contactOrAssociation.contact || contactOrAssociation;
	const tags = contact.tags || contactOrAssociation.tags || [];

	return tags.some((t: any) => {
		const tagName = (t?.name || t?.tag?.name || (typeof t === 'string' ? t : '')).trim().toLowerCase();
		return (
			tagName === 'employee' ||
			tagName === 'employees' ||
			tagName === 'mitarbeiter' ||
			tagName === 'mitarbeitende' ||
			tagName === 'staff'
		);
	});
}

/**
 * Returns the numerical priority rank (1 to 5) for a contact or contact association:
 * 1: Role "Contact" or "Kontakt"
 * 2: Role "Verantwortlich" or "Responsible"
 * 3: Role "Moderator"
 * 4: Tag "Employee" or "Mitarbeiter"
 * 5: Other contacts
 */
export function getContactPriorityRank(contactOrAssociation: any): number {
	if (isContactRole(contactOrAssociation)) return 1;
	if (isResponsibleRole(contactOrAssociation)) return 2;
	if (isModeratorRole(contactOrAssociation)) return 3;
	if (isEmployeeContact(contactOrAssociation)) return 4;
	return 5;
}

/**
 * Sorts contacts or contact associations by the defined preference hierarchy:
 * 1. Contact / Kontakt
 * 2. Verantwortlich / Responsible
 * 3. Moderator
 * 4. Employee / Mitarbeiter
 * 5. Other contacts (alphabetical by name)
 */
export function sortContactsByPriority<T = any>(contacts: T[]): T[] {
	if (!Array.isArray(contacts)) return [];
	return [...contacts].sort((a: any, b: any) => {
		const rankA = getContactPriorityRank(a);
		const rankB = getContactPriorityRank(b);
		if (rankA !== rankB) return rankA - rankB;

		const cA = a?.contact || a || {};
		const cB = b?.contact || b || {};
		const nameA = (cA.displayName || `${cA.givenName || ''} ${cA.familyName || ''}`.trim() || cA.company || cA.name || '').toLowerCase();
		const nameB = (cB.displayName || `${cB.givenName || ''} ${cB.familyName || ''}`.trim() || cB.company || cB.name || '').toLowerCase();
		return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
	});
}

/**
 * Extracts normalized details from a contact entity.
 */
export function extractContactDetails(
	contactOrAssociation: any,
	options: { filterWorkOnly?: boolean; publicOnly?: boolean } = {}
): ResolvedContact | null {
	if (!contactOrAssociation) return null;
	if (!isContactEligibleForResolution(contactOrAssociation, options)) return null;

	const c = contactOrAssociation.contact || contactOrAssociation;
	const enforceWorkOnly = Boolean(options.filterWorkOnly || options.publicOnly);

	const fullName = c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim() || c.company || '';

	let email = '';
	if (enforceWorkOnly) {
		const workEmails = (c.emails || []).filter((e: any) => e?.type?.toLowerCase() === 'work' && e?.value);
		email = workEmails.find((e: any) => e.primary)?.value || workEmails[0]?.value || '';
	} else {
		email = c.emails?.find((e: any) => e.primary)?.value || c.emails?.[0]?.value || '';
	}

	let phone = '';
	if (enforceWorkOnly) {
		const workPhones = (c.phones || []).filter((p: any) => p?.type?.toLowerCase() === 'work' && p?.value);
		phone = workPhones.find((p: any) => p.primary)?.value || workPhones[0]?.value || '';
	} else {
		phone = c.phones?.find((p: any) => p.primary)?.value || c.phones?.[0]?.value || '';
	}

	let qrCodePath = c.qrCodePath;
	if (c.id && (!qrCodePath || !qrCodePath.includes('/api/'))) {
		qrCodePath = `/api/contacts/${c.id}/qr.png`;
	}

	const rawRoles = contactOrAssociation.roles || c.roles || contactOrAssociation.eventRoles || c.eventRoles || [];
	const roles = rawRoles.map((r: any) => typeof r === 'string' ? r : r.name || r.role?.name || '').filter(Boolean);
	const role = roles.length > 0 ? roles.join(', ') : (c.role || undefined);

	return {
		id: c.id || undefined,
		name: fullName,
		email,
		phone,
		role,
		roles: roles.length > 0 ? roles : undefined,
		qrCodePath,
		qrCodeDataUrl: c.qrCodeDataUrl || (qrCodePath?.startsWith('data:') ? qrCodePath : undefined),
		...(c.isPublic !== undefined ? { isPublic: Boolean(c.isPublic) } : {})
	};
}

/**
 * Resolves contact from a list of contacts according to priority hierarchy:
 * 1. Role "Contact" or "Kontakt"
 * 2. Role "Verantwortlich" or "Responsible"
 * 3. Role "Moderator"
 * 4. Tag "Employee" or "Mitarbeiter"
 * 5. Fallback to first eligible contact (if fallbackToFirst !== false)
 */
export function resolveContactFromList(
	contacts: any[] | undefined | null,
	options: { filterWorkOnly?: boolean; publicOnly?: boolean; fallbackToFirst?: boolean } = {}
): ResolvedContact | null {
	if (!contacts || contacts.length === 0) return null;

	const eligibleContacts = contacts.filter((c: any) => isContactEligibleForResolution(c, options));
	if (eligibleContacts.length === 0) return null;

	const sorted = sortContactsByPriority(eligibleContacts);

	if (options.fallbackToFirst !== false) {
		return extractContactDetails(sorted[0], options);
	}

	if (getContactPriorityRank(sorted[0]) <= 4) {
		return extractContactDetails(sorted[0], options);
	}

	return null;
}

/**
 * Resolves a Location's contact using the standard priority hierarchy on its associated contacts.
 */
export function resolveLocationContactSync(
	locationData: any,
	options: { filterWorkOnly?: boolean; publicOnly?: boolean; fallbackToFirst?: boolean } = {}
): ResolvedContact | null {
	if (!locationData) return null;
	if (!isLocationEligibleForResolution(locationData, options)) return null;
	const loc = locationData.location || locationData;
	const contacts = loc.locationContacts || loc.contacts || [];
	return resolveContactFromList(contacts, options);
}

export async function resolveLocationContact(
	locationOrId: any,
	options: { filterWorkOnly?: boolean; publicOnly?: boolean; fallbackToFirst?: boolean } = {}
): Promise<ResolvedContact | null> {
	if (!locationOrId) return null;

	if (typeof locationOrId === 'string') {
		if (options.publicOnly || options.filterWorkOnly) {
			const locRecord = await db.query.location.findFirst({
				where: (l: any, { eq }: any) => eq(l.id, locationOrId)
			});
			if (!locRecord || !isLocationEligibleForResolution(locRecord, options)) {
				return null;
			}
		}
		const contacts = await getEntityContacts('location', locationOrId, true);
		return resolveContactFromList(contacts, options);
	}

	if (!isLocationEligibleForResolution(locationOrId, options)) {
		return null;
	}

	if (locationOrId.locationContacts || locationOrId.contacts) {
		return resolveLocationContactSync(locationOrId, options);
	}

	if (locationOrId.id) {
		const contacts = await getEntityContacts('location', locationOrId.id, true);
		return resolveContactFromList(contacts, options);
	}

	return null;
}

/**
 * Synchronous Event Contact Resolution when relations are already loaded in memory:
 * 1. Evaluates event's own contacts in priority order:
 *    - Role "Contact" or "Kontakt"
 *    - Role "Verantwortlich" or "Responsible"
 *    - Role "Moderator"
 *    - Tag "Employee" or "Mitarbeiter"
 *    - Fallback: first eligible event contact
 * 2. If event has NO eligible contacts, and fallbackToLocation is enabled:
 *    - Fallback: checks contacts from associated event locations/resource locations.
 */
export function resolveEventContactSync(
	eventData: any,
	options: ContactResolutionOptions = {}
): ResolvedContact | null {
	if (!eventData) return null;

	const {
		fallbackToLocation = true,
		fallbackToFirst = true,
		filterWorkOnly = false,
		publicOnly = false
	} = options;
	const eligibilityOpts = { filterWorkOnly, publicOnly, fallbackToFirst };

	const eventContacts = (eventData.contacts || [])
		.map((ec: any) => {
			const c = ec.contact || ec;
			return {
				...c,
				roles: ec.roles || c.roles || []
			};
		})
		.filter((c: any) => isContactEligibleForResolution(c, eligibilityOpts));

	// If event has eligible contacts, resolve strictly from event contacts (resolution ends here)
	if (eventContacts.length > 0) {
		return resolveContactFromList(eventContacts, eligibilityOpts);
	}

	// Only if event has no eligible contacts and fallbackToLocation is requested:
	if (fallbackToLocation) {
		const locationList: any[] = [];
		if (Array.isArray(eventData.locations)) {
			for (const l of eventData.locations) {
				const loc = l?.location || l;
				if (loc && isLocationEligibleForResolution(loc, eligibilityOpts)) {
					locationList.push(loc);
				}
			}
		}
		if (Array.isArray(eventData.resources)) {
			for (const r of eventData.resources) {
				const loc = (r?.resource || r)?.location;
				if (loc && isLocationEligibleForResolution(loc, eligibilityOpts)) {
					locationList.push(loc);
				}
			}
		}

		for (const loc of locationList) {
			const locContacts = (loc.locationContacts || loc.contacts || []).filter((c: any) =>
				isContactEligibleForResolution(c, eligibilityOpts)
			);
			if (locContacts.length > 0) {
				const resolved = resolveContactFromList(locContacts, eligibilityOpts);
				if (resolved) return resolved;
			}
		}
	}

	return null;
}

/**
 * Resolves the primary contact for an event (accepts object with relations or eventId string).
 */
export async function resolveEventContact(
	eventOrId: any,
	options: ContactResolutionOptions = {}
): Promise<ResolvedContact | null> {
	if (!eventOrId) return null;

	// If already an object with contacts or locations loaded, resolve synchronously
	if (typeof eventOrId === 'object' && (eventOrId.contacts !== undefined || eventOrId.locations !== undefined)) {
		return resolveEventContactSync(eventOrId, options);
	}

	const eventId = typeof eventOrId === 'string' ? eventOrId : (eventOrId.id || eventOrId.metadata?.eventId);
	if (!eventId) return null;

	const {
		fallbackToLocation = true,
		fallbackToFirst = true,
		filterWorkOnly = false,
		publicOnly = false
	} = options;
	const eligibilityOpts = { filterWorkOnly, publicOnly, fallbackToFirst };

	// 1. Check event contacts
	const rawEventContacts = await getEntityContacts('event', eventId, true);
	const eventContacts = rawEventContacts.filter((c: any) =>
		isContactEligibleForResolution(c, eligibilityOpts)
	);

	if (eventContacts.length > 0) {
		return resolveContactFromList(eventContacts, eligibilityOpts);
	}

	// 2. Check location contacts only if fallbackToLocation is enabled and event has no contacts
	if (fallbackToLocation) {
		const locationIds = new Set<string>();

		// From event_location
		const directLocations = await db.query.eventLocation.findMany({
			where: (el: any, { eq }: any) => eq(el.eventId, eventId),
			with: {
				location: true
			}
		});
		for (const el of directLocations) {
			const loc = (el as any).location;
			if (el.locationId && (!loc || isLocationEligibleForResolution(loc, eligibilityOpts))) {
				locationIds.add(el.locationId);
			}
		}

		// From event_resource -> resource -> location
		const resources = await db.query.eventResource.findMany({
			where: (er: any, { eq }: any) => eq(er.eventId, eventId),
			with: {
				resource: {
					with: {
						location: true
					}
				}
			}
		});
		for (const er of resources) {
			const res = (er as any).resource;
			const locId = res?.locationId;
			const loc = res?.location;
			if (locId && (!loc || isLocationEligibleForResolution(loc, eligibilityOpts))) {
				locationIds.add(locId);
			}
		}

		for (const locId of locationIds) {
			const rawLocContacts = await getEntityContacts('location', locId, true);
			const locContacts = rawLocContacts.filter((c: any) =>
				isContactEligibleForResolution(c, eligibilityOpts)
			);
			if (locContacts.length > 0) {
				const resolved = resolveContactFromList(locContacts, eligibilityOpts);
				if (resolved) return resolved;
			}
		}
	}

	return null;
}

/**
 * Resolves an Announcement's contact using the standard priority hierarchy.
 */
export function resolveAnnouncementContactSync(
	announcementData: any,
	options: ContactResolutionOptions = {}
): ResolvedContact | null {
	if (!announcementData) return null;

	const {
		fallbackToLocation = true,
		fallbackToFirst = true,
		filterWorkOnly = false,
		publicOnly = false
	} = options;
	const eligibilityOpts = { filterWorkOnly, publicOnly, fallbackToFirst };

	const contacts = (announcementData.contacts || [])
		.map((ac: any) => {
			const c = ac.contact || ac;
			return {
				...c,
				roles: ac.roles || c.roles || []
			};
		})
		.filter((c: any) => isContactEligibleForResolution(c, eligibilityOpts));

	if (contacts.length > 0) {
		return resolveContactFromList(contacts, eligibilityOpts);
	}

	if (fallbackToLocation && Array.isArray(announcementData.locations)) {
		const eligibleLocations = announcementData.locations
			.map((l: any) => l?.location || l)
			.filter((loc: any) => loc && isLocationEligibleForResolution(loc, eligibilityOpts));

		for (const loc of eligibleLocations) {
			const locContacts = (loc?.locationContacts || loc?.contacts || []).filter((c: any) =>
				isContactEligibleForResolution(c, eligibilityOpts)
			);
			if (locContacts.length > 0) {
				const resolved = resolveContactFromList(locContacts, eligibilityOpts);
				if (resolved) return resolved;
			}
		}
	}

	return null;
}

/**
 * Contact resolution algorithm for sync providers.
 * When `filterWorkOnly` is true (external/public sync providers), also enforces `publicOnly: true`.
 */
export async function resolveContactForEventId(
	eventId: string | undefined,
	filterWorkOnly = false
): Promise<{ name: string; email: string; phone: string } | null> {
	if (!eventId) return null;
	const contact = await resolveEventContact(eventId, {
		filterWorkOnly,
		publicOnly: filterWorkOnly,
		fallbackToLocation: true,
		fallbackToFirst: true
	});
	if (!contact) return null;
	return {
		name: contact.name,
		email: contact.email,
		phone: contact.phone
	};
}

export async function resolveEventContactForSync(event: ExternalEvent, filterWorkOnly = true) {
	return resolveContactForEventId(event.metadata?.eventId, filterWorkOnly);
}
