<script lang="ts">
    import ShiftplanTemplateForm from "$lib/components/shiftplans/ShiftplanTemplateForm.svelte";
    import { createShiftplan } from "./create.remote";
    import { createShiftplanSchema } from "@ac/validations";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";

    breadcrumbState.set({ 
        feature: "shiftplans",
        current: "New Template"
    });
</script>

<div class="py-10">
    <ShiftplanTemplateForm 
        remoteFunction={createShiftplan}
        validationSchema={createShiftplanSchema}
    />
</div>
