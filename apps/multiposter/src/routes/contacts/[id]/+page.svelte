<script lang="ts">
    import { page } from "$app/state";
    import * as m from "$lib/paraglide/messages";
    import { readContact } from "./read.remote";
    import { updateContact } from "./update.remote";
    import { deleteContact } from "./delete.remote";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { goto } from "$app/navigation";

    import { updateContactSchema } from "$lib/validations/contacts";
    import { EntityManager, LocationForm, handleDelete } from "@ac/ui";
    import { MapPin } from "@lucide/svelte";
    import { listLocations } from "../../locations/list.remote";
    import { createLocation } from "../../locations/new/create.remote";
    import { updateLocation } from "../../locations/[id]/update.remote";
    import { deleteLocation } from "../../locations/[id]/delete.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations";


    const contactId = page.params.id || "";
    let itemsPromise = $state(readContact(contactId));

    function handleSuccess(result: any) {
        // Redirect to list page on success
        goto(`/contacts`);
    }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-3xl mx-auto">
        {#await itemsPromise}
            <Breadcrumb feature="contacts" />
            <div
                class="bg-white shadow-xl rounded-2xl p-8 border border-gray-100"
            >
                <LoadingSection message="Loading contact profile..." />
            </div>
        {:then contact}
            {#if !contact}
                <Breadcrumb feature="contacts" />
                <div
                    class="bg-white shadow-xl rounded-2xl p-8 border border-gray-100"
                >
                    <ErrorSection
                        headline="Contact not found"
                        message="The contact you are looking for does not exist or you don't have access."
                        href="/contacts"
                        button="Back to Contacts"
                    />
                </div>
            {:else}
                <Breadcrumb
                    feature="contacts"
                    current={contact.displayName || undefined}
                />

                <div
                    class="bg-white shadow-xl rounded-2xl p-8 border border-gray-100"
                >
                    <div class="flex justify-between items-center mb-4">
                        <h1 class="text-2xl font-bold">Edit Contact</h1>
                        <AsyncButton
                            type="button"
                            loadingLabel={m.deleting()}
                            loading={deleteContact.pending}
                            variant="destructive"
                            onclick={async () => {
                                await handleDelete({
                                    ids: [contact.id],
                                    deleteFn: deleteContact,
                                    itemName: m.contacts().toLowerCase(),
                                });
                                goto("/contacts");
                            }}
                        >
                            {m.delete()}
                        </AsyncButton>
                    </div>
                    <ContactForm
                        remoteFunction={updateContact}
                        schema={updateContactSchema}
                        onSuccess={handleSuccess}
                        contactId={contact.id}
                        initialData={{
                            contact,
                            emails: contact.emails,
                            phones: contact.phones,
                            addresses: contact.addresses,
                            tags: contact.tags,
                            relations: contact.relations,
                            locationIds: (
                                contact.locationAssociations || []
                            ).map((la: any) => la.locationId),
                        }}
                    >
                        {#snippet children({ onLocationsChange })}
                            <div class="mt-8 border-t pt-8">
                                <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
                                    <MapPin size={18} class="text-blue-600" />
                                    {m.feature_locations_title()}
                                </h3>
                                <EntityManager
                                    title={m.feature_locations_title()}
                                    icon={MapPin}
                                    mode="embedded"
                                    type="location"
                                    entityId={contactId}
                                    initialItems={(
                                        contact.locationAssociations || []
                                    ).map((la: any) => la.location)}
                                    onchange={onLocationsChange}
                                    listItemsRemote={listLocations}
                                    addAssociationRemote={async (p: any) => {
                                        const { addAssociation } = await import(
                                            "../associate.remote"
                                        );
                                        return await addAssociation({
                                            type: "location",
                                            entityId: p.itemId,
                                            contactId: p.entityId,
                                        });
                                    }}
                                    removeAssociationRemote={async (p: any) => {
                                        const {
                                            removeAssociation,
                                        } = await import("../associate.remote");
                                        return await removeAssociation({
                                            type: "location",
                                            entityId: p.itemId,
                                            contactId: p.entityId,
                                        });
                                    }}
                                    deleteItemRemote={async (ids) => {
                                        return await handleDelete({
                                            ids: Array.isArray(ids)
                                                ? ids
                                                : [ids],
                                            deleteFn: deleteLocation,
                                            itemName: m
                                                .location()
                                                .toLowerCase(),
                                        });
                                    }}
                                    createRemote={createLocation}
                                    createSchema={createLocationSchema}
                                    updateRemote={updateLocation}
                                    updateSchema={updateLocationSchema}
                                    getFormData={(l) => l}
                                    searchPredicate={(l, q) => {
                                        return (
                                            l.name
                                                .toLowerCase()
                                                .includes(q.toLowerCase()) ||
                                            (l.roomId
                                                ?.toLowerCase()
                                                .includes(
                                                    q.toLowerCase(),
                                                ) ??
                                                false)
                                        );
                                    }}
                                    loadingLabel={m.loading_item({ item: m.feature_locations_title() })}
                                    noItemsLabel={m.no_items_associated_label({ item: m.feature_locations_title() })}
                                    noItemsFoundLabel={m.no_items_found({ item: m.feature_locations_title() })}
                                    searchPlaceholder={m.search_placeholder({ item: m.feature_locations_title() })}
                                    linkItemLabel={m.link_item_label({ item: m.feature_locations_title() })}
                                    associatedItemLabel={m.associated_item_label({ item: m.feature_locations_title() })}
                                    quickCreateLabel={m.quick_create()}
                                    closeSearchLabel={m.close_search()}
                                    editLabel={m.edit()}
                                    deleteLabel={m.delete()}
                                    unlinkLabel={m.unlink()}
                                    deleteForeverLabel={m.delete_forever({ item: m.location() })}
                                    bulkDeleteLabel={m.delete_selected({ count: 0 })}
                                    selectAllLabel={m.select_all()}
                                    deselectAllLabel={m.deselect_all()}
                                    confirmUnlinkLabel={m.confirm_unlink_label({ item: m.location() })}
                                >
                                    {#snippet renderItemLabel(location)}
                                        {location.name}
                                        {location.roomId
                                            ? `(${location.roomId})`
                                            : ""}
                                    {/snippet}
                                    {#snippet renderForm({ remoteFunction: rf, schema, id, initialData: formData, onSuccess, onCancel })}
                                        <LocationForm
                                            remoteFunction={rf}
                                            validationSchema={schema}
                                            isUpdating={!!id}
                                            initialData={formData}
                                            {onSuccess}
                                            {onCancel}
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
                                    {/snippet}
                                </EntityManager>
                            </div>
                        {/snippet}
                    </ContactForm>
                </div>
            {/if}
        {:catch error}
            <Breadcrumb feature="contacts" />
            <div
                class="bg-white shadow-xl rounded-2xl p-8 border border-gray-100"
            >
                <ErrorSection
                    headline="Error loading contact"
                    message={error.message}
                    href="/contacts"
                    button="Back to Contacts"
                />
            </div>
        {/await}
    </div>
</div>
