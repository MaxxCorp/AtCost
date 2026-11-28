import type { CiPrintOptions, CiSponsorItem, PrintMode } from '../ci/types.js';

export const HIER_PALETTE = {
	// Hauptfarbpalette (PDF p. 7)
	primaryDigital: '#6950fc',
	primaryAnalog: '#61549f',
	pink: '#da5096',
	yellow: '#fcc505',
	green: '#40b28f',
	charcoal: '#222222',
	navy: '#29235c',

	// Neon-Töne für frische digitale Darstellungen (PDF p. 7)
	neonPink: '#fb2591',
	neonYellow: '#ffec00',
	neonGreen: '#09cc86',

	// Gedeckte Töne für klassische Hintergründe (PDF p. 7)
	mutedCream: '#fffcf7',
	mutedLavender: '#f0e7f3',
	mutedBlush: '#fadfed',
	mutedIceBlue: '#e8f3fc',
	mutedMint: '#e3f0ea',
	mutedGreyLilac: '#edeff4'
} as const;

export const HIER_FONT_STACK =
	"'Futura', 'Futura PT', 'Jost', 'Century Gothic', 'Poppins', sans-serif";

export type HierLogoVariant =
	| 'purple'
	| 'analog'
	| 'white'
	| 'on_yellow'
	| 'on_pink'
	| 'on_green'
	| 'mono';

export interface HierCiPreset {
	id: string;
	name: string;
	headerBg: string;
	headerText: string;
	pageBg: string;
	surfaceBg: string;
	primaryColor: string;
	accentPink: string;
	accentYellow: string;
	accentGreen: string;
	textColor: string;
	logoVariant: HierLogoVariant;
	subtitle: string;
	orgLogoUrl?: string;
	locationLogoUrl?: string;
	showOrgLogo: boolean;
	showLocationLogo: boolean;
	inclusivityText?: string;
	showInclusivityIcon?: boolean;
	partnerLogoUrl?: string;
	sponsors?: CiSponsorItem[];
}

export const DEFAULT_HIER_PRESETS: HierCiPreset[] = [
	{
		id: 'hier_digital_purple',
		name: 'HIER. Hauptton Lila (#6950fc)',
		headerBg: HIER_PALETTE.primaryDigital,
		headerText: '#ffffff',
		pageBg: HIER_PALETTE.mutedCream,
		surfaceBg: HIER_PALETTE.mutedLavender,
		primaryColor: HIER_PALETTE.primaryDigital,
		accentPink: HIER_PALETTE.pink,
		accentYellow: HIER_PALETTE.yellow,
		accentGreen: HIER_PALETTE.green,
		textColor: HIER_PALETTE.charcoal,
		logoVariant: 'white',
		subtitle: 'in Marzahn-Süd',
		orgLogoUrl: '',
		locationLogoUrl: '',
		showOrgLogo: true,
		showLocationLogo: true,
		inclusivityText: 'Barrierefreies Haus',
		showInclusivityIcon: true,
		partnerLogoUrl: '',
		sponsors: []
	},
	{
		id: 'hier_analog_purple',
		name: 'HIER. Analog Druck (#61549f)',
		headerBg: HIER_PALETTE.primaryAnalog,
		headerText: '#ffffff',
		pageBg: HIER_PALETTE.mutedCream,
		surfaceBg: HIER_PALETTE.mutedLavender,
		primaryColor: HIER_PALETTE.primaryAnalog,
		accentPink: HIER_PALETTE.pink,
		accentYellow: HIER_PALETTE.yellow,
		accentGreen: HIER_PALETTE.green,
		textColor: HIER_PALETTE.charcoal,
		logoVariant: 'white',
		subtitle: 'in Marzahn-Süd',
		orgLogoUrl: '',
		locationLogoUrl: '',
		showOrgLogo: true,
		showLocationLogo: true,
		inclusivityText: 'Barrierefreies Haus',
		showInclusivityIcon: true,
		partnerLogoUrl: '',
		sponsors: []
	},
	{
		id: 'hier_muted_lavender',
		name: 'HIER. Gedeckt Lavendel – Spartoner',
		headerBg: HIER_PALETTE.mutedLavender,
		headerText: HIER_PALETTE.navy,
		pageBg: '#ffffff',
		surfaceBg: HIER_PALETTE.mutedCream,
		primaryColor: HIER_PALETTE.primaryDigital,
		accentPink: HIER_PALETTE.pink,
		accentYellow: HIER_PALETTE.yellow,
		accentGreen: HIER_PALETTE.green,
		textColor: HIER_PALETTE.charcoal,
		logoVariant: 'purple',
		subtitle: 'in Marzahn-Süd',
		orgLogoUrl: '',
		locationLogoUrl: '',
		showOrgLogo: true,
		showLocationLogo: true,
		inclusivityText: 'Barrierefreies Haus',
		showInclusivityIcon: true,
		partnerLogoUrl: '',
		sponsors: []
	},
	{
		id: 'hier_muted_mint',
		name: 'HIER. Gedeckt Salbei (#e3f0ea)',
		headerBg: HIER_PALETTE.mutedMint,
		headerText: HIER_PALETTE.navy,
		pageBg: '#ffffff',
		surfaceBg: HIER_PALETTE.mutedMint,
		primaryColor: HIER_PALETTE.primaryDigital,
		accentPink: HIER_PALETTE.pink,
		accentYellow: HIER_PALETTE.yellow,
		accentGreen: HIER_PALETTE.green,
		textColor: HIER_PALETTE.charcoal,
		logoVariant: 'purple',
		subtitle: 'in Marzahn-Süd',
		orgLogoUrl: '',
		locationLogoUrl: '',
		showOrgLogo: true,
		showLocationLogo: true,
		inclusivityText: 'Barrierefreies Haus',
		showInclusivityIcon: true,
		partnerLogoUrl: '',
		sponsors: []
	},
	{
		id: 'hier_dark_navy',
		name: 'HIER. Dunkelblau (#29235c)',
		headerBg: HIER_PALETTE.navy,
		headerText: '#ffffff',
		pageBg: HIER_PALETTE.mutedCream,
		surfaceBg: HIER_PALETTE.mutedIceBlue,
		primaryColor: HIER_PALETTE.primaryDigital,
		accentPink: HIER_PALETTE.pink,
		accentYellow: HIER_PALETTE.yellow,
		accentGreen: HIER_PALETTE.green,
		textColor: HIER_PALETTE.charcoal,
		logoVariant: 'white',
		subtitle: 'in Marzahn-Süd',
		orgLogoUrl: '',
		locationLogoUrl: '',
		showOrgLogo: true,
		showLocationLogo: true,
		inclusivityText: 'Barrierefreies Haus',
		showInclusivityIcon: true,
		partnerLogoUrl: '',
		sponsors: []
	}
];

