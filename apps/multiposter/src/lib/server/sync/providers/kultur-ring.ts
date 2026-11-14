import type {
	ExternalEvent,
	ProviderType,
	SyncConfig,
	SyncDirection,
	SyncProvider
} from '../types';

export interface KulturRingOption {
	id: string;
	name: string;
}

export interface KulturRingFormFields {
	mid?: string;
	art?: string;
	einrichtung: string;
	beginn: string;
	ende: string;
	zeitVon: string;
	zeitBis: string;
	titel: string;
	text: string;
	eintritt: string;
	kategorie: string;
	beginnVern: string;
	zeitVern: string;
	laudatioVern: string;
	musikVern: string;
	beginnFin: string;
	zeitFin: string;
	laudatioFin: string;
	musikFin: string;
}

export interface KulturRingListEntry {
	id: string;
	title: string;
	dateText: string;
	einrichtung?: string;
}

export const KULTUR_RING_CATEGORIES: Array<{ id: string; label: string }> = [
	{ id: '9', label: 'Ausstellung' },
	{ id: '1', label: 'Filmvorführung' },
	{ id: '4', label: 'Interdisziplinär' },
	{ id: '2', label: 'Konzert' },
	{ id: '3', label: 'Lesung' },
	{ id: '7', label: 'Salon' },
	{ id: '10', label: 'Vortrag/Diskussion' },
	{ id: '5', label: 'Basteln/Kurs' },
	{ id: '16', label: 'Bildung' },
	{ id: '6', label: 'Party/Feier' },
	{ id: '11', label: 'Musik' },
	{ id: '12', label: 'Spielen' },
	{ id: '8', label: 'Theater' },
	{ id: '15', label: 'Treff' },
	{ id: '13', label: 'Vorlesen' },
	{ id: '14', label: 'Workshop' }
];

const BERLIN_DOT_DE_TO_KULTUR_RING_CATEGORY: Array<{ match: RegExp; id: string }> = [
	{ match: /\bausstellung|\bgalerie|\bkunst\b/i, id: '9' },
	{ match: /\bfilm|\bkino\b/i, id: '1' },
	{ match: /\bkonzert\b/i, id: '2' },
	{ match: /\blesung\b/i, id: '3' },
	{ match: /\bsalon\b/i, id: '7' },
	{ match: /\bvortrag|\bdiskussion|\bpolitik|\bpodium|\bführung/i, id: '10' },
	{ match: /\bbastel|\bsport|\bfitness|\bgesundheit|\btanz|\bfreizeit|\bkurs\b/i, id: '5' },
	{ match: /\bbildung|\bwissen|\blernen|\bsprache/i, id: '16' },
	{ match: /\bparty|\bfeier\b|\bfest\b|\bfasching|\bsilvester/i, id: '6' },
	{ match: /\bmusik|\bchor|\bjam\b|\bband\b/i, id: '11' },
	{ match: /\bspiel|\bschach|\bskat|\bbingo/i, id: '12' },
	{ match: /\btheater|\bkabarett|\bshow\b|\bmusical|\bbühne/i, id: '8' },
	{ match: /\btreff|\bstammtisch|\bcaf[eé]|\bsenioren/i, id: '15' },
	{ match: /\bvorlesen|\bmärchen/i, id: '13' },
	{ match: /\bworkshop|\bseminar/i, id: '14' },
	{ match: /\binterdisziplinär/i, id: '4' }
];

const ENTITY_MAP: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#039;': "'",
	'&#39;': "'",
	'&apos;': "'",
	'&nbsp;': ' ',
	'&auml;': 'ä',
	'&ouml;': 'ö',
	'&uuml;': 'ü',
	'&szlig;': 'ß',
	'&Auml;': 'Ä',
	'&Ouml;': 'Ö',
	'&Uuml;': 'Ü',
	'&euro;': '€',
	'&ndash;': '–',
	'&mdash;': '—',
	'&bdquo;': '„',
	'&ldquo;': '“',
	'&rdquo;': '”',
	'&rsquo;': '’',
	'&lsquo;': '‘',
	'&hellip;': '…'
};

