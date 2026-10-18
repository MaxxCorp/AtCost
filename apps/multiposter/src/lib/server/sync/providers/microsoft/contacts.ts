import type {
	SyncProvider,
	SyncConfig,
	ExternalEvent,
	ProviderType,
	SyncDirection
} from '../../types';

import { MicrosoftGraphClient } from './client';
import { db, contact, eq, and, sql } from '@ac/db';

export class MicrosoftContactsProvider implements SyncProvider {
	readonly type: ProviderType = 'microsoft-contacts';
	readonly name = 'Microsoft Contacts';
	readonly supportsWebhooks = false;
	readonly supportedDirections: SyncDirection[] = ['pull', 'push', 'bidirectional'];
	readonly supportedEntityTypes: ('event' | 'announcement')[] = [];

	private client = new MicrosoftGraphClient();
	private config?: SyncConfig;

	async initialize(config: SyncConfig): Promise<void> {
		this.config = config;
		await this.client.initialize(config);
	}

	getClient(): MicrosoftGraphClient {
		return this.client;
	}

	get accessToken(): string | undefined {
		return (this.client as any).accessToken;
	}
	set accessToken(val: string | undefined) {
		(this.client as any).accessToken = val;
	}

	async validateConnection(): Promise<boolean> {
		try {
			const res = await this.client.testContactsTarget();
			return res.success;
		} catch (error) {
			console.error('Microsoft Contacts connection validation failed:', error);
			return false;
		}
	}

	private getBaseUrl(): string {
		return this.client.getContactsBaseUrl();
	}

	/**
	 * Pull contacts from Microsoft Graph into the internal contacts table
	 */
	async pullContacts(): Promise<{ count: number; contacts: any[] }> {
		const url = `${this.getBaseUrl()}?$top=100`;
		const response = await this.client.makeRequest<any>(url, { method: 'GET' });

		const msContacts = Array.isArray(response.value) ? response.value : [];
		const syncedContacts: any[] = [];

		for (const msc of msContacts) {
			const givenName = msc.givenName || '';
			const familyName = msc.surname || '';
			const displayName = msc.displayName || `${givenName} ${familyName}`.trim() || msc.companyName || 'Unnamed Contact';

			const emailAddresses = (msc.emailAddresses || []).map((e: any, index: number) => ({
				value: e.address,
				label: e.name || 'work',
				primary: index === 0
			})).filter((e: any) => e.value);

			const phones = [];
			if (msc.mobilePhone) phones.push({ value: msc.mobilePhone, label: 'mobile', primary: true });
			if (msc.businessPhones && msc.businessPhones[0]) phones.push({ value: msc.businessPhones[0], label: 'work', primary: phones.length === 0 });

			syncedContacts.push({
				externalId: msc.id,
				givenName,
				familyName,
				displayName,
				company: msc.companyName || undefined,
				jobTitle: msc.jobTitle || undefined,
				emails: emailAddresses,
				phones
			});
		}

		return { count: syncedContacts.length, contacts: syncedContacts };
	}

	/**
	 * Push a contact to Microsoft Graph Contacts
	 */
	async pushContact(localContact: any): Promise<{ externalId: string }> {
		const payload = this.mapToGraphContact(localContact);
		const url = this.getBaseUrl();

		const response = await this.client.makeRequest<any>(url, {
			method: 'POST',
			body: JSON.stringify(payload)
		});

		return { externalId: response.id };
	}

	/**
	 * Update an existing contact in Microsoft Graph Contacts
	 */
	async updateContact(externalId: string, localContact: any): Promise<void> {
		const payload = this.mapToGraphContact(localContact);
		const url = `${this.getBaseUrl()}/${encodeURIComponent(externalId)}`;

		await this.client.makeRequest<any>(url, {
			method: 'PATCH',
			body: JSON.stringify(payload)
		});
	}

	/**
	 * Delete a contact from Microsoft Graph Contacts
	 */
	async deleteContact(externalId: string): Promise<void> {
		const url = `${this.getBaseUrl()}/${encodeURIComponent(externalId)}`;
		try {
			await this.client.makeRequest(url, { method: 'DELETE' });
		} catch (err: any) {
			if (err?.status === 404) return;
			throw err;
		}
	}

	private mapToGraphContact(localContact: any): any {
		const emailList = Array.isArray(localContact.emails) ? localContact.emails : [];
		const emailAddresses = emailList.map((e: any) => ({
			address: typeof e === 'string' ? e : e.value,
			name: typeof e === 'string' ? e : e.label || localContact.displayName || 'Email'
		})).filter((e: any) => e.address);

		const phoneList = Array.isArray(localContact.phones) ? localContact.phones : [];
		const mobilePhone = phoneList.find((p: any) => p.label === 'mobile')?.value || phoneList[0]?.value || undefined;
		const businessPhones = phoneList.filter((p: any) => p.label !== 'mobile').map((p: any) => p.value).filter(Boolean);

		return {
			givenName: localContact.givenName || undefined,
			surname: localContact.familyName || undefined,
			displayName: localContact.displayName || `${localContact.givenName || ''} ${localContact.familyName || ''}`.trim() || undefined,
			companyName: localContact.company || undefined,
			jobTitle: localContact.jobTitle || undefined,
			emailAddresses: emailAddresses.length > 0 ? emailAddresses : undefined,
			mobilePhone,
			businessPhones: businessPhones.length > 0 ? businessPhones : undefined
		};
	}

	// Stubs for general SyncProvider contract
	async pullEvents(): Promise<{ events: ExternalEvent[]; nextSyncToken?: string }> {
		return { events: [] };
	}

	async pushEvent(): Promise<{ externalId: string }> {
		throw new Error('MicrosoftContactsProvider does not sync events directly; use pushContact instead.');
	}

	async updateEvent(): Promise<{ etag?: string }> {
		return {};
	}

	async deleteEvent(): Promise<void> {
		// No-op
	}
}
