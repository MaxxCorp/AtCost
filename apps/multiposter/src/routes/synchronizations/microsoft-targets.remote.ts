import { query } from '$app/server';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import {
	listMicrosoftMailboxesSchema,
	listMicrosoftCalendarsSchema,
	listMicrosoftContactFoldersSchema
} from '#lib/validations/synchronizations.js';
import { MicrosoftGraphClient } from '#lib/server/sync/providers/microsoft/index.js';

/**
 * Query: List mailboxes discovered in the Microsoft tenant (shared, room, user)
 */
export const listMicrosoftMailboxes = query(listMicrosoftMailboxesSchema, async (input) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations', 'use');

	const client = new MicrosoftGraphClient();
	await client.initialize({
		userId: user?.id,
		authMode: input?.authMode || 'auto'
	});

	return await client.listTenantMailboxes({
		type: input?.type,
		search: input?.search
	});
});

/**
 * Query: List calendars within a given Microsoft mailbox or current user
 */
export const listMicrosoftCalendars = query(listMicrosoftCalendarsSchema, async (input) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations', 'use');

	const client = new MicrosoftGraphClient();
	await client.initialize({
		userId: user?.id,
		authMode: input?.authMode || 'auto',
		mailboxEmail: input?.mailboxEmail
	});

	return await client.listCalendars(input?.mailboxEmail, input?.currentCalendarId);
});

/**
 * Query: List contact folders within a given Microsoft mailbox or current user
 */
export const listMicrosoftContactFolders = query(listMicrosoftContactFoldersSchema, async (input) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations', 'use');

	const client = new MicrosoftGraphClient();
	await client.initialize({
		userId: user?.id,
		authMode: input?.authMode || 'auto',
		mailboxEmail: input?.mailboxEmail
	});

	return await client.listContactFolders(input?.mailboxEmail, input?.currentFolderId);
});
