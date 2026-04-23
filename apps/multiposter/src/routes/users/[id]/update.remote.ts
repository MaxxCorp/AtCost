import { form } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '@ac/db';
import { eq } from 'drizzle-orm';
import { listUsers } from '../list.remote';
import { readUser } from './read.remote';
import { getAuthenticatedUser, ensureAccess, parseRoles } from '$lib/server/authorization';
import { updateUserSchema } from '$lib/validations/users';
import { error } from '@sveltejs/kit';

export const updateUser = form(updateUserSchema, async (data) => {
    console.log('--- updateUser START ---');
    console.log('Data received:', JSON.stringify(data, null, 2));

    try {
        const currentUser = getAuthenticatedUser();
        console.log('User authenticated:', currentUser.id);

        const roles = parseRoles(currentUser);
        const isAdmin = roles.includes('admin');
        const isSelf = currentUser.id === data.id;

        // Strict access control: only admin or self can update.
        // If not self and not admin, must have 'users' management access.
        if (!isSelf && !isAdmin) {
            ensureAccess(currentUser, 'users');
        }

        const updateData: any = {
            name: data.name,
            email: data.email,
            claims: data.claims as any,
        };

        // Only admins can update roles.
        // If the user is an admin, we treat missing roles as an empty array (clearing roles).
        if (isAdmin) {
            updateData.roles = data.roles ?? [];
        }

        console.log('Update payload:', updateData);

        const result = await db.update(user)
            .set(updateData)
            .where(eq(user.id, data.id))
            .returning();

        if (result.length === 0) {
            console.error('No rows updated.');
            return { success: false, error: { message: 'User not found or update failed' } };
        }

        const updated = result[0];

        // Refresh lists/reads
        readUser(data.id).set(updated);
        void listUsers().refresh();

        console.log('--- updateUser SUCCESS ---');
        return { success: true, user: updated };
    } catch (err: any) {
        console.error('--- updateUser ERROR ---', err);
        return { success: false, error: { message: err.message || 'Update failed' } };
    }
});
