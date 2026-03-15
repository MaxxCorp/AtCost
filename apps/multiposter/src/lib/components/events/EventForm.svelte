<script lang="ts">
    import { goto } from "$app/navigation";
    import * as m from "$lib/paraglide/messages.js";
    import type { Event } from "../../../routes/events/list.remote";
    import { deleteEvents as deleteEventAction } from "../../../routes/events/[id]/delete.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import SyncCheckboxBlock from "$lib/components/sync/SyncCheckboxBlock.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import type { updateExistingEvent } from "../../../routes/events/[id]/update.remote";
    import type { createNewEvent } from "../../../routes/events/new/create.remote";
    import { listResourcesWithHierarchy } from "../../../routes/resources/list-with-hierarchy.remote";
    import type { ResourceWithHierarchy } from "../../../routes/resources/list-with-hierarchy.remote";
    import { listLocations } from "../../../routes/locations/list.remote";
    import type { Location } from "../../../routes/locations/list.remote";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import LocationForm from "$lib/components/locations/LocationForm.svelte";
    import EntityManager from "$lib/components/ui/EntityManager.svelte";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import type { Contact } from "$lib/validations/contacts";
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
        updateAssociationStatus as updateAssociationStatusRemote,
    } from "../../../routes/contacts/associate.remote";
    import { createNewContact } from "../../../routes/contacts/new/create.remote";
    import { updateExistingContact } from "../../../routes/contacts/[id]/update.remote";
    import {
        createContactSchema,
        updateContactSchema,
    } from "$lib/validations/contacts";
    import { deleteExistingContact } from "../../../routes/contacts/[id]/delete.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import RichTextEditor from "$lib/components/cms/RichTextEditor.svelte";
    import RecurrenceDialog from "$lib/components/events/RecurrenceDialog.svelte";
    import TagInput from "$lib/components/ui/TagInput.svelte";
    import { RRule } from "$lib/utils/rrule-compat";
    import { CalendarClock, User, MapPin, ExternalLink } from "@lucide/svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
    }: {
        remoteFunction: typeof updateExistingEvent | typeof createNewEvent;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: Event | null;
    } = $props();

    const type = "event";

    function parseDateTime(dt: string | null | undefined) {
        if (!dt) return { date: "", time: "" };
        try {
            const d = new Date(dt);
            if (isNaN(d.getTime())) return { date: "", time: "" };
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            const hours = String(d.getHours()).padStart(2, "0");
            const minutes = String(d.getMinutes()).padStart(2, "0");
            return {
                date: `${year}-${month}-${day}`,
                time: `${hours}:${minutes}`,
            };
        } catch {
            return { date: "", time: "" };
        }
    }

    function getLocalNow() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
    }

    function getInitialEndDateTime(startParsed: any, endParsed: any, localNow: any) {
        if (endParsed.date) return { date: endParsed.date, time: endParsed.time || "" };

        const startDate = startParsed.date || localNow.date;
        const startTime = startParsed.time || localNow.time;
        const start = new Date(`${startDate}T${startTime}:00`);
        if (isNaN(start.getTime())) return { date: "", time: "" };

        const end = new Date(start.getTime() + 60 * 60000);
        const year = end.getFullYear();
        const month = String(end.getMonth() + 1).padStart(2, "0");
        const day = String(end.getDate()).padStart(2, "0");
        const hours = String(end.getHours()).padStart(2, "0");
        const minutes = String(end.getMinutes()).padStart(2, "0");

        return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
    }

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const startParsed = parseDateTime(initialData?.startDateTime);
    const endParsed = parseDateTime(initialData?.endDateTime);
    const localNow = getLocalNow();
    const initialEnd = getInitialEndDateTime(startParsed, endParsed, localNow);

    function getField(name: string) {
        if (!(remoteFunction as any).fields) return {};
        const parts = name.split(".");
        let current = (remoteFunction as any).fields;
        for (const part of parts) {
            if (!current) return {};
            current = current[part];
        }
        return current || {};
    }

    // State derived from initialData
    let isAllDay = $state(initialData?.isAllDay ?? false);
    let hasEndTime = $state(initialData ? !!initialData.endDateTime : true);
    let useDefaultReminders = $state(initialData?.reminders?.useDefault ?? true);
    let reminders = $state(initialData?.reminders?.overrides ?? [{ method: "popup", minutes: 10 }]);

    let guestsCanInviteOthers = $state(initialData?.guestsCanInviteOthers ?? false);
    let guestsCanModify = $state(initialData?.guestsCanModify ?? false);
    let guestsCanSeeOtherGuests = $state(initialData?.guestsCanSeeOtherGuests ?? false);
    let isPublic = $state(initialData?.isPublic ?? true);

    // Recurrence State
    let recurrence = $state<string[]>(initialData?.recurrence || []);
    let recurrenceRule = $state<string | null>(recurrence[0] || null);
    let showRecurrenceDialog = $state(false);

    // Tags State
    let tags = $state<string[]>(initialData?.tags || []);
    let tagsString = $state(tags.join(", "));

    // Resource and location state
    let resourcesPromise = listResourcesWithHierarchy();
    let locationsPromise = listLocations();
    let selectedResourceIds = $state<string[]>(initialData?.resourceIds || []);
    let selectedContactIds = $state<string[]>(initialData?.contactIds || []);
    let freeTextLocation = $state(initialData?.location || "");
    let startTimeZoneInput = $state(initialData?.startTimeZone || browserTimezone);
    let endTimeZoneInput = $state(initialData?.endTimeZone || initialData?.startTimeZone || browserTimezone);
    let descriptionValue = $state(getField("description").value() ?? initialData?.description ?? "");
    let startDateInput = $state(startParsed.date || localNow.date);
    let startTimeInput = $state(startParsed.time || localNow.time);
    let endDateInput = $state(initialEnd.date);
    let endTimeInput = $state(initialEnd.time);

    // Helper to format RRule text
    const recurrenceText = $derived(
        recurrenceRule
            ? (() => {
                  try {
                      return RRule.fromString(recurrenceRule).toText();
                  } catch {
                      return m.custom_recurrence();
                  }
              })()
            : m.recurrence(),
    );

    const hiddenRecurrenceRule = $derived(recurrenceRule ?? "");
    const hiddenTagsString = $derived(tagsString ?? "");



    // Helper to find location ID from text (for initial matching)
    async function findInitialLocationId() {
        if (!initialData?.location) return "";
        const locations = await locationsPromise;
        const match = locations.find((l: Location) => {
            const parts = [l.name];
            if (l.roomId) parts.push(l.roomId);
            // Simple check for start of string or full match
            const fullStr = parts.join(", ");
            return initialData.location?.startsWith(fullStr);
        });
        return match ? match.id : "";
    }

    let selectedLocationIds = $state<string[]>(initialData?.locationIds || []);
    $effect(() => {
        if (initialData?.locationIds && initialData.locationIds.length > 0) {
            selectedLocationIds = initialData.locationIds;
            useFreeTextLocation = false;
        } else if (initialData?.location) {
            // Fallback logic for legacy single-string location finding if needed
            findInitialLocationId().then((id) => {
                if (id) {
                    selectedLocationIds = [id];
                    useFreeTextLocation = false;
                }
            });
        }
    });

    const BERLIN_DE_CATEGORIES = [
        "Ausstellungen",
        "Bälle & Galas",
        "Bildung & Vorträge",
        "Festivals",
        "Jazz & Blues",
        "Kabarett & Comedy",
        "Kinderveranstaltungen",
        "Klassische Konzerte",
        "Literatur",
        "Musical",
        "Oper & Tanz",
        "Pop, Rock & HipHop",
        "Schlager & Volksmusik",
        "Show",
        "Sport",
        "Theater",
        "Vermischtes",
    ];

    let useFreeTextLocation = $state(
        !!initialData?.location &&
            (!initialData?.locationIds || initialData.locationIds.length === 0),
    );

    const hiddenDescription = $derived(descriptionValue ?? "");

    // Date/Time handling
    const timezones = Intl.supportedValuesOf
        ? Intl.supportedValuesOf("timeZone")
        : [];

    const remindersJson = $derived(
        JSON.stringify({
            useDefault: useDefaultReminders,
            overrides: reminders,
        }),
    );


    // Sync default end time when start time changes if end time is empty
    function updateEndDateTime() {
        if (!startDateInput || !startTimeInput) return;

        const start = new Date(`${startDateInput}T${startTimeInput}:00`);
        if (isNaN(start.getTime())) return;

        const end = new Date(start.getTime() + 60 * 60000);
        const year = end.getFullYear();
        const month = String(end.getMonth() + 1).padStart(2, "0");
        const day = String(end.getDate()).padStart(2, "0");
        const hours = String(end.getHours()).padStart(2, "0");
        const minutes = String(end.getMinutes()).padStart(2, "0");

        endDateInput = `${year}-${month}-${day}`;
        endTimeInput = `${hours}:${minutes}`;
    }

    // Auto-set end time logic
    function getDefaultEndTime() {
        if (!startDateInput || !startTimeInput) return "";
        const start = new Date(`${startDateInput}T${startTimeInput}:00`);
        const end = new Date(start.getTime() + 60 * 60000);
        return end.toTimeString().slice(0, 5);
    }



    async function toggleResource(resourceId: string) {
        if (selectedResourceIds.includes(resourceId)) {
            selectedResourceIds = selectedResourceIds.filter(
                (id) => id !== resourceId,
            );
        } else {
            selectedResourceIds = [...selectedResourceIds, resourceId];
            // Prefill location if empty
            if (selectedLocationIds.length === 0 && !useFreeTextLocation) {
                const resources = await resourcesPromise;
                const res = resources.find(
                    (r: ResourceWithHierarchy) => r.id === resourceId,
                );
                if (
                    res?.locationId &&
                    !selectedLocationIds.includes(res.locationId)
                ) {
                    selectedLocationIds = [
                        ...selectedLocationIds,
                        res.locationId,
                    ];
                }
            }
        }
    }

    async function onLocationSelect(id: string) {
        selectedLocationIds = [id];
        const locations = await locationsPromise;
        const l = locations.find((x: Location) => x.id === id);
        if (l) {
            const parts = [l.name];
            if (l.roomId) parts.push(l.roomId);
            if (l.street) {
                let s = l.street;
                if (l.houseNumber) s += ` ${l.houseNumber}`;
                if (l.addressSuffix) s += `, ${l.addressSuffix}`;
                parts.push(s);
            }
            if (l.zip || l.city)
                parts.push(`${l.zip ?? ""} ${l.city ?? ""}`.trim());
            if (l.state) parts.push(l.state);
            if (l.country) parts.push(l.country);
            freeTextLocation = parts.filter(Boolean).join(", ");
        } else {
            freeTextLocation = "";
        }
    }

    function addReminder() {
        reminders = [...reminders, { method: "popup", minutes: 10 }];
    }

    function removeReminder(index: number) {
        reminders = reminders.filter((_, i) => i !== index);
    }
