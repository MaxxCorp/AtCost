<script lang="ts">
    import LocationForm from "@ac/ui/components/forms/LocationForm.svelte";
    import { createLocation } from "./create.remote";
    import { createLocationSchema } from "@ac/validations/locations";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";

    breadcrumbState.set({ feature: "locations", current: "New Location" });
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 line-clamp-1">
            Create Location
        </h1>
        <p class="text-gray-500 mt-2">Add a new office or branch</p>
    </div>

    <div
        class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8"
    >
        <LocationForm
            remoteFunction={createLocation}
            validationSchema={createLocationSchema}
            cancelHref="/locations"
        />
    </div>
</div>
