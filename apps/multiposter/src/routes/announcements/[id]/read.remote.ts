import { query } from '$app/server';
import { db } from '@ac/db';
import { announcement, locationContact, eq, inArray } from '@ac/db';
import { getOptionalUser, hasAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { type Announcement, getCampaignTargetIds } from '@ac/validations';
import { resolveAnnouncementContactSync, isEmployeeContact } from '#lib/server/contact-resolution.js';
import { getCache, setCache, cacheKeys } from '#lib/server/cache/index.js';
import { sanitizePublicAnnouncement } from '#lib/server/public-sanitization.js';

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
            return cachedPayload.data ? (sanitizePublicAnnouncement(cachedPayload.data) as any) : null;
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
    const hasEligibleEmployee = (result.contacts || []).some((ac: any) => {
        const cObj = ac.contact || ac;
        return cObj?.isPublic === true && isEmployeeContact(cObj);
    });
    const locationContactsMap = new Map<string, any[]>();

    if (!hasEligibleEmployee) {
        const neededLocationIds = new Set<string>();
        for (const l of result.locations || []) {
            if (l.location && !l.location.isPublic) continue;
            if (l.location?.id) neededLocationIds.add(l.location.id);
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
		filterWorkOnly: true,
		publicOnly: true,
		fallbackToLocation: true,
		fallbackToFirst: true
	});

    // 4. Return Data
    if (!isAuthorized) {
        const publicAnnouncement = sanitizePublicAnnouncement({
            ...result,
            locations,
            resolvedContact
        });

        await setCache(cacheKeys.publicAnnouncement(announcementId), { isPrivate: false, data: publicAnnouncement }, 3600);
        return publicAnnouncement;
    }

    return {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        tags: result.tags.map(t => ({ id: t.tag.id, name: t.tag.name, visibility: t.tag.visibility })),
        contactIds: result.contacts.map(c => c.contactId),
        locationIds: result.locations.map(l => l.locationId),
        locations: result.locations.map(l => l.location),
        syncIds: getCampaignTargetIds(result.campaign?.content),
        resolvedContact,
    } as any;
});
