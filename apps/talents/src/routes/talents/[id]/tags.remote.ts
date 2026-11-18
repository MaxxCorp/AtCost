import { command, requested } from '$app/server';
import { db, talentTag, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { invalidateTalent } from '#lib/server/cache/index.js';
import { readTalent } from './read.remote.js';
import { listTalents } from '../list.remote.js';

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

        await invalidateTalent(talentId);
        void readTalent(talentId).refresh();
        try { await requested(listTalents, 20).refreshAll(); } catch { /* ignore */ }
        void listTalents().refresh();
        void listTalents({}).refresh();

        return { success: true };
    }
);
