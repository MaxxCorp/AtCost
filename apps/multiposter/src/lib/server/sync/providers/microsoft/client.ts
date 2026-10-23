import {
	MICROSOFT_TENANT_ID,
	MICROSOFT_CLIENT_ID,
	MICROSOFT_CLIENT_SECRET
} from '$app/env/private';

import { db, account, syncConfig as syncConfigTable, eq, and, or } from '@ac/db';
import type { SyncConfig } from '../../types';
import { formatLocal } from './recurrence';

export interface MicrosoftClientConfig {
	userId?: string;
	authMode?: 'auto' | 'app' | 'user';
	tenantId?: string;
	clientId?: string;
	clientSecret?: string;
	mailboxEmail?: string;
	calendarId?: string;
	folderId?: string;
}

export interface MicrosoftTargetTestResult {
	success: boolean;
	target: string;
	authModeUsed: 'app' | 'user';
	mailbox: string;
	displayName?: string;
	message: string;
	details?: Record<string, any>;
	error?: string;
}

export interface MicrosoftRoom {
	id: string;
	name: string;
	email: string;
	capacity?: number;
	building?: string;
	floorNumber?: number;
	type: 'room' | 'equipment';
}

export interface RoomAvailabilityResult {
	email: string;
	isAvailable: boolean;
	busySlots: Array<{ start: string; end: string }>;
	conflictMessage?: string;
}

export interface MicrosoftTenantMailbox {
	id: string;
	displayName: string;
	email: string;
	type: 'shared' | 'room' | 'user' | 'unknown';
	recipientTypeDetails?: string;
}

export interface MicrosoftCalendarSummary {
	id: string;
	name: string;
	groupName?: string;
	isDefault: boolean;
	canEdit: boolean;
	owner?: { name?: string; address?: string };
	color?: string;
	hexColor?: string;
}

export interface MicrosoftContactFolderSummary {
	id: string;
	displayName: string;
	parentFolderId?: string;
}

// In-memory token cache for App-Only tokens per tenant+client
const appTokenCache = new Map<string, { token: string; expiresAt: number }>();

export class MicrosoftGraphClient {
	private config: MicrosoftClientConfig = {};
	private resolvedAuthMode: 'app' | 'user' = 'user';
	private accessToken?: string;
	private refreshToken?: string;
	private tenantId = 'common';
	private clientId = '';
	private clientSecret = '';
	private userId?: string;

	async initialize(config: SyncConfig | MicrosoftClientConfig): Promise<void> {
		if ('userId' in config && 'providerType' in config) {
			const syncConfig = config as SyncConfig;
			const settings = syncConfig.settings || {};
			const credentials = syncConfig.credentials || {};

			this.config = {
				userId: syncConfig.userId,
				authMode: (settings.authMode as any) || 'auto',
				tenantId: credentials.tenantId || settings.tenantId || MICROSOFT_TENANT_ID,
				clientId: credentials.clientId || settings.clientId || MICROSOFT_CLIENT_ID,
				clientSecret: credentials.clientSecret || settings.clientSecret || MICROSOFT_CLIENT_SECRET,
				mailboxEmail: settings.mailboxEmail || (typeof settings.calendarId === 'string' && settings.calendarId.includes('@') ? settings.calendarId : undefined),
				calendarId: settings.calendarId || 'primary',
				folderId: settings.folderId
			};
		} else {
			this.config = {
				authMode: 'auto',
				tenantId: MICROSOFT_TENANT_ID,
				clientId: MICROSOFT_CLIENT_ID,
				clientSecret: MICROSOFT_CLIENT_SECRET,
				...config
			};
		}

		this.userId = this.config.userId;
		this.tenantId = this.config.tenantId || MICROSOFT_TENANT_ID || 'common';
		this.clientId = this.config.clientId || MICROSOFT_CLIENT_ID || '';
		this.clientSecret = this.config.clientSecret || MICROSOFT_CLIENT_SECRET || '';

		await this.resolveAuthentication();
	}

	getAuthModeUsed(): 'app' | 'user' {
		return this.resolvedAuthMode;
	}

	getMailboxEmail(): string | undefined {
		return this.config.mailboxEmail;
	}

	getCalendarId(): string {
		return this.config.calendarId || 'primary';
	}

