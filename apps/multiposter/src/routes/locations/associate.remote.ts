import { command, query } from '$app/server';
import { getContactLocations } from '$lib/server/locations';
import { associateContact, dissociateContact } from '$lib/server/contacts';
import * as v from 'valibot';

// Schema for fetching locations for a contact
const fetchSchema = v.object({
    contactId: v.pipe(v.string(), v.uuid())
});

// Schema for modifying association
const associationInputSchema = v.object({
    locationId: v.pipe(v.string(), v.uuid()),
    contactId: v.pipe(v.string(), v.uuid())
});

export const fetchContactLocations = query(fetchSchema, async (data) => {
    const locations = await getContactLocations(data.contactId);
    // Serialize dates
    return locations.map(l => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString()
    }));
});

export const addLocationToContact = command(associationInputSchema, async (data) => {
    // "Associate a contact with a location"
    // associateContact(type, entityId, contactId)
    // type='location', entityId=locationId, contactId=contactId
    await associateContact('location', data.locationId, data.contactId);
    await fetchContactLocations({ contactId: data.contactId }).refresh();
    return { success: true };
});

export const removeLocationFromContact = command(associationInputSchema, async (data) => {
    await dissociateContact('location', data.locationId, data.contactId);
    await fetchContactLocations({ contactId: data.contactId }).refresh();
    return { success: true };
});
