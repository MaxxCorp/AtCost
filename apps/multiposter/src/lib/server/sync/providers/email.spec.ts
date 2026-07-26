import { describe, it, expect } from 'vitest';
import { EmailProvider } from './email';
import { getAvailableEmailTemplates, renderEmailTemplate } from '../../email-templates';

describe('Email Templates & EmailProvider', () => {
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
});
