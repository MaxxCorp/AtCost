import { db } from '@ac/db';
import { contact, contactEmail, contactPhone, eq, inArray, sql } from '@ac/db';
import {
	normalizeEmail,
	normalizePhoneDigits,
	phonesMatch,
	getPhoneMatchSuffix
} from '@ac/validations';

export interface ContactMatchResult {
	id: string;
	displayName: string | null;
	givenName: string | null;
	familyName: string | null;
	matchedBy: ('email' | 'phone')[];
	emails: { id: string; value: string; type: string | null; primary: boolean }[];
	phones: { id: string; value: string; type: string | null; primary: boolean }[];
}

/**
 * Finds existing contacts matching any of the supplied email addresses (case-insensitive)
 * or phone numbers (using bidirectional normalized suffix/country/area-code matching).
 *
 * Reused by both the public event sign-up / reservation lookup flow and the full contact form.
 */
export async function findMatchingContacts(params: {
	emails?: (string | null | undefined)[];
	phones?: (string | null | undefined)[];
	excludeContactId?: string;
}): Promise<ContactMatchResult[]> {
	const normalizedEmails = Array.from(
		new Set(
			(params.emails ?? [])
				.map((e) => normalizeEmail(e))
				.filter((e) => e.length > 0)
		)
	);

	const rawPhones = (params.phones ?? [])
		.map((p) => (p ?? '').trim())
		.filter((p) => normalizePhoneDigits(p).length >= 4);

	if (normalizedEmails.length === 0 && rawPhones.length === 0) {
		return [];
	}

	const matchedByContact = new Map<string, Set<'email' | 'phone'>>();

	// 1. Email matching (case-insensitive)
	if (normalizedEmails.length > 0) {
		const emailRows = await db
			.select({
				contactId: contactEmail.contactId,
				value: contactEmail.value
			})
			.from(contactEmail)
			.where(inArray(sql`lower(trim(${contactEmail.value}))`, normalizedEmails));

		for (const row of emailRows) {
			if (params.excludeContactId && row.contactId === params.excludeContactId) continue;
			const set = matchedByContact.get(row.contactId) ?? new Set<'email' | 'phone'>();
			set.add('email');
			matchedByContact.set(row.contactId, set);
		}
	}

	// 2. Normalized phone matching
	if (rawPhones.length > 0) {
		const suffixes = Array.from(
			new Set(
				rawPhones
					.map((p) => getPhoneMatchSuffix(p))
					.filter((s): s is string => Boolean(s))
			)
		);

		let candidatePhoneRows: { contactId: string; value: string }[] = [];
		if (suffixes.length > 0) {
			// Pre-filter in SQL by trailing digits (4..6 digits) on stripped phone numbers,
			// then verify exact bidirectional match with phonesMatch() in TypeScript.
			const digitsExpr = sql`regexp_replace(regexp_replace(${contactPhone.value}, '\\(\\s*0\\s*\\)', '', 'g'), '[^0-9]', '', 'g')`;
			const longSuffixes = suffixes.filter((s) => s.length === 6);
			const shortSuffixes = suffixes.filter((s) => s.length < 6);

			if (longSuffixes.length > 0) {
				const rows = await db
					.select({
						contactId: contactPhone.contactId,
						value: contactPhone.value
					})
					.from(contactPhone)
					.where(inArray(sql`right(${digitsExpr}, 6)`, longSuffixes));
				candidatePhoneRows.push(...rows);
			}

			if (shortSuffixes.length > 0) {
				const rows = await db
					.select({
						contactId: contactPhone.contactId,
						value: contactPhone.value
					})
					.from(contactPhone)
					.where(inArray(sql`ltrim(${digitsExpr}, '0')`, shortSuffixes));
				candidatePhoneRows.push(...rows);
			}
		}

		for (const row of candidatePhoneRows) {
			if (params.excludeContactId && row.contactId === params.excludeContactId) continue;
			const isMatch = rawPhones.some((inputPhone) => phonesMatch(inputPhone, row.value));
			if (isMatch) {
				const set = matchedByContact.get(row.contactId) ?? new Set<'email' | 'phone'>();
				set.add('phone');
				matchedByContact.set(row.contactId, set);
			}
		}
	}

	const matchedIds = Array.from(matchedByContact.keys());
	if (matchedIds.length === 0) return [];

	const contacts = await db.query.contact.findMany({
		where: inArray(contact.id, matchedIds),
		with: {
			emails: true,
			phones: true
		}
	});

	return contacts
		.filter((c) => c.obfuscationStatus !== 'obfuscated')
		.map((c) => ({
			id: c.id,
			displayName: c.displayName,
			givenName: c.givenName,
			familyName: c.familyName,
			matchedBy: Array.from(matchedByContact.get(c.id) ?? []),
			emails: c.emails.map((e) => ({
				id: e.id,
				value: e.value,
				type: e.type,
				primary: e.primary
			})),
			phones: c.phones.map((p) => ({
				id: p.id,
				value: p.value,
				type: p.type,
				primary: p.primary
			}))
		}));
}
