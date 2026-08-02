<script lang="ts">
    import { SvelteMap } from "svelte/reactivity";
    import { type Event, type Announcement } from "@ac/validations";
    import { Printer, Calendar, MapPin, RefreshCw } from "@lucide/svelte";
    import { formatRecurrenceText } from "$lib/utils/format-recurrence";
    import * as m from "$lib/paraglide/messages";

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

    let { items, kiosk }: {
        items: (Event | Announcement)[],
        kiosk: {
            name?: string;
            description?: string;
            locations?: LocationInfo[];
        }
    } = $props();

    // Filter only events and sort chronologically by start date
    let events = $derived.by(() => {
        const evs = items.filter(item => "startDateTime" in item) as Event[];
        return [...evs].sort((a, b) => {
            const dateA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
            const dateB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
            return dateA - dateB;
        });
    });

    // Group events by Month and Year (e.g., "August 2026")
    let groupedByMonth = $derived.by(() => {
        const groups: { monthKey: string; monthName: string; events: Event[] }[] = [];
        const monthMap = new SvelteMap<string, Event[]>();

        for (const ev of events) {
            if (!ev.startDateTime) continue;
            const d = new Date(ev.startDateTime);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, []);
            }
            monthMap.get(monthKey)!.push(ev);
        }

        for (const [key, evList] of monthMap.entries()) {
            const sampleDate = new Date(evList[0].startDateTime!);
            const monthName = sampleDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            groups.push({ monthKey: key, monthName, events: evList });
        }

        return groups;
    });

    function formatDateDay(dateStr: string | null) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit' });
    }

    function formatDateMonth(dateStr: string | null) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
    }

    function formatDateWeekday(dateStr: string | null) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short' });
    }

    function formatTime(dateStr: string | null) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    function triggerPrint() {
        if (typeof window !== "undefined") {
            window.print();
        }
    }
</script>

