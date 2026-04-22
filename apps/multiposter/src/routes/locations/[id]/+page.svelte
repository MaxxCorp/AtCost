<script lang="ts">
    import * as m from "$lib/paraglide/messages.js";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { readLocation } from "./read.remote";
    import { updateLocation } from "./update.remote";
    import { deleteLocation } from "./delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import LocationForm from "$lib/components/locations/LocationForm.svelte";
    import {
        updateLocationSchema,
    } from "$lib/validations/locations";

	const locationPromise = $state(readLocation(page.params.id || ""));
</script>

<div class="container mx-auto px-4 py-8">
    {#await locationPromise}
        <LoadingSection message={m.loading_item({ item: m.feature_locations_title() })} />
    {:then location}
        {#if location}
            <div class="max-w-2xl mx-auto">
                <Breadcrumb feature="locations" current={location.name} />
                <div class="bg-white shadow rounded-lg p-6 space-y-4">
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h1 class="text-3xl font-bold mb-2">
                                {location.name}
                            </h1>
                            <p class="text-sm text-gray-500">
                                {m.created()}: {new Date(
                                    location.createdAt,
                                ).toLocaleString()}
                                {#if location.updatedAt !== location.createdAt}
                                    • {m.updated()}: {new Date(
                                        location.updatedAt,
                                    ).toLocaleString()}
                                {/if}
                            </p>
                        </div>
                        <div class="flex gap-2">
                            <AsyncButton
                                type="button"
                                loadingLabel={m.deleting()}
                                loading={deleteLocation.pending}
                                variant="destructive"
                                onclick={async () => {
                                    await handleDelete({
                                        ids: [location.id],
                                        deleteFn: deleteLocation,
                                        itemName: m.location().toLowerCase(),
                                    });
                                    goto("/locations");
                                }}
                            >
                                {m.delete()}
                            </AsyncButton>
                        </div>
                    </div>
                    <h2 class="text-xl font-semibold mb-4">{m.edit_item({ item: m.feature_locations_title() })}</h2>
                    <LocationForm
                        remoteFunction={updateLocation}
                        validationSchema={updateLocationSchema}
                        isUpdating={true}
                        initialData={location}
                    />
                </div>
            </div>
        {:else}
            <ErrorSection
                headline={m.not_found({ item: m.feature_locations_title() })}
                message={m.not_found_message({ item: m.feature_locations_title() })}
                href="/locations"
                button={m.back_to_list()}
            />
        {/if}
    {:catch error}
        <ErrorSection
            headline={m.something_went_wrong()}
            message={error instanceof Error
                ? error.message
                : m.failed_to_load({ item: m.feature_locations_title() })}
            href="/locations"
            button={m.back_to_list()}
        />
    {/await}
</div>
