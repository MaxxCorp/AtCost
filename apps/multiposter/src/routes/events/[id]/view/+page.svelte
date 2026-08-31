<script lang="ts">
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import * as m from "$lib/paraglide/messages";
    import { page } from "$app/state";
    import { readEvent } from "../read.remote";
    import { authClient } from "$lib/auth";
    import { deleteEvents } from "../../delete.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import {
        Calendar,
        MapPin,
        Users,
        Tag as TagIcon,
        Earth,
        Euro,
        Info,
        Download,
        Pencil,
        Phone,
        Mail,
        Share2,
        Trash2,
        RefreshCw,
        ChevronDown,
        ExternalLink,
        Copy,
        Check,
        Lock,
    } from "@lucide/svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import { formatRecurrenceText } from "$lib/utils/format-recurrence";
    import { getEventRooms } from "$lib/utils/format-rooms";

    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import * as Dialog from "$lib/components/ui/dialog";

    const eventId = page.params.id || "";
    let dataPromise = $state(readEvent(eventId));

    const session = authClient.useSession();
    // Check if the user is authorized to edit
    function checkCanEdit(event: any) {
        const user = $session.data?.user;
        // Allow any authenticated user to edit
        return !!user;
    }

    // Formatting helpers
    function formatDate(dateStr: string | null | undefined) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    function formatTime(dateTimeStr: string | null | undefined) {
        if (!dateTimeStr) return "";
        return new Date(dateTimeStr).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    let canShare = $state(false);
    let copiedLink = $state(false);
    let heroImageFailed = $state(false);

    onMount(() => {
        canShare = typeof navigator !== "undefined" && !!navigator.share;
    });

    async function handleShare(event: any) {
        try {
            await navigator.share({
                title: event.summary,
                text: event.description ? event.description.replace(/<[^>]*>/g, '').slice(0, 160) : `Event: ${event.summary}`,
                url: window.location.href,
            });
        } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
                console.error("Error sharing:", err);
            }
        }
    }

    async function copyEventLink() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            copiedLink = true;
            toast.success("Link copied to clipboard");
            setTimeout(() => {
                copiedLink = false;
            }, 2500);
        } catch (err) {
            console.error("Failed to copy link:", err);
            toast.error("Failed to copy link");
        }
    }

    // Check if event is part of a series
    function isSeriesEvent(event: any): boolean {
        return !!(
            event.seriesId ||
            event.recurringEventId ||
            (event.recurrence && event.recurrence.length > 0)
        );
    }

    let deletingSeriesId = $state<string | null>(null);

    async function handleDeleteSeries(event: any) {
        const confirmed = confirm(m.delete_series_confirm());

        if (!confirmed) return;

        deletingSeriesId = event.id;
        try {
            await deleteEvents({ ids: [event.id] });
            await goto("/events");
        } catch (err) {
            console.error("Delete series error:", err);
            alert(
                err instanceof Error
                    ? err.message
                    : "An error occurred while deleting the series",
            );
        } finally {
            deletingSeriesId = null;
        }
    }

    async function handleDeleteInstance(event: any) {
        const confirmed = confirm(m.delete_confirm({ item: m.instance() }));

        if (!confirmed) return;

        deletingSeriesId = event.id;
        try {
            await deleteEvents({ ids: [event.id] });
            await goto("/events");
        } catch (err) {
            console.error("Delete instance error:", err);
            alert(
                err instanceof Error
                    ? err.message
                    : "An error occurred while deleting",
            );
        } finally {
            deletingSeriesId = null;
        }
    }
</script>

