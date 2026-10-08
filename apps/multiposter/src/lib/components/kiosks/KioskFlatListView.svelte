<script lang="ts">
    import { onMount } from "svelte";
    import { type Event, type Announcement } from "@ac/validations";
    import { 
        Printer, 
        Calendar, 
        MapPin, 
        RefreshCw, 
        Megaphone, 
        FileText, 
        ArrowLeft, 
        Clock, 
        User,
        Users,
        UserCheck,
        Phone,
        Mail,
        Ticket,
        Globe,
        Lock,
        Tag,
        QrCode,
        SlidersHorizontal,
        ChevronDown,
        Check
    } from "@lucide/svelte";
    import { formatRecurrenceText } from "#lib/utils/format-recurrence.js";
    import { formatTicketPrice, isEventFree } from "#lib/utils/format-ticket-price.js";
    import { getEventRooms } from "#lib/utils/format-rooms.js";
    import { isSeriesItem, isNonSeriesEvent } from "#lib/utils/event-series.js";
    import { isMultiDayEvent, getEventDurationDays, getEventDateParts } from "#lib/utils/format-event-date.js";
    import * as m from "#lib/paraglide/messages.js";
    import { resolve } from '$app/paths';

    interface LocationInfo {
        id: string;
        name: string;
        street: string | null;
        houseNumber: string | null;
        zip: string | null;
        city: string | null;
        country: string | null;
        contact: {
            name: string;
            email?: string;
            phone?: string;
            qrCodePath?: string;
            qrCodeDataUrl?: string;
        } | null;
    }

    type EnrichedEvent = Event & { 
        qrCodeDataUrl?: string;
        isCompressedSeries?: boolean;
        seriesDates?: string[];
        recurrenceText?: string;
        instanceCount?: number;
    };
    type EnrichedAnnouncement = Announcement & { qrCodeDataUrl?: string };

    let { items = [], kiosk }: { 
        items: (Event | Announcement)[],
        kiosk: { 
            id?: string;
            name?: string;
            description?: string;
            locations?: LocationInfo[];
            rangeMode?: string;
            startDate?: string | Date;
            endDate?: string | Date;
        }
    } = $props();

    // View customization options
    let compressSeries = $state(true);
    let density = $state<"standard" | "compact">("standard");
    let activeFilter = $state<"all" | "events" | "news">("all");
    let isComponentsMenuOpen = $state(false);

    // Visible components selection
    let visibleComponents = $state({
        contacts: false,      // All associated contacts with roles & details
        participants: false,  // Number of participants & occupancy
        publicStatus: false,  // Public or internal badge
        descriptions: true,   // Event descriptions
        qrCodes: true,        // QR codes
        ticketPrice: true,    // Ticket prices & free badges
        rooms: true,          // Rooms & facilities
        tags: true,           // Tags
    });

    const storageKey = $derived(`kiosk_flat_list_prefs_${kiosk?.id || 'default'}`);

    onMount(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (typeof parsed.compressSeries === "boolean") {
                    compressSeries = parsed.compressSeries;
                }
                if (parsed.density === "standard" || parsed.density === "compact") {
                    density = parsed.density;
                }
                if (parsed.visibleComponents && typeof parsed.visibleComponents === "object") {
                    visibleComponents = {
                        ...visibleComponents,
                        ...parsed.visibleComponents
                    };
                }
            }
        } catch (e) {
            console.error("Failed to restore flat list preferences", e);
        }
    });

    function savePrefs() {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(storageKey, JSON.stringify({
                compressSeries,
                density,
                visibleComponents
            }));
        } catch (e) {
            console.error("Failed to save flat list preferences", e);
        }
    }

    function toggleComponent(key: keyof typeof visibleComponents) {
        visibleComponents[key] = !visibleComponents[key];
        savePrefs();
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
        };
        savePrefs();
    }

    function resetComponentsToDefault() {
        visibleComponents = {
            contacts: false,
            participants: false,
            publicStatus: false,
            descriptions: true,
            qrCodes: true,
            ticketPrice: true,
            rooms: true,
            tags: true,
        };
        savePrefs();
    }

    // Helper functions for associated contacts
    function getAllEventContacts(event: Event): any[] {
        const contactsList: any[] = [];
        const seen = new Set<string>();

        if (Array.isArray((event as any).contacts)) {
            for (const c of (event as any).contacts) {
                const cObj = c.contact || c;
                const id = cObj.id || cObj.name || cObj.displayName;
                if (id && !seen.has(id)) {
                    seen.add(id);
                    contactsList.push(cObj);
                }
            }
        }

        if (event.resolvedContact) {
            const rc = event.resolvedContact;
            const rcId = (rc as any).id || rc.name;
            if (!rcId || !seen.has(rcId)) {
                contactsList.push(rc);
            }
        }

        return contactsList;
    }

    function getContactName(c: any): string {
        if (!c) return "";
        return c.displayName || [c.givenName, c.familyName].filter(Boolean).join(" ") || c.company || c.name || m.unnamed_contact();
    }

    function getContactRoles(c: any): string[] {
        if (!c) return [];
        if (Array.isArray(c.roles) && c.roles.length > 0) {
            return c.roles.map((r: any) => (typeof r === "object" && r ? r.name || r.id : String(r)));
        }
        if (c.role) return [String(c.role)];
        return [];
    }

    function getContactEmail(c: any): string | null {
        if (!c) return null;
        if (c.email) return c.email;
        if (Array.isArray(c.emails) && c.emails[0]) {
            return c.emails.find((e: any) => e.isPrimary)?.email || c.emails[0].email || null;
        }
        return null;
    }

    function getContactPhone(c: any): string | null {
        if (!c) return null;
        if (c.phone) return c.phone;
        if (Array.isArray(c.phones) && c.phones[0]) {
            return c.phones.find((p: any) => p.isPrimary)?.phone || c.phones[0].phone || null;
        }
        return null;
    }

    // Separate Announcements (News) from Scheduled Events
    let announcements = $derived(items.filter((item) => !("startDateTime" in item) && "content" in item) as EnrichedAnnouncement[]);

    let rawEvents = $derived(items.filter((item) => "startDateTime" in item) as EnrichedEvent[]);

    function compressSeriesEvents(eventList: EnrichedEvent[]): EnrichedEvent[] {
        const seriesGroups = new Map<string, EnrichedEvent[]>();
        const nonSeriesEvents: EnrichedEvent[] = [];

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

        const compressed: EnrichedEvent[] = [...nonSeriesEvents];

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
                    qrCodePath: `/api/events/${sKey}/qr.png`,
                    qrCodeDataUrl: undefined
                });
            } else {
                compressed.push({
                    ...first,
                    recurrenceText: recText
                });
            }
        }

        compressed.sort((a, b) => {
            const timeA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
            const timeB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
            return timeA - timeB;
        });

        return compressed;
    }

    let events = $derived.by(() => {
        if (!compressSeries) return rawEvents;
        return compressSeriesEvents(rawEvents);
    });

    // Group events chronologically by Month & Year
    let groupedEvents = $derived.by(() => {
        const monthMap: Record<string, { monthKey: string; monthName: string; items: EnrichedEvent[] }> = {};

        for (const event of events) {
            const rawDate = event.startDateTime;
            let monthKey = "9999-99";
            let monthName: string = String(m.monthly_events_overview());

            if (rawDate) {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    monthName = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                }
            }

            if (!monthMap[monthKey]) {
                monthMap[monthKey] = { monthKey, monthName, items: [] };
            }
            monthMap[monthKey].items.push(event);
        }

        const sortedKeys = Object.keys(monthMap).sort((a, b) => a.localeCompare(b));

        return sortedKeys.map((key) => {
            monthMap[key].items.sort((a, b) => {
                const dateA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
                const dateB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
                return dateA - dateB;
            });
            return monthMap[key];
        });
    });

    const generatedDateStr = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    function formatDateDay(dateStr: string | null | undefined) {
        if (!dateStr) return "--";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "--" : d.toLocaleDateString(undefined, { day: '2-digit' });
    }

    function formatDateMonth(dateStr: string | null | undefined) {
        if (!dateStr) return "---";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "---" : d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
    }

    function formatDateWeekday(dateStr: string | null | undefined) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { weekday: 'short' });
    }

    function formatTime(dateStr: string | null | undefined) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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

    function formatFullDate(dateStr: string | null | undefined) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function triggerPrint() {
        if (typeof window !== "undefined") {
            window.print();
        }
    }
