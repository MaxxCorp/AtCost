import type { UserWithRolesAndClaims } from './auth.d';
export { parseRoles, parseClaims, hasAccess } from '@ac/auth';
export type { UserWithRolesAndClaims, Feature } from '@ac/auth';

export type TalentFeature = 'users' | 'talents' | 'locations' | 'timesheets';
