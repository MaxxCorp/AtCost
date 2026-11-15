import * as v from 'valibot';
import type {
    GoalCampaign as DbGoalCampaign,
    GoalStage as DbGoalStage,
    GoalContribution as DbGoalContribution,
    GoalUpdate as DbGoalUpdate,
    GoalShowcaseConfig as DbGoalShowcaseConfig,
    GoalCampaignStatus,
    GoalApprovalStatus,
    GoalContributionType,
    GoalShowcaseSelectionMode,
    GoalPluginConfig,
    GoalFinancialContributionMode,
    GoalFinancialContributionKind,
} from '@ac/db';
import type { Tag } from './tags.js';
import { FilterableIdSchema } from './pagination.js';

export type {
    GoalCampaignStatus,
    GoalApprovalStatus,
    GoalContributionType,
    GoalShowcaseSelectionMode,
    GoalPluginConfig,
    GoalFinancialContributionMode,
    GoalFinancialContributionKind,
};

export type GoalStage = Omit<DbGoalStage, 'createdAt' | 'updatedAt' | 'reachedAt'> & {
    createdAt: string;
    updatedAt: string;
    reachedAt: string | null;
};

export type GoalContribution = Omit<DbGoalContribution, 'createdAt'> & {
    createdAt: string;
};

export type GoalUpdate = Omit<DbGoalUpdate, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
};

export type GoalShowcaseConfig = Omit<DbGoalShowcaseConfig, 'updatedAt'> & {
    updatedAt: string;
};

export type GoalCampaign = Omit<
    DbGoalCampaign,
    'createdAt' | 'updatedAt' | 'approvedAt' | 'startDate' | 'endDate'
> & {
    createdAt: string;
    updatedAt: string;
    approvedAt: string | null;
    startDate: string | null;
    endDate: string | null;
    stages?: GoalStage[];
    contributions?: GoalContribution[];
    updates?: GoalUpdate[];
    tags?: Tag[];
    tagNames?: string[];
    locationIds?: string[];
    locations?: {
        id: string;
        name: string;
        street: string | null;
        houseNumber: string | null;
        zip: string | null;
        city: string | null;
        country: string | null;
        isPublic: boolean;
    }[];
    user?: {
        id: string;
        name: string | null;
        email: string;
    } | null;
};

export interface GoalProgressSummary {
    primaryStage: {
        id?: string;
        title: string;
        description?: string | null;
        targetAmount: number;
        stageType: 'primary';
        isReached: boolean;
    };
    stretchStages: Array<{
        id?: string;
        title: string;
        description?: string | null;
        targetAmount: number;
        stageType: 'stretch';
        isReached: boolean;
        sortOrder: number;
    }>;
    allStages: Array<{
        id?: string;
        title: string;
        description?: string | null;
        targetAmount: number;
        stageType: 'primary' | 'stretch';
        isReached: boolean;
        sortOrder: number;
    }>;
    nextStage: {
        id?: string;
        title: string;
        description?: string | null;
        targetAmount: number;
        stageType: 'primary' | 'stretch';
        remainingAmount: number;
        progressPercent: number;
    } | null;
    primaryProgressPercent: number;
    overallMaxTarget: number;
    overallProgressPercent: number;
    reachedStagesCount: number;
    allStagesReached: boolean;
}