export const HIER_SWATCH_GROUPS = [
	{
		label: 'Hauptfarbpalette',
		colors: [
			{ name: 'Hauptton Digital', hex: HIER_PALETTE.primaryDigital },
			{ name: 'Hauptton Analog', hex: HIER_PALETTE.primaryAnalog },
			{ name: 'Pink', hex: HIER_PALETTE.pink },
			{ name: 'Gelb', hex: HIER_PALETTE.yellow },
			{ name: 'Grün', hex: HIER_PALETTE.green },
			{ name: 'Anthrazit', hex: HIER_PALETTE.charcoal },
			{ name: 'Dunkelblau', hex: HIER_PALETTE.navy }
		]
	},
	{
		label: 'Neon-Töne (Digital)',
		colors: [
			{ name: 'Neon Pink', hex: HIER_PALETTE.neonPink },
			{ name: 'Neon Gelb', hex: HIER_PALETTE.neonYellow },
			{ name: 'Neon Grün', hex: HIER_PALETTE.neonGreen }
		]
	},
	{
		label: 'Gedeckte Töne (Klassisch / Hintergrund)',
		colors: [
			{ name: 'Creme', hex: HIER_PALETTE.mutedCream },
			{ name: 'Lavendel', hex: HIER_PALETTE.mutedLavender },
			{ name: 'Rosé', hex: HIER_PALETTE.mutedBlush },
			{ name: 'Eisblau', hex: HIER_PALETTE.mutedIceBlue },
			{ name: 'Salbei', hex: HIER_PALETTE.mutedMint },
			{ name: 'Grau-Flieder', hex: HIER_PALETTE.mutedGreyLilac }
		]
	}
] as const;

export const DEFAULT_HIER_PRINT_OPTIONS: CiPrintOptions = {
	printMode: 'all_color',
	hideQrInPrint: false,
	hideImagesInPrint: false,
	hideSponsorsInPrint: false,
	hideFoldGuidesInPrint: false,
	grayscaleImagesInPrint: false,
	previewGreyscaleOnScreen: false
};

function parseHexLuminance(bgHex: string): number | null {
	const cleaned = bgHex.trim().toLowerCase();
	const match = cleaned.match(/^#?([0-9a-f]{6})$/);
	if (!match) return null;
	const raw = match[1];
	const r = parseInt(raw.slice(0, 2), 16) / 255;
	const g = parseInt(raw.slice(2, 4), 16) / 255;
	const b = parseInt(raw.slice(4, 6), 16) / 255;
	const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Resolves the appropriate HIER logo variant for a given background color according to
 * Brand Guide p. 5 contrast rules.
 */
export function resolveHierLogoVariant(bgHex: string, forceMono = false): HierLogoVariant {
	if (forceMono) return 'mono';
	const normalized = bgHex.trim().toLowerCase();
	const withHash = normalized.startsWith('#') ? normalized : `#${normalized}`;

	if (withHash === HIER_PALETTE.yellow || withHash === HIER_PALETTE.neonYellow) {
		return 'on_yellow';
	}
	if (withHash === HIER_PALETTE.neonPink || withHash === HIER_PALETTE.pink) {
		return 'on_pink';
	}
	if (withHash === HIER_PALETTE.neonGreen || withHash === HIER_PALETTE.green) {
		return 'on_green';
	}
	if (
		withHash === HIER_PALETTE.primaryDigital ||
		withHash === HIER_PALETTE.primaryAnalog ||
		withHash === HIER_PALETTE.navy ||
		withHash === HIER_PALETTE.charcoal
	) {
		return 'white';
	}

	const luminance = parseHexLuminance(withHash);
	if (luminance !== null && luminance < 0.35) {
		return 'white';
	}
	return 'purple';
}

export function isHierGreyscaleActive(
	printMode: PrintMode,
	elementColor: 'color' | 'greyscale' = 'color'
): boolean {
	return printMode === 'all_greyscale' || elementColor === 'greyscale';
}
