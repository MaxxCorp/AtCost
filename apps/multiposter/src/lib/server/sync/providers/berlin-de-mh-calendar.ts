import type {
    SyncProvider,
    SyncConfig,
    ExternalEvent,
    ProviderType,
    SyncDirection
} from '../types';
import { resolveContactForEventId } from '$lib/server/contact-resolution';
import { env } from '$env/dynamic/private';
import { htmlToPlainText } from '../utils/html';

/**
 * Berlin.de Marzahn-Hellersdorf Calendar sync provider
 * Pushes events to the Berlin.de Kalender admin panel for the MH district.
 *
 * Uses cookie-based session auth and sequential POST requests to fill
 * the multi-page event creation form.
 *
 * Form field names are verified against the live admin panel at
 * https://www.berlin.de/land/kalender/admin/index.php
 */
export class BerlinDeMhCalendarProvider implements SyncProvider {
    readonly type: ProviderType = 'berlin-de-mh-calendar';
    readonly name = 'Berlin.de (Marzahn-Hellersdorf Calendar)';
    readonly supportsWebhooks = false;
    readonly supportedDirections: SyncDirection[] = ['push'];
    readonly supportedEntityTypes: ('event' | 'announcement')[] = ['event'];

    private config?: SyncConfig;
    private sessionCookie?: string;

    private get baseUrl(): string {
        return env.BERLIN_DE_MH_API_URL || 'https://www.berlin.de/land/kalender/admin/index.php';
    }

    /**
     * Mapping from our Berlin.de category names to remote category IDs.
     * Remote categories (from the "Fügen Sie eine Kategorie hinzu" dropdown):
     *   1  = Ausstellungen
     *   2  = Feste, Events
     *   3  = Kinder, Jugendliche
     *   4  = Lesungen, Vorträge
     *   5  = Musik, Konzerte
     *   9  = Freizeit, Sport
     *   10 = Bühnen, Filme
     *   116 = Kunst, Kultur
     *   118 = Bildung, Schule
     *
     * Each of our categories maps to 1-3 remote categories (maximising coverage
     * while keeping logical consistency).
     */
    private static readonly CATEGORY_MAPPING: Record<string, string[]> = {
        'Ausstellungen': ['1'],                // Ausstellungen
        'Bälle & Galas': ['2'],                // Feste, Events
        'Bildung & Vorträge': ['118', '4'],         // Bildung, Schule + Lesungen, Vorträge
        'Festivals': ['2', '5'],           // Feste, Events + Musik, Konzerte
        'Jazz & Blues': ['5'],                 // Musik, Konzerte
        'Kabarett & Comedy': ['10', '116'],        // Bühnen, Filme + Kunst, Kultur
        'Kinderveranstaltungen': ['3'],                 // Kinder, Jugendliche
        'Klassische Konzerte': ['5', '116'],          // Musik, Konzerte + Kunst, Kultur
        'Literatur': ['4', '116'],          // Lesungen, Vorträge + Kunst, Kultur
        'Musical': ['10', '5'],           // Bühnen, Filme + Musik, Konzerte
        'Oper & Tanz': ['10', '116', '5'],   // Bühnen, Filme + Kunst, Kultur + Musik, Konzerte
        'Pop, Rock & HipHop': ['5'],                 // Musik, Konzerte
        'Schlager & Volksmusik': ['5'],                 // Musik, Konzerte
        'Show': ['10', '2'],           // Bühnen, Filme + Feste, Events
        'Sport': ['9'],                 // Freizeit, Sport
        'Theater': ['10', '116'],         // Bühnen, Filme + Kunst, Kultur
        'Vermischtes': ['116'],               // Kunst, Kultur
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
        throw new Error('Berlin.de MH Calendar provider only supports push operations');
    }

    async pushEvent(event: ExternalEvent): Promise<{ externalId: string; etag?: string }> {
        if (!this.config) throw new Error('Provider not initialized');

        // Step 1: Login and get session
        await this.ensureLoggedIn();

        // Step 2: Create a new event → parse editid from success banner
        const editId = await this.createEvent();

        // Step 3: Fill out each page in sequence
        await this.submitStatus(editId, event);
        await this.submitText(editId, event);
        await this.submitDetailsDistrict(editId);
        await this.submitDetailsCategories(editId, event);
        await this.submitDetailsOrganizer(editId, event);
        await this.submitDetailsVenue(editId, event);
        await this.submitDate(editId, event);
        await this.submitWeb(editId, event);
        await this.submitImage(editId, event);

        return {
            externalId: editId,
            etag: new Date().toISOString()
        };
    }

