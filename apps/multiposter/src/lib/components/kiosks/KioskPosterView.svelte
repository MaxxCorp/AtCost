<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { type Event, type Announcement } from "@ac/validations";
    import {
        Printer,
        Sparkles,
        RotateCcw,
        MapPin,
        Calendar,
        Clock,
        Phone,
        Mail,
        FileText,
        ZoomIn,
        ZoomOut,
        Maximize2,
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
        Eye,
        EyeOff,
        Upload,
        CheckCircle2,
        Globe
    } from "@lucide/svelte";
    import { uploadMedia } from "../../../routes/cms/media/create.remote";
    import { formatRecurrenceText } from "#lib/utils/format-recurrence.js";
    import { formatTicketPrice, isEventFree } from "#lib/utils/format-ticket-price.js";
    import { getEventRooms } from "#lib/utils/format-rooms.js";
    import { isSeriesItem, getSeriesRootId } from "#lib/utils/event-series.js";
    import { isMultiDayEvent } from "#lib/utils/format-event-date.js";
    import * as m from "#lib/paraglide/messages.js";
    import { toast } from "svelte-sonner";
    import { browser } from '$app/env';

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
        heroImage?: string | null;
        description?: string | null;
        contact?: LocationContact | null;
    }

    interface SponsorItem {
        id: string;
        name: string;
        logoUrl: string;
    }

    type PosterDisplayItem = (Event | Announcement) & {
        isCompressedSeries?: boolean;
        seriesDates?: string[];
        recurrenceText?: string;
        instanceCount?: number;
        qrCodePath?: string | null;
        qrCodeDataUrl?: string | null;
    };

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
    let customLocationLogoUrl = $state<string>("");
    let locationLogoHeight = $state<number>(42); // in pixels

    let effectiveLocationLogo = $derived(
        customLocationLogoUrl.trim() || currentLocation?.heroImage || ""
    );

    let showSponsors = $state<boolean>(true);
    let sponsorSectionTitle = $state<string>("Gefördert durch / Partner");
    let sponsorPosition = $state<"footer" | "header">("footer");
    let sponsors = $state<SponsorItem[]>([
        // Helpful default sample sponsor if empty
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

    // --- State: Content toggles ---
    let showDescriptions = $state<boolean>(true);
    let descriptionStyle = $state<"short" | "full" | "none">("short");
    let showTimes = $state<boolean>(true);
    let showRooms = $state<boolean>(true);
    let showPrices = $state<boolean>(true);
    let showTags = $state<boolean>(false);
    let showLocationQr = $state<boolean>(true);
    let compressSeries = $state<boolean>(true);
    let customProgrammeTitle = $state<string>("");
    let customProgrammeSubtitle = $state<string>("");

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
                if (prefs.customLocationLogoUrl !== undefined) customLocationLogoUrl = prefs.customLocationLogoUrl;
                if (prefs.locationLogoHeight !== undefined) locationLogoHeight = prefs.locationLogoHeight;
                if (prefs.showSponsors !== undefined) showSponsors = prefs.showSponsors;
                if (prefs.sponsorSectionTitle !== undefined) sponsorSectionTitle = prefs.sponsorSectionTitle;
                if (prefs.sponsorPosition !== undefined) sponsorPosition = prefs.sponsorPosition;
                if (Array.isArray(prefs.sponsors)) sponsors = prefs.sponsors;
                if (prefs.isLetterheadMode !== undefined) isLetterheadMode = prefs.isLetterheadMode;
                if (prefs.letterheadBlankHeight !== undefined) letterheadBlankHeight = prefs.letterheadBlankHeight;
                if (prefs.letterheadMonochrome !== undefined) letterheadMonochrome = prefs.letterheadMonochrome;
                if (prefs.showDescriptions !== undefined) showDescriptions = prefs.showDescriptions;
                if (prefs.descriptionStyle !== undefined) descriptionStyle = prefs.descriptionStyle;
                if (prefs.showTimes !== undefined) showTimes = prefs.showTimes;
                if (prefs.showRooms !== undefined) showRooms = prefs.showRooms;
                if (prefs.showPrices !== undefined) showPrices = prefs.showPrices;
                if (prefs.showTags !== undefined) showTags = prefs.showTags;
                if (prefs.showLocationQr !== undefined) showLocationQr = prefs.showLocationQr;
                if (prefs.compressSeries !== undefined) compressSeries = prefs.compressSeries;
                if (prefs.customProgrammeTitle !== undefined) customProgrammeTitle = prefs.customProgrammeTitle;
                if (prefs.customProgrammeSubtitle !== undefined) customProgrammeSubtitle = prefs.customProgrammeSubtitle;
                if (prefs.activeLocationId && posterLocations.some(l => l.id === prefs.activeLocationId)) {
                    activeLocationId = prefs.activeLocationId;
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
                customLocationLogoUrl,
                locationLogoHeight,
                showSponsors,
                sponsorSectionTitle,
                sponsorPosition,
                sponsors,
                isLetterheadMode,
                letterheadBlankHeight,
                letterheadMonochrome,
                showDescriptions,
                descriptionStyle,
                showTimes,
                showRooms,
                showPrices,
                showTags,
                showLocationQr,
                compressSeries,
                customProgrammeTitle,
                customProgrammeSubtitle,
                activeLocationId
            };
            localStorage.setItem(storageKey, JSON.stringify(prefs));
        } catch (e) {
            console.error("Failed to save poster preferences", e);
        }
    }

    // Auto-save on relevant changes
    $effect(() => {
        // Track state variables
        const _ = [
            paperSize, columns, density, showLocationLogo, customLocationLogoUrl,
            locationLogoHeight, showSponsors, sponsorSectionTitle, sponsorPosition,
            sponsors, isLetterheadMode, letterheadBlankHeight, letterheadMonochrome,
            showDescriptions, descriptionStyle, showTimes, showRooms, showPrices,
            showTags, showLocationQr, compressSeries, customProgrammeTitle,
            customProgrammeSubtitle, activeLocationId
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

    // Compress repeating series
    function compressSeriesEvents(eventList: Event[]): PosterDisplayItem[] {
        if (!compressSeries) return eventList;

        const seriesGroups = new Map<string, Event[]>();
        const nonSeriesEvents: Event[] = [];

        for (const evt of eventList) {
            if (isSeriesItem(evt)) {
                const sKey = getSeriesRootId(evt) || evt.id;
                const group = seriesGroups.get(sKey) || [];
                group.push(evt);
                seriesGroups.set(sKey, group);
            } else {
                nonSeriesEvents.push(evt);
            }
        }

        const compressed: PosterDisplayItem[] = [...nonSeriesEvents];

        for (const [sKey, group] of seriesGroups) {
            group.sort((a, b) => {
                const tA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
                const tB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
                return tA - tB;
            });

            const first = group[0];
            const dateSet = new Set<string>();
            const dates: string[] = [];

            for (const g of group) {
                if (g.startDateTime) {
                    const d = new Date(g.startDateTime);
                    if (!isNaN(d.getTime())) {
                        const iso = d.toISOString();
                        const dTime = d.getTime();
                        if (!dateSet.has(String(dTime))) {
                            dateSet.add(String(dTime));
                            dates.push(iso);
                        }
                    }
                }
            }

            let rruleStr: string | null = null;
            for (const g of group) {
                if (g.recurrence && Array.isArray(g.recurrence) && g.recurrence[0]) {
                    rruleStr = g.recurrence[0];
                    break;
                } else if (typeof (g as any).recurrence === 'string' && (g as any).recurrence.length > 0) {
                    rruleStr = (g as any).recurrence;
                    break;
                }
            }

            const recText = formatRecurrenceText(rruleStr, undefined, { omitLength: true });

            if (dates.length > 1) {
                compressed.push({
                    ...first,
                    id: sKey,
                    isCompressedSeries: true,
                    seriesDates: dates,
                    recurrenceText: recText,
                    instanceCount: dates.length,
                    qrCodePath: `/api/events/${sKey}/qr.png`
                });
            } else {
                compressed.push({
                    ...first,
                    recurrenceText: recText
                });
            }
        }

        compressed.sort((a, b) => {
            const timeA = "startDateTime" in a && a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
            const timeB = "startDateTime" in b && b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
            return timeA - timeB;
        });

        return compressed;
    }

    // Processed final display items
    let displayItems = $derived.by<PosterDisplayItem[]>(() => {
        const events = locationFilteredItems.filter(i => "startDateTime" in i) as Event[];
        const announcements = locationFilteredItems.filter(i => !("startDateTime" in i)) as Announcement[];
        const processedEvents = compressSeries ? compressSeriesEvents(events) : events;

        const combined: PosterDisplayItem[] = [...processedEvents, ...announcements];
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

    // Month & Date Range derivation for Programme Title
    let programmeMonthTitle = $derived.by<string>(() => {
        if (customProgrammeTitle.trim()) return customProgrammeTitle.trim();

        // Check if kiosk dates provided
        if (kiosk.startDate) {
            const d = new Date(kiosk.startDate);
            if (!isNaN(d.getTime())) {
                const monthName = d.toLocaleDateString(undefined, { month: "long" });
                const year = d.getFullYear();
                return `${m.poster_monthly_programme()} • ${monthName} ${year}`;
            }
        }

        // Try to get month from earliest event
        if (displayItems.length > 0) {
            const firstEvt = displayItems.find(i => "startDateTime" in i && i.startDateTime);
            if (firstEvt && "startDateTime" in firstEvt && firstEvt.startDateTime) {
                const d = new Date(firstEvt.startDateTime);
                if (!isNaN(d.getTime())) {
                    const monthName = d.toLocaleDateString(undefined, { month: "long" });
                    const year = d.getFullYear();
                    return `${m.poster_monthly_programme()} • ${monthName} ${year}`;
                }
            }
        }

        const now = new Date();
        const monthName = now.toLocaleDateString(undefined, { month: "long" });
        return `${m.poster_monthly_programme()} • ${monthName} ${now.getFullYear()}`;
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

    // Formatting date helpers
    function formatDayNum(dateStr?: string | null): string {
        if (!dateStr) return "--";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "--" : d.toLocaleDateString(undefined, { day: "2-digit" });
    }

    function formatWeekday(dateStr?: string | null): string {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
    }

    function formatMonth(dateStr?: string | null): string {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
    }

    function formatTime(startStr?: string | null, endStr?: string | null, isAllDay = false): string {
        if (isAllDay) return "Ganztägig";
        if (!startStr) return "";
        const s = new Date(startStr);
        if (isNaN(s.getTime())) return "";
        const sStr = s.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        if (!endStr) return sStr;
        const e = new Date(endStr);
        if (isNaN(e.getTime())) return sStr;
        const eStr = e.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        return `${sStr} – ${eStr} Uhr`;
    }

    function formatPillDate(dateStr: string): string {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
    }

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
        // Trigger check when items, density, columns or letterhead change
        const _ = [displayItems.length, density, effectiveColumns, isLetterheadMode, paperSize, showDescriptions, descriptionStyle];
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
    function triggerPrint() {
        if (browser) {
            window.print();
        }
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

    // Image Upload helper for Sponsor or Location Logo
    async function handleImageUpload(e: globalThis.Event, target: "location" | { sponsorId: string }) {
        const input = e.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];
        if (!file.type.startsWith("image/")) {
            toast.error("Nur Bilddateien (PNG, JPG, SVG, WebP) erlaubt");
            return;
        }

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                // Attempt remote upload if possible, otherwise use base64 data URL
                try {
                    const res = await uploadMedia({
                        filename: file.name,
                        contentType: file.type,
                        content: base64
                    });
                    const url = res.success && res.urls?.default ? res.urls.default : base64;
                    if (target === "location") {
                        customLocationLogoUrl = url;
                    } else {
                        const s = sponsors.find(sp => sp.id === target.sponsorId);
                        if (s) s.logoUrl = url;
                    }
                    toast.success("Logo erfolgreich hinzugefügt");
                } catch {
                    // Fallback to data URL
                    if (target === "location") {
                        customLocationLogoUrl = base64;
                    } else {
                        const s = sponsors.find(sp => sp.id === target.sponsorId);
                        if (s) s.logoUrl = base64;
                    }
                    toast.success("Logo gespeichert");
                }
            };
        } catch (err) {
            console.error(err);
            toast.error("Upload fehlgeschlagen");
        }
    }
</script>

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

        <!-- Center: Quick Toggles (Logos, Letterhead, Density, Paper) -->
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
<main class="w-full min-h-[calc(100vh-60px)] bg-slate-200 dark:bg-slate-950 p-4 sm:p-8 flex justify-center items-start overflow-auto print:p-0 print:m-0 print:bg-white print:min-h-0">
    <div
        class="poster-preview-scaler transition-transform duration-150 origin-top flex justify-center print:transform-none print:w-full"
        style="transform: scale({zoomLevel});"
    >
        <!-- The Poster Document Sheet (Single Page A4 or A3) -->
        <article
            bind:this={posterContentElement}
            class="poster-sheet {paperSize === 'A3' ? 'paper-a3' : 'paper-a4'} {letterheadMonochrome ? 'monochrome-mode' : ''} bg-white text-slate-900 shadow-2xl print:shadow-none print:border-none relative flex flex-col justify-between"
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
                <header class="poster-header px-8 pt-6 pb-4 border-b-2 border-slate-900 flex justify-between items-start gap-6">
                    <!-- Left: Location Branding & Venue Info -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-4 mb-2">
                            {#if showLocationLogo && !isLetterheadMode && effectiveLocationLogo}
                                <div class="location-logo-wrap shrink-0">
                                    <img
                                        src={effectiveLocationLogo}
                                        alt={currentLocation?.name || "Logo"}
                                        class="object-contain max-w-[180px]"
                                        style="height: {locationLogoHeight}px;"
                                    />
                                </div>
                            {/if}

                            <div>
                                <h2 class="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                                    {currentLocation?.name || "Kultur- & Begegnungszentrum"}
                                </h2>
                                <p class="text-xs text-slate-600 font-medium">
                                    {programmeLocationSubtitle}
                                </p>
                            </div>
                        </div>

                        <!-- Main Programme Headline -->
                        <div class="mt-3">
                            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-900 border-l-4 border-emerald-600 pl-3">
                                {programmeMonthTitle}
                            </h1>
                        </div>
                    </div>

                    <!-- Right Header: Location QR Code or Top Sponsors -->
                    <div class="flex flex-col items-end gap-3 shrink-0">
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

                        {#if showLocationQr}
                            <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-1.5 print:bg-transparent">
                                {#if currentLocation?.contact?.qrCodeDataUrl || currentLocation?.contact?.qrCodePath}
                                    <img
                                        src={currentLocation.contact.qrCodeDataUrl || currentLocation.contact.qrCodePath}
                                        alt="QR Code"
                                        class="w-12 h-12 shrink-0 object-contain"
                                    />
                                {:else}
                                    <div class="w-12 h-12 bg-slate-100 flex items-center justify-center border border-slate-200 rounded shrink-0">
                                        <QrCode class="w-8 h-8 text-slate-700" />
                                    </div>
                                {/if}
                                <div class="text-[10px] leading-tight text-slate-600 hidden sm:block">
                                    <span class="font-bold block text-slate-800">Online-Programm</span>
                                    <span>Aktuelle Infos & Termine</span>
                                </div>
                            </div>
                        {/if}
                    </div>
                </header>
            </div>

            <!-- Middle Section: Programme Event Grid (Single Page Flow) -->
            <div
                class="poster-events-grid flex-1 px-8 py-5"
                style="column-count: {effectiveColumns}; column-gap: 2rem; {effectiveColumns > 1 ? 'column-rule: 1px solid #e2e8f0;' : ''}"
            >
                {#if displayItems.length === 0}
                    <div class="py-16 text-center text-slate-400">
                        <Calendar class="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p class="font-medium text-base">Keine Termine für diesen Monat ausgewählt.</p>
                        <p class="text-xs">Prüfen Sie den Datumsbereich oder die Filtereinstellungen des Kiosks.</p>
                    </div>
                {:else}
                    {#each displayItems as item, idx (item.id || idx)}
                        {@const isEvt = "startDateTime" in item}
                        {@const evt = item as PosterDisplayItem}
                        {@const dateStr = isEvt ? (item as Event).startDateTime : (item as Announcement).createdAt}
                        {@const durationDays = isEvt ? isMultiDayEvent(item as Event) : false}
                        {@const rooms = isEvt ? getEventRooms(item as Event) : []}
                        {@const priceStr = isEvt ? formatTicketPrice((item as Event).ticketPrice, (item as Event).ticketPriceUnknown) : ""}
                        {@const isFree = isEvt ? isEventFree((item as Event).ticketPrice, (item as Event).ticketPriceUnknown) : false}

                        <!-- Single Programme Entry (Avoid breaking inside columns) -->
                        <div class="poster-event-item mb-4 pb-3 border-b border-slate-100 break-inside-avoid {density === 'compact' ? 'mb-2.5 pb-2 text-[11px]' : density === 'relaxed' ? 'mb-5 pb-4 text-[13px]' : 'text-xs'}">
                            <div class="flex items-start gap-3">
                                <!-- Date Badge Block -->
                                <div class="poster-date-pill shrink-0 flex flex-col items-center justify-center w-11 py-1 rounded bg-slate-900 text-white font-mono text-center">
                                    <span class="text-[9px] font-bold tracking-wider uppercase text-emerald-300 leading-none">
                                        {formatWeekday(dateStr)}
                                    </span>
                                    <span class="text-base font-black leading-none my-0.5">
                                        {formatDayNum(dateStr)}
                                    </span>
                                    <span class="text-[8px] uppercase tracking-wider text-slate-300 leading-none">
                                        {formatMonth(dateStr)}
                                    </span>
                                </div>

                                <!-- Event Details -->
                                <div class="flex-1 min-w-0">
                                    <!-- Meta: Time, Rooms, Price -->
                                    <div class="flex items-center flex-wrap gap-2 text-slate-500 font-medium mb-0.5 text-[10px]">
                                        {#if showTimes && isEvt}
                                            <span class="inline-flex items-center gap-1 font-bold text-slate-800">
                                                <Clock class="w-3 h-3 text-emerald-600 shrink-0" />
                                                {formatTime((item as Event).startDateTime, (item as Event).endDateTime, (item as Event).isAllDay)}
                                            </span>
                                        {/if}

                                        {#if showRooms && rooms.length > 0}
                                            <span class="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded text-[9px]">
                                                <MapPin class="w-2.5 h-2.5 text-slate-400" />
                                                {rooms.join(", ")}
                                            </span>
                                        {/if}

                                        {#if showPrices && priceStr}
                                            <span class="inline-flex items-center gap-0.5 font-semibold {isFree ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700 bg-slate-100'} px-1.5 py-0.2 rounded text-[9px]">
                                                <Ticket class="w-2.5 h-2.5" />
                                                {priceStr}
                                            </span>
                                        {/if}
                                    </div>

                                    <!-- Title -->
                                    <h3 class="font-bold text-slate-900 leading-snug tracking-tight {density === 'compact' ? 'text-xs' : density === 'relaxed' ? 'text-sm' : 'text-[13px]'}">
                                        {isEvt ? (item as Event).summary : (item as Announcement).title}
                                    </h3>

                                    <!-- Compressed Series Recurring Dates Pill -->
                                    {#if evt.isCompressedSeries && evt.seriesDates && evt.seriesDates.length > 1}
                                        <div class="mt-1 flex items-center flex-wrap gap-1">
                                            {#if evt.recurrenceText}
                                                <span class="text-[9px] font-bold text-emerald-800 uppercase tracking-wide bg-emerald-50 px-1.5 py-0.5 rounded">
                                                    {evt.recurrenceText}
                                                </span>
                                            {/if}
                                            <span class="text-[9px] text-slate-500">Termine:</span>
                                            {#each evt.seriesDates as sDate}
                                                <span class="text-[9px] font-mono px-1 py-0.2 bg-slate-100 border border-slate-200 rounded text-slate-700">
                                                    {formatPillDate(sDate)}
                                                </span>
                                            {/each}
                                        </div>
                                    {/if}

                                    <!-- Description -->
                                    {#if showDescriptions && descriptionStyle !== "none"}
                                        {@const rawDesc = isEvt ? (item as Event).description : (item as Announcement).content}
                                        {#if rawDesc && rawDesc.trim()}
                                            <p class="mt-0.5 text-slate-600 leading-relaxed font-normal {descriptionStyle === 'short' ? 'line-clamp-1' : 'line-clamp-3'} text-[10px]">
                                                {rawDesc.trim()}
                                            </p>
                                        {/if}
                                    {/if}

                                    <!-- Optional tags -->
                                    {#if showTags && (item as any).tags && (item as any).tags.length > 0}
                                        <div class="mt-1 flex items-center gap-1 flex-wrap">
                                            {#each (item as any).tags as t}
                                                <span class="text-[8px] px-1 py-0.2 bg-slate-100 text-slate-500 rounded">
                                                    #{t.name || t.tag?.name || t}
                                                </span>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

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
                            <input
                                id="posterCustomLogoUrl"
                                type="url"
                                bind:value={customLocationLogoUrl}
                                placeholder="https://example.com/logo.svg"
                                class="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-emerald-500 mb-2"
                            />

                            <div class="flex items-center justify-between text-xs">
                                <span>Logo-Höhe ({locationLogoHeight}px):</span>
                                <input
                                    type="range"
                                    min="24"
                                    max="70"
                                    bind:value={locationLogoHeight}
                                    class="w-28 accent-emerald-600"
                                />
                            </div>
                        </div>

                        {#if effectiveLocationLogo}
                            <div class="col-span-full flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <span class="text-xs text-slate-500 font-medium">Vorschau:</span>
                                <img
                                    src={effectiveLocationLogo}
                                    alt="Logo Vorschau"
                                    class="max-h-10 object-contain p-1 bg-white border border-slate-200 rounded"
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
                                Hauptüberschrift (z. B. Monatsprogramm)
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
                            <input type="checkbox" bind:checked={showRooms} class="rounded text-emerald-600" />
                            <span>Räume / Säle</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={showPrices} class="rounded text-emerald-600" />
                            <span>Eintrittspreise</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={showLocationQr} class="rounded text-emerald-600" />
                            <span>Standort-QR-Code</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={compressSeries} class="rounded text-emerald-600" />
                            <span>Wöchentliche Serien komprimieren</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" bind:checked={showTags} class="rounded text-emerald-600" />
                            <span>Schlagwörter / Tags</span>
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
                            <option value="short">1 Zeile (Kompakt)</option>
                            <option value="full">Mehrzeilig</option>
                            <option value="none">Keine Beschreibung (Nur Titel)</option>
                        </select>
                    </div>
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

    /* ZERO-OVERFLOW GUARANTEED PRINT STYLES */
    @media print {
        @page {
            size: portrait;
            margin: 0;
        }

        :global(html),
        :global(body) {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        main {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
        }

        .poster-preview-scaler {
            transform: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        .poster-sheet {
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
            height: 297mm !important;
            max-height: 297mm !important;
        }

        .paper-a3 {
            width: 297mm !important;
            height: 420mm !important;
            max-height: 420mm !important;
        }

        .letterhead-blank-area {
            border: none !important;
        }

        .poster-event-item {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
    }
</style>
