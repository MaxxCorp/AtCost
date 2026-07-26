import type {
	SyncProvider,
	SyncConfig,
	ExternalEvent,
	ProviderType,
	SyncDirection,
	WebhookSubscription
} from '../types';
import { getEntityContacts } from '../../contacts';
import { resolveEventContact } from '../../contact-resolution';
import { db } from '@ac/db';
import { contact, emailCampaign, emailEvent } from '@ac/db';
import { inArray } from '@ac/db';
import { renderEmailTemplate, type EmailTemplateData } from '../../email-templates';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

/**
 * Brevo email sync provider implementation
 * Sends rich HTML emails with event details, QR codes, and iCal attachments
 * Supports Svelte-based email template selection and per-sync contact list configuration
 */
export class EmailProvider implements SyncProvider {
	readonly type: ProviderType = 'email';
	readonly name = 'E-Mail (Brevo)';
	readonly supportsWebhooks = true;
	readonly supportedDirections: SyncDirection[] = ['push'];
	readonly supportedEntityTypes: ('event' | 'announcement')[] = ['event', 'announcement'];

	private config?: SyncConfig;
	private brevoApiKey?: string;
	private brevoBaseUrl = 'https://api.brevo.com/v3';
	private selectedTemplate = 'standard';
	private includeEventContacts = false;

	async initialize(config: SyncConfig): Promise<void> {
		this.config = config;

		// Get Brevo API key from credentials, settings or environment
		this.brevoApiKey =
			config.credentials?.apiKey || config.settings?.apiKey || env.BREVO_API_KEY;

		this.selectedTemplate = config.settings?.selectedTemplate || 'standard';
		
		const rawInclude = config.settings?.includeEventContacts;
		this.includeEventContacts =
			rawInclude === true || rawInclude === 'true' || rawInclude === '1';

		if (this.brevoApiKey) {
			try {
				await this.makeBrevoRequest('GET', '/account');
			} catch (error) {
				console.warn(`[EmailProvider] Warning validating Brevo API key (${error}). Falling back to sandbox mock mode.`);
				this.brevoApiKey = undefined;
			}
		} else {
			console.log('[EmailProvider] BREVO_API_KEY not configured. Provider running in sandbox mock mode.');
		}
	}

	async validateConnection(): Promise<boolean> {
		if (!this.brevoApiKey) {
			// In sandbox mock mode, connection is valid
			return true;
		}

		try {
			await this.makeBrevoRequest('GET', '/account');
			return true;
		} catch (error) {
			console.error('[EmailProvider] Connection validation failed:', error);
			return false;
		}
	}

	async pullEvents(): Promise<{
		events: ExternalEvent[];
		nextSyncToken?: string;
	}> {
		throw new Error('Email provider only supports push operations');
	}

	async pushEvent(event: ExternalEvent): Promise<{ externalId: string; etag?: string }> {
		if (!this.config) {
			throw new Error('Provider not initialized');
		}

		let senderInfo = {
			name: 'Event Organizer',
			email: 'events@example.com'
		};

		try {
			const userRecord = await db.query.user.findFirst({
				where: (u: any, { eq }: any) => eq(u.id, this.config!.userId)
			});
			if (userRecord) {
				senderInfo = {
					name: userRecord.name || 'Event Organizer',
					email: userRecord.email || 'events@example.com'
				};
			}
		} catch (error) {
			console.warn('[EmailProvider] Database query warning for user record:', error);
		}

		// Get recipients (per-sync contacts + optional recipient email + optional event contacts)
		const recipients = await this.getRecipients(event);

		if (recipients.length === 0) {
			throw new Error(
				'Email provider requires at least one recipient configured in synchronization settings'
			);
		}

		// Generate email content using selected template
		const emailContent = await this.generateEmailContent(event, senderInfo);
		const attachments = await this.generateAttachments(event);

		const isAnnouncement = event.metadata?.entityType === 'announcement';
		const eventId = isAnnouncement ? undefined : (event.metadata?.eventId || event.externalId);
		const announcementId = isAnnouncement ? (event.metadata?.announcementId || event.externalId) : undefined;

		if (this.brevoApiKey) {
			// Create Brevo campaign
			const campaignData = {
				name: `Event: ${event.summary}`,
				subject: `${isAnnouncement ? 'Ankündigung' : 'Neue Veranstaltung'}: ${event.summary}`,
				sender: senderInfo,
				htmlContent: emailContent.html,
				textContent: emailContent.text,
				recipients: recipients.map((r) => ({ email: r.email, name: r.name })),
				attachment: attachments,
				tracking: {
					opens: true,
					clicks: true,
					unsubscriptions: true
				}
			};

			try {
				const campaignResponse = await this.makeBrevoRequest('POST', '/emailCampaigns', campaignData);
				const brevoCampaignId = campaignResponse.id;

				// Send the campaign immediately
				await this.makeBrevoRequest('POST', `/emailCampaigns/${brevoCampaignId}/sendNow`);

				// Store campaign in database
				try {
					await db.insert(emailCampaign).values({
						syncConfigId: this.config.id,
						eventId,
						announcementId,
						eventSummary: event.summary,
						brevoCampaignId: brevoCampaignId.toString(),
						sentAt: new Date(),
						recipientCount: recipients.length,
						metadata: {
							brevoCampaignId,
							recipients: recipients.map((r) => r.email)
						}
					});
				} catch (dbErr) {
					console.warn('[EmailProvider] Database campaign insert warning:', dbErr);
				}

				const externalId = `email-${event.externalId || crypto.randomUUID()}-${Date.now()}`;
				return { externalId, etag: new Date().toISOString() };
			} catch (error) {
				console.error('[EmailProvider] Failed to send email via Brevo:', error);
				throw new Error(`Failed to send email: ${error}`);
			}
		}

		// Sandbox / Mock fallback when BREVO_API_KEY is not configured
		console.log(
			`[EmailProvider Mock Push] Template: ${this.selectedTemplate}\nSubject: ${event.summary}\nRecipients (${recipients.length}): ${recipients.map((r) => r.email).join(', ')}\nContent length: ${emailContent.html.length} chars`
		);

		const mockBrevoId = `mock_brevo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
		try {
			await db.insert(emailCampaign).values({
				syncConfigId: this.config.id,
				eventId,
				announcementId,
				eventSummary: event.summary,
				brevoCampaignId: mockBrevoId,
				sentAt: new Date(),
				recipientCount: recipients.length,
				metadata: {
					brevoCampaignId: mockBrevoId,
					recipients: recipients.map((r) => r.email),
					sandbox: true
				}
			});
		} catch (dbErr) {
			console.warn('[EmailProvider] Database mock campaign insert warning:', dbErr);
		}

		const externalId = `email_mock_${event.externalId || crypto.randomUUID()}_${Date.now()}`;
		return { externalId, etag: new Date().toISOString() };
	}

	async updateEvent(externalId: string, event: ExternalEvent): Promise<{ etag?: string }> {
		return this.pushEvent(event);
	}

	async deleteEvent(externalId: string): Promise<void> {
		console.warn(`Email provider doesn't support event deletion for ${externalId}`);
	}

