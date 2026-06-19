import * as v from 'valibot';
import { query } from '$app/server';
import { location } from '@ac/db';
import type { Location as DbLocation } from '@ac/db';
import { db } from '@ac/db';
import { desc } from '@ac/db';
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

	const { page = 1, limit = 50, search = '', city, associatedWith, sortField = 'updatedAt', sortOrder = 'desc' } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select({ id: location.id }).from(location).$dynamic();
	
	const conditions = [];

    if (associatedWith) {
        const { eq } = await import('@ac/db');
        if (associatedWith.type === 'event') {
            const { eventLocation } = await import('@ac/db');
            baseQuery = baseQuery.innerJoin(eventLocation, eq(location.id, eventLocation.locationId)) as any;
            conditions.push(eq(eventLocation.eventId, associatedWith.id));
        }
    }

	if (search) {
		const { ilike, or } = await import('@ac/db');
		conditions.push(or(
			ilike(location.name, `%${search}%`),
			ilike(location.city, `%${search}%`)
		));
	}

	if (city) {
		const { inArray } = await import('@ac/db');
		const cities = Array.isArray(city) ? city : [city];
		if (cities.length > 0) {
			conditions.push(inArray(location.city, cities as any));
		}
	}

	if (conditions.length > 0) {
		const { and } = await import('@ac/db');
		baseQuery = baseQuery.where(and(...conditions)) as any;
	}

	const { sql } = await import('@ac/db');
	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
	const total = Number(countResult[0]?.count || 0);

	if (total === 0) {
		return { data: [], total: 0 };
	}

    let orderField: any = location.updatedAt;
	if (sortField === 'name') orderField = location.name;
	else if (sortField === 'createdAt') orderField = location.createdAt;

	const orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;

	const { inArray } = await import('@ac/db');
	const paginatedIdsQuery = baseQuery.orderBy(orderExpression).limit(limit).offset(offset);
	const paginatedIds = (await paginatedIdsQuery).map((r) => r.id);

	if (paginatedIds.length === 0) {
		return { data: [], total };
	}

	const rawResults = await db.query.location.findMany({
		where: inArray(location.id, paginatedIds),
		with: { user: true },
		orderBy: [orderExpression]
	});

	const data = rawResults.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));

	return { data, total };
});
