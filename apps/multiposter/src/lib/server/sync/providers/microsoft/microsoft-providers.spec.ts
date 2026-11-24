import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@ac/db';
import { MicrosoftGraphClient } from './client';
import { MicrosoftContactsProvider } from './contacts';
import { MicrosoftResourceProvider } from './resources';

vi.mock('@ac/db', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@ac/db')>();
	return {
		...actual,
		db: {
			select: vi.fn(),
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		}
	};
});

describe('Microsoft Sync Suite', () => {
	describe('MicrosoftGraphClient', () => {
		let client: MicrosoftGraphClient;

		beforeEach(() => {
			vi.clearAllMocks();
			client = new MicrosoftGraphClient();
		});

		it('should resolve personal mailbox base URL when user is authenticated and mailboxEmail is unset', () => {
			(client as any).config = {
				authMode: 'user',
				calendarId: 'primary'
			};
			(client as any).resolvedAuthMode = 'user';

			expect(client.getMailboxBaseUrl()).toBe('https://graph.microsoft.com/v1.0/me');
			expect(client.getCalendarBaseUrl()).toBe('https://graph.microsoft.com/v1.0/me/calendar');
			expect(client.getContactsBaseUrl()).toBe('https://graph.microsoft.com/v1.0/me/contacts');
		});

		it('should resolve detached mailbox URL when targeting shared email', () => {
			(client as any).config = {
				authMode: 'app',
				mailboxEmail: 'veranstaltung.bhs@ballev.onmicrosoft.com',
				calendarId: 'primary'
			};
			(client as any).resolvedAuthMode = 'app';

			const expectedMailbox = 'https://graph.microsoft.com/v1.0/users/veranstaltung.bhs%40ballev.onmicrosoft.com';
			expect(client.getMailboxBaseUrl()).toBe(expectedMailbox);
			expect(client.getCalendarBaseUrl()).toBe(`${expectedMailbox}/calendar`);
			expect(client.getContactsBaseUrl()).toBe(`${expectedMailbox}/contacts`);
		});

		it('should append folderId to contacts base URL when specified', () => {
			(client as any).config = {
				authMode: 'user',
				folderId: 'folder-abc-123'
			};
			(client as any).resolvedAuthMode = 'user';

			expect(client.getContactsBaseUrl()).toBe(
				'https://graph.microsoft.com/v1.0/me/contactFolders/folder-abc-123/contacts'
			);
		});

		it('should throw an informative error if app credentials are used without a target mailbox', () => {
			(client as any).config = {
				authMode: 'app',
				mailboxEmail: ''
			};
			(client as any).resolvedAuthMode = 'app';

			expect(() => client.getMailboxBaseUrl()).toThrow(/must be configured in settings/);
		});

		it('should produce structured diagnostic output on testCalendarTarget failure', async () => {
			(client as any).config = {
				authMode: 'app',
				mailboxEmail: 'veranstaltung.bhs@ballev.onmicrosoft.com'
			};
			(client as any).resolvedAuthMode = 'app';
			(client as any).accessToken = 'mock-token';

			vi.spyOn(client, 'makeRequest').mockRejectedValueOnce(
				new Error('Target Microsoft 365 mailbox "veranstaltung.bhs@ballev.onmicrosoft.com" was not found')
			);

			const result = await client.testCalendarTarget();
			expect(result.success).toBe(false);
			expect(result.error).toContain('veranstaltung.bhs@ballev.onmicrosoft.com');
		});

		it('should return success and details on testCalendarTarget success', async () => {
			(client as any).config = {
				authMode: 'user',
				calendarId: 'primary'
			};
			(client as any).resolvedAuthMode = 'user';
			(client as any).accessToken = 'mock-token';

			vi.spyOn(client, 'makeRequest').mockResolvedValueOnce({
				id: 'cal-primary',
				name: 'Calendar',
				owner: { name: 'Test User', address: 'test@example.com' }
			});

			const result = await client.testCalendarTarget();
			expect(result.success).toBe(true);
			expect(result.displayName).toBe('Calendar');
			expect(result.details?.owner?.address).toBe('test@example.com');
		});

		it('should list calendars across top-level and calendarGroups, and resolve currentCalendarId', async () => {
			(client as any).config = { authMode: 'user' };
			(client as any).resolvedAuthMode = 'user';
			(client as any).accessToken = 'mock-token';

			const makeRequestMock = vi.spyOn(client, 'makeRequest');

			// 1. /calendars top-level
			makeRequestMock.mockResolvedValueOnce({
				value: [
					{ id: 'cal-default-id', name: 'Kalender', isDefaultCalendar: true, canEdit: true }
				]
			});

			// 2. /calendarGroups
			makeRequestMock.mockResolvedValueOnce({
				value: [
					{
						id: 'group-1',
						name: 'Shared Calendars',
						calendars: [
							{ id: 'cal-shared-1', name: 'Gemeindesaal', isDefaultCalendar: false, canEdit: true, owner: { name: 'Church Hall' } }
						]
					}
				]
			});

			// 3. /calendar (primary)
			makeRequestMock.mockResolvedValueOnce({
				id: 'cal-default-id',
				name: 'Kalender',
				isDefaultCalendar: true
			});

			// 4. /calendars/{specificId} for unlisted custom ID
			makeRequestMock.mockResolvedValueOnce({
				id: 'AAMkAG-special-hash',
				name: 'Veranstaltungen BHS',
				isDefaultCalendar: false,
				owner: { name: 'Veranstaltungsteam', address: 'veranstaltung.bhs@ballev.onmicrosoft.com' }
			});

			const calendars = await client.listCalendars(undefined, 'AAMkAG-special-hash');

			expect(calendars.length).toBe(3);
			// Default calendar sorted first
			expect(calendars[0].id).toBe('cal-default-id');
			expect(calendars[0].isDefault).toBe(true);

			// Calendar group member
			const sharedCal = calendars.find((c) => c.id === 'cal-shared-1');
			expect(sharedCal).toBeDefined();
			expect(sharedCal?.name).toBe('Gemeindesaal');
			expect(sharedCal?.groupName).toBe('Shared Calendars');

			// Directly resolved custom calendar
			const customCal = calendars.find((c) => c.id === 'AAMkAG-special-hash');
			expect(customCal).toBeDefined();
			expect(customCal?.name).toBe('Veranstaltungen BHS');
			expect(customCal?.groupName).toBe('Saved Target');
			expect(customCal?.owner?.name).toBe('Veranstaltungsteam');
		});

		it('should list contact folders and resolve unlisted currentFolderId', async () => {
			(client as any).config = { authMode: 'user' };
			(client as any).resolvedAuthMode = 'user';
			(client as any).accessToken = 'mock-token';

			const makeRequestMock = vi.spyOn(client, 'makeRequest');

			// 1. /contactFolders
			makeRequestMock.mockResolvedValueOnce({
				value: [{ id: 'folder-main', displayName: 'Contacts' }]
			});

			// 2. /contactFolders/{specificId}
			makeRequestMock.mockResolvedValueOnce({
				id: 'folder-artists-hash',
				displayName: 'Artists & Performers'
			});

			const folders = await client.listContactFolders(undefined, 'folder-artists-hash');
			expect(folders.length).toBe(2);
			expect(folders.some((f) => f.displayName === 'Artists & Performers')).toBe(true);
		});

		it('should update organization calendar permission when current role is freeBusyRead', async () => {
			(client as any).config = {
				authMode: 'app',
				mailboxEmail: 'veranstaltung.bhs@ballev.onmicrosoft.com',
				calendarId: 'primary'
			};
			(client as any).resolvedAuthMode = 'app';
			(client as any).accessToken = 'mock-token';
			vi.spyOn(client as any, 'resolveAuthentication').mockResolvedValue(undefined);

			const makeRequestMock = vi
				.spyOn(client, 'makeRequest')
				.mockResolvedValueOnce({
					value: [
						{
							id: 'RGVmYXVsdA==',
							isRemovable: false,
							isInsideOrganization: true,
							role: 'freeBusyRead',
							allowedRoles: ['none', 'freeBusyRead', 'limitedRead', 'read', 'write'],
							emailAddress: { name: 'My Organization' }
						}
					]
				})
				.mockResolvedValueOnce({ id: 'RGVmYXVsdA==', role: 'read' });

			const res = await client.ensureOrganizationCalendarPermission('read');
			expect(res).toEqual({ updated: true, role: 'read' });
			expect(makeRequestMock).toHaveBeenNthCalledWith(
				2,
				'https://graph.microsoft.com/v1.0/users/veranstaltung.bhs%40ballev.onmicrosoft.com/calendar/calendarPermissions/RGVmYXVsdA%3D%3D',
				{
					method: 'PATCH',
					body: JSON.stringify({ role: 'read' })
				}
			);
		});
	});

	describe('MicrosoftContactsProvider', () => {
		let provider: MicrosoftContactsProvider;

		beforeEach(() => {
			vi.clearAllMocks();
			provider = new MicrosoftContactsProvider();
			provider.accessToken = 'mock-token';
		});

		it('should push a new contact with names, email, and phones mapped', async () => {
			const makeRequestMock = vi.fn().mockResolvedValueOnce({
				id: 'contact-ms-123',
				'@odata.etag': 'W/"etag-contact"'
			});
			(provider as any).client.makeRequest = makeRequestMock;

			const contact = {
				givenName: 'Ada',
				familyName: 'Lovelace',
				displayName: 'Ada Lovelace',
				company: 'Analytical Engine Corp',
				emails: [{ value: 'ada@example.com', label: 'work' }],
				phones: [{ value: '+49 170 1234567', label: 'mobile' }]
			};

			const result = await provider.pushContact(contact);
			expect(result.externalId).toBe('contact-ms-123');
			expect(makeRequestMock).toHaveBeenCalledWith(
				'https://graph.microsoft.com/v1.0/me/contacts',
				expect.objectContaining({
					method: 'POST',
					body: expect.stringContaining('"givenName":"Ada"')
				})
			);
		});

		it('should pull contacts and map them to internal format', async () => {
			const makeRequestMock = vi.fn().mockResolvedValueOnce({
				value: [
					{
						id: 'ms-c-1',
						displayName: 'Grace Hopper',
						givenName: 'Grace',
						surname: 'Hopper',
						emailAddresses: [{ address: 'grace@navy.mil', name: 'Grace Hopper' }],
						mobilePhone: '+1 555 0199',
						lastModifiedDateTime: '2026-09-01T12:00:00Z'
					}
				]
			});
			(provider as any).client.makeRequest = makeRequestMock;

			const result = await provider.pullContacts();
			expect(result.count).toBe(1);
			expect(result.contacts[0].displayName).toBe('Grace Hopper');
			expect(result.contacts[0].emails?.[0].value).toBe('grace@navy.mil');
		});

		it('should delete a contact via DELETE method', async () => {
			const makeRequestMock = vi.fn().mockResolvedValueOnce({});
			(provider as any).client.makeRequest = makeRequestMock;

			await provider.deleteContact('ms-c-1');
			expect(makeRequestMock).toHaveBeenCalledWith(
				'https://graph.microsoft.com/v1.0/me/contacts/ms-c-1',
				{ method: 'DELETE' }
			);
		});
	});

	describe('MicrosoftResourceProvider', () => {
		let provider: MicrosoftResourceProvider;

		beforeEach(() => {
			vi.clearAllMocks();
			provider = new MicrosoftResourceProvider();
			provider.accessToken = 'mock-token';
		});

		it('should list tenant rooms via graph places API', async () => {
			const makeRequestMock = vi.fn().mockResolvedValueOnce({
				value: [
					{
						id: 'room-1',
						displayName: 'Großer Saal',
						emailAddress: 'grosser-saal@ballev.onmicrosoft.com',
						capacity: 50,
						building: 'Hauptgebäude'
					}
				]
			});
			(provider as any).client.makeRequest = makeRequestMock;

			const rooms = await provider.listRooms();
			expect(rooms).toHaveLength(1);
			expect(rooms[0].name).toBe('Großer Saal');
			expect(rooms[0].email).toBe('grosser-saal@ballev.onmicrosoft.com');
			expect(rooms[0].capacity).toBe(50);
		});

		it('should check room availability via getSchedule', async () => {
			const makeRequestMock = vi.fn().mockResolvedValueOnce({
				value: [
					{
						scheduleId: 'grosser-saal@ballev.onmicrosoft.com',
						availabilityView: '0',
						scheduleItems: []
					}
				]
			});
			(provider as any).client.makeRequest = makeRequestMock;

			const availability = await provider.checkRoomAvailability(
				['grosser-saal@ballev.onmicrosoft.com'],
				new Date('2026-10-20T10:00:00Z'),
				new Date('2026-10-20T12:00:00Z')
			);

			expect(availability.get('grosser-saal@ballev.onmicrosoft.com')?.isAvailable).toBe(true);
		});

		it('should book a room by creating a calendar event on the room mailbox', async () => {
			const makeRequestMock = vi.fn().mockResolvedValue({
				id: 'res-booking-99',
				subject: 'Ballet Rehearsal',
				value: []
			});
			(provider as any).client.makeRequest = makeRequestMock;

			const booking = await provider.bookRoom({
				roomEmail: 'grosser-saal@ballev.onmicrosoft.com',
				roomName: 'Großer Saal',
				summary: 'Ballet Rehearsal',
				start: new Date('2026-10-20T10:00:00Z'),
				end: new Date('2026-10-20T12:00:00Z')
			});

			expect(booking.success).toBe(true);
			expect(booking.bookingId).toBe('res-booking-99');
			expect(booking.roomEmail).toBe('grosser-saal@ballev.onmicrosoft.com');
			expect(makeRequestMock).toHaveBeenCalledWith(
				'https://graph.microsoft.com/v1.0/users/grosser-saal%40ballev.onmicrosoft.com/calendar/events',
				expect.objectContaining({
					method: 'POST',
					body: expect.stringContaining('"subject":"Ballet Rehearsal"')
				})
			);
		});

		it('should release a room reservation via DELETE', async () => {
			const makeRequestMock = vi.fn().mockResolvedValue({});
			(provider as any).client.makeRequest = makeRequestMock;

			await provider.releaseRoom('grosser-saal@ballev.onmicrosoft.com', 'res-booking-99');

			expect(makeRequestMock).toHaveBeenCalledWith(
				'https://graph.microsoft.com/v1.0/users/grosser-saal%40ballev.onmicrosoft.com/calendar/events/res-booking-99',
				{ method: 'DELETE' }
			);
		});

		it('should ignore free and boundary-touching slots in checkRoomAvailability while flagging genuine overlaps', async () => {
			const makeRequestMock = vi.fn()
				.mockResolvedValueOnce({
					value: [
						{
							scheduleId: 'bhs147@ballev.onmicrosoft.com',
							scheduleItems: [
								{
									status: 'free',
									start: { dateTime: '2026-11-10T10:00:00', timeZone: 'UTC' },
									end: { dateTime: '2026-11-10T12:00:00', timeZone: 'UTC' }
								},
								{
									status: 'busy',
									start: { dateTime: '2026-11-10T08:00:00', timeZone: 'UTC' },
									end: { dateTime: '2026-11-10T09:00:00', timeZone: 'UTC' }
								},
								{
									status: 'busy',
									start: { dateTime: '2026-11-10T13:30:00', timeZone: 'UTC' },
									end: { dateTime: '2026-11-10T15:00:00', timeZone: 'UTC' }
								}
							]
						}
					]
				})
				.mockResolvedValueOnce({
					value: [
						{
							scheduleId: 'bhs147@ballev.onmicrosoft.com',
							scheduleItems: [
								{
									status: 'busy',
									start: { dateTime: '2026-11-10T12:00:00', timeZone: 'UTC' },
									end: { dateTime: '2026-11-10T14:00:00', timeZone: 'UTC' }
								}
							]
						}
					]
				});
			(provider as any).client.makeRequest = makeRequestMock;

			const availFree = await provider.checkRoomAvailability(
				['bhs147@ballev.onmicrosoft.com'],
				new Date('2026-11-10T09:00:00Z'),
				new Date('2026-11-10T13:30:00Z')
			);
			expect(availFree.get('bhs147@ballev.onmicrosoft.com')?.isAvailable).toBe(true);
			expect(availFree.get('bhs147@ballev.onmicrosoft.com')?.busySlots).toHaveLength(0);

			const availOverlap = await provider.checkRoomAvailability(
				['bhs147@ballev.onmicrosoft.com'],
				new Date('2026-11-10T09:00:00Z'),
				new Date('2026-11-10T13:30:00Z')
			);
			expect(availOverlap.get('bhs147@ballev.onmicrosoft.com')?.isAvailable).toBe(false);
			expect(availOverlap.get('bhs147@ballev.onmicrosoft.com')?.busySlots).toHaveLength(1);
		});

		it('should update an existing booking via PATCH when prep/teardown padding changes without self-conflicting', async () => {
			(provider as any).config = {
				id: 'cfg-res-1',
				userId: 'user-1',
				providerId: 'microsoft-resources',
				providerType: 'microsoft-resources',
				direction: 'push',
				enabled: true,
				createdAt: new Date(),
				updatedAt: new Date()
			};

			const existingMapping = {
				id: 'map-1',
				syncConfigId: 'cfg-res-1',
				eventId: 'evt-1',
				resourceId: 'res-bhs147',
				externalId: 'booking-existing-1',
				metadata: {
					roomEmail: 'bhs147@ballev.onmicrosoft.com',
					roomName: 'BHS.1.47'
				}
			};

			(db.select as any).mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([existingMapping])
				})
			});
			const mockUpdateWhere = vi.fn().mockResolvedValueOnce([]);
			(db.update as any).mockReturnValueOnce({
				set: vi.fn().mockReturnValueOnce({
					where: mockUpdateWhere
				})
			});

			const makeRequestMock = vi.fn()
				// 1. calendarView check finds only our existing booking
				.mockResolvedValueOnce({
					value: [
						{
							id: 'booking-existing-1',
							subject: 'Seminar',
							showAs: 'busy',
							isCancelled: false,
							start: { dateTime: '2026-11-10T11:00:00', timeZone: 'UTC' },
							end: { dateTime: '2026-11-10T12:30:00', timeZone: 'UTC' }
						}
					]
				})
				// 2. PATCH existing booking
				.mockResolvedValueOnce({
					id: 'booking-existing-1'
				});
			(provider as any).client.makeRequest = makeRequestMock;

			const res = await provider.bookRoom({
				eventId: 'evt-1',
				resourceId: 'res-bhs147',
				roomEmail: 'bhs147@ballev.onmicrosoft.com',
				roomName: 'BHS.1.47',
				summary: 'Seminar',
				start: new Date('2026-11-10T09:00:00Z'),
				end: new Date('2026-11-10T13:30:00Z'),
				startTimeZone: 'UTC'
			});

			expect(res.success).toBe(true);
			expect(res.status).toBe('confirmed');
			expect(res.bookingId).toBe('booking-existing-1');
			expect(makeRequestMock).toHaveBeenNthCalledWith(
				1,
				expect.stringContaining('/users/bhs147%40ballev.onmicrosoft.com/calendarView'),
				expect.objectContaining({ method: 'GET' })
			);
			expect(makeRequestMock).toHaveBeenNthCalledWith(
				2,
				'https://graph.microsoft.com/v1.0/users/bhs147%40ballev.onmicrosoft.com/calendar/events/booking-existing-1',
				expect.objectContaining({
					method: 'PATCH',
					body: expect.stringContaining('"dateTime":"2026-11-10T09:00:00"')
				})
			);
			const patchBody = JSON.parse(makeRequestMock.mock.calls[1][1].body);
			expect(patchBody.end.dateTime).toBe('2026-11-10T13:30:00');
			expect(patchBody.end.timeZone).toBe('UTC');
			expect(mockUpdateWhere).toHaveBeenCalled();
		});

		it('should fall back to POST when PATCH of an existing booking returns 404', async () => {
			(provider as any).config = {
				id: 'cfg-res-1',
				userId: 'user-1',
				providerId: 'microsoft-resources',
				providerType: 'microsoft-resources',
				direction: 'push',
				enabled: true,
				createdAt: new Date(),
				updatedAt: new Date()
			};

			const existingMapping = {
				id: 'map-stale',
				syncConfigId: 'cfg-res-1',
				eventId: 'evt-2',
				resourceId: 'res-bhs147',
				externalId: 'booking-deleted-on-ms',
				metadata: { roomEmail: 'bhs147@ballev.onmicrosoft.com' }
			};

			(db.select as any).mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([existingMapping])
				})
			});
			const mockDeleteWhere = vi.fn().mockResolvedValueOnce([]);
			(db.delete as any).mockReturnValueOnce({ where: mockDeleteWhere });
			const mockInsertValues = vi.fn().mockResolvedValueOnce([]);
			(db.insert as any).mockReturnValueOnce({ values: mockInsertValues });

			const notFoundErr: any = new Error('ResourceNotFound: 404');
			notFoundErr.status = 404;

			const makeRequestMock = vi.fn()
				.mockResolvedValueOnce({ value: [] }) // calendarView
				.mockRejectedValueOnce(notFoundErr) // PATCH 404
				.mockResolvedValueOnce({ value: [{ scheduleId: 'bhs147@ballev.onmicrosoft.com', scheduleItems: [] }] }) // getSchedule
				.mockResolvedValueOnce({ id: 'booking-recreated-2' }); // POST
			(provider as any).client.makeRequest = makeRequestMock;

			const res = await provider.bookRoom({
				eventId: 'evt-2',
				resourceId: 'res-bhs147',
				roomEmail: 'bhs147@ballev.onmicrosoft.com',
				roomName: 'BHS.1.47',
				summary: 'Recreated Event',
				start: new Date('2026-11-10T09:00:00Z'),
				end: new Date('2026-11-10T13:30:00Z')
			});

			expect(res.success).toBe(true);
			expect(res.bookingId).toBe('booking-recreated-2');
			expect(mockDeleteWhere).toHaveBeenCalled();
			expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
				externalId: 'booking-recreated-2',
				eventId: 'evt-2',
				resourceId: 'res-bhs147'
			}));
			expect(makeRequestMock).toHaveBeenNthCalledWith(
				4,
				'https://graph.microsoft.com/v1.0/users/bhs147%40ballev.onmicrosoft.com/calendar/events',
				expect.objectContaining({ method: 'POST' })
			);
		});

		it('should return conflict on update when a different event overlaps in calendarView', async () => {
			(provider as any).config = {
				id: 'cfg-res-1',
				userId: 'user-1',
				providerId: 'microsoft-resources',
				providerType: 'microsoft-resources',
				direction: 'push',
				enabled: true,
				createdAt: new Date(),
				updatedAt: new Date()
			};

			const existingMapping = {
				id: 'map-1',
				syncConfigId: 'cfg-res-1',
				eventId: 'evt-1',
				resourceId: 'res-bhs147',
				externalId: 'booking-existing-1',
				metadata: { roomEmail: 'bhs147@ballev.onmicrosoft.com' }
			};

			(db.select as any).mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([existingMapping])
				})
			});

			const makeRequestMock = vi.fn().mockResolvedValueOnce({
				value: [
					{
						id: 'booking-existing-1',
						subject: 'My Event',
						showAs: 'busy',
						start: { dateTime: '2026-11-10T10:00:00', timeZone: 'UTC' },
						end: { dateTime: '2026-11-10T12:30:00', timeZone: 'UTC' }
					},
					{
						id: 'other-competing-event',
						subject: 'Competing Meeting',
						showAs: 'busy',
						start: { dateTime: '2026-11-10T09:00:00', timeZone: 'UTC' },
						end: { dateTime: '2026-11-10T10:00:00', timeZone: 'UTC' }
					}
				]
			});
			(provider as any).client.makeRequest = makeRequestMock;

			const res = await provider.bookRoom({
				eventId: 'evt-1',
				resourceId: 'res-bhs147',
				roomEmail: 'bhs147@ballev.onmicrosoft.com',
				roomName: 'BHS.1.47',
				summary: 'My Event',
				start: new Date('2026-11-10T09:00:00Z'),
				end: new Date('2026-11-10T13:30:00Z')
			});

			expect(res.success).toBe(false);
			expect(res.status).toBe('conflict');
			expect(res.message).toContain('Competing Meeting');
			expect(makeRequestMock).toHaveBeenCalledTimes(1);
		});

		it('should default endTimeZone to startTimeZone and map recurrence in bookRoom', async () => {
			const makeRequestMock = vi.fn()
				.mockResolvedValueOnce({ value: [] }) // getSchedule
				.mockResolvedValueOnce({ id: 'res-rec-1' }); // POST
			(provider as any).client.makeRequest = makeRequestMock;

			const res = await provider.bookRoom({
				roomEmail: 'bhs147@ballev.onmicrosoft.com',
				roomName: 'BHS.1.47',
				summary: 'Weekly Yoga',
				start: new Date('2026-11-10T08:00:00Z'), // 09:00 CET
				end: new Date('2026-11-10T12:30:00Z'), // 13:30 CET
				startTimeZone: 'Europe/Berlin',
				recurrence: ['RRULE:FREQ=WEEKLY;COUNT=5']
			});

			expect(res.success).toBe(true);
			const postCall = makeRequestMock.mock.calls.find(
				(c) => String(c[0]).includes('/calendar/events') && c[1]?.method === 'POST'
			);
			expect(postCall).toBeDefined();
			const body = JSON.parse(postCall![1].body);
			expect(body.start).toEqual({
				dateTime: '2026-11-10T09:00:00',
				timeZone: 'Europe/Berlin'
			});
			expect(body.end).toEqual({
				dateTime: '2026-11-10T13:30:00',
				timeZone: 'Europe/Berlin'
			});
			expect(body.recurrence).toBeDefined();
			expect(body.recurrence.pattern.type).toBe('weekly');
			expect(body.recurrence.range.numberOfOccurrences).toBe(5);
			expect(body.recurrence.range.recurrenceTimeZone).toBe('Europe/Berlin');
		});
	});
});
