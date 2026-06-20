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
    } from "@lucide/svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import { formatRecurrenceText } from "$lib/utils/format-recurrence";

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
    onMount(() => {
        canShare = typeof navigator !== "undefined" && !!navigator.share;
    });

    async function handleShare(event: any) {
        try {
            await navigator.share({
                title: event.summary,
                text: event.description || `Event: ${event.summary}`,
                url: window.location.href,
            });
        } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
                console.error("Error sharing:", err);
            }
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
                <Breadcrumb feature="events" current={event.summary} />

                <div
                    class="bg-white shadow-xl rounded-2xl p-5 md:p-6 mt-4 border border-gray-100 space-y-6"
                >
                    <!-- Header with Title and QR -->
                    <div
                        class="flex flex-col md:flex-row justify-between items-start gap-4"
                    >
                        <div class="flex-1">
                            <div class="flex items-center gap-3 mb-2 flex-wrap">
                                <h1 class="text-3xl font-bold text-gray-900">
                                    {event.summary}
                                </h1>
                                {#if event.isPublic}
                                    <span
                                        class="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center gap-1"
                                    >
                                        <Earth size={12} /> {m.public_label()}
                                    </span>
                                {/if}
                                {#if event.status}
                                    <span
                                        class="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-medium rounded-full capitalize"
                                    >
                                        {event.status}
                                    </span>
                                {/if}
                                {#if event.tags && event.tags.length > 0}
                                    {#each event.tags as tag}
                                        <span
                                            class="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100 flex items-center gap-1"
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
                                class="bg-white p-2 border rounded-xl shadow-sm flex-shrink-0 flex flex-col items-center"
                            >
                                <img
                                    src={event.qrCodePath}
                                    alt={m.scan_to_view_event()}
                                    class="w-32 h-32"
                                />
                                <p
                                    class="text-[10px] text-center text-gray-400 mt-1 uppercase tracking-wider font-bold"
                                >
                                    {m.scan_to_share()}
                                </p>
                            </div>
                        {/if}
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        <!-- Contact Column -->
                        <div class="space-y-4 md:space-y-6">
                            {#if event.resolvedContact}
                                <section>
                                    <h3
                                        class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"
                                    >
                                        <Users size={16} /> {m.contact()}
                                    </h3>
                                    <div
                                        class="bg-gray-50 p-4 rounded-lg relative border border-gray-100"
                                    >
                                        <p
                                            class="font-bold text-gray-900 truncate"
                                        >
                                            {event.resolvedContact.name}
                                        </p>
                                        <div class="flex gap-4 items-start">
                                            {#if event.resolvedContact.qrCodeDataUrl}
                                                <div
                                                    class="bg-white p-1 rounded border shadow-sm flex-shrink-0"
                                                >
                                                    <img
                                                        src={event
                                                            .resolvedContact
                                                            .qrCodeDataUrl}
                                                        alt={m.contact_qr()}
                                                        class="w-32 h-32 object-contain"
                                                    />
                                                </div>
                                            {/if}
                                            <div
                                                class="flex flex-col gap-1 text-sm min-w-0 flex-1"
                                            >
                                                {#if event.resolvedContact.phone}
                                                    <a
                                                        href="tel:{event
                                                            .resolvedContact
                                                            .phone}"
                                                        class="flex items-center gap-2 text-blue-600 hover:underline break-all text-pretty"
                                                    >
                                                        <Phone size={14} />
                                                        {event.resolvedContact
                                                            .phone}
                                                    </a>
                                                {/if}
                                                {#if event.resolvedContact.email}
                                                    <a
                                                        href="mailto:{event
                                                            .resolvedContact
                                                            .email}"
                                                        class="flex items-center gap-2 text-blue-600 hover:underline break-all text-pretty"
                                                    >
                                                        <Mail size={14} />
                                                        {event.resolvedContact
                                                            .email}
                                                    </a>
                                                {/if}
                                            </div>
                                        </div>
                                        <a
                                            href={`data:text/vcard;charset=utf-8,${encodeURIComponent(`BEGIN:VCARD\nVERSION:3.0\nFN:${event.resolvedContact.name}\nEMAIL:${event.resolvedContact.email}\nTEL:${event.resolvedContact.phone}\nEND:VCARD`)}`}
                                            download={`${event.resolvedContact.name.replace(/[^a-z0-9]/gi, "_")}.vcf`}
                                            class="inline-flex items-center gap-1 mt-2 text-xs font-medium text-gray-600 hover:text-gray-900 border px-2 py-1 rounded bg-white hover:bg-gray-50 w-max transition-colors"
                                        >
                                            <Download size={12} /> {m.save_contact()}
                                        </a>
                                    </div>
                                </section>
                            {/if}
                        </div>
                        <!-- Description Column -->
                        <div class="space-y-4 md:space-y-6">
                            {#if event.description}
                                <section>
                                    <h3
                                        class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"
                                    >
                                        <Info size={16} /> {m.about_this_event()}
                                    </h3>
                                    <div
                                        class="prose max-w-none text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100"
                                    >
                                        {@html event.description}
                                    </div>
                                </section>
                            {/if}
                        </div>

                        <!-- Event Details Column -->
                        <div class="space-y-4 md:space-y-6">
                            <section>
                                <h3
                                    class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"
                                >
                                    <Info size={16} /> {m.key_details()}
                                </h3>
                                <ul class="space-y-3">
                                    <li
                                        class="flex items-center gap-3 text-gray-700"
                                    >
                                        <Calendar
                                            size={18}
                                            class="text-blue-500 flex-shrink-0"
                                        />
                                        <div>
                                            <span class="font-medium block">
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
                                                    class="text-sm text-gray-500 block"
                                                >
                                                    {m.to()} {event.isAllDay
                                                        ? formatDate(
                                                              event.endDateTime,
                                                          )
                                                        : `${formatDate(event.endDateTime)} at ${formatTime(event.endDateTime)}`}
                                                </span>
                                            {:else if event.endDateTime && !event.isAllDay}
                                                <span
                                                    class="text-sm text-gray-500 block"
                                                >
                                                    {m.until()} {formatTime(
                                                        event.endDateTime,
                                                    )}
                                                </span>
                                            {/if}

                                            {#if event.recurringEventId || (event.seriesId && !event.recurringEventId && event.recurrence && (event.recurrence as string[]).length > 0)}
                                                <div class="mt-1">
                                                    {#if !event.recurringEventId && event.instances && event.instances.length > 0}
                                                        <Dialog.Root>
                                                            <Dialog.Trigger class="text-sm text-blue-600 hover:underline flex items-center gap-1 text-left">
                                                                <RefreshCw size={14} class="flex-shrink-0" />
                                                                {formatRecurrenceText((event.recurrence as string[])[0])}
                                                            </Dialog.Trigger>
                                                            <Dialog.Content class="sm:max-w-[425px]">
                                                                <Dialog.Header>
                                                                    <Dialog.Title>{m.instances()}</Dialog.Title>
                                                                    <Dialog.Description>
                                                                        {formatRecurrenceText((event.recurrence as string[])[0])}
                                                                    </Dialog.Description>
                                                                </Dialog.Header>
                                                                <div class="max-h-[60vh] overflow-y-auto pr-2 mt-4 space-y-2">
                                                                    {#each event.instances as instance}
                                                                        <a href={`/events/${instance.id}/view`} class="block p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                                                                            <div class="font-medium text-gray-900">{instance.summary}</div>
                                                                            <div class="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                                                                <Calendar size={14} />
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
                                                        <a href={`/events/${event.recurringEventId}/view`} class="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                                            <RefreshCw size={14} class="flex-shrink-0" />
                                                            {formatRecurrenceText((event.recurrence as string[])[0])}
                                                        </a>
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>
                                    </li>

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
                                                            `${loc.name} ${loc.street} ${loc.houseNumber} ${loc.zip} ${loc.city}`,
                                                        )}"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="hover:underline text-blue-600 font-medium"
                                                    >
                                                        {loc.name}
                                                    </a>
                                                    <div
                                                        class="text-sm text-gray-500"
                                                    >
                                                        {loc.street}
                                                        {loc.houseNumber}, {loc.zip}
                                                        {loc.city}
                                                    </div>
                                                </div>
                                            </li>
                                        {/each}
                                    {/if}
                                    {#if event.categoryBerlinDotDe}
                                        <li
                                            class="flex items-center gap-3 text-gray-700"
                                        >
                                            <TagIcon
                                                size={18}
                                                class="text-purple-500 flex-shrink-0"
                                            />
                                            <span
                                                >{event.categoryBerlinDotDe}</span
                                            >
                                        </li>
                                    {/if}

                                    {#if event.ticketPrice}
                                        <li
                                            class="flex items-center gap-3 text-gray-700"
                                        >
                                            <Euro
                                                size={18}
                                                class="text-green-600 flex-shrink-0"
                                            />
                                            <span>{event.ticketPrice}</span>
                                        </li>
                                    {/if}
                                </ul>
                            </section>

                        </div>

                    </div>

                    <!-- Actions -->
                    <div class="flex flex-wrap gap-4 pt-5 md:pt-6 border-t mt-6">
                        {#if event.iCalPath}
                            <Button
                                href={event.iCalPath}
                                download={`${event.summary.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`}
                                class="flex items-center gap-2"
                                variant="outline"
                            >
                                <Download size={18} /> {m.add_to_calendar()}
                            </Button>
                        {/if}

                        {#if canShare}
                            <Button
                                variant="outline"
                                class="flex items-center gap-2"
                                onclick={() => handleShare(event)}
                            >
                                <Share2 size={18} /> {m.share()}
                            </Button>
                        {/if}

                        {#if checkCanEdit(event)}
                            {#if isSeriesEvent(event)}
                                <!-- Edit dropdown for series events -->
                                <DropdownMenu.Root>
                                    <DropdownMenu.Trigger>
                                        <Button
                                            variant="default"
                                            class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Pencil size={18} /> {m.edit()}
                                            <ChevronDown size={16} />
                                        </Button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content align="end">
                                        <DropdownMenu.Item
                                            onclick={() =>
                                                goto(`/events/${event.id}`)}
                                        >
                                            <Pencil size={16} class="mr-2" /> {m.edit_instance()}
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onclick={() =>
                                                goto(
                                                    `/events/${event.id}?editSeries=true`,
                                                )}
                                        >
                                            <RefreshCw size={16} class="mr-2" />
                                            {m.edit_series()}
                                        </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Root>

                                <!-- Delete dropdown for series events -->
                                <DropdownMenu.Root>
                                    <DropdownMenu.Trigger>
                                        <Button
                                            variant="outline"
                                            class="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
                                            disabled={deletingSeriesId ===
                                                event.id}
                                        >
                                            {#if deletingSeriesId === event.id}
                                                <RefreshCw
                                                    size={18}
                                                    class="animate-spin"
                                                /> {m.deleting()}
                                            {:else}
                                                <Trash2 size={18} /> {m.delete()}
                                                <ChevronDown size={16} />
                                            {/if}
                                        </Button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content align="end">
                                        <DropdownMenu.Item
                                            onclick={() =>
                                                handleDeleteInstance(event)}
                                        >
                                            <Trash2 size={16} class="mr-2" /> {m.delete_instance()}
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            class="text-red-600"
                                            onclick={() =>
                                                handleDeleteSeries(event)}
                                        >
                                            <Trash2 size={16} class="mr-2" /> {m.delete_series()}
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
                                    <Pencil size={18} /> {m.edit_event()}
                                </Button>
                            {/if}
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
