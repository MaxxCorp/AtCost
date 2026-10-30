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
 * Checks whether a contact has a "Main Contact" role.
 */
export function isMainContact(contactOrAssociation: any): boolean {
	if (!contactOrAssociation) return false;
	const c = contactOrAssociation.contact || contactOrAssociation;
	const roles = contactOrAssociation.roles || c.roles || contactOrAssociation.eventRoles || c.eventRoles || [];
	return roles.some((r: any) => {
		const name = (typeof r === 'string' ? r : r.name || r.role?.name || '').trim().toLowerCase();
		return name === 'main contact' || name === 'maincontact' || name === 'main_contact';
	});
}

/**
 * Checks whether a contact or contact association has an "Employee" tag.
 */
export function isEmployeeContact(contactOrAssociation: any): boolean {
	if (!contactOrAssociation) return false;
	const contact = contactOrAssociation.contact || contactOrAssociation;
	const tags = contact.tags || contactOrAssociation.tags || [];

	return tags.some((t: any) => {
		const tagName = (t?.name || t?.tag?.name || (typeof t === 'string' ? t : '')).trim().toLowerCase();
		return tagName === 'employee' || tagName === 'employees' || tagName === 'mitarbeiter' || tagName === 'staff';
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
 * Resolves contact from a list of contacts:
 * 1. First eligible contact tagged with "Employee"
 * 2. Fallback to first eligible contact in list (if fallbackToFirst !== false)
 */
export function resolveContactFromList(
	contacts: any[] | undefined | null,
	options: { filterWorkOnly?: boolean; publicOnly?: boolean; fallbackToFirst?: boolean } = {}
): ResolvedContact | null {
	if (!contacts || contacts.length === 0) return null;

	const eligibleContacts = contacts.filter((c: any) => isContactEligibleForResolution(c, options));
	if (eligibleContacts.length === 0) return null;

	const employee = eligibleContacts.find((c: any) => isEmployeeContact(c));
	if (employee) {
		return extractContactDetails(employee, options);
	}

	if (options.fallbackToFirst !== false) {
		return extractContactDetails(eligibleContacts[0], options);
	}

	return null;
}

/**
 * Resolves a Location's contact:
 * 1. First eligible location contact tagged with "Employee"
 * 2. Fallback to first eligible location contact (if fallbackToFirst !== false)
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
 * 0. Eligible event contact assigned the role "Main Contact"
 * 1. Eligible event contact tagged as "Employee"
 * 2. Eligible location contact tagged as "Employee" (from eligible direct event locations or resource locations)
 * 3. Fallback: First eligible event contact, or First eligible location contact
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
	const eligibilityOpts = { filterWorkOnly, publicOnly };

	const eventContacts = (eventData.contacts || [])
		.map((ec: any) => {
			const c = ec.contact || ec;
			return {
				...c,
				roles: ec.roles || c.roles || []
			};
		})
		.filter((c: any) => isContactEligibleForResolution(c, eligibilityOpts));

	// Priority 0: Event contact assigned the role "Main Contact"
	const eventMainContact = eventContacts.find((c: any) => isMainContact(c));
	if (eventMainContact) {
		return extractContactDetails(eventMainContact, eligibilityOpts);
	}

	// Priority 1: Event contact tagged as "Employee"
	const eventEmployee = eventContacts.find((c: any) => isEmployeeContact(c));
	if (eventEmployee) {
		return extractContactDetails(eventEmployee, eligibilityOpts);
	}

	// Priority 2: Location contact tagged as "Employee"
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
			const locEmployee = locContacts.find((c: any) => isEmployeeContact(c));
			if (locEmployee) {
				return extractContactDetails(locEmployee, eligibilityOpts);
			}
		}

		// Priority 3: Fallbacks when no Employee tag was found anywhere
		if (fallbackToFirst) {
			if (eventContacts.length > 0) {
				return extractContactDetails(eventContacts[0], eligibilityOpts);
			}

			for (const loc of locationList) {
				const locContacts = (loc.locationContacts || loc.contacts || []).filter((c: any) =>
					isContactEligibleForResolution(c, eligibilityOpts)
				);
				if (locContacts.length > 0) {
					return extractContactDetails(locContacts[0], eligibilityOpts);
				}
			}
		}
	} else if (fallbackToFirst && eventContacts.length > 0) {
		return extractContactDetails(eventContacts[0], eligibilityOpts);
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
	const eligibilityOpts = { filterWorkOnly, publicOnly };

	// 1. Check event contacts
	const rawEventContacts = await getEntityContacts('event', eventId, true);
	const eventContacts = rawEventContacts.filter((c: any) =>
		isContactEligibleForResolution(c, eligibilityOpts)
	);

	const eventMainContact = eventContacts.find((c: any) => isMainContact(c));
	if (eventMainContact) {
		return extractContactDetails(eventMainContact, eligibilityOpts);
	}
	const eventEmployee = eventContacts.find((c: any) => isEmployeeContact(c));
	if (eventEmployee) {
		return extractContactDetails(eventEmployee, eligibilityOpts);
	}

	// 2. Check location contacts if needed
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

		const allLocationContacts: any[] = [];
		for (const locId of locationIds) {
			const rawLocContacts = await getEntityContacts('location', locId, true);
			const locContacts = rawLocContacts.filter((c: any) =>
				isContactEligibleForResolution(c, eligibilityOpts)
			);
			const locEmployee = locContacts.find((c: any) => isEmployeeContact(c));
			if (locEmployee) {
				return extractContactDetails(locEmployee, eligibilityOpts);
			}
			if (locContacts.length > 0) {
				allLocationContacts.push(...locContacts);
			}
		}

		// Priority 3: Fallbacks
		if (fallbackToFirst) {
			if (eventContacts.length > 0) {
				return extractContactDetails(eventContacts[0], eligibilityOpts);
			}
			if (allLocationContacts.length > 0) {
				return extractContactDetails(allLocationContacts[0], eligibilityOpts);
			}
		}
	} else if (fallbackToFirst && eventContacts.length > 0) {
		return extractContactDetails(eventContacts[0], eligibilityOpts);
	}

	return null;
}

/**
 * Resolves an Announcement's contact:
 * 1. Eligible announcement contact tagged as "Employee"
 * 2. Eligible location contact tagged as "Employee"
 * 3. Fallback: First eligible announcement contact, or First eligible location contact
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
	const eligibilityOpts = { filterWorkOnly, publicOnly };

	const contacts = (announcementData.contacts || [])
		.map((ac: any) => ac.contact || ac)
		.filter((c: any) => isContactEligibleForResolution(c, eligibilityOpts));

	const employee = contacts.find((c: any) => isEmployeeContact(c));
	if (employee) {
		return extractContactDetails(employee, eligibilityOpts);
	}

	if (fallbackToLocation && Array.isArray(announcementData.locations)) {
		const eligibleLocations = announcementData.locations
			.map((l: any) => l?.location || l)
			.filter((loc: any) => loc && isLocationEligibleForResolution(loc, eligibilityOpts));

		for (const loc of eligibleLocations) {
			const locContacts = (loc?.locationContacts || loc?.contacts || []).filter((c: any) =>
				isContactEligibleForResolution(c, eligibilityOpts)
			);
			const locEmployee = locContacts.find((c: any) => isEmployeeContact(c));
			if (locEmployee) {
				return extractContactDetails(locEmployee, eligibilityOpts);
			}
		}

		if (fallbackToFirst) {
			if (contacts.length > 0) {
				return extractContactDetails(contacts[0], eligibilityOpts);
			}
			for (const loc of eligibleLocations) {
				const locContacts = (loc?.locationContacts || loc?.contacts || []).filter((c: any) =>
					isContactEligibleForResolution(c, eligibilityOpts)
				);
				if (locContacts.length > 0) {
					return extractContactDetails(locContacts[0], eligibilityOpts);
				}
			}
		}
	} else if (fallbackToFirst && contacts.length > 0) {
		return extractContactDetails(contacts[0], eligibilityOpts);
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
