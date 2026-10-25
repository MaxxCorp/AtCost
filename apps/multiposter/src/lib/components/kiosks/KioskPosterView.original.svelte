<script lang="ts">
    import { onMount, tick } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { type Event, type Announcement, formatOpeningHours, type OpeningHoursData } from "@ac/validations";
    import {
        Printer,
        Sparkles,
        RotateCcw,
        MapPin,
        Calendar,
        CalendarDays,
        Clock,
        Phone,
        Mail,
        FileText,
        ZoomIn,
        ZoomOut,
        SlidersHorizontal,
        ChevronDown,
        QrCode,
        Ticket,
        Settings2,
        X,
        Plus,
        Trash2,
        Check,
        AlertCircle,
        Image as ImageIcon,
        Layers,
        Upload,
        CheckCircle2,
        Globe,
        Lock,
        Tag,
        RefreshCw,
        User,
        Users,
        UserCheck,
        FileImage,
        LayoutTemplate
    } from "@lucide/svelte";
    import { uploadMedia } from "../../../routes/cms/media/create.remote";
    import { formatRecurrenceText } from "#lib/utils/format-recurrence.js";
    import { formatTicketPrice, isEventFree } from "#lib/utils/format-ticket-price.js";
    import { getEventRooms } from "#lib/utils/format-rooms.js";
    import { isSeriesItem, isNonSeriesEvent, getSeriesRootId } from "#lib/utils/event-series.js";
    import { isMultiDayEvent, getEventDurationDays, getEventDateParts } from "#lib/utils/format-event-date.js";
    import * as m from "#lib/paraglide/messages.js";
    import { toast } from "svelte-sonner";
    import { browser } from '$app/env';
    import {
        type SeriesInstanceInfo,
        type EnrichedEvent,
        type EnrichedAnnouncement,
        type VisibleComponentsState,
        defaultVisibleComponents,
        getAllEventContacts,
        getContactName,
        getContactRoles,
        getContactEmail,
        getContactPhone,
        compressSeriesEvents,
        formatDateDay,
        formatDateMonth,
        formatDateWeekday,
        formatTimeRange,
        formatFullDate,
        formatPosterProgrammeHeadline
    } from "#lib/utils/kiosk-flat-helpers.js";

    interface LocationContact {
        name: string;
        email?: string;
        phone?: string;
        qrCodePath?: string;
        qrCodeDataUrl?: string;
        role?: string | null;
    }

    interface LocationInfo {
        id: string;
        name: string;
        street?: string | null;
        houseNumber?: string | null;
        addressSuffix?: string | null;
        zip?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
        roomId?: string | null;
        capacity?: string | null;
        inclusivitySupport?: string | null;
        openingHours?: OpeningHoursData | string | null;
        heroImage?: string | null;
        description?: string | null;
        contact?: LocationContact | null;
    }

    export interface CustomSectionItem {
        id: string;
        title: string;
        content: string;
        imageUrl?: string;
        slot: "banner" | "grid_top" | "grid_bottom" | "footer";
        accentColor?: "gold" | "red" | "slate" | "emerald";
        enabled: boolean;
    }

    interface SponsorItem {
        id: string;
        name: string;
        logoUrl: string;
    }

    type PosterDisplayItem = EnrichedEvent | EnrichedAnnouncement;

    let { items = [], kiosk }: {
        items: (Event | Announcement)[],
        kiosk: {
            id?: string;
            name?: string;
            description?: string;
            locations?: LocationInfo[];
            rangeMode?: string;
            startDate?: string | Date | null;
            endDate?: string | Date | null;
            showEventQrCodes?: boolean;
        }
    } = $props();

    // --- State: View & Paper configuration ---
    let paperSize = $state<"A4" | "A3">("A4");
    let columns = $state<"auto" | "1" | "2" | "3">("auto");
    let density = $state<"compact" | "standard" | "relaxed">("standard");
    let zoomLevel = $state<number>(0.85);

    // --- State: Location selection ---
    let posterLocations = $derived.by<LocationInfo[]>(() => {
        if (kiosk.locations && kiosk.locations.length > 0) {
            return kiosk.locations;
        }
        return [{
            id: "default",
            name: kiosk.name || "Standort / Location",
            street: null,
            houseNumber: null,
            addressSuffix: null,
            zip: null,
            city: null,
            state: null,
            country: null,
            roomId: null,
            capacity: null,
            heroImage: null,
            description: kiosk.description || null,
            contact: null
        }];
    });

    let activeLocationId = $state<string>("");

    // Initialize activeLocationId on load
    $effect(() => {
        if (!activeLocationId && posterLocations.length > 0) {
            activeLocationId = posterLocations[0].id;
        }
    });

    let currentLocation = $derived(
        posterLocations.find(l => l.id === activeLocationId) || posterLocations[0]
    );

    // --- State: Logos & Sponsors ---
    let showLocationLogo = $state<boolean>(true);
    let locationLogoPosition = $state<"left" | "right">("right");
    let customLocationLogoUrl = $state<string>("");
    let locationLogoSizeMode = $state<"match_block" | "manual">("match_block");
    let locationLogoHeight = $state<number>(110); // in pixels (when manual)
    let locationLogoMaxWidth = $state<number>(340); // in pixels
    let locationLogoOffsetY = $state<number>(0); // vertical offset in pixels (-40 to +40)
    let locationBlockHeight = $state<number>(110); // clientHeight of location info block

    let effectiveLogoHeight = $derived(
        locationLogoSizeMode === "match_block" ? (locationBlockHeight || 110) : locationLogoHeight
    );

    let effectiveLocationLogo = $derived.by(() => {
        const logo = customLocationLogoUrl.trim() || currentLocation?.heroImage || "";
        if (logo.includes("inkscape-gs-2254515253") || (logo.includes("data:image/svg+xml") && logo.includes("matrix(1.3333333"))) {
            try {
                if (logo.includes("data:image/svg+xml;utf8,")) {
                    const rawSvg = decodeURIComponent(logo.replace("data:image/svg+xml;utf8,", ""));
                    const trimmed = normalizeSvgContent(rawSvg);
                    return "data:image/svg+xml;utf8," + encodeURIComponent(trimmed);
                } else if (logo.includes("data:image/svg+xml;base64,")) {
                    const rawSvg = atob(logo.replace("data:image/svg+xml;base64,", ""));
                    const trimmed = normalizeSvgContent(rawSvg);
                    return "data:image/svg+xml;utf8," + encodeURIComponent(trimmed);
                }
            } catch (e) {
                console.error("Auto-crop on effectiveLocationLogo error", e);
            }
        }
        return logo;
    });

    let showSponsors = $state<boolean>(true);
    let sponsorSectionTitle = $state<string>("Gefördert durch / Partner");
    let sponsorPosition = $state<"footer" | "header">("footer");
    let sponsors = $state<SponsorItem[]>([
        {
            id: "sample-1",
            name: "Bezirkskulturfonds",
            logoUrl: ""
        }
    ]);

    // --- State: Letterhead Mode ---
    let isLetterheadMode = $state<boolean>(false);
    let letterheadBlankHeight = $state<number>(38); // mm
    let letterheadMonochrome = $state<boolean>(false);
    let letterheadShowLogo = $state<boolean>(true);

    // --- State: Series Mode & Content Selection ---
    let compressSeries = $state<boolean>(true);
    let descriptionStyle = $state<"short" | "full" | "none">("short");
    let showTimes = $state<boolean>(true);
    let showLocationQr = $state<boolean>(true);
    let customProgrammeTitle = $state<string>("");
    let customProgrammeSubtitle = $state<string>("");

    // Visible Components (Ported from Flat List)
    let visibleComponents = $state<VisibleComponentsState>({
        ...defaultVisibleComponents
    });
    let isComponentsMenuOpen = $state<boolean>(false);

    function toggleComponent(key: keyof VisibleComponentsState) {
        visibleComponents[key] = !visibleComponents[key];
        savePrefs();
    }

    // --- State: Custom Sections / Content Slot Editor ---
    let customSections = $state<CustomSectionItem[]>([]);

    function addCustomSection(slot: CustomSectionItem["slot"] = "banner") {
        customSections = [
            ...customSections,
            {
                id: `sec-${Date.now()}`,
                title: "Neuer Hinweis / Abschnitt",
                content: "",
                imageUrl: "",
                slot,
                accentColor: "gold",
                enabled: true
            }
        ];
        savePrefs();
    }

    function removeCustomSection(id: string) {
        customSections = customSections.filter(s => s.id !== id);
        savePrefs();
    }

    function addOpeningHoursSection() {
        if (!currentLocation?.openingHours) return;
        const formatted = formatOpeningHours(currentLocation.openingHours);
        customSections = [
            ...customSections,
            {
                id: `sec-hours-${Date.now()}`,
                title: "Öffnungszeiten & Beratung",
                content: `${formatted}${currentLocation.inclusivitySupport ? '\n♿ ' + currentLocation.inclusivitySupport : ''}`,
                slot: "banner",
                accentColor: "gold",
                enabled: true
            }
        ];
        savePrefs();
        toast.success("Öffnungszeiten als Banner hinzugefügt");
    }

    function selectAllComponents() {
        visibleComponents = {
            contacts: true,
            participants: true,
            publicStatus: true,
            descriptions: true,
            qrCodes: true,
            ticketPrice: true,
            rooms: true,
            tags: true,
            internalNotes: true,
            heroImage: true,
            openingHours: true,
        };
        savePrefs();
    }

    function resetComponentsToDefault() {
        visibleComponents = { ...defaultVisibleComponents };
        savePrefs();
    }

    // Settings Modal
    let isSettingsOpen = $state<boolean>(false);

    // Measurement & Overflow warning
    let posterContentElement = $state<HTMLElement | null>(null);
    let isOverflowing = $state<boolean>(false);
    let overflowPercent = $state<number>(0);

    // --- LocalStorage persistence ---
    const storageKey = $derived(`kiosk_poster_settings_${kiosk?.id || 'default'}`);

    onMount(() => {
        if (!browser) return;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const prefs = JSON.parse(raw);
                if (prefs.paperSize !== undefined) paperSize = prefs.paperSize;
                if (prefs.columns !== undefined) columns = prefs.columns;
                if (prefs.density !== undefined) density = prefs.density;
                if (prefs.showLocationLogo !== undefined) showLocationLogo = prefs.showLocationLogo;
                if (prefs.locationLogoPosition !== undefined) locationLogoPosition = prefs.locationLogoPosition;
                if (prefs.customLocationLogoUrl !== undefined) customLocationLogoUrl = prefs.customLocationLogoUrl;
                if (prefs.locationLogoSizeMode !== undefined) locationLogoSizeMode = prefs.locationLogoSizeMode;
                if (prefs.locationLogoHeight !== undefined) locationLogoHeight = prefs.locationLogoHeight;
                if (prefs.locationLogoMaxWidth !== undefined) locationLogoMaxWidth = prefs.locationLogoMaxWidth;
                if (prefs.locationLogoOffsetY !== undefined) locationLogoOffsetY = prefs.locationLogoOffsetY;
                if (prefs.showSponsors !== undefined) showSponsors = prefs.showSponsors;
                if (prefs.sponsorSectionTitle !== undefined) sponsorSectionTitle = prefs.sponsorSectionTitle;
                if (prefs.sponsorPosition !== undefined) sponsorPosition = prefs.sponsorPosition;
                if (Array.isArray(prefs.sponsors)) sponsors = prefs.sponsors;
                if (prefs.isLetterheadMode !== undefined) isLetterheadMode = prefs.isLetterheadMode;
                if (prefs.letterheadBlankHeight !== undefined) letterheadBlankHeight = prefs.letterheadBlankHeight;
                if (prefs.letterheadMonochrome !== undefined) letterheadMonochrome = prefs.letterheadMonochrome;
                if (prefs.letterheadShowLogo !== undefined) letterheadShowLogo = prefs.letterheadShowLogo;
                if (prefs.descriptionStyle !== undefined) descriptionStyle = prefs.descriptionStyle;
                if (prefs.showTimes !== undefined) showTimes = prefs.showTimes;
                if (prefs.showLocationQr !== undefined) showLocationQr = prefs.showLocationQr;
                if (prefs.compressSeries !== undefined) compressSeries = prefs.compressSeries;
                if (prefs.customProgrammeTitle !== undefined) customProgrammeTitle = prefs.customProgrammeTitle;
                if (prefs.customProgrammeSubtitle !== undefined) customProgrammeSubtitle = prefs.customProgrammeSubtitle;
                if (prefs.activeLocationId && posterLocations.some(l => l.id === prefs.activeLocationId)) {
                    activeLocationId = prefs.activeLocationId;
                }
                if (prefs.visibleComponents && typeof prefs.visibleComponents === "object") {
                    visibleComponents = {
                        ...visibleComponents,
                        ...prefs.visibleComponents
                    };
                }
                if (Array.isArray(prefs.customSections)) {
                    customSections = prefs.customSections;
                }
            }
        } catch (e) {
            console.error("Failed to load poster preferences", e);
        }
    });

    function savePrefs() {
        if (!browser) return;
        try {
            const prefs = {
                paperSize,
                columns,
                density,
                showLocationLogo,
                locationLogoPosition,
                customLocationLogoUrl,
                locationLogoSizeMode,
                locationLogoHeight,
                locationLogoMaxWidth,
                locationLogoOffsetY,
                showSponsors,
                sponsorSectionTitle,
                sponsorPosition,
                sponsors,
                isLetterheadMode,
                letterheadBlankHeight,
                letterheadMonochrome,
                letterheadShowLogo,
                descriptionStyle,
                showTimes,
                showLocationQr,
                compressSeries,
                customProgrammeTitle,
                customProgrammeSubtitle,
                activeLocationId,
                visibleComponents,
                customSections
            };
            localStorage.setItem(storageKey, JSON.stringify(prefs));
        } catch (e) {
            console.error("Failed to save poster preferences", e);
        }
    }

    // Auto-save on relevant changes
    $effect(() => {
        const _ = [
            paperSize, columns, density, showLocationLogo, locationLogoPosition,
            customLocationLogoUrl, locationLogoSizeMode, locationLogoHeight, locationLogoMaxWidth,
            locationLogoOffsetY, showSponsors, sponsorSectionTitle,
            sponsorPosition, sponsors, isLetterheadMode, letterheadBlankHeight,
            letterheadMonochrome, letterheadShowLogo, descriptionStyle, showTimes,
            showLocationQr, compressSeries, customProgrammeTitle, customProgrammeSubtitle,
            activeLocationId, visibleComponents.contacts, visibleComponents.participants,
            visibleComponents.publicStatus, visibleComponents.descriptions, visibleComponents.qrCodes,
            visibleComponents.ticketPrice, visibleComponents.rooms, visibleComponents.tags,
            visibleComponents.internalNotes, visibleComponents.heroImage, visibleComponents.openingHours,
            customSections
        ];
        savePrefs();
    });

    // --- Helpers: Location matching ---
    function getItemLocationIds(item: Event | Announcement): SvelteSet<string> {
        const ids = new SvelteSet<string>();
        if ("locations" in item && Array.isArray((item as any).locations)) {
            for (const l of (item as any).locations) {
                if (typeof l === "string") ids.add(l);
                else if (l?.id) ids.add(l.id);
                else if (l?.locationId) ids.add(l.locationId);
                else if (l?.location?.id) ids.add(l.location.id);
            }
        }
        if ("locationIds" in item && Array.isArray((item as any).locationIds)) {
            for (const id of (item as any).locationIds) {
                if (id) ids.add(id);
            }
        }
        if ("resources" in item && Array.isArray((item as any).resources)) {
            for (const r of (item as any).resources) {
                if (r?.locationId) ids.add(r.locationId);
                else if (r?.resource?.locationId) ids.add(r.resource.locationId);
                else if (r?.location?.id) ids.add(r.location.id);
            }
        }
        return ids;
    }

    function itemBelongsToLocation(item: Event | Announcement, locId: string): boolean {
        if (!locId || locId === "default") return true;
        const itemLocIds = getItemLocationIds(item);
        if (itemLocIds.size > 0) {
            return itemLocIds.has(locId);
        }
        // General items belong if kiosk has only 1 location
        return posterLocations.length <= 1;
    }

    // Filter items for current single location
    let locationFilteredItems = $derived.by<(Event | Announcement)[]>(() => {
        const locId = currentLocation?.id || "default";
        return items.filter(item => itemBelongsToLocation(item, locId));
    });

    // Processed final display items
    let displayItems = $derived.by<PosterDisplayItem[]>(() => {
        const rawEvents = locationFilteredItems.filter(i => "startDateTime" in i) as EnrichedEvent[];
        const rawAnnouncements = locationFilteredItems.filter(i => !("startDateTime" in i)) as EnrichedAnnouncement[];
        const processedEvents = compressSeries ? compressSeriesEvents(rawEvents, "none") : rawEvents;

        const combined: PosterDisplayItem[] = [...processedEvents, ...rawAnnouncements];
        combined.sort((a, b) => {
            const timeA = "startDateTime" in a && a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
            const timeB = "startDateTime" in b && b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
            return timeA - timeB;
        });
        return combined;
    });

    // Auto Column determination
    let effectiveColumns = $derived.by<number>(() => {
        if (columns === "1") return 1;
        if (columns === "2") return 2;
        if (columns === "3") return 3;
        // Auto mode based on event count & paper size
        const count = displayItems.length;
        if (paperSize === "A3") {
            if (count > 25) return 3;
            if (count > 10) return 2;
            return 1;
        } else {
            // A4
            if (count > 18) return 2;
            if (count > 9) return 2;
            return 1;
        }
    });

    // In 1- and 2-column mode the QR code/hero floats top-right and content wraps around/beneath it
    let wrapAroundQr = $derived(effectiveColumns <= 2);

    // Month & Date Range derivation for Programme Title
    let programmeMonthTitle = $derived.by<string>(() => {
        return formatPosterProgrammeHeadline(kiosk, displayItems, customProgrammeTitle);
    });

    let programmeLocationSubtitle = $derived.by<string>(() => {
        if (customProgrammeSubtitle.trim()) return customProgrammeSubtitle.trim();
        const loc = currentLocation;
        if (!loc) return "";
        const parts = [
            loc.street && loc.houseNumber ? `${loc.street} ${loc.houseNumber}` : loc.street,
            loc.zip && loc.city ? `${loc.zip} ${loc.city}` : loc.city
        ].filter(Boolean);
        return parts.join(", ");
    });

    // Check overflow
    function checkPageOverflow() {
        if (!posterContentElement || !browser) return;
        const targetMaxHeightMm = paperSize === "A4" ? 297 : 420;
        // 1mm ~ 3.7795275591 px at 96 DPI
        const pxPerMm = 3.779528;
        const targetMaxPx = targetMaxHeightMm * pxPerMm;
        const currentPx = posterContentElement.scrollHeight;

        if (currentPx > targetMaxPx + 15) {
            isOverflowing = true;
            overflowPercent = Math.round(((currentPx - targetMaxPx) / targetMaxPx) * 100);
        } else {
            isOverflowing = false;
            overflowPercent = 0;
        }
    }

    $effect(() => {
        // Trigger check when items, density, columns, letterhead, or visible components change
        const _ = [
            displayItems.length, density, effectiveColumns, isLetterheadMode, paperSize,
            descriptionStyle, compressSeries, visibleComponents.descriptions,
            visibleComponents.contacts, visibleComponents.participants, visibleComponents.heroImage,
            visibleComponents.internalNotes, visibleComponents.rooms, visibleComponents.ticketPrice
        ];
        // Wait for DOM update
        setTimeout(checkPageOverflow, 150);
    });

    // Auto-fit function
    function handleAutoFit() {
        if (displayItems.length > 20) {
            columns = "2";
            density = "compact";
            descriptionStyle = "short";
        } else if (displayItems.length > 12) {
            columns = "2";
            density = "compact";
            descriptionStyle = "short";
        } else {
            columns = "1";
            density = "compact";
        }
        toast.success(m.poster_auto_fit());
    }

    // Trigger Print
    async function triggerPrint() {
        if (!browser) return;
        const prevZoom = zoomLevel;
        zoomLevel = 1;
        await tick();
        window.print();
        setTimeout(() => {
            zoomLevel = prevZoom;
        }, 500);
    }

    // Sponsor Management
    function addSponsor() {
        sponsors = [
            ...sponsors,
            {
                id: `sponsor-${Date.now()}`,
                name: "Neuer Partner / Sponsor",
                logoUrl: ""
            }
        ];
    }

    function removeSponsor(id: string) {
        sponsors = sponsors.filter(s => s.id !== id);
    }

    function normalizeSvgContent(content: string): string {
        // Detect Inkscape PDF export matrix and clipPath (e.g. FH Logo)
        const matrixMatch = content.match(/transform="matrix\(([\d.]+),\s*0,\s*0,\s*(-?[\d.]+),\s*0,\s*([\d.]+)\)"/);
        const scaleMatch = content.match(/transform="scale\(([\d.]+)\)"/);
        const clipMatch = content.match(/clipPath[^>]*>\s*<path[^>]*d="M\s*0[, ]0\s*H\s*([\d.]+)\s*V\s*([\d.]+)\s*H\s*0\s*Z"/i);

        if (matrixMatch && clipMatch) {
            const sx = parseFloat(matrixMatch[1]);
            const sy = Math.abs(parseFloat(matrixMatch[2]));
            const ty = parseFloat(matrixMatch[3]);
            const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
            const clipW = parseFloat(clipMatch[1]);
            const clipH = parseFloat(clipMatch[2]);

            const realW = clipW * scale * sx;
            const realH = clipH * scale * sy;
            const realY = ty - realH;

            return content.replace(/<svg\b([^>]*?)>/s, (_, attrs) => {
                const cleaned = attrs
                    .replace(/\bwidth="[^"]*"/g, '')
                    .replace(/\bheight="[^"]*"/g, '')
                    .replace(/\bviewBox="[^"]*"/g, '')
                    .trim();
                return `<svg ${cleaned} width="${realW.toFixed(2)}" height="${realH.toFixed(2)}" viewBox="0 ${realY.toFixed(2)} ${realW.toFixed(2)} ${realH.toFixed(2)}">`;
            });
        }
        return content;
    }

    function autoCropCurrentLogo() {
        if (!customLocationLogoUrl) return;
        try {
            if (customLocationLogoUrl.includes("data:image/svg+xml;utf8,")) {
                const rawSvg = decodeURIComponent(customLocationLogoUrl.replace("data:image/svg+xml;utf8,", ""));
                const optimized = normalizeSvgContent(rawSvg);
                customLocationLogoUrl = "data:image/svg+xml;utf8," + encodeURIComponent(optimized);
                toast.success("SVG-Zuschnitt optimiert");
                savePrefs();
            } else if (customLocationLogoUrl.includes("data:image/svg+xml;base64,")) {
                const rawSvg = atob(customLocationLogoUrl.replace("data:image/svg+xml;base64,", ""));
                const optimized = normalizeSvgContent(rawSvg);
                customLocationLogoUrl = "data:image/svg+xml;utf8," + encodeURIComponent(optimized);
                toast.success("SVG-Zuschnitt optimiert");
                savePrefs();
            } else {
                toast.info("Tipp: Nutzen Sie 'Datei hochladen' für automatisches Zuschneiden");
            }
        } catch (e) {
            console.error(e);
            toast.error("Konnte SVG nicht automatisch zuschneiden");
        }
    }

    // Image Upload helper for Sponsor, Location Logo, or Custom Section
    async function handleImageUpload(inputOrEvent: globalThis.Event | File, target: "location" | { sponsorId: string } | { sectionId: string }) {
        const file = inputOrEvent instanceof File
            ? inputOrEvent
            : ((inputOrEvent.target as HTMLInputElement)?.files?.[0]);
        if (!file) return;
        if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".svg")) {
            toast.error("Nur Bilddateien (PNG, JPG, SVG, WebP) erlaubt");
            return;
        }

        const isSvg = file.name.toLowerCase().endsWith(".svg") || file.type.includes("svg");

        try {
            if (isSvg) {
                const reader = new FileReader();
                reader.readAsText(file);
                reader.onload = async () => {
                    let svgText = reader.result as string;
                    svgText = normalizeSvgContent(svgText);
                    const dataUrl = "data:image/svg+xml;utf8," + encodeURIComponent(svgText);
                    if (target === "location") {
                        customLocationLogoUrl = dataUrl;
                    } else if ("sponsorId" in target) {
                        const s = sponsors.find(sp => sp.id === target.sponsorId);
                        if (s) s.logoUrl = dataUrl;
                    } else if ("sectionId" in target) {
                        const sec = customSections.find(sc => sc.id === target.sectionId);
                        if (sec) sec.imageUrl = dataUrl;
                    }
                    toast.success("Bild optimiert und hinzugefügt");
                    savePrefs();
                };
            } else {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = async () => {
                    const base64 = reader.result as string;
                    try {
                        const res = await uploadMedia({
                            filename: file.name,
                            contentType: file.type,
                            content: base64
                        });
                        const url = res.success && res.urls?.default ? res.urls.default : base64;
                        if (target === "location") {
                            customLocationLogoUrl = url;
                        } else if ("sponsorId" in target) {
                            const s = sponsors.find(sp => sp.id === target.sponsorId);
                            if (s) s.logoUrl = url;
                        } else if ("sectionId" in target) {
                            const sec = customSections.find(sc => sc.id === target.sectionId);
                            if (sec) sec.imageUrl = url;
                        }
                        toast.success("Bild erfolgreich hinzugefügt");
                    } catch {
                        if (target === "location") {
                            customLocationLogoUrl = base64;
                        } else if ("sponsorId" in target) {
                            const s = sponsors.find(sp => sp.id === target.sponsorId);
                            if (s) s.logoUrl = base64;
                        } else if ("sectionId" in target) {
                            const sec = customSections.find(sc => sc.id === target.sectionId);
                            if (sec) sec.imageUrl = base64;
                        }
                        toast.success("Bild gespeichert");
                    }
                    savePrefs();
                };
            }
        } catch (err) {
            console.error(err);
            toast.error("Upload fehlgeschlagen");
        }
    }
