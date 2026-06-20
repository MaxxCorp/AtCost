<script lang="ts">
	import { LoadingSection, ErrorSection } from "@ac/ui";
    import * as m from "$lib/paraglide/messages";
    import { type Event, type Tag } from "@ac/validations";

    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import SyncCheckboxBlock from "$lib/components/sync/SyncCheckboxBlock.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { handleDelete, EntityManager, LocationForm, translateIssue } from "@ac/ui";
    import { listResourcesWithHierarchy } from "../../../routes/resources/list-with-hierarchy.remote";
    import type { ResourceWithHierarchy } from "../../../routes/resources/list-with-hierarchy.remote";
    import ResourceForm from "$lib/components/resources/ResourceForm.svelte";
    import { createResource } from "../../../routes/resources/new/create.remote";
    import { updateResource } from "../../../routes/resources/[id]/update.remote";
    import { deleteResource as deleteResourceRemote } from "../../../routes/resources/[id]/delete.remote";
    import { listResources } from "../../../routes/resources/list.remote";
    import { createResourceSchema, updateResourceSchema } from "$lib/validations/resources";
    import { listLocations } from "../../../routes/locations/list.remote";
    import { type Location } from "@ac/validations";

    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import { onMount, type Snippet, untrack } from "svelte";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { type Contact } from "@ac/validations";
        
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
        updateAssociationStatus as updateAssociationStatusRemote,
    } from "../../../routes/contacts/associate.remote";
    import { createContact } from "../../../routes/contacts/new/create.remote";
    import { updateContact } from "../../../routes/contacts/[id]/update.remote";
    import { createContactSchema, updateContactSchema } from "@ac/validations";
    import { deleteContact } from "../../../routes/contacts/[id]/delete.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import {
        addLocationAssociation,
        removeLocationAssociation,
        fetchEntityLocations,
    } from "../../../routes/locations/associate.remote";
    import {
        addResourceAssociation,
        removeResourceAssociation,
        fetchEntityResources,
    } from "../../../routes/resources/associate.remote";
    import RichTextEditor from "$lib/components/cms/RichTextEditor.svelte";
    import ImageUploader from "$lib/components/cms/ImageUploader.svelte";
    import RecurrenceDialog from "$lib/components/events/RecurrenceDialog.svelte";
    import { formatRecurrenceText } from "$lib/utils/format-recurrence";
    import {
        RefreshCw,
        CalendarClock,
        User,
        MapPin,
        Tag as TagIcon,
        Database,
    } from "@lucide/svelte";
    import { listTags as listTagsRemote } from "../../../routes/tags/list.remote";
    import { createTag as createTagRemote } from "../../../routes/tags/new/create.remote";
    import { updateTag as updateTagRemote } from "../../../routes/tags/[id]/update.remote";
    import { deleteTag as deleteTagRemote } from "../../../routes/tags/[id]/delete.remote";
    import * as v from "valibot";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: Event | null;
    } = $props();

    // svelte-ignore state_referenced_locally
    const rf = (remoteFunction as any).preflight(validationSchema);
    const type = "event";
    const BERLIN_DE_CATEGORIES = [
        "Ausstellung",
        "Berliner Bühnen",
        "Bildung",
        "Feste",
        "Freizeit",
        "Kinder",
        "Kino",
        "Klassik",
        "Konzerte",
        "Literatur",
        "Messen",
        "Party",
        "Rund ums Haus",
        "Sport",
        "Sonstiges",
    ];

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

    function getInitialEndDateTime(
        startParsed: any,
        endParsed: any,
        localNow: any,
    ) {
        if (endParsed.date)
            return { date: endParsed.date, time: endParsed.time || "" };

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

    const startParsed = $derived(parseDateTime(initialData?.startDateTime));
    const endParsed = $derived(parseDateTime(initialData?.endDateTime));
    const localNow = getLocalNow();
    const initialEnd = $derived(
        getInitialEndDateTime(startParsed, endParsed, localNow),
    );

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (rf as any).allIssues?.() ?? [];
        untrack(() => {
            if (issues.length > 0 && prevIssuesLength === 0) {
                toast.error(m.please_fix_validation());
            }
            prevIssuesLength = issues.length;
        });
    });

    let showRecurrenceDialog = $state(false);

    // Date/Time handling
    const timezones = Intl.supportedValuesOf
        ? Intl.supportedValuesOf("timeZone")
        : [];

    function updateEndDateTime(rf: any) {
        const startDate = rf.fields.startDate.value();
        const startTime = rf.fields.startTime.value();
        if (!startDate || !startTime) return;

        const start = new Date(`${startDate}T${startTime}:00`);
        if (isNaN(start.getTime())) return;

        const end = new Date(start.getTime() + 60 * 60000);
        rf.fields.endDate.set(end.toISOString().split("T")[0]);
        rf.fields.endTime.set(end.toTimeString().slice(0, 5));
    }

    function getDefaultEndTime(rf: any) {
        const startDate = rf.fields.startDate.value();
        const startTime = rf.fields.startTime.value();
        if (!startDate || !startTime) return "";
        const start = new Date(`${startDate}T${startTime}:00`);
        const end = new Date(start.getTime() + 60 * 60000);
        return end.toTimeString().slice(0, 5);
    }

    function addReminder(rf: any) {
        const currentReminders =
            rf.fields.reminders.overrides.value() ?? [];
        rf.fields.reminders.overrides.set([
            ...currentReminders,
            { method: "popup", minutes: 10 },
        ]);
    }

    function removeReminder(rf: any, index: number) {
        const currentReminders =
            rf.fields.reminders.overrides.value() ?? [];
        rf.fields.reminders.overrides.set(
            currentReminders.filter((_: any, i: number) => i !== index),
        );
    }

    let recurrenceText = $derived(
        rf.fields.recurrence.value()
            ? formatRecurrenceText(rf.fields.recurrence.value() as string)
            : m.recurrence(),
    );

    let isAllDay = $derived(
        rf.fields.isAllDay.value() !== undefined
            ? (rf.fields.isAllDay.value() === true ||
               rf.fields.isAllDay.value() === "true" ||
               rf.fields.isAllDay.value() === "on")
            : (initialData?.isAllDay ?? false),
    );
    let hasEndTime = $derived(
        rf.fields.hasEndTime.value() !== undefined
            ? (rf.fields.hasEndTime.value() === true ||
               rf.fields.hasEndTime.value() === "true" ||
               rf.fields.hasEndTime.value() === "on")
            : (initialData ? !!initialData.endDateTime : true),
    );
    let useDefaultReminders = $derived(
        rf.fields.reminders.useDefault.value() !== undefined
            ? (rf.fields.reminders.useDefault.value() === true ||
               rf.fields.reminders.useDefault.value() === "true" ||
               rf.fields.reminders.useDefault.value() === "on")
            : ((initialData?.reminders as any)?.useDefault ?? true),
    );
    let reminders = $derived(
        rf.fields.reminders.overrides.value() ?? [],
    );
