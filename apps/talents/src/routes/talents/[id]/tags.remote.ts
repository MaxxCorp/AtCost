import { command } from '$app/server';
import { db, talentTag, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { delCache, cacheKeys } from '#lib/server/cache/index.js';
import { readTalent } from './read.remote.js';

export const updateTalentTagsAction = command(
    v.object({
        talentId: v.pipe(v.string(), v.uuid()),
        tagIds: v.array(v.pipe(v.string(), v.uuid())),
    }),
    async ({ talentId, tagIds }) => {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'talents');

        // Delete existing talent tags
        await db.delete(talentTag).where(eq(talentTag.talentId, talentId));

        // Insert new talent tags
        if (tagIds.length > 0) {
            await db.insert(talentTag).values(
                tagIds.map((tagId) => ({ talentId, tagId }))
            );
        }

        await delCache(cacheKeys.talent(talentId));
        void readTalent(talentId).refresh();

        return { success: true };
    }
);
