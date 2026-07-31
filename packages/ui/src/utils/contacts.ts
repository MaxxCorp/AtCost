/**
 * Match search query against contact fields: first name (givenName), last name (familyName),
 * display name, company, department, role, and notes.
 */
export function matchContactSearch(c: any, q: string): boolean {
	if (!q) return true;
	const term = q.toLowerCase().trim();
	if (!term) return true;

	const displayName = (c?.displayName || '').toLowerCase();
	const givenName = (c?.givenName || '').toLowerCase();
	const familyName = (c?.familyName || '').toLowerCase();
	const fullName = `${givenName} ${familyName}`.trim();
	const company = (c?.company || '').toLowerCase();
	const department = (c?.department || '').toLowerCase();
	const role = (c?.role || '').toLowerCase();
	const notes = (c?.notes || '').toLowerCase();

	return (
		displayName.includes(term) ||
		givenName.includes(term) ||
		familyName.includes(term) ||
		fullName.includes(term) ||
		company.includes(term) ||
		department.includes(term) ||
		role.includes(term) ||
		notes.includes(term)
	);
}

/**
 * Return display name for a contact. Priority:
 * 1. displayName
 * 2. `${givenName} ${familyName}`
 * 3. company
 * 4. primary email / first email
 */
export function getContactDisplayName(c: any): string {
	if (!c) return '';
	if (c.displayName && c.displayName.trim()) return c.displayName.trim();
	const fullName = `${c.givenName || ''} ${c.familyName || ''}`.trim();
	if (fullName) return fullName;
	if (c.company && c.company.trim()) return c.company.trim();
	if (c.emails && Array.isArray(c.emails) && c.emails.length > 0 && c.emails[0]?.value) {
		return c.emails[0].value;
	}
	return '';
}
