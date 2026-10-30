import {
	resolveEventContactSync,
	resolveAnnouncementContactSync,
	resolveLocationContactSync,
	type ResolvedContact
} from './contact-resolution.js';
import { getEventRooms } from '#lib/utils/format-rooms.js';

/**
 * Helper to safely convert dates or date strings to ISO strings.
 */
function toIsoSafe(d: any): string | null {
	if (!d) return null;
	if (d instanceof Date) return isNaN(d.getTime()) ? null : d.toISOString();
	if (typeof d === 'string' || typeof d === 'number') {
		const parsed = new Date(d);
		return isNaN(parsed.getTime()) ? null : parsed.toISOString();
	}
	return null;
}

/**
 * Checks if a tag or tag association is publicly visible (`visibility === 'external'`).
 */
export function isPublicTag(tagOrAssoc: any): boolean {
	if (!tagOrAssoc) return false;
	const t = tagOrAssoc.tag || tagOrAssoc;
	return Boolean(t && t.visibility === 'external');
}

/**
 * Filters a list of tags or tag associations to only external/public tags,
 * returning normalized public tag objects.
 */
export function filterPublicTags(
	tags: any[] | null | undefined
): Array<{ id: string; name: string; visibility: 'external'; color?: string | null }> {
	if (!Array.isArray(tags)) return [];
	const result: Array<{ id: string; name: string; visibility: 'external'; color?: string | null }> = [];
	const seen = new Set<string>();

	for (const item of tags) {
		if (!isPublicTag(item)) continue;
		const t = item.tag || item;
		if (!t?.name) continue;
		const key = t.id || t.name;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push({
			id: t.id,
			name: t.name,
			visibility: 'external',
			...(t.color !== undefined ? { color: t.color } : {})
		});
	}

	return result;
}

/**
 * Checks if a contact or contact association is publicly visible (`isPublic === true` and not obfuscated).
 */
export function isPublicContact(contactOrAssoc: any): boolean {
	if (!contactOrAssoc) return false;
	const c = contactOrAssoc.contact || contactOrAssoc;
	return Boolean(c && c.isPublic === true && c.obfuscationStatus !== 'obfuscated');
}

/**
 * Filters contact email records to only work emails.
 */
export function filterWorkEmails(emails: any[] | null | undefined): any[] {
	if (!Array.isArray(emails)) return [];
	return emails
		.filter((e: any) => e && e.type?.toLowerCase() === 'work' && e.value)
		.map((e: any) => ({
			...(e.id ? { id: e.id } : {}),
			value: e.value,
			type: 'work',
			primary: Boolean(e.primary)
		}));
}

/**
 * Filters contact phone records to only work phones.
 */
export function filterWorkPhones(phones: any[] | null | undefined): any[] {
	if (!Array.isArray(phones)) return [];
	return phones
		.filter((p: any) => p && p.type?.toLowerCase() === 'work' && p.value)
		.map((p: any) => ({
			...(p.id ? { id: p.id } : {}),
			value: p.value,
			type: 'work',
			primary: Boolean(p.primary)
		}));
}

/**
 * Filters contact address records to only work addresses.
 */
export function filterWorkAddresses(addresses: any[] | null | undefined): any[] {
	if (!Array.isArray(addresses)) return [];
	return addresses
		.filter((a: any) => a && a.type?.toLowerCase() === 'work')
		.map((a: any) => ({
			...(a.id ? { id: a.id } : {}),
			street: a.street ?? null,
			houseNumber: a.houseNumber ?? null,
			addressSuffix: a.addressSuffix ?? null,
			zip: a.zip ?? null,
			city: a.city ?? null,
			state: a.state ?? null,
			country: a.country ?? null,
			type: 'work',
			primary: Boolean(a.primary)
		}));
}

/**
 * Extracts primary/first work email and work phone from a public contact.
 * Returns null if the contact is not public.
 */
export function extractPublicWorkContactInfo(
	contactOrAssoc: any
): { name: string; email?: string; phone?: string } | null {
	if (!isPublicContact(contactOrAssoc)) return null;
	const c = contactOrAssoc.contact || contactOrAssoc;
	const workEmails = filterWorkEmails(c.emails);
	const workPhones = filterWorkPhones(c.phones);
	const email = workEmails.find((e: any) => e.primary)?.value || workEmails[0]?.value || undefined;
	const phone = workPhones.find((p: any) => p.primary)?.value || workPhones[0]?.value || undefined;
	const name =
		c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim() || c.company || 'Unknown';

	return { name, email, phone };
}

