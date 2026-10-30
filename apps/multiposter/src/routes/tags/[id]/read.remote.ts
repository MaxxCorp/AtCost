import { query } from '$app/server';
import { db, tag, eq } from '@ac/db';
import { getAuthenticatedUser, hasAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';

export const readTag = query(v.string(), async (id: string) => {
    const user = getAuthenticatedUser();
    const isAuthorized = Boolean(
        user && (
            hasAccess(user, 'tags') ||
            hasAccess(user, 'events') ||
            hasAccess(user, 'announcements') ||
            hasAccess(user, 'contacts')
        )
    );

    const result = await db.query.tag.findFirst({
        where: eq(tag.id, id)
    });

    if (!result) return null;
    if (!isAuthorized && result.visibility !== 'external') {
        return null;
    }

    return result;
});
