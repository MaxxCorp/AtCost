/**
 * Shared utility for parsing ticket pricing information across sync providers.
 */

export interface PricingInfo {
	/** Whether the event should be considered free of charge */
	isFree: boolean;
	/** The numeric-ish price value to sync (e.g., "0" for free events) */
	priceValue: string;
}

/**
 * Parses a ticket price string to determine if it's free and what the synced price value should be.
 * 
 * Rules:
 * - Non-numeric strings (e.g., "free", "gratis", "frei") -> Is Free, Value "0"
 * - Numeric string "0" -> Is Free, Value "0"
 * - Numeric string > 0 -> NOT Free, Value as provided
 * - Empty/null/undefined -> Is Free, Value "0"
 * 
 * @param ticketPrice The raw ticket price string from the event metadata
 * @returns PricingInfo object
 */
export function parsePricing(ticketPrice: string | null | undefined): PricingInfo {
	if (!ticketPrice) {
		return { isFree: true, priceValue: '0' };
	}

	const priceStr = String(ticketPrice).trim().toLowerCase();
	if (!priceStr) {
		return { isFree: true, priceValue: '0' };
	}

	// Check for free-indicating keywords
	const freeKeywords = ['gratis', 'free', 'frei', 'kostenlos'];
	if (freeKeywords.some(keyword => priceStr.includes(keyword))) {
		return { isFree: true, priceValue: '0' };
	}

	const parsed = parseFloat(priceStr.replace(',', '.')); // Handle German comma decimals
	
	if (isNaN(parsed)) {
		// Non-numeric strings are treated as free
		return { isFree: true, priceValue: '0' };
	}

	// A parsed value of 0 is treated as free.
	if (parsed === 0) {
		return { isFree: true, priceValue: '0' };
	}

	// Any other number is a fee offering
	return { isFree: false, priceValue: priceStr };
}