	async setupWebhook(callbackUrl: string): Promise<WebhookSubscription> {
		if (!this.config) throw new Error('Provider not initialized');

		if (callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1')) {
			throw new Error(
				`Brevo webhooks require a public URL. Your current URL is ${callbackUrl}. Please use a tunnel like Ngrok or deploy to a public server.`
			);
		}

		if (!this.brevoApiKey) {
			return {
				syncConfigId: this.config.id,
				providerId: this.config.providerId,
				resourceId: `mock-wh-${Date.now()}`,
				channelId: `mock-ch-${Date.now()}`,
				expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				createdAt: new Date()
			} as WebhookSubscription;
		}

		const webhookData = {
			type: 'marketing',
			events: ['sent', 'delivered', 'opened', 'clicked', 'hardBounce', 'softBounce', 'spam', 'unsubscribed'],
			url: callbackUrl,
			description: `Webhook for sync config ${this.config.id}`
		};

		try {
			const response = await this.makeBrevoRequest('POST', '/webhooks', webhookData);
			return {
				syncConfigId: this.config.id,
				providerId: this.config.providerId,
				resourceId: response.id.toString(),
				channelId: response.id.toString(),
				expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				createdAt: new Date()
			} as WebhookSubscription;
		} catch (error) {
			console.error('[EmailProvider] Failed to setup Brevo webhook:', error);
			throw new Error(`Failed to setup webhook: ${error}`);
		}
	}

	async renewWebhook(subscription: WebhookSubscription): Promise<WebhookSubscription> {
		return subscription;
	}

	async cancelWebhook(subscription: WebhookSubscription): Promise<void> {
		if (!this.brevoApiKey) return;
		try {
			await this.makeBrevoRequest('DELETE', `/webhooks/${subscription.resourceId}`);
		} catch (error) {
			console.error('[EmailProvider] Failed to cancel Brevo webhook:', error);
		}
	}

	async processWebhook(payload: any): Promise<{
		changes: Array<{ externalId: string; changeType: 'created' | 'updated' | 'deleted' }>;
	}> {
		const events = Array.isArray(payload) ? payload : [payload];

		for (const event of events) {
			try {
				const campaign = await db.query.emailCampaign.findFirst({
					where: (c: any, { eq }: any) => eq(c.brevoCampaignId, event.campaignId?.toString())
				});

				if (campaign) {
					await db.insert(emailEvent).values({
						emailCampaignId: campaign.id,
						recipientEmail: event.email,
						eventType: event.event,
						eventData: event,
						occurredAt: new Date(event.date || Date.now())
					});
				}
			} catch (error) {
				console.error('[EmailProvider] Failed to process webhook event:', error);
			}
		}

		return { changes: [] };
	}

