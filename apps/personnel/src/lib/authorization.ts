import type { UserWithRolesAndClaims } from './auth.d';
export { parseRoles, parseClaims, hasAccess } from '@ac/auth';
export type { UserWithRolesAndClaims, Feature } from '@ac/auth';

export type PersonnelFeature = 'users' | 'contacts' | 'locations';
