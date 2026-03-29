/**
 * Converts HTML to readable plain text by replacing block-level tags with newlines
 * and stripping other tags.
 */
export function htmlToPlainText(html: string): string {
    if (!html) return '';

    let text = html;

    // Replace <br> and <br /> with a single newline
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Replace paragraphs and divs with double newlines if they are followed by content
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');

    // Handle list items
    text = text.replace(/<li>/gi, '\n• ');
    text = text.replace(/<\/li>/gi, '');

    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode basic HTML entities
    const entities: Record<string, string> = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&copy;': '©',
        '&reg;': '®',
        '&deg;': '°'
    };

    Object.entries(entities).forEach(([entity, char]) => {
        text = text.replace(new RegExp(entity, 'g'), char);
    });

    // Clean up multiple newlines (max 2)
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
}