</script>

<datalist id="timezones">
    {#each timezones as tz}
        <option value={tz}></option>
    {/each}
</datalist>

{#if initialData?.id}
    <input {...rf.fields.id.as("text", initialData.id)} class="hidden" />
{/if}

<input
    {...rf.fields.tags.as(
        "text",
        (initialData?.tags ?? []).map((t) => t.name).join(", "),
    )}
    class="hidden"
/>

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
            {...rf.fields.summary.as("text", initialData?.summary ?? "")}
            required
            class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 {(rf.fields.summary.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            placeholder={m.title()}
            onblur={() => rf.validate()}
        />
        {#each rf.fields.summary.issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </div>

    <div>
        <label
            for="status"
            class="block text-sm font-medium text-gray-700 mb-1"
        >
            {m.status()}
        </label>
        <select
            {...rf.fields.status.as("text", initialData?.status ?? "confirmed")}
            class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
        >
            <option value="confirmed">{m.confirmed()}</option>
            <option value="tentative">{m.tentative()}</option>
            <option value="cancelled">{m.cancelled()}</option>
        </select>
    </div>

    <div>
        <ImageUploader
            value={rf.fields.heroImage.value() ?? initialData?.heroImage ?? ""}
            onchange={(val) => rf.fields.heroImage.set(val)}
            label={m.hero_image()}
        />
        {#if (rf.fields.heroImage.value() ?? initialData?.heroImage) !== undefined && (rf.fields.heroImage.value() ?? initialData?.heroImage) !== null}
            <input
                {...rf.fields.heroImage.as("text", initialData?.heroImage ?? "")}
                class="hidden"
            />
        {/if}
    </div>

    <div>
        <label
            for="description"
            class="block text-sm font-medium text-gray-700 mb-1"
            >{m.description()}</label
        >
        <div class="prose max-w-none">
            <RichTextEditor 
                value={rf.fields.description.value() ?? initialData?.description ?? ""} 
                onchange={(v) => rf.fields.description.set(v)}
            />
            {#if (rf.fields.description.value() ?? initialData?.description) !== undefined && (rf.fields.description.value() ?? initialData?.description) !== null}
                <input
                    {...rf.fields.description.as("text", initialData?.description ?? "")}
                    class="hidden"
                />
            {/if}
        </div>
    </div>

    <div>
        <h3
            class="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2"
        >
            <TagIcon size={16} class="text-indigo-500" />
            {m.tags()}
        </h3>
        {#key initialData?.id || "new"}
            <EntityManager
            title={m.tags()}
            icon={TagIcon}
            mode="embedded"
            initialItems={initialData?.tags || []}
            listItemsRemote={listTagsRemote}
            onchange={(ids: any, items: any[]) => {
                rf.fields.tags.set(items.map((i: any) => i.name).join(", "));
            }}
            createRemote={createTagRemote}
            createSchema={v.object({
                name: v.pipe(v.string(), v.minLength(1)),
            })}
            updateRemote={updateTagRemote}
            updateSchema={v.object({
                name: v.pipe(v.string(), v.minLength(1)),
            })}
            deleteItemRemote={async (ids: string[]) => {
                return await handleDelete({
                    ids,
                    deleteFn: deleteTagRemote,
                    itemName: m.tags(),
                });
            }}
            getFormData={(t: any) => t}
            searchPredicate={(t: any, q: string) =>
                t.name.toLowerCase().includes(q.toLowerCase())}
            loadingLabel={m.loading_item({ item: m.tags() })}
            noItemsLabel={m.no_items_associated_label({ item: m.tags() })}
            noItemsFoundLabel={m.no_items_found({ item: m.tags() })}
            searchPlaceholder={m.search_placeholder({ item: m.tags() })}
            linkItemLabel={m.link_item_label({ item: m.tags() })}
            associatedItemLabel={m.associated_item_label({
                item: m.tags(),
            })}
            quickCreateLabel={m.quick_create()}
            closeSearchLabel={m.close_search()}
            editLabel={m.edit()}
            deleteLabel={m.delete()}
            unlinkLabel={m.unlink()}
            selectAllLabel={m.select_all()}
            deselectAllLabel={m.deselect_all()}
        >
            {#snippet renderItemLabel(tag: any)}
                {tag.name}
            {/snippet}
            {#snippet renderForm({
                remoteFunction: rfState,
                schema,
                initialData: formData,
                onSuccess,
                onCancel,
                id,
            }: any)}
                <form
                    {...rfState
                        .preflight(schema)
                        .enhance(async ({ submit }: { submit: any }) => {
                            try {
                                const res = await submit();
                                if (res && res.success !== false) {
                                    onSuccess(res);
                                }
                            } catch (err) {
                                console.error(
                                    "[EventForm] Quick Create Error:",
                                    err,
                                );
                            }
                        })}
                    class="space-y-4 p-4"
                >
                    {#if id && rfState.fields?.id}
                        <input
                            {...rfState.fields.id.as("text", id)}
                            class="hidden"
                        />
                    {/if}
                    <div>
                        <label
                            for="tag-name"
                            class="block text-sm font-medium text-gray-700"
                            >{m.summary()}</label
                        >
                        <input
                            {...rfState.fields.name.as("text")}
                            id="name"
                            type="text"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            value={formData?.name ?? ""}
                        />
                        <div class="px-2">
                            {#each (rf.fields.name.issues() ?? []) as issue}
                                <p class="text-sm text-red-600">
                                    {translateIssue(issue.message, m)}
                                </p>
                            {/each}
                        </div>
                    </div>
                    <div class="flex justify-end gap-2 pt-4 border-t">
                        <Button
                            variant="outline"
                            type="button"
                            onclick={onCancel}>{m.cancel()}</Button
                        >
                        <AsyncButton type="submit" loading={rfState.pending}>
                            {id
                                ? m.save_changes()
                                : m.create_item({ item: "Tag" })}
                        </AsyncButton>
                    </div>
                </form>
            {/snippet}
        </EntityManager>
        {/key}
    </div>

    <div>
        <span class="block text-sm font-medium text-gray-700 mb-2"
            >{m.feature_resources_title()} ({m.optional()})</span
        >
        {#key initialData?.id || "new"}
            <EntityManager
                title={m.feature_resources_title()}
                icon={Database}
                mode="embedded"
                type="event"
                entityId={initialData?.id}
                listItemsRemote={listResourcesWithHierarchy as any}
                fetchAssociationsRemote={fetchEntityResources as any}
                addAssociationRemote={async (p: any) =>
                    addResourceAssociation({ ...p, resourceId: p.itemId } as any)}
                removeAssociationRemote={async (p: any) =>
                    removeResourceAssociation({ ...p, resourceId: p.itemId } as any)}
                onchange={(ids: string[]) =>
                    rf.fields.resourceIds.set(JSON.stringify(ids))}
                deleteItemRemote={async (ids: string[]) => {
                    return await handleDelete({
                        ids,
                        deleteFn: deleteResourceRemote,
                        itemName: m.feature_resources_title().toLowerCase(),
                    });
                }}
                createRemote={createResource}
                createSchema={createResourceSchema}
                updateRemote={updateResource}
                updateSchema={updateResourceSchema}
                getFormData={(r: any) => r}
                searchPredicate={(r: any, q: string) =>
                    r.name.toLowerCase().includes(q.toLowerCase())}
                loadingLabel={m.loading_item({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                noItemsLabel={m.no_items_associated_label({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                searchPlaceholder={m.search_placeholder({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                linkItemLabel={m.link_item_label({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                associatedItemLabel={m.associated_item_label({
                    item: m.feature_resources_title().toLowerCase(),
                })}
                quickCreateLabel={m.quick_create()}
                closeSearchLabel={m.close_search()}
                editLabel={m.edit()}
                deleteLabel={m.delete()}
                unlinkLabel={m.unlink()}
                selectAllLabel={m.select_all()}
                deselectAllLabel={m.deselect_all()}
            >
                {#snippet renderItemLabel(resource: any)}
                    <span style="padding-left: {resource.level * 12}px">
                        {resource.name}
                        <span class="text-xs text-gray-500 font-normal ml-2">
                            ({resource.type === "room"
                                ? m.room_type_suffix()
                                : m.equipment_type_suffix()})
                        </span>
                    </span>
                {/snippet}
                {#snippet renderForm({
                    remoteFunction: rfForm,
                    schema,
                    id,
                    initialData: formData,
                    onSuccess,
                    onCancel,
                }: any)}
                    {#await Promise.all([listLocations(), listResources()])}
                        <div class="p-4 flex justify-center">
                            <LoadingSection />
                        </div>
                    {:then [locs, ress]}
                        <div class="p-4">
                            <ResourceForm
                                remoteFunction={rfForm}
                                validationSchema={schema}
                                isUpdating={!!id}
                                initialData={formData}
                                {onSuccess}
                                {onCancel}
                                locations={locs.data}
                                allResources={ress.data}
                            />
                        </div>
                    {:catch error}
                        <div class="p-4 border border-dashed rounded-lg text-sm text-red-500 text-center">
                            {error.message || m.something_went_wrong()}
                        </div>
                    {/await}
                {/snippet}
            </EntityManager>
        {/key}
        <input
            {...rf.fields.resourceIds.as(
                "text",
                JSON.stringify(initialData?.resourceIds || []),
            )}
            class="hidden"
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
                {...rf.fields.categoryBerlinDotDe.as(
                    "text",
                    initialData?.categoryBerlinDotDe ?? "",
                )}
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
                {m.ticket_price()} <span class="text-red-500">*</span>
            </label>
            <input
                {...rf.fields.ticketPrice.as(
                    "text",
                    initialData?.ticketPrice?.toString() ?? "",
                )}
                class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 {(rf.fields.ticketPrice.issues() ?? []).length > 0
                    ? 'border-red-500'
                    : 'border-gray-300'}"
                placeholder="e.g. 15.50"
                onblur={() => rf.validate()}
            />
            {#each rf.fields.ticketPrice.issues() ?? [] as issue}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </div>
    </div>

    <div>
        <span class="block text-sm font-medium text-gray-700 mb-2"
            >{m.location()}</span
        >
        <!-- Using Multi-Location Selector -->
        <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <MapPin size={18} class="text-blue-600" />
            {m.feature_locations_title()}
        </h3>
        {#key initialData?.id || "new"}
            <EntityManager
                title={m.feature_locations_title()}
                icon={MapPin}
                mode="embedded"
                {type}
                entityId={initialData?.id}
                listItemsRemote={listLocations as any}
                fetchAssociationsRemote={fetchEntityLocations as any}
                addAssociationRemote={async (p: any) =>
                    addLocationAssociation({ ...p, locationId: p.itemId } as any)}
                removeAssociationRemote={async (p: any) =>
                    removeLocationAssociation({ ...p, locationId: p.itemId } as any)}
                onchange={(ids: string[]) =>
                    rf.fields.locationIds.set(JSON.stringify(ids))}
                deleteItemRemote={async (ids: string[]) => {
                    return await handleDelete({
                        ids,
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
                        l.name.toLowerCase().includes(q.toLowerCase()) ||
                        (l.roomId?.toLowerCase().includes(q.toLowerCase()) ?? false)
                    );
                }}
                loadingLabel={m.loading_item({
                    item: m.feature_locations_title(),
                })}
                noItemsLabel={m.no_items_associated_label({
                    item: m.feature_locations_title(),
                })}
                noItemsFoundLabel={m.no_items_found({
                    item: m.feature_locations_title(),
                })}
                searchPlaceholder={m.search_placeholder({
                    item: m.feature_locations_title(),
                })}
                linkItemLabel={m.link_item_label({
                    item: m.feature_locations_title(),
                })}
                associatedItemLabel={m.associated_item_label({
                    item: m.feature_locations_title(),
                })}
                quickCreateLabel={m.quick_create()}
                closeSearchLabel={m.close_search()}
                editLabel={m.edit()}
                deleteLabel={m.delete()}
                unlinkLabel={m.unlink()}
                deleteForeverLabel={m.delete_forever({
                    item: m.location(),
                })}
                bulkDeleteLabel={m.delete_selected({ count: 0 })}
                selectAllLabel={m.select_all()}
                deselectAllLabel={m.deselect_all()}
                confirmUnlinkLabel={m.confirm_unlink_label({
                    item: m.location(),
                })}
            >
                {#snippet renderItemLabel(location: any)}
                    {location.name}
                    {location.roomId ? `(${location.roomId})` : ""}
                {/snippet}

                {#snippet renderForm({
                    remoteFunction: rf,
                    schema,
                    id,
                    initialData: formData = null,
                    onSuccess,
                    onCancel,
                }: any)}
                    <LocationForm
                        remoteFunction={rf}
                        validationSchema={schema}
                        isUpdating={!!id}
                        initialData={formData}
                        {onSuccess}
                        {onCancel}
                        labels={{
                            name: m.location_name(),
                            street: m.street(),
                            houseNumber: m.house_number(),
                            addressSuffix: m.address_suffix(),
                            zip: m.zip_code(),
                            city: m.city(),
                            state: m.state_region(),
                            country: m.country(),
                            roomId: m.room_id(),
                            latitude: m.latitude(),
                            longitude: m.longitude(),
                            what3words: m.what3words(),
                            inclusivitySupport: m.inclusivity_support(),
                            isPublic: m.public(),
                            heroImage: m.hero_image(),
                            saveChanges: m.save_changes(),
                            createLocation: m.create_location(),
                            cancel: m.cancel(),
                            saving: m.loading(),
                            creating: m.creating(),
                            successfullySaved: m.successfully_saved(),
                            errorSomethingWentWrong: m.something_went_wrong(),
                            enterLocationName: m.enter_location_name(),
                            streetName: m.street_placeholder(),
                            houseNumberPlaceholder: m.house_number_placeholder(),
                            addressSuffixPlaceholder:
                                m.address_suffix_placeholder(),
                            zipCodePlaceholder: m.zip_code_placeholder(),
                            cityNamePlaceholder: m.city_placeholder(),
                            statePlaceholder: m.state_placeholder(),
                            countryPlaceholder: m.country_placeholder(),
                            enterRoomId: m.room_id_placeholder(),
                            latitudePlaceholder: m.latitude_placeholder(),
                            longitudePlaceholder: m.longitude_placeholder(),
                            what3wordsPlaceholder: m.what3words_placeholder(),
                            inclusivitySupportPlaceholder: m.accessibility_info(),
                        }}
                    />
                {/snippet}
            </EntityManager>
        {/key}

        <input
            {...rf.fields.locationIds.as(
                "text",
                JSON.stringify(initialData?.locationIds ?? []),
            )}
            class="hidden"
        />
    </div>
</div>

<div class="bg-white shadow rounded-lg p-6 space-y-4">
    <h2 class="text-xl font-semibold mb-4 border-b pb-2">
        {m.date_and_time()}
    </h2>

    <div class="flex items-center gap-2">
        <input
            {...rf.fields.isAllDay.as(
                "checkbox",
                initialData?.isAllDay ?? false,
            )}
            id="isAllDay"
            class="w-4 h-4 text-blue-600"
        />
        <label for="isAllDay" class="text-sm font-medium text-gray-700"
            >{m.all_day_event()}</label
        >
    </div>

    <div class="grid grid-cols-1 gap-6">
        <!-- Start Block -->
        <div class="space-y-4">
            <div>
                <label
                    for="startDate"
                    class="block text-sm font-medium text-gray-700 mb-1"
                    >{m.start_date()}
                    <span class="text-red-500">*</span></label
                >
                <input
                    {...rf.fields.startDate.as(
                        "date",
                        startParsed.date || localNow.date,
                    )}
                    required
                    onchange={() => updateEndDateTime(rf)}
                    class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                />
            </div>
            {#if !isAllDay}
                <div>
                    <label
                        for="startTime"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >{m.start_time()}
                        <span class="text-red-500">*</span></label
                    >
                    <input
                        {...rf.fields.startTime.as(
                            "time",
                            startParsed.time || localNow.time,
                        )}
                        required
                        onchange={() => updateEndDateTime(rf)}
                        class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    />
                </div>
            {/if}
            <div>
                <label
                    for="startTimeZone"
                    class="block text-sm font-medium text-gray-700 mb-1"
                    >{m.timezone()}</label
                >
                <input
                    {...rf.fields.startTimeZone.as(
                        "text",
                        initialData?.startTimeZone || browserTimezone,
                    )}
                    list="timezones"
                    placeholder={browserTimezone}
                    class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                />
            </div>
        </div>

        <!-- End Block -->
        <div class="space-y-4">
            <div class="flex items-center gap-2 h-6 md:mb-1">
                <input
                    {...rf.fields.hasEndTime.as(
                        "checkbox",
                        initialData ? !!initialData.endDateTime : true,
                    )}
                    id="hasEndTime"
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
                        for="endDate"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >{m.end_date()}</label
                    >
                    <input
                        {...rf.fields.endDate.as("date", initialEnd.date)}
                        placeholder={rf.fields.startDate.value()}
                        class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    />
                </div>
                {#if !isAllDay}
                    <div>
                        <label
                            for="endTime"
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >{m.end_time()}</label
                        >
                        <input
                            {...rf.fields.endTime.as("time", initialEnd.time)}
                            placeholder={getDefaultEndTime(rf)}
                            class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                        />
                    </div>
                {/if}
                <div>
                    <label
                        for="endTimeZone"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >{m.end_time()} {m.timezone()}</label
                    >
                    <input
                        {...rf.fields.endTimeZone.as(
                            "text",
                            initialData?.endTimeZone ||
                                initialData?.startTimeZone ||
                                browserTimezone,
                        )}
                        list="timezones"
                        placeholder={rf.fields.startTimeZone.value()}
                        class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300"
                    />
                </div>
            {/if}
        </div>
    </div>

    <!-- Recurrence Button -->
    <div class="pt-4 border-t flex flex-wrap items-center justify-between gap-4">
        <button
            type="button"
            class="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
            onclick={() => (showRecurrenceDialog = true)}
        >
            <RefreshCw size={16} />
            <span class="text-left">{recurrenceText}</span>
        </button>

        {#if initialData?.recurringEventId}
            <a href={`/events/${initialData.recurringEventId}`} class="text-sm text-blue-600 hover:underline hover:text-blue-800">
                {m.view_series()}
            </a>
        {:else if initialData?.seriesId && !initialData?.recurringEventId && initialData?.recurrence && initialData.recurrence.length > 0}
            <a href={`/events/${initialData.id}/view`} class="text-sm text-blue-600 hover:underline hover:text-blue-800">
                {m.instances()}
            </a>
        {/if}
    </div>
</div>

<RecurrenceDialog
    bind:open={showRecurrenceDialog}
    value={rf.fields.recurrence.value() ?? initialData?.recurrence?.[0] ?? ""}
    onchange={(val) => rf.fields.recurrence.set(val)}
/>
{#if (rf.fields.recurrence.value() ?? initialData?.recurrence?.[0]) !== undefined && (rf.fields.recurrence.value() ?? initialData?.recurrence?.[0]) !== null}
    <input
        {...rf.fields.recurrence.as("text", initialData?.recurrence?.[0] ?? "")}
        class="hidden"
    />
{/if}

<div class="bg-white shadow rounded-lg p-6 space-y-4">
    <h2 class="text-xl font-semibold mb-4 border-b pb-2">
        {m.guest_options()}
    </h2>

    <div class="space-y-3">
        <label class="flex items-center gap-2">
            <input
                {...rf.fields.guestsCanInviteOthers.as(
                    "checkbox",
                    initialData?.guestsCanInviteOthers ?? false,
                )}
                class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700">{m.guests_invite()}</span>
        </label>
        <label class="flex items-center gap-2">
            <input
                {...rf.fields.guestsCanModify.as(
                    "checkbox",
                    initialData?.guestsCanModify ?? false,
                )}
                class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700">{m.guests_modify()}</span>
        </label>
        <label class="flex items-center gap-2">
            <input
                {...rf.fields.guestsCanSeeOtherGuests.as(
                    "checkbox",
                    initialData?.guestsCanSeeOtherGuests ?? false,
                )}
                class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700">{m.guests_see_others()}</span>
        </label>
        <label class="flex items-center gap-2">
            <input
                {...rf.fields.isPublic.as(
                    "checkbox",
                    initialData?.isPublic ?? true,
                )}
                class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700"
                >{m.public_event()}</span
            >
        </label>
    </div>

    <div class="mt-6">
        <h3 class="text-sm font-medium text-gray-700 mb-2">
            {m.reminders()}
        </h3>
        <label class="flex items-center gap-2 mb-4">
            <input
                {...rf.fields.reminders.useDefault.as(
                    "checkbox",
                    (initialData?.reminders as any)?.useDefault ?? true,
                )}
                class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700"
                >{m.use_default_reminders()}</span
            >
        </label>

        {#if !useDefaultReminders}
            <div class="space-y-3">
                {#each reminders as _, i}
                    <div class="flex gap-2 items-center">
                        <div class="flex-1">
                            <select
                                {...rf.fields.reminders.overrides[i].method.as("text")}
                                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="popup">{m.notification()}</option
                                >
                                <option value="email">{m.email()}</option>
                            </select>
                        </div>
                        <div class="flex-1">
                            <input
                                {...rf.fields.reminders.overrides[i].minutes.as("number")}
                                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                min="0"
                            />
                        </div>
                        <button
                            type="button"
                            class="p-2 text-red-600 hover:bg-red-50 rounded-md"
                            onclick={() => removeReminder(rf, i)}
                        >
                            &times;
                        </button>
                    </div>
                {/each}
                <button
                    type="button"
                    class="text-sm text-blue-600 hover:text-blue-800"
                    onclick={() => addReminder(rf)}
                >
                    + {m.add_item({ item: m.reminder_label() })}
                </button>
            </div>
        {/if}
    </div>
    <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
        <User size={18} class="text-blue-600" />
        {m.feature_contacts_title()}
    </h3>
    {#key initialData?.id || "new"}
    <EntityManager
        title={m.feature_contacts_title()}
        icon={User}
        mode="embedded"
        type="event"
        entityId={initialData?.id}
        onchange={(ids: string[]) =>
            rf.fields.contactIds.set(JSON.stringify(ids))}
        listItemsRemote={listContacts as any}
        fetchAssociationsRemote={fetchEntityContacts as any}
        addAssociationRemote={async (p: any) =>
            addAssociation({ ...p, contactId: p.itemId } as any)}
        removeAssociationRemote={async (p: any) =>
            removeAssociation({ ...p, contactId: p.itemId } as any)}
        deleteItemRemote={async (ids: string[]) => {
            return await handleDelete({
                ids,
                deleteFn: deleteContact,
                itemName: m.contact_label().toLowerCase(),
            });
        }}
        createRemote={createContact}
        createSchema={createContactSchema}
        updateRemote={updateContact}
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
                c.displayName || `${c.givenName || ""} ${c.familyName || ""}`
            ).toLowerCase();
            return name.includes(q.toLowerCase());
        }}
        loadingLabel={m.loading_item({ item: m.feature_contacts_title() })}
        noItemsLabel={m.no_items_associated_label({
            item: m.feature_contacts_title(),
        })}
        noItemsFoundLabel={m.no_items_found({
            item: m.feature_contacts_title(),
        })}
        searchPlaceholder={m.search_placeholder({
            item: m.feature_contacts_title(),
        })}
        linkItemLabel={m.link_item_label({
            item: m.feature_contacts_title(),
        })}
        associatedItemLabel={m.associated_item_label({
            item: m.feature_contacts_title(),
        })}
        quickCreateLabel={m.quick_create()}
        closeSearchLabel={m.close_search()}
        editLabel={m.edit()}
        deleteLabel={m.delete()}
        unlinkLabel={m.unlink()}
        deleteForeverLabel={m.delete_forever({ item: m.contact() })}
        bulkDeleteLabel={m.delete_selected({ count: 0 })}
        selectAllLabel={m.select_all()}
        deselectAllLabel={m.deselect_all()}
        confirmUnlinkLabel={m.confirm_unlink_label({ item: m.contact() })}
    >
        {#snippet renderItemLabel(contact: any)}
            {contact.displayName ||
                `${contact.givenName || ""} ${contact.familyName || ""}`}
        {/snippet}

        {#snippet participationSnippet(contact: any)}
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
            remoteFunction: rfContact,
            schema,
            initialData: formData = {},
            onSuccess,
            onCancel,
            id,
        }: any)}
            <ContactForm
                remoteFunction={rfContact}
                {schema}
                initialData={formData}
                {onSuccess}
                {onCancel}
                contactId={id}
            >
                {#snippet children({ onLocationsChange }: any)}
                    <div class="mt-8 border-t pt-8">
                        <h3
                            class="text-lg font-semibold mb-2 flex items-center gap-2"
                        >
                            <MapPin size={18} class="text-blue-600" />
                            {m.feature_locations_title()}
                        </h3>
                        {#key id || "new"}
                            <EntityManager
                            title={m.feature_locations_title()}
                            icon={MapPin}
                            mode="embedded"
                            type="location"
                            entityId={id}
                            initialItems={(
                                (formData as any)?.locationAssociations || []
                            ).map((la: any) => la.location)}
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
                            deleteItemRemote={async (ids: any) => {
                                return await handleDelete({
                                    ids: Array.isArray(ids) ? ids : [ids],
                                    deleteFn: deleteLocation,
                                    itemName: m.location().toLowerCase(),
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
                                        .includes(q.toLowerCase()) ??
                                        false)
                                );
                            }}
                            loadingLabel={m.loading_item({
                                item: m.feature_locations_title(),
                            })}
                            noItemsLabel={m.no_items_associated_label({
                                item: m.feature_locations_title(),
                            })}
                            noItemsFoundLabel={m.no_items_found({
                                item: m.feature_locations_title(),
                            })}
                            searchPlaceholder={m.search_placeholder({
                                item: m.feature_locations_title(),
                            })}
                            linkItemLabel={m.link_item_label({
                                item: m.feature_locations_title(),
                            })}
                            associatedItemLabel={m.associated_item_label({
                                item: m.feature_locations_title(),
                            })}
                            quickCreateLabel={m.quick_create()}
                            closeSearchLabel={m.close_search()}
                            editLabel={m.edit()}
                            deleteLabel={m.delete()}
                            unlinkLabel={m.unlink()}
                            deleteForeverLabel={m.delete_forever({
                                item: m.location(),
                            })}
                            bulkDeleteLabel={m.delete_selected({
                                count: 0,
                            })}
                            selectAllLabel={m.select_all()}
                            deselectAllLabel={m.deselect_all()}
                            confirmUnlinkLabel={m.confirm_unlink_label({
                                item: m.location(),
                            })}
                        >
                            {#snippet renderItemLabel(location: any)}
                                {location.name}
                                {location.roomId ? `(${location.roomId})` : ""}
                            {/snippet}
                            {#snippet renderForm({
                                remoteFunction: rfLocation,
                                schema: locSchema,
                                id: locId,
                                initialData: locFormData = null,
                                onSuccess: locSuccess,
                                onCancel: locCancel,
                            }: any)}
                                <LocationForm
                                    remoteFunction={rfLocation}
                                    validationSchema={locSchema}
                                    isUpdating={!!locId}
                                    initialData={locFormData}
                                    onSuccess={locSuccess}
                                    onCancel={locCancel}
                                    labels={{
                                        name: m.location_name(),
                                        street: m.street(),
                                        houseNumber: m.house_number(),
                                        addressSuffix: m.address_suffix(),
                                        zip: m.zip_code(),
                                        city: m.city(),
                                        state: m.state_region(),
                                        country: m.country(),
                                        roomId: m.room_id(),
                                        latitude: m.latitude(),
                                        longitude: m.longitude(),
                                        what3words: m.what3words(),
                                        inclusivitySupport:
                                            m.inclusivity_support(),
                                        isPublic: m.public(),
                                        heroImage: m.hero_image(),
                                        saveChanges: m.save_changes(),
                                        createLocation: m.create_location(),
                                        cancel: m.cancel(),
                                        saving: m.loading(),
                                        creating: m.creating(),
                                        successfullySaved:
                                            m.successfully_saved(),
                                        errorSomethingWentWrong:
                                            m.something_went_wrong(),
                                        enterLocationName:
                                            m.enter_location_name(),
                                        streetName: m.street_placeholder(),
                                        houseNumberPlaceholder:
                                            m.house_number_placeholder(),
                                        addressSuffixPlaceholder:
                                            m.address_suffix_placeholder(),
                                        zipCodePlaceholder:
                                            m.zip_code_placeholder(),
                                        cityNamePlaceholder:
                                            m.city_placeholder(),
                                        statePlaceholder: m.state_placeholder(),
                                        countryPlaceholder:
                                            m.country_placeholder(),
                                        enterRoomId: m.room_id_placeholder(),
                                        latitudePlaceholder:
                                            m.latitude_placeholder(),
                                        longitudePlaceholder:
                                            m.longitude_placeholder(),
                                        what3wordsPlaceholder:
                                            m.what3words_placeholder(),
                                        inclusivitySupportPlaceholder:
                                            m.accessibility_info(),
                                    }}
                                />
                            {/snippet}
                        </EntityManager>
        {/key}
                    </div>
                {/snippet}
            </ContactForm>
        {/snippet}
    </EntityManager>
    {/key}
    <input
        {...rf.fields.contactIds.as(
            "text",
            JSON.stringify(initialData?.contactIds || []),
        )}
        class="hidden"
    />

    <SyncCheckboxBlock
        syncFieldConfig={rf.fields.syncIds}
        initialSelectedIds={initialData?.syncIds || []}
    />
</div>
