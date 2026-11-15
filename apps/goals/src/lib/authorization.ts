import type { UserWithRolesAndClaims } from './auth.d';
import { parseRoles, parseClaims } from '@ac/auth';

export { parseRoles, parseClaims };
export type { UserWithRolesAndClaims, Feature } from '@ac/auth';

export type GoalFeature =
    | 'goals'
    | 'my-goals'
    | 'approvals'
    | 'contacts'
    | 'locations'
    | 'tags'
    | 'cms'
    | 'users';

export function isOperator(user: UserWithRolesAndClaims | null | undefined): boolean {
    if (!user) return false;
    const roles = parseRoles(user);
    if (roles.includes('admin') || roles.includes('operator')) return true;
    const claims = parseClaims<Record<string, unknown>>(user);
    return Boolean(claims?.operator === true || claims?.admin === true);
}

export function hasAccess(user: UserWithRolesAndClaims | null | undefined, feature: GoalFeature): boolean {
    if (feature === 'goals') return true;
    if (!user) return false;
    if (feature === 'my-goals') return true;
    if (
        feature === 'approvals' ||
        feature === 'contacts' ||
        feature === 'locations' ||
        feature === 'tags' ||
        feature === 'cms' ||
        feature === 'users'
    ) {
        return isOperator(user);
    }
    return isOperator(user);
}
