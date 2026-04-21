import { query } from '$app/server';
import { db } from '$lib/server/db';
import { tag } from '@ac/db';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '$lib/server/authorization';
import * as v from 'valibot';

export const readTag = query(v.string(), async (id: string) => {
    getAuthenticatedUser();
    
    return await db.query.tag.findFirst({
        where: eq(tag.id, id)
    }) || null;
});