/**
 * Sanitizes a contact for public / unauthenticated access.
 * Returns null if the contact is not public (`isPublic !== true`) or is obfuscated.
 * Strips notes, birthday, relations, imHandles, non-work emails/phones/addresses, and internal tags.
 */
export function sanitizePublicContact(contactOrAssoc: any): any | null {
	if (!isPublicContact(contactOrAssoc)) return null;
	const c = contactOrAssoc.contact || contactOrAssoc;

	const publicTags = filterPublicTags(c.tags).map((t) => ({
		tag: { id: t.id, name: t.name, visibility: 'external' as const }
	}));

	const vCardPath = c.vCardPath?.includes('/api/')
		? `${c.vCardPath.split('?')[0]}?public`
		: `/api/contacts/${c.id}/contact.vcf?public`;
	const qrCodePath = c.qrCodePath?.includes('/api/')
		? c.qrCodePath
		: `/api/contacts/${c.id}/qr.png`;

	return {
		id: c.id,
		displayName: c.displayName ?? null,
		givenName: c.givenName ?? null,
		familyName: c.familyName ?? null,
		middleName: c.middleName ?? null,
		honorificPrefix: c.honorificPrefix ?? null,
		honorificSuffix: c.honorificSuffix ?? null,
		company: c.company ?? null,
		jobTitle: c.jobTitle ?? null,
		department: c.department ?? null,
		isPublic: true,
		vCardPath,
		qrCodePath,
		createdAt: toIsoSafe(c.createdAt) ?? new Date().toISOString(),
		updatedAt: toIsoSafe(c.updatedAt) ?? new Date().toISOString(),
		emails: filterWorkEmails(c.emails),
		phones: filterWorkPhones(c.phones),
		addresses: filterWorkAddresses(c.addresses),
		tags: publicTags,
		relations: []
	};
}

/**
 * Checks if a location or location association is publicly visible (`isPublic === true`).
 */
export function isPublicLocation(locOrAssoc: any): boolean {
	if (!locOrAssoc) return false;
	const loc = locOrAssoc.location || locOrAssoc;
	return Boolean(loc && loc.isPublic === true);
}

/**
 * Sanitizes a location for public / unauthenticated / kiosk access.
 * Returns null if `location.isPublic !== true`.
 * Strips raw `locationContacts` and internal fields.
 */
export function sanitizePublicLocation(
	locOrAssoc: any,
	options: { resolveContact?: boolean } = {}
): any | null {
	if (!isPublicLocation(locOrAssoc)) return null;
	const loc = locOrAssoc.location || locOrAssoc;

	let resolvedContact: ResolvedContact | null | undefined = undefined;
	if (options.resolveContact) {
		if (
			(Array.isArray(loc.locationContacts) && loc.locationContacts.length > 0) ||
			(Array.isArray(loc.contacts) && loc.contacts.length > 0)
		) {
			resolvedContact = resolveLocationContactSync(loc, {
				filterWorkOnly: true,
				publicOnly: true,
				fallbackToFirst: true
			});
		} else if (loc.resolvedContact && loc.resolvedContact.isPublic === true) {
			resolvedContact = loc.resolvedContact;
		} else {
			resolvedContact = null;
		}
	} else if (loc.resolvedContact !== undefined) {
		resolvedContact = loc.resolvedContact?.isPublic === true ? loc.resolvedContact : null;
	}

	return {
		id: loc.id,
		name: loc.name,
		street: loc.street ?? null,
		houseNumber: loc.houseNumber ?? null,
		addressSuffix: loc.addressSuffix ?? null,
		zip: loc.zip ?? null,
		city: loc.city ?? null,
		state: loc.state ?? null,
		country: loc.country ?? null,
		roomId: loc.roomId ?? null,
		latitude: loc.latitude ?? null,
		longitude: loc.longitude ?? null,
		what3words: loc.what3words ?? null,
		inclusivitySupport: loc.inclusivitySupport ?? null,
		heroImageUrl: loc.heroImageUrl ?? null,
		isPublic: true,
		...(resolvedContact !== undefined ? { resolvedContact } : {})
	};
}

/**
 * Filters and sanitizes a list of locations to only public locations.
 */
export function filterPublicLocations(
	locations: any[] | null | undefined,
	options: { resolveContact?: boolean } = {}
): any[] {
	if (!Array.isArray(locations)) return [];
	return locations
		.map((l) => sanitizePublicLocation(l, options))
		.filter((l): l is NonNullable<typeof l> => l !== null);
}

