import type {
    SyncProvider,
    SyncConfig,
    ExternalEvent,
    ProviderType,
    SyncDirection
} from '../types';
import { env } from '$env/dynamic/private';

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
        // TODO: Replace with the actual API base URL observed in Network tab
        return env.NEBENAN_DE_API_URL || 'https://api.nebenan.de/v1';
    }

    /**
     * Map internal (berlin.de based) categories to Nebenan.de categories.
     * Nebenan.de only supports a single category.
     */
    private static readonly CATEGORY_MAPPING: Record<string, string> = {
        'Ausstellungen': 'Kunst, Kultur & Musik',
        'Bälle & Galas': 'Feste & Feiern',
        'Bildung & Vorträge': 'Bildung & Erfahrung',
        'Festivals': 'Feste & Feiern',
        'Jazz & Blues': 'Kunst, Kultur & Musik',
        'Kabarett & Comedy': 'Kunst, Kultur & Musik',
        'Kinderveranstaltungen': 'Familien & Kinder',
        'Klassische Konzerte': 'Kunst, Kultur & Musik',
        'Literatur': 'Kunst, Kultur & Musik',
        'Musical': 'Kunst, Kultur & Musik',
        'Oper & Tanz': 'Kunst, Kultur & Musik',
        'Pop, Rock & HipHop': 'Kunst, Kultur & Musik',
        'Schlager & Volksmusik': 'Kunst, Kultur & Musik',
        'Show': 'Kunst, Kultur & Musik',
        'Sport': 'Sport & Bewegung',
        'Theater': 'Kunst, Kultur & Musik',
        'Vermischtes': 'Sonstiges',
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

        // TODO: Replace with actual endpoint and handle response
        const response = await this.authedFetch(`${this.baseUrl}/events`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Nebenan.de push failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        
        return {
            externalId: data.id || 'PLACEHOLDER_ID',
            etag: new Date().toISOString()
        };
    }

    async updateEvent(externalId: string, event: ExternalEvent): Promise<{ etag?: string }> {
        if (!this.config) throw new Error('Provider not initialized');

        await this.ensureLoggedIn();

        const payload = this.formatEventPayload(event);

        // TODO: Replace with actual endpoint for updates (usually PUT or PATCH)
        const response = await this.authedFetch(`${this.baseUrl}/events/${externalId}`, {
            method: 'PUT',
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

        // TODO: Replace with actual delete endpoint
        const response = await this.authedFetch(`${this.baseUrl}/events/${externalId}`, {
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

        // TODO: Replace with the actual login endpoint and payload format.
        // Nebenan.de is an SPA, so it likely expects JSON or sends a JWT/Session cookie.
        const response = await fetch(`${this.baseUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error(`Nebenan.de login failed: ${response.status}`);
        }

        // Example: If they return a JWT token
        // const data = await response.json();
        // this.sessionToken = data.token;
        
        // Or if they use Set-Cookie, fetch handles it automatically given we 
        // will preserve cookies, but Node fetch might need manual cookie jarring
        // if we are instantiating fetch fresh every time.
        this.sessionToken = 'DUMMY_TOKEN_UNTIL_VERIFIED'; 
    }

    private async ensureLoggedIn(): Promise<void> {
        if (this.sessionToken) return;
        await this.login();
    }

    private async authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
        if (!this.sessionToken) throw new Error('Not logged in');

        const headers = new Headers(options.headers);
        // TODO: Adjust standard auth header based on Nebenan API inspection
        headers.set('Authorization', `Bearer ${this.sessionToken}`);
        headers.set('Content-Type', 'application/json');

        return fetch(url, { ...options, headers });
    }

    /**
     * Map Internal Event to Nebenan.de Payload Structure
     */
    private formatEventPayload(event: ExternalEvent): Record<string, any> {
        const summary = event.summary || 'Untitled Event';
        
        // Strip HTML tags for plain text description
        const rawDescription = event.description || summary;
        const plainDescription = rawDescription.replace(/<[^>]+>/g, '').trim();

        const locationName = event.venue?.name || event.location || '';
        
        // Map category
        const internalCategory = event.metadata?.categoryBerlinDotDe as string | undefined;
        let mappedCategory = 'Sonstiges'; // Fallback
        
        if (internalCategory && internalCategory in NebenanDeProvider.CATEGORY_MAPPING) {
            mappedCategory = NebenanDeProvider.CATEGORY_MAPPING[internalCategory];
        }

        // Round time to 30 mins
        const roundTime = (date: Date): { day: string; time: string } => {
            const minutes = date.getMinutes();
            // simple rounding to nearest 30 min block
            const roundedMinutes = minutes >= 15 && minutes < 45 ? 30 : 0;
            let finalHours = date.getHours();
            if (minutes >= 45) finalHours += 1;
            
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            
            const hh = String(finalHours % 24).padStart(2, '0');
            const minStr = String(roundedMinutes).padStart(2, '0');

            return {
                day: `${yyyy}-${mm}-${dd}`, // Placeholder format, check API!
                time: `${hh}:${minStr}`
            };
        };

        const start = event.startDateTime ? roundTime(event.startDateTime) : undefined;
        const end = event.endDateTime ? roundTime(event.endDateTime) : undefined;

        // TODO: Verify the actual JSON payload structure of the POST request
        return {
            name: summary,
            location: locationName,
            description: plainDescription,
            category: mappedCategory,
            visibility: 'Nachbarschaft, Umgebung & Partner-Profil', // Default max visibility
            start_date: start?.day,
            start_time: start?.time,
            end_date: end?.day,
            end_time: end?.time,
            // image upload handled via separate endpoint or base64 usually
        };
    }
}
