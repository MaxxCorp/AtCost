import { query } from '$app/server';
import { db, user } from '$lib/server/db';
import { eq } from '$lib/server/db';
import type { User } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

/**
 * Query: Read a user by ID
 */
export const readUser = query(v.string(), async (userId): Promise<User | null> => {
    const currentUser = getAuthenticatedUser();
    ensureAccess(currentUser, 'users');

    const [result] = await db.select().from(user).where(eq(user.id, userId));
    return (result as User) || null;
});
