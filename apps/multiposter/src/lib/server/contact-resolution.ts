import { db } from '@ac/db';
import { getEntityContacts } from './contacts';
import type { ExternalEvent } from './sync/types';

export interface ResolvedContact {
	name: string;
	email: string;
	phone: string;
	qrCodePath?: string;
	qrCodeDataUrl?: string;
}

export interface ContactResolutionOptions {
	filterWorkOnly?: boolean;
	fallbackToLocation?: boolean;
	fallbackToFirst?: boolean;
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
		return tagName === 'employee' || tagName === 'employees';
	});
}

/**
 * Extracts normalized details from a contact entity.
 */
export function extractContactDetails(contactOrAssociation: any, options: { filterWorkOnly?: boolean } = {}): ResolvedContact | null {
	if (!contactOrAssociation) return null;
	const c = contactOrAssociation.contact || contactOrAssociation;

	const fullName = c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim() || c.company || '';

	let email = '';
	if (options.filterWorkOnly) {
		email = c.emails?.find((e: any) => e.type?.toLowerCase() === 'work')?.value || '';
	} else {
		email = c.emails?.find((e: any) => e.primary)?.value || c.emails?.[0]?.value || '';
	}

	let phone = '';
	if (options.filterWorkOnly) {
		phone = c.phones?.find((p: any) => p.type?.toLowerCase() === 'work')?.value || '';
	} else {
		phone = c.phones?.find((p: any) => p.primary)?.value || c.phones?.[0]?.value || '';
	}

	let qrCodePath = c.qrCodePath;
	if (c.id && (!qrCodePath || !qrCodePath.includes('/api/'))) {
		qrCodePath = `/api/contacts/${c.id}/qr.png`;
	}

	return {
		name: fullName,
		email,
		phone,
		qrCodePath,
		qrCodeDataUrl: c.qrCodeDataUrl || (qrCodePath?.startsWith('data:') ? qrCodePath : undefined)
	};
}

/**
 * Resolves contact from a list of contacts:
 * 1. First contact tagged with "Employee"
 * 2. Fallback to first contact in list (if fallbackToFirst !== false)
 */
export function resolveContactFromList(
	contacts: any[] | undefined | null,
	options: { filterWorkOnly?: boolean; fallbackToFirst?: boolean } = {}
): ResolvedContact | null {
	if (!contacts || contacts.length === 0) return null;

	const employee = contacts.find((c: any) => isEmployeeContact(c));
	if (employee) {
		return extractContactDetails(employee, options);
	}

	if (options.fallbackToFirst !== false) {
		return extractContactDetails(contacts[0], options);
	}

	return null;
}

/**
 * Resolves a Location's contact:
 * 1. First location contact tagged with "Employee"
 * 2. Fallback to first location contact (if fallbackToFirst !== false)
 */
export function resolveLocationContactSync(
	locationData: any,
	options: { filterWorkOnly?: boolean; fallbackToFirst?: boolean } = {}
): ResolvedContact | null {
	if (!locationData) return null;
	const contacts = locationData.locationContacts || locationData.contacts || [];
	return resolveContactFromList(contacts, options);
}