	private async makeBrevoRequest(method: string, endpoint: string, data?: any): Promise<any> {
		const url = `${this.brevoBaseUrl}${endpoint}`;

		const response = await fetch(url, {
			method,
			headers: {
				'Content-Type': 'application/json',
				'api-key': this.brevoApiKey!
			},
			body: data ? JSON.stringify(data) : undefined
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Brevo API error ${response.status}: ${errorText}`);
		}

		return response.json();
	}

	private async getRecipients(event: ExternalEvent): Promise<Array<{ email: string; name?: string }>> {
		const recipientsMap = new Map<string, { email: string; name?: string }>();

		const addRecipient = (email?: string, name?: string) => {
			if (!email) return;
			const cleanEmail = email.trim().toLowerCase();
			if (cleanEmail && !recipientsMap.has(cleanEmail)) {
				recipientsMap.set(cleanEmail, { email: cleanEmail, name });
			}
		};

		// 1. Add configured single recipient email
		const recipientEmail = this.config!.settings?.recipientEmail;
		if (recipientEmail) {
			addRecipient(recipientEmail);
		}

		// 2. Add contacts from synchronization configuration settings
		let contactIds: string[] = [];
		const rawContactIds = this.config!.settings?.recipientContactIds;
		if (Array.isArray(rawContactIds)) {
			contactIds = rawContactIds.filter(Boolean);
		} else if (typeof rawContactIds === 'string' && rawContactIds.trim()) {
			try {
				const parsed = JSON.parse(rawContactIds);
				contactIds = Array.isArray(parsed) ? parsed : [rawContactIds];
			} catch {
				contactIds = [rawContactIds];
			}
		}

		if (contactIds.length > 0) {
			try {
				const dbContacts = await db.query.contact.findMany({
					where: inArray(contact.id, contactIds),
					with: { emails: true }
				});

				for (const c of dbContacts) {
					const primaryEmail =
						c.emails?.find((e: any) => e.primary)?.value || c.emails?.[0]?.value;
					const name =
						c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim() || undefined;
					addRecipient(primaryEmail, name);
				}
			} catch (error) {
				console.warn('[EmailProvider] Database query warning for recipient contacts:', error);
			}
		}

		// 3. Optional: Add contacts attached to the event/announcement if includeEventContacts is true
		if (this.includeEventContacts) {
			const eventId = event.metadata?.eventId;
			const announcementId = event.metadata?.announcementId;
			const entityId = eventId || announcementId;
			const entityType = eventId ? 'event' : 'announcement';

			if (entityId) {
				try {
					const eventContacts = await getEntityContacts(entityType, entityId);
					for (const c of eventContacts) {
						const primaryEmail =
							(c as any).emails?.find((e: any) => e.primary)?.value || (c as any).emails?.[0]?.value;
						const name =
							c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim() || undefined;
						addRecipient(primaryEmail, name);
					}
				} catch (error) {
					console.warn('[EmailProvider] Database query warning for event contacts:', error);
				}
			}
		}

		return Array.from(recipientsMap.values());
	}

	private async generateEmailContent(
		event: ExternalEvent,
		senderInfo: { name: string; email: string }
	): Promise<{ html: string; text: string }> {
		let contactInfo = {
			name: senderInfo.name,
			email: senderInfo.email,
			phone: ''
		};

		try {
			const resolvedContact = await resolveEventContact(event);
			if (resolvedContact) {
				contactInfo = resolvedContact;
			}
		} catch (error) {
			console.warn('[EmailProvider] Warning resolving event contact:', error);
		}

		const templateData: EmailTemplateData = {
			event: {
				summary: event.summary,
				description: event.description,
				startDateTime: event.startDateTime,
				endDateTime: event.endDateTime,
				location: event.location,
				recurrence: event.recurrence
			},
			contactInfo
		};

		if (event.metadata?.entityType === 'announcement') {
			templateData.isAnnouncement = true;
		}

		return renderEmailTemplate(this.selectedTemplate, templateData);
	}

	private async generateAttachments(event: ExternalEvent): Promise<any[]> {
		const attachments: any[] = [];
		const isAnnouncement = event.metadata?.entityType === 'announcement';

		if (isAnnouncement) return attachments;

		const eventId = event.metadata?.eventId;
		if (!eventId) return attachments;

		// Attach existing iCal file
		try {
			const icalPath = path.join(process.cwd(), 'static', 'events', `${eventId}.ics`);
			if (fs.existsSync(icalPath)) {
				const icalContent = fs.readFileSync(icalPath);
				attachments.push({
					name: 'event.ics',
					content: icalContent.toString('base64')
				});
			}
		} catch (error) {
			console.warn('[EmailProvider] Failed to attach iCal file:', error);
		}

		// Attach existing QR code file
		try {
			const qrPath = path.join(process.cwd(), 'static', 'events', `${eventId}.png`);
			if (fs.existsSync(qrPath)) {
				const qrContent = fs.readFileSync(qrPath);
				attachments.push({
					name: 'event-qr-code.png',
					content: qrContent.toString('base64')
				});
			}
		} catch (error) {
			console.warn('[EmailProvider] Failed to attach QR code file:', error);
		}

		return attachments;
	}
}
