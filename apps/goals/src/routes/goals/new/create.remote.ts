import { form, requested } from '$app/server';
import { db, goalCampaign } from '@ac/db';
import { createGoalCampaignSchema, type GoalPluginConfig } from '@ac/validations';
import { getAuthenticatedUser, ensureAccess, isOperator } from '#lib/server/authorization.js';
import { assignTagsToGoalCampaign } from '#lib/server/tags/service.js';
import {
    ensureGoalsTablesAndSeed,
    ensureEncryptedUserContact,
    syncGoalCampaignStages,
    syncGoalCampaignLocations
} from '#lib/server/goals/service.js';
import { getContributionPlugin } from '#lib/plugins/registry.js';
import { listGoalCampaigns, getShowcaseCampaigns } from '../list.remote';

function slugifyTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export const createGoalCampaign = form(createGoalCampaignSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'goals');
    await ensureGoalsTablesAndSeed();

    const isOp = isOperator(user);
    const contribType = data.contributionType ?? 'vote';
    const plugin = getContributionPlugin(contribType);

    let pluginConfig: GoalPluginConfig = { ...plugin.defaultConfig };
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

    const primaryTargetNum = Math.max(1, Number(data.primaryTarget) || plugin.defaultPrimaryTarget || 100);
    const submitAction = data.submitAction ?? 'publish';

    let status: 'draft' | 'pending_approval' | 'published' = 'draft';
    let approvalStatus: 'not_required' | 'pending' | 'approved' | 'rejected' = 'not_required';
    const creatorRole: 'operator' | 'community' = isOp ? 'operator' : 'community';

    if (submitAction === 'publish') {
        if (isOp) {
            status = 'published';
            approvalStatus = 'not_required';
        } else {
            status = 'pending_approval';
            approvalStatus = 'pending';
        }
    } else {
        status = 'draft';
        approvalStatus = isOp ? 'not_required' : 'pending';
    }

    const isShowcasedBool =
        isOp && (data.isShowcased === true || data.isShowcased === 'true');

    const slug = `${slugifyTitle(data.title)}-${Math.random().toString(36).slice(2, 6)}`;

    const segregatedCreator = await ensureEncryptedUserContact(
        {
            id: user.id,
            name: data.creatorName?.trim() || user.name,
            email: user.email,
            role: isOp ? 'Campaign Operator' : 'Community Campaign Creator',
        },
        {
            campaignRole: 'creator',
        }
    );

    const [created] = await db
        .insert(goalCampaign)
        .values({
            userId: user.id,
            contactId: segregatedCreator.contactId,
            creatorName: data.creatorName?.trim() || segregatedCreator.publicDisplayName,
            creatorRole,
            slug,
            title: data.title.trim(),
            executiveSummary: data.executiveSummary.trim(),
            description: data.description.trim(),
            heroImage: data.heroImage?.trim() || null,
            contributionType: contribType,
            primaryTarget: primaryTargetNum,
            currentAmount: 0,
            contributionsCount: 0,
            visitsCount: 0,
            currency: (data.currency?.trim() || 'EUR').toUpperCase(),
            unitLabel: data.unitLabel?.trim() || plugin.defaultUnitLabel,
            status,
            approvalStatus,
            approvedByUserId: isOp && status === 'published' ? user.id : null,
            approvedAt: isOp && status === 'published' ? new Date() : null,
            isShowcased: isShowcasedBool,
            showcaseOrder: 0,
            startDate: data.startDate ? new Date(data.startDate) : new Date(),
            endDate: data.endDate ? new Date(data.endDate) : null,
            pluginConfig
        })
        .returning();

    await syncGoalCampaignStages(
        created.id,
        0,
        primaryTargetNum,
        data.primaryGoalTitle?.trim() || 'Primary Goal',
        data.primaryGoalDescription?.trim() || '',
        data.stretchGoalsJson
    );
    await syncGoalCampaignLocations(created.id, data.locationIds);
    await assignTagsToGoalCampaign(created.id, tagNames, user.id);
    if (segregatedCreator.contactId) {
        await ensureEncryptedUserContact(
            {
                id: user.id,
                name: data.creatorName?.trim() || user.name,
                email: user.email,
            },
            {
                campaignId: created.id,
                campaignRole: 'creator',
            }
        );
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

    return {
        success: true,
        id: created.id,
        status: created.status,
        approvalStatus: created.approvalStatus
    };
});
