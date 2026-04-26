<script lang="ts">
    import { createLocation } from "./create.remote";
    import * as m from "$lib/paraglide/messages";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import { LocationForm } from "@ac/ui";
    import { listLocations } from "../list.remote";
    import { updateLocation } from "../[id]/update.remote";
    import { deleteLocation } from "../[id]/delete.remote";
    import { handleDelete } from "@ac/ui";
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
        <Breadcrumb feature="locations" current={m.create_new_item({ item: m.location_label() })} />

        <div class="bg-white shadow rounded-lg p-6 space-y-4">
            <h1 class="text-3xl font-bold mb-6">{m.create_new_item({ item: m.location_label() })}</h1>

            <LocationForm
                remoteFunction={createLocation}
                validationSchema={createLocationSchema}
                isUpdating={false}
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
            />
        </div>
    </div>
</div>
