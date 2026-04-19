import * as v from 'valibot';
import { query } from '$app/server';
import { contact } from '@ac/db';
import type { Contact as DbContact } from '@ac/db';
import { db } from '$lib/server/db';
import { desc } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

/**
 * Contact interface matching the database schema, with dates serialized to strings and relations
 */
import { PaginationSchema, type Contact, type PaginatedResult } from '@ac/validations';



/**
 * Query: List all contacts
 */
export const listContacts = query(PaginationSchema, async (input): Promise<PaginatedResult<Contact>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'contacts');

	const { page = 1, limit = 50, search = '' } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select({ id: contact.id }).from(contact).$dynamic();
	
	const conditions = [];
	if (search) {
		const { ilike, or } = await import('drizzle-orm');
		conditions.push(or(
			ilike(contact.givenName, `%${search}%`),
			ilike(contact.familyName, `%${search}%`),
			ilike(contact.displayName, `%${search}%`)
		));
	}

	if (conditions.length > 0) {
		const { and } = await import('drizzle-orm');
		baseQuery = baseQuery.where(and(...conditions as any)) as any;
	}

	const { sql, inArray } = await import('drizzle-orm');
	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
	const total = Number(countResult[0]?.count || 0);

	if (total === 0) {
		return { data: [], total: 0 };
	}

	const paginatedIdsQuery = baseQuery.orderBy(desc(contact.createdAt)).limit(limit).offset(offset);
	const paginatedIds = (await paginatedIdsQuery).map((r) => r.id);

	if (paginatedIds.length === 0) {
		return { data: [], total };
	}

	const results = await db.query.contact.findMany({
		where: inArray(contact.id, paginatedIds),
		orderBy: [desc(contact.createdAt)],
		with: {
			emails: true,
			phones: true,
			addresses: true,
		}
	});

	const data = results.map((row) => ({
		...row,
        displayName: row.displayName || "",
        givenName: row.givenName ?? undefined,
        familyName: row.familyName ?? undefined,
        honorificPrefix: row.honorificPrefix ?? undefined,
        honorificSuffix: row.honorificSuffix ?? undefined,
        gender: row.gender ?? undefined,
        company: row.company ?? undefined,
        role: row.role ?? undefined,
        department: row.department ?? undefined,
        notes: row.notes ?? undefined,
        vCardPath: row.vCardPath ?? undefined,
        qrCodePath: row.qrCodePath ?? undefined,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		birthday: row.birthday ? row.birthday.toISOString() : undefined,
		emails: row.emails || [],
		phones: row.phones || [],
		addresses: row.addresses || [],
	})) as Contact[];



	return { data, total };
});
