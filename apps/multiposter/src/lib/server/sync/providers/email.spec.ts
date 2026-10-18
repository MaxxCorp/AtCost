import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailProvider } from './email';
import { getAvailableEmailTemplates, renderEmailTemplate } from '../../email-templates';
import { getDerivedEventContacts } from '../../../filters/synchronizations';

vi.mock('$app/env/private', () => ({
	BREVO_API_KEY: undefined
}));

const mockFindManyContacts = vi.fn().mockResolvedValue([]);
const mockFindUser = vi.fn().mockResolvedValue(null);
const mockGetEntityContacts = vi.fn().mockResolvedValue([]);

vi.mock('@ac/db', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@ac/db')>();
	return {
		...actual,
		db: {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
			query: {
				user: {
					findFirst: (...args: any[]) => mockFindUser(...args)
				},
				contact: {
					findMany: (...args: any[]) => mockFindManyContacts(...args)
				},
				emailCampaign: {
					findFirst: vi.fn().mockResolvedValue(null)
				}
			}
		}
	};
});

vi.mock('../../contacts', () => ({
	getEntityContacts: (...args: any[]) => mockGetEntityContacts(...args)
}));

describe('Email Templates & EmailProvider', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should list available email templates', () => {
		const templates = getAvailableEmailTemplates();
		expect(templates.length).toBeGreaterThanOrEqual(3);
		const ids = templates.map((t) => t.id);
		expect(ids).toContain('standard');
		expect(ids).toContain('minimal');
		expect(ids).toContain('newsletter');
	});

	it('should render standard Svelte email template to html and text', () => {
		const result = renderEmailTemplate('standard', {
			event: {
				summary: 'Netzwerktreffen 2026',
				description: 'Ein Treffen für alle Partner',
				location: 'Großer Saal, Berlin',
				startDateTime: new Date('2026-09-10T10:00:00Z')
			},
			contactInfo: {
				name: 'Max Mustermann',
				email: 'max@example.com',
				phone: '+491234567'
			}
		});

		expect(result.html).toContain('Netzwerktreffen 2026');
		expect(result.html).toContain('Großer Saal, Berlin');
		expect(result.html).toContain('max@example.com');
		expect(result.text).toContain('Netzwerktreffen 2026');
	});

	it('should render minimal Svelte email template', () => {
		const result = renderEmailTemplate('minimal', {
			event: {
				summary: 'Sprint Planning',
				description: 'Quarterly planning meeting',
				location: 'Room 402'
			}
		});

		expect(result.html).toContain('Sprint Planning');
		expect(result.html).toContain('Room 402');
		expect(result.text).toContain('Sprint Planning');
	});

	it('should render newsletter Svelte email template', () => {
		const result = renderEmailTemplate('newsletter', {
			event: {
				summary: 'Sommerfest Community',
				description: 'Feiern Sie mit uns im Garten'
			},
			isAnnouncement: true
		});

		expect(result.html).toContain('Sommerfest Community');
		expect(result.text).toContain('Sommerfest Community');
	});

	it('should initialize and push event in sandbox mock mode when no API key is set', async () => {
		const provider = new EmailProvider();
		await provider.initialize({
			id: 'sync-email-1',
			userId: 'user-test-1',
			providerId: 'email-test',
			providerType: 'email',
			direction: 'push',
			enabled: true,
			settings: {
				selectedTemplate: 'newsletter',
				recipientEmail: 'target@example.com',
				includeEventContacts: false
			},
			createdAt: new Date(),
			updatedAt: new Date()
		});

		const isValid = await provider.validateConnection();
		expect(isValid).toBe(true);

		const result = await provider.pushEvent({
			externalId: 'event-123',
			providerId: 'email-test',
			summary: 'Wichtige Ankündigung',
			description: 'Inhalt der E-Mail Nachricht'
		});

		expect(result.externalId).toMatch(/^email_mock_/);
		expect(result.etag).toBeDefined();
	});

	describe('Email Recipients - Event Contacts Filtering & Additional Associations', () => {
		const employeeContact = {
			id: 'contact-staff-1',
			displayName: 'Anna Staff',
			isPublic: false,
			emails: [{ value: 'staff@example.com', primary: true }],
			tags: [{ tag: { id: 'tag-emp', name: 'Employee' } }]
		};

		const publicSpeakerContact = {
			id: 'contact-speaker-1',
			displayName: 'Prof. Speaker',
			isPublic: true,
			emails: [{ value: 'speaker@example.com', primary: true }],
			roles: [{ id: 'role-speaker', name: 'Speaker' }]
		};

		const privateAttendeeContact = {
			id: 'contact-private-1',
			displayName: 'Secret Attendee',
			isPublic: false,
			emails: [{ value: 'secret@example.com', primary: true }]
		};

		it('should by default only include internal staff from event contacts and exclude non-public contacts', async () => {
			mockGetEntityContacts.mockResolvedValueOnce([
				employeeContact,
				publicSpeakerContact,
				privateAttendeeContact
			]);

			const provider = new EmailProvider();
			await provider.initialize({
				id: 'sync-email-filtered',
				userId: 'user-1',
				providerId: 'email-test',
				providerType: 'email',
				direction: 'push',
				enabled: true,
				settings: {
					includeEmployeeContacts: true,
					includePublicContacts: false,
					includeNonPublicContacts: false
				},
				createdAt: new Date(),
				updatedAt: new Date()
			});

			const recipients = await (provider as any).getRecipients({
				externalId: 'ext-1',
				providerId: 'email-test',
				summary: 'Conference Event',
				metadata: { eventId: 'event-conf-1' }
			});

			expect(recipients).toHaveLength(1);
			expect(recipients[0].email).toBe('staff@example.com');
		});

		it('should include public contacts from events when includePublicContacts is enabled', async () => {
			mockGetEntityContacts.mockResolvedValueOnce([
				employeeContact,
				publicSpeakerContact,
				privateAttendeeContact
			]);

			const provider = new EmailProvider();
			await provider.initialize({
				id: 'sync-email-public',
				userId: 'user-1',
				providerId: 'email-test',
				providerType: 'email',
				direction: 'push',
				enabled: true,
				settings: {
					includeEmployeeContacts: true,
					includePublicContacts: true,
					includeNonPublicContacts: false
				},
				createdAt: new Date(),
				updatedAt: new Date()
			});

			const recipients = await (provider as any).getRecipients({
				externalId: 'ext-1',
				providerId: 'email-test',
				summary: 'Public Workshop',
				metadata: { eventId: 'event-conf-1' }
			});

			expect(recipients).toHaveLength(2);
			const emails = recipients.map((r: any) => r.email);
			expect(emails).toContain('staff@example.com');
			expect(emails).toContain('speaker@example.com');
			expect(emails).not.toContain('secret@example.com');
		});

		it('should merge additional associated contacts from recipientContactIds with filtered event contacts', async () => {
			mockGetEntityContacts.mockResolvedValueOnce([employeeContact]);
			mockFindManyContacts.mockResolvedValueOnce([
				{
					id: 'extra-contact-99',
					displayName: 'Newsletter Subscriber',
					emails: [{ value: 'subscriber@example.com', primary: true }]
				}
			]);

			const provider = new EmailProvider();
			await provider.initialize({
				id: 'sync-email-merged',
				userId: 'user-1',
				providerId: 'email-test',
				providerType: 'email',
				direction: 'push',
				enabled: true,
				settings: {
					includeEmployeeContacts: true,
					includePublicContacts: false,
					recipientContactIds: ['extra-contact-99']
				},
				createdAt: new Date(),
				updatedAt: new Date()
			});

			const recipients = await (provider as any).getRecipients({
				externalId: 'ext-1',
				providerId: 'email-test',
				summary: 'Event with Additional Subscribers',
				metadata: { eventId: 'event-conf-1' }
			});

			expect(recipients).toHaveLength(2);
			const emails = recipients.map((r: any) => r.email);
			expect(emails).toContain('staff@example.com');
			expect(emails).toContain('subscriber@example.com');
		});

		it('should respect excludedRecipientContactIds when unlinked by user', async () => {
			mockGetEntityContacts.mockResolvedValueOnce([employeeContact]);

			const provider = new EmailProvider();
			await provider.initialize({
				id: 'sync-email-excluded',
				userId: 'user-1',
				providerId: 'email-test',
				providerType: 'email',
				direction: 'push',
				enabled: true,
				settings: {
					includeEmployeeContacts: true,
					excludedRecipientContactIds: ['contact-staff-1'],
					recipientEmail: 'fallback@example.com'
				},
				createdAt: new Date(),
				updatedAt: new Date()
			});

			const recipients = await (provider as any).getRecipients({
				externalId: 'ext-1',
				providerId: 'email-test',
				summary: 'Excluded Staff Event',
				metadata: { eventId: 'event-conf-1' }
			});

			// Employee was excluded, only fallback email remains
			expect(recipients).toHaveLength(1);
			expect(recipients[0].email).toBe('fallback@example.com');
		});

		it('getDerivedEventContacts helper should extract matching event contacts according to participant filters', () => {
			const mockEvents = [
				{
					id: 'ev-1',
					summary: 'Staff & Public Event',
					isPublic: true,
					status: 'confirmed',
					contacts: [
						{ contact: employeeContact },
						{ contact: publicSpeakerContact },
						{ contact: privateAttendeeContact }
					]
				}
			];

			// Default: staff only
			const staffOnly = getDerivedEventContacts(mockEvents, {
				includeEmployeeContacts: true,
				includePublicContacts: false,
				includeNonPublicContacts: false
			});
			expect(staffOnly).toHaveLength(1);
			expect(staffOnly[0].id).toBe('contact-staff-1');
			expect(staffOnly[0].isEmployee).toBe(true);
			expect(staffOnly[0].isEventDerived).toBe(true);

			// Public enabled: staff + public speaker
			const staffAndPublic = getDerivedEventContacts(mockEvents, {
				includeEmployeeContacts: true,
				includePublicContacts: true,
				includeNonPublicContacts: false
			});
			expect(staffAndPublic).toHaveLength(2);
			const ids = staffAndPublic.map((c) => c.id);
			expect(ids).toContain('contact-staff-1');
			expect(ids).toContain('contact-speaker-1');
			expect(ids).not.toContain('contact-private-1');
		});
	});
});
