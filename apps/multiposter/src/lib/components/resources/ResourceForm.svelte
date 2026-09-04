<script lang="ts">
    import { untrack } from "svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import * as m from "$lib/paraglide/messages";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { goto } from "$app/navigation";
    import type { createResource } from "../../../routes/resources/new/create.remote";
    import type { updateResource } from "../../../routes/resources/[id]/update.remote";
    import type { AllocationCalendar } from "$lib/validations/resources";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import { EntityManager, LocationForm, handleDelete, translateIssue, matchContactSearch } from "@ac/ui";
    import { listLocations } from "../../../routes/locations/list.remote";
    import { readLocation } from "../../../routes/locations/[id]/read.remote";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { readContact } from "../../../routes/contacts/[id]/read.remote";
    import {
        fetchEntityContacts,
        addAssociation,
        removeAssociation,
    } from "../../../routes/contacts/associate.remote";
    import { createContact } from "../../../routes/contacts/new/create.remote";
    import { updateContact } from "../../../routes/contacts/[id]/update.remote";
    import { deleteContact } from "../../../routes/contacts/[id]/delete.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
        createContactSchema,
        updateContactSchema,
        type Location,
        type Contact,
    } from "@ac/validations";
    import { User, MapPin } from "@lucide/svelte";

    import {
        addLocationAssociation,
        removeLocationAssociation,
        fetchEntityLocations,
    } from "../../../routes/locations/associate.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import { listMsTenantResources } from "../../../routes/resources/list-ms-tenant-resources.remote";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        locations = [],
        allResources = [],
        onSuccess,
        onCancel,
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        locations: any[];
        allResources: any[];
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
    } = $props();

    // svelte-ignore state_referenced_locally
    const rf = (remoteFunction as any).preflight(validationSchema);

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (rf as any).allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = issues.length;
    });

    // Allocation calendars management
    let resourceType = $state<string>(untrack(() => initialData?.type || "room"));
    let allocationCalendars = $state<AllocationCalendar[]>(untrack(() => initialData?.allocationCalendars || []));
    let newProvider = $state("google-calendar");
    let newCalendarId = $state("");

    let hasParent = $state(untrack(() => (initialData?.parentResourceIds?.length || 0) > 0));

    // Sync state from props
    let selectedContactIds = $state<string[]>(untrack(() => initialData?.contactIds || []));
    let selectedLocationIds = $state<string[]>(untrack(() => initialData?.locationIds || []));

    let msResourcesState = $state<{
        loading: boolean;
        data: Array<{ id: string; displayName: string; emailAddress: string; type: "room" | "equipment" }>;
        success?: boolean;
        configured?: boolean;
        error?: string;
        message?: string;
    }>({ loading: false, data: [] });

    let prevFetchKey = $state<string>("");

    $effect(() => {
        if (newProvider === "microsoft-calendar") {
            const fetchKey = `${newProvider}:${resourceType}`;
            if (prevFetchKey !== fetchKey) {
                prevFetchKey = fetchKey;
                msResourcesState = { loading: true, data: [] };

                listMsTenantResources({ type: resourceType })
                    .then((res) => {
                        if (prevFetchKey !== fetchKey) return;
                        msResourcesState = {
                            loading: false,
                            data: res?.data || [],
                            success: res?.success,
                            configured: res?.configured,
                            error: res?.error,
                            message: res?.message,
                        };

                        if (res?.success === false && res?.error) {
                            toast.error(res.error);
                        } else if (res?.configured === false && res?.message) {
                            toast.warning(res.message);
                        } else if (res?.success && (!res?.data || res.data.length === 0)) {
                            toast.info(m.no_ms_resources_found());
                        }
                    })
                    .catch((err) => {
                        if (prevFetchKey !== fetchKey) return;
                        const errorMsg = err?.message || m.something_went_wrong();
                        msResourcesState = {
                            loading: false,
                            data: [],
                            success: false,
                            error: errorMsg,
                        };
                        toast.error(errorMsg);
                    });
            }
        } else {
            prevFetchKey = "";
        }
    });

    function addAllocationCalendar() {
        if (newCalendarId.trim()) {
            allocationCalendars = [
                ...allocationCalendars,
                { provider: newProvider, calendarId: newCalendarId.trim() },
            ];
            newCalendarId = "";
        }
    }

    function removeAllocationCalendar(index: number) {
        allocationCalendars = allocationCalendars.filter((_, i) => i !== index);
    }
