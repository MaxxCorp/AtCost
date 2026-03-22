<script lang="ts">
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import * as m from "$lib/paraglide/messages";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { goto } from "$app/navigation";
    import type { createResource } from "../../../routes/resources/new/create.remote";
    import type { updateResource } from "../../../routes/resources/[id]/update.remote";
    import type { AllocationCalendar } from "$lib/validations/resources";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import EntityManager from "$lib/components/ui/EntityManager.svelte";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import type { Contact } from "$lib/validations/contacts";
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
    } from "../../../routes/contacts/associate.remote";
    import { createNewContact } from "../../../routes/contacts/new/create.remote";
    import { updateExistingContact } from "../../../routes/contacts/[id]/update.remote";
    import {
        createContactSchema,
        updateContactSchema,
    } from "$lib/validations/contacts";
    import { deleteExistingContact } from "../../../routes/contacts/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import { User, MapPin, Box } from "@lucide/svelte";
    import LocationForm from "$lib/components/locations/LocationForm.svelte";
    import { listLocations } from "../../../routes/locations/list.remote";
    import {
        addLocationAssociation,
        removeLocationAssociation,
        fetchEntityLocations,
    } from "../../../routes/locations/associate.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        locations = [],
        allResources = [],
    }: {
        remoteFunction: typeof updateResource | typeof createResource;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        locations: any[];
        allResources: any[];
    } = $props();

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

    // Allocation calendars management
    let allocationCalendars = $state<AllocationCalendar[]>([]);
    let newProvider = $state("google-calendar");
    let newCalendarId = $state("");

    // Initialize state from initialData
    $effect(() => {
        console.log('ResourceForm syncing initialData:', JSON.stringify(initialData, null, 2));
        if (initialData?.allocationCalendars) {
            allocationCalendars = initialData.allocationCalendars;
        }
        hasParent = (initialData?.parentResourceIds?.length || 0) > 0;
        if (initialData?.locationIds) {
            selectedLocationIds = initialData.locationIds;
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

    let hasParent = $state(false);

    // Sync state from props
    let selectedContactIds = $state<string[]>([]);
    let selectedLocationIds = $state<string[]>([]);

</script>

<form
    class="space-y-4"
    {...remoteFunction
        .preflight(validationSchema)
        .enhance(async ({ submit }) => {
            try {
                const result: any = await submit();
                if (result?.error) {
                    toast.error(
                        result.error.message || m.something_went_wrong(),
                    );
                    return;
                }
                toast.success(m.successfully_saved());
                await goto("/resources");
            } catch (error: unknown) {
                const err = error as { message?: string };
                toast.error(err?.message || m.something_went_wrong());
            }
        })}
>
    {#if isUpdating && initialData}
        <input {...getField("id").as("hidden", initialData.id)} />
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.summary()}</span>
        <input
            {...getField("name").as("text")}
            value={getField("name").value() ?? initialData?.name ?? ""}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(getField(
                'name',
            ).issues()?.length ?? 0) > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            placeholder={m.enter_location_name()}
            onblur={() => remoteFunction.validate()}
        />
        {#each getField("name").issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.direction()}</span>
        <input
            {...getField("type").as("text")}
            value={getField("type").value() ?? initialData?.type ?? ""}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(getField(
                'type',
            ).issues()?.length ?? 0) > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            placeholder={m.resource_type_placeholder()}
            onblur={() => remoteFunction.validate()}
        />
        {#each getField("type").issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.inventory_number()}</span>
        <input
            {...getField("inventoryNumber").as("text")}
            value={getField("inventoryNumber").value() ?? initialData?.inventoryNumber ?? ""}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(getField(
                'inventoryNumber',
            ).issues()?.length ?? 0) > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            placeholder={m.enter_inventory_number()}
            onblur={() => remoteFunction.validate()}
        />
        {#each getField("inventoryNumber").issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.description()}</span>
        <textarea
            {...getField("description").as("text")}
            value={getField("description").value() ?? initialData?.description ?? ""}
            rows="3"
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={m.description()}
        ></textarea>
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.max_occupancy()}</span
        >
        <input
            {...getField("maxOccupancy").as("number")}
            value={getField("maxOccupancy").value() ?? initialData?.maxOccupancy ?? ""}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={m.enter_max_occupancy()}
        />
    </label>

    <div class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.feature_locations_title()}</span>
        <EntityManager
            title={m.feature_locations_title()}
            icon={MapPin}
            type="resource"
            entityId={isUpdating ? initialData?.id : null}
            initialItems={initialData?.locationIds ? locations.filter(l => initialData.locationIds.includes(l.id)) : []}
            onchange={(ids) => (selectedLocationIds = ids)}
            listItemsRemote={listLocations as any}
            fetchAssociationsRemote={fetchEntityLocations as any}
            addAssociationRemote={async (p: any) =>
                addLocationAssociation({ ...p, locationId: p.itemId } as any)}
            removeAssociationRemote={async (p: any) =>
                removeLocationAssociation({ ...p, locationId: p.itemId } as any)}
            deleteItemRemote={async (id: string) => {
                return await handleDelete({
                    ids: [id],
                    deleteFn: deleteLocation,
                    itemName: m.location_label(),
                });
            }}
            createRemote={createLocation}
            createSchema={createLocationSchema}
            updateRemote={updateLocation}
            updateSchema={updateLocationSchema}
            getFormData={(l: any) => l}
            searchPredicate={(l: any, q: string) => {
                return l.name.toLowerCase().includes(q.toLowerCase()) || 
                       (l.roomId?.toLowerCase().includes(q.toLowerCase()) ?? false);
            }}
            embedded={true}
        >
            {#snippet renderItemLabel(location)}
                {location.name} {location.roomId ? `(${location.roomId})` : ""}
            {/snippet}
            {#snippet renderForm({
                remoteFunction: rf,
                schema,
                initialData: formData,
                onSuccess,
                onCancel,
                id,
            })}
                <LocationForm
                    remoteFunction={rf}
                    validationSchema={schema}
                    initialData={formData}
                    {onSuccess}
                    {onCancel}
                    isUpdating={!!id}
                />
            {/snippet}
        </EntityManager>
        <input
            type="hidden"
            name="locationIds"
            value={JSON.stringify(selectedLocationIds)}
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
                                    {...getField("parentResourceIds").as(
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

        <div class="flex gap-2">
            <select
                bind:value={newProvider}
                class="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                <option value="google-calendar">{m.google_calendar()}</option>
                <option value="microsoft-calendar">{m.microsoft_calendar()}</option>
            </select>
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

        <input
            {...getField("allocationCalendars").as(
                "hidden",
                JSON.stringify(allocationCalendars),
            )}
        />
    </div>

        <EntityManager
            title={m.feature_contacts_title()}
            icon={User}
            type="resource"
            entityId={isUpdating ? initialData?.id : null}
            onchange={(ids) => (selectedContactIds = ids)}
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
                    itemName: m.feature_contacts_title(),
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
                />
            {/snippet}
        </EntityManager>

    <input
        type="hidden"
        name="contactIds"
        value={JSON.stringify(selectedContactIds)}
    />

    <div class="flex gap-3 mt-6">
        <AsyncButton
            type="submit"
            loadingLabel={isUpdating ? m.loading() : m.creating()}
            loading={remoteFunction.pending}
        >
            {isUpdating ? m.save_changes() : m.create_resource()}
        </AsyncButton>
        <Button variant="secondary" href="/resources" size="default">
            {m.cancel()}
        </Button>
    </div>
</form>
