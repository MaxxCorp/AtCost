import * as v from 'valibot';
import { query } from '$app/server';
import { announcement, campaign } from '@ac/db';
import { db } from '$lib/server/db';
import { eq, desc, inArray } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import type { Announcement as DbAnnouncement } from '@ac/db';

/**
 * Announcement interface matching the database schema, with dates serialized to strings
 */
import { PaginationSchema, type Announcement, type PaginatedResult } from '@ac/validations';



/**
 * List all announcements for the authenticated user
 */
export const listAnnouncements = query(PaginationSchema, async (input): Promise<PaginatedResult<Announcement>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'announcements');

    const { page = 1, limit = 50, search = '' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(announcement).$dynamic();
    
    const conditions = [];
    if (search) {
        const { ilike, or } = await import('drizzle-orm');
        conditions.push(or(
            ilike(announcement.title, `%${search}%`),
            ilike(announcement.content as any, `%${search}%`)
        ));
    }

    if (conditions.length > 0) {
        const { and } = await import('drizzle-orm');
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const { sql } = await import('drizzle-orm');
    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const rawResults = await baseQuery
        .orderBy(desc(announcement.createdAt))
        .limit(limit)
        .offset(offset);

    const results = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));

    // Fetch campaigns for all announcements
    const campaignIds = results.map((a) => a.campaignId).filter(Boolean) as string[];
    const campaignsMap = new Map<string, string[]>();
    if (campaignIds.length > 0) {
        const campaigns = await db
            .select({ id: campaign.id, content: campaign.content })
            .from(campaign)
            .where(inArray(campaign.id, campaignIds));
        for (const c of campaigns) {
            campaignsMap.set(c.id, (c.content as any)?.syncIds || []);
        }
    }

    const data = results.map((announcement) => ({
        ...announcement,
        syncIds: announcement.campaignId ? campaignsMap.get(announcement.campaignId) || [] : [],
    }));

    return { data, total };
});

/**
 * List all public announcements for Kiosk display
 */
export const listKioskAnnouncements = query(v.undefined_(), async (): Promise<Announcement[]> => {
    const results = await db.query.announcement.findMany({
        where: eq(announcement.isPublic, true),
        orderBy: [desc(announcement.updatedAt)],
        with: {
            locations: {
                with: {
                    location: true
                }
            }
        }
    });

    return results.map(row => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        locationIds: row.locations?.map((al: any) => al.locationId) || [],
        locations: row.locations?.filter((al: any) => al.location?.isPublic).map((al: any) => ({
            id: al.location.id,
            name: al.location.name,
            street: al.location.street,
            houseNumber: al.location.houseNumber,
            zip: al.location.zip,
            city: al.location.city,
            country: al.location.country,
            isPublic: al.location.isPublic
        })) || []
    }));
});