</script>

<form
    class="space-y-4"
    {...rf.enhance(async ({ submit }: { submit: any }) => {
            try {
                await submit();
                const result = (rf as any).result;
                const error = (rf as any).error;

                if (error || (result && result.success === false)) {
                    toast.error(
                        error?.message ||
                            result?.error?.message ||
                            m.something_went_wrong(),
                    );
                    return;
                }
                toast.success(m.successfully_saved());
                if (isUpdating) {
                    toast.info(m.resource_config_updated_resyncing());
                }
                if (onSuccess) {
                    onSuccess(result);
                } else {
                    await goto("/resources");
                }
            } catch (error: unknown) {
                const err = error as { message?: string };
                toast.error(err?.message || m.something_went_wrong());
            }
        })}
>
    {#if isUpdating && initialData?.id}
        <input {...rf.fields.id.as("text", initialData.id)} class="hidden" />
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.summary()}</span>
        <input
            {...rf.fields.name.as("text", initialData?.name ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.name.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            placeholder={m.enter_location_name()}
            onblur={() => rf.validate()}
        />
        {#each rf.fields.name.issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.resource_type()}</span>
        <select
            {...rf.fields.type.as("select", resourceType)}
            bind:value={resourceType}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.type.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            onchange={() => rf.validate()}
            onblur={() => rf.validate()}
        >
            <option value="room">{m.room()}</option>
            <option value="equipment">{m.equipment()}</option>
        </select>
        {#each rf.fields.type.issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.inventory_number()}</span>
        <input
            {...rf.fields.inventoryNumber.as("text", initialData?.inventoryNumber ?? "")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.inventoryNumber.issues() ?? []).length > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            placeholder={m.enter_inventory_number()}
            onblur={() => rf.validate()}
        />
        {#each rf.fields.inventoryNumber.issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.description()}</span>
        <textarea
            {...rf.fields.description.as("text", initialData?.description ?? "")}
            rows="3"
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={m.description()}
        ></textarea>
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.max_occupancy()}</span
        >
        <input
            {...rf.fields.maxOccupancy.as("number", initialData?.maxOccupancy)}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={m.enter_max_occupancy()}
        />
    </label>

    <div class="block">
        <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <MapPin size={18} class="text-blue-600" />
            {m.feature_locations_title()}
        </h3>
        {#key initialData?.id || "new"}
            <EntityManager {m}
                title={m.feature_locations_title()}
                icon={MapPin}
                mode="embedded"
                type="resource"
                entityId={isUpdating ? initialData?.id : null}
                initialItems={initialData?.locationIds ? locations.filter(l => initialData.locationIds.includes(l.id)) : []}
                onchange={(ids: any) => (selectedLocationIds = ids)}
                listItemsRemote={listLocations as any}
                fetchAssociationsRemote={fetchEntityLocations as any}
                addAssociationRemote={async (p: any) =>
                    addLocationAssociation({ ...p, locationId: p.itemId } as any)}
                removeAssociationRemote={async (p: any) =>
                    removeLocationAssociation({ ...p, locationId: p.itemId } as any)}
                deleteItemRemote={async (ids: string[]) => {
                    return await handleDelete({
                        ids,
                        deleteFn: deleteLocation,
                        itemName: m.location_label(),
                    });
                }}
                createRemote={createLocation}
                createSchema={createLocationSchema}
                updateRemote={updateLocation}
                updateSchema={updateLocationSchema}
                readItemRemote={readLocation}
                searchPredicate={(l: any, q: string) => {
                    return l.name.toLowerCase().includes(q.toLowerCase()) || 
                           (l.roomId?.toLowerCase().includes(q.toLowerCase()) ?? false);
                }}
                loadingLabel={m.loading_item({ item: m.feature_locations_title() })}
                noItemsLabel={m.no_items_associated_label({ item: m.feature_locations_title() })}
                noItemsFoundLabel={m.no_items_found({ item: m.feature_locations_title() })}
                searchPlaceholder={m.search_placeholder({ item: m.feature_locations_title() })}
                linkItemLabel={m.link_item_label({ item: m.feature_locations_title() })}
                associatedItemLabel={m.associated_item_label({ item: m.feature_locations_title() })}
                quickCreateLabel={m.quick_create()}
                closeSearchLabel={m.close_search()}
                editLabel={m.edit()}
                deleteLabel={m.delete()}
                unlinkLabel={m.unlink()}
                deleteForeverLabel={m.delete_forever({ item: m.location() })}
                bulkDeleteLabel={m.delete_selected({ count: 0 })}
                selectAllLabel={m.select_all()}
                deselectAllLabel={m.deselect_all()}
                confirmUnlinkLabel={m.confirm_unlink_label({ item: m.location() })}
            >
                {#snippet renderItemLabel(location: any)}
                    {location.name} {location.roomId ? `(${location.roomId})` : ""}
                {/snippet}
                {#snippet renderForm({
                    remoteFunction: rf,
                    schema,
                    initialData: formData,
                    onSuccess,
                    onCancel,
                    id,
                }: any)}
                    <LocationForm
                        remoteFunction={rf}
                        validationSchema={schema}
                        initialData={formData}
                        {onSuccess}
                        {onCancel}
                        isUpdating={!!id}
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
                            addressSuffixPlaceholder: m.address_suffix_placeholder(),
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
                JSON.stringify(selectedLocationIds),
            )}
            class="hidden"
        />
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2"
            >{m.parent_resources()}</span
        >
        <div class="mt-2 space-y-2">
            <label class="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={hasParent}
                    onclick={() => (hasParent = !hasParent)}
                    class="w-4 h-4 text-blue-600"
                />
                <span class="text-sm">{m.assign_to_parent()}</span>
            </label>
            {#if hasParent}
                <div
                    class="space-y-2 border rounded-md p-4 max-h-48 overflow-y-auto"
                >
                    {#each allResources as resource}
                        {#if !isUpdating || resource.id !== initialData?.id}
                            <!-- Prevent self-parenting -->
                            <label class="flex items-center gap-2">
                                <input
                                    {...rf.fields.parentResourceIds.as(
                                        "checkbox",
                                        resource.id,
                                    )}
                                    class="w-4 h-4 text-blue-600"
                                    checked={initialData?.parentResourceIds?.includes(
                                        resource.id,
                                    ) ?? false}
                                />
                                <span class="text-sm"
                                    >{resource.name} ({resource.type})</span
                                >
                            </label>
                        {/if}
                    {/each}
                    {#if allResources.length === 0}
                        <p class="text-sm text-gray-500">
                            {m.no_resources_available()}
                        </p>
                    {/if}
                </div>
            {/if}
        </div>
    </label>

    <div class="block">
        <span class="text-sm font-medium text-gray-700 mb-2"
            >{m.allocation_calendars()}</span
        >
        <p class="text-xs text-gray-500 mb-3">
            {m.track_allocation_description()}
        </p>

        {#if allocationCalendars.length > 0}
            <div class="space-y-2 mb-3">
                {#each allocationCalendars as calendar, index}
                    <div
                        class="flex items-center gap-2 p-2 bg-gray-50 rounded border"
                    >
                        <span class="text-sm flex-1">
                            <span class="font-medium">{calendar.provider}:</span
                            >
                            {calendar.calendarId}
                        </span>
                        <button
                            type="button"
                            onclick={() => removeAllocationCalendar(index)}
                            class="text-red-600 hover:text-red-800 text-sm"
                        >
                            {m.remove()}
                        </button>
                    </div>
                {/each}
            </div>
        {/if}

        <div class="flex flex-col gap-2">
            <div class="flex gap-2">
                <select
                    bind:value={newProvider}
                    class="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                    <option value="google-calendar">{m.google_calendar()}</option>
                    <option value="microsoft-calendar">{m.microsoft_calendar()}</option>
                </select>

                {#if newProvider === "microsoft-calendar"}
                    {#if msResourcesState.loading}
                        <span class="text-xs text-gray-500 self-center">{m.loading_ms_resources()}</span>
                    {:else if msResourcesState.success === false}
                        <div class="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-900 flex-1 flex items-center gap-1.5">
                            <span>{msResourcesState.error || m.something_went_wrong()}</span>
                        </div>
                    {:else if msResourcesState.configured === false}
                        <div class="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-900 flex-1 flex items-center gap-1.5">
                            <span>{msResourcesState.message}</span>
                        </div>
                    {:else if msResourcesState.data && msResourcesState.data.length > 0}
                        <select
                            class="flex-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            onchange={(e) => {
                                const val = (e.target as HTMLSelectElement).value;
                                if (val) newCalendarId = val;
                            }}
                        >
                            <option value="">-- {m.select_ms_tenant_resource()} --</option>
                            {#each msResourcesState.data as tenantItem}
                                <option value={tenantItem.emailAddress || tenantItem.id}>
                                    {tenantItem.displayName} ({tenantItem.emailAddress || tenantItem.id})
                                </option>
                            {/each}
                        </select>
                    {:else}
                        <div class="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-900 flex-1 flex items-center gap-1.5">
                            <span>{m.no_ms_resources_found()}</span>
                        </div>
                    {/if}
                {/if}
            </div>

            <div class="flex gap-2">
                <input
                    type="text"
                    bind:value={newCalendarId}
                    placeholder={m.calendar_id()}
                    class="flex-1 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onkeydown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            addAllocationCalendar();
                        }
                    }}
                />
                <button
                    type="button"
                    onclick={addAllocationCalendar}
                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    {m.add()}
                </button>
            </div>
        </div>

        <input
            {...rf.fields.allocationCalendars.as(
                "text",
                JSON.stringify(allocationCalendars),
            )}
            class="hidden"
        />
    </div>
    <div class="block">
        <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <User size={18} class="text-blue-600" />
            {m.feature_contacts_title()}
        </h3>

        {#key initialData?.id || "new"}
            <EntityManager {m}
                title={m.feature_contacts_title()}
                icon={User}
                type="resource"
                mode="embedded"
                entityId={isUpdating ? initialData?.id : null}
                onchange={(ids: any) => (selectedContactIds = ids)}
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
                        itemName: m.feature_contacts_title(),
                    });
                }}
                createRemote={createContact}
                createSchema={createContactSchema}
                updateRemote={updateContact}
                updateSchema={updateContactSchema}
                readItemRemote={readContact}
                searchPredicate={matchContactSearch}
                loadingLabel={m.loading_item({ item: m.feature_contacts_title() })}
                noItemsLabel={m.no_items_associated_label({ item: m.feature_contacts_title() })}
                noItemsFoundLabel={m.no_items_found({ item: m.feature_contacts_title() })}
                searchPlaceholder={m.search_placeholder({ item: m.feature_contacts_title() })}
                linkItemLabel={m.link_item_label({ item: m.feature_contacts_title() })}
                associatedItemLabel={m.associated_item_label({ item: m.feature_contacts_title() })}
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
                        `${contact.givenName || ""} ${contact.familyName || ""}`.trim() ||
                        contact.company ||
                        m.unnamed_contact()}
                {/snippet}
                {#snippet renderForm({
                    remoteFunction: rf,
                    schema,
                    initialData: formData,
                    onSuccess,
                    onCancel,
                    id,
                }: any)}
                    <ContactForm
                        remoteFunction={rf}
                        {schema}
                        initialData={formData}
                        {onSuccess}
                        {onCancel}
                        contactId={id}
                    />
                {/snippet}
            </EntityManager>
        {/key}
    </div>

    <input
        {...rf.fields.contactIds.as(
            "text",
            JSON.stringify(selectedContactIds),
        )}
        class="hidden"
    />

    <div class="flex gap-3 mt-6">
        <AsyncButton
            type="submit"
            loadingLabel={isUpdating ? m.loading() : m.creating()}
            loading={(rf as any).pending}
        >
            {isUpdating ? m.save_changes() : m.create_resource()}
        </AsyncButton>
        {#if onCancel}
            <Button variant="secondary" type="button" onclick={onCancel} size="default">
                {m.cancel()}
            </Button>
        {:else}
            <Button variant="secondary" href="/resources" size="default">
                {m.cancel()}
            </Button>
        {/if}
    </div>
</form>
