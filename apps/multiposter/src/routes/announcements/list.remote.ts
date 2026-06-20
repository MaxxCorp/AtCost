import { query } from '$app/server';
import { db } from '@ac/db';
import { announcement, campaign, announcementLocation } from '@ac/db';
import { eq, desc, inArray, and, ilike, sql } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import type { Announcement as DbAnnouncement } from '@ac/db';
import { announcementPaginationSchema as PaginationSchema, type Announcement, type PaginatedResult } from '@ac/validations';
import type * as v from 'valibot';

/**
 * List all announcements for the authenticated user
 */
export const listAnnouncements = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Announcement>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'announcements');

    const { page = 1, limit = 50, search = '', locationId, sortField = 'updatedAt', sortOrder = 'desc' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: announcement.id }).from(announcement).$dynamic();
    
    const conditions = [];
    if (search) {
        conditions.push(ilike(announcement.title, `%${search}%`));
    }

    if (locationId) {
        const ids = Array.isArray(locationId) ? locationId : [locationId];
        const announcementLocationsQuery = db
            .select({ announcementId: announcementLocation.announcementId })
            .from(announcementLocation)
            .where(inArray(announcementLocation.locationId, ids));
            
        conditions.push(inArray(announcement.id, announcementLocationsQuery as any));
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
            }
        }
    });

    const data = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        tags: row.tags?.map((t: any) => t.tag) || [],
    }));

    return { data: data as any, total };
});

