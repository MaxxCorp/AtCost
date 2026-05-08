import { command } from '$app/server';
import { db, user } from '@ac/db';
import { inArray } from '@ac/db';
import { listUsers } from '../list.remote';
import { getAuthenticatedUser, ensureAccess, parseRoles } from '$lib/server/authorization';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

export const deleteUser = command(v.array(v.string()), async (userIds) => {
    const currentUser = getAuthenticatedUser();
    ensureAccess(currentUser, 'users');

    // Strict access control: only admin or self can delete
    const roles = parseRoles(currentUser);
    if (!roles.includes('admin')) {
        // Non-admins can only delete themselves
        if (userIds.some(id => id !== currentUser.id)) {
            error(403, 'You do not have permission to delete other users');
        }
    }

    const result = await db.delete(user).where(inArray(user.id, userIds)).returning();
    listUsers().refresh();

    return result;
});
