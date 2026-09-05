<script lang="ts">
    import { onMount, untrack } from "svelte";
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
        User,
        ArrowLeft,
        Compass,
        CheckCircle2,
        AlertCircle,
        FileText,
        Info,
        FoldVertical,
        ZoomIn,
        ZoomOut,
        Maximize2,
        RefreshCw,
        QrCode
    } from "@lucide/svelte";
    import { summarizeFlyerItems } from "../../../routes/kiosks/[id]/view/summarize.remote";
    import type { FlyerItemSummary, FlyerDensity } from "$lib/validations/flyer";
    import { formatRecurrenceText } from "$lib/utils/format-recurrence";
    import { getEventRooms } from "$lib/utils/format-rooms";
    import * as m from "$lib/paraglide/messages";
    import { resolve } from "$app/paths";
    import { toast } from "svelte-sonner";
    import { browser } from "$app/environment";

    interface LocationContact {
        name: string;
        email?: string;
        phone?: string;
        qrCodePath?: string;
        qrCodeDataUrl?: string;
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
        what3words?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        heroImage?: string | null;
        description?: string | null;
        contact?: LocationContact | null;
    }

    type EnrichedEvent = Event & {
        qrCodeDataUrl?: string;
    };

    type EnrichedAnnouncement = Announcement & {
        qrCodeDataUrl?: string;
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
            loopDuration?: number;
        }
    } = $props();

    // View & Layout state
    let activeLocationId = $state<string>("all");
    let showFoldGuides = $state(true);
    let showQrCodes = $state(true);
    let showEventQrCodes = $state<boolean>(untrack(() => (kiosk as any)?.showEventQrCodes ?? false));
    let showDescriptions = $state(true);
    let density = $state<FlyerDensity>("standard");
    let zoomLevel = $state<number>(0.85); // Preview zoom scale
    let isSummarizing = $state(false);

    // Summaries map: item.id -> FlyerItemSummary
    let aiSummaries = $state<Record<string, FlyerItemSummary>>({});
    let hasAiSummaries = $derived(Object.keys(aiSummaries).length > 0);

    // Locations list from kiosk, or fallback default location
    let flyerLocations = $derived.by<LocationInfo[]>(() => {
        if (kiosk.locations && kiosk.locations.length > 0) {
            return kiosk.locations;
        }
        return [{
            id: "default",
            name: kiosk.name || "Community Center",
            street: null,
            houseNumber: null,
            addressSuffix: null,
            zip: null,
            city: null,
            state: null,
            country: null,
            roomId: null,
            capacity: null,
            inclusivitySupport: null,
            what3words: null,
            latitude: null,
            longitude: null,
            heroImage: null,
            description: kiosk.description || null,
            contact: null
        }];
    });

    // Determine displayed flyers based on activeLocationId
    let displayedLocations = $derived(
        activeLocationId === "all"
            ? flyerLocations
            : flyerLocations.filter(l => l.id === activeLocationId)
    );

    // Check if an item belongs to a location
    function itemBelongsToLocation(item: Event | Announcement, locId: string): boolean {
        if (locId === "default" || flyerLocations.length <= 1) return true;

        if ("locations" in item && Array.isArray((item as any).locations)) {
            const locs = (item as any).locations;
            if (locs.length === 0) return true; // General item for all locations
            return locs.some((l: any) => (l.id === locId || l.locationId === locId));
        }

        if ("locationIds" in item && Array.isArray((item as any).locationIds)) {
            const ids = (item as any).locationIds;
            if (ids.length === 0) return true;
            return ids.includes(locId);
        }

        return true;
    }

    // Load cached summaries from localStorage on mount
    onMount(() => {
        if (!browser || !kiosk.id) return;
        try {
            const cached = localStorage.getItem(`flyer_ai_summaries_${kiosk.id}`);
            if (cached) {
                aiSummaries = JSON.parse(cached);
            }
        } catch (e) {
            console.error("Failed to load cached flyer summaries", e);
        }
    });

    // Save summaries to localStorage when updated
    function saveSummariesToCache(summaries: Record<string, FlyerItemSummary>) {
        if (!browser || !kiosk.id) return;
        try {
            localStorage.setItem(`flyer_ai_summaries_${kiosk.id}`, JSON.stringify(summaries));
        } catch (e) {
            console.error("Failed to save flyer summaries", e);
        }
    }

    // Call AI summarizer remote function
    async function handleAiSummarize() {
        if (isSummarizing || !kiosk.id || items.length === 0) return;
        isSummarizing = true;
        try {
            const flyerInputItems = items.map(item => {
                const isEvt = "startDateTime" in item;
                const title = isEvt ? (item as Event).summary : (item as Announcement).title;
                const desc = isEvt ? (item as Event).description : (item as Announcement).content;
                const locNames = "locations" in item && Array.isArray((item as any).locations)
                    ? (item as any).locations.map((l: any) => l.name || l.location?.name).filter(Boolean)
                    : [];
                const roomNames = isEvt ? getEventRooms(item as Event) : [];

                return {
                    id: item.id,
                    title: title || "Untitled",
                    description: desc || null,
                    startDateTime: isEvt ? ((item as Event).startDateTime || null) : null,
                    endDateTime: isEvt ? ((item as Event).endDateTime || null) : null,
                    type: isEvt ? ("event" as const) : ("announcement" as const),
                    locationNames: locNames,
                    roomNames: roomNames
                };
            });

            const result = await summarizeFlyerItems({
                kioskId: kiosk.id,
                targetDensity: density,
                items: flyerInputItems
            });

            if (result.success && result.summaries) {
                aiSummaries = { ...aiSummaries, ...result.summaries };
                saveSummariesToCache(aiSummaries);
                if (result.fallback) {
                    toast.info(m.ai_summary_applied());
                } else {
                    toast.success(m.ai_summary_applied());
                }
            } else if (result.error) {
                toast.error(result.error);
            }
        } catch (e: any) {
            console.error("Flyer summarization error", e);
            toast.error(e?.message || m.something_went_wrong());
        } finally {
            isSummarizing = false;
        }
    }

    function resetSummaries() {
        aiSummaries = {};
        if (browser && kiosk.id) {
            localStorage.removeItem(`flyer_ai_summaries_${kiosk.id}`);
        }
        toast.info(m.reset_original_text());
    }

    function triggerPrint() {
        if (browser) {
            window.print();
        }
    }

    function formatDay(dateStr?: string | null) {
        if (!dateStr) return "--";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "--" : d.toLocaleDateString(undefined, { day: "2-digit" });
    }

    function formatMonth(dateStr?: string | null) {
        if (!dateStr) return "---";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "---" : d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
    }

    function formatWeekday(dateStr?: string | null) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { weekday: "short" });
    }

    function formatTimeRange(startStr?: string | null, endStr?: string | null, isAllDay = false) {
        if (isAllDay) return m.all_day_label();
        if (!startStr) return "";
        const start = new Date(startStr);
        if (isNaN(start.getTime())) return "";
        const startFormatted = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

        if (!endStr) return startFormatted;
        const end = new Date(endStr);
        if (isNaN(end.getTime())) return startFormatted;
        const endFormatted = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

        return `${startFormatted} – ${endFormatted}`;
    }

    function getDateRangeTitle(): string {
        if (kiosk.startDate && kiosk.endDate) {
            const s = new Date(kiosk.startDate);
            const e = new Date(kiosk.endDate);
            if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
                const sStr = s.toLocaleDateString(undefined, { day: "numeric", month: "short" });
                const eStr = e.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                return `${sStr} – ${eStr}`;
            }
        }
        const now = new Date();
        return now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }

    function getItemTitle(item: Event | Announcement): string {
        if (aiSummaries[item.id]?.title) {
            return aiSummaries[item.id].title;
        }
        return "startDateTime" in item ? (item as Event).summary : (item as Announcement).title;
    }

    function getItemSummary(item: Event | Announcement): string {
        if (aiSummaries[item.id]?.summary) {
            return aiSummaries[item.id].summary;
        }
        const raw = "startDateTime" in item ? (item as Event).description : (item as Announcement).content;
        return raw ? raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
    }

    function getItemHighlight(item: Event | Announcement): string | undefined {
        return aiSummaries[item.id]?.highlight;
    }

    function isSeriesItem(item: Event | Announcement): boolean {
        const itemAny = item as Record<string, any>;
        return Boolean(
            itemAny.isSeries ||
            itemAny.seriesId ||
            itemAny.recurringEventId ||
            (Array.isArray(itemAny.recurrence) && itemAny.recurrence.length > 0)
        );
    }

    function handleInlineEdit(itemId: string, currentTitle: string, currentSummary: string, event: FocusEvent) {
        const el = event.target as HTMLElement;
        const newText = el.innerText.trim();
        if (newText !== currentSummary) {
            aiSummaries[itemId] = {
                id: itemId,
                title: currentTitle,
                summary: newText
            };
            saveSummariesToCache(aiSummaries);
        }
    }

    // Split events across 3 inside panels evenly or distribute
    function distributeItemsAcrossPanels(locationItems: (Event | Announcement)[]) {
        const panel1: (Event | Announcement)[] = [];
        const panel2: (Event | Announcement)[] = [];
        const panel3: (Event | Announcement)[] = [];

        // Sort items chronologically
        const sorted = [...locationItems].sort((a, b) => {
            const dateA = "startDateTime" in a && a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
            const dateB = "startDateTime" in b && b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
            return dateA - dateB;
        });

        const count = sorted.length;
        const perPanel = Math.ceil(count / 3);

        for (let i = 0; i < count; i++) {
            if (i < perPanel) {
                panel1.push(sorted[i]);
            } else if (i < perPanel * 2) {
                panel2.push(sorted[i]);
            } else {
                panel3.push(sorted[i]);
            }
        }

        return { panel1, panel2, panel3, total: count };
    }