<div class="container mx-auto px-4 py-4 md:py-6">
    <div class="max-w-7xl mx-auto">
        {#await dataPromise}
            <LoadingSection message={m.loading_event_data()} />
        {:then event}
            {#if event}
                {@const hasDescription = !!(event.description && event.description.trim().length > 0)}
                {@const eventInstances = event.instances || []}
                {@const hasContact = !!event.resolvedContact}
                {@const hasStaffNotes = !!(checkCanEdit(event) && event.internalNotes && event.internalNotes.trim().length > 0)}

                <Breadcrumb feature="events" current={event.summary} />

                <div
                    class="bg-white shadow-xl rounded-2xl p-5 md:p-8 mt-4 border border-gray-100 space-y-6"
                >
                    <!-- Hero Image (if available) -->
                    {#if event.heroImage && !heroImageFailed}
                        <div class="relative w-full rounded-xl overflow-hidden bg-gray-900 border border-gray-100 shadow-xs max-h-[380px] sm:max-h-[420px]">
                            <img
                                src={event.heroImage}
                                alt={event.summary}
                                class="w-full h-56 sm:h-72 md:h-96 object-cover"
                                onerror={() => { heroImageFailed = true; }}
                            />
                        </div>
                    {/if}

                    <!-- Header with Title, Badges, and Event QR -->
                    <div
                        class="flex flex-col md:flex-row justify-between items-start gap-4 pb-2"
                    >
                        <div class="flex-1 space-y-2">
                            <div class="flex items-center gap-3 flex-wrap">
                                <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">
                                    {event.summary}
                                </h1>
                                {#if event.isPublic}
                                    <span
                                        class="px-2.5 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full flex items-center gap-1"
                                    >
                                        <Earth size={12} /> {m.public_label()}
                                    </span>
                                {/if}
                                {#if event.status}
                                    <span
                                        class="px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize {
                                            event.status === 'cancelled'
                                                ? 'bg-red-100 text-red-800'
                                                : event.status === 'confirmed'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-amber-100 text-amber-800'
                                        }"
                                    >
                                        {event.status}
                                    </span>
                                {/if}
                                {#if event.tags && event.tags.length > 0}
                                    {#each event.tags as tag}
                                        <span
                                            class="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100 flex items-center gap-1"
                                        >
                                            <TagIcon size={12} />
                                            {tag.name}
                                        </span>
                                    {/each}
                                {/if}
                            </div>
                        </div>

                        {#if event.qrCodePath}
                            <div
                                class="bg-white p-2.5 border border-gray-200 rounded-xl shadow-xs flex-shrink-0 flex flex-col items-center self-center md:self-start"
                            >
                                <img
                                    src={event.qrCodePath}
                                    alt={m.scan_to_view_event()}
                                    class="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                                />
                                <p
                                    class="text-[10px] text-center text-gray-400 mt-1 uppercase tracking-wider font-bold"
                                >
                                    {m.scan_to_share()}
                                </p>
                            </div>
                        {/if}
                    </div>

                    <!-- Content Grid (Responsive & Adapting to available data) -->
                    <div class="grid grid-cols-1 {hasContact && hasDescription ? 'md:grid-cols-2 lg:grid-cols-3' : hasContact || hasDescription ? 'md:grid-cols-2' : 'grid-cols-1 max-w-2xl'} gap-6 md:gap-8 items-start">
                        
                        <!-- Contact Column (if available) -->
                        {#if hasContact && event.resolvedContact}
                            <div class="space-y-4">
                                <section>
                                    <h3
                                        class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"
                                    >
                                        <Users size={15} /> {m.contact()}
                                    </h3>
                                    <div
                                        class="bg-gray-50 p-4 sm:p-5 rounded-xl relative border border-gray-100 space-y-3"
                                    >
                                        <p class="font-bold text-gray-900 text-base">
                                            {event.resolvedContact.name}
                                        </p>
                                        
                                        <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start">
                                            {#if event.resolvedContact.qrCodeDataUrl || event.resolvedContact.qrCodePath}
                                                <div
                                                    class="bg-white p-1.5 rounded-lg border border-gray-200 shadow-xs flex-shrink-0"
                                                >
                                                    <img
                                                        src={event.resolvedContact.qrCodeDataUrl || event.resolvedContact.qrCodePath}
                                                        alt={m.contact_qr()}
                                                        class="w-28 h-28 object-contain"
                                                    />
                                                </div>
                                            {/if}
                                            <div
                                                class="flex flex-col gap-1.5 text-sm min-w-0 flex-1"
                                            >
                                                {#if event.resolvedContact.phone}
                                                    <a
                                                        href="tel:{event.resolvedContact.phone}"
                                                        class="flex items-center gap-2 text-blue-600 hover:underline break-all text-pretty"
                                                    >
                                                        <Phone size={14} class="flex-shrink-0" />
                                                        <span>{event.resolvedContact.phone}</span>
                                                    </a>
                                                {/if}
                                                {#if event.resolvedContact.email}
                                                    <a
                                                        href="mailto:{event.resolvedContact.email}"
                                                        class="flex items-center gap-2 text-blue-600 hover:underline break-all text-pretty"
                                                    >
                                                        <Mail size={14} class="flex-shrink-0" />
                                                        <span>{event.resolvedContact.email}</span>
                                                    </a>
                                                {/if}
                                            </div>
                                        </div>

                                        <div class="pt-1">
                                            <a
                                                href={`data:text/vcard;charset=utf-8,${encodeURIComponent(`BEGIN:VCARD\nVERSION:3.0\nFN:${event.resolvedContact.name}\nEMAIL:${event.resolvedContact.email || ''}\nTEL:${event.resolvedContact.phone || ''}\nEND:VCARD`)}`}
                                                download={`${event.resolvedContact.name.replace(/[^a-z0-9]/gi, "_")}.vcf`}
                                                class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 border border-gray-200 px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50 transition-colors shadow-2xs"
                                            >
                                                <Download size={13} /> {m.save_contact()} (.vcf)
                                            </a>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        {/if}

                        <!-- Description Column (if available) -->
                        {#if hasDescription}
                            <div class="space-y-4">
                                <section>
                                    <h3
                                        class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"
                                    >
                                        <Info size={15} /> {m.about_this_event()}
                                    </h3>
                                    <div
                                        class="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-100"
                                    >
                                        {@html event.description}
                                    </div>
                                </section>
                            </div>
                        {/if}

                        <!-- Event Details Column -->
                        <div class="space-y-4">
                            <section>
                                <h3
                                    class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"
                                >
                                    <Calendar size={15} /> {m.key_details()}
                                </h3>
                                <ul class="space-y-3.5 bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-100 text-sm">
                                    <!-- Date & Time -->
                                    <li
                                        class="flex items-start gap-3 text-gray-700"
                                    >
                                        <Calendar
                                            size={18}
                                            class="text-blue-500 flex-shrink-0 mt-0.5"
                                        />
                                        <div>
                                            <span class="font-medium text-gray-900 block">
                                                {event.isAllDay &&
                                                event.startDateTime
                                                    ? formatDate(
                                                          event.startDateTime,
                                                      )
                                                    : event.startDateTime
                                                      ? `${formatDate(event.startDateTime)} at ${formatTime(event.startDateTime)}`
                                                      : ""}
                                            </span>
                                            {#if event.endDateTime && event.startDateTime && new Date(event.startDateTime).toDateString() !== new Date(event.endDateTime).toDateString()}
                                                <span
                                                    class="text-xs text-gray-500 block mt-0.5"
                                                >
                                                    {m.to()} {event.isAllDay
                                                        ? formatDate(
                                                              event.endDateTime,
                                                          )
                                                        : `${formatDate(event.endDateTime)} at ${formatTime(event.endDateTime)}`}
                                                </span>
                                            {:else if event.endDateTime && !event.isAllDay}
                                                <span
                                                    class="text-xs text-gray-500 block mt-0.5"
                                                >
                                                    {m.until()} {formatTime(
                                                        event.endDateTime,
                                                    )}
                                                </span>
                                            {/if}

                                            {#if event.recurringEventId || (event.seriesId && !event.recurringEventId && event.recurrence && (event.recurrence as string[]).length > 0)}
                                                <div class="mt-2">
                                                    {#if !event.recurringEventId && eventInstances.length > 0}
                                                        <Dialog.Root>
                                                            <Dialog.Trigger class="text-xs text-blue-600 hover:underline flex items-center gap-1 text-left font-medium">
                                                                <RefreshCw size={13} class="flex-shrink-0" />
                                                                {formatRecurrenceText((event.recurrence as string[])[0])} ({eventInstances.length} {m.instances()})
                                                            </Dialog.Trigger>
                                                            <Dialog.Content class="sm:max-w-[440px]">
                                                                <Dialog.Header>
                                                                    <Dialog.Title>{m.instances()}</Dialog.Title>
                                                                    <Dialog.Description>
                                                                        {event.recurrence ? formatRecurrenceText((event.recurrence as string[])[0]) : ''}
                                                                    </Dialog.Description>
                                                                </Dialog.Header>
                                                                <div class="max-h-[60vh] overflow-y-auto pr-1 mt-4 space-y-2">
                                                                    {#each eventInstances as instance}
                                                                        <a href={`/events/${instance.id}/view`} class="block p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                                                                            <div class="font-medium text-gray-900 text-sm">{instance.summary}</div>
                                                                            <div class="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                                                                                <Calendar size={13} />
                                                                                {formatDate(instance.startDateTime)} 
                                                                                {#if instance.startDateTime}
                                                                                    {formatTime(instance.startDateTime)}
                                                                                {/if}
                                                                            </div>
                                                                        </a>
                                                                    {/each}
                                                                </div>
                                                            </Dialog.Content>
                                                        </Dialog.Root>
                                                    {:else if event.recurringEventId && event.recurrence && (event.recurrence as string[]).length > 0}
                                                        <a href={`/events/${event.recurringEventId}/view`} class="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
                                                            <RefreshCw size={13} class="flex-shrink-0" />
                                                            {formatRecurrenceText((event.recurrence as string[])[0])}
                                                        </a>
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>
                                    </li>

                                    <!-- Locations -->
                                    {#if event.locations && event.locations.length > 0}
                                        {#each event.locations as loc}
                                            <li
                                                class="flex items-start gap-3 text-gray-700"
                                            >
                                                <MapPin
                                                    size={18}
                                                    class="text-red-500 flex-shrink-0 mt-0.5"
                                                />
                                                <div>
                                                    <a
                                                        href="https://www.google.com/maps/search/?api=1&query={encodeURIComponent(
                                                            `${loc.name} ${loc.street || ''} ${loc.houseNumber || ''} ${loc.zip || ''} ${loc.city || ''}`,
                                                        )}"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="hover:underline text-blue-600 font-medium inline-flex items-center gap-1"
                                                    >
                                                        <span>{loc.name}</span>
                                                        <ExternalLink size={12} class="opacity-60" />
                                                    </a>
                                                    {#if loc.street || loc.city}
                                                        <div
                                                            class="text-xs text-gray-500 mt-0.5"
                                                        >
                                                            {loc.street || ''}
                                                            {loc.houseNumber || ''}{#if loc.street && loc.city}, {/if}{loc.zip || ''}
                                                            {loc.city || ''}
                                                        </div>
                                                    {/if}
                                                </div>
                                            </li>
                                        {/each}
                                    {/if}

                                    <!-- Room Badges -->
                                    {#if getEventRooms(event).length > 0}
                                        <li class="flex items-center gap-1.5 pl-7 flex-wrap">
                                            {#each getEventRooms(event) as roomName (roomName)}
                                                <span
                                                    class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200"
                                                >
                                                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                                    {roomName}
                                                </span>
                                            {/each}
                                        </li>
                                    {/if}

                                    <!-- Category -->
                                    {#if event.categoryBerlinDotDe}
                                        <li
                                            class="flex items-center gap-3 text-gray-700"
                                        >
                                            <TagIcon
                                                size={18}
                                                class="text-purple-500 flex-shrink-0"
                                            />
                                            <span class="font-medium"
                                                >{event.categoryBerlinDotDe}</span
                                            >
                                        </li>
                                    {/if}

                                    <!-- Ticket Price -->
                                    {#if event.ticketPrice && !event.ticketPriceUnknown}
                                        <li
                                            class="flex items-center gap-3 text-gray-700"
                                        >
                                            <Euro
                                                size={18}
                                                class="text-green-600 flex-shrink-0"
                                            />
                                            <span class="font-medium">{event.ticketPrice}</span>
                                        </li>
                                    {/if}
                                </ul>
                            </section>

                            <!-- Staff Internal Notes (if present & user authorized) -->
                            {#if hasStaffNotes}
                                <section>
                                    <h3
                                        class="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5"
                                    >
                                        <Lock size={13} /> {m.internal_notes()} <span class="text-gray-400 font-normal">(Staff Only)</span>
                                    </h3>
                                    <div class="prose prose-sm prose-amber max-w-none bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 text-amber-900 leading-relaxed">
                                        {@html event.internalNotes}
                                    </div>
                                </section>
                            {/if}
                        </div>

                    </div>

                    <!-- Actions Toolbar (Unified, No Duplication) -->
                    <div class="flex flex-wrap items-center justify-between gap-3 pt-5 md:pt-6 border-t border-gray-100 mt-6">
                        <div class="flex flex-wrap items-center gap-3">
                            {#if event.iCalPath}
                                <Button
                                    href={event.iCalPath}
                                    download={`${event.summary.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`}
                                    class="flex items-center gap-2"
                                    variant="outline"
                                >
                                    <Download size={16} /> {m.add_to_calendar()}
                                </Button>
                            {/if}

                            {#if canShare}
                                <Button
                                    variant="outline"
                                    class="flex items-center gap-2"
                                    onclick={() => handleShare(event)}
                                >
                                    <Share2 size={16} /> {m.share()}
                                </Button>
                            {/if}

                            <Button
                                variant="outline"
                                class="flex items-center gap-2"
                                onclick={copyEventLink}
                            >
                                {#if copiedLink}
                                    <Check size={16} class="text-emerald-600" />
                                {:else}
                                    <Copy size={16} />
                                {/if}
                                {copiedLink ? 'Link Copied' : 'Copy Link'}
                            </Button>
                        </div>

                        {#if checkCanEdit(event)}
                            <div class="flex items-center gap-3">
                                {#if isSeriesEvent(event)}
                                    <!-- Edit dropdown for series events -->
                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger>
                                            <Button
                                                variant="default"
                                                class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                                            >
                                                <Pencil size={16} /> {m.edit()}
                                                <ChevronDown size={15} />
                                            </Button>
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Content align="end">
                                            <DropdownMenu.Item
                                                onclick={() =>
                                                    goto(`/events/${event.id}`)}
                                            >
                                                <Pencil size={15} class="mr-2" /> {m.edit_instance()}
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Item
                                                onclick={() =>
                                                    goto(
                                                        `/events/${event.id}?editSeries=true`,
                                                    )}
                                            >
                                                <RefreshCw size={15} class="mr-2" />
                                                {m.edit_series()}
                                            </DropdownMenu.Item>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Root>

                                    <!-- Delete dropdown for series events -->
                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger>
                                            <Button
                                                variant="outline"
                                                class="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                                                disabled={deletingSeriesId ===
                                                    event.id}
                                            >
                                                {#if deletingSeriesId === event.id}
                                                    <RefreshCw
                                                        size={16}
                                                        class="animate-spin"
                                                    /> {m.deleting()}
                                                {:else}
                                                    <Trash2 size={16} /> {m.delete()}
                                                    <ChevronDown size={15} />
                                                {/if}
                                            </Button>
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Content align="end">
                                            <DropdownMenu.Item
                                                onclick={() =>
                                                    handleDeleteInstance(event)}
                                            >
                                                <Trash2 size={15} class="mr-2" /> {m.delete_instance()}
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Item
                                                class="text-red-600"
                                                onclick={() =>
                                                    handleDeleteSeries(event)}
                                            >
                                                <Trash2 size={15} class="mr-2" /> {m.delete_series()}
                                            </DropdownMenu.Item>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Root>
                                {:else}
                                    <!-- Simple buttons for non-series events -->
                                    <Button
                                        variant="default"
                                        class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                                        onclick={() => goto(`/events/${event.id}`)}
                                    >
                                        <Pencil size={16} /> {m.edit_event()}
                                    </Button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            {:else}
                <ErrorSection
                    headline={m.event_not_found()}
                    message={m.event_not_found_message()}
                    href="/events"
                    button={m.back_to_events()}
                />
            {/if}
        {:catch error}
            <ErrorSection
                headline={m.error()}
                message={error instanceof Error
                    ? error.message
                    : m.failed_to_load_event()}
                href="/events"
                button={m.back_to_events()}
            />
        {/await}
    </div>
</div>
