import { ICONS } from '@ac/ui';
import type { PersonnelFeature } from '$lib/authorization';

export interface FeatureMeta {
    key: PersonnelFeature;
    title: string;
    description: string;
    href: string;
    buttonText: string;
    claim: PersonnelFeature;
    icon: keyof typeof ICONS;
    gradientFrom: string;
    gradientTo: string;
    borderClass: string;
    buttonClass: string;
    order: number;
}

export const FEATURES: readonly FeatureMeta[] = [
    {
        key: 'contacts',
        title: 'Employees',
        description: 'Manage employee records, personal data, and contact information.',
        href: '/contacts',
        buttonText: 'Manage Employees',
        claim: 'contacts',
        icon: 'users',
        gradientFrom: 'from-indigo-50',
        gradientTo: 'to-blue-50',
        borderClass: 'border-indigo-100',
        buttonClass: 'bg-indigo-600 hover:bg-indigo-700',
        order: 1
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
        order: 2
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
        order: 3
    },
] as const;

export function getVisibleFeatures(user: any, hasAccessFn: (u: any, f: PersonnelFeature) => boolean): FeatureMeta[] {
    return FEATURES.filter(f => hasAccessFn(user, f.key)).sort((a, b) => a.order - b.order);
}
