import { query } from '$app/server';
import { db } from '$lib/server/db';
import { tag } from '@ac/db';
import { desc } from 'drizzle-orm';
import { PaginationSchema } from '@ac/validations';

export const listTags = query(PaginationSchema, async (input) => {

    const { page = 1, limit = 100 } = input || {};
    const offset = (page - 1) * limit;

    return db.query.tag.findMany({
        limit,
        offset,
        orderBy: [desc(tag.name)]
    });
});
