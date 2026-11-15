import { getRequestEvent } from '$app/server';
import type { UserWithRolesAndClaims } from '../auth.d';
import { hasAccess as sharedHasAccess, isOperator, parseRoles, parseClaims } from '../authorization';

export { parseRoles, parseClaims, isOperator, sharedHasAccess as hasAccess };

export function getAuthenticatedUser(): UserWithRolesAndClaims {
    const event = getRequestEvent();
    if (!event.locals.user) {
        throw new Error('Unauthorized: Please register or sign in to participate.');
    }
    return event.locals.user as UserWithRolesAndClaims;
}

export function getOptionalUser(): UserWithRolesAndClaims | null {
    const event = getRequestEvent();
    return event.locals.user as UserWithRolesAndClaims | null;
}

export function ensureAccess(user: UserWithRolesAndClaims, feature: any) {
    if (sharedHasAccess(user, feature)) return;
    throw new Error('Forbidden');
}

export function ensureOperator(user: UserWithRolesAndClaims) {
    if (isOperator(user)) return;
    throw new Error('Forbidden: Internal operator permissions required.');
}
