import { form } from '$app/server';
import { db } from '$lib/server/db';
import { announcement, announcementTag, announcementContact, tag, announcementLocation, campaign } from '@ac/db';
import { createAnnouncementSchema } from '$lib/validations/announcements';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { publishAnnouncementChange } from '$lib/server/realtime';
import { listAnnouncements } from '../list.remote';
import { syncService } from '$lib/server/sync/service';


/**
 * Command: Create a new announcement
 */
export const createAnnouncement = form(createAnnouncementSchema, async (input) => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'announcements');

        let announcementId: string = '';
        const now = new Date();

        // Parse IDs
        let tagIds: string[] = [];
        if (typeof input.tagIds === 'string') {
            try { tagIds = JSON.parse(input.tagIds); } catch (e) { }
        } else if (Array.isArray(input.tagIds)) {
            tagIds = input.tagIds;
        }

        // Parse tagNames (new approach)
        let tagNames: string[] = [];
        if (typeof input.tagNames === 'string') {
            try { tagNames = JSON.parse(input.tagNames); } catch (e) { }
        }

        let contactIds: string[] = [];
        if (input.contactIds) {
            contactIds = typeof input.contactIds === 'string' ? JSON.parse(input.contactIds) : input.contactIds;
        }

        // Handle isPublic boolean/string conversion
        const isPublic = input.isPublic === true || input.isPublic === 'true';

        // Handle SyncIds & Campaign
        let syncIds: string[] = [];
        if (input.syncIds) {
            syncIds = typeof input.syncIds === 'string' ? JSON.parse(input.syncIds) : input.syncIds;
        }

        await db.transaction(async (tx) => {
            // Create Campaign for the announcement
            const [newCampaign] = await tx.insert(campaign).values({
                userId: user.id,
                name: `Campaign for ${input.title}`,
                content: { syncIds }
            }).returning();

            // Insert Announcement
            const [newAnnouncement] = await tx.insert(announcement).values({
                userId: user.id,
                campaignId: newCampaign?.id,
                title: input.title,
                content: input.content,
                isPublic: isPublic,
                createdAt: now,
                updatedAt: now,
            }).returning({ id: announcement.id });

            announcementId = newAnnouncement.id;

            // Insert Tags
            const finalTagIds = new Set<string>(tagIds);

            // Process tag names (find or create)
            if (tagNames.length > 0) {
                for (const tagName of tagNames) {
                    const existingTag = await tx.query.tag.findFirst({
                        where: (t, { eq }) => eq(t.name, tagName)
                    });

                    if (existingTag) {
                        finalTagIds.add(existingTag.id);
                    } else {
                        const [newTag] = await tx.insert(tag).values({
                            name: tagName,
                            userId: user.id
                        }).returning({ id: tag.id });
                        finalTagIds.add(newTag.id);
                    }
                }
            }

            if (finalTagIds.size > 0) {
                await tx.insert(announcementTag).values(
                    [...finalTagIds].map(tagId => ({
                        announcementId: announcementId,
                        tagId: tagId
                    }))
                );
            }

            // Insert Contacts
            if (contactIds.length > 0) {
                await tx.insert(announcementContact).values(
                    contactIds.map(contactId => ({
                        announcementId: announcementId,
                        contactId: contactId
                    }))
                );
            }

            // Insert Locations
            let locationIds: string[] = [];
            if (input.locationIds) {
                locationIds = typeof input.locationIds === 'string' ? JSON.parse(input.locationIds) : input.locationIds;
            }

            if (locationIds.length > 0) {
                await tx.insert(announcementLocation).values(
                    locationIds.map(locationId => ({
                        announcementId: announcementId,
                        locationId: locationId
                    }))
                );
            }
        });

        // Notify listeners
        await publishAnnouncementChange('create', [announcementId]);

        // Refresh list cache if applicable
        void listAnnouncements().refresh();

        // Trigger background sync to external providers
        await syncService.triggerPushSync(user.id, announcementId, 'announcement');

        return {

            success: true,
            id: announcementId
        };
    } catch (error: any) {
        if (error?.status && error?.location) {
            throw error;
        }

        return {
            success: false,
            error: error?.message || 'An unexpected error occurred'
        };
    }
});
