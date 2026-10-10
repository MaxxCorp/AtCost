<script lang="ts">
    import { createLocation } from "./create.remote";
    import { createLocationSchema } from "@ac/validations";
    import * as m from "#lib/paraglide/messages.js";
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import { LocationCreateView } from "@ac/ui";
</script>

<LocationCreateView
    createLocationRemote={createLocation}
    validationSchema={createLocationSchema}
    cancelHref="/locations"
    {m}
>
    {#snippet breadcrumb()}
        <Breadcrumb feature="locations" current={m.create_new_item({ item: m.location_label() })} />
    {/snippet}
</LocationCreateView>
