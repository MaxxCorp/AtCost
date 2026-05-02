import { query } from '$app/server';
import { db } from '@ac/db';
import { announcement, announcementTag, announcementContact, tag, announcementLocation, location, contact, contactEmail, contactPhone, contactTag, locationContact, campaign } from '@ac/db';
import { eq, and, inArray } from 'drizzle-orm';
import { getOptionalUser, hasAccess, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { type Announcement } from '@ac/validations';

/**
 * Query: Read an announcement by ID
 * 
 * Access rules:
 * - If announcement is public: anyone can view (but only public-safe fields)
 * - If announcement is private: only authenticated users with 'announcements' access can view
 */
export const readAnnouncement = query(v.string(), async (announcementId: string): Promise<Announcement | null> => {
	// 1. Fetch using Relational Queries for "easier reasoning"
	const result = await db.query.announcement.findFirst({
		where: eq(announcement.id, announcementId),
		with: {
			locations: { with: { location: true } },
			contacts: { with: { contact: { with: {
				emails: true,
				phones: true,
				tags: { with: { tag: true } }
			} } } },
			tags: { with: { tag: true } },
			campaign: true,
		}
	});

    if (!result) return null;

    // 2. Check access
    const user = getOptionalUser();
    const isAuthorized = user && hasAccess(user, 'announcements');

    if (!result.isPublic) {
        if (!user || !isAuthorized) throw new Error('Unauthorized');
    }

    // 3. Resolve Primary Contact
	let resolvedContact = null;
    const findEmployee = (contacts: any[]) => {
		return contacts.find(ec => ec.contact.tags.some((ct: any) => ct.tag.name === 'Employee'));
	};

	let chosenContact = findEmployee(result.contacts);
	if (!chosenContact && result.contacts.length > 0) {
		chosenContact = result.contacts[0];
	}

    if (chosenContact) {
		const c = chosenContact.contact;
		const name = c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim();
		
		if (!isAuthorized) {
			const workEmail = c.emails.find((e: any) => e.type === 'work')?.value || '';
			const workPhone = c.phones.find((p: any) => p.type === 'work')?.value || '';
			resolvedContact = { name, email: workEmail, phone: workPhone };
		} else {
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
        return {
            id: result.id,
            title: result.title,
            content: result.content,
            isPublic: result.isPublic,
            createdAt: result.createdAt.toISOString(),
            updatedAt: result.updatedAt.toISOString(),
            tags: result.tags.map(t => ({ id: t.tag.id, name: t.tag.name })),
            locations: result.locations.filter(l => l.location.isPublic).map(l => l.location),
            resolvedContact,
            contactIds: [],
            locationIds: [],
            syncIds: [],
        } as any;
    }

    return {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        tags: result.tags.map(t => ({ id: t.tag.id, name: t.tag.name })),
        contactIds: result.contacts.map(c => c.contactId),
        locationIds: result.locations.map(l => l.locationId),
        locations: result.locations.map(l => l.location),
        syncIds: (result.campaign?.content as any)?.syncIds || [],
        resolvedContact,
    } as any;
});
