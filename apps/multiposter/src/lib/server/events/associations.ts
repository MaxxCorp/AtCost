import { db } from '$lib/server/db';
import { eventLocation, eventResource, eventContact, eventTag, tag } from '@ac/db';
import { eq, and } from 'drizzle-orm';

interface AssociationOptions {
    eventId: string;
    userId: string;
    locationIds?: string[];
    resourceIds?: string[];
    contactIds?: string[];
    tags?: string[];
    tx?: any;
}

export async function updateEventAssociations({
    eventId,
    userId,
    locationIds,
    resourceIds,
    contactIds,
    tags,
    tx
}: AssociationOptions) {
    const client = tx || db;

    // Locations
    if (locationIds !== undefined) {
        await client.delete(eventLocation).where(eq(eventLocation.eventId, eventId));
        if (locationIds.length > 0) {
            await client.insert(eventLocation).values(
                locationIds.map(id => ({ eventId, locationId: id }))
            );
        }
    }

    // Resources
    if (resourceIds !== undefined) {
        await client.delete(eventResource).where(eq(eventResource.eventId, eventId));
        if (resourceIds.length > 0) {
            await client.insert(eventResource).values(
                resourceIds.map(id => ({ eventId, resourceId: id }))
            );
        }
    }

    // Contacts
    if (contactIds !== undefined) {
        await client.delete(eventContact).where(eq(eventContact.eventId, eventId));
        if (contactIds.length > 0) {
            await client.insert(eventContact).values(
                contactIds.map(id => ({ eventId, contactId: id }))
            );
        }
    }

    // Tags
    if (tags !== undefined) {
        const uniqueTags = [...new Set(tags)];

        await client.delete(eventTag).where(eq(eventTag.eventId, eventId));

        if (uniqueTags.length > 0) {
            for (const name of uniqueTags) {
                // Find or create tag
                // Note: Sequential to avoid race conditions
                let [existingTag] = await client.select().from(tag).where(eq(tag.name, name));
                if (!existingTag) {
                    [existingTag] = await client.insert(tag).values({ name, userId }).returning();
                }
                if (existingTag) {
                    await client.insert(eventTag).values({ eventId, tagId: existingTag.id }).onConflictDoNothing();
                }
            }
        }
    }
}