    async updateEvent(externalId: string, event: ExternalEvent): Promise<{ etag?: string }> {
        if (!this.config) throw new Error('Provider not initialized');

        // Extract numeric editId from externalId (strip legacy prefix if present)
        const editId = externalId.replace(/^berlin-de-mh-/, '');

        await this.login();

        // Re-submit all tabs with the existing editId
        await this.submitStatus(editId, event);
        await this.submitText(editId, event);
        await this.submitDetailsDistrict(editId);
        await this.submitDetailsCategories(editId, event);
        await this.submitDetailsOrganizer(editId, event);
        await this.submitDetailsVenue(editId, event);
        await this.submitDate(editId, event);
        await this.submitWeb(editId, event);
        await this.submitImage(editId, event);

        return { etag: new Date().toISOString() };
    }

    async deleteEvent(externalId: string): Promise<void> {
        if (!this.config) throw new Error('Provider not initialized');

        const editId = externalId.replace(/^berlin-de-mh-/, '');

        await this.login();

        const deleteUrl = `${this.baseUrl}?modul=veranstaltungen&action=delete&deleteid=${editId}`;
        const response = await this.authedFetch(deleteUrl);

        if (!response.ok && response.status !== 302) {
            console.warn(`Berlin.de MH Calendar: delete request returned status ${response.status} for editid ${editId}`);
        }
    }

    // ----------------------------------------------------------------
    // Private helpers – session management
    // ----------------------------------------------------------------

    private getCredentials(): { username: string; password: string } {
        const username = this.config?.credentials?.username;
        const password = this.config?.credentials?.password;
        if (!username || !password) {
            throw new Error('Berlin.de MH Calendar: credentials (username, password) are required in sync config');
        }
        return { username, password };
    }

    private get userAgent(): string {
        return 'Mozilla/5.0';
    }

    private updateCookieJar(setCookies: string[]): void {
        if (!setCookies || setCookies.length === 0) return;

        const cookieMap = new Map<string, string>();

        // Parse existing cookies
        if (this.sessionCookie) {
            this.sessionCookie.split(';').forEach(c => {
                const parts = c.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join('=').trim();
                    if (key) cookieMap.set(key, value);
                }
            });
        }

