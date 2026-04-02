import type {
    SyncProvider,
    SyncConfig,
    ExternalEvent,
    ProviderType,
    SyncDirection
} from '../types';
import { env } from '$env/dynamic/private';
import { htmlToPlainText } from '../utils/html';

/**
 * Nebenan.de Sync Provider
 * Pushes events to the organisation.nebenan.de platform.
 * 
 * TODO: The exact API endpoints and JSON payload structure need to be
 * verified by analyzing the network traffic during a manual event creation.
 */
export class NebenanDeProvider implements SyncProvider {
    readonly type: ProviderType = 'nebenan-de';
    readonly name = 'Nebenan.de';
    readonly supportsWebhooks = false;
    readonly supportedDirections: SyncDirection[] = ['push'];
    readonly supportedEntityTypes: ('event' | 'announcement')[] = ['event'];

    private config?: SyncConfig;
    private sessionToken?: string;

    private get baseUrl(): string {
        return env.NEBENAN_DE_API_URL || 'https://biz-nbn.nebenan.de/api';
    }

    private static readonly NOPE_CLIENT = 'nope-web-v129.45.1';

    /**
     * Map internal categories to Nebenan.de numeric category IDs.
     */
    private static readonly CATEGORY_MAPPING: Record<string, number> = {
        'Ausstellungen': 19, // Kunst, Kultur & Musik
        'Bälle & Galas': 23, // Feste & Feiern
        'Bildung & Vorträge': 18, // Bildung & Erfahrung
        'Festivals': 23, // Feste & Feiern
        'Jazz & Blues': 19, // Kunst, Kultur & Musik
        'Kabarett & Comedy': 19, // Kunst, Kultur & Musik
        'Kinderveranstaltungen': 21, // Familien & Kinder
        'Klassische Konzerte': 19, // Kunst, Kultur & Musik
        'Literatur': 19, // Kunst, Kultur & Musik
        'Musical': 19, // Kunst, Kultur & Musik
        'Oper & Tanz': 19, // Kunst, Kultur & Musik
        'Pop, Rock & HipHop': 19, // Kunst, Kultur & Musik
        'Schlager & Volksmusik': 19, // Kunst, Kultur & Musik
        'Show': 19, // Kunst, Kultur & Musik
        'Sport': 27, // Sport & Bewegung
        'Theater': 19, // Kunst, Kultur & Musik
        'Vermischtes': 32, // Sonstiges
    };

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
        throw new Error('Nebenan.de provider only supports push operations');
    }

    async pushEvent(event: ExternalEvent): Promise<{ externalId: string; etag?: string }> {
        if (!this.config) throw new Error('Provider not initialized');

        await this.ensureLoggedIn();

        const payload = this.formatEventPayload(event);

        const response = await this.authedFetch(`${this.baseUrl}/private/hood_messages`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Nebenan.de push failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        
        return {
            externalId: data.id?.toString() || 'PLACEHOLDER_ID',
            etag: new Date(data.updated_at || new Date()).toISOString()
        };
    }

    async updateEvent(externalId: string, event: ExternalEvent): Promise<{ etag?: string }> {
        if (!this.config) throw new Error('Provider not initialized');

        await this.ensureLoggedIn();

        const payload = this.formatEventPayload(event);

        const response = await this.authedFetch(`${this.baseUrl}/private/hood_messages/${externalId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Nebenan.de update failed: ${response.status} ${errorText}`);
        }

        return { etag: new Date().toISOString() };
    }

    async deleteEvent(externalId: string): Promise<void> {
        if (!this.config) throw new Error('Provider not initialized');

        await this.ensureLoggedIn();

        const response = await this.authedFetch(`${this.baseUrl}/private/hood_messages/${externalId}`, {
            method: 'DELETE'
        });

        if (!response.ok && response.status !== 404) {
            const errorText = await response.text();
            throw new Error(`Nebenan.de delete failed: ${response.status} ${errorText}`);
        }
    }

    // ----------------------------------------------------------------
    // Private Helpers
    // ----------------------------------------------------------------

    private getCredentials(): { email: string; password: string } {
        const email = this.config?.credentials?.email || this.config?.credentials?.username;
        const password = this.config?.credentials?.password;
        if (!email || !password) {
            throw new Error('Nebenan.de: credentials (email/username, password) are required in sync config');
        }
        return { email, password };
    }

    private async login(): Promise<void> {
        const { email, password } = this.getCredentials();

        const response = await fetch(`${this.baseUrl}/sessions`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'nope-client': NebenanDeProvider.NOPE_CLIENT
            },
            body: JSON.stringify({ user: { email, password } })
        });

        if (!response.ok) {
            throw new Error(`Nebenan.de login failed: ${response.status}`);
        }

        this.sessionToken = response.headers.get('x-auth-token') || undefined;
        if (!this.sessionToken) {
            // Check if it's in the response body (unlikely for x-auth-token but let's be safe)
            const data = await response.json();
            this.sessionToken = data.token || data.user?.token;
        }

        if (!this.sessionToken) {
            throw new Error('Nebenan.de: Failed to obtain session token after login');
        }
    }

    private async ensureLoggedIn(): Promise<void> {
        if (this.sessionToken) return;
        await this.login();
    }

    private async authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
        if (!this.sessionToken) throw new Error('Not logged in');

        const headers = new Headers(options.headers);
        headers.set('x-auth-token', this.sessionToken);
        headers.set('nope-client', NebenanDeProvider.NOPE_CLIENT);
        headers.set('Content-Type', 'application/json');

        return fetch(url, { ...options, headers });
    }

    /**
     * Map Internal Event to Nebenan.de Payload Structure
     */
    private formatEventPayload(event: ExternalEvent): Record<string, any> {
        const summary = event.summary || 'Untitled Event';
        
        // Convert HTML description to readable plain text
        const rawDescription = event.description || summary;
        const plainDescription = htmlToPlainText(rawDescription);

        const locationName = event.venue?.name || event.location || '';
        
        // Map category
        const internalCategory = event.metadata?.categoryBerlinDotDe as string | undefined;
        let mappedCategoryId = 32; // Fallback: Sonstiges
        
        if (internalCategory && internalCategory in NebenanDeProvider.CATEGORY_MAPPING) {
            mappedCategoryId = NebenanDeProvider.CATEGORY_MAPPING[internalCategory];
        }

        // Nebenan.de expects ISO strings for starts_at and ends_at
        const start = event.startDateTime?.toISOString();
        const end = event.endDateTime?.toISOString();

        // The business profile ID (Gewerbeprofil)
        // Hardcoded as identified during research, but could be made configurable.
        const profileId = 'cbe780d1-9642-49e5-8928-d1c163698658';

        return {
            subject: summary,
            body: plainDescription,
            starts_at: start,
            ends_at: end,
            location: locationName,
            category_id: mappedCategoryId,
            profile_id: profileId,
            visibility: 'neighborhood_surroundings_and_partner_profile' // Internal name for the maximum visibility option
        };
    }
}