/**
 * Sanitizes a price or eventPrice association for public access.
 * Strips internal costPrice, factor, totalCostPerPortion, consumable/recipe internals,
 * and filters item tags to only external tags.
 */
export function sanitizePublicPrice(priceOrAssoc: any): any | null {
	if (!priceOrAssoc) return null;
	const p = priceOrAssoc.price || priceOrAssoc;
	if (!p || !p.id) return null;

	let totalPricePerPortion = 0;
	const items = (p.items || []).map((it: any) => {
		const linePrice = (it.unitPrice || 0) * (it.portionAmount || 1);
		totalPricePerPortion += linePrice;
		const rawTags =
			it.tags !== undefined
				? it.tags
				: it.itemType === 'recipe'
					? it.recipe?.tags || []
					: it.consumable?.tags || [];
		return {
			id: it.id,
			priceId: it.priceId,
			itemType: it.itemType,
			name: it.name,
			description: it.description ?? null,
			portionAmount: it.portionAmount,
			unit: it.unit ?? null,
			unitPrice: it.unitPrice,
			sortOrder: it.sortOrder,
			tags: filterPublicTags(rawTags)
		};
	});

	return {
		id: p.id,
		name: p.name,
		description: p.description ?? null,
		currency: p.currency ?? 'EUR',
		priceUnknown: Boolean(p.priceUnknown),
		isTemplate: Boolean(p.isTemplate),
		createdAt: toIsoSafe(p.createdAt),
		updatedAt: toIsoSafe(p.updatedAt),
		totalPricePerPortion:
			p.totalPricePerPortion !== undefined
				? p.totalPricePerPortion
				: Math.round(totalPricePerPortion * 100) / 100,
		items
	};
}

/**
 * Filters and sanitizes an array of prices for public access.
 */
export function filterPublicPrices(prices: any[] | null | undefined): any[] {
	if (!Array.isArray(prices)) return [];
	return prices
		.map((p) => sanitizePublicPrice(p))
		.filter((p): p is NonNullable<typeof p> => p !== null);
}

/**
 * Checks if an event is publicly visible (`isPublic === true`).
 */
export function isPublicEvent(event: any): boolean {
	return Boolean(event && event.isPublic === true);
}

/**
 * Sanitizes a series instance summary object for public display.
 * Returns null if `inst.isPublic === false`.
 */
export function sanitizePublicSeriesInstance(inst: any): any | null {
	if (!inst || inst.isPublic === false) return null;
	return {
		id: inst.id,
		summary: inst.summary,
		startDateTime: toIsoSafe(inst.startDateTime),
		endDateTime: toIsoSafe(inst.endDateTime),
		isAllDay: Boolean(inst.isAllDay),
		status: inst.status,
		isPublic: true,
		isVirtual: Boolean(inst.isVirtual),
		isException: Boolean(inst.isException),
		recurringEventId: inst.recurringEventId ?? null
	};
}

/**
 * Sanitizes an event for public / unauthenticated / kiosk access.
 * Returns null if `event.isPublic !== true`.
 * Guarantees NO private fields (`internalNotes`, `contacts`, `user`, `campaign`,
 * non-public locations, non-public contacts, internal tags, or non-public series instances) leak.
 */
