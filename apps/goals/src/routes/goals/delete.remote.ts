import { command, requested } from '$app/server';
import * as v from 'valibot';
import { db, goalCampaign, inArray } from '@ac/db';
import { getAuthenticatedUser, ensureAccess, isOperator } from '#lib/server/authorization.js';
import { listGoalCampaigns, getShowcaseCampaigns } from './list.remote';

export const deleteGoalCampaigns = command(
    v.object({ ids: v.array(v.string()) }),
    async ({ ids }) => {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'goals');

        if (!ids || ids.length === 0) return { success: true };

        if (!isOperator(user)) {
            const rows = await db
                .select({ id: goalCampaign.id, userId: goalCampaign.userId })
                .from(goalCampaign)
                .where(inArray(goalCampaign.id, ids));
            for (const row of rows) {
                if (row.userId !== user.id) {
                    throw new Error('Forbidden: Only the campaign owner or an operator can delete this campaign');
                }
            }
        }

        await db.delete(goalCampaign).where(inArray(goalCampaign.id, ids));

        try {
            await requested(listGoalCampaigns, 20).refreshAll();
        } catch {
            // ignore
        }
        void listGoalCampaigns().refresh();
        void listGoalCampaigns({}).refresh();
        void getShowcaseCampaigns().refresh();
        void getShowcaseCampaigns({}).refresh();
        return { success: true };
    }
);
