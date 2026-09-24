import { query } from '$app/server';
import { db } from '@ac/db';
import { announcement, announcementTag, announcementContact, tag, announcementLocation, location, contact, contactEmail, contactPhone, contactTag, locationContact, campaign } from '@ac/db';
import { eq, and, inArray } from '@ac/db';
import { getOptionalUser, hasAccess, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { type Announcement, getCampaignTargetIds } from '@ac/validations';
import { resolveAnnouncementContactSync, isEmployeeContact } from '$lib/server/contact-resolution';
import { getCache, setCache, cacheKeys } from '$lib/server/cache';

/**
 * Query: Read an announcement by ID
 * 
 * Access rules:
 * - If announcement is public: anyone can view (but only public-safe fields)
 * - If announcement is private: only authenticated users with 'announcements' access can view
 */
export const readAnnouncement = query(v.string(), async (announcementId: string): Promise<Announcement | null> => {
    const user = getOptionalUser();
    const isAuthorized = !!(user && hasAccess(user, 'announcements'));

    // 0. Cache check for public viewers / robots
    if (!isAuthorized) {
        const cachedPayload = await getCache<{ isPrivate: boolean; data?: Announcement | null }>(cacheKeys.publicAnnouncement(announcementId));
        if (cachedPayload !== null) {
            if (cachedPayload.isPrivate) {
                throw new Error('Unauthorized');
            }
            return (cachedPayload.data as any) ?? null;
        }
    }

	// 1. Fetch using Relational Queries for "easier reasoning"
	const result = await db.query.announcement.findFirst({
		where: eq(announcement.id, announcementId),
		with: {
			locations: { with: { location: true } },
			contacts: {
				with: {
					contact: {
						with: {
							emails: true,
							phones: true,
							tags: { with: { tag: true } }
						}
					}
				}
			},
			tags: { with: { tag: true } },
			campaign: true,
		}
	});

    if (!result) {
        if (!isAuthorized) {
            await setCache(cacheKeys.publicAnnouncement(announcementId), { isPrivate: false, data: null }, 30);
        }
        return null;
    }

    // 2. Check access
    if (!result.isPublic) {
        if (!isAuthorized) {
            await setCache(cacheKeys.publicAnnouncement(announcementId), { isPrivate: true }, 300);
        }
        if (!user || !isAuthorized) throw new Error('Unauthorized');
    }

    // 3. Resolve Primary Contact
    const hasAnnouncementEmployee = (result.contacts || []).some((ac: any) => isEmployeeContact(ac.contact || ac));
    const locationContactsMap = new Map<string, any[]>();

    if (!hasAnnouncementEmployee) {
        const neededLocationIds = new Set<string>();
        for (const l of result.locations || []) {
            if (l.location?.id) neededLocationIds.add(l.location.id);
            else if (l.locationId) neededLocationIds.add(l.locationId);
        }

        if (neededLocationIds.size > 0) {
            const locContactsData = await db.query.locationContact.findMany({
                where: inArray(locationContact.locationId, Array.from(neededLocationIds)),
                with: {
                    contact: {
                        with: {
                            emails: true,
                            phones: true,
                            tags: { with: { tag: true } }
                        }
                    }
                }
            });
            for (const lc of locContactsData) {
                const list = locationContactsMap.get(lc.locationId) || [];
                list.push(lc);
                locationContactsMap.set(lc.locationId, list);
            }
        }
    }

    const locations = (result.locations?.map((l: any) => l.location).filter(Boolean) || []).map((loc: any) => ({
        ...loc,
        locationContacts: locationContactsMap.get(loc.id) || []
    }));

	const resolvedContact = resolveAnnouncementContactSync({
        ...result,
        locations
    }, {
		filterWorkOnly: !isAuthorized,
		fallbackToLocation: true,
		fallbackToFirst: true
	});

    // 4. Return Data
    if (!isAuthorized) {
        const publicAnnouncement = {
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

        await setCache(cacheKeys.publicAnnouncement(announcementId), { isPrivate: false, data: publicAnnouncement }, 3600);
        return publicAnnouncement;
    }

    return {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        tags: result.tags.map(t => ({ id: t.tag.id, name: t.tag.name })),
        contactIds: result.contacts.map(c => c.contactId),
        locationIds: result.locations.map(l => l.locationId),
        locations: result.locations.map(l => l.location),
        syncIds: getCampaignTargetIds(result.campaign?.content),
        resolvedContact,
    } as any;
});
