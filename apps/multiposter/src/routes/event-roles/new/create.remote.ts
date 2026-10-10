import { command, requested } from '$app/server';
import { db, eventRole } from '@ac/db';
import { getAuthenticatedUser } from '#lib/server/authorization.js';
import { createEventRoleSchema } from '@ac/validations';
import { listEventRoles } from '../list.remote.js';

export const createEventRole = command(createEventRoleSchema, async (data) => {
    const user = getAuthenticatedUser();
    if (!user) throw new Error('Unauthorized');

    const [created] = await db.insert(eventRole).values({
        name: data.name.trim(),
        color: data.color || 'blue',
        description: data.description?.trim() || null,
        isDefault: false,
    }).returning();

    try {
        await requested(listEventRoles, 20).refreshAll();
    } catch {
        // no client requested updates
    }
    void listEventRoles().refresh();
    void listEventRoles({}).refresh();

    return {
        id: created.id,
        name: created.name,
        color: created.color,
        description: created.description,
        isDefault: created.isDefault,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
    };
});
