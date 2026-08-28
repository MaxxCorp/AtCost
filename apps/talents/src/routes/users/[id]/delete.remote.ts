import { command } from '$app/server';
import { db, user, session, account, inArray } from '@ac/db';
import { listUsers } from '../list.remote';
import { getAuthenticatedUser, ensureAccess, parseRoles } from '$lib/server/authorization';
import { deleteUserSchema } from '@ac/validations';
import { error } from '@sveltejs/kit';

export const deleteUser = command(deleteUserSchema, async (userIds: string[]) => {
    const currentUser = getAuthenticatedUser();
    ensureAccess(currentUser, 'users');

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return { success: true, count: 0, ids: [] };
    }

    // Strict access control: only admin or self can delete
    const roles = parseRoles(currentUser);
    if (!roles.includes('admin')) {
        // Non-admins can only delete themselves
        if (userIds.some(id => id !== currentUser.id)) {
            error(403, 'You do not have permission to delete other users');
        }
    }

    // Clean up auth sessions and accounts for deleted users
    await db.delete(session).where(inArray(session.userId, userIds));
    await db.delete(account).where(inArray(account.userId, userIds));

    const result = await db.delete(user).where(inArray(user.id, userIds)).returning();
    const deletedIds = result.map(u => u.id);

    try {
        await listUsers().refresh();
    } catch (e) {
        console.warn('[deleteUser] listUsers().refresh() ignored error:', e);
    }

    return { success: true, count: result.length, ids: deletedIds };
});
