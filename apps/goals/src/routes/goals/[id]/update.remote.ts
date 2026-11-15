import { form, requested } from '$app/server';
import { db, goalCampaign, eq } from '@ac/db';
import { updateGoalCampaignSchema, type GoalPluginConfig } from '@ac/validations';
import { getAuthenticatedUser, ensureAccess, isOperator } from '#lib/server/authorization.js';
import { assignTagsToGoalCampaign } from '#lib/server/tags/service.js';
import {
    ensureGoalsTablesAndSeed,
    syncGoalCampaignStages,
    syncGoalCampaignLocations,
    settleOrReverseCampaignFinancialContributions,
} from '#lib/server/goals/service.js';
import { getContributionPlugin } from '#lib/plugins/registry.js';
import { listGoalCampaigns, getShowcaseCampaigns } from '../list.remote';
import { readGoalCampaign } from './read.remote';

export const updateGoalCampaign = form(updateGoalCampaignSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'goals');
    await ensureGoalsTablesAndSeed();

    const [existing] = await db
        .select()
        .from(goalCampaign)
        .where(eq(goalCampaign.id, data.id))
        .limit(1);

    if (!existing) {
        throw new Error('Campaign not found');
    }

    const isOp = isOperator(user);
    if (!isOp && existing.userId !== user.id) {
        throw new Error('Forbidden: Only the campaign owner or an operator can edit this campaign');
    }

    const contribType = data.contributionType ?? existing.contributionType ?? 'vote';
    const plugin = getContributionPlugin(contribType);

    let pluginConfig: GoalPluginConfig = {
        ...(existing.pluginConfig ?? {}),
        ...plugin.defaultConfig
    };
    if (data.pluginConfigJson) {
        try {
            const parsed = JSON.parse(data.pluginConfigJson);
            if (parsed && typeof parsed === 'object') {
                pluginConfig = { ...pluginConfig, ...parsed };
            }
        } catch {
            // ignore
        }
    }

    let tagNames: string[] = [];
    if (data.tags) {
        try {
            const parsed = JSON.parse(data.tags);
            if (Array.isArray(parsed)) tagNames = parsed.map(String);
        } catch {
            tagNames = data.tags
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        }
    }

    const primaryTargetNum = Math.max(
        1,
        Number(data.primaryTarget) || existing.primaryTarget || plugin.defaultPrimaryTarget || 100
    );

    let status = existing.status;
    let approvalStatus = existing.approvalStatus;

    if (data.status) {
        if (isOp) {
            status = data.status;
            if (status === 'published') approvalStatus = 'approved';
        } else if (data.status === 'published' && existing.creatorRole === 'community') {
            if (existing.approvalStatus !== 'approved') {
                status = 'pending_approval';
                approvalStatus = 'pending';
            } else {
                status = 'published';
            }
        } else {
            status = data.status;
        }
    }

    const isShowcasedBool = isOp
        ? data.isShowcased === true || data.isShowcased === 'true'
        : existing.isShowcased;

    await db
        .update(goalCampaign)
        .set({
            title: data.title.trim(),
            creatorName: data.creatorName?.trim() || existing.creatorName,
            executiveSummary: data.executiveSummary.trim(),
            description: data.description.trim(),
            heroImage: data.heroImage?.trim() || null,
            status,
            approvalStatus,
            contributionType: contribType,
            primaryTarget: primaryTargetNum,
            unitLabel: data.unitLabel?.trim() || plugin.defaultUnitLabel,
            currency: (data.currency?.trim() || 'EUR').toUpperCase(),
            pluginConfig,
            isShowcased: isShowcasedBool,
            startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
            endDate: data.endDate ? new Date(data.endDate) : null,
            updatedAt: new Date()
        })
        .where(eq(goalCampaign.id, data.id));

    await syncGoalCampaignStages(
        data.id,
        Number(existing.currentAmount || 0),
        primaryTargetNum,
        data.primaryGoalTitle?.trim() || 'Primary Goal',
        data.primaryGoalDescription?.trim() || '',
        data.stretchGoalsJson
    );
    await syncGoalCampaignLocations(data.id, data.locationIds);
    await assignTagsToGoalCampaign(data.id, tagNames, user.id);

    if (status !== existing.status) {
        await settleOrReverseCampaignFinancialContributions(data.id, status, {
            id: user.id,
            name: user.name,
            email: user.email,
        });
    }

    try {
        await requested(listGoalCampaigns, 20).refreshAll();
    } catch {
        // ignore
    }
    void listGoalCampaigns().refresh();
    void listGoalCampaigns({}).refresh();
    void getShowcaseCampaigns().refresh();
    void getShowcaseCampaigns({}).refresh();
    void readGoalCampaign(data.id).refresh();

    return {
        success: true,
        id: data.id,
        status,
        approvalStatus
    };
});
