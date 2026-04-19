import * as v from 'valibot';
import { type InferSelectModel } from 'drizzle-orm';
import { query } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '@ac/db';
import { ensureAccess, getAuthenticatedUser, parseRoles } from '$lib/server/authorization';
import { desc, ilike, or, and, sql } from 'drizzle-orm';

import { PaginationSchema, type User, type PaginatedResult } from '@ac/validations';


/**
 * Query: List all users (Admin only)
 */
export const listUsers = query(PaginationSchema, async (input): Promise<PaginatedResult<User>> => {
    const currentUser = getAuthenticatedUser();
    const roles = parseRoles(currentUser);
    if (!roles.includes('admin')) {
        throw new Error('Forbidden: Admin access only');
    }

    const { page = 1, limit = 50, search = '' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(user).$dynamic();
    
    const conditions = [];
    if (search) {
        const { ilike, or } = await import('drizzle-orm');
        conditions.push(or(
            ilike(user.name, `%${search}%`),
            ilike(user.email, `%${search}%`)
        ));
    }

    if (conditions.length > 0) {
        const { and } = await import('drizzle-orm');
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const { sql } = await import('drizzle-orm');
    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const rawResults = await baseQuery
        .orderBy(desc(user.createdAt))
        .limit(limit)
        .offset(offset);

    const data = rawResults.map(row => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
    }));

    return { data, total };
});
