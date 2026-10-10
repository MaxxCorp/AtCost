<script lang="ts">
    import LocationForm from "../forms/LocationForm.svelte";
    import { createLocationSchema } from "@ac/validations";
    import type { Snippet } from "svelte";

    interface Props {
        createLocationRemote: any;
        cancelHref?: string;
        m?: any;
        labels?: any;
        title?: string;
        subtitle?: string;
        breadcrumb?: Snippet<[]>;
    }

    let {
        createLocationRemote,
        cancelHref = "/locations",
        m = undefined,
        labels = {},
        title = undefined,
        subtitle = undefined,
        breadcrumb = undefined,
    }: Props = $props();

    const formId = crypto.randomUUID();
    const rf = $derived(createLocationRemote.for(formId));

    const i18n = {
        get title() {
            return title ?? labels?.title ?? (m?.create_new_item && (m?.location_label || m?.location) ? m.create_new_item({ item: (m?.location_label ?? m?.location)() }) : undefined) ?? m?.create_location?.() ?? "Create Location";
        },
        get subtitle() {
            return subtitle ?? labels?.subtitle ?? "Add a new office or branch";
        }
    };
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    {#if breadcrumb}
        <div class="mb-4">
            {@render breadcrumb()}
        </div>
    {/if}
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
            {i18n.title}
        </h1>
        <p class="text-gray-500 mt-2">{i18n.subtitle}</p>
    </div>

    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 md:p-8">
        <LocationForm
            remoteFunction={rf}
            validationSchema={createLocationSchema}
            isUpdating={false}
            {cancelHref}
            {m}
            {labels}
        />
    </div>
</div>
