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
    <h1 class="text-2xl font-black text-gray-900 px-1">Locations</h1>
    <EntityManager
        title="Locations"
        icon={MapPin}
        mode="standalone"
        listItemsRemote={listLocations}
        deleteItemRemote={deleteLocation}
        createHref="/locations/new"
        createLabel="Create Location"
        createRemote={createLocation}
        createSchema={createLocationSchema}
        updateRemote={updateLocation}
        updateSchema={updateLocationSchema}
        getFormData={(loc: any) => loc}
        searchPredicate={(loc: any, q: any) => {
            return (
                loc.name.toLowerCase().includes(q.toLowerCase()) ||
                (loc.city?.toLowerCase().includes(q.toLowerCase()) ?? false)
            );
        }}
        filters={[
            {
                id: "city",
                label: "City",
                type: "select",
                optionsRemote: async () => {
                    const res = await listLocations({ limit: 1000 });
                    const items = Array.isArray(res) ? res : res.data;
                    const cities = [...new Set(items.map((i: any) => i.city).filter(Boolean))];
                    return cities.map(city => ({ value: city, label: city }));
                }
            }
        ]}
    >
        {#snippet renderItemLabel(loc: any)}
            <div class="flex flex-col">
                <span class="font-medium">{loc.name}</span>
                <span class="text-xs text-gray-500"
                    >{[loc.street, loc.houseNumber].filter(Boolean).join(" ") ||
                        "No address"} Â· {loc.city || "No city"}</span
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
        }: any)}
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
