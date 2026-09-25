import { query } from '$app/server';
import { db, talent, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { cached, cacheKeys } from '$lib/server/cache';

export const readTalent = query(v.string(), async (id: string) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');
    
    return cached(cacheKeys.talent(id), 600, async () => {
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
});
