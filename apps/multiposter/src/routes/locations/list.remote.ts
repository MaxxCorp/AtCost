import * as v from 'valibot';
import { query } from '$app/server';
import { location } from '@ac/db';
import type { Location as DbLocation } from '@ac/db';
import { db } from '$lib/server/db';
import { desc } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

/**
 * Location interface matching the database schema, with dates serialized to strings
 */
import { LocationPaginationSchema as PaginationSchema, type Location, type PaginatedResult } from '@ac/validations';


/**
 * Query: List all locations
 */
export const listLocations = query(PaginationSchema, async (input): Promise<PaginatedResult<Location>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'locations');

	const { page = 1, limit = 50, search = '', city } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select({ id: location.id }).from(location).$dynamic();
	
	const conditions = [];
	if (search) {
		const { ilike, or } = await import('drizzle-orm');
		conditions.push(or(
			ilike(location.name, `%${search}%`),
			ilike(location.city, `%${search}%`)
		));
	}

	if (city) {
		const { inArray } = await import('drizzle-orm');
		const cities = Array.isArray(city) ? city : [city];
		if (cities.length > 0) {
			conditions.push(inArray(location.city, cities as any));
		}
	}

	if (conditions.length > 0) {
		const { and } = await import('drizzle-orm');
		baseQuery = baseQuery.where(and(...conditions)) as any;
	}

	const { sql } = await import('drizzle-orm');
	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
	const total = Number(countResult[0]?.count || 0);

	if (total === 0) {
		return { data: [], total: 0 };
	}

	const { inArray } = await import('drizzle-orm');
	const paginatedIdsQuery = baseQuery.orderBy(desc(location.createdAt)).limit(limit).offset(offset);
	const paginatedIds = (await paginatedIdsQuery).map((r) => r.id);

	if (paginatedIds.length === 0) {
		return { data: [], total };
	}

	const rawResults = await db
		.select()
		.from(location)
		.where(inArray(location.id, paginatedIds))
		.orderBy(desc(location.createdAt));

	const data = rawResults.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));

	return { data, total };
});