</script>

<div class="min-h-screen bg-slate-100 dark:bg-slate-900 py-6 px-2 sm:px-4 lg:px-6 text-slate-800 dark:text-slate-100 print:bg-white print:p-0 print:m-0 print:text-black">
    <!-- SCREEN ONLY: Floating Toolbar & Controls -->
    <header class="max-w-6xl mx-auto mb-6 print:hidden">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4">
            <!-- Row 1: Title, Back link, Location picker & Print CTA -->
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <a
                        href={resolve('/kiosks')}
                        class="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors inline-flex items-center gap-1.5 text-sm font-medium"
                        title={m.back_to_kiosks_btn()}
                    >
                        <ArrowLeft class="w-4 h-4" />
                        <span class="hidden sm:inline">{m.back_to_kiosks_btn()}</span>
                    </a>
                    <div class="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                    <div class="flex items-center gap-2.5">
                        <div class="p-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg">
                            <FoldVertical class="w-5 h-5" />
                        </div>
                        <div>
                            <h1 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                {m.folded_flyer_print_template()}
                            </h1>
                            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                A4 Landscape • Double-Sided • Folds into 1/3 A4 (3 Panels)
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Primary Print Action -->
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        onclick={triggerPrint}
                        class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-sm hover:shadow transition-all"
                    >
                        <Printer class="w-4 h-4" />
                        <span>{activeLocationId === 'all' && flyerLocations.length > 1 ? m.print_all_flyers() : m.print_flyer()}</span>
                    </button>
                </div>
            </div>

            <!-- Row 2: Location Switcher & AI Summarization Controls -->
            <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                <!-- Location Selector (one flyer per location) -->
                {#if flyerLocations.length > 1}
                    <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onclick={() => activeLocationId = "all"}
                            class="px-2.5 py-1 rounded-lg font-medium transition-colors {activeLocationId === 'all' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
                        >
                            {m.all_locations_flyers({ count: flyerLocations.length })}
                        </button>
                        {#each flyerLocations as loc (loc.id)}
                            <button
                                type="button"
                                onclick={() => activeLocationId = loc.id}
                                class="px-2.5 py-1 rounded-lg font-medium transition-colors truncate max-w-[140px] {activeLocationId === loc.id ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
                                title={loc.name}
                            >
                                {loc.name}
                            </button>
                        {/each}
                    </div>
                {/if}

                <!-- AI Summarization Controls -->
                <div class="flex flex-wrap items-center gap-2">
                    <!-- Density Selector -->
                    <div class="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onclick={() => density = "compact"}
                            class="px-2 py-1 rounded-lg font-medium transition-colors {density === 'compact' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 dark:text-slate-400'}"
                        >
                            {m.ai_density_compact()}
                        </button>
                        <button
                            type="button"
                            onclick={() => density = "standard"}
                            class="px-2 py-1 rounded-lg font-medium transition-colors {density === 'standard' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 dark:text-slate-400'}"
                        >
                            {m.ai_density_standard()}
                        </button>
                        <button
                            type="button"
                            onclick={() => density = "detailed"}
                            class="px-2 py-1 rounded-lg font-medium transition-colors {density === 'detailed' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 dark:text-slate-400'}"
                        >
                            {m.ai_density_detailed()}
                        </button>
                    </div>

                    <!-- AI Summarize Button -->
                    <button
                        type="button"
                        onclick={handleAiSummarize}
                        disabled={isSummarizing || items.length === 0}
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl shadow-xs transition-colors disabled:opacity-50"
                        title="Use AI to adapt text length for tri-fold brochure panels"
                    >
                        <Sparkles class="w-3.5 h-3.5 {isSummarizing ? 'animate-spin' : ''}" />
                        <span>{isSummarizing ? m.summarizing_with_ai() : m.summarize_with_ai()}</span>
                    </button>

                    {#if hasAiSummaries}
                        <button
                            type="button"
                            onclick={resetSummaries}
                            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            title={m.reset_original_text()}
                        >
                            <RotateCcw class="w-3.5 h-3.5" />
                            <span>{m.reset_original_text()}</span>
                        </button>
                    {/if}

                    <!-- Guides & Options -->
                    <label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
                        <input type="checkbox" bind:checked={showFoldGuides} class="rounded text-blue-600 w-3.5 h-3.5" />
                        <span>{m.fold_guides()}</span>
                    </label>

                    <label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
                        <input type="checkbox" bind:checked={showQrCodes} class="rounded text-blue-600 w-3.5 h-3.5" />
                        <span>{m.show_qr_codes()}</span>
                    </label>

                    <label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-medium" title={m.show_event_qr_codes()}>
                        <input type="checkbox" bind:checked={showEventQrCodes} class="rounded text-blue-600 w-3.5 h-3.5" />
                        <QrCode class="w-3.5 h-3.5 text-slate-500" />
                        <span>{m.event_qr_codes()}</span>
                    </label>

                    <!-- Preview Zoom controls -->
                    <div class="hidden md:flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onclick={() => zoomLevel = Math.max(0.5, zoomLevel - 0.1)}
                            class="p-1 text-slate-500 hover:text-slate-900 rounded"
                            title="Zoom Out"
                        >
                            <ZoomOut class="w-3.5 h-3.5" />
                        </button>
                        <span class="px-1.5 text-[10px] font-mono text-slate-600 dark:text-slate-400">{Math.round(zoomLevel * 100)}%</span>
                        <button
                            type="button"
                            onclick={() => zoomLevel = Math.min(1.2, zoomLevel + 0.1)}
                            class="p-1 text-slate-500 hover:text-slate-900 rounded"
                            title="Zoom In"
                        >
                            <ZoomIn class="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- FLYER PRINT CANVAS CONTAINER -->
    <main class="max-w-6xl mx-auto flex flex-col items-center gap-10 print:m-0 print:p-0 print:gap-0">
        {#each displayedLocations as loc, locIdx (loc.id)}
            {@const locItems = items.filter(it => itemBelongsToLocation(it, loc.id))}
            {@const { panel1, panel2, panel3, total: totalItems } = distributeItemsAcrossPanels(locItems)}
            {@const announcements = locItems.filter(i => !("startDateTime" in i)) as EnrichedAnnouncement[]}

            <div class="flyer-document-pair w-full flex flex-col items-center gap-8 print:gap-0 print:m-0">
                <!-- Location Divider Label (Screen Only) -->
                {#if displayedLocations.length > 1}
                    <div class="print:hidden w-full max-w-[297mm] flex items-center justify-between px-2 pt-2 border-t border-slate-300 dark:border-slate-700">
                        <div class="flex items-center gap-2">
                            <span class="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                Flyer #{locIdx + 1}
                            </span>
                            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{loc.name}</h2>
                        </div>
                        <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {totalItems} {totalItems === 1 ? m.event_label() : m.feature_events_title()}
                        </span>
                    </div>
                {/if}

                <!-- SHEET 1: OUTSIDE (Flap / Back Cover / Front Cover) -->
                <div class="flyer-wrapper w-full flex justify-center overflow-x-auto print:overflow-visible">
                    <div
                        class="flyer-sheet side-outside bg-white text-black shadow-xl print:shadow-none relative"
                        style="--zoom: {zoomLevel}; transform-origin: top center;"
                    >
                        <!-- Fold marks / guides on screen and print if enabled -->
                        {#if showFoldGuides}
                            <div class="fold-line fold-line-1">
                                <span class="fold-indicator">{m.fold_here()}</span>
                            </div>
                            <div class="fold-line fold-line-2">
                                <span class="fold-indicator">{m.fold_here()}</span>
                            </div>
                        {/if}

                        <div class="sheet-grid">
                            <!-- PANEL 5: INSIDE FLAP (Left on Outside Sheet) -->
                            <section class="panel panel-flap border-r border-slate-200 print:border-slate-300">
                                <div class="panel-inner p-5 flex flex-col h-full justify-between">
                                    <div class="space-y-4">
                                        <!-- Top Accent Header -->
                                        <div class="border-b-2 border-slate-900 pb-2">
                                            <span class="text-[10px] font-bold tracking-widest uppercase text-slate-500">
                                                {m.flyer_inside_flap()}
                                            </span>
                                            <h3 class="text-base font-extrabold text-slate-900 leading-tight flex items-center gap-1.5 mt-0.5">
                                                <Sparkles class="w-4 h-4 text-amber-500" />
                                                {m.flyer_highlights_title()}
                                            </h3>
                                        </div>

                                        <!-- Location description or intro note -->
                                        {#if loc.description}
                                            <div class="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                {loc.description}
                                            </div>
                                        {/if}

                                        <!-- Announcements on Inside Flap -->
                                        {#if announcements.length > 0}
                                            <div class="space-y-2.5">
                                                <div class="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                                                    {m.feature_announcements_title()}
                                                </div>
                                                {#each announcements.slice(0, 3) as ann (ann.id)}
                                                    <div class="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 space-y-1">
                                                        <h4 class="text-xs font-bold text-slate-900 leading-snug">
                                                            {getItemTitle(ann)}
                                                        </h4>
                                                        {#if showDescriptions}
                                                            <p
                                                                class="text-[11px] text-slate-700 leading-normal"
                                                                contenteditable="true"
                                                                onblur={(e) => handleInlineEdit(ann.id, getItemTitle(ann), getItemSummary(ann), e)}
                                                                title={m.edit_summary_tooltip()}
                                                            >
                                                                {getItemSummary(ann)}
                                                            </p>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            </div>
                                        {:else}
                                            <!-- Fallback community welcome block -->
                                            <div class="p-3 rounded-lg border border-blue-100 bg-blue-50/40 text-xs text-slate-700 space-y-2">
                                                <div class="font-bold text-blue-900 flex items-center gap-1">
                                                    <Info class="w-3.5 h-3.5" />
                                                    <span>Welcome</span>
                                                </div>
                                                <p class="leading-relaxed">
                                                    Discover our current program of events, activities, and community sessions. Open to everyone.
                                                </p>
                                            </div>
                                        {/if}
                                    </div>

                                    <!-- Bottom note & page hint -->
                                    <div class="pt-3 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
                                        <span>{getDateRangeTitle()}</span>
                                        <span class="font-mono text-slate-400">1/3 A4</span>
                                    </div>
                                </div>
                            </section>

                            <!-- PANEL 6: BACK COVER (Center on Outside Sheet) -->
                            <section class="panel panel-back border-r border-slate-200 print:border-slate-300">
                                <div class="panel-inner p-5 flex flex-col h-full justify-between">
                                    <div class="space-y-4">
                                        <!-- Header -->
                                        <div class="border-b-2 border-slate-900 pb-2">
                                            <span class="text-[10px] font-bold tracking-widest uppercase text-slate-500">
                                                {m.flyer_back_cover()}
                                            </span>
                                            <h3 class="text-base font-extrabold text-slate-900 leading-tight flex items-center gap-1.5 mt-0.5">
                                                <MapPin class="w-4 h-4 text-blue-600" />
                                                {m.contact_and_location()}
                                            </h3>
                                        </div>

                                        <!-- Address & Venue Info -->
                                        <div class="space-y-2 text-xs text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                                            <div class="font-bold text-slate-900 text-sm">{loc.name}</div>
                                            {#if loc.street || loc.houseNumber}
                                                <div class="flex items-start gap-1.5 text-slate-700">
                                                    <MapPin class="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                                                    <span>{loc.street || ''} {loc.houseNumber || ''}{loc.addressSuffix ? ` ${loc.addressSuffix}` : ''}</span>
                                                </div>
                                            {/if}
                                            {#if loc.zip || loc.city}
                                                <div class="text-slate-700 pl-5">
                                                    {loc.zip || ''} {loc.city || ''}
                                                </div>
                                            {/if}
                                            {#if loc.roomId}
                                                <div class="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-block">
                                                    Room: {loc.roomId}
                                                </div>
                                            {/if}
                                        </div>

                                        <!-- Inclusivity & Accessibility -->
                                        {#if loc.inclusivitySupport}
                                            <div class="p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-700 bg-white space-y-1">
                                                <div class="font-semibold text-slate-900 flex items-center gap-1">
                                                    <CheckCircle2 class="w-3 h-3 text-emerald-600" />
                                                    <span>Accessibility & Inclusivity</span>
                                                </div>
                                                <p>{loc.inclusivitySupport}</p>
                                            </div>
                                        {/if}

                                        <!-- Contact Card -->
                                        {#if loc.contact}
                                            <div class="p-3 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                                                <div class="font-bold text-slate-900 flex items-center gap-1.5">
                                                    <User class="w-3.5 h-3.5 text-slate-500" />
                                                    <span>{loc.contact.name}</span>
                                                </div>
                                                {#if loc.contact.phone}
                                                    <div class="flex items-center gap-1.5 text-slate-700 text-[11px]">
                                                        <Phone class="w-3 h-3 text-slate-400" />
                                                        <a href="tel:{loc.contact.phone}" class="hover:underline">{loc.contact.phone}</a>
                                                    </div>
                                                {/if}
                                                {#if loc.contact.email}
                                                    <div class="flex items-center gap-1.5 text-slate-700 text-[11px]">
                                                        <Mail class="w-3 h-3 text-slate-400" />
                                                        <a href="mailto:{loc.contact.email}" class="hover:underline truncate">{loc.contact.email}</a>
                                                    </div>
                                                {/if}
                                            </div>
                                        {/if}

                                        <!-- What3Words / Location coordinate note -->
                                        {#if loc.what3words}
                                            <div class="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                                                <Compass class="w-3 h-3 text-red-500" />
                                                <span>///{loc.what3words}</span>
                                            </div>
                                        {/if}
                                    </div>

                                    <!-- Bottom Contact QR or Imprint -->
                                    <div class="pt-3 border-t border-slate-200 flex items-center justify-between">
                                        {#if showQrCodes && (loc.contact?.qrCodeDataUrl || loc.contact?.qrCodePath)}
                                            <div class="flex items-center gap-2">
                                                <img
                                                    src={loc.contact.qrCodeDataUrl || loc.contact.qrCodePath}
                                                    alt="Location Contact QR"
                                                    class="w-12 h-12 border border-slate-200 rounded p-0.5"
                                                />
                                                <div class="text-[9px] text-slate-500 font-medium leading-tight">
                                                    {m.scan_vcard_qr()}
                                                </div>
                                            </div>
                                        {:else}
                                            <div class="text-[9px] text-slate-400 font-medium">
                                                {kiosk.name || 'AC Multiposter'}
                                            </div>
                                        {/if}
                                        <span class="text-[9px] text-slate-400">Printed Flyer</span>
                                    </div>
                                </div>
                            </section>

                            <!-- PANEL 1: FRONT COVER (Right on Outside Sheet) -->
                            <!-- When folded into 1/3 A4, this is the very front of the brochure! -->
                            <section class="panel panel-front relative bg-slate-900 text-white overflow-hidden flex flex-col justify-between">
                                <!-- Location Hero Image (Dynamic visual element depending on location) -->
                                {#if loc.heroImage}
                                    <div class="hero-image-container relative h-48 w-full shrink-0 overflow-hidden">
                                        <img
                                            src={loc.heroImage}
                                            alt={loc.name}
                                            class="w-full h-full object-cover"
                                        />
                                        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                                    </div>
                                {:else}
                                    <!-- Elegant geometric cover artwork banner if no image is set -->
                                    <div class="h-44 w-full bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-950 p-5 flex flex-col justify-between relative overflow-hidden shrink-0">
                                        <div class="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/20 rounded-full blur-xl"></div>
                                        <div class="absolute -left-8 -bottom-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-xl"></div>
                                        <div class="relative z-10 flex items-center gap-2 text-blue-300 text-xs font-semibold uppercase tracking-wider">
                                            <MapPin class="w-4 h-4" />
                                            <span>{loc.city || 'Events & Culture'}</span>
                                        </div>
                                    </div>
                                {/if}

                                <!-- Front Cover Content -->
                                <div class="p-5 flex-1 flex flex-col justify-between relative z-10 space-y-4">
                                    <div class="space-y-2.5">
                                        <!-- Date Range Badge -->
                                        <div class="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/40 text-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                                            <Calendar class="w-3 h-3" />
                                            <span>{getDateRangeTitle()}</span>
                                        </div>

                                        <!-- Location Name (Headline) -->
                                        <h2 class="text-xl font-black tracking-tight text-white leading-tight">
                                            {loc.name}
                                        </h2>

                                        <!-- Kiosk Name / Subtitle -->
                                        <p class="text-xs text-slate-300 font-medium leading-relaxed">
                                            {kiosk.name || 'Program & Schedule'}
                                        </p>

                                        <!-- Address snippet -->
                                        {#if loc.street || loc.city}
                                            <p class="text-[11px] text-slate-400">
                                                {loc.street || ''} {loc.houseNumber || ''} • {loc.zip || ''} {loc.city || ''}
                                            </p>
                                        {/if}
                                    </div>

                                    <!-- Bottom Front QR Code & Call to Action -->
                                    <div class="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                                        <div>
                                            <div class="text-[11px] font-bold text-white tracking-wide uppercase">
                                                Event Calendar
                                            </div>
                                            <div class="text-[9px] text-slate-400">
                                                {m.scan_flyer_schedule_qr()}
                                            </div>
                                        </div>

                                        <!-- Online Calendar / Kiosk QR code -->
                                        {#if showQrCodes}
                                            <div class="bg-white p-1 rounded-lg shrink-0 shadow-sm">
                                                {#if loc.contact?.qrCodeDataUrl}
                                                    <img src={loc.contact.qrCodeDataUrl} alt="Calendar QR" class="w-11 h-11" />
                                                {:else if (locItems[0] as any)?.qrCodeDataUrl}
                                                    <img src={(locItems[0] as any).qrCodeDataUrl} alt="Calendar QR" class="w-11 h-11" />
                                                {:else}
                                                    <div class="w-11 h-11 bg-slate-100 flex items-center justify-center text-slate-800 font-mono text-[9px] font-bold">
                                                        QR
                                                    </div>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>

                <!-- SHEET 2: INSIDE SPREAD (3 Continuous Panels: Left, Center, Right) -->
                <div class="flyer-wrapper w-full flex justify-center overflow-x-auto print:overflow-visible">
                    <div
                        class="flyer-sheet side-inside bg-white text-black shadow-xl print:shadow-none relative"
                        style="--zoom: {zoomLevel}; transform-origin: top center;"
                    >
                        <!-- Fold marks / guides on screen and print if enabled -->
                        {#if showFoldGuides}
                            <div class="fold-line fold-line-1">
                                <span class="fold-indicator">{m.fold_here()}</span>
                            </div>
                            <div class="fold-line fold-line-2">
                                <span class="fold-indicator">{m.fold_here()}</span>
                            </div>
                        {/if}

                        <div class="sheet-grid">
                            <!-- INSIDE PANEL 2 (Left) -->
                            <section class="panel panel-inside-1 border-r border-slate-200 print:border-slate-300">
                                <div class="panel-inner p-4 flex flex-col h-full justify-between">
                                    <div class="space-y-3">
                                        <!-- Column Banner -->
                                        <div class="flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
                                            <span class="text-xs font-black uppercase tracking-wider text-slate-900">
                                                {m.flyer_panel_1()}
                                            </span>
                                            <span class="text-[10px] font-bold text-slate-500">
                                                {loc.name}
                                            </span>
                                        </div>

                                        <!-- Items List -->
                                        <div class="space-y-2.5">
                                            {#each panel1 as item (item.id)}
                                                {@render itemCard(item)}
                                            {/each}
                                            {#if panel1.length === 0}
                                                <p class="text-xs text-slate-400 italic pt-4 text-center">
                                                    {m.no_events_for_location()}
                                                </p>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="text-[9px] font-mono text-slate-400 text-right pt-2">
                                        Panel 1
                                    </div>
                                </div>
                            </section>

                            <!-- INSIDE PANEL 3 (Center) -->
                            <section class="panel panel-inside-2 border-r border-slate-200 print:border-slate-300">
                                <div class="panel-inner p-4 flex flex-col h-full justify-between">
                                    <div class="space-y-3">
                                        <!-- Column Banner -->
                                        <div class="flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
                                            <span class="text-xs font-black uppercase tracking-wider text-slate-900">
                                                {m.flyer_panel_2()}
                                            </span>
                                            <span class="text-[10px] font-bold text-slate-500">
                                                {getDateRangeTitle()}
                                            </span>
                                        </div>

                                        <!-- Items List -->
                                        <div class="space-y-2.5">
                                            {#each panel2 as item (item.id)}
                                                {@render itemCard(item)}
                                            {/each}
                                        </div>
                                    </div>
                                    <div class="text-[9px] font-mono text-slate-400 text-right pt-2">
                                        Panel 2
                                    </div>
                                </div>
                            </section>

                            <!-- INSIDE PANEL 4 (Right) -->
                            <section class="panel panel-inside-3">
                                <div class="panel-inner p-4 flex flex-col h-full justify-between">
                                    <div class="space-y-3">
                                        <!-- Column Banner -->
                                        <div class="flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
                                            <span class="text-xs font-black uppercase tracking-wider text-slate-900">
                                                {m.flyer_panel_3()}
                                            </span>
                                            <span class="text-[10px] font-bold text-slate-500">
                                                {totalItems} {totalItems === 1 ? 'Entry' : 'Entries'}
                                            </span>
                                        </div>

                                        <!-- Items List -->
                                        <div class="space-y-2.5">
                                            {#each panel3 as item (item.id)}
                                                {@render itemCard(item)}
                                            {/each}
                                        </div>
                                    </div>
                                    <div class="text-[9px] font-mono text-slate-400 text-right pt-2">
                                        Panel 3
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        {/each}
    </main>
</div>

<!-- SNIPPET: ITEM CARD ON INSIDE PANELS -->
{#snippet itemCard(item: Event | Announcement)}
    {@const isEvent = "startDateTime" in item}
    {@const title = getItemTitle(item)}
    {@const summary = getItemSummary(item)}
    {@const highlight = getItemHighlight(item)}
    {@const rooms = isEvent ? getEventRooms(item as Event) : []}
    {@const eventQr = isEvent ? ((item as any).qrCodeDataUrl || (item as any).qrCodePath || `/api/events/${item.id}/qr.png`) : null}

    <article class="event-item-card p-2.5 rounded-lg border border-slate-200/90 bg-white hover:border-slate-300 transition-colors space-y-1.5 print:break-inside-avoid">
        <!-- Date Badge & Meta Row -->
        <div class="flex items-center justify-between gap-2">
            {#if isEvent}
                {@const isSeries = isSeriesItem(item)}
                <div class="flex items-center gap-1.5 flex-wrap">
                    <!-- Date badge -->
                    <div class="bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight">
                        {formatDay((item as Event).startDateTime)} {formatMonth((item as Event).startDateTime)}
                    </div>
                    <!-- Time -->
                    <div class="text-[10px] text-slate-600 font-medium flex items-center gap-0.5">
                        <Clock class="w-2.5 h-2.5 text-slate-400" />
                        <span>{formatTimeRange((item as Event).startDateTime, (item as Event).endDateTime, (item as Event).isAllDay)}</span>
                    </div>
                    <!-- Series entry badge -->
                    {#if isSeries}
                        <span class="text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 px-1 py-0.2 rounded inline-flex items-center gap-0.5">
                            <RefreshCw class="w-2.5 h-2.5 text-indigo-500" />
                            <span>Series</span>
                        </span>
                    {/if}
                </div>
            {:else}
                <div class="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight">
                    News
                </div>
            {/if}

            <!-- Room or Highlight Badge -->
            {#if highlight}
                <span class="text-[9px] font-bold bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded">
                    {highlight}
                </span>
            {:else if rooms.length > 0}
                <span class="text-[9px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                    {rooms[0]}
                </span>
            {/if}
        </div>

        <!-- Content Row: Title & Summary on Left, Optional Event QR on Right -->
        <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0 space-y-1">
                <!-- Title -->
                <h4 class="text-xs font-bold text-slate-900 leading-snug">
                    {title}
                </h4>

                <!-- Summary (Editable inline) -->
                {#if showDescriptions && summary}
                    <p
                        class="text-[11px] text-slate-700 leading-normal line-clamp-3 print:line-clamp-none outline-hidden focus:bg-amber-50 focus:p-1 rounded cursor-text"
                        contenteditable="true"
                        onblur={(e) => handleInlineEdit(item.id, title, summary, e)}
                        title={m.edit_summary_tooltip()}
                    >
                        {summary}
                    </p>
                {/if}
            </div>

            {#if showEventQrCodes && eventQr}
                <div class="shrink-0 flex flex-col items-center pt-0.5">
                    <div class="p-0.5 bg-white border border-slate-200/90 rounded shadow-2xs">
                        <img
                            src={eventQr}
                            alt="Event QR"
                            class="w-11 h-11 object-contain print:w-10 print:h-10 image-pixelated"
                            loading="lazy"
                        />
                    </div>
                </div>
            {/if}
        </div>
    </article>
{/snippet}

<style>
    /* Exact physical A4 Landscape dimensions */
    .flyer-sheet {
        width: 297mm;
        height: 210mm;
        max-width: 297mm;
        max-height: 210mm;
        box-sizing: border-box;
        overflow: hidden;
        border-radius: 4px;
        transform: scale(var(--zoom, 1));
        margin-bottom: calc((1 - var(--zoom, 1)) * -100mm);
    }

    /* 3 equal tri-fold columns: 99mm each */
    .sheet-grid {
        display: grid;
        grid-template-columns: 99mm 99mm 99mm;
        height: 210mm;
        width: 297mm;
        box-sizing: border-box;
    }

    .panel {
        width: 99mm;
        height: 210mm;
        box-sizing: border-box;
        overflow: hidden;
    }

    .image-pixelated {
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
        image-rendering: pixelated;
    }

    .panel-inner {
        height: 210mm;
        box-sizing: border-box;
    }

    /* Subtle fold lines at 99mm and 198mm marks */
    .fold-line {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1px;
        border-left: 1px dashed rgba(148, 163, 184, 0.6);
        pointer-events: none;
        z-index: 30;
    }

    .fold-line-1 {
        left: 99mm;
    }

    .fold-line-2 {
        left: 198mm;
    }

    .fold-indicator {
        position: absolute;
        top: 4px;
        left: 4px;
        font-size: 8px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: rgba(148, 163, 184, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    /* PRINT STYLES */
    @media print {
        @page {
            size: A4 landscape;
            margin: 0;
        }

        :global(html),
        :global(body) {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .flyer-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
        }

        .flyer-sheet {
            width: 297mm !important;
            height: 210mm !important;
            max-width: 297mm !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
            page-break-after: always !important;
            break-after: page !important;
            border-radius: 0 !important;
            box-shadow: none !important;
        }

        .flyer-document-pair {
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            gap: 0 !important;
        }

        .fold-line {
            border-left: 1px dashed #cbd5e1 !important;
        }

        .fold-indicator {
            display: none !important;
        }
    }
</style>