export function sanitizePublicEvent(event: any): any | null {
	if (!isPublicEvent(event)) return null;

	const publicLocations = filterPublicLocations(event.locations);

	const publicResources = (event.resources || [])
		.map((r: any) => r?.resource || r)
		.filter((res: any) => Boolean(res && (!res.location || res.location.isPublic !== false)))
		.map((res: any) => ({
			id: res.id,
			name: res.name,
			type: res.type,
			locationId: res.location?.isPublic === false ? null : (res.locationId ?? null),
			maxOccupancy: res.maxOccupancy ?? null
		}));

	const publicTags = filterPublicTags(event.tags);
	const publicPrices = filterPublicPrices(event.prices);

	// Resolve or validate public contact
	const hasRawContactsOrLocContacts =
		(Array.isArray(event.contacts) && event.contacts.length > 0) ||
		(Array.isArray(event.locations) &&
			event.locations.some((l: any) => {
				const loc = l?.location || l;
				return (
					(Array.isArray(loc?.locationContacts) && loc.locationContacts.length > 0) ||
					(Array.isArray(loc?.contacts) && loc.contacts.length > 0)
				);
			})) ||
		(Array.isArray(event.resources) &&
			event.resources.some((r: any) => {
				const res = r?.resource || r;
				const loc = res?.location;
				return (
					(Array.isArray(loc?.locationContacts) && loc.locationContacts.length > 0) ||
					(Array.isArray(loc?.contacts) && loc.contacts.length > 0)
				);
			}));

	let resolvedContact: ResolvedContact | null = null;
	if (hasRawContactsOrLocContacts) {
		resolvedContact = resolveEventContactSync(event, {
			filterWorkOnly: true,
			publicOnly: true,
			fallbackToLocation: true,
			fallbackToFirst: true
		});
	} else if (event.resolvedContact && event.resolvedContact.isPublic === true) {
		resolvedContact = {
			id: event.resolvedContact.id,
			name: event.resolvedContact.name,
			email: event.resolvedContact.email || '',
			phone: event.resolvedContact.phone || '',
			isPublic: true,
			...(event.resolvedContact.role ? { role: event.resolvedContact.role } : {}),
			...(event.resolvedContact.roles ? { roles: event.resolvedContact.roles } : {}),
			...(event.resolvedContact.qrCodePath ? { qrCodePath: event.resolvedContact.qrCodePath } : {}),
			...(event.resolvedContact.qrCodeDataUrl
				? { qrCodeDataUrl: event.resolvedContact.qrCodeDataUrl }
				: {})
		};
	}

	const publicInstances = Array.isArray(event.instances)
		? event.instances
				.map((inst: any) => sanitizePublicSeriesInstance(inst))
				.filter((inst: any): inst is NonNullable<typeof inst> => inst !== null)
		: undefined;

	let publicSeriesMaster: any = undefined;
	if (event.seriesMaster && event.seriesMaster.isPublic !== false) {
		const masterInstances = Array.isArray(event.seriesMaster.instances)
			? event.seriesMaster.instances
					.map((inst: any) => sanitizePublicSeriesInstance(inst))
					.filter((inst: any): inst is NonNullable<typeof inst> => inst !== null)
			: [];
		publicSeriesMaster = {
			id: event.seriesMaster.id,
			summary: event.seriesMaster.summary,
			recurrence: event.seriesMaster.recurrence ?? null,
			startDateTime: toIsoSafe(event.seriesMaster.startDateTime),
			endDateTime: toIsoSafe(event.seriesMaster.endDateTime),
			isPublic: true,
			instances: masterInstances
		};
	}

	const publicTalents = Array.isArray(event.talents)
		? event.talents
				.map((et: any) => {
					const t = et?.talent || et;
					if (!t) return null;
					const c = t.contact;
					return {
						id: et.id || t.id,
						talentId: et.talentId || t.id,
						talent: {
							id: t.id,
							...(c
								? {
										contact: {
											displayName: c.displayName ?? null,
											givenName: c.givenName ?? null,
											familyName: c.familyName ?? null
										}
									}
								: {})
						}
					};
				})
				.filter(Boolean)
		: undefined;

	const idStr = String(event.id || '');
	const iCalPath = idStr.includes('_inst_')
		? `/api/events/${idStr}/event.ics`
		: event.iCalPath?.includes('/api/')
			? event.iCalPath
			: `/api/events/${idStr}/event.ics`;
	const qrCodePath = idStr.includes('_inst_')
		? `/api/events/${idStr}/qr.png`
		: event.qrCodePath?.includes('/api/')
			? event.qrCodePath
			: `/api/events/${idStr}/qr.png`;

	const isSeries = Boolean(
		event.isSeries ||
			event.seriesId ||
			event.recurringEventId ||
			(Array.isArray(event.recurrence) && event.recurrence.length > 0)
	);

	return {
		id: event.id,
		summary: event.summary,
		description: event.description ?? null,
		status: event.status,
		startDateTime: toIsoSafe(event.startDateTime),
		endDateTime: toIsoSafe(event.endDateTime),
		isAllDay: Boolean(event.isAllDay),
		isPublic: true,
		heroImage: event.heroImage ?? null,
		ticketPrice: event.ticketPrice ?? null,
		ticketPriceUnknown: Boolean(event.ticketPriceUnknown),
		categoryBerlinDotDe: event.categoryBerlinDotDe ?? null,
		createdAt: toIsoSafe(event.createdAt) ?? new Date().toISOString(),
		updatedAt: toIsoSafe(event.updatedAt) ?? new Date().toISOString(),
		locations: publicLocations,
		resources: publicResources,
		rooms: getEventRooms({ locations: publicLocations, resources: publicResources }),
		locationId: publicLocations[0]?.id ?? null,
		locationIds: publicLocations.map((l: any) => l.id),
		resourceIds: publicResources.map((r: any) => r.id),
		tags: publicTags,
		tagIds: publicTags.map((t) => t.id).filter(Boolean),
		resolvedContact,
		contacts: [],
		contactIds: [],
		syncIds: [],
		prices: publicPrices,
		priceIds: publicPrices.map((p: any) => p.id),
		...(publicTalents !== undefined ? { talents: publicTalents } : {}),
		iCalPath,
		qrCodePath,
		isSeries,
		...(event.isSeriesInstance !== undefined ? { isSeriesInstance: Boolean(event.isSeriesInstance) } : {}),
		...(event.isVirtual !== undefined ? { isVirtual: Boolean(event.isVirtual) } : {}),
		...(event.isException !== undefined ? { isException: Boolean(event.isException) } : {}),
		recurrence: event.recurrence ?? undefined,
		recurringEventId: event.recurringEventId ?? undefined,
		seriesId: event.seriesId ?? undefined,
		seriesMaster: publicSeriesMaster,
		instances: publicInstances && publicInstances.length > 0 ? publicInstances : undefined
	};
}

