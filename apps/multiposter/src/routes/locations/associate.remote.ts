import { command, query } from '$app/server';
import { db } from '$lib/server/db';
import { announcementLocation, eventLocation, kioskLocation, location, resourceLocation } from '@ac/db';
import { eq, and } from 'drizzle-orm';
import { locationAssociationSchema, getLocationAssociationsSchema } from '$lib/validations/locations';

export const addLocationAssociation = command(locationAssociationSchema, async (data) => {
    const { type, entityId, locationId } = data;
    
    if (type === 'announcement') {
        await db.insert(announcementLocation).values({
            announcementId: entityId,
            locationId
        }).onConflictDoNothing();
    } else if (type === 'event') {
        await db.insert(eventLocation).values({
            eventId: entityId,
            locationId
        }).onConflictDoNothing();
    } else if (type === 'kiosk') {
        await db.insert(kioskLocation).values({
            kioskId: entityId,
            locationId
        }).onConflictDoNothing();
    } else if (type === 'resource') {
        await db.insert(resourceLocation).values({
            resourceId: entityId,
            locationId
        }).onConflictDoNothing();
    }
    
    await fetchEntityLocations({ type, entityId }).refresh();
    return { success: true };
});

export const removeLocationAssociation = command(locationAssociationSchema, async (data) => {
    const { type, entityId, locationId } = data;
    
    if (type === 'announcement') {
        await db.delete(announcementLocation).where(and(
            eq(announcementLocation.announcementId, entityId),
            eq(announcementLocation.locationId, locationId)
        ));
    } else if (type === 'event') {
        await db.delete(eventLocation).where(and(
            eq(eventLocation.eventId, entityId),
            eq(eventLocation.locationId, locationId)
        ));
    } else if (type === 'kiosk') {
        await db.delete(kioskLocation).where(and(
            eq(kioskLocation.kioskId, entityId),
            eq(kioskLocation.locationId, locationId)
        ));
    } else if (type === 'resource') {
        await db.delete(resourceLocation).where(and(
            eq(resourceLocation.resourceId, entityId),
            eq(resourceLocation.locationId, locationId)
        ));
    }
    
    await fetchEntityLocations({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityLocations = query(getLocationAssociationsSchema, async (data) => {
    const { type, entityId } = data;
    
    let results: { location: typeof location.$inferSelect }[] = [];
    if (type === 'announcement') {
        results = await db.select({ location: location })
            .from(announcementLocation)
            .innerJoin(location, eq(announcementLocation.locationId, location.id))
            .where(eq(announcementLocation.announcementId, entityId));
    } else if (type === 'event') {
        results = await db.select({ location: location })
            .from(eventLocation)
            .innerJoin(location, eq(eventLocation.locationId, location.id))
            .where(eq(eventLocation.eventId, entityId));
    } else if (type === 'kiosk') {
        results = await db.select({ location: location })
            .from(kioskLocation)
            .innerJoin(location, eq(kioskLocation.locationId, location.id))
            .where(eq(kioskLocation.kioskId, entityId));
    } else if (type === 'resource') {
        results = await db.select({ location: location })
            .from(resourceLocation)
            .innerJoin(location, eq(resourceLocation.locationId, location.id))
            .where(eq(resourceLocation.resourceId, entityId));
    }
    
    return results.map(r => r.location);
});
