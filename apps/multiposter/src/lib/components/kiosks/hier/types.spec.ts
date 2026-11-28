import { describe, expect, it } from 'vitest';
import {
	DEFAULT_HIER_PRESETS,
	HIER_PALETTE,
	isHierGreyscaleActive,
	resolveHierLogoVariant
} from './types.js';

describe('Hier. Marzahn-Süd CI palette and logo contrast rules', () => {
	it('exposes all official hex colors from the brand guide', () => {
		expect(HIER_PALETTE.primaryDigital).toBe('#6950fc');
		expect(HIER_PALETTE.primaryAnalog).toBe('#61549f');
		expect(HIER_PALETTE.pink).toBe('#da5096');
		expect(HIER_PALETTE.yellow).toBe('#fcc505');
		expect(HIER_PALETTE.green).toBe('#40b28f');
		expect(HIER_PALETTE.charcoal).toBe('#222222');
		expect(HIER_PALETTE.navy).toBe('#29235c');
		expect(HIER_PALETTE.neonPink).toBe('#fb2591');
		expect(HIER_PALETTE.neonYellow).toBe('#ffec00');
		expect(HIER_PALETTE.neonGreen).toBe('#09cc86');
		expect(HIER_PALETTE.mutedCream).toBe('#fffcf7');
		expect(HIER_PALETTE.mutedLavender).toBe('#f0e7f3');
		expect(HIER_PALETTE.mutedBlush).toBe('#fadfed');
		expect(HIER_PALETTE.mutedIceBlue).toBe('#e8f3fc');
		expect(HIER_PALETTE.mutedMint).toBe('#e3f0ea');
		expect(HIER_PALETTE.mutedGreyLilac).toBe('#edeff4');
	});

	it('resolves logo variants per Brand Guide page 5 background contrast rules', () => {
		expect(resolveHierLogoVariant('#ffffff')).toBe('purple');
		expect(resolveHierLogoVariant(HIER_PALETTE.mutedLavender)).toBe('purple');
		expect(resolveHierLogoVariant(HIER_PALETTE.mutedCream)).toBe('purple');
		expect(resolveHierLogoVariant(HIER_PALETTE.mutedMint)).toBe('purple');

		expect(resolveHierLogoVariant(HIER_PALETTE.primaryDigital)).toBe('white');
		expect(resolveHierLogoVariant(HIER_PALETTE.primaryAnalog)).toBe('white');
		expect(resolveHierLogoVariant(HIER_PALETTE.navy)).toBe('white');
		expect(resolveHierLogoVariant(HIER_PALETTE.charcoal)).toBe('white');

		expect(resolveHierLogoVariant(HIER_PALETTE.yellow)).toBe('on_yellow');
		expect(resolveHierLogoVariant(HIER_PALETTE.neonPink)).toBe('on_pink');
		expect(resolveHierLogoVariant(HIER_PALETTE.neonGreen)).toBe('on_green');
		expect(resolveHierLogoVariant(HIER_PALETTE.primaryDigital, true)).toBe('mono');
	});

	it('provides valid default presets and greyscale detection', () => {
		expect(DEFAULT_HIER_PRESETS.length).toBeGreaterThanOrEqual(5);
		expect(DEFAULT_HIER_PRESETS[0].id).toBe('hier_digital_purple');
		expect(DEFAULT_HIER_PRESETS[0].subtitle).toBe('in Marzahn-Süd');
		expect(isHierGreyscaleActive('all_greyscale', 'color')).toBe(true);
		expect(isHierGreyscaleActive('all_color', 'greyscale')).toBe(true);
		expect(isHierGreyscaleActive('all_color', 'color')).toBe(false);
	});
});
