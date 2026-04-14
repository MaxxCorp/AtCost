import type { UserWithRolesAndClaims } from './auth.d';
import { hasAccess as sharedHasAccess } from '@ac/auth';

export { parseRoles, parseClaims } from '@ac/auth';
export type { UserWithRolesAndClaims, Feature } from '@ac/auth';

export type TalentFeature = 'users' | 'talents' | 'locations' | 'timesheets' | 'my-profile' | 'time-off' | 'shiftplans';

export function hasAccess(user: UserWithRolesAndClaims, feature: TalentFeature): boolean {
    if (feature === 'my-profile') return !!user;
    if (feature === 'time-off') return !!user; // For now allow all users to see it
    return sharedHasAccess(user, feature);
}
