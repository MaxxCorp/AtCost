<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import LocationForm from "@ac/ui/components/forms/LocationForm.svelte";
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
</script>

<LocationForm
    {remoteFunction}
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
/>
