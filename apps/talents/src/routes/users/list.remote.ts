import { query } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '@ac/db';
import { getOptionalUser, parseRoles } from '$lib/server/authorization';
import { desc, type InferSelectModel } from 'drizzle-orm';


export type User = InferSelectModel<typeof user>;



export const listUsers = query(async (): Promise<User[]> => {
    try {
        const currentUser = getOptionalUser();
        if (!currentUser) throw new Error('Unauthorized');
        
        const roles = parseRoles(currentUser);
        if (!roles.includes('admin')) {
            throw new Error('Forbidden: Admin access only');
        }

        return await db
            .select()
            .from(user)
            .orderBy(desc(user.createdAt));
    } catch (error: any) {
        console.error(`[listUsers] Error: ${error.message}`);
        throw error;
    }
});
