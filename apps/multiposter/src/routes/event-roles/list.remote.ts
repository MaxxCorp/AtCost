import { query } from '$app/server';
import { db, eventRole, asc } from '@ac/db';
import { getAuthenticatedUser } from '#lib/server/authorization.js';
import { type EventRole, eventRolePaginationSchema } from '@ac/validations';

export const listEventRoles = query(eventRolePaginationSchema, async (params): Promise<{ data: EventRole[]; total: number }> => {
    const user = getAuthenticatedUser();
    // Multi-user app: roles are workspace-shared
    const allRoles = await db.query.eventRole.findMany({
        orderBy: [asc(eventRole.name)]
    });

    let filtered = allRoles;
    if (params?.search) {
        const q = params.search.toLowerCase().trim();
        filtered = filtered.filter(r => r.name.toLowerCase().includes(q));
    }

    const data: EventRole[] = filtered.map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        description: r.description,
        isDefault: r.isDefault,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    }));

    return {
        data,
        total: data.length
    };
});
