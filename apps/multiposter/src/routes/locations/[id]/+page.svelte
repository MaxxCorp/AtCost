<script lang="ts">
    import * as m from "$lib/paraglide/messages.js";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { readLocation } from "./read.remote";
    import { updateLocation } from "./update.remote";
    import { deleteLocation } from "./delete.remote";
    import { LocationForm, handleDelete, EntityManager } from "@ac/ui";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import {
        updateLocationSchema,
        locationAssociationSchema,
        getLocationAssociationsSchema,
        type Location,
        type Contact,
    } from "@ac/validations";
    import { User } from "@lucide/svelte";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
</script>

{#snippet contactLabel(item: any)}
    <div class="flex flex-col">
        <span class="font-medium">
            {item.givenName}
            {item.familyName}
        </span>
        <span class="text-xs text-gray-500"
            >{item.emails?.[0]?.value || ""}</span
        >
    </div>
{/snippet}

{#snippet contactForm({
    remoteFunction,
    schema,
    initialData,
    onSuccess,
    onCancel,
}: any)}
    <ContactForm
        {remoteFunction}
        {schema}
        {initialData}
        {onSuccess}
        {onCancel}
    />
{/snippet}

<div class="container mx-auto px-4 py-8">
    {#await readLocation(page.params.id || "")}
        <LoadingSection
            message={m.loading_item({ item: m.feature_locations_title() })}
        />
    {:then location}
        {#if location}
            <div class="max-w-2xl mx-auto">
                <Breadcrumb feature="locations" current={location?.name} />
                <div class="bg-white shadow rounded-lg p-6 space-y-4">
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h1 class="text-3xl font-bold mb-2">
                                {location.name}
                            </h1>
                            <p class="text-sm text-gray-500">
                                {m.created()}: {new Date(
                                    location.createdAt,
                                ).toLocaleString()}
                                {#if location.updatedAt !== location.createdAt}
                                    • {m.updated()}: {new Date(
                                        location.updatedAt,
                                    ).toLocaleString()}
                                {/if}
                            </p>
                        </div>
                        <div class="flex gap-2">
                            <AsyncButton
                                type="button"
                                loadingLabel={m.deleting()}
                                loading={deleteLocation.pending}
                                variant="destructive"
                                onclick={async () => {
                                    await handleDelete({
                                        ids: [location.id],
                                        deleteFn: deleteLocation,
                                        itemName: m.location().toLowerCase(),
                                    });
                                    goto("/locations");
                                }}
                            >
                                {m.delete()}
                            </AsyncButton>
                        </div>
                    </div>
                    <h2 class="text-xl font-semibold mb-4">
                        {m.edit_item({ item: m.feature_locations_title() })}
                    </h2>
                    <LocationForm
                        remoteFunction={updateLocation}
                        validationSchema={updateLocationSchema}
                        isUpdating={true}
                        initialData={location}
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
                            houseNumberPlaceholder:
                                m.house_number_placeholder(),
                            addressSuffixPlaceholder:
                                m.address_suffix_placeholder(),
                            zipCodePlaceholder: m.zip_code_placeholder(),
                            cityNamePlaceholder: m.city_placeholder(),
                            statePlaceholder: m.state_placeholder(),
                            countryPlaceholder: m.country_placeholder(),
                            enterRoomId: m.room_id_placeholder(),
                            latitudePlaceholder: m.latitude_placeholder(),
                            longitudePlaceholder: m.longitude_placeholder(),
                            what3wordsPlaceholder: m.what3words_placeholder(),
                            inclusivitySupportPlaceholder:
                                m.accessibility_info(),
                        }}
                    >
                        {#snippet children()}
                            <div class="mt-8 pt-8 border-t">
                                <EntityManager
                                    title={m.associated_contacts()}
                                    icon={User}
                                    mode="embedded"
                                    listItemsRemote={() =>
                                        import(
                                            "../../contacts/associate.remote"
                                        ).then((r) =>
                                            r.fetchEntityContacts({
                                                type: "location",
                                                entityId: location.id,
                                            }),
                                        )}
                                    createRemote={(data: any) =>
                                        import(
                                            "../../contacts/associate.remote"
                                        ).then((r) =>
                                            r.addAssociation({
                                                ...data,
                                                type: "location",
                                                entityId: location.id,
                                            }),
                                        )}
                                    createSchema={locationAssociationSchema}
                                    deleteItemRemote={(ids: string[]) =>
                                        import(
                                            "../../contacts/associate.remote"
                                        ).then((r) =>
                                            Promise.all(
                                                ids.map((id) =>
                                                    r.removeAssociation({
                                                        type: "location",
                                                        entityId: location.id,
                                                        contactId: id,
                                                    }),
                                                ),
                                            ),
                                        )}
                                    renderItemLabel={contactLabel}
                                    searchPredicate={(
                                        item: any,
                                        query: string,
                                    ) =>
                                        (item.givenName || "")
                                            .toLowerCase()
                                            .includes(query.toLowerCase()) ||
                                        (item.familyName || "")
                                            .toLowerCase()
                                            .includes(query.toLowerCase())}
                                    renderForm={contactForm}
                                />
                            </div>
                        {/snippet}
                    </LocationForm>
                </div>
            </div>
        {:else}
            <ErrorSection
                headline={m.not_found({ item: m.feature_locations_title() })}
                message={m.not_found_message({
                    item: m.feature_locations_title(),
                })}
                href="/locations"
                button={m.back_to_list()}
            />
        {/if}
    {:catch error}
        <ErrorSection
            headline={m.something_went_wrong()}
            message={error instanceof Error
                ? error.message
                : m.failed_to_load({ item: m.feature_locations_title() })}
            href="/locations"
            button={m.back_to_list()}
        />
    {/await}
</div>
