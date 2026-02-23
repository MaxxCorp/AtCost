<script lang="ts">
    import { MapPin } from "@lucide/svelte";
    import EntityManager from "../ui/EntityManager.svelte";
    import {
        listLocations,
        type Location,
    } from "../../../routes/locations/list.remote";
    import LocationForm from "./LocationForm.svelte";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";

    let {
        type,
        entityId = null,
        onchange = null,
        embedded = false,
        initialItems = [],
    } = $props();
</script>

<EntityManager
    title="Locations"
    icon={MapPin}
    {type}
    {entityId}
    {embedded}
    {onchange}
    {initialItems}
    listItemsRemote={listLocations as any}
    deleteItemRemote={async (id: string) => {
        return await handleDelete({
            ids: [id],
            deleteFn: deleteLocation,
            itemName: "location",
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
>
    {#snippet renderItemLabel(location)}
        {location.name} {location.roomId ? `(${location.roomId})` : ""}
    {/snippet}

    {#snippet renderItemBadge(location)}
        <div class="flex items-center gap-1">
            <span class="text-gray-700 font-medium">{location.name}</span>
            {#if location.roomId}
                <span class="text-gray-500 text-xs text-nowrap"
                    >({location.roomId})</span
                >
            {/if}
        </div>
    {/snippet}

    {#snippet renderForm({
        remoteFunction,
        schema,
        id,
        initialData,
        onSuccess,
        onCancel,
    })}
        <LocationForm
            {remoteFunction}
            validationSchema={schema}
            isUpdating={!!id}
            {initialData}
            {onSuccess}
            {onCancel}
        />
    {/snippet}
</EntityManager>
