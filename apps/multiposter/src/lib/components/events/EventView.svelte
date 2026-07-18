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
    } from "@lucide/svelte";

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
</script>

<div
    class="max-w-7xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100"
>
    <!-- Header / Banner -->
    <div class="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div class="flex items-center gap-3">
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">
                {event.summary}
            </h1>
            {#if event.status === 'cancelled'}
                <span class="bg-red-600 text-white text-xs sm:text-sm font-bold px-3 py-1 rounded-full border-2 border-white/20 uppercase tracking-widest shadow-sm">
                    {m.cancelled?.() || 'Cancelled'}
                </span>
            {/if}
        </div>
        <div class="flex items-center gap-2 text-blue-100 text-sm sm:text-base font-medium">
            <Calendar class="w-4 h-4" />
            <span>{displayDate}</span>
        </div>
    </div>

    <div class="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        <!-- Meta Data Column -->
        <div class="space-y-4">
                {#if event.locations && event.locations.length > 0}
                    <div
                        class="flex items-start gap-3 p-4 bg-gray-50 rounded-xl"
                    >
                        <MapPin class="w-7 h-7 text-blue-600 mt-0.5" />
                        <div>
                            <h3 class="font-semibold text-gray-900">
                                {m.location()}
                            </h3>
                            {#each event.locations as loc}
                                <p class="text-gray-600">{loc.name}</p>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if event.resolvedContact}
                    <div
                        class="flex items-start gap-3 p-4 bg-gray-50 rounded-xl"
                    >
                        <Users class="w-6 h-6 text-blue-600 mt-1" />
                        <div>
                            <h3 class="font-semibold text-gray-900">{m.contact()}</h3>
                            <p class="text-gray-900 font-medium text-sm">
                                {event.resolvedContact.name}
                            </p>

                            {#if event.resolvedContact.email}
                                <p class="text-sm text-gray-600 mt-1">
                                    <a
                                        href="mailto:{event.resolvedContact.email}"
                                        class="hover:text-blue-600 break-all"
                                        >{event.resolvedContact.email}</a
                                    >
                                </p>
                            {/if}
                            {#if event.resolvedContact.phone}
                                <p class="text-sm text-gray-600">
                                    <a
                                        href="tel:{event.resolvedContact.phone}"
                                        class="hover:text-blue-600"
                                        >{event.resolvedContact.phone}</a
                                    >
                                </p>
                            {/if}



                            <!-- Contact QR Code -->
                            {#if event.resolvedContact.qrCodeDataUrl}
                                <div class="mt-4">
                                    <img
                                        src={event.resolvedContact
                                            .qrCodeDataUrl}
                                        alt="Contact QR"
                                        class="w-32 h-32 object-contain border rounded-lg bg-white p-1"
                                    />
                                    <p class="text-xs text-gray-500 mt-1">
                                        {m.scan_contact_info()}
                                    </p>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
        </div>

        <!-- Description Column -->
        <div class="space-y-4">
            <div class="prose prose-lg text-gray-600 max-w-none">
                <div class="whitespace-pre-wrap">
                    {@html event.description || m.no_description_provided()}
                </div>
            </div>
        </div>

        <!-- Sidebar / Visuals -->
        <div class="space-y-3 md:space-y-4">
            <!-- QR Code Card -->
            {#if (event as any).qrCodeDataUrl || (event as any).qrCodePath}
                <div
                    class="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm flex flex-col items-center text-center"
                >
                    <div class="bg-gray-100 p-4 rounded-lg mb-4">
                        {#if (event as any).qrCodeDataUrl}
                            <img
                                src={(event as any).qrCodeDataUrl}
                                alt="QR Code"
                                class="w-32 h-32 object-contain"
                            />
                        {:else if event.qrCodePath}
                            <!-- Fallback to server path if offline cache (dataUrl) is missing/failed -->
                            {#if !imageLoadError}
                                <img
                                    src={event.qrCodePath}
                                    alt="QR Code"
                                    class="w-32 h-32 object-contain"
                                    onerror={() => (imageLoadError = true)}
                                />
                            {:else}
                                <QrCode class="w-32 h-32 text-gray-800" />
                            {/if}
                        {/if}
                    </div>
                    <p class="text-sm text-gray-500 font-medium">
                        {m.scan_for_details()}
                    </p>
                </div>
            {/if}

            <!-- Event Details Sidebar -->
            {#if (event as any).ticketPrice || (event as any).categoryBerlinDotDe || ((event as any).confirmedParticipants !== undefined && (event as any).confirmedParticipants > 0) || ((event as any).inclusivityInformation && (event as any).inclusivityInformation.length > 0)}
                <div
                    class="bg-indigo-50 rounded-xl p-4 md:p-6 border border-indigo-100"
                >
                    <h3
                        class="font-semibold text-indigo-900 mb-4 flex items-center gap-2"
                    >
                        <Tag class="w-5 h-5 text-indigo-700" />
                        {m.event_details()}
                    </h3>

                    <div class="space-y-4">
                        {#if (event as any).ticketPrice && !(event as any).ticketPriceUnknown}
                            <div
                                class="flex items-center gap-3 text-indigo-800"
                            >
                                <Euro class="w-5 h-5 opacity-75" />
                                <span class="text-sm font-medium"
                                    >{(event as any).ticketPrice}</span
                                >
                            </div>
                        {/if}

                        {#if (event as any).categoryBerlinDotDe}
                            <div class="flex items-start gap-3 text-indigo-800">
                                <div class="mt-1">
                                    <Tag class="w-5 h-5 opacity-75" />
                                </div>
                                <span
                                    class="bg-white/50 px-2 py-1 rounded text-sm font-medium"
                                >
                                    {(event as any).categoryBerlinDotDe}
                                </span>
                            </div>
                        {/if}

                        {#if (event as any).confirmedParticipants !== undefined && (event as any).confirmedParticipants > 0}
                            <div class="flex items-start gap-3 text-indigo-800">
                                <div class="mt-1">
                                    <Users class="w-5 h-5 opacity-75" />
                                </div>
                                <span class="text-sm">
                                    <strong
                                        >{(event as any).confirmedParticipants}</strong
                                    >
                                    {m.confirmed_participants()}
                                    {#if event.maxOccupancy}
                                        <span class="opacity-75 block text-xs"
                                            >{m.capacity()}: {event.maxOccupancy}</span
                                        >
                                    {/if}
                                </span>
                            </div>
                        {/if}

                        {#if (event as any).inclusivityInformation && (event as any).inclusivityInformation.length > 0}
                            <div class="flex items-start gap-3 text-indigo-800">
                                <div class="mt-1">
                                    <Accessibility class="w-5 h-5 opacity-75" />
                                </div>
                                <div class="flex flex-wrap gap-1.5">
                                    {#each (event as any).inclusivityInformation as info}
                                        <span
                                            class="bg-white/50 text-indigo-900 px-2 py-0.5 rounded text-sm border border-indigo-100/50"
                                        >
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
    </div>
</div>
