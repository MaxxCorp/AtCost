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
export type Announcement = Omit<DbAnnouncement, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
    tagIds?: string[];
    tagNames?: string[];
    syncIds?: string[];
    contactIds?: string[];
    locationIds?: string[];
    locations?: {
        id: string;
        name: string;
        street: string | null;
        houseNumber: string | null;
        zip: string | null;
        city: string | null;
        country: string | null;
        isPublic: boolean;
    }[];
    resolvedContact?: {
        name: string;
        email: string;
        phone: string;
        qrCodeDataUrl?: string;
        qrCodePath?: string;
    } | null;
};

/**
 * List all announcements for the authenticated user
 */
export const listAnnouncements = query(v.undefined_(), async (): Promise<Announcement[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'announcements');

    const rawResults = await db
        .select()
        .from(announcement)
        .orderBy(desc(announcement.createdAt));

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

    return results.map((announcement) => ({
        ...announcement,
        syncIds: announcement.campaignId ? campaignsMap.get(announcement.campaignId) || [] : [],
    }));
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
