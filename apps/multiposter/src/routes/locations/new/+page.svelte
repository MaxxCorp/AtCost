<script lang="ts">
    import { createLocation } from "./create.remote";
    import * as m from "$lib/paraglide/messages";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import { LocationForm } from "@ac/ui";

    const formId = crypto.randomUUID();
    const rf = createLocation.for(formId);
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
        <Breadcrumb feature="locations" current={m.create_new_item({ item: m.location_label() })} />

        <div class="bg-white shadow rounded-lg p-6 space-y-4">
            <h1 class="text-3xl font-bold mb-6">{m.create_new_item({ item: m.location_label() })}</h1>

            <LocationForm
                remoteFunction={rf}
                validationSchema={createLocationSchema}
                isUpdating={false}
                {m}
            />
        </div>
    </div>
</div>
