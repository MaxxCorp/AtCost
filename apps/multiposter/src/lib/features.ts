import { ICONS } from '$lib/icons';
import type { Feature } from '$lib/authorization';
import * as m from '$lib/paraglide/messages.js';

export interface FeatureMeta {
  key: Feature;
  title: () => string;
  description: () => string;
  href: string;
  buttonText: () => string;
  claim: Feature; // claim matches key for now
  icon: keyof typeof ICONS;
  gradientFrom: string;
  gradientTo: string;
  borderClass: string;
  buttonClass: string;
  order: number;
}

export const FEATURES: readonly FeatureMeta[] = [
  {
    key: 'synchronizations',
    title: () => m.feature_synchronizations_title(),
    description: () => m.feature_synchronizations_description(),
    href: '/synchronizations',
    buttonText: () => m.feature_synchronizations_button(),
    claim: 'synchronizations',
    icon: 'calendar',
    gradientFrom: 'from-blue-50',
    gradientTo: 'to-indigo-50',
    borderClass: 'border-blue-100',
    buttonClass: 'bg-blue-600 hover:bg-blue-700',
    order: 1
  },
  {
    key: 'events',
    title: () => m.feature_events_title(),
    description: () => m.feature_events_description(),
    href: '/events',
    buttonText: () => m.feature_events_button(),
    claim: 'events',
    icon: 'plus',
    gradientFrom: 'from-purple-50',
    gradientTo: 'to-pink-50',
    borderClass: 'border-purple-100',
    buttonClass: 'bg-purple-600 hover:bg-purple-700',
    order: 2
  },
  {
    key: 'announcements',
    title: () => m.feature_announcements_title(),
    description: () => m.feature_announcements_description(),
    href: '/announcements',
    buttonText: () => m.feature_announcements_button(),
    claim: 'announcements',
    icon: 'megaphone',
    gradientFrom: 'from-amber-50',
    gradientTo: 'to-yellow-50',
    borderClass: 'border-amber-100',
    buttonClass: 'bg-amber-600 hover:bg-amber-700',
    order: 3
  },
  {
    key: 'campaigns',
    title: () => m.feature_campaigns_title(),
    description: () => m.feature_campaigns_description(),
    href: '/campaigns',
    buttonText: () => m.feature_campaigns_button(),
    claim: 'campaigns',
    icon: 'checkSquare',
    gradientFrom: 'from-green-50',
    gradientTo: 'to-emerald-50',
    borderClass: 'border-emerald-100',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
    order: 4
  },
  {
    key: 'locations',
    title: () => m.feature_locations_title(),
    description: () => m.feature_locations_description(),
    href: '/locations',
    buttonText: () => m.feature_locations_button(),
    claim: 'locations',
    icon: 'mapPin',
    gradientFrom: 'from-orange-50',
    gradientTo: 'to-amber-50',
    borderClass: 'border-orange-100',
    buttonClass: 'bg-orange-600 hover:bg-orange-700',
    order: 5
  },
  {
    key: 'resources',
    title: () => m.feature_resources_title(),
    description: () => m.feature_resources_description(),
    href: '/resources',
    buttonText: () => m.feature_resources_button(),
    claim: 'resources',
    icon: 'box',
    gradientFrom: 'from-teal-50',
    gradientTo: 'to-cyan-50',
    borderClass: 'border-teal-100',
    buttonClass: 'bg-teal-600 hover:bg-teal-700',
    order: 6
  },
  {
    key: 'users',
    title: () => m.feature_users_title(),
    description: () => m.feature_users_description(),
    href: '/users',
    buttonText: () => m.feature_users_button(),
    claim: 'users',
    icon: 'users',
    gradientFrom: 'from-rose-50',
    gradientTo: 'to-red-50',
    borderClass: 'border-rose-100',
    buttonClass: 'bg-rose-600 hover:bg-rose-700',
    order: 7
  },
  {
    key: 'contacts',
    title: () => m.feature_contacts_title(),
    description: () => m.feature_contacts_description(),
    href: '/contacts',
    buttonText: () => m.feature_contacts_button(),
    claim: 'contacts',
    icon: 'users',
    gradientFrom: 'from-indigo-50',
    gradientTo: 'to-blue-50',
    borderClass: 'border-indigo-100',
    buttonClass: 'bg-indigo-600 hover:bg-indigo-700',
    order: 8
  },
  {
    key: 'kiosks',
    title: () => m.feature_kiosks_title(),
    description: () => m.feature_kiosks_description(),
    href: '/kiosks',
    buttonText: () => m.feature_kiosks_button(),
    claim: 'kiosks',
    icon: 'monitor',
    gradientFrom: 'from-gray-50',
    gradientTo: 'to-slate-50',
    borderClass: 'border-gray-100',
    buttonClass: 'bg-gray-600 hover:bg-gray-700',
    order: 9
  }
] as const;

export function getVisibleFeatures(user: any, hasAccessFn: (u: any, f: Feature) => boolean): FeatureMeta[] {
  return FEATURES.filter(f => hasAccessFn(user, f.key)).sort((a, b) => a.order - b.order);
}
