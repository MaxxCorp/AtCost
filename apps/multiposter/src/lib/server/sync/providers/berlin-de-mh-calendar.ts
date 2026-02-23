import type {
    SyncProvider,
    SyncConfig,
    ExternalEvent,
    ProviderType,
    SyncDirection
} from '../types';
import { resolveEventContact } from '$lib/server/contact-resolution';
import { env } from '$env/dynamic/private';

const BASE_URL = 'https://www.berlin.de/land/kalender/admin/index.php';

/**
 * Berlin.de Marzahn-Hellersdorf Calendar sync provider
 * Pushes events to the Berlin.de Kalender admin panel for the MH district.
 * 
 * Uses cookie-based session auth and sequential POST requests to fill
 * the multi-page event creation form.
 */
export class BerlinDeMhCalendarProvider implements SyncProvider {
    readonly type: ProviderType = 'berlin-de-mh-calendar';
    readonly name = 'Berlin.de (Marzahn-Hellersdorf Calendar)';
    readonly supportsWebhooks = false;
    readonly supportedDirections: SyncDirection[] = ['push'];
    readonly supportedEntityTypes: ('event' | 'announcement')[] = ['event'];

    private config?: SyncConfig;
    private sessionCookie?: string;

    async initialize(config: SyncConfig): Promise<void> {
        this.config = config;
    }

    async validateConnection(): Promise<boolean> {
        try {
            await this.login();
            return true;
        } catch {
            return false;
        }
    }

    async pullEvents(): Promise<{ events: ExternalEvent[]; nextSyncToken?: string }> {
        throw new Error('Berlin.de MH Calendar provider only supports push operations');
    }

    async pushEvent(event: ExternalEvent): Promise<{ externalId: string; etag?: string }> {
        if (!this.config) throw new Error('Provider not initialized');

        // Step 1: Login and get session
        await this.login();

        // Step 2: Create a new event → get editid
        const editId = await this.createEvent();

        // Step 3: Fill out each page
        await this.submitOverview(editId, event);
        await this.submitText(editId, event);
        await this.submitDetails(editId);
        await this.submitDate(editId, event);
        await this.submitWeb(editId, event);
        await this.submitImage(editId, event);

        return {
            externalId: `berlin-de-mh-${editId}`,
            etag: new Date().toISOString()
        };
    }

    async updateEvent(_externalId: string, event: ExternalEvent): Promise<{ etag?: string }> {
        // The admin form doesn't support clean updates via URL — treat as new submission
        await this.pushEvent(event);
        return { etag: new Date().toISOString() };
    }

    async deleteEvent(externalId: string): Promise<void> {
        console.warn(`Berlin.de MH Calendar provider doesn't support event deletion for ${externalId}`);
    }

    // ----------------------------------------------------------------
    // Private helpers — session management
    // ----------------------------------------------------------------

    private getCredentials(): { username: string; password: string } {
        const username = this.config?.credentials?.username;
        const password = this.config?.credentials?.password;
        if (!username || !password) {
            throw new Error('Berlin.de MH Calendar: credentials (username, password) are required in sync config');
        }
        return { username, password };
    }