export function decodeHtmlEntities(input: string): string {
	return input
		.replace(/&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;/g, (entity) => {
			if (ENTITY_MAP[entity]) return ENTITY_MAP[entity];
			if (entity.startsWith('&#x') || entity.startsWith('&#X')) {
				const code = Number.parseInt(entity.slice(3, -1), 16);
				return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
			}
			if (entity.startsWith('&#')) {
				const code = Number.parseInt(entity.slice(2, -1), 10);
				return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
			}
			return entity;
		});
}

export function htmlToPlainText(html: string): string {
	if (!html) return '';
	let text = html.replace(/<br\s*\/?>/gi, ' ');
	text = text.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, ' ');
	text = text.replace(/<[^>]+>/g, '');
	text = decodeHtmlEntities(text);
	return text.replace(/\s+/g, ' ').trim();
}

export function truncateWithEllipsis(value: string, maxLength: number): string {
	const cleaned = value.replace(/\s+/g, ' ').trim();
	if (cleaned.length <= maxLength) return cleaned;
	if (maxLength <= 3) return cleaned.slice(0, maxLength);
	const sliceLen = maxLength - 3;
	const raw = cleaned.slice(0, sliceLen);
	const lastSpace = raw.lastIndexOf(' ');
	if (lastSpace >= Math.floor(sliceLen * 0.6)) {
		return `${raw.slice(0, lastSpace).trimEnd()}...`;
	}
	return `${raw.trimEnd()}...`;
}

export function formatBerlinDate(date: Date): { ddmmyyyy: string; yyyymm: string } {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Berlin',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);

	const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
	const month = parts.find((p) => p.type === 'month')?.value ?? '01';
	const day = parts.find((p) => p.type === 'day')?.value ?? '01';

	return {
		ddmmyyyy: `${day}.${month}.${year}`,
		yyyymm: `${year}-${month}`
	};
}

/**
 * Formats a Date into Kultur Ring's 30-minute grid (`07.00` .. `23.30`) in Europe/Berlin.
 */
export function formatBerlinTimeSlot(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Berlin',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).formatToParts(date);

	let hour = Number.parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
	const minute = Number.parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
	if (hour === 24) hour = 0;

	let totalMinutes = hour * 60 + minute;
	let rounded = Math.round(totalMinutes / 30) * 30;

	// Clamp to Kultur Ring's supported select options: 07.00 .. 23.30
	const minMinutes = 7 * 60;
	const maxMinutes = 23 * 60 + 30;
	if (rounded < minMinutes) rounded = minMinutes;
	if (rounded > maxMinutes) rounded = maxMinutes;

	const h = String(Math.floor(rounded / 60)).padStart(2, '0');
	const m = String(rounded % 60).padStart(2, '0');
	return `${h}.${m}`;
}

export function parsePricingForKulturRing(ticketPrice?: string | null): string {
	if (!ticketPrice || !ticketPrice.trim()) return '';
	const trimmed = ticketPrice.trim();
	const lower = trimmed.toLowerCase();
	if (lower === 'free' || lower === 'frei' || lower === 'kostenlos' || lower === 'eintritt frei' || lower === '0') {
		return 'frei';
	}
	if (lower.includes('gegen spende') || lower.includes('spende')) {
		return 'Spende erbeten';
	}
	// Strip leading "Eintritt:" because Kultur Ring renders "Eintritt: <value>"
	return trimmed.replace(/^eintritt\s*:\s*/i, '').slice(0, 80);
}

export function mapCategoryToKulturRing(event: ExternalEvent): string {
	const explicit = event.metadata?.kulturRingCategory;
	if (explicit && KULTUR_RING_CATEGORIES.some((c) => c.id === String(explicit))) {
		return String(explicit);
	}

	const candidates: string[] = [];
	if (event.metadata?.categoryBerlinDotDe) {
		candidates.push(String(event.metadata.categoryBerlinDotDe));
	}
	if (Array.isArray(event.tags)) {
		for (const tag of event.tags) {
			candidates.push(typeof tag === 'string' ? tag : tag.name);
		}
	}
	if (event.summary) candidates.push(event.summary);

	const combined = candidates.join(' ');
	for (const rule of BERLIN_DOT_DE_TO_KULTUR_RING_CATEGORY) {
		if (rule.match.test(combined)) {
			return rule.id;
		}
	}

	// Safe default: Interdisziplinär (4)
	return '4';
}