</script>

<div class="min-h-screen bg-slate-100 dark:bg-slate-900 py-6 px-3 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100 print:bg-white print:p-0 print:m-0 print:text-black">
    <!-- Screen-Only Controls & Export Toolbar -->
    <header class="max-w-5xl mx-auto mb-6 print:hidden">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <a
                    href={resolve('kiosks')}
                    class="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors inline-flex items-center gap-1.5 text-sm font-medium"
                    title={m.back_to_kiosks_btn()}
                >
                    <ArrowLeft class="w-4 h-4" />
                    <span class="hidden sm:inline">{m.back_to_kiosks_btn()}</span>
                </a>
                <div class="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                <div>
                    <div class="flex items-center gap-2">
                        <FileText class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h1 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {m.print_export_preview()}
                        </h1>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {events.length} {events.length === 1 ? m.event_label() : m.feature_events_title()} • {announcements.length} {m.feature_announcements_title()}
                    </p>
                </div>
            </div>

            <!-- View Options & Controls -->
            <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
                <!-- Filter Tabs -->
                <div class="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onclick={() => activeFilter = "all"}
                        class="px-2.5 py-1 rounded-lg font-medium transition-colors {activeFilter === 'all' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
                    >
                        {m.all_items_tab()} ({events.length + announcements.length})
                    </button>
                    {#if events.length > 0}
                        <button
                            type="button"
                            onclick={() => activeFilter = "events"}
                            class="px-2.5 py-1 rounded-lg font-medium transition-colors {activeFilter === 'events' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
                        >
                            {m.feature_events_title()} ({events.length})
                        </button>
                    {/if}
                    {#if announcements.length > 0}
                        <button
                            type="button"
                            onclick={() => activeFilter = "news"}
                            class="px-2.5 py-1 rounded-lg font-medium transition-colors {activeFilter === 'news' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
                        >
                            {m.feature_announcements_title()} ({announcements.length})
                        </button>
                    {/if}
                </div>

                <!-- Density Toggle -->
                <div class="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onclick={() => { density = "standard"; savePrefs(); }}
                        class="px-2.5 py-1 rounded-lg font-medium transition-colors {density === 'standard' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400'}"
                        title={m.layout_standard()}
                    >
                        {m.layout_standard()}
                    </button>
                    <button
                        type="button"
                        onclick={() => { density = "compact"; savePrefs(); }}
                        class="px-2.5 py-1 rounded-lg font-medium transition-colors {density === 'compact' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400'}"
                        title={m.layout_compact()}
                    >
                        {m.layout_compact()}
                    </button>
                </div>

                <!-- Series Mode Toggle (Feature 1) -->
                <div class="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700" title={m.compress_series_tooltip()}>
                    <button
                        type="button"
                        onclick={() => { compressSeries = true; savePrefs(); }}
                        class="px-2.5 py-1 rounded-lg font-medium transition-colors inline-flex items-center gap-1.5 {compressSeries ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'}"
                        title={m.series_compacted_desc()}
                    >
                        <RefreshCw class="w-3 h-3 text-indigo-500" />
                        <span>{m.series_compacted()}</span>
                    </button>
                    <button
                        type="button"
                        onclick={() => { compressSeries = false; savePrefs(); }}
                        class="px-2.5 py-1 rounded-lg font-medium transition-colors {!compressSeries ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'}"
                        title={m.series_unrolled_desc()}
                    >
                        <span>{m.series_unrolled()}</span>
                    </button>
                </div>

                <!-- Visible Components Selection List (Feature 2) -->
                <div class="relative">
                    <button
                        type="button"
                        onclick={() => isComponentsMenuOpen = !isComponentsMenuOpen}
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium transition-colors {isComponentsMenuOpen ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-xs' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'}"
                        title={m.visible_components_desc()}
                        aria-expanded={isComponentsMenuOpen}
                    >
                        <SlidersHorizontal class="w-3.5 h-3.5 text-slate-500" />
                        <span>{m.visible_components()}</span>
                        <span class="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-bold">
                            {Object.values(visibleComponents).filter(Boolean).length}
                        </span>
                        <ChevronDown class="w-3 h-3 text-slate-400 transition-transform {isComponentsMenuOpen ? 'rotate-180' : ''}" />
                    </button>

                    {#if isComponentsMenuOpen}
                        <!-- Click outside backdrop -->
                        <div
                            class="fixed inset-0 z-40"
                            onclick={() => isComponentsMenuOpen = false}
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
                                        class="text-blue-600 dark:text-blue-400 hover:underline font-medium"
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
                                    <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.descriptions ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
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
                                    <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.qrCodes ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
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
                                    <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.ticketPrice ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
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
                                    <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.rooms ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
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
                                    <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 {visibleComponents.tags ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}">
                                        {#if visibleComponents.tags}
                                            <Check class="w-3 h-3 stroke-[3]" />
                                        {/if}
                                    </div>
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- Primary Print Action -->
                <button
                    type="button"
                    onclick={triggerPrint}
                    class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all transform hover:scale-[1.01]"
                >
                    <Printer class="w-4 h-4" />
                    <span>{m.print_export_btn()}</span>
                </button>
            </div>
        </div>
    </header>

    <!-- Document Paper Preview Container -->
    <main class="max-w-5xl mx-auto bg-white text-slate-900 shadow-xl print:shadow-none border border-slate-200 print:border-none rounded-2xl print:rounded-none p-6 sm:p-10 print:p-0">
        <!-- Printable Document Header -->
        <div class="border-b-2 border-slate-900 print:border-black pb-6 mb-8">
            <div class="flex flex-col md:flex-row justify-between items-start gap-6">
                <!-- Title & Meta -->
                <div class="space-y-2 flex-1">
                    <div class="flex items-center gap-3">
                        <span class="px-2.5 py-0.5 bg-slate-900 text-white print:bg-black text-[11px] font-bold tracking-widest uppercase rounded">
                            {m.document_badge()}
                        </span>
                        <span class="text-xs text-slate-500 font-medium">
                            {m.generated_on({ date: generatedDateStr })}
                        </span>
                    </div>

                    <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                        {kiosk?.name || m.monthly_events_overview()}
                    </h1>

                    {#if kiosk?.description}
                        <div class="rich-description text-sm text-slate-600 max-w-2xl leading-relaxed">
                            {@html kiosk.description}
                        </div>
                    {/if}

                    <!-- Location & Address Strip -->
                    {#if kiosk?.locations && kiosk.locations.length > 0}
                        <div class="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-700 font-medium">
                            {#each kiosk.locations as loc (loc.id)}
                                <div class="inline-flex items-center gap-1.5 bg-slate-100 print:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                                    <MapPin class="w-3.5 h-3.5 text-slate-700" />
                                    <span>
                                        {loc.name}
                                        {#if loc.street}
                                            • {loc.street} {loc.houseNumber || ''}, {loc.zip || ''} {loc.city || ''}
                                        {/if}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Location / Kiosk Contact Information Box -->
                {#if kiosk?.locations && kiosk.locations.some((l) => l.contact)}
                    {@const primaryLoc = kiosk.locations.find((l) => l.contact)}
                    {@const contact = primaryLoc?.contact}
                    {#if contact}
                        <div class="shrink-0 bg-slate-50 print:bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 text-xs space-y-1.5 min-w-[220px]">
                            <div class="font-bold text-slate-900 uppercase tracking-wider text-[10px] text-slate-500 flex items-center gap-1">
                                <User class="w-3 h-3" />
                                <span>{m.contact()}</span>
                            </div>
                            <div class="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                                <span>{contact.name}</span>
                                {#if (contact as any).roles && (contact as any).roles.length > 0}
                                    <span class="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[10px] font-semibold">
                                        {(contact as any).roles[0]}
                                    </span>
                                {:else if (contact as any).role}
                                    <span class="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[10px] font-semibold">
                                        {(contact as any).role}
                                    </span>
                                {/if}
                            </div>
                            {#if contact.phone}
                                <div class="flex items-center gap-1.5 text-slate-600">
                                    <Phone class="w-3 h-3 text-slate-400" />
                                    <span>{contact.phone}</span>
                                </div>
                            {/if}
                            {#if contact.email}
                                <div class="flex items-center gap-1.5 text-slate-600">
                                    <Mail class="w-3 h-3 text-slate-400" />
                                    <span>{contact.email}</span>
                                </div>
                            {/if}

                            {#if visibleComponents.qrCodes && (contact.qrCodeDataUrl || contact.qrCodePath)}
                                <div class="pt-1 flex items-center gap-2">
                                    <img 
                                        src={contact.qrCodeDataUrl || contact.qrCodePath} 
                                        alt="Contact QR" 
                                        class="w-12 h-12 bg-white p-0.5 rounded border border-slate-200 shrink-0" 
                                    />
                                    <span class="text-[10px] text-slate-500 leading-tight">
                                        {m.scan_location_qr()}
                                    </span>
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/if}
            </div>
        </div>

        {#if items.length === 0}
            <!-- Empty State -->
            <div class="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Calendar class="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p class="text-slate-600 text-base font-semibold">{m.no_events_or_news()}</p>
            </div>
        {:else}
            <!-- Section 1: News & Announcements (Prominent Bulletin) -->
            {#if (activeFilter === "all" || activeFilter === "news") && announcements.length > 0}
                <section class="mb-10 print:mb-8 space-y-4 print:break-inside-avoid-page">
                    <div class="flex items-center gap-2.5 border-b-2 border-amber-500 pb-2">
                        <Megaphone class="w-5 h-5 text-amber-600" />
                        <h2 class="text-xl font-bold uppercase tracking-wider text-slate-900">
                            {m.news_and_announcements_heading()}
                        </h2>
                        <span class="ml-auto text-xs font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                            {announcements.length}
                        </span>
                    </div>

                    <div class="grid grid-cols-1 {density === 'standard' ? 'gap-4' : 'gap-3'}">
                        {#each announcements as announcement (announcement.id)}
                            <article class="p-4 sm:p-5 rounded-xl border border-amber-200/80 bg-amber-50/40 print:bg-white print:border-slate-300 print:break-inside-avoid flex flex-col sm:flex-row justify-between gap-4">
                                <div class="space-y-2 flex-1">
                                    <div class="flex items-center justify-between gap-3">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            {#if visibleComponents.publicStatus && (announcement as any).isPublic !== undefined}
                                                {#if (announcement as any).isPublic}
                                                    <span class="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider print:border-black print:text-black">
                                                        <Globe class="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 print:text-black" />
                                                        <span>{m.public_label()}</span>
                                                    </span>
                                                {:else}
                                                    <span class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider print:border-black print:text-black">
                                                        <Lock class="w-2.5 h-2.5 text-slate-500 dark:text-slate-400 print:text-black" />
                                                        <span>{m.private_label()}</span>
                                                    </span>
                                                {/if}
                                            {/if}
                                            <h3 class="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                                                {announcement.title}
                                            </h3>
                                        </div>
                                        {#if announcement.createdAt}
                                            <span class="text-[11px] text-slate-500 font-medium whitespace-nowrap shrink-0">
                                                {formatFullDate(announcement.createdAt)}
                                            </span>
                                        {/if}
                                    </div>

                                    {#if visibleComponents.descriptions && announcement.content}
                                        <div class="rich-description text-xs sm:text-sm text-slate-700 dark:text-slate-300 print:text-black leading-relaxed">
                                            {@html announcement.content}
                                        </div>
                                    {/if}

                                    <!-- Tags & Associated Locations -->
                                    <div class="flex flex-wrap items-center gap-2 pt-1">
                                        {#if visibleComponents.rooms && announcement.locations && announcement.locations.length > 0}
                                            {#each announcement.locations as loc (loc.id)}
                                                <span class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-white print:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                                                    <MapPin class="w-3 h-3 text-slate-500" />
                                                    {loc.name}
                                                </span>
                                            {/each}
                                        {/if}

                                        {#if visibleComponents.tags && announcement.tags && announcement.tags.length > 0}
                                            {#each announcement.tags as tag (typeof tag === 'string' ? tag : tag.id || tag.name)}
                                                <span class="text-[11px] text-slate-600 bg-white print:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                                                    #{typeof tag === 'string' ? tag : tag.name}
                                                </span>
                                            {/each}
                                        {/if}
                                    </div>
                                </div>

                                <!-- Announcement QR Code -->
                                {#if visibleComponents.qrCodes && ((announcement as any).qrCodeDataUrl || (announcement as any).qrCodePath)}
                                    <div class="shrink-0 flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-xl self-end sm:self-center">
                                        <img 
                                            src={(announcement as any).qrCodeDataUrl || (announcement as any).qrCodePath} 
                                            alt="Announcement QR" 
                                            class="w-14 h-14" 
                                        />
                                        <span class="text-[9px] font-semibold text-slate-500 mt-1 uppercase tracking-tight">
                                            {m.scan_event_qr()}
                                        </span>
                                    </div>
                                {/if}
                            </article>
                        {/each}
                    </div>
                </section>
            {/if}

            <!-- Section 2: Scheduled Events by Month -->
            {#if (activeFilter === "all" || activeFilter === "events") && events.length > 0}
                <section class="space-y-8 print:space-y-6">
                    {#each groupedEvents as group (group.monthKey)}
                        <div class="space-y-3 print:break-inside-avoid-page">
                            <!-- Month Banner -->
                            <div class="flex items-center gap-2.5 border-b-2 border-slate-900 print:border-black pb-1.5">
                                <Calendar class="w-5 h-5 text-blue-600 print:text-black" />
                                <h2 class="text-xl font-bold uppercase tracking-wider text-slate-900">
                                    {group.monthName}
                                </h2>
                                <span class="ml-auto text-xs font-semibold bg-slate-100 text-slate-700 print:bg-slate-200 px-2 py-0.5 rounded-full">
                                    {group.items.length} {group.items.length === 1 ? m.event_label() : m.feature_events_title()}
                                </span>
                            </div>

                            <!-- Events List / Rows -->
                            <div class="divide-y divide-slate-200 print:divide-slate-300">
                                {#each group.items as event (event.id)}
                                    {@const eventRooms = getEventRooms(event)}
                                    {@const displayPrice = formatTicketPrice(event.ticketPrice, event.ticketPriceUnknown)}
                                    {@const isSpecialNonSeries = isNonSeriesEvent(event)}
                                    {@const isCompressed = Boolean(event.isCompressedSeries && event.seriesDates && event.seriesDates.length > 1)}
                                    {@const multiDay = isMultiDayEvent(event)}
                                    {@const durationDays = multiDay ? getEventDurationDays(event) : 1}
                                    {@const dateParts = getEventDateParts(event)}
                                    <article class="{density === 'standard' ? 'py-4 sm:py-5' : 'py-2.5 sm:py-3'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:break-inside-avoid transition-all {isSpecialNonSeries ? 'border-l-4 border-l-amber-500 pl-3 sm:pl-4 bg-linear-to-r from-amber-50/60 via-amber-50/20 to-transparent print:bg-slate-50/60 rounded-r-xl my-1.5' : isCompressed ? 'border-l-4 border-l-indigo-500 pl-3 sm:pl-4 bg-linear-to-r from-indigo-50/40 via-indigo-50/10 to-transparent print:bg-slate-50/40 rounded-r-xl my-1.5' : ''}">
                                        <!-- Left Date & Time Column -->
                                        <div class="flex items-center gap-3 shrink-0 min-w-[130px]">
                                            <!-- Date / Series Badge -->
                                            {#if isCompressed}
                                                <div class="flex flex-col items-center justify-center min-w-[56px] px-1.5 h-12 bg-indigo-50/90 dark:bg-indigo-950/40 print:bg-slate-50 border-indigo-200 dark:border-indigo-800 print:border-slate-300 border rounded-xl text-center shadow-xs">
                                                    <RefreshCw class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 print:text-black mb-0.5" />
                                                    <span class="text-sm font-black text-indigo-950 dark:text-indigo-200 print:text-black leading-tight tracking-tight">
                                                        {event.instanceCount}×
                                                    </span>
                                                    <span class="text-[8px] font-bold text-indigo-600 dark:text-indigo-400 print:text-slate-700 leading-none uppercase">
                                                        {m.series_badge()}
                                                    </span>
                                                </div>
                                            {:else if multiDay}
                                                <div class="flex flex-col items-center justify-center min-w-[56px] px-1.5 h-12 bg-indigo-50/90 print:bg-slate-50 border-indigo-200 print:border-slate-300 border rounded-xl text-center shadow-xs">
                                                    <span class="text-[9px] font-extrabold text-indigo-700 print:text-black leading-none uppercase tracking-tight">
                                                        {dateParts.startMonth}{dateParts.startMonth !== dateParts.endMonth ? `/${dateParts.endMonth}` : ''}
                                                    </span>
                                                    <span class="text-sm font-black text-indigo-950 print:text-black leading-tight tracking-tight">
                                                        {dateParts.startDay}–{dateParts.endDay}
                                                    </span>
                                                    <span class="text-[8px] font-bold text-indigo-600 print:text-slate-700 leading-none uppercase">
                                                        {durationDays} {m.days_count({ count: durationDays })}
                                                    </span>
                                                </div>
                                            {:else}
                                                <div class="flex flex-col items-center justify-center w-12 h-12 {isSpecialNonSeries ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400/40' : 'bg-slate-100 print:bg-slate-50 border-slate-200'} border rounded-xl text-center shadow-xs">
                                                    <span class="text-[10px] font-bold {isSpecialNonSeries ? 'text-amber-700 font-extrabold' : 'text-blue-600 print:text-black'} leading-none uppercase">
                                                        {formatDateMonth(event.startDateTime)}
                                                    </span>
                                                    <span class="text-lg font-black {isSpecialNonSeries ? 'text-amber-950' : 'text-slate-900'} leading-tight">
                                                        {formatDateDay(event.startDateTime)}
                                                    </span>
                                                    <span class="text-[9px] {isSpecialNonSeries ? 'text-amber-700/80 font-semibold' : 'text-slate-500'} leading-none uppercase">
                                                        {formatDateWeekday(event.startDateTime)}
                                                    </span>
                                                </div>
                                            {/if}

                                            <!-- Time Details -->
                                            <div class="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                {#if isCompressed}
                                                    <div class="flex items-center gap-1 font-bold text-slate-900 dark:text-slate-100">
                                                        <Clock class="w-3 h-3 text-slate-400" />
                                                        <span>{formatTimeRange(event.startDateTime, event.endDateTime, event.isAllDay)}</span>
                                                    </div>
                                                {:else if multiDay}
                                                    {#if event.isAllDay}
                                                        <span class="inline-block px-1.5 py-0.5 bg-indigo-100/80 text-indigo-800 print:bg-slate-100 print:text-black rounded text-[11px] font-bold">
                                                            {m.all_day_label()} • {durationDays} {m.days_count({ count: durationDays })}
                                                        </span>
                                                    {:else}
                                                        <div class="flex items-center gap-1 font-bold text-slate-900">
                                                            <Clock class="w-3 h-3 text-slate-400" />
                                                            <span>{formatTime(event.startDateTime)}</span>
                                                        </div>
                                                        {#if event.endDateTime}
                                                            <div class="text-slate-500 pl-4 text-[11px]">
                                                                – {dateParts.endWeekday} {formatTime(event.endDateTime)}
                                                            </div>
                                                        {/if}
                                                    {/if}
                                                {:else}
                                                    {#if event.isAllDay}
                                                        <span class="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 print:bg-slate-100 print:text-black rounded text-[11px] font-bold">
                                                            {m.all_day_label()}
                                                        </span>
                                                    {:else}
                                                        <div class="flex items-center gap-1 font-bold text-slate-900">
                                                            <Clock class="w-3 h-3 text-slate-400" />
                                                            <span>{formatTime(event.startDateTime)}</span>
                                                        </div>
                                                        {#if event.endDateTime}
                                                            <div class="text-slate-500 pl-4 text-[11px]">
                                                                – {formatTime(event.endDateTime)}
                                                            </div>
                                                        {/if}
                                                    {/if}
                                                {/if}
                                            </div>
                                        </div>

                                        <!-- Center Event Details -->
                                        <div class="flex-1 space-y-1.5 min-w-0">
                                            <!-- Badges & Title Row -->
                                            <div class="flex flex-wrap items-center gap-2">
                                                {#if isCompressed}
                                                    <span class="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 print:bg-slate-100 print:text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                                        <RefreshCw class="w-2.5 h-2.5" />
                                                        {event.recurrenceText || m.series_badge()}
                                                    </span>
                                                {:else if multiDay}
                                                    <span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 print:bg-slate-100 print:text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                                        <Calendar class="w-2.5 h-2.5" />
                                                        {m.multi_day_badge()}
                                                    </span>
                                                {/if}
                                                {#if event.status === 'cancelled'}
                                                    <span class="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                                        {m.cancelled()}
                                                    </span>
                                                {/if}
                                                {#if event.status === 'tentative'}
                                                    <span class="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                                        {m.tentative()}
                                                    </span>
                                                {/if}
                                                <!-- Optional: Public / Visibility Status Badge -->
                                                {#if visibleComponents.publicStatus}
                                                    {#if event.isPublic}
                                                        <span class="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider print:border-black print:text-black">
                                                            <Globe class="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 print:text-black" />
                                                            <span>{m.public_label()}</span>
                                                        </span>
                                                    {:else}
                                                        <span class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider print:border-black print:text-black">
                                                            <Lock class="w-2.5 h-2.5 text-slate-500 dark:text-slate-400 print:text-black" />
                                                            <span>{m.private_label()}</span>
                                                        </span>
                                                    {/if}
                                                {/if}
                                                <h3 class="text-base sm:text-lg font-bold text-slate-900 leading-snug {event.status === 'cancelled' ? 'line-through text-slate-400' : ''}">
                                                    {event.summary || m.untitled_event()}
                                                </h3>
                                            </div>

                                            <!-- Multiple dates list if Compressed Series -->
                                            {#if isCompressed && event.seriesDates}
                                                <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
                                                    <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                        <Calendar class="w-3 h-3 text-indigo-500" />
                                                        <span>{m.all_instances_count?.({ count: event.seriesDates.length }) ?? `${event.seriesDates.length} Dates`}:</span>
                                                    </span>
                                                    {#each event.seriesDates as dateStr}
                                                        <span class="inline-flex items-center gap-1 bg-slate-900 dark:bg-slate-700 text-white print:bg-slate-100 print:text-black print:border print:border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold tracking-tight shadow-2xs">
                                                            <span class="text-slate-300 dark:text-slate-300 print:text-slate-600 font-medium">{formatDateWeekday(dateStr)}</span>
                                                            <span>{formatDateDay(dateStr)} {formatDateMonth(dateStr)}</span>
                                                        </span>
                                                    {/each}
                                                </div>
                                            {/if}

                                            <!-- Room, Location & Recurrence Info -->
                                            <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                                                <!-- Rooms / Location (if enabled in visibleComponents) -->
                                                {#if visibleComponents.rooms && eventRooms.length > 0}
                                                    {#each eventRooms as roomName (roomName)}
                                                        <span class="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400 print:text-black">
                                                            <MapPin class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 print:text-black" />
                                                            {roomName}
                                                        </span>
                                                    {/each}
                                                {/if}

                                                <!-- Ticket Price (if enabled in visibleComponents) -->
                                                {#if visibleComponents.ticketPrice && displayPrice && !isEventFree(event.ticketPrice, event.ticketPriceUnknown)}
                                                    <span class="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 print:text-black">
                                                        <Ticket class="w-3.5 h-3.5 text-emerald-600 print:text-black" />
                                                        {displayPrice}
                                                    </span>
                                                {/if}

                                                <!-- Participants Count (if enabled in visibleComponents) -->
                                                {#if visibleComponents.participants}
                                                    {@const pCount = (event as any).participantsCount}
                                                    {@const maxOcc = (event as any).maxOccupancy}
                                                    {#if pCount != null || maxOcc != null}
                                                        <span class="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded text-[10.5px] font-semibold print:border-black print:text-black">
                                                            <UserCheck class="w-3 h-3 text-amber-600 dark:text-amber-400 print:text-black" />
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

                                                <!-- Recurrence text for unrolled series item -->
                                                {#if !isCompressed && (event as any).recurrence && ((event as any).recurrence as string[]).length > 0}
                                                    <span class="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                                                        <RefreshCw class="w-3 h-3 text-slate-500" />
                                                        {formatRecurrenceText((event as any).recurrence, undefined, { omitLength: true })}
                                                    </span>
                                                {/if}

                                                <!-- Inline single contact if Associated Contacts full list is NOT toggled -->
                                                {#if !visibleComponents.contacts && event.resolvedContact}
                                                    <span class="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                                                        <User class="w-3.5 h-3.5 text-slate-500 print:text-black" />
                                                        <span>{event.resolvedContact.name}</span>
                                                        {#if event.resolvedContact.roles && event.resolvedContact.roles.length > 0}
                                                            {#each event.resolvedContact.roles as roleName}
                                                                <span class="px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-semibold print:border-black print:text-black">
                                                                    {roleName}
                                                                </span>
                                                            {/each}
                                                        {:else if event.resolvedContact.role}
                                                            <span class="px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-semibold print:border-black print:text-black">
                                                                {event.resolvedContact.role}
                                                            </span>
                                                        {/if}
                                                    </span>
                                                {/if}
                                            </div>

                                            <!-- Associated Contacts List (if enabled in visibleComponents) -->
                                            {#if visibleComponents.contacts}
                                                {@const allContacts = getAllEventContacts(event)}
                                                {#if allContacts.length > 0}
                                                    <div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 print:border-slate-200 space-y-1">
                                                        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                            <Users class="w-3 h-3 text-slate-400" />
                                                            <span>{m.component_contacts()} ({allContacts.length})</span>
                                                        </div>
                                                        <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                            {#each allContacts as c}
                                                                {@const cName = getContactName(c)}
                                                                {@const cRoles = getContactRoles(c)}
                                                                {@const cEmail = getContactEmail(c)}
                                                                {@const cPhone = getContactPhone(c)}
                                                                <div class="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 print:bg-slate-50 border border-slate-200 dark:border-slate-700 print:border-slate-300 px-2 py-0.5 rounded-lg text-xs">
                                                                    <User class="w-3 h-3 text-slate-400 shrink-0" />
                                                                    <span class="font-medium text-slate-800 dark:text-slate-200 print:text-black">{cName}</span>
                                                                    {#if cRoles.length > 0}
                                                                        {#each cRoles as r}
                                                                            <span class="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/40 print:bg-slate-200 text-blue-800 dark:text-blue-300 print:text-black rounded text-[9.5px] font-semibold">
                                                                                {r}
                                                                            </span>
                                                                        {/each}
                                                                    {/if}
                                                                    {#if cEmail}
                                                                        <a href="mailto:{cEmail}" class="text-slate-400 hover:text-blue-600 print:text-slate-600 text-[10px]" title={cEmail}>
                                                                            • {cEmail}
                                                                        </a>
                                                                    {/if}
                                                                    {#if cPhone}
                                                                        <a href="tel:{cPhone}" class="text-slate-400 hover:text-blue-600 print:text-slate-600 text-[10px]" title={cPhone}>
                                                                            • {cPhone}
                                                                        </a>
                                                                    {/if}
                                                                </div>
                                                            {/each}
                                                        </div>
                                                    </div>
                                                {/if}
                                            {/if}

                                            <!-- Description (if enabled in visibleComponents) -->
                                            {#if visibleComponents.descriptions && event.description}
                                                <div class="rich-description text-xs text-slate-600 dark:text-slate-300 print:text-black leading-relaxed pt-0.5">
                                                    {@html event.description}
                                                </div>
                                            {/if}

                                            <!-- Tags & Free Pill (if enabled in visibleComponents) -->
                                            {#if (visibleComponents.tags && event.tags && event.tags.length > 0) || (visibleComponents.ticketPrice && isEventFree(event.ticketPrice, event.ticketPriceUnknown))}
                                                <div class="flex flex-wrap gap-1.5 pt-1">
                                                    {#if visibleComponents.ticketPrice && isEventFree(event.ticketPrice, event.ticketPriceUnknown)}
                                                        <span class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold inline-flex items-center gap-1">
                                                            <Ticket class="w-2.5 h-2.5 text-emerald-600" />
                                                            {m.ticket_price_free?.() || 'Free'}
                                                        </span>
                                                    {/if}
                                                    {#if visibleComponents.tags && event.tags && event.tags.length > 0}
                                                        {#each event.tags as tag (typeof tag === 'string' ? tag : tag.id || tag.name)}
                                                            <span class="px-1.5 py-0.5 bg-slate-100 print:bg-slate-50 border border-slate-200 text-slate-600 rounded text-[10px]">
                                                                #{typeof tag === 'string' ? tag : tag.name}
                                                            </span>
                                                        {/each}
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>

                                        <!-- Right Scannable QR Code -->
                                        {#if visibleComponents.qrCodes && (event.qrCodeDataUrl || event.qrCodePath)}
                                            <div class="shrink-0 flex flex-col items-center justify-center p-1.5 bg-white border border-slate-200 rounded-xl self-end sm:self-center">
                                                <img
                                                    src={event.qrCodeDataUrl || event.qrCodePath}
                                                    alt="Event QR"
                                                    class={density === 'standard' ? 'w-14 h-14' : 'w-10 h-10'}
                                                />
                                                <span class="text-[8px] font-semibold text-slate-500 mt-0.5 uppercase tracking-tight">
                                                    {m.scan_event_qr()}
                                                </span>
                                            </div>
                                        {/if}
                                    </article>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </section>
            {/if}
        {/if}

        <!-- Printable Document Footer -->
        <footer class="mt-12 pt-6 border-t border-slate-200 print:border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 print:break-inside-avoid">
            <div>
                {kiosk?.name || m.monthly_events_overview()} • {m.generated_on({ date: generatedDateStr })}
            </div>
            <div class="font-medium">
                AC Multiposter
            </div>
        </footer>
    </main>
</div>

<style>
    .rich-description :global(p) {
        margin-top: 0;
        margin-bottom: 0.35rem;
    }
    .rich-description :global(p:last-child) {
        margin-bottom: 0;
    }
    .rich-description :global(ul),
    .rich-description :global(ol) {
        margin: 0.35rem 0 0.35rem 1.25rem;
        padding: 0;
    }
    .rich-description :global(ul) {
        list-style-type: disc;
    }
    .rich-description :global(ol) {
        list-style-type: decimal;
    }
    .rich-description :global(li) {
        margin-bottom: 0.15rem;
    }
    .rich-description :global(a) {
        color: #2563eb;
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

    @media print {
        @page {
            margin: 12mm 15mm;
            size: A4 portrait;
        }

        :global(body) {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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
