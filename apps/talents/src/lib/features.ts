import { ICONS } from '@ac/ui';
import type { TalentFeature } from '$lib/authorization';

export interface FeatureMeta {
    key: TalentFeature;
    title: string;
    description: string;
    href: string;
    buttonText: string;
    claim: TalentFeature;
    icon: keyof typeof ICONS;
    gradientFrom: string;
    gradientTo: string;
    borderClass: string;
    buttonClass: string;
    order: number;
    category: 'management' | 'self-service';
}

export const FEATURES: readonly FeatureMeta[] = [
    {
        key: 'my-profile',
        title: 'My Profile',
        description: 'View and manage your personal talent profile and contact details.',
        href: '/my-profile',
        buttonText: 'View Profile',
        claim: 'my-profile',
        icon: 'user',
        gradientFrom: 'from-blue-50',
        gradientTo: 'to-indigo-50',
        borderClass: 'border-blue-100',
        buttonClass: 'bg-blue-600 hover:bg-blue-700',
        order: 1,
        category: 'self-service'
    },
    {
        key: 'timesheets',
        title: 'Time Tracking',
        description: 'Track your work hours, record shifts and view history.',
        href: '/my-timesheet',
        buttonText: 'Track Time',
        claim: 'timesheets',
        icon: 'clock',
        gradientFrom: 'from-emerald-50',
        gradientTo: 'to-teal-50',
        borderClass: 'border-emerald-100',
        buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
        order: 2,
        category: 'self-service'
    },
    {
        key: 'time-off',
        title: 'Time Off',
        description: 'Request time off and manage your leave balances.',
        href: '/time-off',
        buttonText: 'Request Leave',
        claim: 'time-off',
        icon: 'plane',
        gradientFrom: 'from-amber-50',
        gradientTo: 'to-orange-50',
        borderClass: 'border-amber-100',
        buttonClass: 'bg-amber-600 hover:bg-amber-700',
        order: 3,
        category: 'self-service'
    },
    {
        key: 'talents',
        title: 'Talents',
        description: 'Manage talent records, history timeline, and contact information.',
        href: '/talents',
        buttonText: 'Manage Talents',
        claim: 'talents',
        icon: 'users',
        gradientFrom: 'from-indigo-50',
        gradientTo: 'to-blue-50',
        borderClass: 'border-indigo-100',
        buttonClass: 'bg-indigo-600 hover:bg-indigo-700',
        order: 10,
        category: 'management'
    },
    {
        key: 'locations',
        title: 'Locations',
        description: 'Manage office locations, branches, and work sites.',
        href: '/locations',
        buttonText: 'Manage Locations',
        claim: 'locations',
        icon: 'mapPin',
        gradientFrom: 'from-orange-50',
        gradientTo: 'to-amber-50',
        borderClass: 'border-orange-100',
        buttonClass: 'bg-orange-600 hover:bg-orange-700',
        order: 11,
        category: 'management'
    },
    {
        key: 'shiftplans',
        title: 'Shiftplans',
        description: 'Manage recurring shiftplan templates and daily assignments.',
        href: '/shiftplans',
        buttonText: 'Manage Shiftplans',
        claim: 'shiftplans',
        icon: 'calendar',
        gradientFrom: 'from-purple-50',
        gradientTo: 'to-fuchsia-50',
        borderClass: 'border-purple-100',
        buttonClass: 'bg-purple-600 hover:bg-purple-700',
        order: 12,
        category: 'management'
    },
    {
        key: 'users',
        title: 'Users',
        description: 'Manage system users, roles, and access permissions.',
        href: '/users',
        buttonText: 'Manage Users',
        claim: 'users',
        icon: 'shield',
        gradientFrom: 'from-rose-50',
        gradientTo: 'to-red-50',
        borderClass: 'border-rose-100',
        buttonClass: 'bg-rose-600 hover:bg-rose-700',
        order: 13,
        category: 'management'
    }
] as const;

export function getVisibleFeatures(user: any, hasAccessFn: (u: any, f: TalentFeature) => boolean): FeatureMeta[] {
    return FEATURES.filter(f => hasAccessFn(user, f.key)).sort((a, b) => a.order - b.order);
}