export function parseSelectOptionsFromHtml(html: string, selectId: string): KulturRingOption[] {
	const selectRegex = new RegExp(`<select[^>]*id=["']${selectId}["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i');
	const match = html.match(selectRegex);
	if (!match) return [];

	const options: KulturRingOption[] = [];
	const optionRegex = /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
	for (const m of match[1].matchAll(optionRegex)) {
		const id = m[1].trim();
		const name = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
		if (id) {
			options.push({ id, name: name || id });
		}
	}
	return options;
}

export function parseSelectedOptionValue(html: string, selectId: string): string {
	const selectRegex = new RegExp(`<select[^>]*id=["']${selectId}["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i');
	const match = html.match(selectRegex);
	if (!match) return '';
	const selectedMatch = match[1].match(/<option[^>]*value=["']([^"']*)["'][^>]*\bselected\b[^>]*>/i)
		|| match[1].match(/<option[^>]*\bselected\b[^>]*value=["']([^"']*)["'][^>]*>/i);
	return selectedMatch ? selectedMatch[1].trim() : '';
}

function getInputValue(html: string, fieldName: string): string {
	const regex1 = new RegExp(`<input[^>]*name=["']${fieldName}["'][^>]*value=["']([^"']*)["']`, 'i');
	const regex2 = new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${fieldName}["']`, 'i');
	const m = html.match(regex1) || html.match(regex2);
	return m ? decodeHtmlEntities(m[1]) : '';
}

function getTextareaValue(html: string, fieldName: string): string {
	const regex = new RegExp(`<textarea[^>]*name=["']${fieldName}["'][^>]*>([\\s\\S]*?)<\\/textarea>`, 'i');
	const m = html.match(regex);
	return m ? decodeHtmlEntities(m[1]) : '';
}

export function parseEditFormFieldsFromHtml(html: string): KulturRingFormFields {
	return {
		mid: getInputValue(html, 'mid') || undefined,
		art: getInputValue(html, 'art') || '2',
		einrichtung: parseSelectedOptionValue(html, 'einrichtung'),
		beginn: getInputValue(html, 'beginn'),
		ende: getInputValue(html, 'ende'),
		zeitVon: parseSelectedOptionValue(html, 'zeitVon'),
		zeitBis: parseSelectedOptionValue(html, 'zeitBis'),
		titel: getInputValue(html, 'titel'),
		text: getTextareaValue(html, 'text'),
		eintritt: getInputValue(html, 'eintritt'),
		kategorie: parseSelectedOptionValue(html, 'kategorie'),
		beginnVern: getInputValue(html, 'beginnVern'),
		zeitVern: parseSelectedOptionValue(html, 'zeitVern'),
		laudatioVern: getInputValue(html, 'laudatioVern'),
		musikVern: getInputValue(html, 'musikVern'),
		beginnFin: getInputValue(html, 'beginnFin'),
		zeitFin: parseSelectedOptionValue(html, 'zeitFin'),
		laudatioFin: getInputValue(html, 'laudatioFin'),
		musikFin: getInputValue(html, 'musikFin')
	};
}

export function parseEventsFromListHtml(html: string): KulturRingListEntry[] {
	const entries: KulturRingListEntry[] = [];
	const linkRegex = /<a[^>]*href=["'][^"']*view=kulturkalender&tab=daten&id=(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;

	for (const match of html.matchAll(linkRegex)) {
		const id = match[1];
		const title = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
		const index = match.index ?? 0;
		const snippet = decodeHtmlEntities(
			html
				.slice(index, Math.min(html.length, index + 600))
				.replace(/<[^>]+>/g, ' ')
		).replace(/\s+/g, ' ').trim();

		entries.push({
			id,
			title,
			dateText: snippet
		});
	}

	return entries;
}

export function normalizeKulturRingId(externalId: string): string {
	return externalId.replace(/^kultur-ring-/, '').trim();
}

export function resolveEinrichtungId(
	event: ExternalEvent,
	options: KulturRingOption[],
	configuredId?: string,
	configuredName?: string
): string {
	const venueCandidates = [event.venue?.name, event.location]
		.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
		.map((v) => v.trim().toLowerCase());

	for (const candidate of venueCandidates) {
		const exact = options.find((o) => o.name.toLowerCase() === candidate);
		if (exact) return exact.id;
	}

	for (const candidate of venueCandidates) {
		const partial = options.find((o) => {
			const optName = o.name.toLowerCase();
			return optName.length >= 4 && (candidate.includes(optName) || optName.includes(candidate));
		});
		if (partial) return partial.id;
	}

	if (configuredId) {
		if (options.length === 0 || options.some((o) => o.id === configuredId)) {
			return configuredId;
		}
	}

	if (configuredName) {
		const normalizedConfigName = configuredName.trim().toLowerCase();
		const byName = options.find((o) => o.name.toLowerCase() === normalizedConfigName);
		if (byName) return byName.id;
	}

	if (options.length > 0) {
		return options[0].id;
	}

	throw new Error('Kultur Ring: unable to determine target Einrichtung (location/institution ID)');
}

/**
 * Synchronization Provider for Kultur Ring (https://db.kulturring.berlin/db/)
 *
 * Unidirectional push provider supporting event creation, reading, updating,
 * and graceful cancellation/deletion via authenticated PHP session forms.
 */
export class KulturRingProvider implements SyncProvider {
	readonly type: ProviderType = 'kultur-ring';
	readonly name = 'Kultur Ring';
	readonly supportedDirections: SyncDirection[] = ['push'];
	readonly supportedEntityTypes: ('event' | 'announcement')[] = ['event'];
	readonly supportsWebhooks = false;
	readonly supportsNativeRecurrence = false;

	private config?: SyncConfig;
	private baseUrl = 'https://db.kulturring.berlin/db';
	private sessionCookies = new Map<string, string>();
	private isLoggedIn = false;

	async initialize(config: SyncConfig): Promise<void> {
		this.config = config;
		this.baseUrl = (config.settings?.baseUrl || 'https://db.kulturring.berlin/db').replace(/\/+$/, '');
		this.sessionCookies.clear();
		this.isLoggedIn = false;
	}

	async validateConnection(): Promise<boolean> {
		try {
			await this.login();
			const options = await this.listEinrichtungen();
			return options.length > 0;
		} catch (error) {
			console.error('[KulturRingProvider] validateConnection failed:', error);
			return false;
		}
	}

	/**
	 * Fetches and returns the available "Einrichtung" options from Kultur Ring
	 * for the currently configured credentials.
	 */
	async listEinrichtungen(): Promise<KulturRingOption[]> {
		await this.ensureLoggedIn();
		const html = await this.fetchCreateFormHtml();
		return parseSelectOptionsFromHtml(html, 'einrichtung');
	}

	shouldSyncEvent(event: ExternalEvent): boolean {
		if (event.status === 'cancelled') return false;
		if (event.status === 'tentative') return false;
		if ((event as any).isPublic === false || event.metadata?.isPublic === false) return false;
		return true;
	}

	async pullEvents(): Promise<{ events: ExternalEvent[]; nextSyncToken?: string }> {
		throw new Error('Kultur Ring provider does not support pulling events (unidirectional push only)');
	}

	async pushEvent(event: ExternalEvent): Promise<{ externalId: string; etag?: string }> {
		if (!this.config) throw new Error('Provider not initialized');
		if (!event.startDateTime) throw new Error('Kultur Ring: event.startDateTime is required');

		await this.ensureLoggedIn();
		const formHtml = await this.fetchCreateFormHtml();
		const einrichtungen = parseSelectOptionsFromHtml(formHtml, 'einrichtung');
		const params = this.buildFormParams(event, einrichtungen);

		const createUrl = `${this.baseUrl}/db.php?view=kulturkalender&tab=daten`;
		const { finalUrl, bodyText } = await this.postFormAndFollow(createUrl, params, createUrl);

		const extractedId = this.extractIdFromResponse(finalUrl, bodyText);
		if (extractedId) {
			return { externalId: extractedId };
		}

		// Kultur Ring saves often redirect to the calendar listing or stay on tab=daten;
		// look up the created entry in the target start month.
		const startDate = new Date(event.startDateTime);
		const { yyyymm, ddmmyyyy } = formatBerlinDate(startDate);
		const expectedTitle = params.get('titel') || '';
		const listEntries = await this.listMonthEvents(yyyymm);
		const matchedId = this.findMatchingEventId(listEntries, expectedTitle, ddmmyyyy);

		if (matchedId) {
			return { externalId: matchedId };
		}

		throw new Error('Kultur Ring: event saved but created record ID could not be determined');
	}

	async readEvent(externalId: string): Promise<KulturRingFormFields | null> {
		if (!this.config) throw new Error('Provider not initialized');

		const id = normalizeKulturRingId(externalId);
		if (!id) return null;

		await this.ensureLoggedIn();
		const html = await this.fetchEditFormHtml(id);
		const fields = parseEditFormFieldsFromHtml(html);

		if (!fields.mid && !fields.titel && !fields.beginn) {
			return null;
		}

		return fields;
	}

	async listMonthEvents(yearMonth: string): Promise<KulturRingListEntry[]> {
		await this.ensureLoggedIn();
		const url = `${this.baseUrl}/db.php?view=kulturkalender&datum=${encodeURIComponent(yearMonth)}`;
		const response = await this.authedFetch(url);
		if (!response.ok) {
			throw new Error(`Kultur Ring: failed to load list for ${yearMonth} (status ${response.status})`);
		}
		const html = await response.text();
		return parseEventsFromListHtml(html);
	}

	async updateEvent(externalId: string, event: ExternalEvent): Promise<{ etag?: string }> {
		if (!this.config) throw new Error('Provider not initialized');
		if (!event.startDateTime) throw new Error('Kultur Ring: event.startDateTime is required');

		const id = normalizeKulturRingId(externalId);
		await this.ensureLoggedIn();

		const editUrl = `${this.baseUrl}/db.php?view=kulturkalender&tab=daten&id=${encodeURIComponent(id)}`;
		const editHtml = await this.fetchEditFormHtml(id);
		const einrichtungen = parseSelectOptionsFromHtml(editHtml, 'einrichtung');
		const existingFields = parseEditFormFieldsFromHtml(editHtml);

		const params = this.buildFormParams(event, einrichtungen, existingFields, id);
		const { bodyText } = await this.postFormAndFollow(editUrl, params, editUrl);

		if (this.looksLikeLoginPage(bodyText)) {
			throw new Error(`Kultur Ring: session invalid while updating event ${id}`);
		}

		return {};
	}

	async deleteEvent(externalId: string): Promise<void> {
		if (!this.config) throw new Error('Provider not initialized');

		const id = normalizeKulturRingId(externalId);
		if (!id) return;

		// Kultur Ring has no delete endpoint in its web UI; if the record still exists,
		// mark its title as "[ABGESAGT]" so visitors are informed instead of deleting.
		try {
			await this.ensureLoggedIn();
			const existing = await this.readEvent(id);
			if (!existing || !existing.beginn || !existing.titel) {
				console.warn(`[KulturRingProvider] Event ${id} not found during delete; skipping.`);
				return;
			}

			if (/^(\[?abgesagt\]?)/i.test(existing.titel.trim())) {
				return;
			}

			const cancelledTitle = truncateWithEllipsis(`[ABGESAGT] ${existing.titel}`, 40);
			const params = new URLSearchParams();
			params.set('mview', 'kulturkalender');
			params.set('mtab', 'daten');
			params.set('mid', id);
			params.set('art', existing.art || '2');
			params.set('einrichtung', existing.einrichtung);
			params.set('beginn', existing.beginn);
			params.set('ende', existing.ende);
			params.set('zeitVon', existing.zeitVon);
			params.set('zeitBis', existing.zeitBis);
			params.set('titel', cancelledTitle);
			params.set('text', existing.text);
			params.set('eintritt', existing.eintritt);
			params.set('kategorie', existing.kategorie || '4');
			params.set('beginnVern', existing.beginnVern);
			params.set('zeitVern', existing.zeitVern);
			params.set('laudatioVern', existing.laudatioVern);
			params.set('musikVern', existing.musikVern);
			params.set('beginnFin', existing.beginnFin);
			params.set('zeitFin', existing.zeitFin);
			params.set('laudatioFin', existing.laudatioFin);
			params.set('musikFin', existing.musikFin);
			params.set('speichern', 'speichern');

			const editUrl = `${this.baseUrl}/db.php?view=kulturkalender&tab=daten&id=${encodeURIComponent(id)}`;
			await this.postFormAndFollow(editUrl, params, editUrl);
		} catch (error) {
			console.warn(`[KulturRingProvider] Could not mark event ${id} as cancelled (no native delete endpoint):`, error);
		}
	}

	async processWebhook(_payload: any): Promise<{
		changes: Array<{ externalId: string; changeType: 'created' | 'updated' | 'deleted' }>;
	}> {
		return { changes: [] };
	}

	// ----------------------------------------------------------------
	// Internal form mapping & session helpers
	// ----------------------------------------------------------------

	private buildFormParams(
		event: ExternalEvent,
		einrichtungen: KulturRingOption[],
		existing?: KulturRingFormFields,
		editId?: string
	): URLSearchParams {
		if (!event.startDateTime) {
			throw new Error('Kultur Ring: startDateTime is required');
		}
		const startDate = new Date(event.startDateTime);
		const endDate = event.endDateTime ? new Date(event.endDateTime) : startDate;

		const startFmt = formatBerlinDate(startDate);
		let endFmt = formatBerlinDate(endDate);

		let isMultiDay = endFmt.ddmmyyyy !== startFmt.ddmmyyyy;
		if (event.isAllDay && event.endDateTime) {
			// All-day events often use exclusive midnight endDateTime (start + 24h)
			const inclusiveEnd = new Date(endDate.getTime() - 1);
			const inclusiveEndFmt = formatBerlinDate(inclusiveEnd);
			endFmt = inclusiveEndFmt;
			isMultiDay = inclusiveEndFmt.ddmmyyyy !== startFmt.ddmmyyyy;
		}

		const einrichtungId = resolveEinrichtungId(
			event,
			einrichtungen,
			this.config?.settings?.einrichtungId,
			this.config?.settings?.einrichtungName
		);

		const zeitVon = event.isAllDay ? '' : formatBerlinTimeSlot(startDate);
		const zeitBis = event.isAllDay || !event.endDateTime ? '' : formatBerlinTimeSlot(endDate);

		const rawTitle = event.summary?.trim() || 'Veranstaltung';
		const titel = truncateWithEllipsis(rawTitle, 40);

		const plainDescription = event.description ? htmlToPlainText(event.description) : '';
		const text = plainDescription ? truncateWithEllipsis(plainDescription, 200) : '';

		const eintritt = parsePricingForKulturRing(event.ticketPrice);
		const kategorie = mapCategoryToKulturRing(event);

		const params = new URLSearchParams();
		if (editId) {
			params.set('mview', 'kulturkalender');
			params.set('mtab', 'daten');
			params.set('mid', editId);
		}
		params.set('art', existing?.art || '2');
		params.set('einrichtung', einrichtungId);
		params.set('beginn', startFmt.ddmmyyyy);
		params.set('ende', isMultiDay ? endFmt.ddmmyyyy : '');
		params.set('zeitVon', zeitVon);
		params.set('zeitBis', zeitBis);
		params.set('titel', titel);
		params.set('text', text);
		params.set('eintritt', eintritt);
		params.set('kategorie', kategorie);
		params.set('beginnVern', existing?.beginnVern || '');
		params.set('zeitVern', existing?.zeitVern || '');
		params.set('laudatioVern', existing?.laudatioVern || '');
		params.set('musikVern', existing?.musikVern || '');
		params.set('beginnFin', existing?.beginnFin || '');
		params.set('zeitFin', existing?.zeitFin || '');
		params.set('laudatioFin', existing?.laudatioFin || '');
		params.set('musikFin', existing?.musikFin || '');
		params.set('speichern', 'speichern');

		return params;
	}

	private extractIdFromResponse(finalUrl: string, html: string): string | null {
		const urlMatch = finalUrl.match(/[?&]id=(\d+)/i);
		if (urlMatch) return urlMatch[1];

		const midMatch = html.match(/<input[^>]*name=["']mid["'][^>]*value=["'](\d+)["']/i)
			|| html.match(/<input[^>]*value=["'](\d+)["'][^>]*name=["']mid["']/i);
		if (midMatch) return midMatch[1];

		const actionMatch = html.match(/formaction=["'][^"']*view=kulturkalender&tab=daten&id=(\d+)["']/i);
		if (actionMatch) return actionMatch[1];

		return null;
	}

	private findMatchingEventId(
		entries: KulturRingListEntry[],
		expectedTitle: string,
		ddmmyyyy: string
	): string | null {
		const normalizedTitle = expectedTitle.trim().toLowerCase();
		const exactTitleAndDate = entries.filter(
			(e) => e.title.trim().toLowerCase() === normalizedTitle && e.dateText.includes(ddmmyyyy)
		);
		const pool = exactTitleAndDate.length > 0
			? exactTitleAndDate
			: entries.filter((e) => e.title.trim().toLowerCase() === normalizedTitle);

		if (pool.length === 0) return null;

		pool.sort((a, b) => Number.parseInt(b.id, 10) - Number.parseInt(a.id, 10));
		return pool[0].id;
	}

	private getCredentials(): { username: string; password: string } {
		const username = this.config?.credentials?.username;
		const password = this.config?.credentials?.password;
		if (!username || !password) {
			throw new Error('Kultur Ring: credentials (username, password) are required in sync config');
		}
		return { username, password };
	}

	private async ensureLoggedIn(): Promise<void> {
		if (!this.isLoggedIn || this.sessionCookies.size === 0) {
			await this.login();
		}
	}

	private async login(): Promise<void> {
		const { username, password } = this.getCredentials();
		this.sessionCookies.clear();
		this.isLoggedIn = false;

		const loginUrl = `${this.baseUrl}/login.php`;
		const body = new URLSearchParams({
			benutzername: username,
			passwort: password
		});

		const response = await fetch(loginUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': 'Mozilla/5.0'
			},
			body: body.toString(),
			redirect: 'manual'
		});

		this.captureCookies(response);

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (location) {
				const targetUrl = new URL(location, loginUrl).toString();
				if (targetUrl.includes('login.php')) {
					throw new Error('Kultur Ring: login failed (redirected back to login page)');
				}
				const verifyRes = await this.rawAuthedFetch(targetUrl);
				const verifyHtml = await verifyRes.text();
				if (this.looksLikeLoginPage(verifyHtml)) {
					throw new Error('Kultur Ring: login failed (invalid credentials)');
				}
				this.isLoggedIn = true;
				return;
			}
		}

		const responseHtml = await response.text();
		if (!response.ok || this.looksLikeLoginPage(responseHtml)) {
			throw new Error(`Kultur Ring: login failed (status ${response.status})`);
		}

		this.isLoggedIn = true;
	}

	private looksLikeLoginPage(html: string): boolean {
		return /action=["'][^"']*login\.php["']/i.test(html) && /name=["']passwort["']/i.test(html);
	}

	private async fetchCreateFormHtml(): Promise<string> {
		const url = `${this.baseUrl}/db.php?view=kulturkalender&tab=daten`;
		const response = await this.authedFetch(url);
		if (!response.ok) {
			throw new Error(`Kultur Ring: failed to fetch form page (status ${response.status})`);
		}
		const html = await response.text();
		if (this.looksLikeLoginPage(html)) {
			throw new Error('Kultur Ring: received login page instead of form');
		}
		return html;
	}

	private async fetchEditFormHtml(id: string): Promise<string> {
		const url = `${this.baseUrl}/db.php?view=kulturkalender&tab=daten&id=${encodeURIComponent(id)}`;
		const response = await this.authedFetch(url);
		if (!response.ok) {
			throw new Error(`Kultur Ring: failed to fetch event ${id} (status ${response.status})`);
		}
		const html = await response.text();
		if (this.looksLikeLoginPage(html)) {
			throw new Error(`Kultur Ring: received login page when loading event ${id}`);
		}
		return html;
	}

	private captureCookies(response: Response): void {
		const setCookies = typeof (response.headers as any).getSetCookie === 'function'
			? ((response.headers as any).getSetCookie() as string[])
			: response.headers.get('set-cookie')
				? [response.headers.get('set-cookie') as string]
				: [];

		for (const raw of setCookies) {
			if (!raw) continue;
			const firstPart = raw.split(';')[0];
			const eqIndex = firstPart.indexOf('=');
			if (eqIndex > 0) {
				const name = firstPart.slice(0, eqIndex).trim();
				const val = firstPart.slice(eqIndex + 1).trim();
				this.sessionCookies.set(name, val);
			}
		}
	}

	private getCookieHeader(): string {
		return Array.from(this.sessionCookies.entries())
			.map(([k, v]) => `${k}=${v}`)
			.join('; ');
	}

	private async rawAuthedFetch(url: string, init: RequestInit = {}): Promise<Response> {
		const headers = new Headers(init.headers);
		if (!headers.has('User-Agent')) {
			headers.set('User-Agent', 'Mozilla/5.0');
		}
		const cookie = this.getCookieHeader();
		if (cookie) {
			headers.set('Cookie', cookie);
		}

		const response = await fetch(url, {
			...init,
			headers,
			redirect: 'manual'
		});
		this.captureCookies(response);
		return response;
	}

	private async authedFetch(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
		let response = await this.rawAuthedFetch(url, init);
		let hops = 0;

		while (response.status >= 300 && response.status < 400 && hops < 5) {
			const location = response.headers.get('location');
			if (!location) break;

			const nextUrl = new URL(location, url).toString();
			if (nextUrl.includes('login.php')) {
				if (!retried) {
					await this.login();
					return this.authedFetch(url, init, true);
				}
				throw new Error('Kultur Ring: authentication session expired');
			}

			response = await this.rawAuthedFetch(nextUrl, { method: 'GET' });
			hops++;
		}

		return response;
	}

	private async postFormAndFollow(
		url: string,
		params: URLSearchParams,
		referer: string,
		retried = false
	): Promise<{ finalUrl: string; bodyText: string }> {
		const response = await this.rawAuthedFetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Referer: referer
			},
			body: params.toString()
		});

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (location) {
				const nextUrl = new URL(location, url).toString();
				if (nextUrl.includes('login.php')) {
					if (!retried) {
						await this.login();
						return this.postFormAndFollow(url, params, referer, true);
					}
					throw new Error('Kultur Ring: authentication failed during form submission');
				}
				const followed = await this.authedFetch(nextUrl);
				const bodyText = await followed.text();
				return { finalUrl: nextUrl, bodyText };
			}
		}

		if (!response.ok) {
			throw new Error(`Kultur Ring: form submission failed with status ${response.status}`);
		}

		const bodyText = await response.text();
		if (this.looksLikeLoginPage(bodyText) && !retried) {
			await this.login();
			return this.postFormAndFollow(url, params, referer, true);
		}

		return { finalUrl: url, bodyText };
	}
}
