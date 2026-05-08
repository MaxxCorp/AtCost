import { command, query } from '$app/server';
import { db } from '@ac/db';
import { announcementLocation, eventLocation, kioskLocation, location, resourceLocation } from '@ac/db';
import { eq } from '@ac/db';
import { locationAssociationSchema, getLocationAssociationsSchema } from '@ac/validations';
import { addAssociation as dbAddAssociation, removeAssociation as dbRemoveAssociation } from '$lib/server/associations';

const tableMap = {
    announcement: announcementLocation,
    event: eventLocation,
    kiosk: kioskLocation,
    resource: resourceLocation
} as const;

const fieldMap = {
    announcement: 'announcementId',
    event: 'eventId',
    kiosk: 'kioskId',
    resource: 'resourceId'
} as const;

export const addLocationAssociation = command(locationAssociationSchema, async (data) => {
    const { type, entityId, locationId } = data;
    
    await dbAddAssociation({
        type,
        entityId,
        itemId: locationId,
        tableMap,
        fieldMap,
        itemField: 'locationId'
    });
    
    await fetchEntityLocations({ type, entityId }).refresh();
    return { success: true };
});

export const removeLocationAssociation = command(locationAssociationSchema, async (data) => {
    const { type, entityId, locationId } = data;
    
    await dbRemoveAssociation({
        type,
        entityId,
        itemId: locationId,
        tableMap,
        fieldMap,
        itemField: 'locationId'
    });
    
    await fetchEntityLocations({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityLocations = query(getLocationAssociationsSchema, async (data) => {
    const { type, entityId } = data;
    
    const table = tableMap[type as keyof typeof tableMap];
    const entityField = fieldMap[type as keyof typeof fieldMap];

    if (!table || !entityField) {
        throw new Error(`Unsupported entity type: ${type}`);
    }

    const results = await db.select({ location: location })
        .from(table as any)
        .innerJoin(location, eq((table as any).locationId, location.id))
        .where(eq((table as any)[entityField], entityId));
    
    return results.map(r => ({
        ...r.location,
        createdAt: r.location.createdAt.toISOString(),
        updatedAt: r.location.updatedAt.toISOString(),
    }));
});
