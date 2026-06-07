import { query } from '$app/server';
import { db } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';


/**
 * List all events for the authenticated user, paginated.
 */
export const listEvents = query(async () => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'events');

	const result = await db.query.event.findMany({
		with: {
			contacts: true,
			locations: {
				with: {
					location: true
				}
			},
			resources: true,
			tags: true,
			campaign: true,
			user: {
				with: {
					userContacts: {
						with: {
							contact: true
						}
					}
				}
			}
		}
	})

	return result;
});

