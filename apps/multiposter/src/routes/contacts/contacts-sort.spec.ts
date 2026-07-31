import { describe, it, expect } from 'vitest';
import { getContactDisplayName } from '@ac/ui';

function sortContactsList<I>(items: I[], field: string = 'displayName', order: 'asc' | 'desc' = 'asc'): I[] {
	if (!items || !Array.isArray(items)) return [];
	return [...items].sort((a: any, b: any) => {
		let valA = '';
		let valB = '';
		if (field === 'displayName' || field === 'name') {
			valA = getContactDisplayName(a) || a.name || a.title || a.company || a.id || '';
			valB = getContactDisplayName(b) || b.name || b.title || b.company || b.id || '';
		} else {
			valA = (a[field] ?? '').toString();
			valB = (b[field] ?? '').toString();
		}
		const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true });
		return order === 'desc' ? -cmp : cmp;
	});
}

describe('Contacts DisplayName Sort Order', () => {
	it('sorts contacts by display name ascending', () => {
		const contacts = [
			{ id: '1', displayName: 'Zoe Kravitz' },
			{ id: '2', displayName: 'Alice Bob' },
			{ id: '3', givenName: 'Bob', familyName: 'Dylan' },
			{ id: '4', company: 'Acme Corp' }
		];

		const sorted = sortContactsList(contacts, 'displayName', 'asc');
		expect(sorted.map(c => getContactDisplayName(c) || c.company)).toEqual([
			'Acme Corp',
			'Alice Bob',
			'Bob Dylan',
			'Zoe Kravitz'
		]);
	});

	it('handles sortField alias "name"', () => {
		const contacts = [
			{ id: '1', displayName: 'Charlie' },
			{ id: '2', displayName: 'Adam' }
		];

		const sorted = sortContactsList(contacts, 'name', 'asc');
		expect(sorted.map(c => c.displayName)).toEqual(['Adam', 'Charlie']);
	});
});