export async function resolveLocationContact(
	locationOrId: any,
	options: { filterWorkOnly?: boolean; fallbackToFirst?: boolean } = {}
): Promise<ResolvedContact | null> {
	if (!locationOrId) return null;

	if (typeof locationOrId === 'string') {
		const contacts = await getEntityContacts('location', locationOrId, true);
		return resolveContactFromList(contacts, options);
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
 * 1. Event contact tagged as "Employee"
 * 2. Location contact tagged as "Employee" (from direct event locations or resource locations)
 * 3. Fallback: First event contact, or First location contact
 */
export function resolveEventContactSync(
	eventData: any,
	options: ContactResolutionOptions = {}
): ResolvedContact | null {
	if (!eventData) return null;

	const { fallbackToLocation = true, fallbackToFirst = true, filterWorkOnly = false } = options;

	const eventContacts = (eventData.contacts || []).map((ec: any) => ec.contact || ec);

	// Priority 1: Event contact tagged as "Employee"
	const eventEmployee = eventContacts.find((c: any) => isEmployeeContact(c));
	if (eventEmployee) {
		return extractContactDetails(eventEmployee, { filterWorkOnly });
	}

	// Priority 2: Location contact tagged as "Employee"
	if (fallbackToLocation) {
		const locationList: any[] = [];
		if (Array.isArray(eventData.locations)) {
			for (const l of eventData.locations) {
				const loc = l.location || l;
				if (loc) locationList.push(loc);
			}
		}
		if (Array.isArray(eventData.resources)) {
			for (const r of eventData.resources) {
				const loc = (r.resource || r)?.location;
				if (loc) locationList.push(loc);
			}
		}

		for (const loc of locationList) {
			const locContacts = loc.locationContacts || loc.contacts || [];
			const locEmployee = locContacts.find((c: any) => isEmployeeContact(c));
			if (locEmployee) {
				return extractContactDetails(locEmployee, { filterWorkOnly });
			}
		}

		// Priority 3: Fallbacks when no Employee tag was found anywhere
		if (fallbackToFirst) {
			if (eventContacts.length > 0) {
				return extractContactDetails(eventContacts[0], { filterWorkOnly });
			}

			for (const loc of locationList) {
				const locContacts = loc.locationContacts || loc.contacts || [];
				if (locContacts.length > 0) {
					return extractContactDetails(locContacts[0], { filterWorkOnly });
				}
			}
		}
	} else if (fallbackToFirst && eventContacts.length > 0) {
		return extractContactDetails(eventContacts[0], { filterWorkOnly });
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

	const { fallbackToLocation = true, fallbackToFirst = true, filterWorkOnly = false } = options;

	// 1. Check event contacts
	const eventContacts = await getEntityContacts('event', eventId, true);
	const eventEmployee = eventContacts.find((c: any) => isEmployeeContact(c));
	if (eventEmployee) {
		return extractContactDetails(eventEmployee, { filterWorkOnly });
	}

	// 2. Check location contacts if needed
	if (fallbackToLocation) {
		const locationIds = new Set<string>();

		// From event_location
		const directLocations = await db.query.eventLocation.findMany({
			where: (el: any, { eq }: any) => eq(el.eventId, eventId)
		});
		for (const el of directLocations) {
			if (el.locationId) locationIds.add(el.locationId);
		}

		// From event_resource -> resource -> location
		const resources = await db.query.eventResource.findMany({
			where: (er: any, { eq }: any) => eq(er.eventId, eventId),
			with: {
				resource: true
			}
		});
		for (const er of resources) {
			const locId = (er.resource as any)?.locationId;
			if (locId) locationIds.add(locId);
		}

		const allLocationContacts: any[] = [];
		for (const locId of locationIds) {
			const locContacts = await getEntityContacts('location', locId, true);
			const locEmployee = locContacts.find((c: any) => isEmployeeContact(c));
			if (locEmployee) {
				return extractContactDetails(locEmployee, { filterWorkOnly });
			}
			if (locContacts.length > 0) {
				allLocationContacts.push(...locContacts);
			}
		}

		// Priority 3: Fallbacks
		if (fallbackToFirst) {
			if (eventContacts.length > 0) {
				return extractContactDetails(eventContacts[0], { filterWorkOnly });
			}
			if (allLocationContacts.length > 0) {
				return extractContactDetails(allLocationContacts[0], { filterWorkOnly });
			}
		}
	} else if (fallbackToFirst && eventContacts.length > 0) {
		return extractContactDetails(eventContacts[0], { filterWorkOnly });
	}

	return null;
}

/**
 * Resolves an Announcement's contact:
 * 1. Announcement contact tagged as "Employee"
 * 2. Location contact tagged as "Employee"
 * 3. Fallback: First announcement contact, or First location contact
 */
export function resolveAnnouncementContactSync(
	announcementData: any,
	options: ContactResolutionOptions = {}
): ResolvedContact | null {
	if (!announcementData) return null;

	const { fallbackToLocation = true, fallbackToFirst = true, filterWorkOnly = false } = options;
	const contacts = (announcementData.contacts || []).map((ac: any) => ac.contact || ac);

	const employee = contacts.find((c: any) => isEmployeeContact(c));
	if (employee) {
		return extractContactDetails(employee, { filterWorkOnly });
	}

	if (fallbackToLocation && Array.isArray(announcementData.locations)) {
		for (const l of announcementData.locations) {
			const loc = l.location || l;
			const locContacts = loc?.locationContacts || loc?.contacts || [];
			const locEmployee = locContacts.find((c: any) => isEmployeeContact(c));
			if (locEmployee) {
				return extractContactDetails(locEmployee, { filterWorkOnly });
			}
		}

		if (fallbackToFirst) {
			if (contacts.length > 0) {
				return extractContactDetails(contacts[0], { filterWorkOnly });
			}
			for (const l of announcementData.locations) {
				const loc = l.location || l;
				const locContacts = loc?.locationContacts || loc?.contacts || [];
				if (locContacts.length > 0) {
					return extractContactDetails(locContacts[0], { filterWorkOnly });
				}
			}
		}
	} else if (fallbackToFirst && contacts.length > 0) {
		return extractContactDetails(contacts[0], { filterWorkOnly });
	}

	return null;
}

/**
 * Contact resolution algorithm for sync providers.
 */
export async function resolveContactForEventId(
	eventId: string | undefined,
	filterWorkOnly = false
): Promise<{ name: string; email: string; phone: string } | null> {
	if (!eventId) return null;
	const contact = await resolveEventContact(eventId, {
		filterWorkOnly,
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

export async function resolveEventContactForSync(event: ExternalEvent) {
	return resolveContactForEventId(event.metadata?.eventId);
}
