import { query } from '$app/server';
import { db } from '@ac/db';
import { resource, location, resourceRelation, resourceLocation, resourceContact } from '@ac/db';
import { eq, and, getTableColumns } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const readResource = query(v.string(), async (id: string) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'resources');

	const [result] = (await db
		.select({
			...getTableColumns(resource),
			locationName: location.name,
		})
		.from(resource)
		.leftJoin(location, eq(resource.locationId, location.id))
		.where(eq(resource.id, id))) as any[];

	if (!result) return null;
	console.log('readResource result:', JSON.stringify(result, null, 2));

	// Fetch parent relations
	const relations = await db
		.select({ parentId: resourceRelation.parentResourceId })
		.from(resourceRelation)
		.where(eq(resourceRelation.childResourceId, id));

	// Fetch location associations
	const locations = await db
		.select({ locationId: resourceLocation.locationId })
		.from(resourceLocation)
		.where(eq(resourceLocation.resourceId, id));

	// Fetch contact associations
	const contacts = await db
		.select({ contactId: resourceContact.contactId })
		.from(resourceContact)
		.where(eq(resourceContact.resourceId, id));

	return {
		...result,
		parentResourceIds: relations.map((r: any) => r.parentId),
		locationIds: locations.map((l: any) => l.locationId),
		contactIds: contacts.map((c: any) => c.contactId)
	};
});

