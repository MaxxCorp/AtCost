import { command } from '$app/server';
import { db } from '@ac/db';
import { user } from '@ac/db';
import { inArray } from 'drizzle-orm';
import { listUsers } from '../list.remote';
import { getAuthenticatedUser, ensureAccess, parseRoles } from '$lib/server/authorization';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

export const deleteUser = command(v.array(v.string()), async (userIds: string[]) => {
    const currentUser = getAuthenticatedUser();
    const roles = parseRoles(currentUser);
    const isAdmin = roles.includes('admin');

    // Check if user is deleting only themselves
    const isOnlySelf = userIds.length === 1 && userIds[0] === currentUser.id;

    if (!isOnlySelf && !isAdmin) {
        // If they are deleting someone else or multiple users, they need 'users' management access
        ensureAccess(currentUser, 'users');
    }

    const result = await db.delete(user).where(inArray(user.id, userIds)).returning();

    void listUsers().refresh();

    return result;
});

