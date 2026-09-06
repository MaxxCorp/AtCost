<script lang="ts">
    import { type Event } from "@ac/validations";

    import { m } from "$lib/paraglide/messages";
    import { getLocale } from "$lib/paraglide/runtime";
    import {
        Calendar,
        Clock,
        MapPin,
        Users,
        Globe,
        QrCode,
        Accessibility,
        Tag,
        Euro,
        RefreshCw,
        Earth,
        Info,
        Sparkles,
    } from "@lucide/svelte";
    import { formatRecurrenceText } from "$lib/utils/format-recurrence";
    import { formatTicketPrice } from "$lib/utils/format-ticket-price";
    import { getEventRooms } from "$lib/utils/format-rooms";
    import { isNonSeriesEvent } from "$lib/utils/event-series";

    let { event }: { event: Event } = $props();

    function formatDateTime(dateStr: string | null) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleString(getLocale(), {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    }

    function formatDate(dateStr: string | null) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString(getLocale(), {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
        });
    }

    const displayDate = $derived(
        event.isAllDay && event.startDateTime
            ? formatDate(event.startDateTime)
            : event.startDateTime
              ? formatDateTime(event.startDateTime)
              : "",
    );

    let imageLoadError = $state(false);
    let heroImageError = $state(false);

    const hasContact = $derived(!!event.resolvedContact);
    const hasDescription = $derived(!!(event.description && event.description.trim().length > 0));
    const displayTicketPrice = $derived(formatTicketPrice((event as any).ticketPrice, (event as any).ticketPriceUnknown));
    const hasSidebar = $derived(
        !!(event as any).qrCodeDataUrl ||
        !!event.qrCodePath ||
        !!displayTicketPrice ||
        !!(event as any).categoryBerlinDotDe ||
        (((event as any).confirmedParticipants !== undefined) && (event as any).confirmedParticipants > 0) ||
        (((event as any).inclusivityInformation) && (event as any).inclusivityInformation.length > 0)
    );
</script>

<div
    class="max-w-7xl w-full mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100 flex flex-col"
