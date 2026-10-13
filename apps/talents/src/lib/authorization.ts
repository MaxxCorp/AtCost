import type { UserWithRolesAndClaims } from './auth.d';
import { hasAccess as sharedHasAccess } from '@ac/auth';

export { parseRoles, parseClaims } from '@ac/auth';
export type { UserWithRolesAndClaims, Feature } from '@ac/auth';

export type TalentFeature = 'users' | 'talents' | 'contacts' | 'locations' | 'timesheets' | 'my-profile' | 'time-off' | 'shiftplans' | 'contracts' | 'contract-frameworks' | 'payroll' | 'my-payroll' | 'tasks' | 'hmos' | 'tags';

export function hasAccess(user: UserWithRolesAndClaims, feature: TalentFeature): boolean {
    if (feature === 'my-profile') return !!user;
    if (feature === 'time-off') return !!user; // For now allow all users to see it
    if (feature === 'my-payroll') return !!user;
    if (feature === 'tasks') return !!user;
    if (feature === 'hmos') return !!user;
    if (feature === 'tags') return !!user;
    if (feature === 'contacts') return !!user;
    return sharedHasAccess(user, feature);
}