</script>

<div class="max-w-3xl mx-auto px-4 py-8 text-left">
    <Breadcrumb
        feature="events"
        current={initialData?.summary ?? m.create_new({ item: m.feature_events_title() })}
    />

    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">
            {isUpdating ? m.edit_item({ item: m.feature_events_title() }) : m.create_new({ item: m.feature_events_title() })}
        </h1>
        {#if isUpdating && initialData}
            <AsyncButton
                type="button"
                variant="destructive"
                loading={deleteEventAction.pending}
                onclick={async () => {
                    await handleDelete({
                        ids: [initialData.id],
                        deleteFn: deleteEventAction,
                        itemName: m.event_label(),
                    });
                    goto("/events");
                }}
            >
                {m.delete()}
            </AsyncButton>
        {/if}
    </div>

    <form
        {...remoteFunction
            .preflight(validationSchema)
            .enhance(async ({ submit }: any) => {
                console.log("--- EventForm submission started ---");
                try {
                    const result: any = await submit();
                    console.log(
                        "--- EventForm submission result ---",
                        JSON.stringify(result, null, 2),
                    );
                    if (result?.error) {
                        toast.error(
                            result.error.message ||
                                m.something_went_wrong(),
                        );
                        return;
                    }
                    toast.success(m.successfully_saved());
                    goto("/events");
                } catch (error: any) {
                    console.error("--- EventForm submission catch ---", error);
                    toast.error(
                        error?.message || m.something_went_wrong(),
                    );
                }
            })}
        class="space-y-6"
    >
        <datalist id="timezones">
            {#each timezones as tz}
                <option value={tz}></option>
            {/each}
        </datalist>

        {#if isUpdating && initialData}
            <input {...getField("id").as("hidden", initialData.id)} />
        {/if}
        <input {...getField("remindersJson").as("hidden", remindersJson)} />
        <input {...getField("isAllDay").as("hidden", isAllDay.toString())} />
        <input {...getField("isPublic").as("hidden", isPublic.toString())} />
        <input
            {...getField("guestsCanInviteOthers").as(
                "hidden",
                guestsCanInviteOthers.toString(),
            )}
        />
        <input
            {...getField("guestsCanModify").as(
                "hidden",
                guestsCanModify.toString(),
            )}
        />
        <input
            {...getField("guestsCanSeeOtherGuests").as(
                "hidden",
                guestsCanSeeOtherGuests.toString(),
            )}
        />

        <!-- Recurrence Hidden Input -->
        {#if recurrenceRule}
            <input
                {...getField("recurrence").as("hidden", hiddenRecurrenceRule)}
            />
        {/if}

        <!-- Tags Hidden Input -->
        {#if hiddenTagsString}
            <input {...getField("tags").as("hidden", hiddenTagsString)} />
        {/if}

        <div class="bg-white shadow rounded-lg p-6 space-y-4">
            <h2 class="text-xl font-semibold mb-4 border-b pb-2">
                {m.basic_information()}
            </h2>

            <div>
                <label
                    for="summary"
                    class="block text-sm font-medium text-gray-700 mb-1"
                >
                    {m.title()} <span class="text-red-500">*</span>
                </label>
                <input
                    {...getField("summary").as("text")}
                    required
                    value={getField("summary").value() ??
                        initialData?.summary ??
                        ""}
                    class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 {(getField(
                        'summary',
                    ).issues()?.length ?? 0) > 0
                        ? 'border-red-500'
                        : 'border-gray-300'}"
                    placeholder={m.title()}
                    onblur={() => remoteFunction.validate()}
                />
                {#each getField("summary").issues() ?? [] as issue}
                    <p class="mt-1 text-sm text-red-600">{issue.message}</p>
                {/each}
            </div>

            <div>
                <label
                    for="description"
                    class="block text-sm font-medium text-gray-700 mb-1"
                    >{m.description()}</label
                >
                <div class="prose max-w-none">
                    <RichTextEditor bind:value={descriptionValue} />
                    {#if hiddenDescription}
                        <input
                            {...getField("description").as(
                                "hidden",
                                hiddenDescription,
                            )}
                        />
                    {/if}
                </div>
            </div>

            <div>
                <TagInput
                    bind:value={tagsString}
                    label={m.tags()}
                    placeholder={m.tags_placeholder_events()}
                />
            </div>

            <div>
                <span class="block text-sm font-medium text-gray-700 mb-2"
                    >{m.feature_resources_title()} ({m.optional()})</span
                >
                {#await resourcesPromise}
                    <p class="text-sm text-gray-500">{m.loading_item({ item: m.feature_resources_title().toLowerCase() })}</p>
                {:then resources}
                    <div
                        class="space-y-1 border rounded-md p-4 max-h-64 overflow-y-auto bg-gray-50"
                    >
                        {#each resources as resource}
                            <label
                                class="flex items-center gap-2 py-1 px-2 hover:bg-white rounded transition-colors"
                                style="padding-left: {resource.level * 24 +
                                    8}px"
                            >
                                <input
                                    {...getField("resourceIds").as(
                                        "checkbox",
                                        resource.id,
                                    )}
                                    name={undefined}
                                    class="w-4 h-4 text-blue-600 flex-shrink-0"
                                    checked={selectedResourceIds.includes(
                                        resource.id,
                                    )}
                                    onclick={() => toggleResource(resource.id)}
                                />
                                <span
                                    class="text-sm {resource.level === 0
                                        ? 'font-semibold'
                                        : 'text-gray-600'}"
                                    >{resource.name}</span
                                >
                                <span class="text-xs text-gray-500"
                                    >({resource.type === "room" ? m.room_type_suffix() : m.equipment_type_suffix()})</span
                                >
                            </label>
                        {/each}
                    </div>
                {/await}
                <input
                    {...getField("resourceIds").as(
                        "hidden",
                        JSON.stringify(selectedResourceIds),
                    )}
                />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label
                        for="categoryBerlinDotDe"
                        class="block text-sm font-medium text-gray-700 mb-1"
                    >
                        {m.berlin_de_category()}
                    </label>
                    <select
                        {...getField("categoryBerlinDotDe").as("text")}
                        value={getField("categoryBerlinDotDe").value() ??
                            initialData?.categoryBerlinDotDe ??
                            ""}
                        class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    >
                        <option value="">{m.select_category()}</option>
                        {#each BERLIN_DE_CATEGORIES as cat}
                            <option value={cat}>{cat}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <label
                        for="ticketPrice"
                        class="block text-sm font-medium text-gray-700 mb-1"
                    >
                        {m.ticket_price()}
                    </label>
                    <input
                        {...getField("ticketPrice").as("text")}
                        value={getField("ticketPrice").value() ??
                            initialData?.ticketPrice ??
                            ""}
                        class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                        placeholder={m.ticket_price_placeholder()}
                    />
                </div>
            </div>

            <div>
                <span class="block text-sm font-medium text-gray-700 mb-2"
                    >{m.location()}</span
                >
                <div class="flex items-center gap-2 mb-2">
                    <input
                        id="useFreeTextLocation"
                        type="checkbox"
                        checked={useFreeTextLocation}
                        onclick={() =>
                            (useFreeTextLocation = !useFreeTextLocation)}
                        class="w-4 h-4 text-blue-600"
                    />
                    <label
                        for="useFreeTextLocation"
                        class="text-sm text-gray-700"
                        >{m.use_custom_location()}</label
                    >
                </div>
                {#if useFreeTextLocation}
                    <input
                        {...getField("location").as("text")}
                        value={freeTextLocation}
                        oninput={(e) =>
                            (freeTextLocation = e.currentTarget.value)}
                        class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                        placeholder={m.enter_custom_location()}
                        onblur={() => remoteFunction.validate()}
                    />
                {:else}
                    {#await locationsPromise}
                        <p class="text-sm text-gray-500">
                            {m.loading_item({ item: m.feature_locations_title().toLowerCase() })}
                        </p>
                    {:then locations}
                        <!-- Using Multi-Location Selector -->
                        <EntityManager
                            title={m.feature_locations_title()}
                            icon={MapPin}
                            {type}
                            entityId={initialData?.id}
                            initialItems={locations.filter((l: any) =>
                                selectedLocationIds.includes(l.id),
                            )}
                            onchange={(ids: string[]) =>
                                (selectedLocationIds = ids)}
                            embedded={true}
                            listItemsRemote={listLocations as any}
                            deleteItemRemote={async (id: string) => {
                                return await handleDelete({
                                    ids: [id],
                                    deleteFn: deleteLocation,
                                    itemName: m.location_label().toLowerCase(),
                                });
                            }}
                            createRemote={createLocation}
                            createSchema={createLocationSchema}
                            updateRemote={updateLocation}
                            updateSchema={updateLocationSchema}
                            getFormData={(l: Location) => l}
                            searchPredicate={(l: Location, q: string) => {
                                return (
                                    l.name
                                        .toLowerCase()
                                        .includes(q.toLowerCase()) ||
                                    (l.roomId
                                        ?.toLowerCase()
                                        .includes(q.toLowerCase()) ??
                                        false)
                                );
                            }}
                        >
                            {#snippet renderItemLabel(location)}
                                {location.name}
                                {location.roomId ? `(${location.roomId})` : ""}
                            {/snippet}

                            {#snippet renderForm({
                                remoteFunction: rf,
                                schema,
                                id,
                                initialData: formData,
                                onSuccess,
                                onCancel,
                            })}
                                <LocationForm
                                    remoteFunction={rf}
                                    validationSchema={schema}
                                    isUpdating={!!id}
                                    initialData={formData}
                                    {onSuccess}
                                    {onCancel}
                                />
                            {/snippet}
                        </EntityManager>
                        <!-- Populate freeTextLocation based on selection if needed, or leave independent -->
                    {/await}
                {/if}
                <input
                    {...getField("locationIds").as(
                        "hidden",
                        JSON.stringify(
                            useFreeTextLocation
                                ? []
                                : (selectedLocationIds ?? []),
                        ),
                    )}
                />
            </div>
        </div>

        <div class="bg-white shadow rounded-lg p-6 space-y-4">
            <h2 class="text-xl font-semibold mb-4 border-b pb-2">
                {m.date_and_time()}
            </h2>

            <div class="flex items-center gap-2">
                <input
                    id="isAllDay"
                    type="checkbox"
                    checked={isAllDay}
                    onclick={() => (isAllDay = !isAllDay)}
                    class="w-4 h-4 text-blue-600"
                />
                <label for="isAllDay" class="text-sm font-medium text-gray-700"
                    >{m.all_day()} {m.event_label()}</label
                >
            </div>

            <div class="grid grid-cols-1 gap-6">
                <!-- Start Block -->
                <div class="space-y-4">
                    <div>
                        <label
                            for="startDateInput"
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >{m.start_date()} <span class="text-red-500">*</span
                            ></label
                        >
                        <input
                            name="startDate"
                            type="date"
                            required
                            bind:value={startDateInput}
                            onchange={updateEndDateTime}
                            class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                        />
                    </div>
                    {#if !isAllDay}
                        <div>
                            <label
                                for="startTimeInput"
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >{m.start_time()} <span class="text-red-500">*</span
                                ></label
                            >
                            <input
                                name="startTime"
                                type="time"
                                required
                                bind:value={startTimeInput}
                                onchange={updateEndDateTime}
                                class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                            />
                        </div>
                    {/if}
                    <div>
                        <label
                            for="startTimeZoneInput"
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >{m.timezone()}</label
                        >
                        <input
                            name="startTimeZone"
                            list="timezones"
                            bind:value={startTimeZoneInput}
                            placeholder={browserTimezone}
                            class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                        />
                    </div>
                </div>

                <!-- End Block -->
                <div class="space-y-4">
                    <div class="flex items-center gap-2 h-6 md:mb-1">
                        <input
                            id="hasEndTime"
                            type="checkbox"
                            checked={hasEndTime}
                            onclick={() => (hasEndTime = !hasEndTime)}
                            class="w-4 h-4 text-blue-600"
                        />
                        <label
                            for="hasEndTime"
                            class="text-sm font-medium text-gray-700"
                            >{m.add_item({ item: m.end_time() })}</label
                        >
                    </div>

                    {#if hasEndTime}
                        <div>
                            <label
                                for="endDateInput"
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >{m.end_date()}</label
                            >
                            <input
                                name="endDate"
                                type="date"
                                bind:value={endDateInput}
                                placeholder={startDateInput}
                                class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                            />
                        </div>
                        {#if !isAllDay}
                            <div>
                                <label
                                    for="endTimeInput"
                                    class="block text-sm font-medium text-gray-700 mb-1"
                                    >{m.end_time()}</label
                                >
                                <input
                                    name="endTime"
                                    type="time"
                                    bind:value={endTimeInput}
                                    placeholder={getDefaultEndTime()}
                                    class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                                />
                            </div>
                        {/if}
                        <div>
                            <label
                                for="endTimeZoneInput"
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >{m.end_time()} {m.timezone()}</label
                            >
                            <input
                                name="endTimeZone"
                                list="timezones"
                                bind:value={endTimeZoneInput}
                                placeholder={startTimeZoneInput}
                                class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                            />
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Recurrence Button -->
            <div class="pt-4 border-t">
                <button
                    type="button"
                    class="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                    onclick={() => (showRecurrenceDialog = true)}
                >
                    <CalendarClock size={16} />
                    <span>{recurrenceText}</span>
                </button>
            </div>
        </div>

        <RecurrenceDialog
            bind:open={showRecurrenceDialog}
            bind:value={recurrenceRule}
        />

        <div class="bg-white shadow rounded-lg p-6 space-y-4">
            <h2 class="text-xl font-semibold mb-4 border-b pb-2">
                {m.guest_options()}
            </h2>

            <div class="space-y-3">
                <label class="flex items-center gap-2">
                    <input
                        type="checkbox"
                        bind:checked={guestsCanInviteOthers}
                        class="w-4 h-4 text-blue-600"
                    />
                    <span class="text-sm text-gray-700"
                        >{m.guests_invite()}</span
                    >
                </label>
                <label class="flex items-center gap-2">
                    <input
                        type="checkbox"
                        bind:checked={guestsCanModify}
                        class="w-4 h-4 text-blue-600"
                    />
                    <span class="text-sm text-gray-700"
                        >{m.guests_modify()}</span
                    >
                </label>
                <label class="flex items-center gap-2">
                    <input
                        type="checkbox"
                        bind:checked={guestsCanSeeOtherGuests}
                        class="w-4 h-4 text-blue-600"
                    />
                    <span class="text-sm text-gray-700"
                        >{m.guests_see_others()}</span
                    >
                </label>
                <label class="flex items-center gap-2">
                    <input
                        type="checkbox"
                        bind:checked={isPublic}
                        class="w-4 h-4 text-blue-600"
                    />
                    <span class="text-sm text-gray-700"
                        >{m.public()} {m.event_label()}</span
                    >
                </label>
            </div>

            <div class="mt-6">
                <h3 class="text-sm font-medium text-gray-700 mb-2">
                    {m.reminders()}
                </h3>
                <label class="flex items-center gap-2 mb-4">
                    <input
                        type="checkbox"
                        bind:checked={useDefaultReminders}
                        class="w-4 h-4 text-blue-600"
                    />
                    <span class="text-sm text-gray-700"
                        >{m.use_default_reminders()}</span
                    >
                </label>

                <input
                    {...getField("reminders.useDefault").as(
                        "hidden",
                        useDefaultReminders?.toString() ?? "true",
                    )}
                />

                {#if !useDefaultReminders}
                    <div class="space-y-3">
                        {#each reminders as reminder, i}
                            <div class="flex gap-2 items-center">
                                <div class="flex-1">
                                    <select
                                        bind:value={reminder.method}
                                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="popup"
                                            >{m.notification()}</option
                                        >
                                        <option value="email">{m.email()}</option>
                                    </select>
                                </div>
                                <div class="flex-1">
                                    <input
                                        type="number"
                                        bind:value={reminder.minutes}
                                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                        min="0"
                                    />
                                </div>
                                <button
                                    type="button"
                                    class="p-2 text-red-600 hover:bg-red-50 rounded-md"
                                    onclick={() => {
                                        reminders = reminders.filter(
                                            (_, idx) => idx !== i,
                                        );
                                    }}
                                >
                                    &times;
                                </button>
                            </div>
                        {/each}
                        <button
                            type="button"
                            class="text-sm text-blue-600 hover:text-blue-800"
                            onclick={() => {
                                reminders = [
                                    ...reminders,
                                    { method: "popup", minutes: 10 },
                                ];
                            }}
                        >
                            + {m.add_item({ item: m.reminder_label() })}
                        </button>
                    </div>
                {/if}
            </div>
        </div>

        <EntityManager
            title={m.feature_contacts_title()}
            icon={User}
            type="event"
            entityId={initialData?.id}
            onchange={(ids: string[]) => (selectedContactIds = ids)}
            embedded={true}
            listItemsRemote={listContacts as any}
            fetchAssociationsRemote={fetchEntityContacts as any}
            addAssociationRemote={async (p: any) =>
                addAssociation({ ...p, contactId: p.itemId } as any)}
            removeAssociationRemote={async (p: any) =>
                removeAssociation({ ...p, contactId: p.itemId } as any)}
            deleteItemRemote={async (id: string) => {
                return await handleDelete({
                    ids: [id],
                    deleteFn: deleteExistingContact,
                    itemName: m.contact_label().toLowerCase(),
                });
            }}
            createRemote={createNewContact}
            createSchema={createContactSchema}
            updateRemote={updateExistingContact}
            updateSchema={updateContactSchema}
            getFormData={(c: Contact) => ({
                contact: c,
                emails: c.emails,
                phones: c.phones,
                addresses: c.addresses,
                relations: c.relations,
                tags: c.tags,
                locationAssociations: c.locationAssociations,
            })}
            searchPredicate={(c: Contact, q: string) => {
                const name = (
                    c.displayName ||
                    `${c.givenName || ""} ${c.familyName || ""}`
                ).toLowerCase();
                return name.includes(q.toLowerCase());
            }}
        >
            {#snippet renderItemLabel(contact)}
                {contact.displayName ||
                    `${contact.givenName || ""} ${contact.familyName || ""}`}
            {/snippet}

            {#snippet participationSnippet(contact)}
                <select
                    value={contact.participationStatus || "needsAction"}
                    onchange={(e) => {
                        const newStatus = e.currentTarget.value;
                        if (initialData?.id) {
                            updateAssociationStatusRemote({
                                type: "event",
                                entityId: initialData.id,
                                contactId: contact.id,
                                status: newStatus,
                            } as any).catch((err: any) =>
                                toast.error(
                                    err.message || m.failed_to_update_status(),
                                ),
                            );
                        }
                        contact.participationStatus = newStatus;
                    }}
                    class="text-xs bg-transparent border-0 focus:ring-0 cursor-pointer text-gray-500 hover:text-blue-600 font-medium"
                >
                    <option value="needsAction">{m.needs_action()}</option>
                    <option value="accepted">{m.accepted()}</option>
                    <option value="declined">{m.declined()}</option>
                    <option value="tentative">{m.tentative()}</option>
                </select>
            {/snippet}

            {#snippet renderForm({
                remoteFunction: rf,
                schema,
                initialData: formData,
                onSuccess,
                onCancel,
                id,
            })}
                <ContactForm
                    remoteFunction={rf}
                    {schema}
                    initialData={formData}
                    {onSuccess}
                    {onCancel}
                    contactId={id}
                >
                    {#snippet children({ onLocationsChange })}
                        <div class="mt-8 border-t pt-8">
                            <EntityManager
                                title={m.feature_locations_title()}
                                icon={MapPin}
                                type="location"
                                entityId={id}
                                initialItems={(
                                    formData.locationAssociations || []
                                ).map((la: any) => la.location)}
                                embedded={true}
                                onchange={onLocationsChange}
                                listItemsRemote={listLocations as any}
                                addAssociationRemote={async (p: any) => {
                                    return await addAssociation({
                                        type: "location",
                                        entityId: p.itemId,
                                        contactId: p.entityId,
                                    });
                                }}
                                removeAssociationRemote={async (p: any) => {
                                    return await removeAssociation({
                                        type: "location",
                                        entityId: p.itemId,
                                        contactId: p.entityId,
                                    });
                                }}
                                deleteItemRemote={async (ids) => {
                                    return await handleDelete({
                                        ids: Array.isArray(ids)
                                            ? ids
                                            : [ids],
                                        deleteFn: deleteLocation,
                                        itemName: m
                                            .location()
                                            .toLowerCase(),
                                    });
                                }}
                                createRemote={createLocation}
                                createSchema={createLocationSchema}
                                updateRemote={updateLocation}
                                updateSchema={updateLocationSchema}
                                getFormData={(l: any) => l}
                                searchPredicate={(l: any, q: string) => {
                                    return (
                                        l.name
                                            .toLowerCase()
                                            .includes(q.toLowerCase()) ||
                                        (l.roomId
                                            ?.toLowerCase()
                                            .includes(
                                                q.toLowerCase(),
                                            ) ??
                                            false)
                                    );
                                }}
                            >
                                {#snippet renderItemLabel(location)}
                                    {location.name}
                                    {location.roomId
                                        ? `(${location.roomId})`
                                        : ""}
                                {/snippet}
                                {#snippet renderForm({
                                    remoteFunction: rf,
                                    schema,
                                    id,
                                    initialData: formData,
                                    onSuccess,
                                    onCancel,
                                })}
                                    <LocationForm
                                        remoteFunction={rf}
                                        validationSchema={schema}
                                        isUpdating={!!id}
                                        initialData={formData}
                                        {onSuccess}
                                        {onCancel}
                                    />
                                {/snippet}
                            </EntityManager>
                        </div>
                    {/snippet}
                </ContactForm>
            {/snippet}
        </EntityManager>
        <input
            {...getField("contactIds").as(
                "hidden",
                JSON.stringify(selectedContactIds ?? []),
            )}
        />

        <SyncCheckboxBlock 
            syncFieldConfig={getField("syncIds")}
            initialSelectedIds={initialData?.syncIds || []} 
        />

        <div class="flex gap-3 pt-4">
            <AsyncButton
                type="submit"
                loadingLabel={m.saving()}
                loading={remoteFunction.pending}
                class="px-8"
            >
                {isUpdating ? m.save_changes() : m.create_item({ item: m.feature_events_title() })}
            </AsyncButton>
            <Button variant="secondary" href="/events" size="default">
                {m.cancel()}
            </Button>
        </div>
    </form>
</div>
