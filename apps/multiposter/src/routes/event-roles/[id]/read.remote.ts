import { query } from '$app/server';
import { db, eventRole, eq } from '@ac/db';
import * as v from 'valibot';

export const readEventRole = query(v.string(), async (id) => {
    const role = await db.query.eventRole.findFirst({
        where: eq(eventRole.id, id)
    });
    if (!role) return null;
    return {
        id: role.id,
        name: role.name,
        color: role.color,
        description: role.description,
        isDefault: role.isDefault,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
    };
});