        // Add/update from Set-Cookie
        for (const sc of setCookies) {
            const kv = sc.split(';')[0];
            const parts = kv.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                if (key) cookieMap.set(key, value);
            }
        }

        // Re-join
        this.sessionCookie = Array.from(cookieMap.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
    }

    private async login(): Promise<void> {
        const { username, password } = this.getCredentials();
        const loginUrl = `${this.baseUrl}?access=login`;

        // Step 1: GET to initialize session (anonymous)
        const getResponse = await fetch(loginUrl, {
            headers: { 'User-Agent': this.userAgent },
            redirect: 'manual'
        });
        this.updateCookieJar(getResponse.headers.getSetCookie?.() ?? []);

        // Step 2: POST to authenticate
        const body = new URLSearchParams({
            loginusername: username,
            loginpassword: password,
            loginusergroup: '0'
        });

        const postResponse = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': this.userAgent,
                'Referer': loginUrl,
                'Cookie': this.sessionCookie || ''
            },
            body: body.toString(),
            redirect: 'manual'
        });

        // Collect cookies from login post (the authenticated session usually starts here)
        this.updateCookieJar(postResponse.headers.getSetCookie?.() ?? []);

        // Step 3: Verify the login result immediately
        const postStatus = postResponse.status;
        const postHtml = await postResponse.text();

        console.log(`[Berlin.de Login] POST Status: ${postStatus}`);
        console.log(`[Berlin.de Login] POST Header Location: ${postResponse.headers.get('location')}`);
        console.log(`[Berlin.de Login] POST HTML: ${postHtml}`);

        if (postStatus === 403) {
            console.error(`[Berlin.de Login] WAF Blocked POST: ${postHtml.substring(0, 300)}`);
            throw new Error(`Berlin.de MH Calendar: WAF Blocked login POST (403 Forbidden). Response: ${postHtml.substring(0, 100)}`);
        }

        if (postHtml.includes('name=loginusername') || postHtml.includes('class=head>Login</th>')) {
            console.error(`[Berlin.de Login] Returned login page on POST: ${postHtml.substring(0, 300)}`);
            throw new Error('Berlin.de MH Calendar: Login failed. Incorrect credentials or blocked by server (returned login form).');
        }

        // 302 Found might still happen on some environments
        if ([301, 302, 303, 307, 308].includes(postStatus)) {
            const location = postResponse.headers.get('location');
            if (location) {
                const redirectUrl = location.startsWith('http')
                    ? location
                    : new URL(location, this.baseUrl).toString();

                // If we are redirected back to login, it failed
                if (redirectUrl.includes('access=login')) {
                    throw new Error('Berlin.de MH Calendar: Login failed (redirected back to login page)');
                }

                const landingResponse = await fetch(redirectUrl, {
                    headers: {
                        'User-Agent': this.userAgent,
                        'Cookie': this.sessionCookie || ''
                    },
                    redirect: 'manual'
                });
                this.updateCookieJar(landingResponse.headers.getSetCookie?.() ?? []);
            }
        }

        if (!this.sessionCookie || !this.sessionCookie.includes('bo_landkalender')) {
            // Check fallback for older environments
            const raw = postResponse.headers.get('set-cookie');
            if (raw) {
                this.updateCookieJar([raw]);
            }
        }

        if (!this.sessionCookie) {
            throw new Error('Berlin.de MH Calendar: login failed – no session cookie received');
        }
    }

    private async ensureLoggedIn(): Promise<void> {
        // If we have a cookie, we assume it's valid for the current run
        // We could do a "canary" GET here if needed, but for a single sync run it should be fine.
        if (this.sessionCookie && this.sessionCookie.includes('bo_landkalender')) {
            return;
        }
        await this.login();
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
            headers.set('User-Agent', this.userAgent);
        }

        const response = await fetch(url, {
            ...options,
            headers,
            redirect: 'manual'
        });

        // Update cookie jar from response if cookies are set
        this.updateCookieJar(response.headers.getSetCookie?.() ?? []);

        // If redirect, follow it with our cookie jar
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('location');
            if (location) {
                // Prevent infinite loops or silent redirects back to login
                if (location.includes('access=login') && !url.includes('access=login')) {
                    throw new Error('Berlin.de MH Calendar: Session expired or login required (redirected to login page during request)');
                }

                const redirectUrl = location.startsWith('http')
                    ? location
                    : new URL(location, url).toString();
                return this.authedFetch(redirectUrl, { method: 'GET' });
            }
        }

        // Also check body content if we got a 200 OK but it's actually the login page
        // (This happens if the server doesn't use redirects for Not Authorized)
        return response;
    }

    /**
     * POST x-www-form-urlencoded data to an authenticated URL
     */
    private async postForm(url: string, data: Record<string, string>): Promise<Response> {
        return this.authedFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(data).toString()
        });
    }

    // ----------------------------------------------------------------
    // Private helpers – multi-page form flow
    // ----------------------------------------------------------------

    /**
     * Navigate to action=new. The response body contains a banner like:
     *   "OK: Neue Veranstaltung Nr. 275506 wurde angelegt."
     * We parse the number from that banner as the editid.
     */
    private async createEvent(): Promise<string> {
        const response = await this.authedFetch(
            `${this.baseUrl}?modul=veranstaltungen&action=new`
        );

        const html = await response.text();

        // Check if we accidentally got the login page
        if (html.includes('name=loginusername') || html.includes('access=login') || html.includes('class=head>Login</th>')) {
            throw new Error('Berlin.de MH Calendar: Failed to create event – Session expired or unauthorized (received login page instead of event form)');
        }

        // Parse editid from the success banner in the response body
        const bannerMatch = html.match(/OK:\s*Neue\s+Veranstaltung\s+Nr\.\s*(\d+)\s+wurde\s+angelegt/i);
        if (bannerMatch) {
            return bannerMatch[1];
        }

        // Fallback: try URL parameter
        const urlMatch = (response.url || '').match(/editid=(\d+)/);
        if (urlMatch) {
            return urlMatch[1];
        }

        // Fallback: search html for editid in any link
        const linkMatch = html.match(/editid=(\d+)/);
        if (linkMatch) {
            return linkMatch[1];
        }

        throw new Error('Berlin.de MH Calendar: failed to create event – no editid found in response');
    }

    /** Build the URL for a specific edit tab */
    private editUrl(editId: string, editAction: string): string {
        return `${this.baseUrl}?modul=veranstaltungen&action=edit&editid=${editId}&edit_action=${editAction}`;
    }

    // ----------------------------------------------------------------
    // Tab submissions
    // ----------------------------------------------------------------

    /**
     * Status tab: set draft mode and free/paid status
     */
    private async submitStatus(editId: string, event: ExternalEvent): Promise<void> {
        const isFree = this.isEventFree(event);

        await this.postForm(this.editUrl(editId, 'overview'), {
            update_draft: '0',       // 0 = published (not draft)
            update_gratis: isFree ? '1' : '0'
        });
    }

    /**
     * Titel & Beschreibung tab: set title and description
     * Field names: update_name (title), update_text (description)
     */
    private async submitText(editId: string, event: ExternalEvent): Promise<void> {
        // Convert HTML description to readable plain text
        const rawDescription = event.description || event.summary;
        const plainDescription = htmlToPlainText(rawDescription);

        await this.postForm(this.editUrl(editId, 'text'), {
            update_name: event.summary,
            update_beschreibung: plainDescription
        });
    }

    /**
     * Details tab - Part 1: set district to Marzahn-Hellersdorf
     */
    private async submitDetailsDistrict(editId: string): Promise<void> {
        await this.postForm(this.editUrl(editId, 'details'), {
            update_bezirk: '4' // Marzahn-Hellersdorf
        });
    }

    /**
     * Details tab - Part 2: add categories (up to 3)
     * Each category is added by POSTing update_kategorie with the category ID
     */
    private async submitDetailsCategories(editId: string, event: ExternalEvent): Promise<void> {
        const ourCategory = event.metadata?.categoryBerlinDotDe as string | undefined;
        if (!ourCategory) return;

        const remoteIds = BerlinDeMhCalendarProvider.CATEGORY_MAPPING[ourCategory];
        if (!remoteIds || remoteIds.length === 0) return;

        // Add each category ID (up to 3) one at a time
        const categoriesToAdd = remoteIds.slice(0, 3);
        for (const categoryId of categoriesToAdd) {
            await this.postForm(this.editUrl(editId, 'details'), {
                update_kategorie: categoryId
            });
        }
    }

    /**
     * Details tab - Part 3: search and select organizer, then fill contact fields
     * Flow:
     *   1. Navigate to subaction=veranstalter
     *   2. POST search_name with ORG_NAME
     *   3. Parse result links to find matching set_veranstalter ID
     *   4. Navigate to set_veranstalter={ID} to select
     *   5. Fill update_va_ap (contact person) and update_va_telefon (phone)
     *   6. Save the veranstalter block
     */
    private async submitDetailsOrganizer(editId: string, event: ExternalEvent): Promise<void> {
        const orgName = env.ORG_NAME;
        if (!orgName) return;

        // Resolve the contact for this event
        const contact = await resolveContactForEventId(event.metadata?.eventId, true);

        // Step 1+2: Search for organizer
        const searchUrl = `${this.baseUrl}?modul=veranstaltungen&action=edit&editid=${editId}&edit_action=details&subaction=veranstalter`;
        const searchResponse = await this.postForm(searchUrl, {
            search_name: orgName,
            subaction: 'veranstalter'
        });

        const searchHtml = await searchResponse.text();

        // Step 3: Parse the result links to find set_veranstalter={ID}
        const veranstalterLinks = [...searchHtml.matchAll(/set_veranstalter=(\d+)[^>]*>([^<]+)<\/a>/g)];
        let selectedId: string | undefined;

        // Find the one matching ORG_NAME
        for (const match of veranstalterLinks) {
            const linkText = match[2].trim();
            if (linkText.includes(orgName)) {
                selectedId = match[1];
                break;
            }
        }

        // Fallback: use first result
        if (!selectedId && veranstalterLinks.length > 0) {
            selectedId = veranstalterLinks[0][1];
        }

        if (!selectedId) {
            console.warn('Berlin.de MH Calendar: no matching Veranstalter found for', orgName);
            return;
        }

        // Step 4: Select the organizer
        const selectUrl = `${this.baseUrl}?modul=veranstaltungen&action=edit&editid=${editId}&edit_action=details&set_veranstalter=${selectedId}`;
        await this.authedFetch(selectUrl);

        // Step 5+6: Fill contact fields and save
        const data: Record<string, string> = {};

        if (contact?.name) {
            data.update_va_ap = contact.name;
        }
        if (contact?.phone) {
            data.update_va_telefon = contact.phone;
        }

        if (Object.keys(data).length > 0) {
            await this.postForm(this.editUrl(editId, 'details'), data);
        }
    }

    /**
     * Details tab - Part 4: search and select venue, then fill phone
     * Flow:
     *   1. Navigate to subaction=veranstaltungsort
     *   2. POST search_name with ORG_NAME
     *   3. Parse result links to find matching set_veranstaltungsort ID
     *      (match ORG_NAME + " " + location name)
     *   4. Navigate to set_veranstaltungsort={ID} to select
     *   5. Fill update_vo_telefon (phone)
     *   6. Save the veranstaltungsort block
     */
    private async submitDetailsVenue(editId: string, event: ExternalEvent): Promise<void> {
        const orgName = env.ORG_NAME;
        if (!orgName) return;

        const contact = await resolveContactForEventId(event.metadata?.eventId, true);

        // Step 1+2: Search for venue
        const searchUrl = `${this.baseUrl}?modul=veranstaltungen&action=edit&editid=${editId}&edit_action=details&subaction=veranstaltungsort`;
        const searchResponse = await this.postForm(searchUrl, {
            search_name: orgName,
            subaction: 'veranstaltungsort'
        });

        const searchHtml = await searchResponse.text();

        // Step 3: Parse the result links to find set_veranstaltungsort={ID}
        const venueLinks = [...searchHtml.matchAll(/set_veranstaltungsort=(\d+)[^>]*>([^<]+)<\/a>/g)];
        let selectedId: string | undefined;

        // Try to match ORG_NAME + location name
        const locationName = event.venue?.name || event.location;
        const searchString = locationName ? `${orgName} ${locationName}` : orgName;

        for (const match of venueLinks) {
            const linkText = match[2].trim();
            if (linkText.includes(searchString) || linkText.includes(orgName)) {
                selectedId = match[1];
                break;
            }
        }

        // Fallback: use first result
        if (!selectedId && venueLinks.length > 0) {
            selectedId = venueLinks[0][1];
        }

        if (!selectedId) {
            console.warn('Berlin.de MH Calendar: no matching Veranstaltungsort found for', searchString);
            return;
        }

        // Step 4: Select the venue
        const selectUrl = `${this.baseUrl}?modul=veranstaltungen&action=edit&editid=${editId}&edit_action=details&set_veranstaltungsort=${selectedId}`;
        await this.authedFetch(selectUrl);

        // Step 5+6: Fill phone and save
        const data: Record<string, string> = {};

        if (contact?.phone) {
            data.update_vo_telefon = contact.phone;
        }

        if (Object.keys(data).length > 0) {
            await this.postForm(this.editUrl(editId, 'details'), data);
        }
    }

    /**
     * Termine tab: two-step process
     *   1. Select "single date" mode (update_terminmodus=1) and submit with übernehmen
     *   2. Submit the actual date/time with neuer_termin=1
     *
     * All times are converted to Europe/Berlin timezone.
     */
    private async submitDate(editId: string, event: ExternalEvent): Promise<void> {
        if (!event.startDateTime) return;

        const dateUrl = this.editUrl(editId, 'date');

        // Step 1: set terminmodus to single date
        await this.postForm(dateUrl, {
            update_terminmodus: '1'
        });

        // Step 2: submit date and time (converted to Berlin timezone)
        const startBerlin = this.convertToBerlinTime(event.startDateTime, event.startTimeZone);

        const dateData: Record<string, string> = {
            neuer_termin: '1',
            datetag_von: this.formatDateDE(startBerlin),
            uhrzeit_von: this.formatTime(startBerlin)
        };

        if (event.endDateTime) {
            const endBerlin = this.convertToBerlinTime(event.endDateTime, event.endTimeZone);
            dateData.uhrzeit_bis_nutzen = '1';
            dateData.uhrzeit_bis = this.formatTime(endBerlin);
        }

        await this.postForm(dateUrl, dateData);
    }

    /**
     * Web tab: set contact email and homepage URL
     * Field names: update_email, update_homepage
     */
    private async submitWeb(editId: string, event: ExternalEvent): Promise<void> {
        const data: Record<string, string> = {};

        // Resolve contact email (work email)
        const contact = await resolveContactForEventId(event.metadata?.eventId, true);
        if (contact?.email) {
            data.update_email = contact.email;
        }

        // Homepage from ORG_WWW env variable
        const orgWww = env.ORG_WWW;
        if (orgWww) {
            data.update_homepage = orgWww;
        }

        if (Object.keys(data).length > 0) {
            await this.postForm(this.editUrl(editId, 'web'), data);
        }
    }

    /**
     * Bild tab: upload the hero image if available, cropped to 4:3 ratio
     * Field names:
     *   userfile          – the image file
     *   update_dateitext  – alt text ("Logo")
     *   update_dateicopy  – copyright ("CC BY 4.0")
     */
    private async submitImage(editId: string, event: ExternalEvent): Promise<void> {
        if (!event.image?.url) return;

        try {
            // Download the image
            const imageResponse = await fetch(event.image.url);
            if (!imageResponse.ok) return;

            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

            // Crop to 4:3 ratio around center using sharp
            let processedBuffer: Buffer;
            try {
                const sharp = (await import('sharp')).default;
                const metadata = await sharp(imageBuffer).metadata();

                if (metadata.width && metadata.height) {
                    // Calculate 4:3 crop dimensions, maximizing width
                    const targetWidth = metadata.width;
                    const targetHeight = Math.round(targetWidth * 3 / 4);

                    if (targetHeight <= metadata.height) {
                        // Crop height (center crop)
                        const top = Math.round((metadata.height - targetHeight) / 2);
                        processedBuffer = await sharp(imageBuffer)
                            .extract({ left: 0, top, width: targetWidth, height: targetHeight })
                            .jpeg({ quality: 85 })
                            .toBuffer();
                    } else {
                        // Image is wider than 4:3, crop width instead
                        const newWidth = Math.round(metadata.height * 4 / 3);
                        const left = Math.round((metadata.width - newWidth) / 2);
                        processedBuffer = await sharp(imageBuffer)
                            .extract({ left, top: 0, width: newWidth, height: metadata.height })
                            .jpeg({ quality: 85 })
                            .toBuffer();
                    }
                } else {
                    processedBuffer = imageBuffer;
                }
            } catch (sharpError) {
                console.warn('Berlin.de MH Calendar: sharp processing failed, using original image:', sharpError);
                processedBuffer = imageBuffer;
            }

            // Determine filename from URL or use default
            const urlPath = new URL(event.image.url).pathname;
            let filename = urlPath.split('/').pop() || 'event-image.jpg';
            // Ensure .jpg extension for processed images
            if (!filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                filename = 'event-image.jpg';
            }

            // Build multipart form data
            const formData = new FormData();
            const imageBlob = new Blob([new Uint8Array(processedBuffer)], { type: 'image/jpeg' });
            formData.append('userfile', imageBlob, filename);
            formData.append('update_dateitext', 'Logo');
            formData.append('update_dateicopy', 'CC BY 4.0');

            await this.authedFetch(this.editUrl(editId, 'image'), {
                method: 'POST',
                body: formData
                // No Content-Type header – fetch sets it with boundary for FormData
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
     * Free if: no price, empty price, price is "0", or price text contains "gratis" or "frei"/"free"
     */
    private isEventFree(event: ExternalEvent): boolean {
        const price = event.ticketPrice ?? event.metadata?.ticketPrice;
        if (!price) return true;

        const priceStr = String(price).trim().toLowerCase();
        if (!priceStr) return true;

        // Check for free-indicating keywords
        if (priceStr === 'gratis' || priceStr === 'free' || priceStr === 'frei' || priceStr === 'kostenlos') {
            return true;
        }

        // Check if it contains "gratis" anywhere
        if (priceStr.includes('gratis')) return true;

        const parsed = parseFloat(priceStr);
        if (isNaN(parsed)) return true; // Non-numeric → free
        return parsed === 0;            // Zero → free
    }

    /**
     * Convert a Date to Europe/Berlin timezone
     */
    private convertToBerlinTime(date: Date, sourceTimezone?: string): Date {
        try {
            // Format the date in Berlin timezone to get the local components
            const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Europe/Berlin',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            const parts = berlinFormatter.formatToParts(date);
            const get = (type: string) => parts.find(p => p.type === type)?.value || '0';

            return new Date(
                parseInt(get('year')),
                parseInt(get('month')) - 1,
                parseInt(get('day')),
                parseInt(get('hour')),
                parseInt(get('minute')),
                parseInt(get('second'))
            );
        } catch {
            // Fallback: return as-is
            return date;
        }
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
}