<div class="w-full min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 print:bg-white print:text-slate-900 print:p-0 print:min-h-0">
    <!-- Printable / Screen Header Bar -->
    <div class="max-w-6xl mx-auto mb-8 print:mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-800 print:border-slate-300">
        <div>
            <div class="flex items-center gap-3">
                <div class="h-8 w-1.5 bg-blue-500 rounded-full print:hidden"></div>
                <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white print:text-slate-900">
                    {kiosk?.name || m.monthly_events_overview()}
                </h1>
            </div>
            {#if kiosk?.description}
                <p class="mt-1 text-slate-400 print:text-slate-600 text-sm">{kiosk.description}</p>
            {/if}
            {#if kiosk?.locations && kiosk.locations.length > 0}
                <div class="flex items-center gap-2 mt-2 text-xs text-blue-400 print:text-slate-700">
                    <MapPin class="w-4 h-4 text-blue-500 print:text-slate-800" />
                    <span>{kiosk.locations.map(l => l.name).join(", ")}</span>
                </div>
            {/if}
        </div>

        <!-- Action Toolbar (hidden on print) -->
        <div class="flex items-center gap-3 print:hidden self-end md:self-auto">
            <button
                type="button"
                onclick={triggerPrint}
                class="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
                <Printer class="w-4 h-4" />
                <span>{m.print_export()}</span>
            </button>
        </div>
    </div>

    <!-- Main Content Area -->
    <div class="max-w-6xl mx-auto space-y-10 print:space-y-8">
        {#if events.length === 0}
            <div class="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800 print:border-slate-200 print:bg-slate-50">
                <Calendar class="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p class="text-slate-400 print:text-slate-600 text-lg font-medium">{m.no_scheduled_events()}</p>
            </div>
        {:else}
            {#each groupedByMonth as group (group.monthKey)}
                <section class="space-y-4 print:break-inside-avoid-page">
                    <!-- Month Banner -->
                    <div class="flex items-center gap-3 border-b-2 border-blue-500/40 print:border-slate-400 pb-2">
                        <Calendar class="w-5 h-5 text-blue-400 print:text-slate-800" />
                        <h2 class="text-2xl font-bold uppercase tracking-wider text-blue-400 print:text-slate-900">
                            {group.monthName}
                        </h2>
                        <span class="text-xs bg-blue-500/20 text-blue-300 print:bg-slate-200 print:text-slate-700 px-2.5 py-0.5 rounded-full font-medium ml-auto">
                            {group.events.length} {group.events.length === 1 ? m.event_label() : m.feature_events_title()}
                        </span>
                    </div>

                    <!-- Flat List Rows -->
                    <div class="divide-y divide-slate-800/60 print:divide-slate-200">
                        {#each group.events as item (item.id)}
                            <article class="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:break-inside-avoid group hover:bg-slate-900/40 print:hover:bg-transparent rounded-xl px-3 transition-colors">
                                <!-- Date & Time Badge -->
                                <div class="flex items-center gap-4 shrink-0 min-w-[140px]">
                                    <div class="flex flex-col items-center justify-center w-14 h-14 bg-slate-900 print:bg-slate-100 border border-slate-800 print:border-slate-300 rounded-xl text-center shadow-sm">
                                        <span class="text-xs font-semibold text-blue-400 print:text-slate-600 leading-none">
                                            {formatDateMonth(item.startDateTime)}
                                        </span>
                                        <span class="text-xl font-black text-white print:text-slate-900 leading-tight">
                                            {formatDateDay(item.startDateTime)}
                                        </span>
                                        <span class="text-[10px] text-slate-400 print:text-slate-500 leading-none uppercase">
                                            {formatDateWeekday(item.startDateTime)}
                                        </span>
                                    </div>

                                    <div class="text-sm font-semibold text-slate-300 print:text-slate-700">
                                        {#if item.isAllDay}
                                            <span class="px-2 py-0.5 bg-blue-500/10 text-blue-400 print:bg-slate-200 print:text-slate-800 rounded text-xs">All Day</span>
                                        {:else}
                                            <div>{formatTime(item.startDateTime)}</div>
                                            {#if item.endDateTime}
                                                <div class="text-xs text-slate-500 print:text-slate-500">- {formatTime(item.endDateTime)}</div>
                                            {/if}
                                        {/if}
                                    </div>
                                </div>

                                <!-- Event Details -->
                                <div class="flex-1 space-y-1 min-w-0">
                                    <div class="flex flex-wrap items-center gap-2">
                                        {#if (item as any).status === 'cancelled'}
                                            <span class="bg-red-600/90 text-white text-xs font-bold px-2 py-0.5 rounded uppercase">
                                                {m.cancelled()}
                                            </span>
                                        {/if}
                                        <h3 class="text-lg font-bold text-white print:text-slate-900 leading-snug truncate {(item as any).status === 'cancelled' ? 'line-through text-slate-500' : ''}">
                                            {item.summary || m.untitled_event()}
                                        </h3>
                                    </div>

                                    <!-- Room & Recurrence info -->
                                    <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400 print:text-slate-600">
                                        {#if (item as any).roomTitle}
                                            <span class="inline-flex items-center gap-1 font-medium text-blue-300 print:text-slate-800">
                                                <MapPin class="w-3.5 h-3.5" />
                                                {(item as any).roomTitle}
                                            </span>
                                        {/if}
                                        {#if (item as any).recurrence && ((item as any).recurrence as string[]).length > 0}
                                            <span class="inline-flex items-center gap-1 text-slate-400">
                                                <RefreshCw class="w-3 h-3" />
                                                {formatRecurrenceText((item as any).recurrence)}
                                            </span>
                                        {/if}
                                    </div>

                                    {#if item.description}
                                        <p class="text-xs text-slate-400 print:text-slate-600 line-clamp-2 mt-1">
                                            {item.description}
                                        </p>
                                    {/if}

                                    <!-- Tags -->
                                    {#if item.tags && item.tags.length > 0}
                                        <div class="flex flex-wrap gap-1.5 pt-1">
                                            {#each item.tags as tag (typeof tag === 'string' ? tag : tag.id || tag.name)}
                                                <span class="px-2 py-0.5 bg-slate-900 print:bg-slate-100 border border-slate-800 print:border-slate-300 text-slate-400 print:text-slate-700 rounded-md text-[11px]">
                                                    #{tag.name || tag}
                                                </span>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>

                                <!-- QR Code Badge (Optional / Scan Link) -->
                                {#if (item as any).qrCodeDataUrl || (item as any).qrCodePath}
                                    <div class="shrink-0 bg-white p-1 rounded-lg shadow print:shadow-none border border-slate-200 self-end sm:self-center">
                                        <img src={(item as any).qrCodeDataUrl || (item as any).qrCodePath} alt="Event QR" class="w-14 h-14" />
                                    </div>
                                {/if}
                            </article>
                        {/each}
                    </div>
                </section>
            {/each}
        {/if}
    </div>
</div>

<style>
    @media print {
        @page {
            margin: 15mm;
            size: A4 portrait;
        }
        :global(body) {
            background-color: white !important;
            color: black !important;
        }
    }
</style>
