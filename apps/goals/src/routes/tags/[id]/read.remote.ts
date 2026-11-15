import { query } from '$app/server';
import { db, tag, eq } from '@ac/db';
import * as v from 'valibot';

export const readTag = query(v.string(), async (id: string) => {
    const result = await db.query.tag.findFirst({
        where: eq(tag.id, id),
        with: {
            category: true
        }
    });

    if (!result) return null;

    return {
        ...result,
        createdAt: result.createdAt.toISOString()
    };
});
