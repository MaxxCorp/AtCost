import { form } from '$app/server';
import { db } from '@ac/db';
import { announcement, announcementTag, announcementContact, tag, announcementLocation, campaign } from '@ac/db';
import { updateAnnouncementSchema } from '$lib/validations/announcements';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { publishAnnouncementChange } from '$lib/server/realtime';
import { listAnnouncements } from '../list.remote';
import { readAnnouncement } from './read.remote';
import { eq } from 'drizzle-orm';
import { syncService } from '$lib/server/sync/service';
import { type Announcement } from '@ac/validations';


/**
 * Command: Update an existing announcement
 */
export const updateAnnouncement = form(updateAnnouncementSchema, async (input) => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'announcements');

        const announcementId = input.id;
        const now = new Date();

        // Parse IDs
        let tagIds: string[] | undefined;
        if (typeof input.tagIds === 'string') {
            try { tagIds = JSON.parse(input.tagIds); } catch (e) { }
        } else if (Array.isArray(input.tagIds)) {
            tagIds = input.tagIds;
        }

        let contactIds: string[] | undefined;
        if (input.contactIds !== undefined) {
            contactIds = typeof input.contactIds === 'string' ? JSON.parse(input.contactIds) : input.contactIds;
        }

        // Parse tagNames (new approach)
        let tagNames: string[] | undefined;
        if (input.tagNames !== undefined && typeof input.tagNames === 'string') {
            try { tagNames = JSON.parse(input.tagNames); } catch (e) { }
        }

        // Handle isPublic boolean/string conversion if present
        const isPublic = input.isPublic === undefined
            ? undefined
            : (input.isPublic === true || input.isPublic === 'true');

        const transactionResult = await db.transaction(async (tx) => {
            // Update Announcement
            const [updatedAnnouncement] = await tx.update(announcement)
                .set({
                    title: input.title,
                    content: input.content,
                    ...(isPublic !== undefined ? { isPublic } : {}),
                    updatedAt: now,
                })
                .where(eq(announcement.id, announcementId))
                .returning();

            // Handle SyncIds & Campaign update
            if (input.syncIds !== undefined) {
                const syncIds = typeof input.syncIds === 'string' ? JSON.parse(input.syncIds) : input.syncIds;
                if (updatedAnnouncement?.campaignId) {
                    await tx.update(campaign).set({
                        content: { syncIds },
                        updatedAt: new Date()
                    }).where(eq(campaign.id, updatedAnnouncement.campaignId));
                } else if (updatedAnnouncement) {
                    const [newCampaign] = await tx.insert(campaign).values({
                        userId: user.id,
                        name: `Campaign for ${input.title}`,
                        content: { syncIds }
                    }).returning();
                    if (newCampaign) {
                        await tx.update(announcement).set({ campaignId: newCampaign.id }).where(eq(announcement.id, announcementId));
                    }
                }
            }

            // Update Tags if provided (either via IDs or Names)
            const finalTags: { id: string, name: string }[] = [];
            if (tagIds !== undefined || tagNames !== undefined) {
                // Delete existing
                await tx.delete(announcementTag).where(eq(announcementTag.announcementId, announcementId));

                const finalTagIdSet = new Set<string>(tagIds || []);

                // Process tag names (find or create)
                if (tagNames && tagNames.length > 0) {
                    for (const tagName of tagNames) {
                        const existingTag = await tx.query.tag.findFirst({
                            where: (t, { eq }) => eq(t.name, tagName)
                        });

                        if (existingTag) {
                            finalTagIdSet.add(existingTag.id);
                            finalTags.push({ id: existingTag.id, name: tagName });
                        } else {
                            const [newTag] = await tx.insert(tag).values({
                                name: tagName,
                                userId: user.id
                            }).returning({ id: tag.id });
                            finalTagIdSet.add(newTag.id);
                            finalTags.push({ id: newTag.id, name: tagName });
                        }
                    }
                }

                // If tagIds were provided directly, we might need their names for hydration

                // Insert new
                if (finalTagIdSet.size > 0) {
                    await tx.insert(announcementTag).values(
                        [...finalTagIdSet].map(tagId => ({
                            announcementId: announcementId,
                            tagId: tagId
                        }))
                    );
                }
            }

            // Update Contacts if provided
            if (contactIds !== undefined) {
                // Delete existing
                await tx.delete(announcementContact).where(eq(announcementContact.announcementId, announcementId));
                // Insert new
                if (contactIds.length > 0) {
                    await tx.insert(announcementContact).values(
                        contactIds.map(contactId => ({
                            announcementId: announcementId,
                            contactId: contactId
                        }))
                    );
                }
            }

            // Update Locations if provided
            if (input.locationIds !== undefined) {
                let locationIds: string[] = [];
                if (input.locationIds) {
                    locationIds = typeof input.locationIds === 'string' ? JSON.parse(input.locationIds) : input.locationIds;
                }

                // Delete existing
                await tx.delete(announcementLocation).where(eq(announcementLocation.announcementId, announcementId));
                // Insert new
                if (locationIds.length > 0) {
                    await tx.insert(announcementLocation).values(
                        locationIds.map(locationId => ({
                            announcementId: announcementId,
                            locationId: locationId
                        }))
                    );
                }
            }

            return { updatedAnnouncement, finalTags };
        });

        const { updatedAnnouncement, finalTags } = transactionResult as any;

        // Notify listeners
        await publishAnnouncementChange('update', [announcementId]);

        // Refresh caches - Fetch the full state inlined for "easier reasoning"
        const fullAnnouncementData = await db.query.announcement.findFirst({
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

        if (fullAnnouncementData) {
            // Compute resolved contact (duplicated for self-containment)
            const c = fullAnnouncementData.contacts.find(ec => ec.contact.tags.some((ct: any) => ct.tag.name === 'Employee'))?.contact || fullAnnouncementData.contacts[0]?.contact;
            let resolvedContact = null;
            if (c) {
                resolvedContact = {
                    name: c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim(),
                    email: c.emails.find((e: any) => e.primary)?.value || c.emails[0]?.value || '',
                    phone: c.phones.find((p: any) => p.primary)?.value || c.phones[0]?.value || '',
                    qrCodeDataUrl: c.qrCodePath || undefined
                };
            }

            const transformed = {
                ...fullAnnouncementData,
                createdAt: fullAnnouncementData.createdAt.toISOString(),
                updatedAt: fullAnnouncementData.updatedAt.toISOString(),
                tags: fullAnnouncementData.tags.map(t => ({ id: t.tag.id, name: t.tag.name })),
                contactIds: fullAnnouncementData.contacts.map(c => c.contactId),
                locationIds: fullAnnouncementData.locations.map(l => l.locationId),
                locations: fullAnnouncementData.locations.map(l => l.location),
                syncIds: (fullAnnouncementData.campaign?.content as any)?.syncIds || [],
                resolvedContact,
            } as Announcement;
            readAnnouncement(announcementId).set(transformed);
        }

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
