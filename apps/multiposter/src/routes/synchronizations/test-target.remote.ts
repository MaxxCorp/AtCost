import { command } from '$app/server';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { testMicrosoftTargetSchema } from '#lib/validations/synchronizations.js';
import { MicrosoftGraphClient } from '#lib/server/sync/providers/microsoft/index.js';

/**
 * Command: Test target access and connection to Microsoft 365
 */
export const testMicrosoftTarget = command(testMicrosoftTargetSchema, async (input) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations', 'use');

	const client = new MicrosoftGraphClient();
	await client.initialize({
		userId: user?.id,
		authMode: input.authMode,
		mailboxEmail: input.mailboxEmail,
		calendarId: input.calendarId,
		folderId: input.folderId
	});

	if (input.type === 'calendar') {
		return await client.testCalendarTarget(input.mailboxEmail, input.calendarId);
	}

	if (input.type === 'contacts') {
		return await client.testContactsTarget(input.mailboxEmail, input.folderId);
	}

	if (input.type === 'resources') {
		return await client.testResourcesTarget();
	}

	return {
		success: false,
		target: 'Unknown',
		authModeUsed: 'user' as const,
		mailbox: input.mailboxEmail || 'primary',
		message: `Unsupported target type: ${input.type}`
	};
});
