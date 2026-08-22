<script lang="ts">
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
        Phone,
        Mail
    } from "@lucide/svelte";
    import { formatRecurrenceText } from "$lib/utils/format-recurrence";
    import { getEventRooms } from "$lib/utils/format-rooms";
    import * as m from "$lib/paraglide/messages";
    import { resolve } from "$app/paths";

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
    };

    type EnrichedAnnouncement = Announcement & {
        qrCodeDataUrl?: string;
    };

    let { items = [], kiosk }: {
        items: (Event | Announcement)[],
        kiosk: {
            name?: string;
            description?: string;
            locations?: LocationInfo[];
            rangeMode?: string;
            startDate?: string | Date;
            endDate?: string | Date;
        }
    } = $props();

    // View customization options
    let showQrCodes = $state(true);
    let showDescriptions = $state(true);
    let density = $state<"standard" | "compact">("standard");
    let activeFilter = $state<"all" | "events" | "news">("all");

    // Separate Announcements (News) from Scheduled Events
    let announcements = $derived(
        items.filter(item => !("startDateTime" in item) && "content" in item) as EnrichedAnnouncement[]
    );

    let events = $derived(
        items.filter(item => "startDateTime" in item) as EnrichedEvent[]
    );

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

        return sortedKeys.map(key => {
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
                    href={resolve('/kiosks')} 
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
                        {m.all_items_tab()} ({items.length})
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
                        onclick={() => density = "standard"}
                        class="px-2.5 py-1 rounded-lg font-medium transition-colors {density === 'standard' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400'}"
                        title={m.layout_standard()}
                    >
                        {m.layout_standard()}
                    </button>
                    <button
                        type="button"
                        onclick={() => density = "compact"}
                        class="px-2.5 py-1 rounded-lg font-medium transition-colors {density === 'compact' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400'}"
                        title={m.layout_compact()}
                    >
                        {m.layout_compact()}
                    </button>
                </div>

                <!-- Options Checkboxes -->
                <label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                    <input type="checkbox" bind:checked={showQrCodes} class="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5" />
                    <span>{m.show_qr_codes()}</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                    <input type="checkbox" bind:checked={showDescriptions} class="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5" />
                    <span>{m.show_descriptions()}</span>
                </label>

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
                        <p class="text-sm text-slate-600 max-w-2xl leading-relaxed">
                            {kiosk.description}
                        </p>
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
                {#if kiosk?.locations && kiosk.locations.some(l => l.contact)}
                    {@const primaryLoc = kiosk.locations.find(l => l.contact)}
                    {@const contact = primaryLoc?.contact}
                    {#if contact}
                        <div class="shrink-0 bg-slate-50 print:bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 text-xs space-y-1.5 min-w-[220px]">
                            <div class="font-bold text-slate-900 uppercase tracking-wider text-[10px] text-slate-500 flex items-center gap-1">
                                <User class="w-3 h-3" />
                                <span>{m.contact()}</span>
                            </div>
                            <div class="font-bold text-slate-900 text-sm">{contact.name}</div>
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

                            {#if showQrCodes && (contact.qrCodeDataUrl || contact.qrCodePath)}
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
                                        <h3 class="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                                            {announcement.title}
                                        </h3>
                                        {#if announcement.createdAt}
                                            <span class="text-[11px] text-slate-500 font-medium whitespace-nowrap shrink-0">
                                                {formatFullDate(announcement.createdAt)}
                                            </span>
                                        {/if}
                                    </div>

                                    {#if showDescriptions && announcement.content}
                                        <div class="rich-description text-xs sm:text-sm text-slate-700 dark:text-slate-300 print:text-black leading-relaxed">
                                            {@html announcement.content}
                                        </div>
                                    {/if}

                                    <!-- Tags & Associated Locations -->
                                    <div class="flex flex-wrap items-center gap-2 pt-1">
                                        {#if announcement.locations && announcement.locations.length > 0}
                                            {#each announcement.locations as loc (loc.id)}
                                                <span class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-white print:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                                                    <MapPin class="w-3 h-3 text-slate-500" />
                                                    {loc.name}
                                                </span>
                                            {/each}
                                        {/if}

                                        {#if announcement.tags && announcement.tags.length > 0}
                                            {#each announcement.tags as tag (typeof tag === 'string' ? tag : tag.id || tag.name)}
                                                <span class="text-[11px] text-slate-600 bg-white print:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                                                    #{typeof tag === 'string' ? tag : tag.name}
                                                </span>
                                            {/each}
                                        {/if}
                                    </div>
                                </div>

                                <!-- Announcement QR Code -->
                                {#if showQrCodes && ((announcement as any).qrCodeDataUrl || (announcement as any).qrCodePath)}
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
                                    <article class="{density === 'standard' ? 'py-4 sm:py-5' : 'py-2.5 sm:py-3'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:break-inside-avoid">
                                        <!-- Left Date & Time Column -->
                                        <div class="flex items-center gap-3 shrink-0 min-w-[130px]">
                                            <!-- Date Badge -->
                                            <div class="flex flex-col items-center justify-center w-12 h-12 bg-slate-100 print:bg-slate-50 border border-slate-200 rounded-xl text-center shadow-xs">
                                                <span class="text-[10px] font-bold text-blue-600 print:text-black leading-none uppercase">
                                                    {formatDateMonth(event.startDateTime)}
                                                </span>
                                                <span class="text-lg font-black text-slate-900 leading-tight">
                                                    {formatDateDay(event.startDateTime)}
                                                </span>
                                                <span class="text-[9px] text-slate-500 leading-none uppercase">
                                                    {formatDateWeekday(event.startDateTime)}
                                                </span>
                                            </div>

                                            <!-- Time Details -->
                                            <div class="text-xs font-semibold text-slate-700">
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
                                            </div>
                                        </div>

                                        <!-- Center Event Details -->
                                        <div class="flex-1 space-y-1 min-w-0">
                                            <div class="flex flex-wrap items-center gap-2">
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
                                                <h3 class="text-base sm:text-lg font-bold text-slate-900 leading-snug {event.status === 'cancelled' ? 'line-through text-slate-400' : ''}">
                                                    {event.summary || m.untitled_event()}
                                                </h3>
                                            </div>

                                            <!-- Room, Location & Recurrence Info -->
                                            <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                                {#if eventRooms.length > 0}
                                                    {#each eventRooms as roomName (roomName)}
                                                        <span class="inline-flex items-center gap-1 font-semibold text-blue-700 print:text-black">
                                                            <MapPin class="w-3.5 h-3.5 text-blue-600 print:text-black" />
                                                            {roomName}
                                                        </span>
                                                    {/each}
                                                {/if}

                                                {#if (event as any).recurrence && ((event as any).recurrence as string[]).length > 0}
                                                    <span class="inline-flex items-center gap-1 text-slate-600 font-medium">
                                                        <RefreshCw class="w-3 h-3 text-slate-500" />
                                                        {formatRecurrenceText((event as any).recurrence)}
                                                    </span>
                                                {/if}
                                            </div>

                                            {#if showDescriptions && event.description}
                                                <div class="rich-description text-xs text-slate-600 dark:text-slate-300 print:text-black leading-relaxed pt-0.5">
                                                    {@html event.description}
                                                </div>
                                            {/if}

                                            <!-- Tags -->
                                            {#if event.tags && event.tags.length > 0}
                                                <div class="flex flex-wrap gap-1.5 pt-1">
                                                    {#each event.tags as tag (typeof tag === 'string' ? tag : tag.id || tag.name)}
                                                        <span class="px-1.5 py-0.5 bg-slate-100 print:bg-slate-50 border border-slate-200 text-slate-600 rounded text-[10px]">
                                                            #{typeof tag === 'string' ? tag : tag.name}
                                                        </span>
                                                    {/each}
                                                </div>
                                            {/if}
                                        </div>

                                        <!-- Right Scannable QR Code -->
                                        {#if showQrCodes && (event.qrCodeDataUrl || event.qrCodePath)}
                                            <div class="shrink-0 flex flex-col items-center justify-center p-1.5 bg-white border border-slate-200 rounded-xl self-end sm:self-center">
                                                <img 
                                                    src={event.qrCodeDataUrl || event.qrCodePath} 
                                                    alt="Event QR" 
                                                    class="{density === 'standard' ? 'w-14 h-14' : 'w-10 h-10'}" 
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
