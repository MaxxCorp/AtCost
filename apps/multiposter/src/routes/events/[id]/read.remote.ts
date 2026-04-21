import { query } from '$app/server';
import { db } from '$lib/server/db';
import { event, contactEmail, contactPhone, tag } from '@ac/db';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess, getOptionalUser, hasAccess } from '$lib/server/authorization';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { type Event } from '@ac/validations';

/**
 * Query: Read an event by ID
 * 
 * Access rules:
 * - If event is public: anyone can view (but only public-safe fields)
 * - If event is private: only authenticated users with 'events' access can view
 */
export const readEvent = query(v.string(), async (eventId: string): Promise<Event | null> => {
	// 1. Fetch event with relations using Drizzle Relational Queries for "easier reasoning"
	const result = await db.query.event.findFirst({
		where: eq(event.id, eventId),
		with: {
			locations: { with: { location: true } },
			contacts: { with: { contact: { with: { 
				emails: true, 
				phones: true,
				tags: { with: { tag: true } }
			} } } },
			resources: { with: { resource: true } },
			tags: { with: { tag: true } },
			campaign: true,
		},
	});

	if (!result) {
		return null;
	}

	// 2. Check Access
	const user = getOptionalUser();
	const isAuthorized = user && hasAccess(user, 'events');

	if (!result.isPublic) {
		if (!user) {
			error(403, 'Authentication required to view this event');
		}
		if (!isAuthorized) {
			error(403, 'You do not have permission to view this event');
		}
	}

	// 3. Resolve Primary Contact (Resolved Contact logic inlined)
	let resolvedContact = null;

	// find "Employee" tagged contact in event or fallback
	const findEmployee = (contacts: any[]) => {
		return contacts.find(ec => ec.contact.tags.some((ct: any) => ct.tag.name === 'Employee'));
	};

	let chosenContact = findEmployee(result.contacts);
	
	// Fallback to first contact if no employee
	if (!chosenContact && result.contacts.length > 0) {
		chosenContact = result.contacts[0];
	}

	if (chosenContact) {
		const c = chosenContact.contact;
		const name = c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim();
		
		if (!isAuthorized) {
			// Public view: filter for work info
			const workEmail = c.emails.find((e: any) => e.type === 'work')?.value || '';
			const workPhone = c.phones.find((p: any) => p.type === 'work')?.value || '';
			resolvedContact = { name, email: workEmail, phone: workPhone };
		} else {
			// Auth view: primary info
			const primaryEmail = c.emails.find((e: any) => e.primary)?.value || c.emails[0]?.value || '';
			const primaryPhone = c.phones.find((p: any) => p.primary)?.value || c.phones[0]?.value || '';
			resolvedContact = { 
				name, 
				email: primaryEmail, 
				phone: primaryPhone,
				qrCodeDataUrl: c.qrCodePath || undefined
			};
		}
	}

	// 4. Return Data
	if (!isAuthorized) {
		// Public safe object
		return {
			id: result.id,
			summary: result.summary,
			description: result.description,
			status: result.status,
			startDateTime: result.startDateTime?.toISOString() ?? null,
			endDateTime: result.endDateTime?.toISOString() ?? null,
			isAllDay: result.isAllDay,
			isPublic: result.isPublic,
			location: result.location,
			heroImage: result.heroImage,
			ticketPrice: result.ticketPrice,
			categoryBerlinDotDe: result.categoryBerlinDotDe,
			createdAt: result.createdAt.toISOString(),
			updatedAt: result.updatedAt.toISOString(),
			locations: result.locations.filter(l => l.location.isPublic).map(l => l.location),
			locationIds: result.locations.filter(l => l.location.isPublic).map(l => l.location.id),
			tags: result.tags.map(t => t.tag.name),
			resolvedContact,
			resourceIds: [],
			contactIds: [],
			syncIds: [],
		} as any;
	}

	// Full object
	return {
		...result,
		createdAt: result.createdAt.toISOString(),
		updatedAt: result.updatedAt.toISOString(),
		startDateTime: result.startDateTime?.toISOString() ?? null,
		endDateTime: result.endDateTime?.toISOString() ?? null,
		resourceIds: result.resources.map(r => r.resourceId),
		contactIds: result.contacts.map(c => c.contactId),
		locationIds: result.locations.map(l => l.locationId),
		tags: result.tags.map(t => t.tag.name),
		syncIds: (result.campaign?.content as any)?.syncIds || [],
		resolvedContact,
	} as any;
});
