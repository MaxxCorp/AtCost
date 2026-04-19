import { form } from '$app/server';
import { db, user } from '$lib/server/db';
import { eq } from '$lib/server/db';
import { listUsers } from '../list.remote';
import { readUser } from './read.remote';
import { getAuthenticatedUser, ensureAccess, parseRoles } from '$lib/server/authorization';
import { updateUserSchema } from '@ac/validations';

import { error } from '@sveltejs/kit';

export const updateUser = form(updateUserSchema, async (data) => {
    try {
        const currentUser = getAuthenticatedUser();
        ensureAccess(currentUser, 'users');

        // Strict access control: only admin or self can update
        const roles = parseRoles(currentUser);
        const isAdmin = roles.includes('admin');
        if (!isAdmin && currentUser.id !== data.id) {
            error(403, 'You do not have permission to update this user');
        }

        const updateData: any = {
            name: data.name,
            email: data.email,
            claims: data.claims,
        };

        // Only admins can update roles.
        if (isAdmin) {
            updateData.roles = data.roles ?? [];
        }

        const result = await db.update(user)
            .set(updateData)
            .where(eq(user.id, data.id))
            .returning();

        if (result.length === 0) {
            return { success: false, error: { message: 'User not found or update failed' } };
        }

        const updated = result[0];

        // Refresh lists/reads (non-blocking)
        readUser(data.id).refresh();
        listUsers().refresh();

        return { success: true, user: updated };
    } catch (err: any) {
        console.error('--- updateUser ERROR ---', err);
        return { success: false, error: { message: err.message || 'Update failed' } };
    }
});