	private async resolveAuthentication(): Promise<void> {
		if (this.accessToken) {
			return;
		}

		const mode = this.config.authMode || 'auto';
		const hasTargetMailbox = Boolean(this.config.mailboxEmail && this.config.mailboxEmail.includes('@'));
		const hasAppCredentials = Boolean(this.tenantId && this.clientId && this.clientSecret);

		// Determine preferred token mode
		let tryAppFirst = mode === 'app';
		if (mode === 'auto') {
			// If targeting a detached/shared mailbox or places API and we have app credentials, try App Credentials first
			if (hasTargetMailbox && hasAppCredentials) {
				tryAppFirst = true;
			}
		}

		if (tryAppFirst && hasAppCredentials) {
			try {
				await this.acquireAppToken();
				this.resolvedAuthMode = 'app';
				return;
			} catch (err: any) {
				if (mode === 'app') {
					throw new Error(
						`Microsoft App Credentials authentication failed: ${err.message}. ` +
						`Ensure MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET are configured and valid.`
					);
				}
				console.warn('[MicrosoftGraphClient] App token acquisition failed in auto mode, falling back to user token:', err.message);
			}
		}

		// Try User Token
		if (this.userId) {
			const [userAccount] = await db
				.select()
				.from(account)
				.where(and(
					eq(account.userId, this.userId),
					eq(account.providerId, 'microsoft')
				))
				.limit(1);

			if (userAccount?.accessToken) {
				this.accessToken = userAccount.accessToken;
				this.refreshToken = userAccount.refreshToken ?? undefined;
				this.resolvedAuthMode = 'user';
				return;
			}
		}

		// If user token is missing but mode wasn't strictly user, try App token as last resort
		if (mode !== 'user' && hasAppCredentials) {
			await this.acquireAppToken();
			this.resolvedAuthMode = 'app';
			return;
		}

		if (mode === 'user') {
			throw new Error('No connected Microsoft account found for this user. Please connect your Microsoft account in settings or switch to App Credentials.');
		}

		throw new Error(
			'Microsoft Authentication failed: Neither an active user Microsoft account connection nor valid Microsoft Entra application credentials (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_TENANT_ID) are available.'
		);
	}

	private async acquireAppToken(): Promise<string> {
		const cacheKey = `${this.tenantId}:${this.clientId}`;
		const cached = appTokenCache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now() + 60 * 1000) {
			this.accessToken = cached.token;
			return cached.token;
		}

		const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
		const body = new URLSearchParams({
			client_id: this.clientId,
			client_secret: this.clientSecret,
			grant_type: 'client_credentials',
			scope: 'https://graph.microsoft.com/.default'
		});

