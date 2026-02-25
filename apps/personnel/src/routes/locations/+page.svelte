<script lang="ts">
    import { MapPin } from "@lucide/svelte";
    import EntityManager from "@ac/ui/components/EntityManager.svelte";
    import LocationForm from "@ac/ui/components/forms/LocationForm.svelte";
    import { listLocations } from "./list.remote";
    import { createLocation } from "./new/create.remote";
    import { updateLocation } from "./[id]/update.remote";
    import { deleteLocation } from "./[id]/delete.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations/locations";
    breadcrumbState.set({ feature: "locations" });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between mb-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Locations</h1>
            <p class="text-sm text-gray-500 mt-1">
                Manage office locations, branches, and work sites
            </p>
        </div>
    </div>

    <EntityManager
        title="Locations"
        icon={MapPin}
        mode="standalone"
        listItemsRemote={listLocations}
        deleteItemRemote={deleteLocation}
        createRemote={createLocation}
        createSchema={createLocationSchema}
        updateRemote={updateLocation}
        updateSchema={updateLocationSchema}
        getFormData={(loc) => loc}
        searchPredicate={(loc, q) => {
            return (
                loc.name.toLowerCase().includes(q.toLowerCase()) ||
                (loc.city?.toLowerCase().includes(q.toLowerCase()) ?? false)
            );
        }}
    >
        {#snippet renderItemLabel(loc)}
            <div class="flex flex-col">
                <span class="font-medium">{loc.name}</span>
                <span class="text-xs text-gray-500"
                    >{[loc.street, loc.houseNumber].filter(Boolean).join(" ") ||
                        "No address"} · {loc.city || "No city"}</span
                >
            </div>
        {/snippet}

        {#snippet renderForm({
            remoteFunction,
            schema,
            initialData,
            onSuccess,
            onCancel,
            id,
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
</div>
