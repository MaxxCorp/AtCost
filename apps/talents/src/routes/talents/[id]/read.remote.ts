import { query } from '$app/server';
import { db, talent, eq, decryptContactRecord } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { cached, cacheKeys } from '#lib/server/cache/index.js';

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
                userAssociations: { with: { user: true } },
                tags: {
                    with: {
                        tag: {
                            with: {
                                category: true
                            }
                        }
                    }
                }
            }
        });

        if (!result) return null;

        const decryptedContact = result.contact ? await decryptContactRecord(result.contact) : null;
        return {
            ...result,
            contact: decryptedContact
        };
    });
});
