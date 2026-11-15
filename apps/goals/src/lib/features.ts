import { ICONS } from '@ac/ui';
import type { GoalFeature } from '#lib/authorization.js';

export interface FeatureMeta {
    key: GoalFeature;
    title: string;
    description: string;
    href: string;
    buttonText: string;
    claim: GoalFeature;
    icon: keyof typeof ICONS;
    gradientFrom: string;
    gradientTo: string;
    borderClass: string;
    buttonClass: string;
    order: number;
    category: 'community' | 'operator';
}

export const FEATURES: readonly FeatureMeta[] = [
    {
        key: 'goals',
        title: 'Browse Campaigns',
        description: 'Explore active Kickstarter & Change.org style goal campaigns, stretch goals, and progress.',
        href: '/goals',
        buttonText: 'Explore Campaigns',
        claim: 'goals',
        icon: 'target',
        gradientFrom: 'from-indigo-50',
        gradientTo: 'to-violet-50',
        borderClass: 'border-indigo-100',
        buttonClass: 'bg-indigo-600 hover:bg-indigo-700',
        order: 1,
        category: 'community'
    },
    {
        key: 'my-goals',
        title: 'Start a Campaign',
        description: 'Launch a new community or operator goal campaign with primary and stretch goals.',
        href: '/goals/new',
        buttonText: 'Create Campaign',
        claim: 'my-goals',
        icon: 'plus',
        gradientFrom: 'from-emerald-50',
        gradientTo: 'to-teal-50',
        borderClass: 'border-emerald-100',
        buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
        order: 2,
        category: 'community'
    },
    {
        key: 'approvals',
        title: 'Approval Queue & Showcase',
        description: 'Review community-supplied campaigns and configure the top featured showcase.',
        href: '/goals/approvals',
        buttonText: 'Review Queue',
        claim: 'approvals',
        icon: 'checkSquare',
        gradientFrom: 'from-amber-50',
        gradientTo: 'to-orange-50',
        borderClass: 'border-amber-100',
        buttonClass: 'bg-amber-600 hover:bg-amber-700',
        order: 10,
        category: 'operator'
    },
    {
        key: 'locations',
        title: 'Locations',
        description: 'Manage locations and associate regional venues or cities with goal campaigns.',
        href: '/locations',
        buttonText: 'Manage Locations',
        claim: 'locations',
        icon: 'mapPin',
        gradientFrom: 'from-sky-50',
        gradientTo: 'to-blue-50',
        borderClass: 'border-sky-100',
        buttonClass: 'bg-sky-600 hover:bg-sky-700',
        order: 11,
        category: 'operator'
    },
    {
        key: 'tags',
        title: 'Tags & Categories',
        description: 'Manage tag-based categorization and external/internal visibility for campaigns.',
        href: '/tags',
        buttonText: 'Manage Tags',
        claim: 'tags',
        icon: 'tag',
        gradientFrom: 'from-purple-50',
        gradientTo: 'to-fuchsia-50',
        borderClass: 'border-purple-100',
        buttonClass: 'bg-purple-600 hover:bg-purple-700',
        order: 12,
        category: 'operator'
    },
    {
        key: 'contacts',
        title: 'Encrypted Contacts & GDPR',
        description: 'Manage segregated PKI-encrypted participant contacts, envelope migrations, and GDPR Art. 17 crypto-shredding.',
        href: '/contacts',
        buttonText: 'Manage Contacts & GDPR',
        claim: 'contacts',
        icon: 'users',
        gradientFrom: 'from-rose-50',
        gradientTo: 'to-orange-50',
        borderClass: 'border-rose-100',
        buttonClass: 'bg-rose-600 hover:bg-rose-700',
        order: 13,
        category: 'operator'
    }
] as const;

export function getVisibleFeatures(user: any, hasAccessFn: (u: any, f: GoalFeature) => boolean): FeatureMeta[] {
    return FEATURES.filter(f => hasAccessFn(user, f.key)).sort((a, b) => a.order - b.order);
}
