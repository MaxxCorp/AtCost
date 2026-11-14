import * as m from '#lib/paraglide/messages.js';
import { formatRecurrenceText } from '#lib/utils/format-recurrence.js';
import {
	escapeHtml,
	formatKioskSignUpCompact,
	formatSignUpClosureTimeText,
	normalizeSignUpRecurrence,
	sanitizeEmailDescriptionHtml
} from '#lib/utils/event-signup.js';
import type { ExternalEvent, ProviderType } from '../types';

export { escapeHtml, sanitizeEmailDescriptionHtml };

/**
 * Hardcoded default target content language for outbound synchronizations when no
 * provider- or config-specific language is supplied.
 */
export const DEFAULT_SYNC_PREFERRED_LANGUAGE = 'de';

export type SupportedSyncLocale = 'de' | 'en';

export interface SyncProviderCapabilities {
	supportsHtmlDescription: boolean;
}

/**
 * Capability matrix per external sync provider determining whether its description field
 * renders HTML (`<p>`, `<a href>`) or requires plain-text formatting.
 */
export const SYNC_PROVIDER_CAPABILITIES: Record<ProviderType, SyncProviderCapabilities> = {
	'google-calendar': { supportsHtmlDescription: true },
	'microsoft-calendar': { supportsHtmlDescription: true },
	'wp-the-events-calendar': { supportsHtmlDescription: true },
	eventbrite: { supportsHtmlDescription: true },
	meetup: { supportsHtmlDescription: true },
	'bewegungsatlas-berlin': { supportsHtmlDescription: true },
	email: { supportsHtmlDescription: true },
	webhook: { supportsHtmlDescription: true },
	custom: { supportsHtmlDescription: true },
	'berlin-de-main-calendar': { supportsHtmlDescription: false },
	'berlin-de-mh-calendar': { supportsHtmlDescription: false },
	'seniorennetz-berlin': { supportsHtmlDescription: false },
	'nebenan-de': { supportsHtmlDescription: false },
	'kultur-ring': { supportsHtmlDescription: false },
	instagram: { supportsHtmlDescription: false },
	'microsoft-contacts': { supportsHtmlDescription: false },
	'microsoft-resources': { supportsHtmlDescription: false }
};

export function providerSupportsHtmlDescription(providerId: ProviderType): boolean {
	return SYNC_PROVIDER_CAPABILITIES[providerId]?.supportsHtmlDescription ?? false;
}

export function resolveSyncLanguage(
	...candidates: Array<string | null | undefined>
): string {
	for (const candidate of candidates) {
		if (typeof candidate === 'string') {
			const trimmed = candidate.trim();
			if (trimmed.length > 0) return trimmed;
		}
	}
	return DEFAULT_SYNC_PREFERRED_LANGUAGE;
}

export function normalizeSyncLocale(language?: string | null): SupportedSyncLocale {
	const base = (language || DEFAULT_SYNC_PREFERRED_LANGUAGE).trim().toLowerCase().split(/[-_]/)[0];
	return base === 'en' ? 'en' : 'de';
}

export function buildEventSignUpUrl(baseUrl: string, eventId: string): string {
	const cleanBase = (baseUrl || '').replace(/\/+$/, '');
	const cleanId = encodeURIComponent(eventId);
	return `${cleanBase}/events/${cleanId}/view?signup=true`;
}

export interface SyncSignUpPromptLabels {
	recommended: string;
	req: string;
	reqContact: (contact: string) => string;
	by: (date: string) => string;
	viaContact: (contact: string) => string;
	closed: string;
	linkKeyword: string;
}

export function getLocalizedSyncSignUpLabels(language?: string | null): SyncSignUpPromptLabels {
	const locale = normalizeSyncLocale(language);
	return {
		recommended: m.sync_sign_up_recommended({}, { locale }),
		req: m.sync_sign_up_required({}, { locale }),
		reqContact: (contact) => m.sync_sign_up_via_contact({ contact }, { locale }),
		by: (date) => m.sync_sign_up_by({ date }, { locale }),
		viaContact: (contact) => m.kiosk_sign_up_via_contact({ contact }, { locale }),
		closed: m.sync_sign_up_closed({}, { locale }),
		linkKeyword: m.sync_sign_up_link_keyword({}, { locale })
	};
}

export interface SyncSignUpPromptEventInput {
	id?: string | null;
	signUpMode?: string | null;
	signUpClosureDate?: string | Date | null;
	signUpRecurrence?: string[] | string | null;
	startTimeZone?: string | null;
	resolvedSignUpContact?: {
		name?: string | null;
		phone?: string | null;
		email?: string | null;
	} | null;
}

/**
 * Formats an event's sign-up prompt into both plain text and an HTML paragraph with the
 * sign-up keyword linked to the self-service registration form, translated to the resolved
 * sync target language. Returns `null` when sign-up is disabled (`off` or unset).
 */
