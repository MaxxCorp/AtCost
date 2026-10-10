<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { listLocations } from "./list.remote";
    import { deleteLocation } from "./[id]/delete.remote";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { LocationList } from "@ac/ui";
    import { getLocationFilterGroups } from "#lib/filters/index.js";

    breadcrumbState.set({ feature: "locations" });

    const filterGroups = $derived(getLocationFilterGroups(m));
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-5xl mx-auto space-y-6">
        <LocationList
            listLocationsRemote={listLocations}
            deleteLocationRemote={deleteLocation}
            {filterGroups}
            {m}
        />
    </div>
</div>
