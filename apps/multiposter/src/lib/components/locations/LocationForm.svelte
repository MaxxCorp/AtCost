<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import SharedLocationForm from "@ac/ui/components/forms/LocationForm.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        remoteFunction: any;
        validationSchema?: any;
        schema?: any;
        isUpdating?: boolean;
        initialData?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        children?: Snippet<[]>;
        heroImageSlot?: Snippet<[]>;
        labels?: any;
    }

    let {
        remoteFunction,
        validationSchema,
        schema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/locations",
        children,
        heroImageSlot,
        labels = undefined,
    }: Props = $props();

    const effectiveSchema = $derived(validationSchema ?? schema);
</script>

<SharedLocationForm
    {remoteFunction}
    validationSchema={effectiveSchema}
    {isUpdating}
    {initialData}
    {onSuccess}
    {onCancel}
    {cancelHref}
    {children}
    {heroImageSlot}
    {labels}
    {m}
/>
