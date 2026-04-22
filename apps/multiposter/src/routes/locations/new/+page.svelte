<script lang="ts">
    import { createLocation } from "./create.remote";
    import * as m from "$lib/paraglide/messages";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import LocationForm from "$lib/components/locations/LocationForm.svelte";
    import { listLocations } from "../list.remote";
    import { updateLocation } from "../[id]/update.remote";
    import { deleteLocation } from "../[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
        <Breadcrumb feature="locations" current={m.create_new_item({ item: m.location_label() })} />

        <div class="bg-white shadow rounded-lg p-6 space-y-4">
            <h1 class="text-3xl font-bold mb-6">{m.create_new_item({ item: m.location_label() })}</h1>

            <LocationForm
                remoteFunction={createLocation}
                validationSchema={createLocationSchema}
                isUpdating={false}
            />
        </div>
    </div>
</div>
