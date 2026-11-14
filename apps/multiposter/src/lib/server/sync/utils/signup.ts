import * as m from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import { formatRecurrenceText } from '#lib/utils/format-recurrence.js';
import {
	escapeHtml,
	formatKioskSignUpCompact,
	formatSignUpClosureTimeText,
	normalizeSignUpRecurrence,
	sanitizeEmailDescriptionHtml
} from '#lib/utils/event-signup.js';
import type { ProviderType } from '../types';

export { escapeHtml, sanitizeEmailDescriptionHtml };

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

function getDefaultSyncSignUpLabels(): SyncSignUpPromptLabels {
	return {
		recommended: m.sync_sign_up_recommended(),
		req: m.sync_sign_up_required(),
		reqContact: (contact) => m.sync_sign_up_via_contact({ contact }),
		by: (date) => m.sync_sign_up_by({ date }),
		viaContact: (contact) => m.kiosk_sign_up_via_contact({ contact }),
		closed: m.sync_sign_up_closed(),
		linkKeyword: m.sync_sign_up_link_keyword()
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
 * sign-up keyword linked to the self-service registration form. Returns `null` when
 * sign-up is disabled (`off` or unset).
 */
export function buildSyncSignUpPrompt(
	event: SyncSignUpPromptEventInput | null | undefined,
	options: {
		signUpUrl: string;
		locale?: string;
		timeZone?: string;
		isRecurringSeries?: boolean;
		labels?: SyncSignUpPromptLabels;
	}
): { text: string; html: string } | null {
	if (!event) return null;
	const mode = event.signUpMode;
	if (mode !== 'recommended' && mode !== 'required') return null;

	const labels = options.labels ?? getDefaultSyncSignUpLabels();
	const locale = options.locale ?? getLocale();
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
				locale,
				dtstart: event.signUpClosureDate ?? undefined
			});
			if (recText) {
				const timeText = formatSignUpClosureTimeText(
					event.signUpClosureDate,
					locale,
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
			locale,
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
