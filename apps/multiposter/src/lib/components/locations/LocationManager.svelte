<script lang="ts">
    import ResourceManager from "../resources/ResourceManager.svelte";
    import LocationForm from "./LocationForm.svelte";
    import { listLocations } from "../../../routes/locations/list.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import {
        addLocationToContact,
        removeLocationFromContact,
        fetchContactLocations,
    } from "../../../routes/locations/associate.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";

    import { type Resource } from "../resources/ResourceManager.svelte";

    let {
        contactId = null,
        value = $bindable([]),
        onchange,
    }: {
        contactId?: string | null;
        value?: any;
        onchange?: (ids: string[]) => void;
    } = $props();
</script>

<ResourceManager
    type="location"
    entityId={contactId}
    bind:value
    {onchange}
    remoteFunctions={{
        list: listLocations as unknown as () => Promise<Resource[]>,
        create: createLocation,
        update: updateLocation,
        delete: deleteLocation,
        // Wrap for contact context
        associate: async ({ entityId, resourceId }) =>
            addLocationToContact({
                contactId: entityId,
                locationId: resourceId,
            }),

        dissociate: async ({ entityId, resourceId }) =>
            removeLocationFromContact({
                contactId: entityId,
                locationId: resourceId,
            }),

        fetchAssociations: async ({ entityId }) =>
            (await fetchContactLocations({
                contactId: entityId,
            })) as unknown as Resource[],
    }}
    FormComponent={LocationForm}
    schemas={{
        create: createLocationSchema,
        update: updateLocationSchema,
    }}
/>
