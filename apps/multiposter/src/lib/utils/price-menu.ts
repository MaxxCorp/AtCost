import { getLocale } from "#lib/paraglide/runtime.js";

/**
 * Shared helpers for customer-facing price lists (event view dialog and the printable price menu).
 * Only guest-relevant data is handled here: names, descriptions, portion sizes and final prices.
 */

export interface PriceMenuItem {
    id?: string;
    name: string;
    description?: string | null;
    portionAmount?: number | null;
    unit?: string | null;
    unitPrice?: number | null;
    sortOrder?: number | null;
    tags?: any[];
}

export interface PriceMenuList {
    id?: string;
    name: string;
    description?: string | null;
    items?: PriceMenuItem[];
}

export interface PriceMenuSection {
    id: string;
    /** `null` when the list should be rendered without a section heading */
    name: string | null;
    items: PriceMenuItem[];
}

export interface PriceMenuSponsor {
    id: string;
    name: string;
    logoUrl: string;
}

export type PriceMenuPaperSize = "A5" | "A4" | "A3";

export interface PriceMenuSettings {
    paperSize: PriceMenuPaperSize;
    columns: 1 | 2 | 3;
    textScale: "compact" | "standard" | "large";
    accent: string;
    title: string;
    subtitle: string;
    showEventIntro: boolean;
    showDateTime: boolean;
    showLocation: boolean;
    showDescription: boolean;
    showSponsors: boolean;
    sponsorTitle: string;
    sponsorPosition: "header" | "footer";
    sponsors: PriceMenuSponsor[];
    /** Price lists the user explicitly unticked (new associations are visible by default) */
    hiddenPriceIds: string[];
    groupBySection: boolean;
    showItemDescriptions: boolean;
    showPortions: boolean;
    showVatNote: boolean;
    vatNote: string;
    footerNote: string;
    showSaleTallies: boolean;
    showStatistics: boolean;
}

export const PRICE_MENU_ACCENTS = ["#1f2937", "#047857", "#b45309", "#4338ca", "#be123c"] as const;

/** Paper dimensions and print margin in mm, plus a base font scale per format. */
export const PRICE_MENU_PAPER: Record<PriceMenuPaperSize, { width: number; height: number; margin: number; fontScale: number }> = {
    A5: { width: 148, height: 210, margin: 9, fontScale: 0.85 },
    A4: { width: 210, height: 297, margin: 12, fontScale: 1 },
    A3: { width: 297, height: 420, margin: 15, fontScale: 1.4 },
};

export const PRICE_MENU_TEXT_SCALE: Record<PriceMenuSettings["textScale"], number> = {
    compact: 0.88,
    standard: 1,
    large: 1.18,
};

export function defaultPriceMenuSettings(vatNote: string): PriceMenuSettings {
    return {
        paperSize: "A4",
        columns: 1,
        textScale: "standard",
        accent: PRICE_MENU_ACCENTS[0],
        title: "",
        subtitle: "",
        showEventIntro: true,
        showDateTime: true,
        showLocation: true,
        showDescription: false,
        showSponsors: false,
        sponsorTitle: "",
        sponsorPosition: "footer",
        sponsors: [],
        hiddenPriceIds: [],
        groupBySection: true,
        showItemDescriptions: true,
        showPortions: true,
        showVatNote: true,
        vatNote,
        footerNote: "",
        showSaleTallies: false,
        showStatistics: false,
    };
}

/** Final guest price of one price item (unit price multiplied by the portion size). */
export function getItemPrice(item: PriceMenuItem): number {
    const price = (Number(item.unitPrice) || 0) * (Number(item.portionAmount) || 1);
    return Math.round(price * 100) / 100;
}

export function formatEuro(value: number): string {
    return new Intl.NumberFormat(getLocale(), { style: "currency", currency: "EUR" }).format(value);
}

/** Portion label such as "0,5 l"; `null` for plain pieces that need no explanation. */
export function formatPortion(item: PriceMenuItem): string | null {
    const unit = (item.unit || "").trim();
    if (!unit || unit.toLowerCase() === "piece") return null;
    // Some edit paths store the amount together with the unit already (e.g. "0.5 l")
    if (/^\d/.test(unit)) return unit.replace(".", ",");
    const amount = Number(item.portionAmount) || 1;
    return `${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 3 }).format(amount)} ${unit}`;
}

function primaryTag(item: PriceMenuItem): { id: string; name: string } | null {
    for (const raw of item.tags || []) {
        const tag = raw?.tag || raw;
        if (tag?.name) return { id: String(tag.id || tag.name.toLowerCase()), name: tag.name };
    }
    return null;
}

function compareItems(a: PriceMenuItem, b: PriceMenuItem): number {
    return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || a.name.localeCompare(b.name);
}

/**
 * Splits the items of a price list into sections by their primary tag.
 * Untagged items end up in a trailing section named `otherLabel`. If there is nothing to
 * distinguish (grouping disabled or only untagged items), a single heading-less section is returned.
 */
export function groupItemsBySection(
    items: PriceMenuItem[] = [],
    otherLabel: string,
    grouped = true,
): PriceMenuSection[] {
    const sorted = [...items].sort(compareItems);
    if (!grouped) return sorted.length ? [{ id: "__all__", name: null, items: sorted }] : [];

    const sections = new Map<string, PriceMenuSection>();
    const other: PriceMenuSection = { id: "__other__", name: otherLabel, items: [] };

    for (const item of sorted) {
        const tag = primaryTag(item);
        if (!tag) {
            other.items.push(item);
            continue;
        }
        const section = sections.get(tag.id) ?? { id: tag.id, name: tag.name, items: [] };
        section.items.push(item);
        sections.set(tag.id, section);
    }

    const result = [...sections.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    if (other.items.length > 0) {
        if (result.length === 0) other.name = null;
        result.push(other);
    }
    return result;
}
