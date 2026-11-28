import { describe, expect, it } from 'vitest';
import {
    BALL_ORG_LOGO_METRICS,
    KIOSK_FONT_OPTIONS,
    KIOSK_FONT_SCALE_MIN,
    KIOSK_FONT_SCALE_MAX,
    clampKioskFontScale,
    computeTopTriangleOrgLogoLayout,
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

describe('top triangle org logo layout', () => {
    it.each([
        { label: 'A4 poster', widthMm: 210, heightMm: 44 },
        { label: 'A3 poster', widthMm: 297, heightMm: 52 },
        { label: 'Flyer panel', widthMm: 99, heightMm: 34 }
    ])('centers the BALL circle at 50% width with equal slim top and hypotenuse margins ($label)', ({ widthMm, heightMm }) => {
        const strokeHalfWidthMm = 0.26;
        const layout = computeTopTriangleOrgLogoLayout({
            widthMm,
            heightMm,
            isBallLogo: true,
            strokeHalfWidthMm
        });

        const imgWidthMm = layout.imgHeightMm * (BALL_ORG_LOGO_METRICS.widthPx / BALL_ORG_LOGO_METRICS.heightPx);
        const imgLeftMm = widthMm / 2 + (layout.translateXPercent / 100) * imgWidthMm;
        const circleCenterXMm = imgLeftMm + imgWidthMm * BALL_ORG_LOGO_METRICS.centerXRatio;
        const circleRadiusMm = layout.circleDiameterMm / 2;
        const circleTopMm = layout.imgTopMm + layout.imgHeightMm * BALL_ORG_LOGO_METRICS.topRatio;
        const circleCenterYMm = circleTopMm + circleRadiusMm;

        // Horizontal center of circle sits at exactly 50% of page/panel width
        expect(circleCenterXMm).toBeCloseTo(widthMm / 2, 6);

        // Top of circle has exact slim margin to y = 0
        expect(circleTopMm).toBeCloseTo(layout.marginMm, 6);

        // Perpendicular distance from circle outer arc to upper edge of hypotenuse stroke equals top margin
        const L = Math.hypot(widthMm, heightMm);
        const distCenterToHypotenuseCenterline = (widthMm * heightMm - heightMm * circleCenterXMm - widthMm * circleCenterYMm) / L;
        const distCircleArcToHypotenuseInk = distCenterToHypotenuseCenterline - strokeHalfWidthMm - circleRadiusMm;
        expect(distCircleArcToHypotenuseInk).toBeCloseTo(layout.marginMm, 6);

        // Rightmost lower extent of "e. V." / horizontal bar (px=1016, py=440) remains strictly inside the triangle
        const rightEdgeXMm = imgLeftMm + imgWidthMm * (1016 / BALL_ORG_LOGO_METRICS.widthPx);
        const rightEdgeYMm = layout.imgTopMm + layout.imgHeightMm * (440 / BALL_ORG_LOGO_METRICS.heightPx);
        const rightEdgeDistToInk = (widthMm * heightMm - heightMm * rightEdgeXMm - widthMm * rightEdgeYMm) / L - strokeHalfWidthMm;
        expect(rightEdgeDistToInk).toBeGreaterThan(0);
    });

    it('falls back to standard -50% centering for custom non-BALL org logos', () => {
        const layout = computeTopTriangleOrgLogoLayout({
            widthMm: 210,
            heightMm: 44,
            isBallLogo: false
        });

        expect(layout.translateXPercent).toBe(-50);
        expect(layout.imgTopMm).toBe(layout.marginMm);
        expect(layout.imgHeightMm).toBe(layout.circleDiameterMm);
    });
});
