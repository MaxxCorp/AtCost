<script lang="ts">
    import { LocationCreateView } from "@ac/ui";
    import { createLocation } from "./create.remote";
    import { createLocationSchema } from "@ac/validations";
    import * as m from "#lib/paraglide/messages.js";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";

    breadcrumbState.set({
        feature: "locations",
        current: m?.create_location ? m.create_location() : "New Location"
    });
</script>

<LocationCreateView
    createLocationRemote={createLocation}
    validationSchema={createLocationSchema}
    cancelHref="/locations"
    {m}
/>
