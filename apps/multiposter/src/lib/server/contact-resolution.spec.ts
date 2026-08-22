import { describe, it, expect } from 'vitest';
import {
	isEmployeeContact,
	extractContactDetails,
	resolveContactFromList,
	resolveLocationContactSync,
	resolveEventContactSync,
	resolveAnnouncementContactSync
} from './contact-resolution';

describe('Contact Resolution Engine', () => {
	const nonEmployeeContact = {
		id: 'c1',
		displayName: 'Alice Visitor',
		emails: [
			{ type: 'work', value: 'alice.work@example.com' },
			{ type: 'home', value: 'alice.home@example.com', primary: true }
		],
		phones: [
			{ type: 'work', value: '+123456789' },
			{ type: 'mobile', value: '+987654321', primary: true }
		],
		tags: [{ name: 'Volunteer' }]
	};

	const employeeContact = {
		id: 'c2',
		displayName: 'Bob Staff',
		emails: [
			{ type: 'work', value: 'bob.staff@org.com', primary: true },
			{ type: 'home', value: 'bob.personal@org.com' }
		],
		phones: [
			{ type: 'work', value: '+1122334455', primary: true }
		],
		tags: [{ name: 'Employee' }]
	};

	const locationEmployeeContact = {
		id: 'c3',
		displayName: 'Charlie Caretaker',
		emails: [
			{ type: 'work', value: 'charlie.caretaker@venue.com', primary: true }
		],
		phones: [
			{ type: 'work', value: '+5544332211', primary: true }
		],
		tags: [{ tag: { name: 'employees' } }] // Test nested tag structure & plural
	};

	const locationGeneralContact = {
		id: 'c4',
		displayName: 'Venue Front Desk',
		emails: [
			{ type: 'work', value: 'info@venue.com', primary: true }
		],
		phones: [
			{ type: 'work', value: '+00000000', primary: true }
		],
		tags: []
	};

	describe('isEmployeeContact', () => {
		it('should detect Employee tag with direct name', () => {
			expect(isEmployeeContact(employeeContact)).toBe(true);
		});

		it('should detect Employee tag with nested tag object and plural name', () => {
			expect(isEmployeeContact(locationEmployeeContact)).toBe(true);
		});

		it('should return false for non-employee tags', () => {
			expect(isEmployeeContact(nonEmployeeContact)).toBe(false);
		});

		it('should return false for empty or missing tags', () => {
			expect(isEmployeeContact(locationGeneralContact)).toBe(false);
			expect(isEmployeeContact(null)).toBe(false);
		});
	});

	describe('extractContactDetails', () => {
		it('should extract primary details in standard mode', () => {
			const details = extractContactDetails(nonEmployeeContact);
			expect(details).toEqual({
				name: 'Alice Visitor',
				email: 'alice.home@example.com',
				phone: '+987654321',
				qrCodePath: '/api/contacts/c1/qr.png',
				qrCodeDataUrl: undefined
			});
		});

		it('should extract work details in filterWorkOnly mode', () => {
			const details = extractContactDetails(nonEmployeeContact, { filterWorkOnly: true });
			expect(details).toEqual({
				name: 'Alice Visitor',
				email: 'alice.work@example.com',
				phone: '+123456789',
				qrCodePath: '/api/contacts/c1/qr.png',
				qrCodeDataUrl: undefined
			});
		});
	});

	describe('resolveLocationContactSync', () => {
		it('should pick first Employee contact from location contacts', () => {
			const locationData = {
				id: 'loc1',
				name: 'Main Hall',
				locationContacts: [
					{ contact: locationGeneralContact },
					{ contact: locationEmployeeContact }
				]
			};

			const result = resolveLocationContactSync(locationData);
			expect(result?.name).toBe('Charlie Caretaker');
			expect(result?.email).toBe('charlie.caretaker@venue.com');
		});

		it('should fall back to first location contact when no Employee tag is present', () => {
			const locationData = {
				id: 'loc1',
				name: 'Main Hall',
				locationContacts: [
					{ contact: locationGeneralContact }
				]
			};

			const result = resolveLocationContactSync(locationData);
			expect(result?.name).toBe('Venue Front Desk');
		});

		it('should return null when location has no contacts', () => {
			const locationData = { id: 'loc1', locationContacts: [] };
			expect(resolveLocationContactSync(locationData)).toBeNull();
		});
	});

	describe('resolveEventContactSync (Algorithm hierarchy)', () => {
		it('Priority 1: Should pick event Employee contact even if location has Employee contact', () => {
			const eventData = {
				id: 'evt1',
				contacts: [
					{ contact: nonEmployeeContact },
					{ contact: employeeContact }
				],
				locations: [
					{
						location: {
							id: 'loc1',
							locationContacts: [{ contact: locationEmployeeContact }]
						}
					}
				]
			};

			const result = resolveEventContactSync(eventData);
			expect(result?.name).toBe('Bob Staff');
			expect(result?.email).toBe('bob.staff@org.com');
		});

		it('Priority 2: Should fall back to Location Employee contact when event has no Employee-tagged contacts', () => {
			const eventData = {
				id: 'evt1',
				contacts: [
					{ contact: nonEmployeeContact } // Non-employee
				],
				locations: [
					{
						location: {
							id: 'loc1',
							locationContacts: [
								{ contact: locationGeneralContact },
								{ contact: locationEmployeeContact } // Employee
							]
						}
					}
				]
			};

			const result = resolveEventContactSync(eventData);
			expect(result?.name).toBe('Charlie Caretaker');
			expect(result?.email).toBe('charlie.caretaker@venue.com');
		});

		it('Priority 2 (from resource location): Should check resource locations for Employee contact', () => {
			const eventData = {
				id: 'evt1',
				contacts: [],
				locations: [],
				resources: [
					{
						resource: {
							id: 'res1',
							location: {
								id: 'loc1',
								locationContacts: [{ contact: locationEmployeeContact }]
							}
						}
					}
				]
			};

			const result = resolveEventContactSync(eventData);
			expect(result?.name).toBe('Charlie Caretaker');
		});

		it('Priority 3 (Fallback): Should fall back to event contact when neither event nor location has Employee tags', () => {
			const eventData = {
				id: 'evt1',
				contacts: [{ contact: nonEmployeeContact }],
				locations: [
					{
						location: {
							id: 'loc1',
							locationContacts: [{ contact: locationGeneralContact }]
						}
					}
				]
			};

			const result = resolveEventContactSync(eventData);
			expect(result?.name).toBe('Alice Visitor');
		});

		it('Priority 3 (Fallback): Should fall back to location contact when event has no contacts and no Employee tags', () => {
			const eventData = {
				id: 'evt1',
				contacts: [],
				locations: [
					{
						location: {
							id: 'loc1',
							locationContacts: [{ contact: locationGeneralContact }]
						}
					}
				]
			};

			const result = resolveEventContactSync(eventData);
			expect(result?.name).toBe('Venue Front Desk');
		});

		it('should return null when no contacts exist anywhere', () => {
			const eventData = { id: 'evt1', contacts: [], locations: [] };
			expect(resolveEventContactSync(eventData)).toBeNull();
		});
	});

	describe('resolveAnnouncementContactSync', () => {
		it('should resolve announcement employee first, then location employee, then fallback', () => {
			const annDataWithEmployee = {
				contacts: [{ contact: employeeContact }],
				locations: [{ location: { locationContacts: [{ contact: locationEmployeeContact }] } }]
			};
			expect(resolveAnnouncementContactSync(annDataWithEmployee)?.name).toBe('Bob Staff');

			const annDataWithLocEmployee = {
				contacts: [{ contact: nonEmployeeContact }],
				locations: [{ location: { locationContacts: [{ contact: locationEmployeeContact }] } }]
			};
			expect(resolveAnnouncementContactSync(annDataWithLocEmployee)?.name).toBe('Charlie Caretaker');

			const annDataFallback = {
				contacts: [{ contact: nonEmployeeContact }],
				locations: [{ location: { locationContacts: [{ contact: locationGeneralContact }] } }]
			};
			expect(resolveAnnouncementContactSync(annDataFallback)?.name).toBe('Alice Visitor');
		});
	});
});