    private async login(): Promise<void> {
        const { username, password } = this.getCredentials();

        const body = new URLSearchParams({
            loginusername: username,
            loginpassword: password,
            loginusergroup: '0'
        });

        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'AC-Multiposter/1.0'
            },
            body: body.toString(),
            redirect: 'manual' // capture Set-Cookie before redirect
        });

        // Collect session cookie from response headers
        const setCookies = response.headers.getSetCookie?.() ?? [];
        const cookieParts: string[] = [];
        for (const sc of setCookies) {
            const name = sc.split(';')[0];
            if (name) cookieParts.push(name);
        }

        // Fallback: try raw header if getSetCookie is not available
        if (cookieParts.length === 0) {
            const raw = response.headers.get('set-cookie');
            if (raw) {
                cookieParts.push(raw.split(';')[0]);
            }
        }

        if (cookieParts.length === 0) {
            throw new Error('Berlin.de MH Calendar: login failed — no session cookie received');
        }

        this.sessionCookie = cookieParts.join('; ');
    }

    /**
     * Make an authenticated request, following redirects manually to preserve cookies
     */
    private async authedFetch(
        url: string,
        options: RequestInit = {}
    ): Promise<Response> {
        if (!this.sessionCookie) throw new Error('Not logged in');

        const headers = new Headers(options.headers);
        headers.set('Cookie', this.sessionCookie);
        if (!headers.has('User-Agent')) {
            headers.set('User-Agent', 'AC-Multiposter/1.0');
        }

        const response = await fetch(url, {
            ...options,
            headers,
            redirect: 'manual'
        });

        // Update session cookie from response if refreshed
        const setCookies = response.headers.getSetCookie?.() ?? [];
        for (const sc of setCookies) {
            const name = sc.split(';')[0];
            if (name) this.sessionCookie = name; // take latest
        }

        // If redirect, follow it with our cookie
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('location');
            if (location) {
                const redirectUrl = location.startsWith('http')
                    ? location
                    : new URL(location, url).toString();
                return this.authedFetch(redirectUrl, { method: 'GET' });
            }
        }

        return response;
    }

    /**
     * POST form data to an authenticated URL
     */
    private async postForm(url: string, data: Record<string, string>): Promise<Response> {
        return this.authedFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(data).toString()
        });
    }

    // ----------------------------------------------------------------
    // Private helpers — multi-page form flow
    // ----------------------------------------------------------------

    private async createEvent(): Promise<string> {
        // Navigate to action=new to create a blank event
        const response = await this.authedFetch(
            `${BASE_URL}?modul=veranstaltungen&action=new`
        );

        // After creation, the URL contains editid=XXXXX
        const finalUrl = response.url || '';
        const editIdMatch = finalUrl.match(/editid=(\d+)/);

        if (!editIdMatch) {
            // Try to extract from response body as fallback
            const body = await response.text();
            const bodyMatch = body.match(/editid=(\d+)/);
            if (!bodyMatch) {
                throw new Error('Berlin.de MH Calendar: failed to create event — no editid in response');
            }
            return bodyMatch[1];
        }

        return editIdMatch[1];
    }

    private editUrl(editId: string, editAction: string): string {
        return `${BASE_URL}?modul=veranstaltungen&action=edit&editid=${editId}&edit_action=${editAction}`;
    }

    /**
     * Overview page: set retention period and free/paid status
     */
    private async submitOverview(editId: string, event: ExternalEvent): Promise<void> {
        const isFree = this.isEventFree(event);

        await this.postForm(this.editUrl(editId, 'overview'), {
            update_draft: '0',      // Delete 2 weeks after event date
            update_gratis: isFree ? '1' : '0'
        });
    }

    /**
     * Text page: set title and description
     */
    private async submitText(editId: string, event: ExternalEvent): Promise<void> {
        await this.postForm(this.editUrl(editId, 'text'), {
            update_name: event.summary,
            update_beschreibung: event.description || event.summary
        });
    }

    /**
     * Details page: set district to Marzahn-Hellersdorf (value=4)
     */
    private async submitDetails(editId: string): Promise<void> {
        await this.postForm(this.editUrl(editId, 'details'), {
            update_bezirk: '4' // Marzahn-Hellersdorf
        });
    }

    /**
     * Date page: two-step process
     *   1. Select "single date" mode (update_terminmodus=1)
     *   2. Submit the actual date/time
     */
    private async submitDate(editId: string, event: ExternalEvent): Promise<void> {
        if (!event.startDateTime) return;

        const dateUrl = this.editUrl(editId, 'date');

        // Step 1: set terminmodus to single date
        await this.postForm(dateUrl, {
            update_terminmodus: '1'
        });

        // Step 2: submit date and time
        const start = new Date(event.startDateTime);
        const dateData: Record<string, string> = {
            neuer_termin: '1',
            datetag_von: this.formatDateDE(start),
            uhrzeit_von: this.formatTime(start)
        };

        if (event.endDateTime) {
            const end = new Date(event.endDateTime);
            dateData.uhrzeit_bis_nutzen = '1';
            dateData.uhrzeit_bis = this.formatTime(end);
        }

        await this.postForm(dateUrl, dateData);
    }

    /**
     * Web page: set contact email and homepage URL
     */
    private async submitWeb(editId: string, event: ExternalEvent): Promise<void> {
        const data: Record<string, string> = {};

        // Resolve contact email
        const resolvedContact = await resolveEventContact(event);
        if (resolvedContact?.email) {
            data.update_email = resolvedContact.email;
        }

        // Public event link
        const publicUrl = this.getPublicEventUrl(event);
        if (publicUrl) {
            data.update_homepage = publicUrl;
        }

        if (Object.keys(data).length > 0) {
            await this.postForm(this.editUrl(editId, 'web'), data);
        }
    }

    /**
     * Image page: upload the first event image if available
     */
    private async submitImage(editId: string, event: ExternalEvent): Promise<void> {
        if (!event.image?.url) return;

        try {
            // Download the image
            const imageResponse = await fetch(event.image.url);
            if (!imageResponse.ok) return;

            const imageBlob = await imageResponse.blob();

            // Determine filename from URL or use default
            const urlPath = new URL(event.image.url).pathname;
            const filename = urlPath.split('/').pop() || 'event-image.jpg';

            // Build multipart form data
            const formData = new FormData();
            formData.append('userfile', imageBlob, filename);
            formData.append('update_dateitext', event.image.title || event.summary);
            formData.append('update_bildunterschrift', event.image.title || '');
            formData.append('update_dateicopy', '');

            await this.authedFetch(this.editUrl(editId, 'image'), {
                method: 'POST',
                body: formData
                // No Content-Type header — fetch sets it with boundary for FormData
            });
        } catch (error) {
            // Image upload failure shouldn't block the rest of the sync
            console.warn(`Berlin.de MH Calendar: image upload failed:`, error);
        }
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    /**
     * Determines if the event is free.
     * If ticketPrice is a parseable number, the event has a cost → not free.
     * Otherwise (text like "Free", empty, or absent) → free.
     */
    private isEventFree(event: ExternalEvent): boolean {
        const price = event.ticketPrice ?? event.metadata?.ticketPrice;
        if (!price) return true;
        const parsed = parseFloat(String(price));
        if (isNaN(parsed)) return true; // Non-numeric → free
        return parsed === 0; // Zero → free, any positive number → not free
    }

    /** Format date as DD.MM.YYYY */
    private formatDateDE(date: Date): string {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    }

    /** Format time as HH:MM */
    private formatTime(date: Date): string {
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    /** Get the public view URL for a multiposter event */
    private getPublicEventUrl(event: ExternalEvent): string | undefined {
        // Check source URL first
        if (event.source?.url) return event.source.url;

        // Construct from event ID and base URL
        const baseUrl = env.BETTER_AUTH_URL || 'https://localhost:5173';
        if (event.externalId) {
            return `${baseUrl}/events/${event.externalId}`;
        }
        return undefined;
    }
}
