import { query } from '$app/server';
import { db, talent, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const readTalent = query(v.string(), async (id: string) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');
    
    // Inlined logic using Relational Queries for "easier reasoning"
    const result = await db.query.talent.findFirst({
        where: eq(talent.id, id),
        with: {
            contact: {
                with: {
                    emails: true,
                    phones: true,
                    addresses: true,
                    tags: { with: { tag: true } },
                    locationAssociations: { with: { location: true } }
                }
            },
            timelineEntries: true,
            userAssociations: { with: { user: true } }
        }
    });

    return result || null;
});
