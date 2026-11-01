/**
 * Utility functions for stripping HTML formatting and calculating proportional text cutoffs.
 */

export function stripHtmlAndFormatting(text?: string | null): string {
    if (!text) return '';
    return text
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/[*_#`~\[\]]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculates a proportional plain cut-off of the text based on percentage (0-100).
 * Preserves sentence boundaries where possible; otherwise cleanly breaks at word boundaries with an ellipsis.
 */
export function calculatePlainCutoff(rawText?: string | null, percentage: number = 100): string {
    if (!rawText) return '';
    if (percentage >= 100) return rawText.trim();
    if (percentage <= 0) return '';

    const clean = stripHtmlAndFormatting(rawText);
    if (!clean) return '';

    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';

    const targetWords = Math.max(3, Math.round((words.length * percentage) / 100));
    if (targetWords >= words.length) return clean;

    // Try sentence boundaries first
    const sentences = clean.match(/[^.!?]+[.!?]+/g);
    if (sentences) {
        let accumulated = '';
        for (const s of sentences) {
            const candidate = accumulated ? `${accumulated} ${s.trim()}` : s.trim();
            const candidateWords = candidate.split(/\s+/).filter(Boolean).length;
            if (candidateWords <= targetWords) {
                accumulated = candidate;
            } else {
                break;
            }
        }
        if (accumulated && accumulated.split(/\s+/).filter(Boolean).length >= Math.max(3, Math.floor(targetWords * 0.5))) {
            return accumulated;
        }
    }

    // Otherwise, truncate cleanly at word boundary with an ellipsis
    return words.slice(0, targetWords).join(' ') + '...';
}
