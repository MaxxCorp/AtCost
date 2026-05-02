import { query } from '$app/server';
import { db } from '@ac/db';
import { tag } from '@ac/db';
import { eq, desc } from 'drizzle-orm';
import { getAuthenticatedUser } from '$lib/server/authorization';
import { PaginationSchema } from '@ac/validations';

export const listTags = query(PaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    const { page = 1, limit = 100 } = input || {};
    const offset = (page - 1) * limit;

    return db.query.tag.findMany({
        limit,
        offset,
        orderBy: [desc(tag.name)]
    });
});
