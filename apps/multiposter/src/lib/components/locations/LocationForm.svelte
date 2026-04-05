<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { LocationForm } from "@ac/ui";
    import ImageUploader from "$lib/components/cms/ImageUploader.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        children?: Snippet;
    }

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/locations",
        children,
    }: Props = $props();

    // Initialize remoteFunction if it's a definition function to ensure reactive context
    const rf = $derived(typeof remoteFunction === "function" ? (remoteFunction as any)() : remoteFunction);

    // svelte-ignore state_referenced_locally
    let heroImage = $state(initialData?.heroImage ?? "");

    function getField(name: string) {
        const def = { as: () => ({}), issues: () => [], value: () => undefined };
        if (!(rf as any)?.fields) return def;
        const parts = name.split(".");
        let current: any = (rf as any).fields;
        for (const part of parts) {
            if (current?.[part] === undefined) return def;
            current = current[part];
        }
        return current ?? def;
    }
</script>

<LocationForm
    remoteFunction={rf}
    {validationSchema}
    {isUpdating}
    {initialData}
    {onSuccess}
    {onCancel}
    {cancelHref}
    {children}
    labels={{
        name: m.location_name(),
        street: m.street(),
        houseNumber: m.house_number(),
        addressSuffix: m.address_suffix(),
        zip: m.zip_code(),
        city: m.city(),
        state: m.state_region(),
        country: m.country(),
        roomId: m.room_id(),
        latitude: m.latitude(),
        longitude: m.longitude(),
        what3words: m.what3words(),
        inclusivitySupport: m.inclusivity_support(),
        isPublic: m.public(),
        heroImage: m.hero_image(),
        saveChanges: m.save_changes(),
        createLocation: m.create_location(),
        cancel: m.cancel(),
        saving: m.loading(),
        creating: m.creating(),
        successfullySaved: m.successfully_saved(),
        errorSomethingWentWrong: m.something_went_wrong(),
        enterLocationName: m.enter_location_name(),
        streetName: m.street_placeholder(),
        houseNumberPlaceholder: m.house_number_placeholder(),
        addressSuffixPlaceholder: m.address_suffix_placeholder(),
        zipCodePlaceholder: m.zip_code_placeholder(),
        cityNamePlaceholder: m.city_placeholder(),
        statePlaceholder: m.state_placeholder(),
        countryPlaceholder: m.country_placeholder(),
        enterRoomId: m.room_id_placeholder(),
        latitudePlaceholder: m.latitude_placeholder(),
        longitudePlaceholder: m.longitude_placeholder(),
        what3wordsPlaceholder: m.what3words_placeholder(),
        inclusivitySupportPlaceholder: m.accessibility_info(),
    }}
>
    {#snippet heroImageSlot()}
        <div class="mb-4">
            <ImageUploader bind:value={heroImage} label={m.hero_image()} />
            {#if heroImage}
                <input {...getField("heroImage").as("hidden", heroImage)} />
            {/if}
        </div>
    {/snippet}
</LocationForm>
