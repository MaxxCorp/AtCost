import * as m from '#lib/paraglide/messages.js';
import { hasCurrencySymbol, getCurrencySymbol, normalizeCurrency } from '@ac/validations';

export interface FormatTicketPriceOptions {
	locale?: 'de' | 'en';
	currency?: string | null;
}

/**
 * Evaluates and formats the ticket price for display.
 * - If price is unknown or not set, returns null (no price badge).
 * - If price explicitly evaluates to zero or free admission, returns the localized "Free" / "Kostenlos" string.
 * - Otherwise returns the trimmed price string with appropriate currency symbol (e.g. "15 €").
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
		.replace(/euro|eur|€|\$|£|¥|chf|fr\.|cad|aud|kr|zł|kč/gi, '')
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

	// If the price string does not already contain a currency symbol/code,
	// and contains numbers (e.g. "15", "12.50", "ab 5"), format it with the currency symbol.
	const hasCurrency = hasCurrencySymbol(trimmed);
	const containsDigits = /\d/.test(trimmed);
	if (!hasCurrency && containsDigits) {
		const currency = normalizeCurrency(options?.currency);
		const symbol = getCurrencySymbol(currency);
		if (currency === 'EUR' || currency === 'CHF') {
			return `${trimmed} ${symbol}`;
		} else if (
			currency === 'USD' ||
			currency === 'CAD' ||
			currency === 'AUD' ||
			currency === 'GBP' ||
			currency === 'JPY'
		) {
			return `${symbol}${trimmed}`;
		} else {
			return `${trimmed} ${symbol}`;
		}
	}

	return trimmed;
}

/**
 * Checks whether an event is free of charge based on ticket price and unknown flag.
 */
export function isEventFree(
	ticketPrice?: string | null,
	ticketPriceUnknown?: boolean | string | null
): boolean {
	if (
		ticketPriceUnknown === true ||
		ticketPriceUnknown === 'true' ||
		ticketPriceUnknown === 'on'
	) {
		return false;
	}

	if (!ticketPrice) {
		return false;
	}

	const trimmed = ticketPrice.trim();
	if (!trimmed) {
		return false;
	}

	// Check for common words indicating free admission
	if (/^(kostenlos|free|frei|eintritt\s*frei|gratis)$/i.test(trimmed)) {
		return true;
	}

	// Strip currency symbols/names and dash notations like 0,- or 0.-
	const numClean = trimmed
		.replace(/euro|eur|€|\$|£|¥|chf|fr\.|cad|aud|kr|zł|kč/gi, '')
		.replace(/,\s*-|\.\s*-/g, '')
		.replace(',', '.')
		.trim();

	// Check if the cleaned value represents a numeric zero (e.g. 0, 0.0, 0.00, +0, -0)
	if (/^[+-]?\d+(\.\d+)?$/.test(numClean)) {
		const parsed = parseFloat(numClean);
		if (!isNaN(parsed) && parsed === 0) {
			return true;
		}
	}

	return false;
}
