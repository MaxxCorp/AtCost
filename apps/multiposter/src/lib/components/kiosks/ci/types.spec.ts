import { describe, expect, it } from 'vitest';
import {
    KIOSK_FONT_OPTIONS,
    KIOSK_FONT_SCALE_MIN,
    KIOSK_FONT_SCALE_MAX,
    clampKioskFontScale,
    getKioskFontCss,
    getDocumentTypographyStyle,
    getItemTypographyStyle
} from './types.js';

describe('kiosk typography helpers', () => {
    it('clamps font scales to allowed bounds and handles invalid values', () => {
        expect(clampKioskFontScale(undefined)).toBe(1);
        expect(clampKioskFontScale(null)).toBe(1);
        expect(clampKioskFontScale(Number.NaN)).toBe(1);
        expect(clampKioskFontScale(0.2)).toBe(KIOSK_FONT_SCALE_MIN);
        expect(clampKioskFontScale(3)).toBe(KIOSK_FONT_SCALE_MAX);
        expect(clampKioskFontScale(1.15000001)).toBe(1.15);
    });

    it('resolves font CSS strings cleanly and returns empty for default or unknown ids', () => {
        expect(getKioskFontCss(undefined)).toBe('');
        expect(getKioskFontCss('default')).toBe('');
        expect(getKioskFontCss('nonexistent')).toBe('');
        for (const option of KIOSK_FONT_OPTIONS) {
            if (option.id === 'default') {
                expect(getKioskFontCss(option.id)).toBe('');
            } else {
                expect(getKioskFontCss(option.id)).toBe(option.cssFamily);
            }
        }
    });

    it('formats document and item CSS custom properties and font-family inline styles', () => {
        expect(getDocumentTypographyStyle('default', 1)).toBe('--kiosk-doc-font-scale: 1;');
        expect(getDocumentTypographyStyle('lora', 1.2)).toContain('--kiosk-doc-font-scale: 1.2;');
        expect(getDocumentTypographyStyle('lora', 1.2)).toContain("font-family: 'Lora'");

        expect(getItemTypographyStyle('', 0.9)).toBe('--kiosk-item-font-scale: 0.9;');
        expect(getItemTypographyStyle('patrick_hand', 1.1)).toContain('--kiosk-item-font-scale: 1.1;');
        expect(getItemTypographyStyle('patrick_hand', 1.1)).toContain("font-family: 'Patrick Hand'");
    });
});
