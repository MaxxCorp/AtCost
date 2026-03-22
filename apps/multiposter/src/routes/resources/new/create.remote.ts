import { form } from '$app/server';
import { db } from '$lib/server/db';
import { resource, resourceRelation, resourceLocation as resourceLocationTable } from '@ac/db';
import { listResources } from '../list.remote';
import { listResourcesWithHierarchy } from '../list-with-hierarchy.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { createResourceSchema } from '$lib/validations/resources';
import { associateContact } from '$lib/server/contacts';

export const createResource = form(createResourceSchema, async (data) => {
    console.log('--- createResource START ---');
    console.log('Data received:', JSON.stringify(data, null, 2));

    try {
        const user = getAuthenticatedUser();
        if (!user || !user.id) {
            throw new Error('User not authenticated correctly');
        }
        ensureAccess(user, 'resources');
        console.log('User ID:', user.id);

        const maxOccupancy = (data.maxOccupancy !== undefined && data.maxOccupancy !== null && data.maxOccupancy !== '') 
            ? Number(data.maxOccupancy) 
            : null;

        // Manual parsing for fields simplified in schema
        let allocationCalendars = [];
        if (typeof data.allocationCalendars === 'string') {
            try { allocationCalendars = JSON.parse(data.allocationCalendars); } catch { allocationCalendars = []; }
        } else if (Array.isArray(data.allocationCalendars)) {
            allocationCalendars = data.allocationCalendars;
        }

        const insertData: any = {
            userId: user.id as string,
            name: data.name,
            description: data.description || null,
            type: data.type,
            maxOccupancy: isNaN(maxOccupancy as any) ? null : maxOccupancy,
            locationId: (data.locationId && data.locationId !== '') ? data.locationId : null,
            allocationCalendars: allocationCalendars,
        };

        console.log('Insert payload:', JSON.stringify(insertData, null, 2));

        // Use a transaction for atomic resource creation and associations
        const { newResource, relations } = await db.transaction(async (tx) => {
            const result = await tx.insert(resource).values(insertData).returning();
            if (!result || result.length === 0) {
                throw new Error('Failed to create resource - no result returned');
            }
            const res = result[0];

            // 1. Insert parent relations if any
            const parentResourceIds = data.parentResourceIds as any;
            if (parentResourceIds && Array.isArray(parentResourceIds) && parentResourceIds.length > 0) {
                console.log('Inserting parent relations:', parentResourceIds);
                const relationData = parentResourceIds.map((parentId: string) => ({
                    parentResourceId: parentId,
                    childResourceId: res.id,
                    type: 'parent-child',
                }));
                await tx.insert(resourceRelation).values(relationData);
            }

            // 2. Associate locations if any
            let locationIds = [];
            if (typeof data.locationIds === 'string') {
                try { locationIds = JSON.parse(data.locationIds); } catch { locationIds = []; }
            } else if (Array.isArray(data.locationIds)) {
                locationIds = data.locationIds;
            }

            if (locationIds.length > 0) {
                console.log('Associating locations:', locationIds);
                const locationData = locationIds.map((locId: string) => ({
                    resourceId: res.id,
                    locationId: locId,
                }));
                await tx.insert(resourceLocationTable).values(locationData);
            }

            return { newResource: res, relations: true };
        });

        // 3. Associate contacts if any (kept separate as it uses a helper that might have internal refreshes)
        let contactIds = [];
        if (typeof data.contactIds === 'string') {
            try { contactIds = JSON.parse(data.contactIds); } catch { contactIds = []; }
        } else if (Array.isArray(data.contactIds)) {
            contactIds = data.contactIds;
        }

        if (contactIds.length > 0) {
            console.log('Associating contacts:', contactIds);
            for (const contactId of contactIds) {
                await associateContact('resource', newResource.id, contactId);
            }
            console.log('Contacts associated successfully');
        }

        console.log('Refreshing queries...');
        await listResources().refresh();
        await listResourcesWithHierarchy().refresh();

        console.log('--- createResource SUCCESS ---');
        return { success: true, resource: newResource };

    } catch (err: any) {
        console.error('--- createResource ERROR ---');
        console.error(err);
        return { success: false, error: { message: err.message || 'Creation failed' } };
    }
});
