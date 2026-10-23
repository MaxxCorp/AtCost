import type { UserWithRolesAndClaims } from './auth.d';

export type Feature = 'synchronizations' | 'events' | 'campaigns' | 'locations' | 'resources' | 'users' | 'contacts' | 'kiosks' | 'announcements' | 'talents' | 'consumables' | 'recipes' | 'prices' | 'tags' | 'files';

export function parseRoles(user: UserWithRolesAndClaims): string[] {
	const raw = user?.roles;
	if (!raw) return [];
	if (Array.isArray(raw)) return raw as string[];
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
}

export function parseClaims<T extends Record<string, unknown> = Record<string, unknown>>(
	user: UserWithRolesAndClaims
): T | null {
	const raw = user?.claims;
	if (!raw) return null;
	if (typeof raw === 'object') return raw as T;
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw) as T;
		} catch {
			return null;
		}
	}
	return null;
}

export type AccessLevel = 'use' | 'admin';

export function hasAccess(user: UserWithRolesAndClaims | null | undefined, feature: Feature, level: AccessLevel = 'admin'): boolean {
	if (!user) return false;

	const roles = parseRoles(user);
	if (roles.includes('admin')) return true;

	const claims = parseClaims<Record<string, any>>(user);
	if (!claims) return false;

	let claimValue = claims[feature] ?? claims[`multiposter.${feature}`];

	// Consumables, recipes, prices, and files fall back to events/announcements access if not explicitly defined
	if (claimValue === undefined && (feature === 'consumables' || feature === 'recipes' || feature === 'prices' || feature === 'files')) {
		claimValue = claims['events'] ?? claims['multiposter.events'] ?? claims['announcements'] ?? claims['multiposter.announcements'];
	}

	// Tags feature: allow if explicit claim exists, or default to any authenticated user with access to any tag-using feature
	if (feature === 'tags') {
		if (claimValue !== undefined) return !!claimValue;
		return true;
	}

	// If the claim is explicitly true, the user has full (admin) access
	if (claimValue === true) return true;

	// Handle feature-specific granular levels
	if (feature === 'synchronizations') {
		const syncClaim = claimValue ?? claims['calendarSyncs'] ?? claims['multiposter.calendarSyncs'];
		if (level === 'use') {
			// 'admin' level also implies 'use' level
			return syncClaim === 'use' || syncClaim === 'admin' || syncClaim === true;
		}
		if (level === 'admin') {
			return syncClaim === 'admin' || syncClaim === true;
		}
	}

	// Default: check for the feature key (boolean or truthy)
	return !!claimValue;
}
