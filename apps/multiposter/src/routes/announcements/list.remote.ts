import { query } from '$app/server';
import { db } from '@ac/db';
import { announcement, campaign, announcementLocation, announcementTag, tag, announcementResource, resource, locationContact } from '@ac/db';
import { eq, desc, inArray, notInArray, and, or, ilike, sql, exists } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import type { Announcement as DbAnnouncement } from '@ac/db';
import { announcementPaginationSchema as PaginationSchema, type Announcement, type PaginatedResult } from '@ac/validations';
import type * as v from 'valibot';
import { resolveAnnouncementContactSync, isEmployeeContact } from '$lib/server/contact-resolution';

/**
 * List all announcements for the authenticated user
 */
export const listAnnouncements = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Announcement>> => {
    let hasAccess = false;
	try {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'announcements');
		hasAccess = true;
	} catch (e) {
		// unauthorized can only see public announcements
	}

    const { page = 1, limit = 50, search = '', locationId, sortField = 'updatedAt', sortOrder = 'desc', excludedAnnouncementIds, includedAnnouncementIds, excludedTags, includedTags } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: announcement.id }).from(announcement).$dynamic();
    
    const conditions: any[] = [];
    
    if (!hasAccess) {
		conditions.push(eq(announcement.isPublic, true));
	}

    if (search) {
        conditions.push(ilike(announcement.title, `%${search}%`));
    }

    if (locationId) {
        const ids = Array.isArray(locationId) ? locationId : [locationId];
        if (ids.length > 0) {
            conditions.push(
                or(
                    exists(
                        db.select({ id: sql`1` })
                        .from(announcementLocation)
                        .where(and(eq(announcementLocation.announcementId, announcement.id), inArray(announcementLocation.locationId, ids)))
                    ),
                    exists(
                        db.select({ id: sql`1` })
                        .from(announcementResource)
                        .innerJoin(resource, eq(announcementResource.resourceId, resource.id))
                        .where(and(eq(announcementResource.announcementId, announcement.id), inArray(resource.locationId, ids)))
                    )
                )
            );
        }
    }

    // Advanced Kiosk filters
    const conditionalFilters = [];

    if (excludedTags && excludedTags.length > 0) {
		conditionalFilters.push(
			sql`NOT EXISTS (
				SELECT 1 FROM ${announcementTag} at
				JOIN ${tag} t ON at.tag_id = t.id
				WHERE at.announcement_id = ${announcement.id} AND t.name IN (${sql.join(excludedTags.map(t => sql`${t}`), sql`, `)})
			)`
		);
	}
	
	if (includedTags && includedTags.length > 0) {
		conditionalFilters.push(
			sql`EXISTS (
				SELECT 1 FROM ${announcementTag} at
				JOIN ${tag} t ON at.tag_id = t.id
				WHERE at.announcement_id = ${announcement.id} AND t.name IN (${sql.join(includedTags.map(t => sql`${t}`), sql`, `)})
			)`
		);
	}

	if (excludedAnnouncementIds && excludedAnnouncementIds.length > 0) {
		conditionalFilters.push(notInArray(announcement.id, excludedAnnouncementIds));
	}

	if (includedAnnouncementIds && includedAnnouncementIds.length > 0) {
		const explicitInclusion = inArray(announcement.id, includedAnnouncementIds);
		if (conditionalFilters.length > 0 || conditions.length > (hasAccess ? 0 : 1)) {
			const standardFilters = and(...conditions, ...conditionalFilters);
			conditions.length = 0;
			conditions.push(or(standardFilters, explicitInclusion));
			
			if (!hasAccess) {
				conditions.push(eq(announcement.isPublic, true));
			}
		} else {
			conditions.push(explicitInclusion);
		}
	} else {
		conditions.push(...conditionalFilters);
	}

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    if (total === 0) {
        return { data: [], total: 0 };
    }

    let orderField: any = announcement.updatedAt;
    if (sortField === 'title') orderField = announcement.title;
    else if (sortField === 'createdAt') orderField = announcement.createdAt;

    const orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;

    const paginatedIdsResult = await baseQuery
        .orderBy(orderExpression)
        .limit(limit)
        .offset(offset);

    const ids = paginatedIdsResult.map((r) => r.id);
    if (ids.length === 0) {
        return { data: [], total };
    }

    const rawResults = await db.query.announcement.findMany({
        where: inArray(announcement.id, ids),
        orderBy: [orderExpression],
        with: {
            user: true,
            tags: {
                with: {
                    tag: true
                }
            },
            locations: {
                with: {
                    location: true
                }
            },
            contacts: {
                with: {
                    contact: {
                        with: {
                            emails: true,
                            phones: true,
                            tags: {
                                with: {
                                    tag: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const neededLocationIds = new Set<string>();
    for (const a of rawResults) {
        const hasEmployee = (a.contacts || []).some((ac: any) => isEmployeeContact(ac.contact || ac));
        if (!hasEmployee) {
            for (const l of a.locations || []) {
                if (l.location?.id) neededLocationIds.add(l.location.id);
                else if (l.locationId) neededLocationIds.add(l.locationId);
            }
        }
    }

    const locationContactsMap = new Map<string, any[]>();
    if (neededLocationIds.size > 0) {
        const locContactsData = await db.query.locationContact.findMany({
            where: inArray(locationContact.locationId, Array.from(neededLocationIds)),
            with: {
                contact: {
                    with: {
                        emails: true,
                        phones: true,
                        tags: {
                            with: {
                                tag: true
                            }
                        }
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

    const data = rawResults.map((row) => {
        const locations = (row.locations?.map((l: any) => l.location).filter(Boolean) || []).map((loc: any) => ({
            ...loc,
            locationContacts: locationContactsMap.get(loc.id) || []
        }));

        const resolvedContact = resolveAnnouncementContactSync({
            ...row,
            locations
        }, {
            filterWorkOnly: !hasAccess,
            fallbackToLocation: true,
            fallbackToFirst: true
        });

        return {
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            tags: row.tags?.map((t: any) => t.tag) || [],
            locations,
            locationIds: locations.map((l: any) => l.id),
            contactIds: row.contacts?.map((c: any) => c.contactId) || [],
            resolvedContact,
        };
    });

    return { data: data as any, total };
});

