import { describe, it, expect } from 'vitest';
import {
	isEmployeeContact,
	isContactRole,
	isResponsibleRole,
	isModeratorRole,
	getContactPriorityRank,
	sortContactsByPriority,
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

	describe('Role and Tag Priority Hierarchy', () => {
		const contactRoleEng = { displayName: 'John Contact', roles: [{ name: 'Contact' }] };
		const contactRoleDe = { displayName: 'Hans Kontakt', roles: [{ name: 'Kontakt' }] };
		const responsibleRoleEng = { displayName: 'Jane Responsible', roles: [{ name: 'Responsible' }] };
		const responsibleRoleDe = { displayName: 'Greta Verantwortlich', roles: [{ name: 'Verantwortlich' }] };
		const moderatorRole = { displayName: 'Max Moderator', roles: [{ name: 'Moderator' }] };
		const employeeTagged = { displayName: 'Eva Employee', tags: [{ name: 'Employee' }] };
		const regularContact = { displayName: 'Otto Other' };

		it('should detect Contact / Kontakt roles (Tier 1)', () => {
			expect(isContactRole(contactRoleEng)).toBe(true);
			expect(isContactRole(contactRoleDe)).toBe(true);
			expect(isContactRole({ roles: ['Main Contact'] })).toBe(true);
			expect(isContactRole({ roles: ['Hauptkontakt'] })).toBe(true);
			expect(isContactRole(responsibleRoleEng)).toBe(false);
		});

		it('should detect Responsible / Verantwortlich roles (Tier 2)', () => {
			expect(isResponsibleRole(responsibleRoleEng)).toBe(true);
			expect(isResponsibleRole(responsibleRoleDe)).toBe(true);
			expect(isResponsibleRole(contactRoleEng)).toBe(false);
		});

		it('should detect Moderator role (Tier 3)', () => {
			expect(isModeratorRole(moderatorRole)).toBe(true);
			expect(isModeratorRole(contactRoleEng)).toBe(false);
		});

		it('should calculate priority ranks 1 to 5', () => {
			expect(getContactPriorityRank(contactRoleEng)).toBe(1);
			expect(getContactPriorityRank(contactRoleDe)).toBe(1);
			expect(getContactPriorityRank(responsibleRoleEng)).toBe(2);
			expect(getContactPriorityRank(responsibleRoleDe)).toBe(2);
			expect(getContactPriorityRank(moderatorRole)).toBe(3);
			expect(getContactPriorityRank(employeeTagged)).toBe(4);
			expect(getContactPriorityRank(regularContact)).toBe(5);
		});

		it('should sort contacts by priority (Tier 1 -> Tier 2 -> Tier 3 -> Tier 4 -> Tier 5)', () => {
			const unsorted = [
				regularContact,
				employeeTagged,
				moderatorRole,
				responsibleRoleEng,
				contactRoleDe,
				contactRoleEng
			];

			const sorted = sortContactsByPriority(unsorted);
			expect(sorted.map(c => c.displayName)).toEqual([
				'Hans Kontakt',      // Tier 1 (H before J)
				'John Contact',      // Tier 1
				'Jane Responsible',  // Tier 2
				'Max Moderator',     // Tier 3
				'Eva Employee',      // Tier 4
				'Otto Other'         // Tier 5
			]);
		});
	});

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
				id: 'c1',
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
				id: 'c1',
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
			expect(result?.id).toBe('c2');
		});

		it('Priority 1 (Event Role Tier 1): Should pick Contact/Kontakt role over Responsible, Moderator, and Employee', () => {
			const eventData = {
				id: 'evt1',
				contacts: [
					{ contact: employeeContact }, // Tier 4
					{
						contact: {
							id: 'c-mod',
							displayName: 'Molly Mod',
							emails: [{ type: 'work', value: 'mod@org.com', primary: true }]
						},
						roles: [{ name: 'Moderator' }] // Tier 3
					},
					{
						contact: {
							id: 'c-resp',
							displayName: 'Ron Resp',
							emails: [{ type: 'work', value: 'resp@org.com', primary: true }]
						},
						roles: [{ name: 'Responsible' }] // Tier 2
					},
					{
						contact: {
							id: 'c-main',
							displayName: 'Connie Contact',
							emails: [{ type: 'work', value: 'connie@org.com', primary: true }]
						},
						roles: [{ name: 'Kontakt' }] // Tier 1
					}
				]
			};

			const result = resolveEventContactSync(eventData);
			expect(result?.name).toBe('Connie Contact');
			expect(result?.id).toBe('c-main');
		});

		it('Priority: Does NOT fall back to Location contact when event has associated contacts', () => {
			const eventData = {
				id: 'evt1',
				contacts: [
					{ contact: nonEmployeeContact } // Non-employee event contact
				],
				locations: [
					{
						location: {
							id: 'loc1',
							locationContacts: [
								{ contact: locationGeneralContact },
								{ contact: locationEmployeeContact } // Location employee
							]
						}
					}
				]
			};

			// Resolution ends at event contacts; does not query or fall back to location contacts
			const result = resolveEventContactSync(eventData);
			expect(result?.name).toBe('Alice Visitor');
			expect(result?.id).toBe('c1');
		});

		it('Priority (fallback): Falls back to Location Employee contact when event has NO contacts', () => {
			const eventData = {
				id: 'evt1',
				contacts: [],
				locations: [
					{
						location: {
							id: 'loc1',
							locationContacts: [
								{ contact: locationGeneralContact },
								{ contact: locationEmployeeContact } // Location employee
							]
						}
					}
				]
			};

			const result = resolveEventContactSync(eventData);
			expect(result?.name).toBe('Charlie Caretaker');
			expect(result?.email).toBe('charlie.caretaker@venue.com');
			expect(result?.id).toBe('c3');
		});

		it('Priority (from resource location): Should check resource locations when event has NO contacts', () => {
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
			expect(result?.id).toBe('c3');
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
			expect(result?.id).toBe('c1');
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
			expect(result?.id).toBe('c4');
		});

		it('should return null when no contacts exist anywhere', () => {
			const eventData = { id: 'evt1', contacts: [], locations: [] };
			expect(resolveEventContactSync(eventData)).toBeNull();
		});
	});

	describe('resolveAnnouncementContactSync', () => {
		it('should resolve announcement contact without falling back to location when contacts exist', () => {
			const annDataWithEmployee = {
				contacts: [{ contact: employeeContact }],
				locations: [{ location: { locationContacts: [{ contact: locationEmployeeContact }] } }]
			};
			expect(resolveAnnouncementContactSync(annDataWithEmployee)?.name).toBe('Bob Staff');

			const annDataWithOwnContact = {
				contacts: [{ contact: nonEmployeeContact }],
				locations: [{ location: { locationContacts: [{ contact: locationEmployeeContact }] } }]
			};
			expect(resolveAnnouncementContactSync(annDataWithOwnContact)?.name).toBe('Alice Visitor');

			const annDataEmptyContacts = {
				contacts: [],
				locations: [{ location: { locationContacts: [{ contact: locationEmployeeContact }] } }]
			};
			expect(resolveAnnouncementContactSync(annDataEmptyContacts)?.name).toBe('Charlie Caretaker');
		});
	});

	describe('Public Privacy Protections (publicOnly & filterWorkOnly)', () => {
		const privateEmployee = {
			id: 'c-priv-emp',
			isPublic: false,
			displayName: 'Private Employee',
			emails: [{ type: 'work', value: 'priv.emp@org.com', primary: true }],
			phones: [{ type: 'work', value: '+111', primary: true }],
			tags: [{ name: 'Employee' }]
		};

		const publicEmployee = {
			id: 'c-pub-emp',
			isPublic: true,
			displayName: 'Public Employee',
			emails: [
				{ type: 'home', value: 'pub.personal@gmail.com', primary: true },
				{ type: 'work', value: 'pub.emp@org.com', primary: false }
			],
			phones: [
				{ type: 'mobile', value: '+999-PRIVATE', primary: true },
				{ type: 'work', value: '+222-WORK', primary: false }
			],
			tags: [{ name: 'Employee' }]
		};

		const obfuscatedPublicEmployee = {
			id: 'c-obf-emp',
			isPublic: true,
			obfuscationStatus: 'obfuscated',
			displayName: 'Obfuscated Employee',
			emails: [{ type: 'work', value: 'obf@org.com', primary: true }],
			tags: [{ name: 'Employee' }]
		};

		it('never resolves obfuscated contacts even in internal mode', () => {
			const eventData = {
				id: 'evt-obf',
				contacts: [{ contact: obfuscatedPublicEmployee }]
			};
			expect(resolveEventContactSync(eventData)).toBeNull();
		});

		it('skips non-public contacts when publicOnly or filterWorkOnly is true', () => {
			const eventWithPrivateOnly = {
				id: 'evt-1',
				contacts: [{ contact: privateEmployee }]
			};

			expect(resolveEventContactSync(eventWithPrivateOnly)).toBeNull();
			expect(resolveEventContactSync(eventWithPrivateOnly, { publicOnly: true })).toBeNull();
			expect(resolveEventContactSync(eventWithPrivateOnly, { filterWorkOnly: true })).toBeNull();

			const eventWithBoth = {
				id: 'evt-2',
				contacts: [{ contact: privateEmployee }, { contact: publicEmployee }]
			};

			const resolved = resolveEventContactSync(eventWithBoth, { publicOnly: true, filterWorkOnly: true });
			expect(resolved).toEqual({
				id: 'c-pub-emp',
				name: 'Public Employee',
				email: 'pub.emp@org.com',
				phone: '+222-WORK',
				isPublic: true,
				qrCodePath: '/api/contacts/c-pub-emp/qr.png',
				qrCodeDataUrl: undefined
			});
		});

		it('skips contacts from non-public locations when publicOnly or filterWorkOnly is true', () => {
			const eventWithPrivateLocation = {
				id: 'evt-loc-priv',
				contacts: [],
				locations: [
					{
						location: {
							id: 'loc-priv',
							isPublic: false,
							locationContacts: [{ contact: publicEmployee }]
						}
					}
				]
			};

			expect(resolveEventContactSync(eventWithPrivateLocation, { publicOnly: true })).toBeNull();
			expect(resolveEventContactSync(eventWithPrivateLocation, { filterWorkOnly: true })).toBeNull();
			expect(
				resolveLocationContactSync(
					{
						id: 'loc-priv',
						isPublic: false,
						locationContacts: [{ contact: publicEmployee }]
					},
					{ publicOnly: true }
				)
			).toBeNull();
		});
	});
});
