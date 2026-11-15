import { form, command, requested } from '$app/server';
import { db, goalCampaign, goalShowcaseConfig, eq } from '@ac/db';
import {
    updateGoalShowcaseConfigSchema,
    toggleGoalShowcaseSchema,
    reviewGoalCampaignSchema,
    updateGoalLifecycleStatusSchema
} from '@ac/validations';
import { getAuthenticatedUser, ensureOperator, isOperator } from '#lib/server/authorization.js';
import {
    ensureGoalsTablesAndSeed,
    settleOrReverseCampaignFinancialContributions,
} from '#lib/server/goals/service.js';
import { listGoalCampaigns, getShowcaseCampaigns } from './list.remote';
import { readGoalCampaign } from './[id]/read.remote';

export const updateShowcaseConfig = form(updateGoalShowcaseConfigSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureOperator(user);
    await ensureGoalsTablesAndSeed();

    const isActiveBool = data.isActive === true || data.isActive === 'true';
    const maxItemsNum = Number(data.maxItems) || 3;

    await db
        .update(goalShowcaseConfig)
        .set({
            isActive: isActiveBool,
            selectionMode: data.selectionMode ?? 'mixed',
            maxItems: maxItemsNum,
            title: data.title?.trim() || 'Featured Goal Campaigns',
            subtitle:
                data.subtitle?.trim() ||
                'Spotlight initiatives curated by operator choice, community momentum, and recent launches.',
            updatedByUserId: user.id,
            updatedAt: new Date()
        })
        .where(eq(goalShowcaseConfig.id, 'default'));

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
});

export const toggleCampaignShowcase = command(toggleGoalShowcaseSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureOperator(user);
    await ensureGoalsTablesAndSeed();

    await db
        .update(goalCampaign)
        .set({
            isShowcased: data.isShowcased,
            updatedAt: new Date()
        })
        .where(eq(goalCampaign.id, data.campaignId));

    try {
        await requested(listGoalCampaigns, 20).refreshAll();
    } catch {
        // ignore
    }
    void listGoalCampaigns().refresh();
    void listGoalCampaigns({}).refresh();
    void getShowcaseCampaigns().refresh();
    void getShowcaseCampaigns({}).refresh();
    void readGoalCampaign(data.campaignId).refresh();

    return { success: true };
});

export const reviewCommunityGoalCampaign = form(reviewGoalCampaignSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureOperator(user);
    await ensureGoalsTablesAndSeed();

    const approved = data.decision === 'approved';
    await db
        .update(goalCampaign)
        .set({
            approvalStatus: approved ? 'approved' : 'rejected',
            status: approved ? 'published' : 'draft',
            approvalNotes: data.approvalNotes?.trim() || null,
            approvedByUserId: user.id,
            approvedAt: new Date(),
            updatedAt: new Date()
        })
        .where(eq(goalCampaign.id, data.campaignId));

    try {
        await requested(listGoalCampaigns, 20).refreshAll();
    } catch {
        // ignore
    }
    void listGoalCampaigns().refresh();
    void listGoalCampaigns({}).refresh();
    void getShowcaseCampaigns().refresh();
    void getShowcaseCampaigns({}).refresh();
    void readGoalCampaign(data.campaignId).refresh();

    return { success: true, decision: data.decision };
});

export const updateGoalLifecycleStatus = command(
    updateGoalLifecycleStatusSchema,
    async (data) => {
        const user = getAuthenticatedUser();
        await ensureGoalsTablesAndSeed();

        const [existing] = await db
            .select()
            .from(goalCampaign)
            .where(eq(goalCampaign.id, data.campaignId))
            .limit(1);

        if (!existing) {
            throw new Error('Campaign not found');
        }

        const isOp = isOperator(user);
        if (!isOp && existing.userId !== user.id) {
            throw new Error('Forbidden: Only the campaign owner or an operator can change campaign status');
        }

        let nextStatus = data.status;
        let nextApprovalStatus = existing.approvalStatus;

        if (!isOp && nextStatus === 'published' && existing.creatorRole === 'community') {
            if (existing.approvalStatus !== 'approved') {
                nextStatus = 'pending_approval';
                nextApprovalStatus = 'pending';
            }
        } else if (isOp && nextStatus === 'published') {
            nextApprovalStatus = 'approved';
        }

        await db
            .update(goalCampaign)
            .set({
                status: nextStatus,
                approvalStatus: nextApprovalStatus,
                updatedAt: new Date()
            })
            .where(eq(goalCampaign.id, data.campaignId));

        const settlementSummary = await settleOrReverseCampaignFinancialContributions(
            data.campaignId,
            nextStatus,
            {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        );

        try {
            await requested(listGoalCampaigns, 20).refreshAll();
        } catch {
            // ignore
        }
        void listGoalCampaigns().refresh();
        void listGoalCampaigns({}).refresh();
        void getShowcaseCampaigns().refresh();
        void getShowcaseCampaigns({}).refresh();
        void readGoalCampaign(data.campaignId).refresh();

        return {
            success: true,
            status: nextStatus,
            approvalStatus: nextApprovalStatus,
            settlementSummary,
        };
    }
);
