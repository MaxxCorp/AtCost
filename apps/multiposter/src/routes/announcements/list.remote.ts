import { query } from '$app/server';
import { db } from '$lib/server/db';
import { announcement, campaign } from '@ac/db';
import { eq, desc, inArray } from 'drizzle-orm';
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

    const { page = 1, limit = 50, search = '', locationId } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: announcement.id }).from(announcement).$dynamic();
    
    const conditions = [];
    if (search) {
        const { ilike } = await import('drizzle-orm');
        conditions.push(ilike(announcement.title, `%${search}%`));
    }

    if (locationId) {
        const ids = Array.isArray(locationId) ? locationId : [locationId];
        const { announcementLocation } = await import('@ac/db');
        const announcementLocations = db
            .select({ announcementId: announcementLocation.announcementId })
            .from(announcementLocation)
            .where(inArray(announcementLocation.locationId, ids));
            
        conditions.push(inArray(announcement.id, announcementLocations as any));
    }

    if (conditions.length > 0) {
        const { and } = await import('drizzle-orm');
        baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    const { sql } = await import('drizzle-orm');
    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const rawResults = await baseQuery
        .orderBy(desc(announcement.createdAt))
        .limit(limit)
        .offset(offset);

    const ids = rawResults.map((r) => r.id);
    if (ids.length === 0) {
        return { data: [], total };
    }

    const finalResults = await db
        .select()
        .from(announcement)
        .where(inArray(announcement.id, ids))
        .orderBy(desc(announcement.createdAt));

    const data = finalResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total };
});

export const listKioskAnnouncements = listAnnouncements;
