import { describe, it, expect } from 'vitest';
import { stripHtmlAndFormatting, calculatePlainCutoff } from './text-cutoff.js';

describe('text-cutoff utility', () => {
    describe('stripHtmlAndFormatting', () => {
        it('should handle null and undefined', () => {
            expect(stripHtmlAndFormatting(null)).toBe('');
            expect(stripHtmlAndFormatting(undefined)).toBe('');
            expect(stripHtmlAndFormatting('')).toBe('');
        });

        it('should strip HTML tags and decode basic entities', () => {
            const input = '<p>Hello <strong>World</strong>&nbsp;&amp;&nbsp;friends!</p>';
            expect(stripHtmlAndFormatting(input)).toBe('Hello World & friends!');
        });

        it('should strip markdown formatting characters', () => {
            const input = '## Header with *italics* and [links](http://example.com)';
            expect(stripHtmlAndFormatting(input)).toBe('Header with italics and links(http://example.com)');
        });
    });

    describe('calculatePlainCutoff', () => {
        const sampleText = 'Willkommen zum Sommerfest im Bürgerhaus Südspitze. Wir laden alle Nachbarn und Familien herzlich ein zu Musik, Grillen und Spaß. Der Eintritt ist frei und für das leibliche Wohl ist gesorgt. Wir freuen uns auf Ihr zahlreiches Erscheinen!';

        it('should return original text at 100%', () => {
            expect(calculatePlainCutoff(sampleText, 100)).toBe(sampleText);
            expect(calculatePlainCutoff(sampleText, 120)).toBe(sampleText);
        });

        it('should return empty string at 0%', () => {
            expect(calculatePlainCutoff(sampleText, 0)).toBe('');
        });

        it('should proportionally shorten text at 50%', () => {
            const result = calculatePlainCutoff(sampleText, 50);
            expect(result.length).toBeLessThan(sampleText.length);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should handle HTML content when calculating cutoff', () => {
            const htmlText = '<p>Erster wichtiger Satz mit Information.</p><p>Zweiter Satz mit noch mehr Details über die Veranstaltung.</p><p>Dritter Satz mit Schlusswort.</p>';
            const result = calculatePlainCutoff(htmlText, 40);
            expect(result).not.toContain('<p>');
            expect(result.length).toBeLessThan(htmlText.length);
        });

        it('should cleanly fallback to word boundary with ellipsis when sentence matching is too short', () => {
            const longSentence = 'Ein ungewöhnlich langer Satz ohne Satzzeichen der viele Worte umfasst und die Veranstaltung beschreibt.';
            const result = calculatePlainCutoff(longSentence, 30);
            expect(result.endsWith('...')).toBe(true);
        });
    });
});
