/**
 * Pure contact email & phone normalization and bidirectional matching utilities.
 *
 * Used by both the public event sign-up flow and the full contact form to
 * prevent duplicate contacts and allow anonymous reservation lookup.
 */

export function normalizeEmail(email: string | null | undefined): string {
	return (email ?? '').trim().toLowerCase();
}

/**
 * Normalizes a phone number string to its canonical digit sequence.
 *
 * Examples:
 * - "+49 (0)176 5405659" -> "491765405659"
 * - "0049 176 5405659"   -> "491765405659"
 * - "0176 5405659"       -> "1765405659"
 * - "5405659"            -> "5405659"
 * - "030 / 540-56-59"    -> "305405659"
 */
export function normalizePhoneDigits(raw: string | null | undefined): string {
	if (!raw) return '';
	// Strip trunk "(0)" commonly written after international country codes, e.g. "+49 (0)176..."
	const withoutTrunkParen = raw.replace(/\(\s*0\s*\)/g, '');
	let digits = withoutTrunkParen.replace(/\D/g, '');
	if (!digits) return '';

	// Strip leading international "00" prefix or national trunk "0"s
	digits = digits.replace(/^0+/, '');
	return digits;
}

/**
 * Checks whether two phone numbers represent the same number, even if one omits
 * the country code and/or city/area code (e.g. "5405659" <-> "+49 (0)176 5405659").
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
	const na = normalizePhoneDigits(a);
	const nb = normalizePhoneDigits(b);
	if (!na || !nb) return false;
	if (na === nb) return na.length >= 4;

	const minLen = Math.min(na.length, nb.length);
	if (minLen < 6) return false;

	return na.endsWith(nb) || nb.endsWith(na);
}

/**
 * Returns the trailing digit suffix (up to 6 digits) for fast SQL candidate lookup.
 */
export function getPhoneMatchSuffix(raw: string | null | undefined): string | null {
	const digits = normalizePhoneDigits(raw);
	if (digits.length < 4) return null;
	return digits.length >= 6 ? digits.slice(-6) : digits;
}