/**
 * Checks if an announcement is publicly visible (`isPublic === true`).
 */
export function isPublicAnnouncement(announcement: any): boolean {
	return Boolean(announcement && announcement.isPublic === true);
}

/**
 * Sanitizes an announcement for public / unauthenticated / kiosk access.
 * Returns null if `announcement.isPublic !== true`.
 * Guarantees NO private fields (`user`, `campaign`, `contacts`, non-public locations,
 * non-public contacts, or internal tags) leak.
 */
export function sanitizePublicAnnouncement(announcement: any): any | null {
	if (!isPublicAnnouncement(announcement)) return null;

	const publicLocations = filterPublicLocations(announcement.locations);
	const publicTags = filterPublicTags(announcement.tags);

	const hasRawContactsOrLocContacts =
		(Array.isArray(announcement.contacts) && announcement.contacts.length > 0) ||
		(Array.isArray(announcement.locations) &&
			announcement.locations.some((l: any) => {
				const loc = l?.location || l;
				return (
					(Array.isArray(loc?.locationContacts) && loc.locationContacts.length > 0) ||
					(Array.isArray(loc?.contacts) && loc.contacts.length > 0)
				);
			}));

	let resolvedContact: ResolvedContact | null = null;
	if (hasRawContactsOrLocContacts) {
		resolvedContact = resolveAnnouncementContactSync(announcement, {
			filterWorkOnly: true,
			publicOnly: true,
			fallbackToLocation: true,
			fallbackToFirst: true
		});
	} else if (announcement.resolvedContact && announcement.resolvedContact.isPublic === true) {
		resolvedContact = {
			id: announcement.resolvedContact.id,
			name: announcement.resolvedContact.name,
			email: announcement.resolvedContact.email || '',
			phone: announcement.resolvedContact.phone || '',
			isPublic: true,
			...(announcement.resolvedContact.role ? { role: announcement.resolvedContact.role } : {}),
			...(announcement.resolvedContact.roles ? { roles: announcement.resolvedContact.roles } : {}),
			...(announcement.resolvedContact.qrCodePath
				? { qrCodePath: announcement.resolvedContact.qrCodePath }
				: {}),
			...(announcement.resolvedContact.qrCodeDataUrl
				? { qrCodeDataUrl: announcement.resolvedContact.qrCodeDataUrl }
				: {})
		};
	}

	return {
		id: announcement.id,
		title: announcement.title,
		content: announcement.content,
		status: announcement.status,
		isPublic: true,
		heroImage: announcement.heroImage ?? null,
		startDateTime: toIsoSafe(announcement.startDateTime),
		endDateTime: toIsoSafe(announcement.endDateTime),
		createdAt: toIsoSafe(announcement.createdAt) ?? new Date().toISOString(),
		updatedAt: toIsoSafe(announcement.updatedAt) ?? new Date().toISOString(),
		locations: publicLocations,
		locationIds: publicLocations.map((l: any) => l.id),
		tags: publicTags,
		tagIds: publicTags.map((t) => t.id).filter(Boolean),
		resolvedContact,
		contacts: [],
		contactIds: [],
		syncIds: []
	};
}