		const res = await fetch(tokenUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body
		});

		if (!res.ok) {
			const errText = await res.text();
			throw new Error(`Failed to acquire Microsoft App token (${res.status}): ${errText}`);
		}

		const data = await res.json();
		this.accessToken = data.access_token;
		const expiresIn = data.expires_in || 3600;
		appTokenCache.set(cacheKey, {
			token: data.access_token,
			expiresAt: Date.now() + expiresIn * 1000
		});

		return this.accessToken!;
	}

	private async refreshUserToken(): Promise<string> {
		if (!this.refreshToken) {
			throw new Error('No Microsoft refresh token available. Please reconnect your Microsoft account with offline_access scope.');
		}

		const tenantId = this.tenantId || 'common';
		const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: this.clientId || MICROSOFT_CLIENT_ID || '',
				client_secret: this.clientSecret || MICROSOFT_CLIENT_SECRET || '',
				grant_type: 'refresh_token',
				refresh_token: this.refreshToken
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to refresh Microsoft user token: ${error}`);
		}

		const data = await response.json();
		this.accessToken = data.access_token;
		if (data.refresh_token) {
			this.refreshToken = data.refresh_token;
		}

		if (this.userId) {
			await db.update(account)
				.set({
					accessToken: this.accessToken,
					refreshToken: this.refreshToken,
					accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
					updatedAt: new Date()
				})
				.where(and(
					eq(account.userId, this.userId),
					eq(account.providerId, 'microsoft')
				));
		}

		return this.accessToken!;
	}

	async makeRequest<T = any>(url: string, options: RequestInit = {}, retry = true): Promise<T> {
		if (!this.accessToken) {
			await this.resolveAuthentication();
		}

		const fullUrl = url.startsWith('http') ? url : `https://graph.microsoft.com/v1.0/${url.replace(/^\//, '')}`;
		const headers = new Headers(options.headers);
		headers.set('Authorization', `Bearer ${this.accessToken}`);
		if (!headers.has('Content-Type') && options.method && options.method !== 'GET' && options.method !== 'DELETE') {
			headers.set('Content-Type', 'application/json');
		}

		const fetchOptions: RequestInit = { ...options, headers };
		let response = await fetch(fullUrl, fetchOptions);

		if (!response.ok) {
			if (response.status === 401 && retry) {
				if (this.resolvedAuthMode === 'app') {
					await this.acquireAppToken();
				} else {
					await this.refreshUserToken();
				}

				headers.set('Authorization', `Bearer ${this.accessToken}`);
				response = await fetch(fullUrl, { ...options, headers });
			}
		}

		if (!response.ok) {
			const errText = await response.text();
			let parsed: any = null;
			try { parsed = JSON.parse(errText); } catch { /* ignore */ }

			const code = parsed?.error?.code || response.statusText;
			const message = parsed?.error?.message || errText || response.statusText;

			let friendlyMessage = `Microsoft Graph API error (${response.status} ${code}): ${message}`;

			if (response.status === 404 && (code === 'ResourceNotFound' || code === 'ErrorItemNotFound')) {
				if (fullUrl.includes('/users/')) {
					const matched = fullUrl.match(/\/users\/([^/]+)/);
					const targetUser = matched ? decodeURIComponent(matched[1]) : 'mailbox';
					friendlyMessage =
						`Target Microsoft 365 mailbox "${targetUser}" was not found or is inaccessible. ` +
						`Details: Graph returned 404 ResourceNotFound. ` +
						`Please check: ` +
						`1) The email "${targetUser}" has no typos. ` +
						`2) The mailbox exists in tenant "${this.tenantId}" and has an active Exchange Online license or shared mailbox status. ` +
						`3) When using App Credentials, the Entra App Registration requires "Calendars.ReadWrite" Application permission with Admin Consent granted. ` +
						`4) When using User Account credentials, the user must have delegate permissions or Full Access to the mailbox.`;
				}
			} else if (response.status === 403) {
				friendlyMessage =
					`Microsoft Graph API permission denied (403 Forbidden). ` +
					`Ensure the appropriate permissions (e.g. Calendars.ReadWrite, Place.Read.All, Contacts.ReadWrite) are granted ` +
					`in Microsoft Entra ID admin center and Admin Consent is granted.`;
			}

			const errorObj = new Error(friendlyMessage) as any;
			errorObj.status = response.status;
			errorObj.code = code;
			errorObj.graphDetails = parsed?.error;
			throw errorObj;
		}

		if (response.status === 204) return {} as T;
		return response.json();
	}

	getMailboxBaseUrl(mailboxEmail?: string): string {
		const target = (mailboxEmail || this.config.mailboxEmail || '').trim();

		if (this.resolvedAuthMode === 'app') {
			if (!target || target === 'me' || target === 'primary') {
				throw new Error(
					'When using Microsoft App Credentials (Client Credentials), a specific target mailbox email address ' +
					'(e.g. veranstaltung.bhs@ballev.onmicrosoft.com) must be configured in settings.'
				);
			}
			return `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(target)}`;
		}

		// User delegated token
		if (!target || target === 'me' || target === 'primary') {
			return 'https://graph.microsoft.com/v1.0/me';
		}
		if (target.includes('@')) {
			return `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(target)}`;
		}
		return 'https://graph.microsoft.com/v1.0/me';
	}

	getCalendarBaseUrl(mailboxEmail?: string, calendarId?: string): string {
		const mbUrl = this.getMailboxBaseUrl(mailboxEmail);
		const calId = (calendarId || this.config.calendarId || 'primary').trim();

		if (!calId || calId === 'primary') {
			return `${mbUrl}/calendar`;
		}
		return `${mbUrl}/calendars/${encodeURIComponent(calId)}`;
	}

	getContactsBaseUrl(mailboxEmail?: string, folderId?: string): string {
		const mbUrl = this.getMailboxBaseUrl(mailboxEmail);
		const fId = (folderId || this.config.folderId || '').trim();

		if (fId) {
			return `${mbUrl}/contactFolders/${encodeURIComponent(fId)}/contacts`;
		}
		return `${mbUrl}/contacts`;
	}

	// --- Diagnostics and Target Validation ---

	async testCalendarTarget(mailboxEmail?: string, calendarId?: string): Promise<MicrosoftTargetTestResult> {
		try {
			await this.resolveAuthentication();
			const mbEmail = mailboxEmail || this.config.mailboxEmail || (this.resolvedAuthMode === 'app' ? '' : 'me');
			const targetUrl = this.getCalendarBaseUrl(mbEmail, calendarId);

			const calData = await this.makeRequest<any>(targetUrl, { method: 'GET' });

			return {
				success: true,
				target: targetUrl,
				authModeUsed: this.resolvedAuthMode,
				mailbox: mbEmail || 'primary',
				displayName: calData.name || 'Primary Calendar',
				message: `Successfully connected to Microsoft Calendar "${calData.name || 'Primary'}" (Owner: ${calData.owner?.name || calData.owner?.address || mbEmail})`,
				details: {
					calendarId: calData.id,
					name: calData.name,
					canEdit: calData.canEdit ?? true,
					owner: calData.owner
				}
			};
		} catch (err: any) {
			return {
				success: false,
				target: mailboxEmail || this.config.mailboxEmail || 'primary',
				authModeUsed: this.resolvedAuthMode,
				mailbox: mailboxEmail || this.config.mailboxEmail || 'primary',
				message: err.message || String(err),
				error: err.message || String(err),
				details: {
					status: err.status,
					code: err.code,
					graphDetails: err.graphDetails
				}
			};
		}
	}

	async testContactsTarget(mailboxEmail?: string, folderId?: string): Promise<MicrosoftTargetTestResult> {
		try {
			await this.resolveAuthentication();
			const mbEmail = mailboxEmail || this.config.mailboxEmail || (this.resolvedAuthMode === 'app' ? '' : 'me');
			const targetUrl = this.getContactsBaseUrl(mbEmail, folderId);

			const res = await this.makeRequest<any>(`${targetUrl}?$top=5`, { method: 'GET' });

			return {
				success: true,
				target: targetUrl,
				authModeUsed: this.resolvedAuthMode,
				mailbox: mbEmail || 'primary',
				message: `Successfully connected to Microsoft Contacts. Accessible contacts found: ${res.value?.length ?? 0}`,
				details: {
					count: res.value?.length ?? 0
				}
			};
		} catch (err: any) {
			return {
				success: false,
				target: mailboxEmail || this.config.mailboxEmail || 'primary',
				authModeUsed: this.resolvedAuthMode,
				mailbox: mailboxEmail || this.config.mailboxEmail || 'primary',
				message: err.message || String(err),
				error: err.message || String(err),
				details: {
					status: err.status,
					code: err.code
				}
			};
		}
	}

	async testResourcesTarget(): Promise<MicrosoftTargetTestResult> {
		try {
			await this.resolveAuthentication();
			const rooms = await this.listRooms();

			return {
				success: true,
				target: 'Tenant Places & Rooms',
				authModeUsed: this.resolvedAuthMode,
				mailbox: 'places/rooms',
				message: `Successfully discovered ${rooms.length} room(s)/resource(s) in Microsoft tenant.`,
				details: {
					roomsCount: rooms.length,
					rooms: rooms.slice(0, 10)
				}
			};
		} catch (err: any) {
			return {
				success: false,
				target: 'Tenant Places & Rooms',
				authModeUsed: this.resolvedAuthMode,
				mailbox: 'places/rooms',
				message: err.message || String(err),
				error: err.message || String(err)
			};
		}
	}

	// --- Tenant Mailbox, Calendar & Folder Discovery ---

	async listTenantMailboxes(options?: {
		type?: 'all' | 'shared' | 'room' | 'user';
		search?: string;
	}): Promise<MicrosoftTenantMailbox[]> {
		await this.resolveAuthentication();

		const resultsMap = new Map<string, MicrosoftTenantMailbox>();
		const typeFilter = options?.type || 'all';
		const searchTerm = options?.search?.trim().toLowerCase();

		const addResult = (mb: MicrosoftTenantMailbox) => {
			const key = mb.email.toLowerCase();
			if (resultsMap.has(key)) {
				// If an existing entry was generic 'user', but specialized discovery classified it as 'shared' or 'room', upgrade it!
				const existing = resultsMap.get(key)!;
				if (existing.type === 'user' && (mb.type === 'shared' || mb.type === 'room')) {
					existing.type = mb.type;
					existing.recipientTypeDetails = mb.recipientTypeDetails;
					if (mb.displayName && (existing.displayName === existing.email || !existing.displayName)) {
						existing.displayName = mb.displayName;
					}
				}
				return;
			}

			// Apply type filtering
			if (typeFilter !== 'all') {
				if (typeFilter === 'shared' && mb.type !== 'shared') return;
				if (typeFilter === 'room' && mb.type !== 'room') return;
				if (typeFilter === 'user' && mb.type !== 'user') return;
			}

			// Apply search filter if active
			if (searchTerm) {
				const matchName = mb.displayName.toLowerCase().includes(searchTerm);
				const matchEmail = mb.email.toLowerCase().includes(searchTerm);
				if (!matchName && !matchEmail) return;
			}

			resultsMap.set(key, mb);
		};

		// 1. Incorporate rooms (from Graph Places API or findRooms)
		const knownRoomEmails = new Set<string>();
		try {
			const rooms = await this.listRooms();
			for (const r of rooms) {
				const rEmail = (r.email || '').toLowerCase().trim();
				if (rEmail) {
					knownRoomEmails.add(rEmail);
					addResult({
						id: r.id,
						displayName: r.name,
						email: r.email,
						type: 'room',
						recipientTypeDetails: 'RoomMailbox'
					});
				}
			}
		} catch (err: any) {
			console.warn('[MicrosoftGraphClient] listTenantMailboxes rooms query warning:', err.message);
		}

		// 2. Discover shared mailboxes already configured in database
		try {
			const configs = await db
				.select()
				.from(syncConfigTable)
				.where(or(
					eq(syncConfigTable.providerType, 'microsoft-calendar'),
					eq(syncConfigTable.providerType, 'microsoft-contacts'),
					eq(syncConfigTable.providerType, 'microsoft-resources')
				));

			for (const cfg of configs) {
				const s = (cfg.settings || {}) as Record<string, any>;
				const email = (s.mailboxEmail || (typeof s.calendarId === 'string' && s.calendarId.includes('@') ? s.calendarId : '')).trim().toLowerCase();
				if (email && email.includes('@')) {
					addResult({
						id: email,
						displayName: cfg.name || email,
						email,
						type: 'shared',
						recipientTypeDetails: 'SharedMailbox (Configured)'
					});
				}
			}
		} catch (err: any) {
			console.warn('[MicrosoftGraphClient] listTenantMailboxes DB known mailboxes warning:', err.message);
		}

		// 3. If a search term is specified, actively probe candidate mailbox
		if (searchTerm) {
			const candidateEmails: string[] = [];
			const defaultDomain = this.config.mailboxEmail?.includes('@')
				? this.config.mailboxEmail.split('@')[1]
				: 'ballev.onmicrosoft.com';
			if (searchTerm.includes('@')) {
				candidateEmails.push(searchTerm);
			} else if (searchTerm.length >= 3) {
				candidateEmails.push(`${searchTerm}@${defaultDomain}`);
			}

			for (const candidate of candidateEmails) {
				if (!resultsMap.has(candidate.toLowerCase())) {
					try {
						const probeUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(candidate)}/calendars?$top=1&$select=id,name,owner`;
						const probeRes = await this.makeRequest<any>(probeUrl, { method: 'GET' });
						if (Array.isArray(probeRes?.value) && probeRes.value.length > 0) {
							const ownerName = probeRes.value[0]?.owner?.name;
							addResult({
								id: candidate,
								displayName: ownerName || candidate,
								email: candidate,
								type: 'shared',
								recipientTypeDetails: 'SharedMailbox (Verified)'
							});
						}
					} catch {
						// Candidate not found or not a valid mailbox
					}
				}
			}
		}

		// 4. Query directory (/users) and apply high-fidelity classification
		try {
			let url = 'users?$top=100&$select=id,displayName,mail,userPrincipalName,accountEnabled,assignedLicenses,userType';
			if (searchTerm && !searchTerm.includes('@')) {
				url += `&$filter=startsWith(displayName,'${encodeURIComponent(searchTerm)}') or startsWith(mail,'${encodeURIComponent(searchTerm)}') or startsWith(userPrincipalName,'${encodeURIComponent(searchTerm)}')`;
			}

			const res = await this.makeRequest<any>(url, { method: 'GET' });
			if (Array.isArray(res.value)) {
				for (const u of res.value) {
					const email = (u.mail || u.userPrincipalName || '').toLowerCase().trim();
					if (!email || !email.includes('@')) continue;

					const isRoom =
						knownRoomEmails.has(email) ||
						/^bhs\.\d/i.test(email) ||
						/^bhs\.\d/i.test(u.displayName || '') ||
						/bhs\.garten/i.test(email) ||
						/\b(raum|room|saal|meeting|konferenz)\b/i.test(u.displayName || '') ||
						/\b(raum|room|saal)\b/i.test(email);

					const isSharedKeyword =
						/(^|[._-])(veranstaltung|veranstaltungen|rechnung|rechnungen|buchung|buchungen|info|kontakt|contact|team|service|support|presse|press|office|buero|empfang|verwaltung|vorstand|shared|share|nachbarschaftshilfe|kalender|calendar|event|events)([._-]|$)/i.test(email) ||
						/\b(veranstaltung|veranstaltungen|rechnung|rechnungen|buchung|buchungen|info|kontakt|team|service|support|presse|office|buero|büro|empfang|verwaltung|vorstand|shared|nachbarschaftshilfe|buchungsseite)\b/i.test(u.displayName || '');

					const isM365SharedProfile =
						u.accountEnabled === false && (!u.assignedLicenses || u.assignedLicenses.length === 0);

					let resolvedType: 'room' | 'shared' | 'user' = 'user';
					let recipientDetails = 'User';

					if (isRoom) {
						resolvedType = 'room';
						recipientDetails = 'RoomMailbox';
					} else if (isSharedKeyword || isM365SharedProfile) {
						resolvedType = 'shared';
						recipientDetails = 'SharedMailbox';
					} else {
						resolvedType = 'user';
						recipientDetails = u.userType === 'Guest' ? 'Guest' : 'User';
					}

					addResult({
						id: u.id || email,
						displayName: u.displayName || email,
						email,
						type: resolvedType,
						recipientTypeDetails: recipientDetails
					});
				}
			}
		} catch (err: any) {
			console.warn('[MicrosoftGraphClient] Directory query (/users) unavailable (requires User.Read.All):', err.message);
		}

		const results = Array.from(resultsMap.values());
		results.sort((a, b) => a.displayName.localeCompare(b.displayName));
		return results;
	}

	async listCalendars(mailboxEmail?: string, currentCalendarId?: string): Promise<MicrosoftCalendarSummary[]> {
		await this.resolveAuthentication();

		const targetEmail = (mailboxEmail || this.config.mailboxEmail || '').trim();
		if (this.resolvedAuthMode === 'app' && (!targetEmail || targetEmail === 'me' || targetEmail === 'primary')) {
			return [];
		}

		try {
			const mbUrl = this.getMailboxBaseUrl(mailboxEmail);
			const calendarsMap = new Map<string, MicrosoftCalendarSummary>();

			// 1. Fetch top-level calendars
			try {
				const url = `${mbUrl}/calendars?$top=100&$select=id,name,isDefaultCalendar,canEdit,owner,color,hexColor`;
				const res = await this.makeRequest<any>(url, { method: 'GET' });
				if (Array.isArray(res?.value)) {
					for (const c of res.value) {
						if (!c?.id) continue;
						calendarsMap.set(c.id, {
							id: c.id,
							name: c.name || 'Calendar',
							isDefault: Boolean(c.isDefaultCalendar),
							canEdit: c.canEdit ?? true,
							owner: c.owner,
							color: c.color,
							hexColor: c.hexColor
						});
					}
				}
			} catch (err: any) {
				console.warn('[MicrosoftGraphClient] listCalendars /calendars query warning:', err.message);
			}

			// 2. Fetch all calendar groups and expand their calendars (e.g. My Calendars, Other Calendars, Shared Calendars)
			try {
				const groupsUrl = `${mbUrl}/calendarGroups?$top=50&$expand=calendars($select=id,name,isDefaultCalendar,canEdit,owner,color,hexColor)`;
				const groupsRes = await this.makeRequest<any>(groupsUrl, { method: 'GET' });
				if (Array.isArray(groupsRes?.value)) {
					for (const g of groupsRes.value) {
						const gName = g?.name || 'Calendars';
						if (Array.isArray(g?.calendars)) {
							for (const c of g.calendars) {
								if (!c?.id) continue;
								const existing = calendarsMap.get(c.id);
								if (existing) {
									if (!existing.groupName) existing.groupName = gName;
								} else {
									calendarsMap.set(c.id, {
										id: c.id,
										name: c.name || 'Calendar',
										groupName: gName,
										isDefault: Boolean(c.isDefaultCalendar),
										canEdit: c.canEdit ?? true,
										owner: c.owner,
										color: c.color,
										hexColor: c.hexColor
									});
								}
							}
						}
					}
				}
			} catch (err: any) {
				console.warn('[MicrosoftGraphClient] listCalendars calendarGroups query warning:', err.message);
			}

			// 3. Ensure primary calendar (/calendar) is represented
			try {
				const primaryUrl = `${mbUrl}/calendar?$select=id,name,isDefaultCalendar,canEdit,owner,color,hexColor`;
				const primaryRes = await this.makeRequest<any>(primaryUrl, { method: 'GET' });
				if (primaryRes?.id) {
					const existing = calendarsMap.get(primaryRes.id);
					if (existing) {
						existing.isDefault = true;
					} else {
						calendarsMap.set(primaryRes.id, {
							id: primaryRes.id,
							name: primaryRes.name || 'Calendar',
							isDefault: true,
							canEdit: primaryRes.canEdit ?? true,
							owner: primaryRes.owner,
							color: primaryRes.color,
							hexColor: primaryRes.hexColor
						});
					}
				}
			} catch (err: any) {
				console.warn('[MicrosoftGraphClient] listCalendars /calendar query warning:', err.message);
			}

			// 4. If currentCalendarId is specified and not yet in the map, resolve it directly by ID
			const trimmedCurrentId = (currentCalendarId || '').trim();
			if (trimmedCurrentId && trimmedCurrentId !== 'primary' && !calendarsMap.has(trimmedCurrentId)) {
				try {
					const directUrl = `${mbUrl}/calendars/${encodeURIComponent(trimmedCurrentId)}?$select=id,name,isDefaultCalendar,canEdit,owner,color,hexColor`;
					const directRes = await this.makeRequest<any>(directUrl, { method: 'GET' });
					if (directRes?.id) {
						calendarsMap.set(directRes.id, {
							id: directRes.id,
							name: directRes.name || 'Saved Calendar',
							groupName: 'Saved Target',
							isDefault: Boolean(directRes.isDefaultCalendar),
							canEdit: directRes.canEdit ?? true,
							owner: directRes.owner,
							color: directRes.color,
							hexColor: directRes.hexColor
						});
					}
				} catch (err: any) {
					console.warn(`[MicrosoftGraphClient] Could not resolve specific calendar ID "${trimmedCurrentId}":`, err.message);
				}
			}

			const calendars = Array.from(calendarsMap.values());

			// If default calendar is present, sort it to the top, then alphabetically
			calendars.sort((a, b) => {
				if (a.isDefault && !b.isDefault) return -1;
				if (!a.isDefault && b.isDefault) return 1;
				return a.name.localeCompare(b.name);
			});

			return calendars;
		} catch (err: any) {
			console.warn('[MicrosoftGraphClient] listCalendars query warning:', err.message);
			return [
				{
					id: 'primary',
					name: 'Primary Calendar',
					isDefault: true,
					canEdit: true
				}
			];
		}
	}

	async listContactFolders(mailboxEmail?: string, currentFolderId?: string): Promise<MicrosoftContactFolderSummary[]> {
		await this.resolveAuthentication();

		const targetEmail = (mailboxEmail || this.config.mailboxEmail || '').trim();
		if (this.resolvedAuthMode === 'app' && (!targetEmail || targetEmail === 'me' || targetEmail === 'primary')) {
			return [];
		}

		try {
			const mbUrl = this.getMailboxBaseUrl(mailboxEmail);
			const foldersMap = new Map<string, MicrosoftContactFolderSummary>();

			// 1. Fetch top-level contact folders
			try {
				const url = `${mbUrl}/contactFolders?$top=100&$select=id,displayName,parentFolderId`;
				const res = await this.makeRequest<any>(url, { method: 'GET' });
				if (Array.isArray(res?.value)) {
					for (const f of res.value) {
						if (!f?.id) continue;
						foldersMap.set(f.id, {
							id: f.id,
							displayName: f.displayName || 'Contacts',
							parentFolderId: f.parentFolderId
						});
					}
				}
			} catch (err: any) {
				console.warn('[MicrosoftGraphClient] listContactFolders query warning:', err.message);
			}

			// 2. If currentFolderId is specified and not yet in the map, resolve it directly
			const trimmedFolderId = (currentFolderId || '').trim();
			if (trimmedFolderId && !foldersMap.has(trimmedFolderId)) {
				try {
					const directUrl = `${mbUrl}/contactFolders/${encodeURIComponent(trimmedFolderId)}?$select=id,displayName,parentFolderId`;
					const directRes = await this.makeRequest<any>(directUrl, { method: 'GET' });
					if (directRes?.id) {
						foldersMap.set(directRes.id, {
							id: directRes.id,
							displayName: directRes.displayName || 'Saved Contact Folder',
							parentFolderId: directRes.parentFolderId
						});
					}
				} catch (err: any) {
					console.warn(`[MicrosoftGraphClient] Could not resolve specific folder ID "${trimmedFolderId}":`, err.message);
				}
			}

			const folders = Array.from(foldersMap.values());
			folders.sort((a, b) => a.displayName.localeCompare(b.displayName));
			return folders;
		} catch (err: any) {
			console.warn('[MicrosoftGraphClient] listContactFolders query warning:', err.message);
			return [];
		}
	}

	// --- Room & Place Discovery ---

	async listRooms(): Promise<MicrosoftRoom[]> {
		const resultsMap = new Map<string, MicrosoftRoom>();
		let lastError: any = null;

		const addRoom = (r: MicrosoftRoom) => {
			const key = (r.email || r.id).toLowerCase().trim();
			if (key && !resultsMap.has(key)) {
				resultsMap.set(key, r);
			}
		};

		// 1. Try Graph Places API (standard in M365) with @odata.nextLink pagination
		try {
			let nextUrl: string | null = 'places/microsoft.graph.room';
			let pages = 0;
			while (nextUrl && pages < 10) {
				pages++;
				const res: any = await this.makeRequest<any>(nextUrl, { method: 'GET' });
				if (Array.isArray(res.value)) {
					for (const r of res.value) {
						addRoom({
							id: r.id || r.emailAddress,
							name: r.displayName || r.nickname || r.emailAddress,
							email: r.emailAddress || '',
							capacity: r.capacity ?? undefined,
							building: r.building ?? undefined,
							floorNumber: r.floorNumber ?? undefined,
							type: 'room'
						});
					}
				}
				nextUrl = res['@odata.nextLink'] || null;
			}
		} catch (err) {
			lastError = err;
			console.warn('[MicrosoftGraphClient] Places API failed with primary auth, attempting App Token fallback:', (err as any)?.message);

			// Fallback: If primary auth lacked Place permissions (e.g. user token), try App Credentials if configured
			if (this.clientId && this.clientSecret) {
				try {
					const appToken = await this.acquireAppToken();
					let nextAppUrl: string | null = 'https://graph.microsoft.com/v1.0/places/microsoft.graph.room';
					let appPages = 0;
					while (nextAppUrl && appPages < 10) {
						appPages++;
						const appRes: Response = await fetch(nextAppUrl, {
							headers: { Authorization: `Bearer ${appToken}` }
						});
						if (appRes.ok) {
							const appData: any = await appRes.json();
							if (Array.isArray(appData.value)) {
								for (const r of appData.value) {
									addRoom({
										id: r.id || r.emailAddress,
										name: r.displayName || r.nickname || r.emailAddress,
										email: r.emailAddress || '',
										capacity: r.capacity ?? undefined,
										building: r.building ?? undefined,
										floorNumber: r.floorNumber ?? undefined,
										type: 'room'
									});
								}
							}
							nextAppUrl = appData['@odata.nextLink'] || null;
						} else {
							break;
						}
					}
				} catch (appErr: any) {
					console.warn('[MicrosoftGraphClient] Places API with app token fallback failed:', appErr.message);
				}
			}
		}

		// 2. Supplement with findRooms (if user token or delegate context) to discover newly provisioned rooms
		// before Microsoft Places indexing finishes propagating
		if (this.resolvedAuthMode === 'user') {
			try {
				const res = await this.makeRequest<any>('me/findRooms', { method: 'GET' });
				if (Array.isArray(res.value)) {
					for (const r of res.value) {
						addRoom({
							id: r.address || r.name,
							name: r.name || r.address,
							email: r.address || '',
							type: 'room'
						});
					}
				}
			} catch (err) {
				if (resultsMap.size === 0) lastError = err;
			}
		}

		// 3. Fallback: Search user directory for Room Mailboxes if none found yet
		if (resultsMap.size === 0) {
			try {
				const res = await this.makeRequest<any>(
					"users?$top=100&$select=id,displayName,mail,userPrincipalName,userType",
					{ method: 'GET' }
				);

				if (Array.isArray(res.value)) {
					for (const u of res.value) {
						const email = u.mail || u.userPrincipalName;
						if (email) {
							addRoom({
								id: u.id || email,
								name: u.displayName || email,
								email,
								type: 'room'
							});
						}
					}
				}
			} catch (err) {
				if (resultsMap.size === 0 && lastError) {
					throw lastError;
				}
			}
		}

		return Array.from(resultsMap.values());
	}

	// --- Room Availability & Booking ---

	async checkRoomAvailability(
		roomEmails: string[],
		start: Date,
		end: Date
	): Promise<Map<string, RoomAvailabilityResult>> {
		const resultMap = new Map<string, RoomAvailabilityResult>();
		if (!roomEmails || roomEmails.length === 0) return resultMap;

		const validEmails = roomEmails.filter((e) => typeof e === 'string' && e.includes('@'));
		if (validEmails.length === 0) return resultMap;

		try {
			const mbUrl = this.resolvedAuthMode === 'user' ? 'me' : `users/${encodeURIComponent(validEmails[0])}`;
			const scheduleUrl = `${mbUrl}/calendar/getSchedule`;

			const payload = {
				schedules: validEmails,
				startTime: {
					dateTime: formatLocal(start, 'UTC'),
					timeZone: 'UTC'
				},
				endTime: {
					dateTime: formatLocal(end, 'UTC'),
					timeZone: 'UTC'
				},
				availabilityViewInterval: 15
			};

			const scheduleRes = await this.makeRequest<any>(scheduleUrl, {
				method: 'POST',
				body: JSON.stringify(payload)
			});

			if (Array.isArray(scheduleRes.value)) {
				for (const item of scheduleRes.value) {
					const email = item.scheduleId?.toLowerCase();
					const busyItems: any[] = item.scheduleItems || [];
					const isAvailable = busyItems.length === 0;

					const busySlots = busyItems.map((b: any) => ({
						start: b.start?.dateTime || '',
						end: b.end?.dateTime || ''
					}));

					const conflictMessage = !isAvailable
						? `Room has ${busyItems.length} conflict(s) during this time range (${busyItems.map((b: any) => `${b.start?.dateTime} - ${b.end?.dateTime}`).join(', ')})`
						: undefined;

					resultMap.set(email, {
						email,
						isAvailable,
						busySlots,
						conflictMessage
					});
				}
			}
		} catch (err: any) {
			console.warn('[MicrosoftGraphClient] checkRoomAvailability failed:', err.message);
			// Fallback: assume available with warning if API check fails
			for (const email of validEmails) {
				resultMap.set(email.toLowerCase(), {
					email,
					isAvailable: true,
					busySlots: [],
					conflictMessage: `Could not verify live schedule: ${err.message}`
				});
			}
		}

		return resultMap;
	}
}
