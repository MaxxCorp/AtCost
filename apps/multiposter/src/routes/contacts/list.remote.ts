import * as v from 'valibot';
import { query } from '$app/server';
import { contact } from '@ac/db';
import type { Contact as DbContact } from '@ac/db';
import { db } from '$lib/server/db';
import { desc } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

/**
 * Contact interface matching the database schema, with dates serialized to strings and relations
 */
export type Contact = Omit<DbContact, 'createdAt' | 'updatedAt' | 'birthday'> & {
	createdAt: string;
	updatedAt: string;
	birthday: string | null;
	emails?: { value: string; type: string | null }[];
	phones?: { value: string; type: string | null }[];
	addresses?: { street: string | null; houseNumber: string | null; zip: string | null; city: string | null }[];
};

/**
 * Query: List all contacts
 */
export const listContacts = query(v.undefined_(), async (): Promise<Contact[]> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'contacts');

	const results = await db.query.contact.findMany({
		orderBy: [desc(contact.createdAt)],
		with: {
			emails: true,
			phones: true,
			addresses: true,
		}
	});

	return results.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		birthday: row.birthday ? row.birthday.toISOString() : null,
		emails: row.emails || [],
		phones: row.phones || [],
		addresses: row.addresses || [],
	}));
});
