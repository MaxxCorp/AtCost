import { query } from '$app/server';
import { db, user } from '$lib/server/db';
import { getOptionalUser, parseRoles } from '$lib/server/authorization';
import { desc, type InferSelectModel } from '$lib/server/db';
import * as v from 'valibot';

export type User = InferSelectModel<typeof user>;

export const listUsers = query(v.undefined_(), async (): Promise<User[]> => {
    try {
        const currentUser = getOptionalUser();
        if (!currentUser) throw new Error('Unauthorized');
        
        const roles = parseRoles(currentUser);
        if (!roles.includes('admin')) {
            throw new Error('Forbidden: Admin access only');
        }

        const rows = await db
            .select()
            .from(user)
            .orderBy(desc(user.createdAt));
            
        return rows as User[];
    } catch (error: any) {
        console.error(`[listUsers] Error: ${error.message}`);
        throw error;
    }
});
