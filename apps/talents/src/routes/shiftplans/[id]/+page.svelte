<script lang="ts">
    import { page } from '$app/state';
    import ShiftplanTemplateForm from "#lib/components/shiftplans/ShiftplanTemplateForm.svelte";
    import { updateShiftplan } from "./update.remote";
    import { getShiftplan } from "../list.remote";
    import { updateShiftplanSchema } from "@ac/validations";
    import { LoadingSection, ErrorSection, recordActiveItem, getLastListUrl } from "@ac/ui";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";

    const id = $derived(page.params.id as string);
    const query = $derived(getShiftplan(id));

    $effect(() => {
        if (id) {
            recordActiveItem("shiftplans", id);
        }
    });

    $effect(() => {
        if (query.current && 'name' in query.current) {
            breadcrumbState.set({ 
                feature: "shiftplans",
                current: (query.current as any).name 
            });
        }
    });
</script>

<div class="py-10">
    {#if query.loading}
        <LoadingSection message="Loading template details..." />
    {:else if query.error}
        <ErrorSection 
            headline="Template not found"
            message={query.error?.message || "The requested template could not be loaded."}
            href={getLastListUrl("shiftplans", "/shiftplans")}
            button="Back to List"
        />
    {:else if query.current}
                    <ShiftplanTemplateForm 
                isUpdating={true}
                initialData={query.current}
                remoteFunction={updateShiftplan}
                validationSchema={updateShiftplanSchema}
            />
            {/if}
</div>