</script>

<svelte:head>
    <style>
        @media print {
            @page {
                size: {paperSize === 'A3' ? '297mm 420mm' : '210mm 297mm'};
                margin: 0 !important;
            }
            :global(html),
            :global(body) {
                width: {paperSize === 'A3' ? '297mm' : '210mm'} !important;
                max-width: {paperSize === 'A3' ? '297mm' : '210mm'} !important;
                height: {paperSize === 'A3' ? '420mm' : '297mm'} !important;
                max-height: {paperSize === 'A3' ? '420mm' : '297mm'} !important;
                margin: 0 !important;
                padding: 0 !important;
            }
        }
    </style>
</svelte:head>

{#snippet rightVisuals(item: PosterDisplayItem, evt: EnrichedEvent, isEvt: boolean)}
    <!-- Hero Image -->
    {#if visibleComponents.heroImage && (item as any).heroImage}
        <div class="overflow-hidden rounded-md border border-slate-200 bg-slate-100 shrink-0">
            <img
                src={(item as any).heroImage}
                alt={evt.summary || "Event"}
                class="{density === 'compact' ? 'w-14 h-10' : 'w-20 h-14'} object-cover"
                loading="lazy"
            />
        </div>
    {/if}

    <!-- Scannable Event QR Code -->
    {#if visibleComponents.qrCodes && isEvt && (evt.qrCodeDataUrl || evt.qrCodePath)}
        <div class="flex flex-col items-center justify-center p-1 bg-white border border-slate-200 rounded shrink-0 shadow-2xs">
            <img
                src={evt.qrCodeDataUrl || evt.qrCodePath}
                alt="QR"
                class="{density === 'compact' ? 'w-16 h-16' : density === 'relaxed' ? 'w-22 h-22' : 'w-18 h-18'} object-contain"
            />
        </div>
    {/if}
{/snippet}

{#snippet customSectionCard(sec: CustomSectionItem, slotContext: string)}
    {@const colorBorder = sec.accentColor === 'red' ? 'border-l-red-600' : sec.accentColor === 'gold' ? 'border-l-[#fbc707]' : sec.accentColor === 'emerald' ? 'border-l-emerald-600' : 'border-l-slate-400'}
    {@const colorBg = sec.accentColor === 'red' ? 'bg-red-50/25' : sec.accentColor === 'gold' ? 'bg-amber-50/25' : sec.accentColor === 'emerald' ? 'bg-emerald-50/25' : 'bg-slate-50/80'}
    <div class="custom-section-item p-2.5 rounded-r-md border border-slate-200/60 border-l-[3.5px] {colorBorder} {colorBg} break-inside-avoid {slotContext === 'banner' ? 'mb-2' : 'mb-3.5'}">
        <div class="flex items-start gap-3">
            {#if sec.imageUrl}
                <img src={sec.imageUrl} alt={sec.title} class="max-h-16 max-w-[120px] object-contain rounded shrink-0 bg-white p-1 border border-slate-200" />
            {/if}
            <div class="flex-1 min-w-0">
                {#if sec.title}
                    <h4 class="font-bold text-slate-900 text-xs sm:text-sm tracking-tight leading-snug mb-0.5">
                        {sec.title}
                    </h4>
                {/if}
                {#if sec.content}
                    <div class="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line rich-description">
                        {@html sec.content}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/snippet}

<!-- Screen Toolbar -->
<header class="print:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 py-2.5">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
        <!-- Left: Template identifier & Location Selector -->
        <div class="flex items-center gap-3">
            <a
                href="/kiosks/{kiosk?.id || ''}"
                class="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 font-medium transition-colors"
            >
                <Layers class="w-4 h-4 text-emerald-600" />
                <span class="font-bold text-slate-800 dark:text-slate-100">{m.poster_badge()}</span>
            </a>

            <!-- Location dropdown if multiple locations -->
            {#if posterLocations.length > 1}
                <div class="flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-700">
                    <MapPin class="w-3.5 h-3.5 text-slate-400" />
                    <select
                        aria-label="Standort auswählen"
                        bind:value={activeLocationId}
                        class="text-xs font-medium py-1 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-1 focus:ring-emerald-500"
                    >
                        {#each posterLocations as loc (loc.id)}
                            <option value={loc.id}>{loc.name}</option>
                        {/each}
                    </select>
                </div>
            {:else if currentLocation}
                <span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 pl-3 border-l border-slate-200 dark:border-slate-700">
                    <MapPin class="w-3.5 h-3.5 text-emerald-500" />
                    <strong class="text-slate-700 dark:text-slate-200">{currentLocation.name}</strong>
                </span>
            {/if}

            <!-- 1-Page Fit Status -->
            <div class="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium {isOverflowing ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'}">
                {#if isOverflowing}
                    <AlertCircle class="w-3 h-3 text-amber-600 animate-pulse" />
                    <span>{m.poster_overflow_warning()} (+{overflowPercent}%)</span>
                    <button
                        type="button"
                        onclick={handleAutoFit}
                        class="ml-1 px-1.5 py-0.2 bg-amber-600 hover:bg-amber-700 text-white text-[10px] rounded font-semibold transition"
                    >
                        Auto-Fit
                    </button>
                {:else}
                    <CheckCircle2 class="w-3 h-3 text-emerald-600" />
                    <span>{m.poster_single_page_fit()} ({paperSize})</span>
                {/if}
            </div>
        </div>

        <!-- Center: Quick Toggles (Paper, Columns, Density, Series Mode, Visible Components, Logos) -->
        <div class="flex items-center flex-wrap gap-2">
            <!-- Paper Size -->
            <div class="inline-flex rounded-md shadow-sm border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                <button
                    type="button"
                    onclick={() => (paperSize = "A4")}
                    class="px-2.5 py-1 text-xs font-semibold rounded transition {paperSize === 'A4' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
                >
                    A4
                </button>
                <button
                    type="button"
                    onclick={() => (paperSize = "A3")}
                    class="px-2.5 py-1 text-xs font-semibold rounded transition {paperSize === 'A3' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
                >
                    A3
                </button>
            </div>

            <!-- Columns Toggle -->
            <div class="inline-flex rounded-md shadow-sm border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                <button
                    type="button"
                    onclick={() => (columns = "auto")}
                    class="px-2 py-1 text-xs font-medium rounded transition {columns === 'auto' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                    title="Spalten automatisch ermitteln"
                >
                    Auto ({effectiveColumns})
                </button>
                <button
                    type="button"
                    onclick={() => (columns = "1")}
                    class="px-2 py-1 text-xs font-medium rounded transition {columns === '1' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                >
                    1 Sp.
                </button>
                <button
                    type="button"
                    onclick={() => (columns = "2")}
                    class="px-2 py-1 text-xs font-medium rounded transition {columns === '2' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                >
                    2 Sp.
                </button>
                <button
                    type="button"
                    onclick={() => (columns = "3")}
                    class="px-2 py-1 text-xs font-medium rounded transition {columns === '3' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                >
                    3 Sp.
                </button>
            </div>

            <!-- Density Toggle -->
            <div class="inline-flex rounded-md shadow-sm border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                <button
                    type="button"
                    onclick={() => (density = "compact")}
                    class="px-2 py-1 text-xs font-medium rounded transition {density === 'compact' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                    title="Kompakt"
                >
                    Kompakt
                </button>
                <button
                    type="button"
                    onclick={() => (density = "standard")}
                    class="px-2 py-1 text-xs font-medium rounded transition {density === 'standard' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                    title="Standard"
                >
                    Standard
                </button>
                <button
                    type="button"
                    onclick={() => (density = "relaxed")}
                    class="px-2 py-1 text-xs font-medium rounded transition {density === 'relaxed' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                    title="Großzügig"
                >
                    Großzügig
                </button>
            </div>

            <!-- Series Mode Toggle: Compacted vs Unrolled (Feature Ported from Flat List) -->
            <div class="inline-flex rounded-md shadow-sm border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                <button
                    type="button"
                    onclick={() => (compressSeries = true)}
                    class="px-2 py-1 text-xs font-medium rounded transition flex items-center gap-1 {compressSeries ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                    title={m.series_compacted_desc()}
                >
                    <RefreshCw class="w-3 h-3" />
                    <span>{m.series_compacted()}</span>
                </button>
                <button
                    type="button"
                    onclick={() => (compressSeries = false)}
                    class="px-2 py-1 text-xs font-medium rounded transition flex items-center gap-1 {!compressSeries ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                    title={m.series_unrolled_desc()}
                >
                    <Layers class="w-3 h-3" />
                    <span>{m.series_unrolled()}</span>
                </button>
            </div>

            <!-- Visible Components Dropdown (Feature Ported from Flat List) -->
            <div class="relative">
                <button
                    type="button"
                    onclick={() => (isComponentsMenuOpen = !isComponentsMenuOpen)}
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition {isComponentsMenuOpen ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900'}"
                    title={m.visible_components_desc()}
                    aria-expanded={isComponentsMenuOpen}
                >
                    <SlidersHorizontal class="w-3.5 h-3.5 text-slate-500" />
                    <span>{m.visible_components()}</span>
                    <span class="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold">
                        {Object.values(visibleComponents).filter(Boolean).length}
                    </span>
                    <ChevronDown class="w-3 h-3 text-slate-400 transition-transform {isComponentsMenuOpen ? 'rotate-180' : ''}" />
                </button>

                {#if isComponentsMenuOpen}
                    <!-- Click outside backdrop -->
                    <div
                        class="fixed inset-0 z-40"
                        onclick={() => (isComponentsMenuOpen = false)}
                        aria-hidden="true"
                    ></div>

                    <!-- Dropdown panel -->
                    <div
                        class="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-50 space-y-2 text-xs"
                    >
                        <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                            <span class="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                {m.visible_components()}
                            </span>
                            <div class="flex items-center gap-2 text-[11px]">
                                <button
                                    type="button"
                                    onclick={selectAllComponents}
                                    class="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                                >
                                    {m.select_all()}
                                </button>
                                <span class="text-slate-300 dark:text-slate-600">•</span>
                                <button
                                    type="button"
                                    onclick={resetComponentsToDefault}
                                    class="text-slate-500 hover:underline font-medium"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        <!-- List of component toggles -->
                        <div class="space-y-1 max-h-80 overflow-y-auto pr-1">
                            <!-- Associated Contacts -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('contacts')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.contacts ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <Users class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <div>
                                        <div class="font-semibold text-xs leading-tight">{m.component_contacts()}</div>
                                        <div class="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{m.component_contacts_desc()}</div>
                                    </div>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.contacts ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.contacts}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>

                            <!-- Participants Count -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('participants')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.participants ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <UserCheck class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <div>
                                        <div class="font-semibold text-xs leading-tight">{m.component_participants()}</div>
                                        <div class="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{m.component_participants_desc()}</div>
                                    </div>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.participants ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.participants}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>

                            <!-- Visibility / Public Status -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('publicStatus')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.publicStatus ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <Globe class="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    <div>
                                        <div class="font-semibold text-xs leading-tight">{m.component_visibility()}</div>
                                        <div class="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{m.component_visibility_desc()}</div>
                                    </div>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.publicStatus ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.publicStatus}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>

                            <!-- Descriptions -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('descriptions')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.descriptions ? 'bg-slate-100 dark:bg-slate-700/70 text-slate-900 dark:text-slate-100' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <FileText class="w-4 h-4 text-slate-500 shrink-0" />
                                    <span class="font-semibold text-xs">{m.show_descriptions()}</span>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.descriptions ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.descriptions}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>

                            <!-- QR Codes -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('qrCodes')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.qrCodes ? 'bg-slate-100 dark:bg-slate-700/70 text-slate-900 dark:text-slate-100' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <QrCode class="w-4 h-4 text-slate-500 shrink-0" />
                                    <span class="font-semibold text-xs">{m.show_qr_codes()}</span>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.qrCodes ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.qrCodes}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>

                            <!-- Ticket Prices -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('ticketPrice')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.ticketPrice ? 'bg-slate-100 dark:bg-slate-700/70 text-slate-900 dark:text-slate-100' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <Ticket class="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span class="font-semibold text-xs">{m.ticket_price()}</span>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.ticketPrice ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.ticketPrice}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>

                            <!-- Rooms & Location -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('rooms')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.rooms ? 'bg-slate-100 dark:bg-slate-700/70 text-slate-900 dark:text-slate-100' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <MapPin class="w-4 h-4 text-red-500 shrink-0" />
                                    <span class="font-semibold text-xs">{m.room()} / {m.location()}</span>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.rooms ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.rooms}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>

                            <!-- Tags -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('tags')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.tags ? 'bg-slate-100 dark:bg-slate-700/70 text-slate-900 dark:text-slate-100' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <Tag class="w-4 h-4 text-amber-500 shrink-0" />
                                    <span class="font-semibold text-xs">{m.tags()}</span>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.tags ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.tags}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>

                            <!-- Hero Image -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('heroImage')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.heroImage ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <FileImage class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <div>
                                        <div class="font-semibold text-xs leading-tight">{m.component_hero_image()}</div>
                                        <div class="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{m.component_hero_image_desc()}</div>
                                    </div>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.heroImage ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.heroImage}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>

                            <!-- Internal Notes -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('internalNotes')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.internalNotes ? 'bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <Lock class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <div>
                                        <div class="font-semibold text-xs leading-tight">{m.component_internal_notes()}</div>
                                        <div class="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{m.component_internal_notes_desc()}</div>
                                    </div>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.internalNotes ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.internalNotes}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>

                            <!-- Opening Hours -->
                            <button
                                type="button"
                                onclick={() => toggleComponent('openingHours')}
                                class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {visibleComponents.openingHours ? 'bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}"
                            >
                                <div class="flex items-center gap-2.5">
                                    <Clock class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <div>
                                        <div class="font-semibold text-xs leading-tight">{m.component_opening_hours?.() ?? "Öffnungszeiten"}</div>
                                        <div class="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{m.component_opening_hours_desc?.() ?? "Öffnungszeiten des Standorts anzeigen"}</div>
                                    </div>
                                </div>
                                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.openingHours ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                    {#if visibleComponents.openingHours}
                                        <Check class="w-3 h-3 stroke-[3]" />
                                    {/if}
                                </div>
                            </button>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Quick Toggle: Location Logo -->
            <button
                type="button"
                onclick={() => (showLocationLogo = !showLocationLogo)}
                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition {showLocationLogo ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 line-through'}"
                title="Standort-Logo ein-/ausschalten"
            >
                <ImageIcon class="w-3.5 h-3.5" />
                <span>{m.poster_location_logo()}</span>
            </button>

            <!-- Quick Toggle: Sponsors -->
            <button
                type="button"
                onclick={() => (showSponsors = !showSponsors)}
                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition {showSponsors ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 line-through'}"
                title="Sponsorenlogos ein-/ausschalten"
            >
                <Sparkles class="w-3.5 h-3.5" />
                <span>{m.poster_sponsors()}</span>
            </button>

            <!-- Quick Toggle: Pre-printed Letterhead Mode -->
            <button
                type="button"
                onclick={() => (isLetterheadMode = !isLetterheadMode)}
                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition {isLetterheadMode ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-400 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200'}"
                title="Vorgedrucktes Briefpapier: Lässt oberen Rand frei"
            >
                <FileText class="w-3.5 h-3.5 text-purple-600" />
                <span>{m.poster_letterhead_mode()}</span>
            </button>

            <!-- Quick Button: Modifiable Sections Editor -->
            <button
                type="button"
                onclick={() => (isSettingsOpen = true)}
                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition {customSections.filter(s => s.enabled).length > 0 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 border-slate-200 hover:text-slate-900'}"
                title="Modifizierbare Abschnitte & Infoblöcke bearbeiten"
            >
                <LayoutTemplate class="w-3.5 h-3.5 text-amber-600" />
                <span>{m.custom_sections?.() ?? "Abschnitte"}</span>
                {#if customSections.filter(s => s.enabled).length > 0}
                    <span class="px-1.5 py-0.2 bg-amber-200/80 dark:bg-amber-800/80 text-amber-900 dark:text-amber-100 rounded-full text-[9px] font-bold">
                        {customSections.filter(s => s.enabled).length}
                    </span>
                {/if}
            </button>
        </div>

        <!-- Right: Settings modal, Zoom, Print -->
        <div class="flex items-center gap-2">
            <!-- Zoom Controls -->
            <div class="hidden md:inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
                <button
                    type="button"
                    onclick={() => (zoomLevel = Math.max(0.4, Number((zoomLevel - 0.1).toFixed(2))))}
                    class="p-1 text-slate-500 hover:text-slate-800"
                    title="Verkleinern"
                >
                    <ZoomOut class="w-3.5 h-3.5" />
                </button>
                <span class="px-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 min-w-[3rem] text-center">
                    {Math.round(zoomLevel * 100)}%
                </span>
                <button
                    type="button"
                    onclick={() => (zoomLevel = Math.min(1.5, Number((zoomLevel + 0.1).toFixed(2))))}
                    class="p-1 text-slate-500 hover:text-slate-800"
                    title="Vergrößern"
                >
                    <ZoomIn class="w-3.5 h-3.5" />
                </button>
            </div>

            <!-- Open Settings Modal -->
            <button
                type="button"
                onclick={() => (isSettingsOpen = true)}
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-md border border-slate-300 dark:border-slate-600 transition"
                title="Logos, Sponsoren & Briefbogen konfigurieren"
            >
                <Settings2 class="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span class="hidden lg:inline">{m.poster_settings()}</span>
            </button>

            <!-- Print Button -->
            <button
                type="button"
                onclick={triggerPrint}
                class="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow transition focus:ring-2 focus:ring-emerald-500"
            >
                <Printer class="w-4 h-4" />
                <span>Drucken</span>
            </button>
        </div>
    </div>
</header>

<!-- Main Canvas / Workbench -->
<main class="w-full min-h-[calc(100vh-60px)] bg-slate-200 dark:bg-slate-950 p-4 sm:p-8 flex justify-center items-start overflow-auto print:block print:w-auto print:p-0 print:m-0 print:bg-white print:min-h-0 print:overflow-visible">
    <div
        class="poster-preview-scaler transition-transform duration-150 origin-top flex justify-center print:block print:w-auto print:m-0 print:p-0 print:transform-none"
        style="transform: scale({zoomLevel});"
    >
        <!-- The Poster Document Sheet (Single Page A4 or A3) -->
        <article
            bind:this={posterContentElement}
            class="poster-sheet {paperSize === 'A3' ? 'paper-a3' : 'paper-a4'} {letterheadMonochrome ? 'monochrome-mode' : ''} bg-white text-slate-900 shadow-2xl print:shadow-none print:border-none print:m-0 print:p-0 relative flex flex-col justify-between"
        >
            <!-- Top Section: Header or Blank Letterhead Space -->
            <div class="poster-top-container shrink-0">
                {#if isLetterheadMode}
                    <!-- Blank area reserved for pre-printed corporate stationery -->
                    <div
                        class="letterhead-blank-area relative w-full border-b border-dashed border-purple-300 print:border-none"
                        style="height: {letterheadBlankHeight}mm;"
                    >
                        <div class="print:hidden absolute inset-0 flex items-center justify-center text-purple-400/80 text-[11px] font-mono select-none">
                            <span>✂️ {m.poster_letterhead_hint()} ({letterheadBlankHeight}mm)</span>
                        </div>
                    </div>
                {/if}

                <!-- Poster Editorial Header -->
                <header class="poster-header px-8 pt-5 pb-1 flex flex-col gap-2">
                    <!-- Top Row: Location Branding / Venue Info & Right Logo / Sponsors -->
                    <div class="flex items-start justify-between gap-6">
                        <!-- Left: Location Info Block -->
                        <div
                            bind:clientHeight={locationBlockHeight}
                            class="location-info-block flex-1 min-w-0"
                        >
                            <div class="flex items-start gap-4">
                                {#if showLocationLogo && locationLogoPosition === "left" && effectiveLocationLogo && (!isLetterheadMode || letterheadShowLogo)}
                                    <div
                                        class="location-logo-wrap shrink-0"
                                        style="transform: translateY({locationLogoOffsetY}px);"
                                    >
                                        <img
                                            src={effectiveLocationLogo}
                                            alt={currentLocation?.name || "Logo"}
                                            class="object-contain object-top object-left transition-all"
                                            style="height: {effectiveLogoHeight}px; max-width: {locationLogoMaxWidth}px;"
                                        />
                                    </div>
                                {/if}

                                <div class="space-y-1">
                                    <h2 class="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase leading-none">
                                        {currentLocation?.name || "Kultur- & Begegnungszentrum"}
                                    </h2>

                                    <!-- Location Subtitle, Contact & Location QR Code (placed near location, like Animated List View) -->
                                    <div class="flex items-start gap-3 mt-1.5 text-xs text-slate-600">
                                        {#if showLocationQr}
                                            <div class="bg-white p-1.5 border border-slate-200 rounded-lg shadow-2xs shrink-0 mt-0.5 self-start">
                                                {#if currentLocation?.contact?.qrCodeDataUrl || currentLocation?.contact?.qrCodePath}
                                                    <img
                                                        src={currentLocation.contact.qrCodeDataUrl || currentLocation.contact.qrCodePath}
                                                        alt="Location QR"
                                                        class="w-20 h-20 object-contain"
                                                    />
                                                {:else}
                                                    <div class="w-20 h-20 bg-slate-50 flex items-center justify-center text-slate-600">
                                                        <QrCode class="w-10 h-10" />
                                                    </div>
                                                {/if}
                                            </div>
                                        {/if}

                                        <div class="space-y-0.5 leading-snug">
                                            {#if programmeLocationSubtitle}
                                                <p class="font-medium text-slate-700">{programmeLocationSubtitle}</p>
                                            {/if}
                                            {#if currentLocation?.contact}
                                                <div class="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5">
                                                    {#if currentLocation.contact.name}
                                                        <span class="font-semibold text-slate-800">{currentLocation.contact.name}</span>
                                                    {/if}
                                                    {#if currentLocation.contact.role}
                                                        <span class="px-1.5 py-0.2 bg-slate-100 rounded text-[10px] text-slate-600 border border-slate-200">
                                                            {currentLocation.contact.role}
                                                        </span>
                                                    {/if}
                                                    {#if currentLocation.contact.phone}
                                                        <span class="inline-flex items-center gap-1">
                                                            <Phone class="w-2.5 h-2.5 text-slate-400" />
                                                            {currentLocation.contact.phone}
                                                        </span>
                                                    {/if}
                                                    {#if currentLocation.contact.email}
                                                        <span class="inline-flex items-center gap-1">
                                                            <Mail class="w-2.5 h-2.5 text-slate-400" />
                                                            {currentLocation.contact.email}
                                                        </span>
                                                    {/if}
                                                </div>
                                            {/if}

                                            <!-- Location Opening Hours (Öffnungszeiten) & Inclusivity -->
                                            {#if visibleComponents.openingHours && currentLocation?.openingHours}
                                                <div class="mt-1.5 pt-1.5 border-t border-slate-200/70 flex items-start gap-1.5 text-[10.5px] text-slate-700">
                                                    <Clock class="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                                    <div class="leading-tight whitespace-pre-line font-medium">
                                                        {formatOpeningHours(currentLocation.openingHours)}
                                                    </div>
                                                </div>
                                            {/if}
                                            {#if currentLocation?.inclusivitySupport}
                                                <div class="text-[10px] text-emerald-800 flex items-center gap-1 font-medium pt-0.5">
                                                    <CheckCircle2 class="w-2.5 h-2.5 text-emerald-600" />
                                                    <span>{currentLocation.inclusivitySupport}</span>
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Header: Location Logo (top-right, aligned with Location Name) & Top Sponsors -->
                        <div class="flex flex-col items-end gap-2.5 shrink-0 self-start">
                            {#if showLocationLogo && locationLogoPosition === "right" && effectiveLocationLogo && (!isLetterheadMode || letterheadShowLogo)}
                                <div
                                    class="location-logo-wrap shrink-0 text-right flex items-start justify-end"
                                    style="transform: translateY({locationLogoOffsetY}px);"
                                >
                                    <img
                                        src={effectiveLocationLogo}
                                        alt={currentLocation?.name || "Logo"}
                                        class="object-contain object-top object-right transition-all"
                                        style="height: {effectiveLogoHeight}px; max-width: {locationLogoMaxWidth}px;"
                                    />
                                </div>
                            {/if}

                            {#if showSponsors && sponsorPosition === "header" && sponsors.length > 0}
                                <div class="text-right">
                                    <span class="text-[9px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">
                                        {sponsorSectionTitle}
                                    </span>
                                    <div class="flex items-center gap-3 flex-wrap justify-end">
                                        {#each sponsors as s (s.id)}
                                            {#if s.logoUrl}
                                                <img src={s.logoUrl} alt={s.name} class="h-8 max-w-[90px] object-contain" />
                                            {:else}
                                                <span class="text-[10px] font-bold text-slate-700 px-1.5 py-0.5 border border-slate-300 rounded">
                                                    {s.name}
                                                </span>
                                            {/if}
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Main Programme Headline Row (Full width underneath location block & logo with single Yellow Accent Line) -->
                    <div class="mt-0.5 pt-1.5">
                        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 border-l-4 border-[#fbc707] pl-3">
                            {programmeMonthTitle}
                        </h1>
                        <div class="h-1 bg-[#fbc707] mt-1.5 rounded-full w-full"></div>
                    </div>
                </header>
            </div>

            <!-- Optional Top Banner Slot for Custom Sections -->
            {#if customSections.some(s => s.enabled && s.slot === "banner")}
                <div class="px-8 pt-2 pb-1 space-y-2">
                    {#each customSections.filter(s => s.enabled && s.slot === "banner") as sec (sec.id)}
                        {@render customSectionCard(sec, "banner")}
                    {/each}
                </div>
            {/if}

            <!-- Middle Section: Programme Event Grid (Single Page Multi-Column Flow) -->
            <div
                class="poster-events-grid flex-1 px-8 py-3.5"
                style="column-count: {effectiveColumns}; column-gap: 2rem; {effectiveColumns > 1 ? 'column-rule: 1px solid #e2e8f0;' : ''}"
            >
                <!-- Optional Grid Top Slot for Custom Sections -->
                {#if customSections.some(s => s.enabled && s.slot === "grid_top")}
                    {#each customSections.filter(s => s.enabled && s.slot === "grid_top") as sec (sec.id)}
                        {@render customSectionCard(sec, "grid_top")}
                    {/each}
                {/if}

                {#if displayItems.length === 0}
                    <div class="py-16 text-center text-slate-400">
                        <Calendar class="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p class="font-medium text-base">Keine Termine für diesen Zeitraum ausgewählt.</p>
                        <p class="text-xs">Prüfen Sie den Datumsbereich oder die Filtereinstellungen des Kiosks.</p>
                    </div>
                {:else}
                    {#each displayItems as item, idx (item.id || idx)}
                        {@const isEvt = "startDateTime" in item}
                        {@const evt = item as EnrichedEvent}
                        {@const isSpecialNonSeries = isEvt && isNonSeriesEvent(item)}
                        {@const isCompressed = Boolean(isEvt && evt.isCompressedSeries && ((evt.seriesInstances && evt.seriesInstances.length >= 1) || (evt.seriesDates && evt.seriesDates.length >= 1)))}
                        {@const multiDay = isEvt && isMultiDayEvent(item as Event)}
                        {@const durationDays = multiDay ? getEventDurationDays(item as Event) : 1}
                        {@const dateParts = isEvt ? getEventDateParts(item as Event) : null}
                        {@const dateStr = isEvt ? (item as Event).startDateTime : (item as Announcement).createdAt}
                        {@const rooms = isEvt ? getEventRooms(item as Event) : []}
                        {@const priceStr = isEvt ? formatTicketPrice((item as Event).ticketPrice, (item as Event).ticketPriceUnknown) : ""}
                        {@const isFree = isEvt ? isEventFree((item as Event).ticketPrice, (item as Event).ticketPriceUnknown) : false}
                        {@const cancelledCount = evt.seriesInstances ? evt.seriesInstances.filter(i => i.status === 'cancelled').length : 0}
                        {@const tentativeCount = evt.seriesInstances ? evt.seriesInstances.filter(i => i.status === 'tentative').length : 0}
                        {@const totalInstances = evt.seriesInstances ? evt.seriesInstances.length : (evt.seriesDates ? evt.seriesDates.length : 1)}
                        {@const hasRightVisuals = Boolean((visibleComponents.heroImage && (item as any).heroImage) || (visibleComponents.qrCodes && isEvt && (evt.qrCodeDataUrl || evt.qrCodePath)))}
                        {@const itemRecurrenceRule = isEvt ? ((Array.isArray((item as any).recurrence) ? (item as any).recurrence[0] : typeof (item as any).recurrence === 'string' ? (item as any).recurrence : null) || (item as any).seriesMaster?.recurrence?.[0] || null) : null}

                        <!-- Single Programme Entry (Avoid breaking inside columns - Highlight for Non-Repeating One-Offs) -->
                        <div class="poster-event-item mb-3 pb-2 break-inside-avoid transition-all rounded-r-md border-y border-r p-2 shadow-2xs {density === 'compact' ? 'mb-1.5 pb-1.5 text-[11px]' : density === 'relaxed' ? 'mb-4 pb-2.5 text-[13px]' : 'text-xs'} {isSpecialNonSeries ? 'border-l-4 border-l-amber-500 bg-amber-50/85 border-y-amber-200/80 border-r-amber-200/80 ring-1 ring-amber-400/20' : isCompressed ? 'border-l-[3.5px] border-l-indigo-400 bg-slate-50/70 border-slate-200/60' : 'border-l-[3.5px] border-l-slate-300 bg-white border-slate-200/60'}">
                            <div class="flex items-start gap-3">
                                <!-- Date Badge Block -->
                                {#if isCompressed}
                                    <div class="poster-date-pill shrink-0 flex flex-col items-center justify-center min-w-[44px] py-1 px-1 rounded bg-slate-900 text-white font-mono text-center">
                                        <RefreshCw class="w-3.5 h-3.5 text-amber-400 mb-0.5" />
                                        <span class="text-sm font-black leading-tight text-amber-400">{totalInstances}×</span>
                                        <span class="text-[7.5px] uppercase tracking-wider text-slate-300 leading-none">{m.series_badge()}</span>
                                    </div>
                                {:else if multiDay && dateParts}
                                    <div class="poster-date-pill shrink-0 flex flex-col items-center justify-center min-w-[44px] py-1 px-1 rounded bg-slate-900 text-white font-mono text-center">
                                        <span class="text-[8px] font-extrabold uppercase text-amber-300 leading-none">
                                            {dateParts.startMonth}{dateParts.startMonth !== dateParts.endMonth ? `/${dateParts.endMonth}` : ''}
                                        </span>
                                        <span class="text-xs font-black leading-tight my-0.5">
                                            {dateParts.startDay}–{dateParts.endDay}
                                        </span>
                                        <span class="text-[7.5px] uppercase tracking-wider text-slate-300 leading-none">
                                            {m.days_count({ count: durationDays })}
                                        </span>
                                    </div>
                                {:else}
                                    <div class="poster-date-pill shrink-0 flex flex-col items-center justify-center min-w-[44px] py-1 px-1 rounded {isSpecialNonSeries ? 'bg-amber-950 text-white ring-1 ring-amber-500/50' : 'bg-slate-900 text-white'} font-mono text-center">
                                        <span class="text-[8.5px] font-bold tracking-wider uppercase {isSpecialNonSeries ? 'text-amber-400 font-black' : 'text-amber-300'} leading-none">
                                            {formatDateWeekday(dateStr)}
                                        </span>
                                        <span class="text-base font-black leading-none my-0.5 text-white">
                                            {formatDateDay(dateStr)}
                                        </span>
                                        <span class="text-[8px] uppercase tracking-wider {isSpecialNonSeries ? 'text-amber-200/90' : 'text-slate-300'} leading-none">
                                            {formatDateMonth(dateStr)}
                                        </span>
                                    </div>
                                {/if}

                                <!-- Event Details -->
                                <div class="flex-1 min-w-0 flow-root">
                                    {#if wrapAroundQr && hasRightVisuals}
                                        <!-- Floated visuals (top-aligned): content flows beside, then beneath once the space left of it is used up -->
                                        <div class="float-right ml-2 mb-1 flex items-start gap-1.5">
                                            {@render rightVisuals(item, evt, isEvt)}
                                        </div>
                                    {/if}

                                    <!-- Title, recurrence and meta badges: one continuous wrapping line (line break only before series dates) -->
                                    <div class="text-slate-500 font-medium mb-0.5 text-[10px] [&>*]:mr-1.5 [&>*]:mb-0.5 [&>*]:align-middle">
                                        <h3 class="inline mr-1.5 font-bold text-slate-900 leading-snug tracking-tight {density === 'compact' ? 'text-xs' : density === 'relaxed' ? 'text-sm' : 'text-[13px]'} {evt.status === 'cancelled' ? 'line-through text-slate-400' : ''}">
                                            {isEvt ? (item as Event).summary : (item as Announcement).title}
                                        </h3>
                                        {#if isCompressed}
                                            <span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-900 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">
                                                <RefreshCw class="w-2.5 h-2.5" />
                                                {evt.recurrenceText || m.series_badge()}
                                            </span>
                                        {:else if isEvt && itemRecurrenceRule}
                                            <span class="inline-flex items-center gap-1 text-slate-600 font-medium text-[9px]">
                                                <RefreshCw class="w-2.5 h-2.5 text-slate-500" />
                                                {formatRecurrenceText(itemRecurrenceRule, { short: true })}
                                            </span>
                                        {/if}
                                        <!-- Multi-day Badge -->
                                        {#if multiDay && !isCompressed}
                                            <span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-900 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">
                                                <Calendar class="w-2.5 h-2.5" />
                                                {m.multi_day_badge()}
                                            </span>
                                        {/if}

                                        <!-- Status Badges -->
                                        {#if evt.status === 'cancelled'}
                                            <span class="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                                                {m.cancelled()}
                                            </span>
                                        {:else if evt.status === 'tentative'}
                                            <span class="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                                                {m.tentative()}
                                            </span>
                                        {/if}

                                        <!-- Partial cancelled/tentative count for compressed series -->
                                        {#if isCompressed && cancelledCount > 0 && cancelledCount < totalInstances}
                                            <span class="bg-red-100 text-red-700 border border-red-300 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">
                                                {cancelledCount} {m.cancelled()}
                                            </span>
                                        {/if}
                                        {#if isCompressed && tentativeCount > 0 && tentativeCount < totalInstances}
                                            <span class="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">
                                                {tentativeCount} {m.tentative()}
                                            </span>
                                        {/if}

                                        <!-- Public / Internal Visibility Badge -->
                                        {#if visibleComponents.publicStatus && isEvt}
                                            {#if (item as Event).isPublic}
                                                <span class="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">
                                                    <Globe class="w-2.5 h-2.5 text-emerald-600" />
                                                    <span>{m.public_label()}</span>
                                                </span>
                                            {:else}
                                                <span class="inline-flex items-center gap-0.5 bg-slate-100 text-slate-700 border border-slate-300 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">
                                                    <Lock class="w-2.5 h-2.5 text-slate-500" />
                                                    <span>{m.private_label()}</span>
                                                </span>
                                            {/if}
                                        {/if}

                                        <!-- Time Range -->
                                        {#if showTimes && isEvt}
                                            <span class="inline-flex items-center gap-1 font-bold {isSpecialNonSeries ? 'text-amber-900' : 'text-slate-800'}">
                                                <Clock class="w-3 h-3 {isSpecialNonSeries ? 'text-amber-600' : 'text-slate-500'} shrink-0" />
                                                {formatTimeRange((item as Event).startDateTime, (item as Event).endDateTime, (item as Event).isAllDay)}
                                            </span>
                                        {/if}

                                        <!-- Rooms / Venue -->
                                        {#if visibleComponents.rooms && rooms.length > 0}
                                            <span class="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded text-[9px]">
                                                <MapPin class="w-2.5 h-2.5 text-slate-400" />
                                                {rooms.join(", ")}
                                            </span>
                                        {/if}

                                        <!-- Ticket Price or Free Badge -->
                                        {#if visibleComponents.ticketPrice}
                                            {#if isFree}
                                                <span class="inline-flex items-center gap-0.5 font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300/80 px-1.5 py-0.2 rounded text-[9px]">
                                                    <Ticket class="w-2.5 h-2.5 text-emerald-600" />
                                                    {m.ticket_price_free?.() || 'Kostenlos'}
                                                </span>
                                            {:else if priceStr}
                                                <span class="inline-flex items-center gap-0.5 font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded text-[9px]">
                                                    <Ticket class="w-2.5 h-2.5" />
                                                    {priceStr}
                                                </span>
                                            {/if}
                                        {/if}

                                        <!-- Participants -->
                                        {#if visibleComponents.participants && isEvt}
                                            {@const pCount = (item as any).participantsCount}
                                            {@const maxOcc = (item as any).maxOccupancy}
                                            {#if pCount != null || maxOcc != null}
                                                <span class="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded text-[9px] font-semibold">
                                                    <UserCheck class="w-2.5 h-2.5 text-amber-600" />
                                                    <span>
                                                        {#if pCount != null && maxOcc != null}
                                                            {pCount} / {maxOcc} {m.participants()}
                                                        {:else if pCount != null}
                                                            {pCount} {m.participants()}
                                                        {:else}
                                                            Max: {maxOcc}
                                                        {/if}
                                                    </span>
                                                </span>
                                            {/if}
                                        {/if}
                                    </div>

                                    <!-- Compressed Series Dates Pills with per-instance status -->
                                    {#if isCompressed && evt.seriesInstances && evt.seriesInstances.length >= 1}
                                        <div class="mt-1 [&>*]:mr-1 [&>*]:mb-0.5 [&>*]:align-middle">
                                            <span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider inline-flex items-center gap-1">
                                                <Calendar class="w-2.5 h-2.5 text-indigo-500" />
                                                <span>{m.all_instances_count?.({ count: evt.seriesInstances.length }) ?? `${evt.seriesInstances.length} Termine`}:</span>
                                            </span>
                                            {#each evt.seriesInstances as inst (inst.id || inst.startDateTime)}
                                                {#if inst.status === 'cancelled'}
                                                    <span
                                                        class="inline-flex items-center gap-0.5 bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.2 rounded text-[8.5px] font-bold tracking-tight"
                                                        title="{formatFullDate(inst.startDateTime)} – {m.cancelled()}"
                                                    >
                                                        <span class="line-through opacity-75">{formatDateWeekday(inst.startDateTime)}</span>
                                                        <span class="line-through opacity-75">{formatDateDay(inst.startDateTime)} {formatDateMonth(inst.startDateTime)}</span>
                                                        <span class="bg-red-600 text-white text-[7.5px] font-black px-0.5 rounded uppercase ml-0.5">{m.cancelled()}</span>
                                                    </span>
                                                {:else if inst.status === 'tentative'}
                                                    <span
                                                        class="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded text-[8.5px] font-bold tracking-tight"
                                                        title="{formatFullDate(inst.startDateTime)} – {m.tentative()}"
                                                    >
                                                        <span class="text-amber-700 font-medium">{formatDateWeekday(inst.startDateTime)}</span>
                                                        <span>{formatDateDay(inst.startDateTime)} {formatDateMonth(inst.startDateTime)}</span>
                                                        <span class="bg-amber-500 text-white text-[7.5px] font-black px-0.5 rounded uppercase ml-0.5">{m.tentative()}</span>
                                                    </span>
                                                {:else}
                                                    <span class="inline-flex items-center gap-0.5 bg-slate-900 text-white px-1.5 py-0.2 rounded text-[8.5px] font-bold tracking-tight">
                                                        <span class="text-slate-300 font-medium">{formatDateWeekday(inst.startDateTime)}</span>
                                                        <span>{formatDateDay(inst.startDateTime)} {formatDateMonth(inst.startDateTime)}</span>
                                                    </span>
                                                {/if}
                                            {/each}
                                        </div>
                                    {:else if isCompressed && evt.seriesDates && evt.seriesDates.length >= 1}
                                        <div class="mt-1 [&>*]:mr-1 [&>*]:mb-0.5 [&>*]:align-middle">
                                            <span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider inline-flex items-center gap-1">
                                                <Calendar class="w-2.5 h-2.5 text-indigo-500" />
                                                <span>{m.all_instances_count?.({ count: evt.seriesDates.length }) ?? `${evt.seriesDates.length} Termine`}:</span>
                                            </span>
                                            {#each evt.seriesDates as sDate}
                                                <span class="inline-flex items-center gap-0.5 bg-slate-900 text-white px-1.5 py-0.2 rounded text-[8.5px] font-bold tracking-tight">
                                                    <span class="text-slate-300 font-medium">{formatDateWeekday(sDate)}</span>
                                                    <span>{formatDateDay(sDate)} {formatDateMonth(sDate)}</span>
                                                </span>
                                            {/each}
                                        </div>
                                    {/if}

                                    <!-- Associated Contacts List (if enabled in visibleComponents) -->
                                    {#if visibleComponents.contacts && isEvt}
                                        {@const allContacts = getAllEventContacts(item as Event)}
                                        {#if allContacts.length > 0}
                                            <div class="mt-1 pt-1 border-t border-slate-100 space-y-0.5">
                                                <div class="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                    <Users class="w-2.5 h-2.5 text-slate-400" />
                                                    <span>{m.component_contacts()} ({allContacts.length})</span>
                                                </div>
                                                <div class="[&>*]:mr-1 [&>*]:mb-0.5 [&>*]:align-middle">
                                                    {#each allContacts as c (c.id || c.name || getContactName(c))}
                                                        {@const cName = getContactName(c)}
                                                        {@const cRoles = getContactRoles(c)}
                                                        {@const cEmail = getContactEmail(c)}
                                                        {@const cPhone = getContactPhone(c)}
                                                        <div class="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded text-[9.5px]">
                                                            <User class="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                                            <span class="font-medium text-slate-800">{cName}</span>
                                                            {#if cRoles.length > 0}
                                                                {#each cRoles as r}
                                                                    <span class="px-1 py-0.1 bg-blue-100 text-blue-800 rounded text-[8.5px] font-semibold">{r}</span>
                                                                {/each}
                                                            {/if}
                                                            {#if cEmail}
                                                                <a href="mailto:{cEmail}" class="text-slate-400 hover:text-blue-600 text-[9px]" title={cEmail}>• {cEmail}</a>
                                                            {/if}
                                                            {#if cPhone}
                                                                <a href="tel:{cPhone}" class="text-slate-400 hover:text-blue-600 text-[9px]" title={cPhone}>• {cPhone}</a>
                                                            {/if}
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        {:else if (item as Event).resolvedContact}
                                            <!-- Fallback single contact if allContacts array is empty -->
                                            <div class="mt-0.5 text-[9.5px] text-slate-600 flex items-center gap-1">
                                                <User class="w-2.5 h-2.5 text-slate-400" />
                                                <span class="font-medium text-slate-700">{(item as Event).resolvedContact?.name}</span>
                                                {#if (item as Event).resolvedContact?.roles && (item as Event).resolvedContact!.roles!.length > 0}
                                                    {#each (item as Event).resolvedContact!.roles! as roleName}
                                                        <span class="px-1 py-0.1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[8.5px] font-semibold">{roleName}</span>
                                                    {/each}
                                                {:else if (item as Event).resolvedContact?.role}
                                                    <span class="px-1 py-0.1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[8.5px] font-semibold">{(item as Event).resolvedContact?.role}</span>
                                                {/if}
                                            </div>
                                        {/if}
                                    {/if}

                                    <!-- Description -->
                                    {#if visibleComponents.descriptions && descriptionStyle !== "none"}
                                        {@const rawDesc = isEvt ? (item as Event).description : (item as Announcement).content}
                                        {#if rawDesc && rawDesc.trim()}
                                            <div class="rich-description mt-0.5 text-slate-600 leading-relaxed font-normal {descriptionStyle === 'short' ? (wrapAroundQr ? 'max-h-[3.25em] overflow-clip' : 'line-clamp-2') : ''} text-[10px]">
                                                {@html rawDesc}
                                            </div>
                                        {/if}
                                    {/if}

                                    <!-- Staff Internal Notes -->
                                    {#if visibleComponents.internalNotes && isEvt && (item as Event).internalNotes}
                                        <div class="mt-1 p-1.5 rounded bg-amber-50/80 border border-amber-200 text-amber-900 text-[10px]">
                                            <div class="flex items-center gap-1 font-bold text-[8.5px] uppercase tracking-wider text-amber-700 mb-0.5">
                                                <Lock class="w-2.5 h-2.5 text-amber-600" />
                                                <span>{m.internal_notes()}</span>
                                            </div>
                                            <div class="rich-description text-[9.5px] leading-relaxed">
                                                {@html (item as Event).internalNotes}
                                            </div>
                                        </div>
                                    {/if}

                                    <!-- Tags -->
                                    {#if visibleComponents.tags && (item as any).tags && (item as any).tags.length > 0}
                                        <div class="mt-0.5 [&>*]:mr-1 [&>*]:align-middle">
                                            {#each (item as any).tags as t}
                                                <span class="text-[8.5px] px-1 py-0.2 bg-slate-100 text-slate-500 rounded border border-slate-200">
                                                    #{typeof t === 'string' ? t : t.name || t.tag?.name}
                                                </span>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>

                                <!-- Right Side Visuals (Hero Image & QR Code) -->
                                {#if !wrapAroundQr && hasRightVisuals}
                                    <div class="shrink-0 flex items-center gap-1.5 self-start pt-1">
                                        {@render rightVisuals(item, evt, isEvt)}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                {/if}

                <!-- Optional Grid Bottom Slot for Custom Sections -->
                {#if customSections.some(s => s.enabled && s.slot === "grid_bottom")}
                    {#each customSections.filter(s => s.enabled && s.slot === "grid_bottom") as sec (sec.id)}
                        {@render customSectionCard(sec, "grid_bottom")}
                    {/each}
                {/if}
            </div>

            <!-- Optional Footer Slot for Custom Sections -->
            {#if customSections.some(s => s.enabled && s.slot === "footer")}
                <div class="px-8 py-2 bg-slate-50 border-t border-slate-200 space-y-2">
                    {#each customSections.filter(s => s.enabled && s.slot === "footer") as sec (sec.id)}
                        {@render customSectionCard(sec, "footer")}
                    {/each}
                </div>
            {/if}

            <!-- Bottom Section: Footer & Sponsors Bar -->
            <footer class="poster-footer px-8 py-3.5 border-t border-slate-200 shrink-0 bg-slate-50/50 print:bg-transparent">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <!-- Location Contact Details -->
                    <div class="text-[10px] text-slate-600 flex items-center flex-wrap gap-x-4 gap-y-1">
                        {#if currentLocation?.contact?.phone}
                            <span class="inline-flex items-center gap-1 font-medium">
                                <Phone class="w-3 h-3 text-slate-400" />
                                {currentLocation.contact.phone}
                            </span>
                        {/if}
                        {#if currentLocation?.contact?.email}
                            <span class="inline-flex items-center gap-1 font-medium">
                                <Mail class="w-3 h-3 text-slate-400" />
                                {currentLocation.contact.email}
                            </span>
                        {/if}
                        <span class="text-slate-400">
                            Änderungen vorbehalten • Stand: {new Date().toLocaleDateString()}
                        </span>
                    </div>

                    <!-- Bottom Sponsor Logos (If enabled and position is footer) -->
                    {#if showSponsors && sponsorPosition === "footer" && sponsors.length > 0}
                        <div class="flex items-center gap-3">
                            <span class="text-[9px] uppercase tracking-wider font-semibold text-slate-400">
                                {sponsorSectionTitle}:
                            </span>
                            <div class="flex items-center gap-3 flex-wrap">
                                {#each sponsors as s (s.id)}
                                    {#if s.logoUrl}
                                        <img src={s.logoUrl} alt={s.name} class="h-6 max-w-[85px] object-contain filter grayscale hover:grayscale-0 transition" />
                                    {:else}
                                        <span class="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
                                            {s.name}
                                        </span>
                                    {/if}
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            </footer>
        </article>
    </div>
</main>

<!-- Settings & Logos Modal Drawer -->
{#if isSettingsOpen}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs print:hidden"
        role="dialog"
        aria-modal="true"
    >
        <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div class="flex items-center gap-2">
                    <Settings2 class="w-5 h-5 text-emerald-600" />
                    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {m.poster_settings()}
                    </h2>
                </div>
                <button
                    type="button"
                    onclick={() => (isSettingsOpen = false)}
                    class="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                    <X class="w-5 h-5" />
                </button>
            </div>

            <!-- Modal Body (Scrollable) -->
            <div class="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-700 dark:text-slate-300">
                <!-- 1. Location Logo Configuration -->
                <section class="space-y-3">
                    <div class="flex items-center justify-between">
                        <h3 class="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <ImageIcon class="w-4 h-4 text-emerald-600" />
                            Standort-Logo
                        </h3>
                        <label class="flex items-center gap-2 cursor-pointer text-xs font-medium">
                            <input
                                type="checkbox"
                                bind:checked={showLocationLogo}
                                class="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>Logo auf Poster anzeigen</span>
                        </label>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                            <span class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                Logo-Datei hochladen
                            </span>
                            <label class="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-md hover:border-emerald-500 cursor-pointer bg-white dark:bg-slate-800 transition">
                                <Upload class="w-5 h-5 text-slate-400 mb-1" />
                                <span class="text-xs text-slate-600 dark:text-slate-300 font-medium">Datei auswählen</span>
                                <span class="text-[10px] text-slate-400">PNG, SVG, JPG</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    class="hidden"
                                    onchange={(e) => handleImageUpload(e, "location")}
                                />
                            </label>
                        </div>

                        <div>
                            <label for="posterCustomLogoUrl" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                Oder Logo-URL eingeben
                            </label>
                            <div class="flex gap-2 mb-2">
                                <input
                                    id="posterCustomLogoUrl"
                                    type="url"
                                    bind:value={customLocationLogoUrl}
                                    placeholder="https://example.com/logo.svg oder /logos/..."
                                    class="flex-1 text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-emerald-500"
                                />
                                {#if customLocationLogoUrl && customLocationLogoUrl.includes("svg")}
                                    <button
                                        type="button"
                                        onclick={autoCropCurrentLogo}
                                        class="px-2.5 py-1 text-xs font-medium rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 shrink-0 transition-colors"
                                        title="Entfernt überflüssige Ränder aus dem SVG für passgenaue Skalierung"
                                    >
                                        Auto-Crop
                                    </button>
                                {/if}
                            </div>

                            <!-- Preset: FH Logo Shortcut -->
                            <div class="flex items-center gap-2 mb-3">
                                <button
                                    type="button"
                                    onclick={() => {
                                        customLocationLogoUrl = "/logos/FH_Logo_2015_CMYK.svg";
                                        locationLogoPosition = "right";
                                        locationLogoSizeMode = "match_block";
                                        savePrefs();
                                        toast.success("FH Logo aktiviert");
                                    }}
                                    class="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                                >
                                    <span>🏛️ FH Logo laden</span>
                                </button>
                            </div>

                            <!-- Position: Rechts / Links -->
                            <div class="flex items-center justify-between text-xs mb-3">
                                <span class="font-semibold text-slate-600 dark:text-slate-400">{m.poster_logo_position()}:</span>
                                <div class="inline-flex rounded border border-slate-300 dark:border-slate-600 p-0.5 bg-white dark:bg-slate-800 text-[11px]">
                                    <button
                                        type="button"
                                        onclick={() => (locationLogoPosition = "right")}
                                        class="px-2.5 py-1 rounded transition {locationLogoPosition === 'right' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-300'}"
                                    >
                                        {m.poster_logo_position_right()} (oben rechts)
                                    </button>
                                    <button
                                        type="button"
                                        onclick={() => (locationLogoPosition = "left")}
                                        class="px-2.5 py-1 rounded transition {locationLogoPosition === 'left' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-300'}"
                                    >
                                        {m.poster_logo_position_left()}
                                    </button>
                                </div>
                            </div>

                            <!-- Sizing & Placement Fine-Tuning Box -->
                            <div class="space-y-2.5 mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="font-semibold text-slate-700 dark:text-slate-300">Skalierung / Höhe:</span>
                                    <div class="inline-flex rounded border border-slate-300 dark:border-slate-600 p-0.5 bg-white dark:bg-slate-900 text-[11px]">
                                        <button
                                            type="button"
                                            onclick={() => (locationLogoSizeMode = "match_block")}
                                            class="px-2 py-0.5 rounded transition {locationLogoSizeMode === 'match_block' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                                        >
                                            An Block anpassen
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() => (locationLogoSizeMode = "manual")}
                                            class="px-2 py-0.5 rounded transition {locationLogoSizeMode === 'manual' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400'}"
                                        >
                                            Manuell
                                        </button>
                                    </div>
                                </div>

                                {#if locationLogoSizeMode === "match_block"}
                                    <p class="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                        ✓ Automatisch so hoch wie der Standort-Block links (~{Math.round(locationBlockHeight || 110)}px, proportional)
                                    </p>
                                {:else}
                                    <div class="flex items-center justify-between text-xs pt-1">
                                        <span class="text-slate-600 dark:text-slate-400">Höhe ({locationLogoHeight}px):</span>
                                        <div class="flex items-center gap-2">
                                            <input
                                                type="range"
                                                min="24"
                                                max="240"
                                                bind:value={locationLogoHeight}
                                                class="w-28 accent-emerald-600"
                                            />
                                            <span class="font-mono text-[11px] w-8 text-right">{locationLogoHeight}px</span>
                                        </div>
                                    </div>
                                {/if}

                                <!-- Max Width limit -->
                                <div class="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200 dark:border-slate-700">
                                    <span class="text-slate-600 dark:text-slate-400">Max. Breite ({locationLogoMaxWidth}px):</span>
                                    <div class="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="120"
                                            max="500"
                                            step="10"
                                            bind:value={locationLogoMaxWidth}
                                            class="w-28 accent-emerald-600"
                                        />
                                        <span class="font-mono text-[11px] w-8 text-right">{locationLogoMaxWidth}px</span>
                                    </div>
                                </div>

                                <!-- Vertical Offset fine tuning -->
                                <div class="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200 dark:border-slate-700">
                                    <span class="text-slate-600 dark:text-slate-400">
                                        Feinjustierung oben ({locationLogoOffsetY > 0 ? '+' : ''}{locationLogoOffsetY}px):
                                    </span>
                                    <div class="flex items-center gap-1.5">
                                        <input
                                            type="range"
                                            min="-30"
                                            max="30"
                                            step="1"
                                            bind:value={locationLogoOffsetY}
                                            class="w-24 accent-emerald-600"
                                        />
                                        {#if locationLogoOffsetY !== 0}
                                            <button
                                                type="button"
                                                onclick={() => (locationLogoOffsetY = 0)}
                                                class="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1 font-bold"
                                                title="Auf 0 zurücksetzen"
                                            >
                                                ✕
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {#if effectiveLocationLogo}
                            <div class="col-span-full flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <span class="text-xs text-slate-500 font-medium">Vorschau:</span>
                                <img
                                    src={effectiveLocationLogo}
                                    alt="Logo Vorschau"
                                    class="max-h-12 max-w-[120px] object-contain p-1 bg-white border border-slate-200 rounded"
                                />
                                {#if customLocationLogoUrl}
                                    <button
                                        type="button"
                                        onclick={() => (customLocationLogoUrl = "")}
                                        class="text-xs text-red-600 hover:underline"
                                    >
                                        Zurücksetzen auf Standard
                                    </button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </section>

                <!-- 2. Sponsors & Partner Logos -->
                <section class="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                    <div class="flex items-center justify-between">
                        <h3 class="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Sparkles class="w-4 h-4 text-emerald-600" />
                            Sponsoren & Partnerlogos
                        </h3>
                        <label class="flex items-center gap-2 cursor-pointer text-xs font-medium">
                            <input
                                type="checkbox"
                                bind:checked={showSponsors}
                                class="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>Sponsoren anzeigen</span>
                        </label>
                    </div>

                    <div class="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label for="posterSponsorTitle" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Titel der Sponsorenzeile
                                </label>
                                <input
                                    id="posterSponsorTitle"
                                    type="text"
                                    bind:value={sponsorSectionTitle}
                                    placeholder="Gefördert durch / Partner"
                                    class="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label for="posterSponsorPosition" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Position auf dem Poster
                                </label>
                                <select
                                    id="posterSponsorPosition"
                                    bind:value={sponsorPosition}
                                    class="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                >
                                    <option value="footer">Fußzeile (Empfohlen)</option>
                                    <option value="header">Kopfzeile (Oben rechts)</option>
                                </select>
                            </div>
                        </div>

                        <!-- Sponsor List -->
                        <div class="space-y-2 pt-2">
                            <span class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Sponsorenliste:
                            </span>

                            {#each sponsors as s, idx (s.id)}
                                <div class="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                    <input
                                        type="text"
                                        bind:value={s.name}
                                        placeholder="Name des Sponsors / Förderers"
                                        class="flex-1 text-xs p-1.5 rounded border border-slate-200 dark:border-slate-700"
                                    />
                                    <input
                                        type="url"
                                        bind:value={s.logoUrl}
                                        placeholder="Logo-URL oder Upload"
                                        class="flex-1 text-xs p-1.5 rounded border border-slate-200 dark:border-slate-700"
                                    />

                                    <!-- Upload button -->
                                    <label class="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded cursor-pointer text-xs" title="Logo hochladen">
                                        <Upload class="w-3.5 h-3.5" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            class="hidden"
                                            onchange={(e) => handleImageUpload(e, { sponsorId: s.id })}
                                        />
                                    </label>

                                    {#if s.logoUrl}
                                        <img src={s.logoUrl} alt={s.name} class="h-6 w-10 object-contain border border-slate-200 rounded" />
                                    {/if}

                                    <button
                                        type="button"
                                        onclick={() => removeSponsor(s.id)}
                                        class="p-1 text-red-500 hover:text-red-700"
                                        title="Löschen"
                                    >
                                        <Trash2 class="w-4 h-4" />
                                    </button>
                                </div>
                            {/each}

                            <button
                                type="button"
                                onclick={addSponsor}
                                class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 mt-1"
                            >
                                <Plus class="w-3.5 h-3.5" />
                                Sponsor hinzufügen
                            </button>
                        </div>
                    </div>
                </section>

                <!-- 3. Pre-printed Letterhead Mode -->
                <section class="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <FileText class="w-4 h-4 text-purple-600" />
                                {m.poster_letterhead_mode()}
                            </h3>
                            <p class="text-xs text-slate-500">
                                {m.poster_letterhead_hint()} (z. B. Briefpapier mit vorgedrucktem Logo)
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            bind:checked={isLetterheadMode}
                            class="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                        />
                    </div>

                    {#if isLetterheadMode}
                        <div class="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-lg border border-purple-200 dark:border-purple-800/60 space-y-3">
                            <div class="flex items-center justify-between text-xs font-medium">
                                <span>Freizuhaltende Kopfhöhe: <strong>{letterheadBlankHeight} mm</strong></span>
                                <input
                                    type="range"
                                    min="15"
                                    max="75"
                                    bind:value={letterheadBlankHeight}
                                    class="w-36 accent-purple-600"
                                />
                            </div>

                            <label class="flex items-center gap-2 cursor-pointer text-xs font-medium pt-2 border-t border-purple-200 dark:border-purple-800/40">
                                <input
                                    type="checkbox"
                                    bind:checked={letterheadMonochrome}
                                    class="rounded text-purple-600"
                                />
                                <span>Reiner Text / Monochrom (Keine farbigen Füllflächen, ideal für farbiges Papier)</span>
                            </label>

                            <!-- Letterhead Logo Placement (top-right QR code area or left) -->
                            <div class="space-y-2 pt-2 border-t border-purple-200 dark:border-purple-800/40">
                                <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-purple-950 dark:text-purple-200">
                                    <input
                                        type="checkbox"
                                        bind:checked={letterheadShowLogo}
                                        class="rounded text-purple-600 focus:ring-purple-500"
                                    />
                                    <span>{m.poster_letterhead_show_logo()}</span>
                                </label>

                                {#if letterheadShowLogo}
                                    <div class="flex items-center justify-between text-xs pl-6">
                                        <span class="text-slate-600 dark:text-slate-400">{m.poster_logo_position()}:</span>
                                        <div class="inline-flex rounded border border-purple-300 dark:border-purple-700 p-0.5 bg-white dark:bg-slate-800 text-[11px]">
                                            <button
                                                type="button"
                                                onclick={() => (locationLogoPosition = "right")}
                                                class="px-2 py-0.5 rounded transition {locationLogoPosition === 'right' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-300'}"
                                            >
                                                {m.poster_logo_position_right()}
                                            </button>
                                            <button
                                                type="button"
                                                onclick={() => (locationLogoPosition = "left")}
                                                class="px-2 py-0.5 rounded transition {locationLogoPosition === 'left' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-300'}"
                                            >
                                                {m.poster_logo_position_left()}
                                            </button>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </section>

                <!-- 4. Text & Header Overrides -->
                <section class="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                    <h3 class="font-bold text-slate-900 dark:text-slate-100">
                        Titel & Untertitel anpassen
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label for="posterCustomProgTitle" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                Hauptüberschrift (z. B. Programm • 10/2026)
                            </label>
                            <input
                                id="posterCustomProgTitle"
                                type="text"
                                bind:value={customProgrammeTitle}
                                placeholder={programmeMonthTitle}
                                class="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                            />
                        </div>
                        <div>
                            <label for="posterCustomProgSubtitle" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                Standort-Untertitel / Adresse
                            </label>
                            <input
                                id="posterCustomProgSubtitle"
                                type="text"
                                bind:value={customProgrammeSubtitle}
                                placeholder={programmeLocationSubtitle}
                                class="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                            />
                        </div>
                    </div>
                </section>

                <!-- 5. Content Display Elements -->
                <section class="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                    <h3 class="font-bold text-slate-900 dark:text-slate-100">
                        Elemente auf dem Poster
                    </h3>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={showTimes} class="rounded text-emerald-600" />
                            <span>Uhrzeiten anzeigen</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={visibleComponents.rooms} class="rounded text-emerald-600" />
                            <span>Räume / Säle</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={visibleComponents.ticketPrice} class="rounded text-emerald-600" />
                            <span>Eintrittspreise</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={showLocationQr} class="rounded text-emerald-600" />
                            <span>Standort-QR-Code</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={visibleComponents.qrCodes} class="rounded text-emerald-600" />
                            <span>Termin-QR-Codes</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={compressSeries} class="rounded text-emerald-600" />
                            <span>Serien komprimieren</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={visibleComponents.tags} class="rounded text-emerald-600" />
                            <span>Schlagwörter / Tags</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={visibleComponents.contacts} class="rounded text-emerald-600" />
                            <span>Beteiligte Personen / Kontakte</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={visibleComponents.participants} class="rounded text-emerald-600" />
                            <span>Teilnehmerzahl / Auslastung</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={visibleComponents.publicStatus} class="rounded text-emerald-600" />
                            <span>Öffentlich / Intern Status</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={visibleComponents.heroImage} class="rounded text-emerald-600" />
                            <span>Titelbild (Vorschaubild)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={visibleComponents.internalNotes} class="rounded text-emerald-600" />
                            <span>Interne Notizen</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={visibleComponents.openingHours} class="rounded text-emerald-600" />
                            <span>{m.component_opening_hours?.() || "Öffnungszeiten"}</span>
                        </label>
                    </div>

                    <div class="pt-2">
                        <label for="posterDescStyle" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Beschreibungen
                        </label>
                        <select
                            id="posterDescStyle"
                            bind:value={descriptionStyle}
                            class="text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                        >
                            <option value="short">1–2 Zeilen (Kompakt)</option>
                            <option value="full">Mehrzeilig</option>
                            <option value="none">Keine Beschreibung (Nur Titel)</option>
                        </select>
                    </div>
                </section>

                <!-- 6. Modifiable Sections & Content Slot Editor -->
                <section class="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <LayoutTemplate class="w-4 h-4 text-amber-500" />
                                <span>{m.custom_sections?.() ?? "Abschnitte & Zusatzbereiche"}</span>
                            </h3>
                            <p class="text-xs text-slate-500 dark:text-slate-400">
                                {m.custom_sections_desc?.() ?? "Eigene Infoblöcke, Öffnungszeiten oder Bilder in freie Bereiche des Posters platzieren."}
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            {#if currentLocation?.openingHours}
                                <button
                                    type="button"
                                    onclick={addOpeningHoursSection}
                                    class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-100"
                                    title="Öffnungszeiten als Banner/Block einfügen"
                                >
                                    <Clock class="w-3.5 h-3.5 text-amber-600" />
                                    <span>+ Öffnungszeiten</span>
                                </button>
                            {/if}
                            <button
                                type="button"
                                onclick={() => addCustomSection("banner")}
                                class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition"
                            >
                                <Plus class="w-3.5 h-3.5" />
                                <span>{m.add?.() ?? "Abschnitt hinzufügen"}</span>
                            </button>
                        </div>
                    </div>

                    {#if customSections.length === 0}
                        <div class="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                            <LayoutTemplate class="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                            <p>Noch keine benutzerdefinierten Abschnitte vorhanden.</p>
                            <p class="text-[11px] text-slate-400 mt-0.5">Erstellen Sie Infoblöcke für wichtige Hinweise, Öffnungszeiten oder Sponsorenhinweise.</p>
                        </div>
                    {:else}
                        <div class="space-y-3">
                            {#each customSections as sec (sec.id)}
                                <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2.5">
                                    <div class="flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-2 flex-1 min-w-0">
                                            <input
                                                type="checkbox"
                                                bind:checked={sec.enabled}
                                                onchange={savePrefs}
                                                class="rounded text-emerald-600 shrink-0"
                                                title="Aktivieren / Deaktivieren"
                                            />
                                            <input
                                                type="text"
                                                bind:value={sec.title}
                                                oninput={savePrefs}
                                                placeholder="Titel des Abschnitts (z. B. Öffnungszeiten, Wichtiger Hinweis)"
                                                class="text-xs font-bold p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 flex-1 min-w-0"
                                            />
                                        </div>

                                        <div class="flex items-center gap-1.5 shrink-0">
                                            <!-- Position / Slot selector -->
                                            <select
                                                bind:value={sec.slot}
                                                onchange={savePrefs}
                                                class="text-[11px] p-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                                title="Platzierung auf dem Poster"
                                            >
                                                <option value="banner">Oben (Banner unter Titel)</option>
                                                <option value="grid_top">Vor den Terminen (Spaltenkopf)</option>
                                                <option value="grid_bottom">Nach den Terminen</option>
                                                <option value="footer">Unten (Über der Fußzeile)</option>
                                            </select>

                                            <!-- Accent Color selector -->
                                            <select
                                                bind:value={sec.accentColor}
                                                onchange={savePrefs}
                                                class="text-[11px] p-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                                title="Akzentfarbe"
                                            >
                                                <option value="gold">Gold (Friedenshort)</option>
                                                <option value="red">Rot (Besonderes)</option>
                                                <option value="slate">Klassisch Grau</option>
                                                <option value="emerald">Grün</option>
                                            </select>

                                            <!-- Delete Section button -->
                                            <button
                                                type="button"
                                                onclick={() => removeCustomSection(sec.id)}
                                                class="p-1 text-slate-400 hover:text-red-600 transition"
                                                title="Abschnitt löschen"
                                            >
                                                <Trash2 class="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Content textarea -->
                                    <div>
                                        <textarea
                                            bind:value={sec.content}
                                            oninput={savePrefs}
                                            rows="2"
                                            placeholder="Inhalt / Text / Öffnungszeiten (HTML oder mehrzeiliger Text wird unterstützt)..."
                                            class="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 leading-relaxed font-mono"
                                        ></textarea>
                                    </div>

                                    <!-- Image / Media Attachment -->
                                    <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                                        <div class="flex items-center gap-2">
                                            {#if sec.imageUrl}
                                                <img src={sec.imageUrl} alt="Vorschau" class="h-7 w-12 object-contain bg-white rounded border border-slate-200 p-0.5" />
                                                <button
                                                    type="button"
                                                    onclick={() => { sec.imageUrl = ""; savePrefs(); }}
                                                    class="text-[10px] text-red-500 hover:underline"
                                                >
                                                    Bild entfernen
                                                </button>
                                            {:else}
                                                <span class="text-[11px] text-slate-400">Kein Bild angehängt</span>
                                            {/if}
                                        </div>

                                        <label class="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 font-medium text-slate-700 dark:text-slate-200">
                                            <Upload class="w-3 h-3 text-slate-400" />
                                            <span>{sec.imageUrl ? "Bild ersetzen" : "Bild hochladen"}</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                class="hidden"
                                                onchange={(e) => {
                                                    const f = e.currentTarget.files?.[0];
                                                    if (f) handleImageUpload(f, { sectionId: sec.id });
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </section>
            </div>

            <!-- Modal Footer -->
            <div class="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 rounded-b-xl">
                <button
                    type="button"
                    onclick={() => {
                        localStorage.removeItem(storageKey);
                        toast.info("Einstellungen auf Standard zurückgesetzt");
                        window.location.reload();
                    }}
                    class="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                    <RotateCcw class="w-3.5 h-3.5" />
                    Auf Standard zurücksetzen
                </button>

                <button
                    type="button"
                    onclick={() => (isSettingsOpen = false)}
                    class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md text-xs transition"
                >
                    Fertig
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    /* PREVIEW CONTAINER SIZING */
    .paper-a4 {
        width: 210mm;
        min-height: 297mm;
        max-height: 297mm;
        box-sizing: border-box;
    }

    .paper-a3 {
        width: 297mm;
        min-height: 420mm;
        max-height: 420mm;
        box-sizing: border-box;
    }

    .monochrome-mode {
        background-color: transparent !important;
        color: #000000 !important;
    }

    .monochrome-mode .poster-date-pill {
        background-color: #000000 !important;
        color: #ffffff !important;
    }

    .monochrome-mode .poster-header h1 {
        color: #000000 !important;
        border-color: #000000 !important;
    }

    .monochrome-mode .rich-description :global(*) {
        color: #000000 !important;
    }

    /* CKEDITOR RICH TEXT HTML RENDERING */
    .rich-description :global(p) {
        margin-top: 0;
        margin-bottom: 0.25rem;
    }
    .rich-description :global(p:last-child) {
        margin-bottom: 0;
    }
    .rich-description :global(ul),
    .rich-description :global(ol) {
        margin: 0.2rem 0 0.25rem 1rem;
        padding: 0;
    }
    .rich-description :global(ul) {
        list-style-type: disc;
    }
    .rich-description :global(ol) {
        list-style-type: decimal;
    }
    .rich-description :global(li) {
        margin-bottom: 0.1rem;
    }
    .rich-description :global(a) {
        color: #059669;
        text-decoration: underline;
    }
    .rich-description :global(strong),
    .rich-description :global(b) {
        font-weight: 700;
    }
    .rich-description :global(em),
    .rich-description :global(i) {
        font-style: italic;
    }
    .rich-description :global(u) {
        text-decoration: underline;
    }
    .rich-description :global(s),
    .rich-description :global(strike) {
        text-decoration: line-through;
    }
    .rich-description :global(h1),
    .rich-description :global(h2),
    .rich-description :global(h3),
    .rich-description :global(h4) {
        font-weight: 700;
        margin-top: 0.25rem;
        margin-bottom: 0.15rem;
        line-height: 1.25;
    }
    .rich-description :global(blockquote) {
        border-left: 2px solid #10b981;
        padding-left: 0.5rem;
        margin: 0.25rem 0;
        font-style: italic;
    }
    .rich-description :global(table) {
        width: 100%;
        border-collapse: collapse;
        margin: 0.25rem 0;
    }
    .rich-description :global(th),
    .rich-description :global(td) {
        border: 1px solid #e2e8f0;
        padding: 0.15rem 0.35rem;
        font-size: 0.85em;
    }

    /* ZERO-OVERFLOW GUARANTEED PRINT STYLES */
    @media print {
        @page {
            size: portrait;
            margin: 0 !important;
        }

        :global(html),
        :global(body) {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* Neutralize all parent containers to prevent flex-centering or horizontal displacement */
        :global(body > *),
        :global(main),
        main,
        .poster-preview-scaler {
            display: block !important;
            float: none !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            background: #ffffff !important;
            transform: none !important;
            overflow: visible !important;
            box-sizing: border-box !important;
        }

        .poster-sheet {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
        }

        .paper-a4 {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 !important;
        }

        .paper-a3 {
            width: 297mm !important;
            min-width: 297mm !important;
            max-width: 297mm !important;
            height: 420mm !important;
            min-height: 420mm !important;
            max-height: 420mm !important;
            margin: 0 !important;
        }

        .letterhead-blank-area {
            border: none !important;
        }

        .poster-event-item {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .rich-description :global(a) {
            color: #000000 !important;
            text-decoration: none !important;
        }

        .rich-description :global(*) {
            color: #000000 !important;
        }
    }
</style>
