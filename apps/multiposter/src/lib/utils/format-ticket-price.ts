import * as m from '$lib/paraglide/messages';

export interface FormatTicketPriceOptions {
	locale?: 'de' | 'en';
}

/**
 * Evaluates and formats the ticket price for display.
 * - If price is unknown or not set, returns null (no price badge).
 * - If price explicitly evaluates to zero or free admission, returns the localized "Free" / "Kostenlos" string.
 * - Otherwise returns the trimmed price string (e.g. "15 €").
 */
export function formatTicketPrice(
	ticketPrice?: string | null,
	ticketPriceUnknown?: boolean | string | null,
	options?: FormatTicketPriceOptions
): string | null {
	if (
		ticketPriceUnknown === true ||
		ticketPriceUnknown === 'true' ||
		ticketPriceUnknown === 'on'
	) {
		return null;
	}

	if (!ticketPrice) {
		return null;
	}

	const trimmed = ticketPrice.trim();
	if (!trimmed) {
		return null;
	}

	// Check for common words indicating free admission
	if (/^(kostenlos|free|frei|eintritt\s*frei|gratis)$/i.test(trimmed)) {
		return m.ticket_price_free?.({}, options) ?? 'Kostenlos';
	}

	// Strip currency symbols/names and dash notations like 0,- or 0.-
	const numClean = trimmed
		.replace(/euro|eur|€|\$|£/gi, '')
		.replace(/,\s*-|\.\s*-/g, '')
		.replace(',', '.')
		.trim();

	// Check if the cleaned value represents a numeric zero (e.g. 0, 0.0, 0.00, +0, -0)
	if (/^[+-]?\d+(\.\d+)?$/.test(numClean)) {
		const parsed = parseFloat(numClean);
		if (!isNaN(parsed) && parsed === 0) {
			return m.ticket_price_free?.({}, options) ?? 'Kostenlos';
		}
	}

	return trimmed;
}