export function computeGoalProgressSummary(campaign: {
    primaryTarget: number;
    currentAmount: number;
    title?: string;
    stages?: Array<{
        id?: string;
        title: string;
        description?: string | null;
        targetAmount: number;
        stageType: 'primary' | 'stretch';
        isReached?: boolean;
        sortOrder?: number;
    }>;
}): GoalProgressSummary {
    const current = Number(campaign.currentAmount || 0);
    const rawStages = campaign.stages ?? [];

    const existingPrimary = rawStages.find((s) => s.stageType === 'primary');
    const primaryTarget = existingPrimary
        ? Number(existingPrimary.targetAmount)
        : Number(campaign.primaryTarget || 100);

    const primaryStage = {
        id: existingPrimary?.id,
        title: existingPrimary?.title || 'Primary Goal',
        description: existingPrimary?.description ?? null,
        targetAmount: primaryTarget,
        stageType: 'primary' as const,
        isReached: current >= primaryTarget,
        sortOrder: 0,
    };

    const stretchStages = rawStages
        .filter((s) => s.stageType === 'stretch')
        .sort((a, b) => Number(a.targetAmount) - Number(b.targetAmount))
        .map((s, idx) => ({
            id: s.id,
            title: s.title,
            description: s.description ?? null,
            targetAmount: Number(s.targetAmount),
            stageType: 'stretch' as const,
            isReached: current >= Number(s.targetAmount),
            sortOrder: s.sortOrder ?? idx + 1,
        }));

    const allStages = [primaryStage, ...stretchStages];
    const unreached = allStages.find((s) => current < s.targetAmount);

    let nextStage: GoalProgressSummary['nextStage'] = null;
    if (unreached) {
        const remainingAmount = Math.max(0, Number((unreached.targetAmount - current).toFixed(2)));
        const progressPercent = Math.min(
            100,
            Math.round((current / Math.max(1, unreached.targetAmount)) * 100)
        );
        nextStage = {
            id: unreached.id,
            title: unreached.title,
            description: unreached.description,
            targetAmount: unreached.targetAmount,
            stageType: unreached.stageType,
            remainingAmount,
            progressPercent,
        };
    }

    const overallMaxTarget = Math.max(
        primaryTarget,
        ...stretchStages.map((s) => s.targetAmount)
    );
    const primaryProgressPercent = Math.min(
        100,
        Math.round((current / Math.max(1, primaryTarget)) * 100)
    );
    const overallProgressPercent = Math.min(
        100,
        Math.round((current / Math.max(1, overallMaxTarget)) * 100)
    );
    const reachedStagesCount = allStages.filter((s) => s.isReached).length;

    return {
        primaryStage,
        stretchStages,
        allStages,
        nextStage,
        primaryProgressPercent,
        overallMaxTarget,
        overallProgressPercent,
        reachedStagesCount,
        allStagesReached: reachedStagesCount === allStages.length,
    };
}

export const goalContributionTypePicklist = v.picklist(['vote', 'signup', 'financial']);
export const goalCampaignStatusPicklist = v.picklist([
    'draft',
    'pending_approval',
    'published',
    'completed_successful',
    'completed_unsuccessful',
    'cancelled',
]);
export const goalApprovalStatusPicklist = v.picklist([
    'not_required',
    'pending',
    'approved',
    'rejected',
]);
export const goalShowcaseSelectionModePicklist = v.picklist([
    'operator_choice',
    'popularity',
    'recency',
    'mixed',
]);

export const goalPaginationSchema = v.optional(
    v.object({
        page: v.optional(v.number(), 1),
        limit: v.optional(v.number(), 50),
        search: v.optional(v.string()),
        locationId: FilterableIdSchema,
        tagId: FilterableIdSchema,
        contributionType: FilterableIdSchema,
        status: FilterableIdSchema,
        approvalStatus: FilterableIdSchema,
        creatorRole: FilterableIdSchema,
        sortField: v.optional(
            v.picklist([
                'createdAt',
                'updatedAt',
                'popularity',
                'visitsCount',
                'contributionsCount',
                'currentAmount',
            ]),
            'createdAt'
        ),
        sortOrder: v.optional(v.picklist(['asc', 'desc']), 'desc'),
        onlyPublished: v.optional(v.boolean()),
        onlyShowcased: v.optional(v.boolean()),
        createdByUserId: v.optional(v.string()),
    }),
    {}
);

export const createGoalCampaignSchema = v.object({
    title: v.pipe(v.string(), v.nonEmpty('Title is required')),
    executiveSummary: v.pipe(v.string(), v.nonEmpty('Executive summary is required')),
    description: v.pipe(v.string(), v.nonEmpty('Campaign description is required')),
    heroImage: v.optional(v.string(), ''),
    creatorName: v.optional(v.string(), ''),
    contributionType: v.optional(goalContributionTypePicklist, 'vote'),
    primaryTarget: v.optional(v.union([v.number(), v.string()]), '100'),
    primaryGoalTitle: v.optional(v.string(), 'Primary Goal'),
    primaryGoalDescription: v.optional(v.string(), ''),
    currency: v.optional(v.string(), 'EUR'),
    unitLabel: v.optional(v.string(), 'votes'),
    startDate: v.optional(v.string(), ''),
    endDate: v.optional(v.string(), ''),
    submitAction: v.optional(v.picklist(['draft', 'publish']), 'publish'),
    isShowcased: v.optional(v.union([v.boolean(), v.string()]), false),
    stretchGoalsJson: v.optional(v.string(), '[]'),
    pluginConfigJson: v.optional(v.string(), '{}'),
    tags: v.optional(v.string(), ''),
    locationIds: v.optional(v.string(), '[]'),
});

