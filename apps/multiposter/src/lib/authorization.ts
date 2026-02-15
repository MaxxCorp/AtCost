import { getRequestEvent } from '$app/server';
import type { UserWithRolesAndClaims } from './auth.d';



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

export * from './authorization-utils';


