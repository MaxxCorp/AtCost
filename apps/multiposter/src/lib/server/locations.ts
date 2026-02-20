import { db } from './db';
import { location, locationContact } from './db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser, hasAccess } from '$lib/authorization';

/**
 * Get all locations associated with a specific contact
 */
export async function getContactLocations(contactId: string) {
    const user = getAuthenticatedUser();
    // Assuming 'contacts' access is enough to view contact's locations
    // Or 'locations' access? Let's require 'contacts'.
    if (!hasAccess(user, 'contacts')) {
        throw new Error('Forbidden');
    }

    const associations = await db.query.locationContact.findMany({
        where: (t, { eq }) => eq(t.contactId, contactId),
        with: {
            location: true
        }
    });

    return associations.map(a => a.location);
}
