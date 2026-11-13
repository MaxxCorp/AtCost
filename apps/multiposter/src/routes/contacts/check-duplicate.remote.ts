import { command } from '$app/server';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { checkContactDuplicateSchema } from '@ac/validations';
import { findMatchingContacts } from '#lib/server/contact-matching.js';

export const checkContactDuplicate = command(checkContactDuplicateSchema, async (data) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'contacts');

	const matches = await findMatchingContacts({
		emails: data.emails,
		phones: data.phones,
		excludeContactId: data.excludeContactId
	});

	return {
		matches: matches.map((m) => ({
			id: m.id,
			displayName:
				m.displayName ||
				`${m.givenName ?? ''} ${m.familyName ?? ''}`.trim() ||
				'Unnamed Contact',
			matchedBy: m.matchedBy,
			emails: m.emails.map((e) => e.value),
			phones: m.phones.map((p) => p.value)
		}))
	};
});
