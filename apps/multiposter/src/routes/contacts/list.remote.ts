import * as v from 'valibot';
import { query } from '$app/server';
import { contact, locationContact, contactTag, tag } from '@ac/db';
import type { Contact as DbContact } from '@ac/db';
import { db } from '@ac/db';
import { desc, eq, inArray, and, or, not, ilike, sql, exists } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { contactPaginationSchema as PaginationSchema, parseFilterValue, type Contact, type PaginatedResult } from '@ac/validations';

/**
 * Query: List all contacts
 */
export const listContacts = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Contact>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'contacts');

	const { page = 1, limit = 50, search = '', locationId, tagId, associatedWith } = input || {};
	console.log("[listContacts] input:", { page, limit, search, locationId, tagId, associatedWith });
	const offset = (page - 1) * limit;

	let baseQuery = db.select({ id: contact.id }).from(contact).groupBy(contact.id).$dynamic();
	
	const conditions = [];

    if (associatedWith) {
        if (associatedWith.type === 'event') {
            const { eventContact } = await import('@ac/db');
            baseQuery = baseQuery.innerJoin(eventContact, eq(contact.id, eventContact.contactId)) as any;
            conditions.push(eq(eventContact.eventId, associatedWith.id));
        } else if (associatedWith.type === 'location') {
            const { locationContact } = await import('@ac/db');
            baseQuery = baseQuery.innerJoin(locationContact, eq(contact.id, locationContact.contactId)) as any;
            conditions.push(eq(locationContact.locationId, associatedWith.id));
        } else if (associatedWith.type === 'resource') {
            const { resourceContact } = await import('@ac/db');
            baseQuery = baseQuery.innerJoin(resourceContact, eq(contact.id, resourceContact.contactId)) as any;
            conditions.push(eq(resourceContact.resourceId, associatedWith.id));
        } else if (associatedWith.type === 'announcement') {
            const { announcementContact } = await import('@ac/db');
            baseQuery = baseQuery.innerJoin(announcementContact, eq(contact.id, announcementContact.contactId)) as any;
            conditions.push(eq(announcementContact.announcementId, associatedWith.id));
        } else if (associatedWith.type === 'user') {
            const { userContact } = await import('@ac/db');
            baseQuery = baseQuery.innerJoin(userContact, eq(contact.id, userContact.contactId)) as any;
            conditions.push(eq(userContact.userId, associatedWith.id));
        } else {
            conditions.push(sql`1 = 0`);
        }
    }

	if (search) {
		conditions.push(or(
			ilike(contact.displayName, `%${search}%`),
			ilike(contact.givenName, `%${search}%`),
			ilike(contact.familyName, `%${search}%`),
			ilike(contact.company, `%${search}%`),
			ilike(contact.department, `%${search}%`),
			ilike(contact.role, `%${search}%`),
			ilike(contact.notes, `%${search}%`)
		));
	}

	if (locationId) {
		const { include, exclude } = parseFilterValue(locationId);
		if (include.length > 0) {
			conditions.push(
				exists(
					db.select({ id: sql`1` })
					  .from(locationContact)
					  .where(and(eq(locationContact.contactId, contact.id), inArray(locationContact.locationId, include)))
				)
			);
		}
		if (exclude.length > 0) {
			conditions.push(
				not(exists(
					db.select({ id: sql`1` })
					  .from(locationContact)
					  .where(and(eq(locationContact.contactId, contact.id), inArray(locationContact.locationId, exclude)))
				))
			);
		}
	}

	if (tagId) {
		const { include, exclude } = parseFilterValue(tagId);
		if (include.length > 0) {
			conditions.push(
				exists(
					db.select({ id: sql`1` })
					  .from(contactTag)
					  .where(and(eq(contactTag.contactId, contact.id), inArray(contactTag.tagId, include)))
				)
			);
		}
		if (exclude.length > 0) {
			conditions.push(
				not(exists(
					db.select({ id: sql`1` })
					  .from(contactTag)
					  .where(and(eq(contactTag.contactId, contact.id), inArray(contactTag.tagId, exclude)))
				))
			);
		}
	}

	if (conditions.length > 0) {
		baseQuery = baseQuery.where(and(...conditions as any)) as any;
	}

	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
	const total = Number(countResult[0]?.count || 0);

    if (total === 0) {
        return { data: [], total: 0 };
    }

    const { sortField = 'updatedAt', sortOrder = 'desc' } = input || {};
    
    let orderExpression: any;
    if (sortField === 'displayName' || sortField === 'name') {
        const lowerNameSql = sql`lower(coalesce(nullif(${contact.displayName}, ''), nullif(trim(concat(${contact.givenName}, ' ', ${contact.familyName})), ''), ${contact.company}))`;
        orderExpression = sortOrder === 'desc' 
            ? sql`${lowerNameSql} desc nulls last` 
            : sql`${lowerNameSql} asc nulls last`;
    } else {
        const orderField = sortField === 'createdAt' ? contact.createdAt : contact.updatedAt;
        orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;
    }

	const paginatedIdsResult = await baseQuery
		.orderBy(orderExpression)
		.limit(limit)
		.offset(offset);
        
	const ids = paginatedIdsResult.map((r: any) => r.id);

	if (ids.length === 0) {
		console.log("[listContacts] No IDs found for query");
		return { data: [], total };
	}

    const rawResults = await db.query.contact.findMany({
        where: inArray(contact.id, ids),
        with: { user: true },
    });

    const rawMap = new Map(rawResults.map((r) => [r.id, r]));
    const sortedResults = ids.map((id) => rawMap.get(id)!).filter(Boolean);

	const data = sortedResults.map((row) => ({
		...row,
        displayName: row.displayName || '',
        givenName: row.givenName ?? undefined,
        familyName: row.familyName ?? undefined,
        middleName: row.middleName ?? undefined,
        honorificPrefix: row.honorificPrefix ?? undefined,
        honorificSuffix: row.honorificSuffix ?? undefined,
        birthday: row.birthday?.toISOString() ?? undefined,
        gender: row.gender ?? undefined,
        company: row.company ?? undefined,
        department: row.department ?? undefined,
        role: row.role ?? undefined,
        vCardPath: row.vCardPath?.includes('/api/') ? row.vCardPath : `/api/contacts/${row.id}/contact.vcf`,
        qrCodePath: row.qrCodePath?.includes('/api/') ? row.qrCodePath : `/api/contacts/${row.id}/qr.png`,
        notes: row.notes ?? undefined,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		emails: [],
		phones: [],
		addresses: [],
		locationAssociations: [],
		relations: [],
		tags: [],
	}));

	return { data, total };
});
