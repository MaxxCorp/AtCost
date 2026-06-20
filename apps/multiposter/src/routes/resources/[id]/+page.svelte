<script lang="ts">
	import { LoadingSection, ErrorSection } from "@ac/ui";
    import { page } from "$app/state";
    import * as m from "$lib/paraglide/messages";
    import { readResource } from "./read.remote";
    import { listLocations } from "../../locations/list.remote";
    import { listResources } from "../list.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
            import ResourceForm from "$lib/components/resources/ResourceForm.svelte";
    import { updateResource } from "./update.remote";
    import { updateResourceSchema } from "$lib/validations/resources";

    const resourceId = $derived(page.params.id || "");

</script>

<div class="container mx-auto px-4 py-8">
    <svelte:boundary>
        {#if $effect.pending()}
            <LoadingSection message={m.loading_resource()} />
        {/if}
        <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
            {#await Promise.all([readResource(resourceId), listLocations(), listResources()]) then [resource, locations, allResources]}
                {#if resource}
                    <div class="max-w-2xl mx-auto">
                        <Breadcrumb feature="resources" current={resource.name} />
                        <div class="bg-white shadow rounded-lg p-6 space-y-4">
                            <h1 class="text-3xl font-bold mb-6">{m.edit_resource()}</h1>
                                                <ResourceForm
                                remoteFunction={updateResource.for(resourceId)}
                                validationSchema={updateResourceSchema}
                                isUpdating={true}
                                initialData={resource}
                                locations={locations.data}
                                allResources={allResources.data}
                            />
                                            </div>
                    </div>
                {/if}
            {/await}
        </div>
        {#snippet failed(error: unknown)}
            <ErrorSection
                headline={m.resource_not_found()}
                message={m.resource_not_found_message()}
                href="/resources"
                button={m.back_to_resources()}
            />
        {/snippet}
    </svelte:boundary>
</div>