>
    <!-- Optional Hero Image -->
    {#if event.heroImage && !heroImageError}
        <div class="relative w-full h-48 sm:h-64 md:h-80 lg:h-96 overflow-hidden bg-slate-950 flex-shrink-0">
            <img
                src={event.heroImage}
                alt={event.summary}
                class="w-full h-full object-cover"
                onerror={() => { heroImageError = true; }}
            />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none"></div>
        </div>
    {/if}

    <!-- Header / Banner -->
    <div class="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 sm:p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                {event.summary}
            </h1>
            {#if event.status === 'cancelled'}
                <span class="bg-rose-600 text-white text-xs sm:text-sm font-bold px-3 py-1 rounded-full border border-white/20 uppercase tracking-widest shadow-sm">
                    {m.cancelled?.() || 'Cancelled'}
                </span>
            {:else if event.isPublic}
                <span class="bg-emerald-500/90 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Earth size={12} /> {m.public_label?.() || 'Public'}
                </span>
            {/if}
            {#if isNonSeriesEvent(event)}
                <span class="bg-amber-500 text-white text-xs sm:text-sm font-black px-3 py-1 rounded-full border border-white/20 uppercase tracking-wider shadow-sm flex items-center gap-1.5" title={m.special_event_tooltip?.() || ''}>
                    <Sparkles class="w-3.5 h-3.5 text-amber-100" />
                    <span>{m.special_event_badge?.() || 'Highlight'}</span>
                </span>
            {/if}
        </div>
        <div class="flex flex-col items-start md:items-end text-blue-100 text-sm sm:text-base font-medium flex-shrink-0">
            <div class="flex items-center gap-2">
                <Calendar class="w-4 h-4" />
                <span>{displayDate}</span>
            </div>
            {#if (event.recurrence && (event.recurrence as string[]).length > 0) || event.recurringEventId || event.seriesId}
                <div class="flex items-center gap-1.5 text-xs sm:text-sm text-blue-200 mt-1 bg-white/10 px-2.5 py-1 rounded-full border border-white/20">
                    <RefreshCw class="w-3.5 h-3.5" />
                    <span>{formatRecurrenceText((event.recurrence as string[])?.[0])}</span>
                </div>
            {/if}
        </div>
    </div>

    <!-- Content Grid (Responsive & Adaptive to missing data) -->
    <div class="p-4 sm:p-6 grid grid-cols-1 {hasDescription && hasSidebar ? 'md:grid-cols-2 lg:grid-cols-3' : hasDescription || hasSidebar ? 'md:grid-cols-2' : 'grid-cols-1'} gap-5 md:gap-6">
        
        <!-- Meta Data Column (Locations & Contact) -->
        <div class="space-y-4 {(!hasDescription && !hasSidebar) ? 'max-w-2xl mx-auto w-full' : ''}">
            {#if event.locations && event.locations.length > 0}
                <div class="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <MapPin class="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <h3 class="font-semibold text-gray-900 text-sm">
                            {m.location()}
                        </h3>
                        {#each event.locations as loc}
                            <p class="text-gray-700 text-sm font-medium mt-0.5">{loc.name}</p>
                            {#if loc.street || loc.city}
                                <p class="text-xs text-gray-500">{loc.street || ''} {loc.houseNumber || ''} {loc.zip || ''} {loc.city || ''}</p>
                            {/if}
                        {/each}
                        {#if getEventRooms(event).length > 0}
                            <div class="flex flex-wrap items-center gap-1.5 mt-2">
                                {#each getEventRooms(event) as roomName (roomName)}
                                    <span
                                        class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200"
                                    >
                                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                        {roomName}
                                    </span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            {#if event.resolvedContact}
                <div class="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <Users class="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
                    <div class="min-w-0 flex-1">
                        <h3 class="font-semibold text-gray-900 text-sm">{m.contact()}</h3>
                        <p class="text-gray-900 font-medium text-sm mt-0.5">
                            {event.resolvedContact.name}
                        </p>

                        {#if event.resolvedContact.email}
                            <p class="text-xs text-gray-600 mt-1 truncate">
                                <a
                                    href="mailto:{event.resolvedContact.email}"
                                    class="hover:text-blue-600 break-all"
                                >{event.resolvedContact.email}</a>
                            </p>
                        {/if}
                        {#if event.resolvedContact.phone}
                            <p class="text-xs text-gray-600 mt-0.5">
                                <a
                                    href="tel:{event.resolvedContact.phone}"
                                    class="hover:text-blue-600"
                                >{event.resolvedContact.phone}</a>
                            </p>
                        {/if}

                        <!-- Contact QR Code -->
                        {#if event.resolvedContact.qrCodeDataUrl || event.resolvedContact.qrCodePath}
                            <div class="mt-3">
                                <img
                                    src={event.resolvedContact.qrCodeDataUrl || event.resolvedContact.qrCodePath}
                                    alt="Contact QR"
                                    class="w-28 h-28 object-contain border rounded-lg bg-white p-1"
                                />
                                <p class="text-2xs text-gray-500 mt-1">
                                    {m.scan_contact_info()}
                                </p>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>

        <!-- Description Column -->
        {#if hasDescription}
            <div class="space-y-4">
                <div class="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                    <h3 class="font-semibold text-gray-900 text-sm mb-2 flex items-center gap-1.5">
                        <Info size={16} class="text-blue-600" />
                        {m.about_this_event?.() || 'About'}
                    </h3>
                    <div class="prose prose-sm text-gray-700 max-w-none whitespace-pre-wrap leading-relaxed">
                        {@html event.description}
                    </div>
                </div>
            </div>
        {/if}

        <!-- Sidebar / Visuals -->
        {#if hasSidebar}
            <div class="space-y-4">
                <!-- QR Code Card -->
                {#if (event as any).qrCodeDataUrl || (event as any).qrCodePath}
                    <div
                        class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex flex-col items-center text-center"
                    >
                        <div class="bg-gray-50 p-2.5 rounded-lg mb-2">
                            {#if (event as any).qrCodeDataUrl}
                                <img
                                    src={(event as any).qrCodeDataUrl}
                                    alt="QR Code"
                                    class="w-28 h-28 object-contain"
                                />
                            {:else if event.qrCodePath}
                                {#if !imageLoadError}
                                    <img
                                        src={event.qrCodePath}
                                        alt="QR Code"
                                        class="w-28 h-28 object-contain"
                                        onerror={() => (imageLoadError = true)}
                                    />
                                {:else}
                                    <QrCode class="w-28 h-28 text-gray-800" />
                                {/if}
                            {/if}
                        </div>
                        <p class="text-xs text-gray-500 font-medium">
                            {m.scan_for_details()}
                        </p>
                    </div>
                {/if}

                <!-- Event Details Sidebar -->
                {#if displayTicketPrice || (event as any).categoryBerlinDotDe || ((event as any).confirmedParticipants !== undefined && (event as any).confirmedParticipants > 0) || ((event as any).inclusivityInformation && (event as any).inclusivityInformation.length > 0)}
                    <div
                        class="bg-indigo-50/70 rounded-xl p-4 border border-indigo-100 space-y-3"
                    >
                        <h3
                            class="font-semibold text-indigo-900 text-sm flex items-center gap-1.5"
                        >
                            <Tag class="w-4 h-4 text-indigo-700" />
                            {m.event_details()}
                        </h3>

                        <div class="space-y-2.5 text-xs">
                            {#if displayTicketPrice}
                                <div class="flex items-center gap-2 text-indigo-800">
                                    <Euro class="w-4 h-4 opacity-75" />
                                    <span class="font-semibold">{displayTicketPrice}</span>
                                </div>
                            {/if}

                            {#if (event as any).categoryBerlinDotDe}
                                <div class="flex items-start gap-2 text-indigo-800">
                                    <Tag class="w-4 h-4 opacity-75 mt-0.5" />
                                    <span class="bg-white/60 px-2 py-0.5 rounded font-medium">
                                        {(event as any).categoryBerlinDotDe}
                                    </span>
                                </div>
                            {/if}

                            {#if (event as any).confirmedParticipants !== undefined && (event as any).confirmedParticipants > 0}
                                <div class="flex items-start gap-2 text-indigo-800">
                                    <Users class="w-4 h-4 opacity-75 mt-0.5" />
                                    <span>
                                        <strong>{(event as any).confirmedParticipants}</strong> {m.confirmed_participants()}
                                        {#if event.maxOccupancy}
                                            <span class="opacity-75 block">{m.capacity()}: {event.maxOccupancy}</span>
                                        {/if}
                                    </span>
                                </div>
                            {/if}

                            {#if (event as any).inclusivityInformation && (event as any).inclusivityInformation.length > 0}
                                <div class="flex items-start gap-2 text-indigo-800">
                                    <Accessibility class="w-4 h-4 opacity-75 mt-0.5" />
                                    <div class="flex flex-wrap gap-1">
                                        {#each (event as any).inclusivityInformation as info}
                                            <span class="bg-white/60 text-indigo-900 px-1.5 py-0.5 rounded border border-indigo-100/50">
                                                {info}
                                            </span>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>
