import { command, requested } from '$app/server';
import { db, eventRole, eq } from '@ac/db';
import { getAuthenticatedUser } from '#lib/server/authorization.js';
import { updateEventRoleSchema } from '@ac/validations';
import { listEventRoles } from '../list.remote.js';
import { readEventRole } from './read.remote.js';

export const updateEventRole = command(updateEventRoleSchema, async (data) => {
    const user = getAuthenticatedUser();
    if (!user) throw new Error('Unauthorized');

    const [updated] = await db.update(eventRole)
        .set({
            name: data.name.trim(),
            color: data.color || 'blue',
            description: data.description?.trim() || null,
            updatedAt: new Date(),
        })
        .where(eq(eventRole.id, data.id))
        .returning();

    if (updated) {
        try {
            await requested(listEventRoles, 20).refreshAll();
        } catch {
            // no client requested updates
        }
        void listEventRoles().refresh();
        void listEventRoles({}).refresh();
        void readEventRole(data.id).refresh();
    }

    return {
        id: updated.id,
        name: updated.name,
        color: updated.color,
        description: updated.description,
        isDefault: updated.isDefault,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
    };
});
