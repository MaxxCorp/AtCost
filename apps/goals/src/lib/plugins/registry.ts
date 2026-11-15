import type { GoalContributionType, GoalPluginConfig } from '@ac/validations';

export interface ContributionPluginManifest {
    id: GoalContributionType;
    name: string;
    shortName: string;
    tagline: string;
    description: string;
    defaultUnitLabel: string;
    defaultPrimaryTarget: number;
    badgeBgClass: string;
    badgeTextClass: string;
    accentColor: string;
    ctaVerb: string;
    requiresPaymentProvider: boolean;
    defaultConfig: GoalPluginConfig;
    computeDelta: (rawAmount?: number | string) => number;
    formatValue: (value: number, currency?: string, unitLabel?: string) => string;
}

export const CONTRIBUTION_PLUGINS: Record<GoalContributionType, ContributionPluginManifest> = {
    vote: {
        id: 'vote',
        name: 'Change.org-Style Petition & Voting Plugin',
        shortName: 'Votes & Signatures',
        tagline: 'Rally civic support with verified signatures and endorsement comments',
        description:
            'Registered participants cast their vote (+1 signature) and optionally attach a public reason for endorsing the primary and stretch goals.',
        defaultUnitLabel: 'votes',
        defaultPrimaryTarget: 250,
        badgeBgClass: 'bg-amber-50 border-amber-200',
        badgeTextClass: 'text-amber-800',
        accentColor: 'amber',
        ctaVerb: 'Sign & Vote Now',
        requiresPaymentProvider: false,
        defaultConfig: {
            voteStatement: 'I support this goal campaign and endorse its implementation.',
            allowComments: true,
        },
        computeDelta: () => 1,
        formatValue: (value, _currency, unitLabel = 'votes') =>
            `${Math.round(value).toLocaleString()} ${unitLabel}`,
    },
    signup: {
        id: 'signup',
        name: 'Action & Volunteer Sign-Up Plugin',
        shortName: 'Participant Sign-ups',
        tagline: 'Mobilize active participants, volunteers, and group commitments',
        description:
            'Registered participants sign up to actively participate, specifying party size, commitment role, and availability to unlock primary and stretch stages.',
        defaultUnitLabel: 'participants',
        defaultPrimaryTarget: 50,
        badgeBgClass: 'bg-teal-50 border-teal-200',
        badgeTextClass: 'text-teal-800',
        accentColor: 'teal',
        ctaVerb: 'Sign Up to Participate',
        requiresPaymentProvider: false,
        defaultConfig: {
            commitmentDescription: 'Commit to attending or helping execute this goal stage.',
            maxPartySize: 5,
            collectAvailability: true,
        },
        computeDelta: (rawAmount) => {
            const parsed = Number(rawAmount);
            if (!Number.isFinite(parsed) || parsed < 1) return 1;
            return Math.min(20, Math.round(parsed));
        },
        formatValue: (value, _currency, unitLabel = 'sign-ups') =>
            `${Math.round(value).toLocaleString()} ${unitLabel}`,
    },
    financial: {
        id: 'financial',
        name: 'Kickstarter-Style Financial Pledges & Transfers Plugin',
        shortName: 'Pledges & Transfers',
        tagline: 'Request conditional financial pledges, immediate transfers, or both — with automatic cancellation/refund on unsuccessful or cancelled campaigns',
        description:
            'Goal owners can request financial pledges (authorized commitments collected only upon success), actual transfers (immediate funds transfer), or both. If a campaign is cancelled or completed unsuccessfully, all pledges are automatically cancelled and all actual transfers are refunded.',
        defaultUnitLabel: 'EUR',
        defaultPrimaryTarget: 2500,
        badgeBgClass: 'bg-emerald-50 border-emerald-200',
        badgeTextClass: 'text-emerald-800',
        accentColor: 'emerald',
        ctaVerb: 'Back This Goal',
        requiresPaymentProvider: true,
        defaultConfig: {
            paymentProvider: 'stripe',
            financialMode: 'both',
            captureStrategy: 'all_or_nothing',
            allowCustomAmount: true,
            minContribution: 5,
            suggestedTiers: [
                {
                    amount: 15,
                    label: 'Early Supporter',
                    rewardDescription: 'Name listed on the community supporter wall + campaign updates.',
                },
                {
                    amount: 50,
                    label: 'Impact Backer',
                    rewardDescription: 'Full recognition + invitation to the milestone launch showcase.',
                },
                {
                    amount: 150,
                    label: 'Founding Patron',
                    rewardDescription: 'Founding patron badge + direct input on stretch goal priorities.',
                },
            ],
        },
        computeDelta: (rawAmount) => {
            const parsed = Number(rawAmount);
            if (!Number.isFinite(parsed) || parsed <= 0) return 10;
            return Number(parsed.toFixed(2));
        },
        formatValue: (value, currency = 'EUR') => {
            try {
                return new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: currency || 'EUR',
                    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
                }).format(value);
            } catch {
                return `${value.toLocaleString()} ${currency}`;
            }
        },
    },
};

export function getContributionPlugin(type: GoalContributionType | string): ContributionPluginManifest {
    return (
        CONTRIBUTION_PLUGINS[type as GoalContributionType] ?? CONTRIBUTION_PLUGINS.vote
    );
}

export function listContributionPlugins(): ContributionPluginManifest[] {
    return Object.values(CONTRIBUTION_PLUGINS);
}

export function formatContributionValue(
    value: number,
    type: GoalContributionType | string,
    currency = 'EUR',
    unitLabel?: string
): string {
    const plugin = getContributionPlugin(type);
    return plugin.formatValue(Number(value || 0), currency, unitLabel || plugin.defaultUnitLabel);
}

