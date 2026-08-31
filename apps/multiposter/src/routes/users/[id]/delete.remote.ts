import { command } from '$app/server';
import { db, user, session, account, inArray } from '@ac/db';
import { listUsers } from '../list.remote';
import { getAuthenticatedUser, ensureAccess, parseRoles } from '$lib/server/authorization';
import { deleteUserSchema } from '@ac/validations';

export const deleteUser = command(deleteUserSchema, async (userIds: string[]) => {
    const currentUser = getAuthenticatedUser();
    const roles = parseRoles(currentUser);
    const isAdmin = roles.includes('admin');

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return { success: true, count: 0, ids: [] };
    }

    // Check if user is deleting only themselves
    const isOnlySelf = userIds.length === 1 && userIds[0] === currentUser.id;

    if (!isOnlySelf && !isAdmin) {
        // If they are deleting someone else or multiple users, they need 'users' management access
        ensureAccess(currentUser, 'users');
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

