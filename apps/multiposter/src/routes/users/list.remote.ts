import * as v from 'valibot';
import { type InferSelectModel } from 'drizzle-orm';
import { query } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '@ac/db';
import { ensureAccess, getAuthenticatedUser, parseRoles } from '$lib/server/authorization';
import { desc } from 'drizzle-orm';

export type User = Omit<InferSelectModel<typeof user>, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
};

/**
 * Query: List all users (Admin only)
 */
export const listUsers = query(v.undefined_(), async (): Promise<User[]> => {
    const currentUser = getAuthenticatedUser();
    const roles = parseRoles(currentUser);
    if (!roles.includes('admin')) {
        throw new Error('Forbidden: Admin access only');
    }

    const rawResults = await db
        .select()
        .from(user)
        .orderBy(desc(user.createdAt));

    return rawResults.map(row => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
    }));
});
