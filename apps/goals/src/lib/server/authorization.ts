import { getRequestEvent } from '$app/server';
import type { UserWithRolesAndClaims } from '../auth.d';
import {
    hasAccess as appHasAccess,
    isOperator,
    parseRoles,
    parseClaims,
    type GoalFeature,
} from '../authorization';

export { parseRoles, parseClaims, isOperator, appHasAccess as hasAccess };

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

export function ensureAccess(user: UserWithRolesAndClaims | null | undefined, feature: GoalFeature) {
    if (!user) {
        throw new Error('Unauthorized: Authentication required.');
    }
    if (appHasAccess(user, feature)) return;
    throw new Error('Forbidden: Operator or Admin privileges required.');
}

export function ensureOperator(user: UserWithRolesAndClaims | null | undefined) {
    if (!user) {
        throw new Error('Unauthorized: Authentication required.');
    }
    if (isOperator(user)) return;
    throw new Error('Forbidden: Internal operator permissions required.');
}
