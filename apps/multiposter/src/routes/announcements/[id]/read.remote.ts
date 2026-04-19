import { query } from '$app/server';
import { db } from '$lib/server/db';
import { announcement, announcementTag, announcementContact, tag, announcementLocation, contact, contactEmail, contactPhone, contactTag, locationContact, campaign, location } from '@ac/db';
import { eq, and, inArray } from 'drizzle-orm';
import { type Announcement } from '@ac/validations';

import { getOptionalUser, hasAccess, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

/**
 * Query: Read an announcement by ID
 * 
 * Access rules:
 * - If announcement is public: anyone can view (but only public-safe fields)
 * - If announcement is private: only authenticated users with 'announcements' access can view
 */
export const readAnnouncement = query(v.string(), async (announcementId: string): Promise<Announcement | null> => {
    const [result] = await db
        .select()
        .from(announcement)
        .where(eq(announcement.id, announcementId));

    if (!result) return null;

    // Check access based on public flag
    const user = getOptionalUser();
    const isAuthorized = user && hasAccess(user, 'announcements');

    if (!result.isPublic) {
        if (!user) throw new Error('Unauthorized');
        ensureAccess(user, 'announcements');
    }

    // Fetch related tags
    const tags = await db
        .select({ id: announcementTag.tagId, name: tag.name })
        .from(announcementTag)
        .leftJoin(tag, eq(announcementTag.tagId, tag.id))
        .where(eq(announcementTag.announcementId, announcementId));

    const contacts = await db
        .select({ id: announcementContact.contactId })
        .from(announcementContact)
        .where(eq(announcementContact.announcementId, announcementId));

    // Fetch related locations (with full details for filtering)
    const locationAssocs = await db
        .select({ id: announcementLocation.locationId })
        .from(announcementLocation)
        .where(eq(announcementLocation.announcementId, announcementId));

    // Resolve primary contact details
    let resolvedContact = null;

    // Helper to fetch contact info (public-safe or full)
    const fetchContactInfo = async (contactId: string, publicOnly: boolean) => {
        const [c] = await db.select().from(contact).where(eq(contact.id, contactId));
        if (!c) return null;

        if (publicOnly) {
            // For public access: only work emails/phones, no QR code
            const [email] = await db
                .select({ value: contactEmail.value })
                .from(contactEmail)
                .where(and(eq(contactEmail.contactId, contactId), eq(contactEmail.type, 'work')))
                .limit(1);

            const [phone] = await db
                .select({ value: contactPhone.value })
                .from(contactPhone)
                .where(and(eq(contactPhone.contactId, contactId), eq(contactPhone.type, 'work')))
                .limit(1);

            return {
                name: c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim(),
                email: email?.value || '',
                phone: phone?.value || '',
            };
        }

        // For authenticated access: primary contact info
        const [email] = await db
            .select({ value: contactEmail.value })
            .from(contactEmail)
            .where(and(eq(contactEmail.contactId, contactId), eq(contactEmail.primary, true)))
            .limit(1);

        const [phone] = await db
            .select({ value: contactPhone.value })
            .from(contactPhone)
            .where(and(eq(contactPhone.contactId, contactId), eq(contactPhone.primary, true)))
            .limit(1);

        return {
            name: c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim(),
            email: email?.value || '',
            phone: phone?.value || '',
            qrCodeDataUrl: c.qrCodePath || undefined
        };
    };

    // 1. Check for Announcement Contact with 'Employee' tag
    let chosenContactId: string | null = null;

    // Fetch contacts with their tags
    const contactsWithTags = await db
        .select({
            contactId: announcementContact.contactId,
            tagName: tag.name
        })
        .from(announcementContact)
        .leftJoin(contactTag, eq(announcementContact.contactId, contactTag.contactId))
        .leftJoin(tag, eq(contactTag.tagId, tag.id))
        .where(eq(announcementContact.announcementId, announcementId));

    // Group tags by contact
    const contactTagsMap = new Map<string, string[]>();
    for (const row of contactsWithTags) {
        if (!contactTagsMap.has(row.contactId)) contactTagsMap.set(row.contactId, []);
        if (row.tagName) contactTagsMap.get(row.contactId)?.push(row.tagName);
    }

    // Find first contact with 'Employee' tag
    const employeeContact = Array.from(contactTagsMap.entries()).find(([_, tags]) => tags.includes('Employee'));
    if (employeeContact) {
        chosenContactId = employeeContact[0];
    }

    // 2. If no Announcement Employee Contact, check Location Employee Contacts
    if (!chosenContactId && locationAssocs.length > 0) {
        const locIds = locationAssocs.map(l => l.id);
        const locationContacts = await db
            .select({
                contactId: locationContact.contactId,
                tagName: tag.name
            })
            .from(locationContact)
            .leftJoin(contactTag, eq(locationContact.contactId, contactTag.contactId))
            .leftJoin(tag, eq(contactTag.tagId, tag.id))
            .where(inArray(locationContact.locationId, locIds));

        // Find first location contact with 'Employee' tag
        const locContact = locationContacts.find(row => row.tagName === 'Employee');
        if (locContact) {
            chosenContactId = locContact.contactId;
        }
    }

    // 3. Fallback: First announcement contact (if any)
    if (!chosenContactId && contacts.length > 0) {
        chosenContactId = contacts[0].id;
    }

    if (chosenContactId) {
        resolvedContact = await fetchContactInfo(chosenContactId, !isAuthorized);
    }

    // --- PUBLIC VIEW: Return filtered, safe data only ---
    if (!isAuthorized) {
        // Fetch public locations for display
        let publicLocations: any[] = [];
        if (locationAssocs.length > 0) {
            const locIds = locationAssocs.map(l => l.id);
            publicLocations = await db
                .select({
                    id: location.id,
                    name: location.name,
                    street: location.street,
                    houseNumber: location.houseNumber,
                    zip: location.zip,
                    city: location.city,
                    country: location.country,
                    isPublic: location.isPublic,
                })
                .from(location)
                .where(and(inArray(location.id, locIds), eq(location.isPublic, true)));
        }

        return {
            id: result.id,
            title: result.title,
            content: result.content,
            isPublic: result.isPublic,
            createdAt: result.createdAt.toISOString(),
            updatedAt: result.updatedAt.toISOString(),
            tagNames: tags.map(t => t.name).filter(n => n !== null) as string[],
            locations: publicLocations.map(l => ({
                id: l.id,
                name: l.name,
                street: l.street,
                houseNumber: l.houseNumber,
                zip: l.zip,
                city: l.city,
                country: l.country,
                isPublic: l.isPublic,
            })),
            resolvedContact,
            // Explicitly exclude internal data
            contactIds: [],
            locationIds: [],
            syncIds: [],
        } as unknown as Announcement;
    }

    // --- AUTHENTICATED VIEW: Return full data ---
    // Fetch Campaign
    let syncIds: string[] = [];
    if (result.campaignId) {
        const [c] = await db
            .select({ content: campaign.content })
            .from(campaign)
            .where(eq(campaign.id, result.campaignId));
        if (c && c.content) {
            syncIds = (c.content as any).syncIds || [];
        }
    }

    return {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        tagIds: tags.map(t => t.id),
        tagNames: tags.map(t => t.name).filter(n => n !== null) as string[],
        contactIds: contacts.map(c => c.id),
        locationIds: locationAssocs.map(l => l.id),
        syncIds,
        resolvedContact,
    } as Announcement;
});
