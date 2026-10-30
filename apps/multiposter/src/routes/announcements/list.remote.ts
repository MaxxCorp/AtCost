import { query } from '$app/server';
import { db } from '@ac/db';
import { announcement, announcementLocation, announcementTag, tag, announcementResource, resource, locationContact } from '@ac/db';
import { eq, inArray, notInArray, and, or, not, ilike, sql, exists } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { announcementPaginationSchema as PaginationSchema, parseFilterValue, type Announcement, type PaginatedResult } from '@ac/validations';
import type * as v from 'valibot';
import { resolveAnnouncementContactSync, isEmployeeContact, sortContactsByPriority } from '#lib/server/contact-resolution.js';
import { cached, getNamespaceVersion, CACHE_NAMESPACES, cacheKeys, hashParams } from '#lib/server/cache/index.js';
import { sanitizePublicAnnouncement } from '#lib/server/public-sanitization.js';

/**
 * List all announcements
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

    const isPublicView = !hasAccess || Boolean(input?.excludeNonPublic);
    const version = await getNamespaceVersion(CACHE_NAMESPACES.ANNOUNCEMENTS);
    const key = cacheKeys.announcementsList(version, hashParams(input), isPublicView ? 'public' : 'auth');

    return cached(key, 300, async () => {
    const { page = 1, limit = 50, search = '', locationId, tagId, sortField = 'updatedAt', sortOrder = 'desc', excludeNonPublic, excludedAnnouncementIds, includedAnnouncementIds, excludedTags, includedTags } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: announcement.id }).from(announcement).$dynamic();
    
    const conditions: any[] = [];
    
    if (isPublicView) {
		conditions.push(eq(announcement.isPublic, true));
	}

    if (search) {
        conditions.push(ilike(announcement.title, `%${search}%`));
    }

    if (locationId) {
        const { include, exclude } = parseFilterValue(locationId);
        if (include.length > 0) {
            conditions.push(
                or(
                    exists(
                        db.select({ id: sql`1` })
                        .from(announcementLocation)
                        .where(and(eq(announcementLocation.announcementId, announcement.id), inArray(announcementLocation.locationId, include)))
                    ),
                    exists(
                        db.select({ id: sql`1` })
                        .from(announcementResource)
                        .innerJoin(resource, eq(announcementResource.resourceId, resource.id))
                        .where(and(eq(announcementResource.announcementId, announcement.id), inArray(resource.locationId, include)))
                    )
                )
            );
        }
        if (exclude.length > 0) {
            conditions.push(
                and(
                    not(exists(
                        db.select({ id: sql`1` })
                        .from(announcementLocation)
                        .where(and(eq(announcementLocation.announcementId, announcement.id), inArray(announcementLocation.locationId, exclude)))
                    )),
                    not(exists(
                        db.select({ id: sql`1` })
                        .from(announcementResource)
                        .innerJoin(resource, eq(announcementResource.resourceId, resource.id))
                        .where(and(eq(announcementResource.announcementId, announcement.id), inArray(resource.locationId, exclude)))
                    ))
                )
            );
        }
    }

    if (tagId) {
        const { include, exclude } = parseFilterValue(tagId);
        if (include.length > 0) {
            conditions.push(
                exists(
                    db.select({ id: sql`1` })
                    .from(announcementTag)
                    .where(and(eq(announcementTag.announcementId, announcement.id), inArray(announcementTag.tagId, include)))
                )
            );
        }
        if (exclude.length > 0) {
            conditions.push(
                not(exists(
                    db.select({ id: sql`1` })
                    .from(announcementTag)
                    .where(and(eq(announcementTag.announcementId, announcement.id), inArray(announcementTag.tagId, exclude)))
                ))
            );
        }
    }

    // Advanced Kiosk filters
    const conditionalFilters = [];

    if (excludeNonPublic) {
        conditionalFilters.push(eq(announcement.isPublic, true));
    }

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
		if (conditionalFilters.length > 0 || conditions.length > (isPublicView ? 1 : 0)) {
			const standardFilters = and(...conditions, ...conditionalFilters);
			conditions.length = 0;
			conditions.push(or(standardFilters, explicitInclusion));
			
			if (isPublicView) {
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
            contactRoles: {
                with: {
                    role: true
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
        if (!a.contacts || a.contacts.length === 0) {
            for (const l of a.locations || []) {
                if (l.location && !l.location.isPublic) continue;
                if (l.location?.id) neededLocationIds.add(l.location.id);
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

    let data = rawResults.map((row) => {
        const locations = (row.locations?.map((l: any) => l.location).filter(Boolean) || []).map((loc: any) => ({
            ...loc,
            locationContacts: locationContactsMap.get(loc.id) || []
        }));

        const contactRolesMap = new Map<string, { id: string; name: string; color: string }[]>();
        for (const cr of ((row as any).contactRoles || [])) {
            const list = contactRolesMap.get(cr.contactId) || [];
            if (cr.role) {
                list.push({ id: cr.role.id, name: cr.role.name, color: cr.role.color });
            }
            contactRolesMap.set(cr.contactId, list);
        }

        const contactsWithRoles = (row.contacts || []).map((c: any) => {
            const cObj = c.contact || c;
            return {
                ...cObj,
                roles: contactRolesMap.get(cObj.id) || [],
            };
        });

        const sortedContacts = sortContactsByPriority(contactsWithRoles);

        const resolvedContact = resolveAnnouncementContactSync({
            ...row,
            contacts: sortedContacts,
            locations
        }, {
            filterWorkOnly: true,
            publicOnly: true,
            fallbackToLocation: true,
            fallbackToFirst: true
        });

        return {
            ...row,
            contacts: sortedContacts,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            tags: (row.tags?.map((t: any) => t.tag) || []).filter((tagItem: any) => !isPublicView || tagItem?.visibility === 'external'),
            locations,
            locationIds: locations.map((l: any) => l.id),
            contactIds: row.contacts?.map((c: any) => c.contactId) || [],
            resolvedContact,
        };
    });

    if (isPublicView) {
        data = data
            .map((item) => sanitizePublicAnnouncement(item))
            .filter((item): item is NonNullable<typeof item> => item !== null);
    }

    return { data: data as any, total };
    });
});
