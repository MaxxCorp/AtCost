import * as v from 'valibot';
import { type InferSelectModel } from '@ac/db';
import { query } from '$app/server';
import { db, user, desc, asc, ilike, or, and, sql } from '@ac/db';
import { ensureAccess, getAuthenticatedUser, parseRoles } from '$lib/server/authorization';

import { UserPaginationSchema as PaginationSchema, parseFilterValue, type User, type PaginatedResult } from '@ac/validations';

/**
 * Query: List all users
 */
export const listUsers = query(PaginationSchema, async (input): Promise<PaginatedResult<User>> => {
    const currentUser = getAuthenticatedUser();
    ensureAccess(currentUser, 'users');

    const { page = 1, limit = 50, search = '', role } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(user).$dynamic();
    
    const conditions = [];
    if (search) {
        conditions.push(or(
            ilike(user.name, `%${search}%`),
            ilike(user.email, `%${search}%`)
        ));
    }

    if (role) {
        const { include, exclude } = parseFilterValue(role);
        if (include.length > 0) {
            conditions.push(sql`${user.roles} ?| array[${sql.join(include.map(r => sql`${r}`), sql`, `)}]`);
        }
        if (exclude.length > 0) {
            conditions.push(sql`NOT (${user.roles} ?| array[${sql.join(exclude.map(r => sql`${r}`), sql`, `)}])`);
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

    const { sortField = 'createdAt', sortOrder = 'desc' } = input || {};
    let orderField: any = user.createdAt;
    if (sortField === 'name') orderField = user.name;
    else if (sortField === 'email') orderField = user.email;

    const orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;

    const rawResults = await baseQuery
        .orderBy(orderExpression)
        .limit(limit)
        .offset(offset);

    const data = rawResults.map(row => ({
        ...row,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date(row.updatedAt).toISOString()
    }));

    return { data, total };
});
