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
        QrCode,
        Ticket
    } from "@lucide/svelte";
    import { summarizeFlyerItems } from "../../../routes/kiosks/[id]/view/summarize.remote";
    import type { FlyerItemSummary, FlyerDensity } from "$lib/validations/flyer";
    import { formatRecurrenceText } from "$lib/utils/format-recurrence";
    import { formatTicketPrice } from "$lib/utils/format-ticket-price";
    import { getEventRooms } from "$lib/utils/format-rooms";
    import { isSeriesItem, isNonSeriesEvent } from "$lib/utils/event-series";
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
    let showFooters = $state(false);
    let compressSeries = $state(true);
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
            name: kiosk.name || m.community_center(),
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

    // Helper to get all location IDs associated with an item (events & announcements)
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

    // Check if an item belongs to a location
    function itemBelongsToLocation(item: Event | Announcement, locId: string): boolean {
        if (locId === "default") return true;

        const itemLocIds = getItemLocationIds(item);

        // If the item has explicit locations assigned, it MUST belong to locId
        if (itemLocIds.size > 0) {
            return itemLocIds.has(locId);
        }

        // If the item has NO location specified (e.g. general news announcement):
        // Only include general announcements if kiosk has this single location
        const isAnnouncement = !("startDateTime" in item);
        return isAnnouncement && flyerLocations.length <= 1;
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
        return raw ? raw.trim() : "";
    }

    function getItemHighlight(item: Event | Announcement): string | undefined {
        return aiSummaries[item.id]?.highlight;
    }


    function handleInlineEdit(itemId: string, currentTitle: string, currentSummary: string, event: FocusEvent) {
        const el = event.target as HTMLElement;
        const newText = (el.innerHTML || el.innerText).trim();
        if (newText !== currentSummary) {
            aiSummaries[itemId] = {
                id: itemId,
                title: currentTitle,
                summary: newText
            };
            saveSummariesToCache(aiSummaries);
        }
    }

    type FlyerDisplayItem = (Event | Announcement) & {
        isCompressedSeries?: boolean;
        seriesDates?: string[];
        recurrenceText?: string;
        instanceCount?: number;
    };

    function compressSeriesEvents(eventList: Event[]): FlyerDisplayItem[] {
        if (!compressSeries) return eventList;

        const seriesGroups = new Map<string, Event[]>();
        const nonSeriesEvents: Event[] = [];

        for (const evt of eventList) {
            if (isSeriesItem(evt)) {
                const anyEvt = evt as any;
                const sKey = anyEvt.recurringEventId ||
                    (anyEvt.seriesId ? `series_${anyEvt.seriesId}` : null) ||
                    (evt.id.includes('_inst_') ? evt.id.split('_inst_')[0] : evt.id);

                const group = seriesGroups.get(sKey) || [];
                group.push(evt);
                seriesGroups.set(sKey, group);
            } else {
                nonSeriesEvents.push(evt);
            }
        }

        const compressed: FlyerDisplayItem[] = [...nonSeriesEvents];

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
                    instanceCount: dates.length
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

    interface DistributedFlyerPanels {
        flapItems: FlyerDisplayItem[];
        backAnnouncements: Announcement[];
        backEvents: FlyerDisplayItem[];
        inside1: FlyerDisplayItem[];
        inside2: FlyerDisplayItem[];
        inside3: FlyerDisplayItem[];
        total: number;
    }

    // Distribute items across the 5 available event/announcement panels:
    // Sheet 1: Flap (Left: Events), Back (Center: Announcements or Events)
    // Sheet 2: Inside 1 (Left), Inside 2 (Center), Inside 3 (Right)
    function distributeItemsForFlyer(locationItems: (Event | Announcement)[]): DistributedFlyerPanels {
        const announcements = locationItems.filter(i => !("startDateTime" in i)) as Announcement[];
        const rawEvents = (locationItems.filter(i => "startDateTime" in i) as Event[]).sort((a, b) => {
            const timeA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
            const timeB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
            return timeA - timeB;
        });

        const events = compressSeries ? compressSeriesEvents(rawEvents) : rawEvents;

        const flapItems: FlyerDisplayItem[] = [];
        const backAnnouncements: Announcement[] = [...announcements];
        const backEvents: FlyerDisplayItem[] = [];
        const inside1: FlyerDisplayItem[] = [];
        const inside2: FlyerDisplayItem[] = [];
        const inside3: FlyerDisplayItem[] = [];

        if (announcements.length > 0) {
            // Announcements take the back panel (Rückseite)
            // Events are distributed across the other 4 panels: Flap + 3 Inside panels
            const count = events.length;
            const perPanel = Math.ceil(count / 4);
            flapItems.push(...events.slice(0, perPanel));
            inside1.push(...events.slice(perPanel, perPanel * 2));
            inside2.push(...events.slice(perPanel * 2, perPanel * 3));
            inside3.push(...events.slice(perPanel * 3));
        } else {
            // No announcements: Back panel can also host events if there are many
            const count = events.length;
            if (count > 8) {
                const perPanel = Math.ceil(count / 5);
                flapItems.push(...events.slice(0, perPanel));
                backEvents.push(...events.slice(perPanel, perPanel * 2));
                inside1.push(...events.slice(perPanel * 2, perPanel * 3));
                inside2.push(...events.slice(perPanel * 3, perPanel * 4));
                inside3.push(...events.slice(perPanel * 4));
            } else {
                const perPanel = Math.ceil(count / 4);
                flapItems.push(...events.slice(0, perPanel));
                inside1.push(...events.slice(perPanel, perPanel * 2));
                inside2.push(...events.slice(perPanel * 2, perPanel * 3));
                inside3.push(...events.slice(perPanel * 3));
            }
        }

        return {
            flapItems,
            backAnnouncements,
            backEvents,
            inside1,
            inside2,
            inside3,
            total: events.length + announcements.length
        };
    }
</script>

<div class="min-h-screen bg-slate-100 dark:bg-slate-900 py-6 px-2 sm:px-4 lg:px-6 text-slate-800 dark:text-slate-100 print:bg-white print:p-0 print:m-0 print:min-h-0 print:h-auto print:text-black">
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
                                {m.flyer_specs_subtitle()}
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
                        title={m.ai_summarize_tooltip()}
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

                    <label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-medium" title={m.compress_series_tooltip()}>
                        <input type="checkbox" bind:checked={compressSeries} class="rounded text-blue-600 w-3.5 h-3.5" />
                        <RefreshCw class="w-3.5 h-3.5 text-slate-500" />
                        <span>{m.compress_series()}</span>
                    </label>

                    <label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
                        <input type="checkbox" bind:checked={showFooters} class="rounded text-blue-600 w-3.5 h-3.5" />
                        <span>{m.show_footers()}</span>
                    </label>

                    <!-- Preview Zoom controls -->
                    <div class="hidden md:flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onclick={() => zoomLevel = Math.max(0.5, zoomLevel - 0.1)}
                            class="p-1 text-slate-500 hover:text-slate-900 rounded"
                            title={m.zoom_out()}
                        >
                            <ZoomOut class="w-3.5 h-3.5" />
                        </button>
                        <span class="px-1.5 text-[10px] font-mono text-slate-600 dark:text-slate-400">{Math.round(zoomLevel * 100)}%</span>
                        <button
                            type="button"
                            onclick={() => zoomLevel = Math.min(1.2, zoomLevel + 0.1)}
                            class="p-1 text-slate-500 hover:text-slate-900 rounded"
                            title={m.zoom_in()}
                        >
                            <ZoomIn class="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- FLYER PRINT CANVAS CONTAINER -->
    <main class="max-w-6xl mx-auto flex flex-col items-center gap-10 print:m-0 print:p-0 print:gap-0 print:max-w-none print:w-auto">
        {#each displayedLocations as loc, locIdx (loc.id)}
            {@const locItems = items.filter(it => itemBelongsToLocation(it, loc.id))}
            {@const { flapItems, backAnnouncements, backEvents, inside1, inside2, inside3, total: totalItems } = distributeItemsForFlyer(locItems)}

            <div class="flyer-document-pair w-full flex flex-col items-center gap-8 print:gap-0 print:m-0">
                <!-- Location Divider Label (Screen Only) -->
                {#if displayedLocations.length > 1}
                    <div class="print:hidden w-full max-w-[297mm] flex items-center justify-between px-2 pt-2 border-t border-slate-300 dark:border-slate-700">
                        <div class="flex items-center gap-2">
                            <span class="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {m.flyer_number({ number: locIdx + 1 })}
                            </span>
                            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{loc.name}</h2>
                        </div>
                        <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {m.entry_count({ count: totalItems })}
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
                            <!-- PANEL 5: INSIDE FLAP (Left on Outside Sheet) - USED FOR EVENTS -->
                            <section class="panel panel-flap border-r border-slate-200 print:border-slate-300">
                                <div class="panel-inner p-3.5 flex flex-col h-full {showFooters ? 'justify-between' : 'justify-start gap-2'} overflow-hidden">
                                    <div class="space-y-2 overflow-hidden">
                                        <!-- Top Accent Header -->
                                        <div class="border-b-2 border-slate-900 pb-1.5 flex items-center justify-between">
                                            <div class="flex items-center gap-1.5">
                                                <Calendar class="w-3.5 h-3.5 text-blue-600" />
                                                <h3 class="text-xs font-black uppercase tracking-wider text-slate-900">
                                                    {m.events_overview()}
                                                </h3>
                                            </div>
                                            <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                {m.flyer_inside_flap()}
                                            </span>
                                        </div>

                                        <!-- Optional Location description note if space permits -->
                                        {#if loc.description && flapItems.length <= 3}
                                            <div class="rich-description text-[10px] text-slate-700 leading-snug bg-slate-50 p-1.5 rounded border border-slate-100 line-clamp-2">
                                                {@html loc.description}
                                            </div>
                                        {/if}

                                        <!-- Events on Inside Flap -->
                                        <div class="space-y-1.5 overflow-hidden">
                                            {#each flapItems as item (item.id)}
                                                {@render itemCard(item)}
                                            {/each}
                                            {#if flapItems.length === 0}
                                                <p class="text-xs text-slate-400 italic pt-4 text-center">
                                                    {m.no_events_for_location()}
                                                </p>
                                            {/if}
                                        </div>
                                    </div>

                                    {#if showFooters}
                                        <!-- Bottom note & page hint -->
                                        <div class="pt-2 border-t border-slate-200 text-[9px] text-slate-500 flex items-center justify-between shrink-0">
                                            <span>{getDateRangeTitle()}</span>
                                            <span class="font-mono text-slate-400">{m.flyer_inside_flap()}</span>
                                        </div>
                                    {/if}
                                </div>
                            </section>

                            <!-- PANEL 6: BACK COVER (Center on Outside Sheet) - ANNOUNCEMENTS OR EVENTS -->
                            <section class="panel panel-back border-r border-slate-200 print:border-slate-300">
                                <div class="panel-inner p-3.5 flex flex-col h-full {showFooters ? 'justify-between' : 'justify-start gap-2'} overflow-hidden">
                                    <div class="space-y-2 overflow-hidden">
                                        <!-- Header -->
                                        <div class="border-b-2 border-slate-900 pb-1.5 flex items-center justify-between">
                                            <div class="flex items-center gap-1.5">
                                                {#if backAnnouncements.length > 0}
                                                    <Sparkles class="w-3.5 h-3.5 text-amber-500" />
                                                    <h3 class="text-xs font-black uppercase tracking-wider text-slate-900">
                                                        {m.feature_announcements_title()}
                                                    </h3>
                                                {:else}
                                                    <Calendar class="w-3.5 h-3.5 text-blue-600" />
                                                    <h3 class="text-xs font-black uppercase tracking-wider text-slate-900">
                                                        {m.events_overview()}
                                                    </h3>
                                                {/if}
                                            </div>
                                            <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                {m.flyer_back_cover()}
                                            </span>
                                        </div>

                                        <!-- Announcements on Back Cover -->
                                        {#if backAnnouncements.length > 0}
                                            <div class="space-y-1.5 overflow-hidden">
                                                {#each backAnnouncements as ann (ann.id)}
                                                    {@render itemCard(ann)}
                                                {/each}
                                            </div>
                                        {/if}

                                        <!-- Additional Events on Back Cover -->
                                        {#if backEvents.length > 0}
                                            <div class="space-y-1.5 overflow-hidden">
                                                {#if backAnnouncements.length > 0}
                                                    <div class="text-[9px] font-bold text-slate-700 uppercase tracking-wider pt-1 border-t border-slate-200">
                                                        {m.more_events()}
                                                    </div>
                                                {/if}
                                                {#each backEvents as item (item.id)}
                                                    {@render itemCard(item)}
                                                {/each}
                                            </div>
                                        {/if}

                                        <!-- Fallback community welcome block if empty -->
                                        {#if backAnnouncements.length === 0 && backEvents.length === 0}
                                            <div class="p-2.5 rounded-lg border border-blue-100 bg-blue-50/40 text-xs text-slate-700 space-y-1.5">
                                                <div class="font-bold text-blue-900 flex items-center gap-1">
                                                    <Info class="w-3.5 h-3.5 text-blue-600" />
                                                    <span>{m.welcome_title()}</span>
                                                </div>
                                                <p class="leading-relaxed text-[11px]">
                                                    {m.welcome_description()}
                                                </p>
                                            </div>
                                        {/if}
                                    </div>

                                    {#if showFooters}
                                        <!-- Bottom Back Cover note -->
                                        <div class="pt-2 border-t border-slate-200 text-[9px] text-slate-500 flex items-center justify-between shrink-0">
                                            <span>{kiosk.name || 'AtCost'}</span>
                                            <span class="font-mono text-slate-400">{m.flyer_back_cover()}</span>
                                        </div>
                                    {/if}
                                </div>
                            </section>

                            <!-- PANEL 1: FRONT COVER (Right on Outside Sheet) - STANDORT & KONTAKT -->
                            <section class="panel panel-front relative bg-slate-900 text-white overflow-hidden flex flex-col justify-between">
                                <!-- Location Hero Image or Artwork Header -->
                                {#if loc.heroImage}
                                    <div class="hero-image-container relative h-36 w-full shrink-0 overflow-hidden">
                                        <img
                                            src={loc.heroImage}
                                            alt={loc.name}
                                            class="w-full h-full object-cover"
                                        />
                                        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                                    </div>
                                {:else}
                                    <!-- Geometric cover artwork banner -->
                                    <div class="h-28 w-full bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-950 p-3 flex flex-col justify-between relative overflow-hidden shrink-0">
                                        <div class="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/20 rounded-full blur-xl"></div>
                                        <div class="absolute -left-6 -bottom-6 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl"></div>
                                        <div class="relative z-10 flex items-center gap-1.5 text-blue-300 text-[10px] font-semibold uppercase tracking-wider">
                                            <MapPin class="w-3.5 h-3.5" />
                                            <span>{loc.city || m.events_and_culture()}</span>
                                        </div>
                                    </div>
                                {/if}

                                <!-- Front Cover Body: Location Name, Address, Room & Contact -->
                                <div class="p-3 flex-1 flex flex-col justify-between relative z-10 space-y-2 overflow-hidden">
                                    <div class="space-y-2 overflow-hidden">
                                        <!-- Date Range Badge -->
                                        <div class="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/40 text-blue-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                                            <Calendar class="w-3 h-3" />
                                            <span>{getDateRangeTitle()}</span>
                                        </div>

                                        <!-- Location Name (Headline) -->
                                        <h2 class="text-base font-black tracking-tight text-white leading-tight">
                                            {loc.name}
                                        </h2>

                                        <!-- Subtitle -->
                                        <p class="text-[10.5px] text-slate-300 font-medium leading-tight">
                                            {kiosk.name || m.program_and_schedule()}
                                        </p>

                                        <!-- Address & Venue Info -->
                                        <div class="space-y-1 text-[10.5px] text-slate-300 bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                                            {#if loc.street || loc.houseNumber}
                                                <div class="flex items-start gap-1.5">
                                                    <MapPin class="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                                                    <span>{loc.street || ''} {loc.houseNumber || ''}{loc.addressSuffix ? ` ${loc.addressSuffix}` : ''}</span>
                                                </div>
                                            {/if}
                                            {#if loc.zip || loc.city}
                                                <div class="pl-4 text-[10px] text-slate-400">
                                                    {loc.zip || ''} {loc.city || ''}
                                                </div>
                                            {/if}
                                            {#if loc.roomId}
                                                <div class="text-[9.5px] font-medium text-blue-300 bg-blue-900/60 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                                    {m.room_label({ room: loc.roomId })}
                                                </div>
                                            {/if}
                                        </div>

                                        <!-- Contact Person Card -->
                                        {#if loc.contact}
                                            <div class="p-2 rounded-lg border border-slate-700/60 bg-slate-800/60 text-[10px] text-slate-300 space-y-1">
                                                <div class="font-bold text-white flex items-center gap-1">
                                                    <User class="w-3 h-3 text-slate-400" />
                                                    <span>{loc.contact.name}</span>
                                                </div>
                                                {#if loc.contact.phone}
                                                    <div class="flex items-center gap-1 text-slate-300">
                                                        <Phone class="w-2.5 h-2.5 text-slate-400" />
                                                        <a href="tel:{loc.contact.phone}" class="hover:underline">{loc.contact.phone}</a>
                                                    </div>
                                                {/if}
                                                {#if loc.contact.email}
                                                    <div class="flex items-center gap-1 text-slate-300">
                                                        <Mail class="w-2.5 h-2.5 text-slate-400" />
                                                        <a href="mailto:{loc.contact.email}" class="hover:underline truncate">{loc.contact.email}</a>
                                                    </div>
                                                {/if}
                                            </div>
                                        {/if}

                                        <!-- Accessibility Support Notice -->
                                        {#if loc.inclusivitySupport}
                                            <div class="text-[9px] text-slate-300 flex items-start gap-1 bg-slate-800/50 p-1.5 rounded border border-slate-700/40">
                                                <CheckCircle2 class="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                                <span class="line-clamp-2">{loc.inclusivitySupport}</span>
                                            </div>
                                        {/if}
                                    </div>

                                    <!-- Bottom Front QR Code & Call to Action -->
                                    <div class="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
                                        <div>
                                            <div class="text-[10px] font-bold text-white tracking-wide uppercase">
                                                {m.event_calendar()}
                                            </div>
                                            <div class="text-[8px] text-slate-400 leading-tight">
                                                {m.scan_flyer_schedule_qr()}
                                            </div>
                                        </div>

                                        <!-- Online Calendar / Kiosk QR code -->
                                        {#if showQrCodes}
                                            <div class="bg-white p-1 rounded-md shrink-0 shadow-xs">
                                                {#if loc.contact?.qrCodeDataUrl}
                                                    <img src={loc.contact.qrCodeDataUrl} alt="Calendar QR" class="w-10 h-10 object-contain image-pixelated" />
                                                {:else if (locItems[0] as any)?.qrCodeDataUrl}
                                                    <img src={(locItems[0] as any).qrCodeDataUrl} alt="Calendar QR" class="w-10 h-10 object-contain image-pixelated" />
                                                {:else}
                                                    <div class="w-10 h-10 bg-slate-100 flex items-center justify-center text-slate-800 font-mono text-[8px] font-bold">
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
                                <div class="panel-inner p-3.5 flex flex-col h-full {showFooters ? 'justify-between' : 'justify-start gap-2'} overflow-hidden">
                                    <div class="space-y-2 overflow-hidden">
                                        <!-- Column Banner -->
                                        <div class="flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
                                            <div class="flex items-center gap-1.5">
                                                <Calendar class="w-3.5 h-3.5 text-blue-600" />
                                                <h3 class="text-xs font-black uppercase tracking-wider text-slate-900">
                                                    {m.events_overview()}
                                                </h3>
                                            </div>
                                            <span class="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">
                                                {loc.name}
                                            </span>
                                        </div>

                                        <!-- Items List -->
                                        <div class="space-y-1.5 overflow-hidden">
                                            {#each inside1 as item (item.id)}
                                                {@render itemCard(item)}
                                            {/each}
                                            {#if inside1.length === 0}
                                                <p class="text-xs text-slate-400 italic pt-4 text-center">
                                                    {m.no_events_for_location()}
                                                </p>
                                            {/if}
                                        </div>
                                    </div>
                                    {#if showFooters}
                                        <div class="text-[9px] font-mono text-slate-400 text-right pt-2 border-t border-slate-100 shrink-0">
                                            {m.flyer_panel_1()}
                                        </div>
                                    {/if}
                                </div>
                            </section>

                            <!-- INSIDE PANEL 3 (Center) -->
                            <section class="panel panel-inside-2 border-r border-slate-200 print:border-slate-300">
                                <div class="panel-inner p-3.5 flex flex-col h-full {showFooters ? 'justify-between' : 'justify-start gap-2'} overflow-hidden">
                                    <div class="space-y-2 overflow-hidden">
                                        <!-- Column Banner -->
                                        <div class="flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
                                            <div class="flex items-center gap-1.5">
                                                <Calendar class="w-3.5 h-3.5 text-blue-600" />
                                                <h3 class="text-xs font-black uppercase tracking-wider text-slate-900">
                                                    {m.events_overview()}
                                                </h3>
                                            </div>
                                            <span class="text-[10px] font-bold text-slate-500">
                                                {getDateRangeTitle()}
                                            </span>
                                        </div>

                                        <!-- Items List -->
                                        <div class="space-y-1.5 overflow-hidden">
                                            {#each inside2 as item (item.id)}
                                                {@render itemCard(item)}
                                            {/each}
                                        </div>
                                    </div>
                                    {#if showFooters}
                                        <div class="text-[9px] font-mono text-slate-400 text-right pt-2 border-t border-slate-100 shrink-0">
                                            {m.flyer_panel_2()}
                                        </div>
                                    {/if}
                                </div>
                            </section>

                            <!-- INSIDE PANEL 4 (Right) -->
                            <section class="panel panel-inside-3">
                                <div class="panel-inner p-3.5 flex flex-col h-full {showFooters ? 'justify-between' : 'justify-start gap-2'} overflow-hidden">
                                    <div class="space-y-2 overflow-hidden">
                                        <!-- Column Banner -->
                                        <div class="flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
                                            <div class="flex items-center gap-1.5">
                                                <Calendar class="w-3.5 h-3.5 text-blue-600" />
                                                <h3 class="text-xs font-black uppercase tracking-wider text-slate-900">
                                                    {m.events_overview()}
                                                </h3>
                                            </div>
                                            <span class="text-[10px] font-bold text-slate-500">
                                                {m.entry_count({ count: totalItems })}
                                            </span>
                                        </div>

                                        <!-- Items List -->
                                        <div class="space-y-1.5 overflow-hidden">
                                            {#each inside3 as item (item.id)}
                                                {@render itemCard(item)}
                                            {/each}
                                        </div>
                                    </div>
                                    {#if showFooters}
                                        <div class="text-[9px] font-mono text-slate-400 text-right pt-2 border-t border-slate-100 shrink-0">
                                            {m.flyer_panel_3()}
                                        </div>
                                    {/if}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        {/each}
    </main>
</div>

<!-- SNIPPET: ITEM CARD ON PANELS -->
{#snippet itemCard(item: FlyerDisplayItem)}
    {@const isEvent = "startDateTime" in item}
    {@const isSpecialNonSeries = isNonSeriesEvent(item)}
    {@const title = getItemTitle(item)}
    {@const summary = getItemSummary(item)}
    {@const highlight = getItemHighlight(item)}
    {@const rooms = isEvent ? getEventRooms(item as Event) : []}
    {@const eventQr = isEvent ? ((item as any).qrCodeDataUrl || (item as any).qrCodePath || `/api/events/${item.id}/qr.png`) : null}
    {@const displayPrice = isEvent ? formatTicketPrice((item as Event).ticketPrice, (item as Event).ticketPriceUnknown) : null}

    <article class="event-item-card p-2 rounded-lg transition-all space-y-1 print:break-inside-avoid {isSpecialNonSeries ? 'border-amber-400/90 bg-linear-to-r from-amber-50/70 via-amber-50/20 to-white shadow-xs border-l-4 border-l-amber-500 ring-1 ring-amber-400/30' : 'border border-slate-200/90 bg-white hover:border-slate-300'}">
        <!-- Date Badge & Meta Row -->
        {#if isEvent && item.isCompressedSeries && item.seriesDates && item.seriesDates.length > 1}
            <!-- Compressed Series View: Recurrence pattern + multiple date tags -->
            <div class="space-y-1">
                <div class="flex items-center justify-between gap-1.5 flex-wrap">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <!-- Recurrence pattern badge -->
                        <span class="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                            <RefreshCw class="w-2.5 h-2.5 text-indigo-500" />
                            <span>{item.recurrenceText || m.series_badge()}</span>
                        </span>
                        <!-- Shared Time -->
                        <div class="text-[9.5px] text-slate-600 font-medium flex items-center gap-0.5">
                            <Clock class="w-2.5 h-2.5 text-slate-400" />
                            <span>{formatTimeRange((item as Event).startDateTime, (item as Event).endDateTime, (item as Event).isAllDay)}</span>
                        </div>
                        <!-- Price Badge -->
                        {#if displayPrice}
                            <span class="text-[8.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 shrink-0">
                                <Ticket class="w-2.5 h-2.5 text-emerald-600" />
                                <span>{displayPrice}</span>
                            </span>
                        {/if}
                    </div>

                    <!-- Room or Highlight Badge -->
                    {#if highlight}
                        <span class="text-[8.5px] font-bold bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded truncate max-w-[90px]">
                            {highlight}
                        </span>
                    {:else if rooms.length > 0}
                        <span class="text-[8.5px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                            {rooms[0]}
                        </span>
                    {/if}
                </div>

                <!-- Multiple dates list -->
                <div class="flex items-center gap-1 flex-wrap pt-0.5">
                    {#each item.seriesDates as dateStr}
                        <span class="bg-slate-900 text-white px-1.5 py-0.5 rounded text-[8.5px] font-bold tracking-tight">
                            {formatDay(dateStr)} {formatMonth(dateStr)}
                        </span>
                    {/each}
                </div>
            </div>
        {:else}
            <!-- Standard single item row -->
            <div class="flex items-center justify-between gap-1.5">
                {#if isEvent}
                    {@const isSeries = isSeriesItem(item)}
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <!-- Date badge -->
                        <div class="{isSpecialNonSeries ? 'bg-amber-600 text-white shadow-2xs font-black' : 'bg-slate-900 text-white'} px-1.5 py-0.5 rounded text-[9.5px] font-bold tracking-tight">
                            {formatDay((item as Event).startDateTime)} {formatMonth((item as Event).startDateTime)}
                        </div>
                        <!-- Time -->
                        <div class="text-[9.5px] text-slate-600 font-medium flex items-center gap-0.5">
                            <Clock class="w-2.5 h-2.5 text-slate-400" />
                            <span>{formatTimeRange((item as Event).startDateTime, (item as Event).endDateTime, (item as Event).isAllDay)}</span>
                        </div>
                        <!-- Special Non-Series Highlight Badge -->
                        {#if isSpecialNonSeries}
                            <span class="text-[8.5px] font-black bg-amber-500 text-white border border-amber-600 px-1.5 py-0.5 rounded inline-flex items-center gap-1 shadow-2xs uppercase tracking-tight" title={m.special_event_tooltip()}>
                                <Sparkles class="w-2.5 h-2.5 text-amber-100" />
                                <span>{m.special_event_badge()}</span>
                            </span>
                        {/if}
                        <!-- Series entry badge -->
                        {#if isSeries}
                            <span class="text-[8.5px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 px-1 py-0.2 rounded inline-flex items-center gap-0.5">
                                <RefreshCw class="w-2.5 h-2.5 text-indigo-500" />
                                <span>{item.recurrenceText || m.series_badge()}</span>
                            </span>
                        {/if}
                        <!-- Price Badge -->
                        {#if displayPrice}
                            <span class="text-[8.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 shrink-0">
                                <Ticket class="w-2.5 h-2.5 text-emerald-600" />
                                <span>{displayPrice}</span>
                            </span>
                        {/if}
                    </div>
                {:else}
                    <div class="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-tight">
                        {m.news_badge()}
                    </div>
                {/if}

                <!-- Room or Highlight Badge -->
                {#if highlight}
                    <span class="text-[8.5px] font-bold bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded truncate max-w-[90px]">
                        {highlight}
                    </span>
                {:else if rooms.length > 0}
                    <span class="text-[8.5px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                        {rooms[0]}
                    </span>
                {/if}
            </div>
        {/if}

        <!-- Content Row: Title & Summary on Left, Optional Event QR on Right -->
        <div class="flex items-start justify-between gap-1.5">
            <div class="flex-1 min-w-0 space-y-0.5">
                <!-- Title -->
                <h4 class="text-[11.5px] font-bold text-slate-900 leading-tight">
                    {title}
                </h4>

                <!-- Summary (Editable inline) -->
                {#if showDescriptions && summary}
                    <div
                        class="rich-description text-[10px] text-slate-600 leading-snug {density === 'compact' ? 'line-clamp-3' : density === 'standard' ? 'line-clamp-5' : 'line-clamp-10'} outline-hidden focus:bg-amber-50 focus:p-1 rounded cursor-text"
                        contenteditable="true"
                        onblur={(e) => handleInlineEdit(item.id, title, summary, e)}
                        title={m.edit_summary_tooltip()}
                    >
                        {@html summary}
                    </div>
                {/if}
            </div>

            {#if showEventQrCodes && eventQr}
                <div class="shrink-0 flex flex-col items-center pt-0.5">
                    <div class="p-0.5 bg-white border border-slate-200/90 rounded shadow-2xs">
                        <img
                            src={eventQr}
                            alt="Event QR"
                            class="w-10 h-10 print:w-9 print:h-9 object-contain image-pixelated"
                            loading="lazy"
                        />
                    </div>
                    <span class="text-[7.5px] text-slate-400 font-medium tracking-tight mt-0.5 print:hidden">{m.scan_info()}</span>
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
        max-height: 210mm;
        width: 297mm;
        box-sizing: border-box;
        overflow: hidden;
    }

    .panel {
        width: 99mm;
        height: 210mm;
        max-height: 210mm;
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
        max-height: 210mm;
        box-sizing: border-box;
        overflow: hidden;
    }

    .rich-description :global(p) {
        margin-top: 0;
        margin-bottom: 0.15rem;
        display: inline;
    }

    .rich-description :global(p + p) {
        display: block;
        margin-top: 0.15rem;
    }

    .rich-description :global(ul),
    .rich-description :global(ol) {
        margin: 0.15rem 0 0.15rem 1rem;
        padding: 0;
    }

    .rich-description :global(li) {
        margin-bottom: 0.1rem;
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

    /* PRINT STYLES - ZERO OVERFLOW GUARANTEED */
    @media print {
        @page {
            size: 297mm 210mm;
            margin: 0;
        }

        :global(html),
        :global(body) {
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm !important;
            height: auto !important;
            min-height: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        .flyer-document-pair {
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
        }

        .flyer-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            width: 297mm !important;
            height: 209.5mm !important;
            max-height: 209.5mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .flyer-sheet {
            width: 297mm !important;
            height: 209.5mm !important;
            max-width: 297mm !important;
            max-height: 209.5mm !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
        }

        /* Prevent blank trailing page after the last sheet of the document */
        .flyer-document-pair:last-child .flyer-wrapper:last-child .flyer-sheet {
            page-break-after: auto !important;
            break-after: auto !important;
        }

        .sheet-grid {
            width: 297mm !important;
            height: 209.5mm !important;
            max-height: 209.5mm !important;
            grid-template-columns: 99mm 99mm 99mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
        }

        .panel {
            width: 99mm !important;
            height: 209.5mm !important;
            max-height: 209.5mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .panel-inner {
            height: 209.5mm !important;
            max-height: 209.5mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
        }


        .fold-line {
            border-left: 1px dashed #cbd5e1 !important;
        }

        .fold-indicator {
            display: none !important;
        }

        .event-item-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
    }
</style>
