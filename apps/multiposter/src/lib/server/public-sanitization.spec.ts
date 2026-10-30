import { describe, it, expect } from 'vitest';
import {
	isPublicTag,
	filterPublicTags,
	isPublicContact,
	filterWorkEmails,
	filterWorkPhones,
	filterWorkAddresses,
	extractPublicWorkContactInfo,
	sanitizePublicContact,
	isPublicLocation,
	sanitizePublicLocation,
	filterPublicLocations,
	sanitizePublicPrice,
	isPublicEvent,
	sanitizePublicEvent,
	isPublicAnnouncement,
	sanitizePublicAnnouncement
} from './public-sanitization';

describe('Centralized Public Sanitization', () => {
	describe('Tags (isPublicTag & filterPublicTags)', () => {
		it('allows only external tags and filters out internal or untyped tags', () => {
			const extTag = { id: 't1', name: 'Music', visibility: 'external', user: { id: 'u1' } };
			const intTag = { id: 't2', name: 'Internal Audit', visibility: 'internal' };
			const nestedExtTag = { tag: { id: 't3', name: 'Workshop', visibility: 'external', userId: 'u1' } };
			const nestedIntTag = { tag: { id: 't4', name: 'Secret Staff', visibility: 'internal' } };

			expect(isPublicTag(extTag)).toBe(true);
			expect(isPublicTag(intTag)).toBe(false);
			expect(isPublicTag(nestedExtTag)).toBe(true);
			expect(isPublicTag(nestedIntTag)).toBe(false);
			expect(isPublicTag({ id: 't5', name: 'Default' })).toBe(false);
			expect(isPublicTag(null)).toBe(false);

			const filtered = filterPublicTags([extTag, intTag, nestedExtTag, nestedIntTag]);
			expect(filtered).toEqual([
				{ id: 't1', name: 'Music', visibility: 'external' },
				{ id: 't3', name: 'Workshop', visibility: 'external' }
			]);
		});
	});

	describe('Contacts (isPublicContact, work-only filters & sanitizePublicContact)', () => {
		const publicContact = {
			id: 'c-pub',
			isPublic: true,
			obfuscationStatus: 'none',
			displayName: 'Jane Public',
			givenName: 'Jane',
			familyName: 'Public',
			notes: 'Confidential HR note',
			birthday: new Date('1990-01-01'),
			emails: [
				{ id: 'e1', value: 'jane.personal@gmail.com', type: 'home', primary: true },
				{ id: 'e2', value: 'jane@company.org', type: 'work', primary: false }
			],
			phones: [
				{ id: 'p1', value: '+49-170-PRIVATE', type: 'mobile', primary: true },
				{ id: 'p2', value: '+49-30-WORK', type: 'work', primary: false }
			],
			addresses: [
				{ id: 'a1', street: 'Private Home St', type: 'home', primary: true },
				{ id: 'a2', street: 'Office Plaza 1', city: 'Berlin', type: 'work', primary: false }
			],
			tags: [
				{ tag: { id: 't-ext', name: 'Employee', visibility: 'external' } },
				{ tag: { id: 't-int', name: 'Salary Band 4', visibility: 'internal' } }
			],
			relations: [{ id: 'r1', targetContactId: 'c-secret' }],
			imHandles: [{ id: 'im1', value: '@jane_private' }]
		};

		const privateContact = {
			...publicContact,
			id: 'c-priv',
			isPublic: false
		};

		const obfuscatedPublicContact = {
			...publicContact,
			id: 'c-obf',
			isPublic: true,
			obfuscationStatus: 'obfuscated'
		};

		it('identifies only non-obfuscated public contacts as public', () => {
			expect(isPublicContact(publicContact)).toBe(true);
			expect(isPublicContact({ contact: publicContact })).toBe(true);
			expect(isPublicContact(privateContact)).toBe(false);
			expect(isPublicContact(obfuscatedPublicContact)).toBe(false);
			expect(isPublicContact({ id: 'c-unset' })).toBe(false);
			expect(isPublicContact(null)).toBe(false);
		});

		it('filters emails, phones, and addresses strictly to work type', () => {
			expect(filterWorkEmails(publicContact.emails)).toEqual([
				{ id: 'e2', value: 'jane@company.org', type: 'work', primary: false }
			]);
			expect(filterWorkPhones(publicContact.phones)).toEqual([
				{ id: 'p2', value: '+49-30-WORK', type: 'work', primary: false }
			]);
			expect(filterWorkAddresses(publicContact.addresses)).toEqual([
				{
					id: 'a2',
					street: 'Office Plaza 1',
					houseNumber: null,
					addressSuffix: null,
					zip: null,
					city: 'Berlin',
					state: null,
					country: null,
					type: 'work',
					primary: false
				}
			]);
		});

		it('extracts public work contact info and returns null for private contacts', () => {
			expect(extractPublicWorkContactInfo(privateContact)).toBeNull();
			expect(extractPublicWorkContactInfo(obfuscatedPublicContact)).toBeNull();

			const extracted = extractPublicWorkContactInfo(publicContact);
			expect(extracted).toEqual({
				name: 'Jane Public',
				email: 'jane@company.org',
				phone: '+49-30-WORK'
			});
		});

		it('sanitizes public contact by stripping notes, birthday, relations, personal channels, and internal tags', () => {
			expect(sanitizePublicContact(privateContact)).toBeNull();
			expect(sanitizePublicContact(obfuscatedPublicContact)).toBeNull();

			const sanitized = sanitizePublicContact(publicContact)!;
			expect(sanitized).not.toBeNull();
			expect(sanitized.id).toBe('c-pub');
			expect(sanitized.displayName).toBe('Jane Public');
			expect(sanitized.emails).toEqual([{ id: 'e2', value: 'jane@company.org', type: 'work', primary: false }]);
			expect(sanitized.phones).toEqual([{ id: 'p2', value: '+49-30-WORK', type: 'work', primary: false }]);
			expect(sanitized.addresses).toHaveLength(1);
			expect(sanitized.addresses[0].street).toBe('Office Plaza 1');
			expect(sanitized.tags).toEqual([
				{ tag: { id: 't-ext', name: 'Employee', visibility: 'external' } }
			]);
			expect(sanitized).not.toHaveProperty('notes');
			expect(sanitized).not.toHaveProperty('birthday');
			expect(sanitized.relations).toEqual([]);
			expect(sanitized).not.toHaveProperty('imHandles');
		});
	});

	describe('Locations (isPublicLocation & sanitizePublicLocation)', () => {
		const publicLoc = {
			id: 'loc-pub',
			name: 'Public Arena',
			isPublic: true,
			street: 'Arena Way',
			city: 'Berlin',
			internalSecret: 'door-code-1234',
			locationContacts: [
				{
					contact: {
						id: 'c-priv-emp',
						isPublic: false,
						displayName: 'Secret Manager',
						emails: [{ value: 'secret@arena.de', type: 'work', primary: true }],
						tags: [{ name: 'Employee' }]
					}
				},
				{
					contact: {
						id: 'c-pub-emp',
						isPublic: true,
						displayName: 'Public Info Desk',
						emails: [
							{ value: 'personal@gmail.com', type: 'home', primary: true },
							{ value: 'info@arena.de', type: 'work', primary: false }
						],
						phones: [{ value: '+49-111', type: 'work', primary: true }],
						tags: [{ name: 'Employee' }]
					}
				}
			]
		};

		const privateLoc = {
			id: 'loc-priv',
			name: 'Secret Warehouse',
			isPublic: false
		};

		it('filters out non-public locations and strips raw locationContacts while resolving public work contact', () => {
			expect(isPublicLocation(publicLoc)).toBe(true);
			expect(isPublicLocation(privateLoc)).toBe(false);
			expect(sanitizePublicLocation(privateLoc)).toBeNull();

			const sanitized = sanitizePublicLocation(publicLoc, { resolveContact: true })!;
			expect(sanitized.id).toBe('loc-pub');
			expect(sanitized.name).toBe('Public Arena');
			expect(sanitized).not.toHaveProperty('internalSecret');
			expect(sanitized).not.toHaveProperty('locationContacts');
			expect(sanitized.resolvedContact).toEqual({
				id: 'c-pub-emp',
				name: 'Public Info Desk',
				email: 'info@arena.de',
				phone: '+49-111',
				isPublic: true,
				qrCodePath: '/api/contacts/c-pub-emp/qr.png',
				qrCodeDataUrl: undefined
			});

			const list = filterPublicLocations([publicLoc, privateLoc]);
			expect(list).toHaveLength(1);
			expect(list[0].id).toBe('loc-pub');
		});
	});

	describe('Prices (sanitizePublicPrice)', () => {
		it('strips internal cost fields and internal item tags', () => {
			const rawPrice = {
				id: 'pr-1',
				name: 'Standard Admission',
				currency: 'EUR',
				costPrice: '3.50',
				totalCostPerPortion: '4.10',
				items: [
					{
						id: 'item-1',
						priceId: 'pr-1',
						itemType: 'consumable',
						name: 'Standard Ticket',
						unitPrice: 15,
						portionAmount: 1,
						internalMargin: 0.75,
						consumable: { id: 'cons-1', secretSupplier: 'Acme' },
						tags: [
							{ tag: { id: 't1', name: 'BoxOffice', visibility: 'external' } },
							{ tag: { id: 't2', name: 'HighMargin', visibility: 'internal' } }
						]
					}
				]
			};

			const sanitized = sanitizePublicPrice(rawPrice)!;
			expect(sanitized.totalPricePerPortion).toBe(15);
			expect(sanitized).not.toHaveProperty('costPrice');
			expect(sanitized).not.toHaveProperty('totalCostPerPortion');
			expect(sanitized.items[0]).not.toHaveProperty('internalMargin');
			expect(sanitized.items[0]).not.toHaveProperty('consumable');
			expect(sanitized.items[0].tags).toEqual([
				{ id: 't1', name: 'BoxOffice', visibility: 'external' }
			]);
		});
	});

	describe('Events (sanitizePublicEvent)', () => {
		it('returns null for non-public events', () => {
			expect(
				sanitizePublicEvent({
					id: 'evt-priv',
					summary: 'Private Board Meeting',
					isPublic: false
				})
			).toBeNull();
		});

		it('strictly sanitizes a public event, removing private contacts, non-public locations, internal tags, and non-public series instances', () => {
			const rawEvent = {
				id: 'evt-pub',
				summary: 'Public Festival',
				description: 'Welcome everyone',
				isPublic: true,
				status: 'confirmed',
				internalNotes: 'VIP security arrives at 08:00',
				userId: 'user-secret',
				user: { id: 'user-secret', email: 'admin@internal.org' },
				campaignId: 'camp-secret',
				campaign: { id: 'camp-secret' },
				contacts: [
					{
						contact: {
							id: 'c-priv',
							isPublic: false,
							displayName: 'Private Staff',
							emails: [{ value: 'private.staff@internal.org', type: 'work', primary: true }],
							tags: [{ name: 'Employee' }]
						}
					},
					{
						contact: {
							id: 'c-pub',
							isPublic: true,
							displayName: 'Public Coordinator',
							emails: [
								{ value: 'coord.home@gmail.com', type: 'home', primary: true },
								{ value: 'coord@festival.org', type: 'work', primary: false }
							],
							phones: [
								{ value: '+49-PRIVATE', type: 'mobile', primary: true },
								{ value: '+49-WORK', type: 'work', primary: false }
							],
							tags: [{ name: 'Employee' }]
						}
					}
				],
				contactRoles: { 'c-priv': ['Organizer'] },
				locations: [
					{
						location: {
							id: 'loc-pub',
							name: 'Main Stage',
							isPublic: true
						}
					},
					{
						location: {
							id: 'loc-priv',
							name: 'Backstage Bunker',
							isPublic: false
						}
					}
				],
				resources: [
					{
						resource: {
							id: 'res-pub',
							name: 'Hall A',
							type: 'room',
							locationId: 'loc-pub',
							location: { id: 'loc-pub', isPublic: true }
						}
					},
					{
						resource: {
							id: 'res-priv',
							name: 'Secret Vault Room',
							type: 'room',
							locationId: 'loc-priv',
							location: { id: 'loc-priv', isPublic: false }
						}
					}
				],
				tags: [
					{ id: 't-ext', name: 'Festival', visibility: 'external' },
					{ id: 't-int', name: 'NeedsSecurity', visibility: 'internal' }
				],
				seriesMaster: {
					id: 'master-priv',
					summary: 'Private Master',
					isPublic: false
				},
				instances: [
					{
						id: 'inst-pub',
						summary: 'Day 1',
						isPublic: true,
						startDateTime: new Date('2026-07-01T10:00:00Z'),
						endDateTime: new Date('2026-07-01T12:00:00Z')
					},
					{
						id: 'inst-priv',
						summary: 'Private Rehearsal Day',
						isPublic: false,
						startDateTime: new Date('2026-07-02T10:00:00Z'),
						endDateTime: new Date('2026-07-02T12:00:00Z')
					}
				],
				// Pre-resolved contact that accidentally had private contact
				resolvedContact: {
					id: 'c-priv',
					name: 'Private Staff',
					email: 'private.staff@internal.org',
					phone: '+49-SECRET'
				}
			};

			const sanitized = sanitizePublicEvent(rawEvent)!;
			expect(sanitized).not.toBeNull();
			expect(sanitized.id).toBe('evt-pub');

			// Sensitive properties stripped or emptied
			expect(sanitized).not.toHaveProperty('internalNotes');
			expect(sanitized).not.toHaveProperty('user');
			expect(sanitized).not.toHaveProperty('userId');
			expect(sanitized).not.toHaveProperty('campaign');
			expect(sanitized).not.toHaveProperty('campaignId');
			expect(sanitized).not.toHaveProperty('contactRoles');
			expect(sanitized.contacts).toEqual([]);
			expect(sanitized.contactIds).toEqual([]);
			expect(sanitized.syncIds).toEqual([]);

			// Locations, resources & rooms filtered to public only
			expect(sanitized.locations).toHaveLength(1);
			expect(sanitized.locations[0].id).toBe('loc-pub');
			expect(sanitized.locationIds).toEqual(['loc-pub']);
			expect(sanitized.resources).toHaveLength(1);
			expect(sanitized.resources[0].id).toBe('res-pub');
			expect(sanitized.rooms).toEqual(['Hall A']);

			// Tags filtered to external only
			expect(sanitized.tags).toEqual([
				{ id: 't-ext', name: 'Festival', visibility: 'external' }
			]);
			expect(sanitized.tagIds).toEqual(['t-ext']);

			// Non-public series master and instances removed
			expect(sanitized.seriesMaster).toBeUndefined();
			expect(sanitized.instances).toHaveLength(1);
			expect(sanitized.instances[0].id).toBe('inst-pub');

			// Resolved contact re-evaluated strictly with publicOnly + filterWorkOnly
			expect(sanitized.resolvedContact).toEqual({
				id: 'c-pub',
				name: 'Public Coordinator',
				email: 'coord@festival.org',
				phone: '+49-WORK',
				isPublic: true,
				qrCodePath: '/api/contacts/c-pub/qr.png',
				qrCodeDataUrl: undefined
			});
		});

		it('drops pre-resolved resolvedContact if isPublic is not strictly true when raw contacts are empty', () => {
			const cachedEventWithUnverifiedContact = {
				id: 'evt-cached',
				summary: 'Cached Event',
				isPublic: true,
				status: 'confirmed',
				contacts: [],
				locations: [],
				resolvedContact: {
					id: 'c-priv',
					name: 'Leaked Private Contact',
					email: 'secret@org.com',
					phone: '+49-999'
				}
			};

			const sanitized = sanitizePublicEvent(cachedEventWithUnverifiedContact)!;
			expect(sanitized.resolvedContact).toBeNull();
		});
	});

	describe('Announcements (sanitizePublicAnnouncement)', () => {
		it('returns null for non-public announcements and strips private relations on public announcements', () => {
			expect(
				sanitizePublicAnnouncement({
					id: 'ann-priv',
					title: 'Internal Memo',
					isPublic: false
				})
			).toBeNull();

			const rawAnn = {
				id: 'ann-pub',
				title: 'Public Notice',
				content: 'Hello world',
				isPublic: true,
				status: 'published',
				user: { id: 'u1', email: 'secret@org.com' },
				contacts: [
					{
						contact: {
							id: 'c-priv',
							isPublic: false,
							displayName: 'Hidden Author',
							emails: [{ value: 'hidden@org.com', type: 'work' }],
							tags: [{ name: 'Employee' }]
						}
					}
				],
				locations: [
					{ location: { id: 'loc-priv', name: 'Private Room', isPublic: false } },
					{ location: { id: 'loc-pub', name: 'Lobby', isPublic: true } }
				],
				tags: [
					{ tag: { id: 't-int', name: 'DraftReview', visibility: 'internal' } },
					{ tag: { id: 't-ext', name: 'News', visibility: 'external' } }
				]
			};

			const sanitized = sanitizePublicAnnouncement(rawAnn)!;
			expect(sanitized.id).toBe('ann-pub');
			expect(sanitized).not.toHaveProperty('user');
			expect(sanitized.contacts).toEqual([]);
			expect(sanitized.contactIds).toEqual([]);
			expect(sanitized.locations).toHaveLength(1);
			expect(sanitized.locations[0].id).toBe('loc-pub');
			expect(sanitized.tags).toEqual([
				{ id: 't-ext', name: 'News', visibility: 'external' }
			]);
			expect(sanitized.resolvedContact).toBeNull();
		});
	});
});
