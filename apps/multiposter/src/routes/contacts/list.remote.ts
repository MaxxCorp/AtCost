import * as v from 'valibot';
import { query } from '$app/server';
import { contact, locationContact, contactTag, tag } from '@ac/db';
import type { Contact as DbContact } from '@ac/db';
import { db } from '@ac/db';
import { desc, eq, inArray, and, or, ilike, sql } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { contactPaginationSchema as PaginationSchema, type Contact, type PaginatedResult } from '@ac/validations';

/**
 * Query: List all contacts
 */
export const listContacts = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Contact>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'contacts');

	const { page = 1, limit = 50, search = '', locationId, tagId } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select({ id: contact.id }).from(contact).$dynamic();
	
	const conditions = [];
	if (search) {
		conditions.push(or(
			ilike(contact.displayName, `%${search}%`),
			ilike(contact.givenName, `%${search}%`),
			ilike(contact.familyName, `%${search}%`)
		));
	}

	if (locationId) {
		const ids = Array.isArray(locationId) ? locationId : [locationId];
		baseQuery = baseQuery.leftJoin(locationContact, eq(contact.id, locationContact.contactId)) as any;
		conditions.push(inArray(locationContact.locationId, ids));
	}

	if (tagId) {
		const ids = Array.isArray(tagId) ? tagId : [tagId];
		baseQuery = baseQuery.leftJoin(contactTag, eq(contact.id, contactTag.contactId)) as any;
		conditions.push(inArray(contactTag.tagId, ids));
	}

	if (conditions.length > 0) {
		baseQuery = baseQuery.where(and(...conditions as any)) as any;
	}

	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
	const total = Number(countResult.rows[0]?.count || 0);

	const paginatedIdsResult = await baseQuery
		.orderBy(desc(contact.createdAt))
		.limit(limit)
		.offset(offset);
        
	const ids = paginatedIdsResult.map(r => r.id);

	if (ids.length === 0) {
		return { data: [], total };
	}

	const rawResults = await db
		.select()
		.from(contact)
		.where(inArray(contact.id, ids))
		.orderBy(desc(contact.createdAt));

	const data = rawResults.map((row) => ({
		...row,
        id: String(row.id),
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
        vCardPath: row.vCardPath ?? undefined,
        qrCodePath: row.qrCodePath ?? undefined,
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
