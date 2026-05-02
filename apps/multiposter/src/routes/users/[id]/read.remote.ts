import { query } from '$app/server';
import { db } from '@ac/db';
import { user } from '@ac/db';
import { eq } from 'drizzle-orm';
import type { User } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

/**
 * Query: Read a user by ID
 */
export const readUser = query(v.string(), async (userId: string): Promise<User | null> => {
    const currentUser = getAuthenticatedUser();
    if (currentUser.id !== userId) {
        ensureAccess(currentUser, 'users');
    }

    const [result] = await db.select().from(user).where(eq(user.id, userId));
    return result || null;
});
