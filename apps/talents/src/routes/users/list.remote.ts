import { query } from '$app/server';
import { db, user } from '@ac/db';
import { getOptionalUser, parseRoles } from '$lib/server/authorization';
import { desc, type InferSelectModel, sql, and, or, ilike } from '@ac/db';
import * as v from 'valibot';

import { UserPaginationSchema as PaginationSchema, type User, type PaginatedResult } from '@ac/validations';


export const listUsers = query(PaginationSchema, async (input): Promise<PaginatedResult<User>> => {
    try {
        const currentUser = getOptionalUser();
        if (!currentUser) throw new Error('Unauthorized');
        
        const roles = parseRoles(currentUser);
        if (!roles.includes('admin')) {
            throw new Error('Forbidden: Admin access only');
        }

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
            const roles = Array.isArray(role) ? role : [role];
            if (roles.length > 0) {
                // For JSONB roles, we check if any of the provided roles are in the array
                conditions.push(sql`${user.roles} ?| ${roles}`);
            }
        }

        if (conditions.length > 0) {
            baseQuery = baseQuery.where(and(...conditions as any)) as any;
        }

        const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
        const total = Number(countResult.rows[0]?.count || 0);

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
