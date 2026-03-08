import { query } from '$app/server';
import { announcement, campaign } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { eq, desc, inArray } from 'drizzle-orm';
import { listQuery } from '$lib/server/db/query-helpers';
import type { Announcement as DbAnnouncement } from '$lib/server/db/schema';

/**
 * Announcement interface matching the database schema, with dates serialized to strings
 */
export type Announcement = Omit<DbAnnouncement, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
    tagIds?: string[];
    tagNames?: string[];
    syncIds?: string[];
    contactIds?: string[];
    locationIds?: string[];
    resolvedContact?: {
        name: string;
        email: string;
        phone: string;
        qrCodeDataUrl?: string;
    } | null;
};

/**
 * List all announcements for the authenticated user
 */
export const listAnnouncements = query(async (): Promise<Announcement[]> => {
    const results = await listQuery({
        table: announcement,
        featureName: 'announcements', // This should match ensureAccess permission
        transform: (row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        }),
    });
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

    return results.map((announcement) => ({
        ...announcement,
        syncIds: announcement.campaignId ? campaignsMap.get(announcement.campaignId) || [] : [],
    }));
});

/**
 * List all public announcements for Kiosk display
 */
export const listKioskAnnouncements = query(async (): Promise<Announcement[]> => {
    const results = await db.query.announcement.findMany({
        where: eq(announcement.isPublic, true),
        orderBy: [desc(announcement.updatedAt)],
    });

    return results.map(row => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));
});
