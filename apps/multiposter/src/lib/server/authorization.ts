import { getRequestEvent } from '$app/server';
import type { UserWithRolesAndClaims } from '../auth.d';
import { hasAccess as sharedHasAccess } from '../authorization';

export * from '../authorization';

/**
 * Get the authenticated user from the request event locals.
 * Throws an error if the user is not authenticated.
 */
export function getAuthenticatedUser(): UserWithRolesAndClaims {
	const event = getRequestEvent();
	if (!event.locals.user) {
		throw new Error('Unauthorized');
	}
	return event.locals.user as UserWithRolesAndClaims;
}

/**
 * Get the user from the request event locals if authenticated.
 * Returns null if not authenticated (does not throw).
 */
export function getOptionalUser(): UserWithRolesAndClaims | null {
	const event = getRequestEvent();
	return event.locals.user as UserWithRolesAndClaims | null;
}

export function ensureAccess(user: UserWithRolesAndClaims, feature: any) {
	if (sharedHasAccess(user, feature)) return;
	throw new Error('Forbidden');
}

