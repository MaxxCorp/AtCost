export type PrintMode =
    | 'all_color'
    | 'greyscale_content'
    | 'omit_ci'
    | 'ci_only'
    | 'all_greyscale';

export type CiBgStyle = 'solid' | 'brick' | 'texture' | 'custom_image';

export type ElementPrintBehavior = 'print' | 'reserve_space' | 'omit';
export type ElementPrintColor = 'color' | 'greyscale';

export interface ElementPrintConfig {
    enabled: boolean;
    printBehavior: ElementPrintBehavior;
    printColor: ElementPrintColor;
}

export interface KioskElementSettings {
    ciTop: ElementPrintConfig;
    ciBottom: ElementPrintConfig;
    header: ElementPrintConfig;
    events: ElementPrintConfig;
    heroImages: ElementPrintConfig;
    qrCodes: ElementPrintConfig;
    sponsors: ElementPrintConfig;
    locationDetails: ElementPrintConfig;
    openingHours: ElementPrintConfig;
    customSections: ElementPrintConfig;
    foldGuides: ElementPrintConfig;
}

export const DEFAULT_ELEMENT_SETTINGS: KioskElementSettings = {
    ciTop: { enabled: true, printBehavior: 'print', printColor: 'color' },
    ciBottom: { enabled: true, printBehavior: 'print', printColor: 'color' },
    header: { enabled: true, printBehavior: 'print', printColor: 'color' },
    events: { enabled: true, printBehavior: 'print', printColor: 'color' },
    heroImages: { enabled: true, printBehavior: 'print', printColor: 'color' },
    qrCodes: { enabled: true, printBehavior: 'print', printColor: 'color' },
    sponsors: { enabled: true, printBehavior: 'print', printColor: 'color' },
    locationDetails: { enabled: true, printBehavior: 'print', printColor: 'color' },
    openingHours: { enabled: true, printBehavior: 'print', printColor: 'color' },
    customSections: { enabled: true, printBehavior: 'print', printColor: 'color' },
    foldGuides: { enabled: true, printBehavior: 'print', printColor: 'color' }
};

export function getElementPrintClasses(
    config?: ElementPrintConfig,
    previewGreyscaleOnScreen = false
): string {
    if (!config) return '';
    if (config.enabled === false) return 'hidden';
    const classes: string[] = [];

    // Print behavior:
    if (config.printBehavior === 'reserve_space') {
        classes.push('print:invisible');
    } else if (config.printBehavior === 'omit') {
        classes.push('print:hidden');
    }

    // Print color:
    if (config.printColor === 'greyscale') {
        classes.push('print:grayscale');
        if (previewGreyscaleOnScreen) {
            classes.push('grayscale');
        }
    }

    return classes.join(' ');
}

export function applyQuickPrintPreset(
    settings: KioskElementSettings,
    presetKey: 'all_color' | 'letterhead_ci' | 'greyscale_content' | 'all_greyscale' | 'ci_only'
): KioskElementSettings {
    const next: KioskElementSettings = JSON.parse(JSON.stringify(settings));

    switch (presetKey) {
        case 'all_color':
            for (const key of Object.keys(next) as (keyof KioskElementSettings)[]) {
                next[key].printBehavior = 'print';
                next[key].printColor = 'color';
            }
            break;
        case 'letterhead_ci':
            for (const key of Object.keys(next) as (keyof KioskElementSettings)[]) {
                next[key].printBehavior = 'print';
                next[key].printColor = 'color';
            }
            next.ciTop.printBehavior = 'reserve_space';
            next.ciBottom.printBehavior = 'reserve_space';
            break;
        case 'greyscale_content':
            for (const key of Object.keys(next) as (keyof KioskElementSettings)[]) {
                next[key].printBehavior = 'print';
                next[key].printColor = 'greyscale';
            }
            next.ciTop.printColor = 'color';
            next.ciBottom.printColor = 'color';
            break;
        case 'all_greyscale':
            for (const key of Object.keys(next) as (keyof KioskElementSettings)[]) {
                next[key].printBehavior = 'print';
                next[key].printColor = 'greyscale';
            }
            break;
        case 'ci_only':
            for (const key of Object.keys(next) as (keyof KioskElementSettings)[]) {
                next[key].printBehavior = 'reserve_space';
                next[key].printColor = 'color';
            }
            next.ciTop.printBehavior = 'print';
            next.ciBottom.printBehavior = 'print';
            break;
    }
    return next;
}

export interface CiSponsorItem {
    id: string;
    name: string;
    logoUrl: string;
    placement?: 'center' | 'above_address';
    grayscaleInPrint?: boolean;
    hideInPrint?: boolean;
}

export interface CiPreset {
    id: string;
    name: string;
    lineColor: string;
    bgColor: string;
    textColor: string;
    bgStyle: CiBgStyle;
    bgImageUrl?: string;
    locationLogoUrl?: string;
    orgLogoUrl?: string;
    showLocationLogo: boolean;
    showOrgLogo: boolean;
    topHeightMm: number;
    topSlopeMm: number;
    bottomHeightMm: number;
    bottomSlopeMm: number;
    inclusivityText?: string;
    showInclusivityIcon?: boolean;
    customAddress?: string;
    partnerLogoUrl?: string;
    sponsors?: CiSponsorItem[];
}

export interface CiPrintOptions {
    printMode: PrintMode;
    hideQrInPrint: boolean;
    hideImagesInPrint: boolean;
    hideSponsorsInPrint: boolean;
    hideFoldGuidesInPrint: boolean;
    grayscaleImagesInPrint: boolean;
    previewGreyscaleOnScreen: boolean;
}

export const DEFAULT_PRINT_OPTIONS: CiPrintOptions = {
    printMode: 'all_color',
    hideQrInPrint: false,
    hideImagesInPrint: false,
    hideSponsorsInPrint: false,
    hideFoldGuidesInPrint: false,
    grayscaleImagesInPrint: false,
    previewGreyscaleOnScreen: false
};

export const DEFAULT_PRESETS: CiPreset[] = [
    {
        id: 'suedspitze_standard',
        name: 'Bürgerhaus Südspitze (Standard)',
        lineColor: '#b83a38',
        bgColor: '#FAF6E8',
        textColor: '#b83a38',
        bgStyle: 'solid',
        locationLogoUrl: '/logos/location-suedspitze.jpg',
        orgLogoUrl: '/logos/org-ball.png',
        showLocationLogo: true,
        showOrgLogo: true,
        topHeightMm: 38,
        topSlopeMm: 24,
        bottomHeightMm: 36,
        bottomSlopeMm: 22,
        inclusivityText: 'Barrierefreies Haus',
        showInclusivityIcon: false,
        customAddress: '',
        partnerLogoUrl: '',
        sponsors: []
    },
    {
        id: 'stz_biesdorf',
        name: 'STZ Biesdorf',
        lineColor: '#8b2626',
        bgColor: '#f7e8db',
        textColor: '#8b2626',
        bgStyle: 'brick',
        locationLogoUrl: '/logos/location-suedspitze.jpg',
        orgLogoUrl: '/logos/org-ball.png',
        showLocationLogo: true,
        showOrgLogo: true,
        topHeightMm: 42,
        topSlopeMm: 26,
        bottomHeightMm: 38,
        bottomSlopeMm: 24,
        inclusivityText: 'Barrierefreies Haus',
        showInclusivityIcon: false,
        customAddress: '',
        partnerLogoUrl: '',
        sponsors: []
    }
];
