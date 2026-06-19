<script lang="ts">
    import { page } from "$app/state";
    import * as m from "$lib/paraglide/messages";
    import { readResource } from "./read.remote";
    import { listLocations } from "../../locations/list.remote";
    import { listResources } from "../list.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import ResourceForm from "$lib/components/resources/ResourceForm.svelte";
    import { updateResource } from "./update.remote";
    import { updateResourceSchema } from "$lib/validations/resources";

    const resourceId = $derived(page.params.id || "");

    const query1 = $derived(readResource(resourceId));
    const query2 = $derived(listLocations());
    const query3 = $derived(listResources());
</script>

<div class="container mx-auto px-4 py-8">
    {#if query1.loading || query2.loading || query3.loading && !(query1.current && query2.current && query3.current)}
        <LoadingSection message={m.loading_resource()} />
    {:else if query1.current && query2.current && query3.current}
        {@const resource = query1.current}
        {@const locations = query2.current}
        {@const allResources = query3.current}
        {#if resource}
            <div class="max-w-2xl mx-auto">
                <Breadcrumb feature="resources" current={resource.name} />
                <div class="bg-white shadow rounded-lg p-6 space-y-4">
                    <h1 class="text-3xl font-bold mb-6">{m.edit_resource()}</h1>
                    {#key resourceId}
                    <ResourceForm
                        remoteFunction={updateResource}
                        validationSchema={updateResourceSchema}
                        isUpdating={true}
                        initialData={resource}
                        locations={locations.data}
                        allResources={allResources.data}
                    />
                    {/key}
                </div>
            </div>
        {/if}
    {:else if query1.error || query2.error || query3.error}
        {@const error = query1.error || query2.error || query3.error}
            <ErrorSection
                headline={m.resource_not_found()}
                message={m.resource_not_found_message()}
                href="/resources"
                button={m.back_to_resources()}
            />
    {/if}
</div>
