import { query } from '$app/server';
import { db, user } from '$lib/server/db';
import { getOptionalUser, parseRoles } from '$lib/server/authorization';
import { desc, type InferSelectModel, sql, and, or, ilike } from '$lib/server/db';
import * as v from 'valibot';

import { PaginationSchema, type User, type PaginatedResult } from '@ac/validations';


export const listUsers = query(PaginationSchema, async (input): Promise<PaginatedResult<User>> => {
    try {
        const currentUser = getOptionalUser();
        if (!currentUser) throw new Error('Unauthorized');
        
        const roles = parseRoles(currentUser);
        if (!roles.includes('admin')) {
            throw new Error('Forbidden: Admin access only');
        }

        const { page = 1, limit = 50, search = '' } = input || {};
        const offset = (page - 1) * limit;

        let baseQuery = db.select().from(user).$dynamic();
        
        const conditions = [];
        if (search) {
            conditions.push(or(
                ilike(user.name, `%${search}%`),
                ilike(user.email, `%${search}%`)
            ));
        }

        if (conditions.length > 0) {
            baseQuery = baseQuery.where(and(...conditions as any)) as any;
        }

        const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
        const total = Number(countResult[0]?.count || 0);

        const rawResults = await baseQuery
            .orderBy(desc(user.createdAt))
            .limit(limit)
            .offset(offset);

        const data = rawResults.map((row: any) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString()
        }));

            
        return { data: data as User[], total };

    } catch (error: any) {
        console.error(`[listUsers] Error: ${error.message}`);
        throw error;
    }
});
