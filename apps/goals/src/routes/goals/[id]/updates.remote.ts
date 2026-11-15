import { form, requested } from '$app/server';
import { db, goalCampaign, goalUpdate, eq } from '@ac/db';
import { createGoalUpdateSchema } from '@ac/validations';
import { getAuthenticatedUser, isOperator } from '#lib/server/authorization.js';
import {
    ensureGoalsTablesAndSeed,
    ensureEncryptedUserContact,
    getGoalCampaignById
} from '#lib/server/goals/service.js';
import { listGoalCampaigns, getShowcaseCampaigns } from '../list.remote';
import { readGoalCampaign } from './read.remote';

export const postGoalUpdate = form(createGoalUpdateSchema, async (data) => {
    const user = getAuthenticatedUser();
    await ensureGoalsTablesAndSeed();

    const [campaign] = await db
        .select()
        .from(goalCampaign)
        .where(eq(goalCampaign.id, data.campaignId))
        .limit(1);

    if (!campaign) {
        throw new Error('Campaign not found');
    }

    const isOp = isOperator(user);
    if (!isOp && campaign.userId !== user.id) {
        throw new Error('Forbidden: Only the campaign owner or an operator can post campaign updates');
    }

    const isMilestoneBool = data.isMilestone === true || data.isMilestone === 'true';

    const segregatedAuthor = await ensureEncryptedUserContact(
        {
            id: user.id,
            name: user.name,
            email: user.email,
            role: 'Campaign Update Author',
        },
        {
            campaignId: data.campaignId,
            campaignRole: 'author',
        }
    );

    await db.insert(goalUpdate).values({
        campaignId: data.campaignId,
        authorId: user.id,
        contactId: segregatedAuthor.contactId,
        authorName: segregatedAuthor.publicDisplayName || 'Campaign Owner',
        title: data.title.trim(),
        content: data.content.trim(),
        isMilestone: isMilestoneBool
    });

    await db
        .update(goalCampaign)
        .set({ updatedAt: new Date() })
        .where(eq(goalCampaign.id, data.campaignId));

    const updated = await getGoalCampaignById(data.campaignId, {
        incrementVisit: false,
        isAuthorizedOperator: isOp,
        currentUserId: user.id
    });

    try {
        await requested(listGoalCampaigns, 20).refreshAll();
    } catch {
        // ignore
    }
    void listGoalCampaigns().refresh();
    void listGoalCampaigns({}).refresh();
    void getShowcaseCampaigns().refresh();
    void getShowcaseCampaigns({}).refresh();
    if (updated) {
        readGoalCampaign(data.campaignId).set(updated);
    } else {
        void readGoalCampaign(data.campaignId).refresh();
    }

    return {
        success: true,
        campaignId: data.campaignId
    };
});