export function buildSyncSignUpPrompt(
	event: SyncSignUpPromptEventInput | null | undefined,
	options: {
		signUpUrl: string;
		language?: string;
		locale?: string;
		timeZone?: string;
		isRecurringSeries?: boolean;
		labels?: SyncSignUpPromptLabels;
	}
): { text: string; html: string } | null {
	if (!event) return null;
	const mode = event.signUpMode;
	if (mode !== 'recommended' && mode !== 'required') return null;

	const targetLanguage = resolveSyncLanguage(options.language, options.locale);
	const messageLocale = normalizeSyncLocale(targetLanguage);
	const labels = options.labels ?? getLocalizedSyncSignUpLabels(targetLanguage);
	const timeZone = options.timeZone ?? event.startTimeZone ?? undefined;

	let text = '';
	if (mode === 'recommended') {
		text = labels.recommended;
	} else {
		let recurringDeadlineLabel: string | undefined;
		const recurrenceRules = normalizeSignUpRecurrence(event.signUpRecurrence);
		if (options.isRecurringSeries && recurrenceRules) {
			const recText = formatRecurrenceText(recurrenceRules, {
				short: true,
				includeEnd: false,
				locale: messageLocale,
				dtstart: event.signUpClosureDate ?? undefined
			});
			if (recText) {
				const timeText = formatSignUpClosureTimeText(
					event.signUpClosureDate,
					targetLanguage,
					timeZone,
					true
				);
				recurringDeadlineLabel = timeText ? `${recText} ${timeText}` : recText;
			}
		}

		text = formatKioskSignUpCompact(
			event,
			{
				req: labels.req,
				by: labels.by,
				orContact: labels.viaContact,
				closed: labels.closed,
				reqPlain: labels.req,
				reqContact: labels.reqContact,
				byPlain: labels.by,
				viaContact: labels.viaContact
			},
			targetLanguage,
			timeZone,
			{
				showQrCode: false,
				...(recurringDeadlineLabel ? { recurringDeadlineLabel } : {})
			}
		);
	}

	if (!text) return null;

	const safeHref = escapeHtml(options.signUpUrl);
	const keyword = labels.linkKeyword;
	const idx = keyword ? text.toLowerCase().indexOf(keyword.toLowerCase()) : -1;

	let htmlInner: string;
	if (idx >= 0 && options.signUpUrl) {
		const before = escapeHtml(text.slice(0, idx));
		const matched = escapeHtml(text.slice(idx, idx + keyword.length));
		const after = escapeHtml(text.slice(idx + keyword.length));
		htmlInner = `${before}<a href="${safeHref}">${matched}</a>${after}`;
	} else if (options.signUpUrl) {
		htmlInner = `<a href="${safeHref}">${escapeHtml(text)}</a>`;
	} else {
		htmlInner = escapeHtml(text);
	}

	return {
		text,
		html: `<p>${htmlInner}</p>`
	};
}

/**
 * Prepends a formatted sign-up prompt paragraph to an event description according to whether
 * the target provider supports HTML descriptions.
 */
export function prependSignUpPromptToDescription(
	description: string | undefined,
	prompt: { text: string; html: string } | null | undefined,
	supportsHtml: boolean
): string | undefined {
	if (!prompt) return description;

	const trimmed = description?.trim();
	if (supportsHtml) {
		return trimmed ? `${prompt.html}${trimmed}` : prompt.html;
	}

	return trimmed ? `${prompt.text}\n\n${trimmed}` : prompt.text;
}

/**
 * Formats an event's outbound description at the sync-provider level, translating any
 * structured `event.signUp` info to the provider's/event's target language and prepending
 * it when the provider does not handle sign-ups natively via API.
 */
export function formatProviderDescription(
	event: Pick<ExternalEvent, 'description' | 'signUp' | 'preferredLanguage' | 'startTimeZone'>,
	options: {
		supportsHtml: boolean;
		defaultLanguage?: string;
		configLanguage?: string;
		fallbackDescription?: string;
		skipSignUpPrompt?: boolean;
	}
): string | undefined {
	const baseDescription = event.description || options.fallbackDescription || undefined;
	if (options.skipSignUpPrompt || !event.signUp) {
		return baseDescription;
	}

	const language = resolveSyncLanguage(
		options.defaultLanguage,
		options.configLanguage,
		event.preferredLanguage
	);

	const prompt = buildSyncSignUpPrompt(
		{
			signUpMode: event.signUp.mode,
			signUpClosureDate: event.signUp.closureDate,
			signUpRecurrence: event.signUp.recurrence,
			startTimeZone: event.signUp.startTimeZone ?? event.startTimeZone,
			resolvedSignUpContact: event.signUp.contact
		},
		{
			signUpUrl: event.signUp.signUpUrl ?? '',
			language,
			timeZone: event.signUp.startTimeZone ?? event.startTimeZone ?? undefined,
			isRecurringSeries: event.signUp.isRecurringSeries
		}
	);

	return prependSignUpPromptToDescription(baseDescription, prompt, options.supportsHtml);
}
