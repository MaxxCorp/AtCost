export interface CurrencyOption {
    code: string;
    symbol: string;
    label: string;
}

export const SUPPORTED_CURRENCIES: readonly CurrencyOption[] = [
    { code: 'EUR', symbol: '€', label: 'EUR (€)' },
    { code: 'USD', symbol: '$', label: 'USD ($)' },
    { code: 'GBP', symbol: '£', label: 'GBP (£)' },
    { code: 'CHF', symbol: 'CHF', label: 'CHF (CHF)' },
    { code: 'CAD', symbol: 'CA$', label: 'CAD (CA$)' },
    { code: 'AUD', symbol: 'AU$', label: 'AUD (AU$)' },
    { code: 'JPY', symbol: '¥', label: 'JPY (¥)' },
    { code: 'PLN', symbol: 'zł', label: 'PLN (zł)' },
    { code: 'SEK', symbol: 'kr', label: 'SEK (kr)' },
    { code: 'NOK', symbol: 'kr', label: 'NOK (kr)' },
    { code: 'DKK', symbol: 'kr', label: 'DKK (kr)' },
    { code: 'CZK', symbol: 'Kč', label: 'CZK (Kč)' },
] as const;

export const DEFAULT_CURRENCY = 'EUR';

export function normalizeCurrency(currency?: string | null): string {
    if (!currency || typeof currency !== 'string') return DEFAULT_CURRENCY;
    const trimmed = currency.trim().toUpperCase();
    return trimmed || DEFAULT_CURRENCY;
}

export function getCurrencySymbol(currency?: string | null): string {
    const code = normalizeCurrency(currency);
    switch (code) {
        case 'EUR':
            return '€';
        case 'USD':
            return '$';
        case 'GBP':
            return '£';
        case 'CHF':
            return 'CHF';
        case 'CAD':
            return 'CA$';
        case 'AUD':
            return 'AU$';
        case 'JPY':
            return '¥';
        case 'PLN':
            return 'zł';
        case 'SEK':
        case 'NOK':
        case 'DKK':
            return 'kr';
        case 'CZK':
            return 'Kč';
        default:
            try {
                return (
                    (0)
                        .toLocaleString('en', {
                            style: 'currency',
                            currency: code,
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                        })
                        .replace(/\d/g, '')
                        .trim() || code
                );
            } catch {
                return code;
            }
    }
}

export function formatCurrency(
    amount: number,
    currency?: string | null,
    locale?: string
): string {
    const code = normalizeCurrency(currency);
    const resolvedLocale = locale || (code === 'EUR' ? 'de-DE' : 'en-US');
    try {
        return new Intl.NumberFormat(resolvedLocale, {
            style: 'currency',
            currency: code,
        }).format(amount);
    } catch {
        const symbol = getCurrencySymbol(code);
        return `${symbol}${amount.toFixed(2)}`;
    }
}

export function hasCurrencySymbol(str?: string | null): boolean {
    if (!str) return false;
    return /[€$£¥]|eur|usd|gbp|chf|fr\.|yen|cad|aud|kr|zł|kč/i.test(str);
}
