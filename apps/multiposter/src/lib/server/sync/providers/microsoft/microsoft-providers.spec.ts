import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MicrosoftGraphClient } from './client';
import { MicrosoftContactsProvider } from './contacts';
import { MicrosoftResourceProvider } from './resources';

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
	});
});