export const updateGoalCampaignSchema = v.object({
    id: v.pipe(v.string(), v.nonEmpty('Campaign ID is required')),
    title: v.pipe(v.string(), v.nonEmpty('Title is required')),
    executiveSummary: v.pipe(v.string(), v.nonEmpty('Executive summary is required')),
    description: v.pipe(v.string(), v.nonEmpty('Campaign description is required')),
    heroImage: v.optional(v.string(), ''),
    creatorName: v.optional(v.string(), ''),
    contributionType: v.optional(goalContributionTypePicklist, 'vote'),
    primaryTarget: v.optional(v.union([v.number(), v.string()]), '100'),
    primaryGoalTitle: v.optional(v.string(), 'Primary Goal'),
    primaryGoalDescription: v.optional(v.string(), ''),
    currency: v.optional(v.string(), 'EUR'),
    unitLabel: v.optional(v.string(), 'votes'),
    startDate: v.optional(v.string(), ''),
    endDate: v.optional(v.string(), ''),
    status: v.optional(goalCampaignStatusPicklist),
    isShowcased: v.optional(v.union([v.boolean(), v.string()]), false),
    stretchGoalsJson: v.optional(v.string(), '[]'),
    pluginConfigJson: v.optional(v.string(), '{}'),
    tags: v.optional(v.string(), ''),
    locationIds: v.optional(v.string(), '[]'),
});

export const createGoalContributionSchema = v.object({
    campaignId: v.pipe(v.string(), v.nonEmpty('Campaign ID is required')),
    pluginType: goalContributionTypePicklist,
    amount: v.optional(v.union([v.number(), v.string()]), '1'),
    comment: v.optional(v.string(), ''),
    isAnonymous: v.optional(v.union([v.boolean(), v.string()]), false),
    commitmentRole: v.optional(v.string(), ''),
    availabilityNote: v.optional(v.string(), ''),
    financialType: v.optional(v.picklist(['pledge', 'transfer']), 'pledge'),
    paymentProvider: v.optional(v.picklist(['stripe', 'mollie', 'adyen']), 'stripe'),
    selectedTierLabel: v.optional(v.string(), ''),
});

export const createGoalUpdateSchema = v.object({
    campaignId: v.pipe(v.string(), v.nonEmpty('Campaign ID is required')),
    title: v.pipe(v.string(), v.nonEmpty('Update title is required')),
    content: v.pipe(v.string(), v.nonEmpty('Update content is required')),
    isMilestone: v.optional(v.union([v.boolean(), v.string()]), false),
});

export const reviewGoalCampaignSchema = v.object({
    campaignId: v.pipe(v.string(), v.nonEmpty('Campaign ID is required')),
    decision: v.picklist(['approved', 'rejected']),
    approvalNotes: v.optional(v.string(), ''),
});

export const updateGoalLifecycleStatusSchema = v.object({
    campaignId: v.pipe(v.string(), v.nonEmpty('Campaign ID is required')),
    status: goalCampaignStatusPicklist,
});

export const toggleGoalShowcaseSchema = v.object({
    campaignId: v.pipe(v.string(), v.nonEmpty('Campaign ID is required')),
    isShowcased: v.boolean(),
});

export const updateGoalShowcaseConfigSchema = v.object({
    isActive: v.optional(v.union([v.boolean(), v.string()]), true),
    selectionMode: v.optional(goalShowcaseSelectionModePicklist, 'mixed'),
    maxItems: v.optional(v.union([v.number(), v.string()]), '3'),
    title: v.pipe(v.string(), v.nonEmpty('Showcase title is required')),
    subtitle: v.optional(v.string(), ''),
});
