<script lang="ts">
    import { page } from "$app/state";
    import LocationForm from "@ac/ui/components/forms/LocationForm.svelte";
    import LoadingSection from "@ac/ui/components/LoadingSection.svelte";
    import { readLocation } from "./read.remote";
    import { updateLocation } from "./update.remote";
    import { updateLocationSchema } from "@ac/validations/locations";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";

    const id = $derived(page.params.id as string);

    const locationQuery = $derived(readLocation(id) as any);

    $effect(() => {
        if (locationQuery.data) {
            breadcrumbState.set({
                feature: "locations",
                current: `Edit: ${locationQuery.data.name}`,
            });
        }
    });
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    {#if locationQuery.pending}
        <LoadingSection message="Loading location details..." />
    {:else if locationQuery.data}
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 line-clamp-1">
                {locationQuery.data.name}
            </h1>
            <p class="text-gray-500 mt-2">
                Update location details and settings
            </p>
        </div>

        <div
            class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8"
        >
            <LocationForm
                remoteFunction={updateLocation}
                validationSchema={updateLocationSchema}
                initialData={locationQuery.data}
                isUpdating={true}
                cancelHref="/locations"
            />
        </div>
    {:else}
        <div class="text-center py-12">
            <h2 class="text-xl font-semibold text-gray-900">
                Location not found
            </h2>
            <p class="text-gray-500 mt-2">
                The location you're looking for doesn't exist.
            </p>
            <a
                href="/locations"
                class="text-blue-600 hover:underline mt-4 inline-block"
                >Back to list</a
            >
        </div>
    {/if}
</div>
