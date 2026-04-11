<script lang="ts">
    import * as m from "$lib/paraglide/messages.js";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { readLocation } from "./read.remote";
    import { updateLocation } from "./update.remote";
    import { deleteLocation } from "./delete.remote";
    import { toast } from "svelte-sonner";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import LocationForm from "$lib/components/locations/LocationForm.svelte";
    import { EntityManager } from "@ac/ui";
    import { User, MapPin } from "@lucide/svelte";
    import {
        createContactSchema,
        updateContactSchema,
        type Contact,
    } from "$lib/validations/contacts";
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
    } from "../../contacts/associate.remote";
    import { createNewContact } from "../../contacts/new/create.remote";
    import { updateExistingContact } from "../../contacts/[id]/update.remote";
    import { deleteExistingContact } from "../../contacts/[id]/delete.remote";
    import { listContacts } from "../../contacts/list.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";
    import { listLocations } from "../list.remote";
    import { createLocation } from "../new/create.remote";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
	const locationPromise = $state(readLocation(page.params.id || ""));
</script>

<div class="container mx-auto px-4 py-8">
    {#await locationPromise}
        <LoadingSection message={m.loading_item({ item: m.feature_locations_title() })} />
    {:then location}
        {#if location}
            <div class="max-w-2xl mx-auto">
                <Breadcrumb feature="locations" current={location.name} />
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
                    <h2 class="text-xl font-semibold mb-4">{m.edit_item({ item: m.feature_locations_title() })}</h2>
                    <LocationForm
                        remoteFunction={updateLocation}
                        validationSchema={updateLocationSchema}
                        isUpdating={true}
                        initialData={location}
                    >
                        {#snippet children()}
                            <div class="mt-8 border-t pt-8">
                                <EntityManager
                                    title={m.contacts()}
                                    icon={User}
                                    type="location"
                                    entityId={location.id}
                                    listItemsRemote={listContacts as any}
                                    fetchAssociationsRemote={fetchEntityContacts as any}
                                    addAssociationRemote={async (p: any) =>
                                        addAssociation({
                                            ...p,
                                            contactId: p.itemId,
                                        } as any)}
                                    removeAssociationRemote={async (p: any) =>
                                        removeAssociation({
                                            ...p,
                                            contactId: p.itemId,
                                        } as any)}
                                    deleteItemRemote={async (ids: string[]) => {
                                        return await handleDelete({
                                            ids,
                                            deleteFn: deleteExistingContact,
                                            itemName: m
                                                .contacts()
                                                .toLowerCase(),
                                        });
                                    }}
                                    searchPredicate={(c: Contact, q: string) => {
                                        const name = (
                                            c.displayName ||
                                            `${c.givenName} ${c.familyName}`
                                        ).toLowerCase();
                                        return name.includes(q.toLowerCase());
                                    }}
                                    createRemote={createNewContact}
                                    createSchema={createContactSchema}
                                    updateRemote={updateExistingContact}
                                    updateSchema={updateContactSchema}
                                    getFormData={(c: Contact) => ({
                                        contact: c,
                                        emails: c.emails,
                                        phones: c.phones,
                                        addresses: c.addresses,
                                        relations: c.relations,
                                        tags: c.tags,
                                        locationAssociations: c.locationAssociations,
                                    })}
                                    loadingLabel={m.loading_item({ item: m.contacts() })}
                                    noItemsLabel={m.no_items_associated_label({ item: m.contacts() })}
                                    noItemsFoundLabel={m.no_items_found({ item: m.contacts() })}
                                    searchPlaceholder={m.search_placeholder({ item: m.contacts() })}
                                    linkItemLabel={m.link_item_label({ item: m.contacts() })}
                                    associatedItemLabel={m.associated_item_label({ item: m.contacts() })}
                                    quickCreateLabel={m.quick_create()}
                                    closeSearchLabel={m.close_search()}
                                    editLabel={m.edit()}
                                    deleteLabel={m.delete()}
                                    unlinkLabel={m.unlink()}
                                    deleteForeverLabel={m.delete_forever({ item: m.contact() })}
                                    bulkDeleteLabel={m.delete_selected({ count: 0 })}
                                    selectAllLabel={m.select_all()}
                                    deselectAllLabel={m.deselect_all()}
                                    confirmUnlinkLabel={m.confirm_unlink_label({ item: m.contact() })}
                                >
                                    {#snippet renderItemLabel(contact)}
                                        {contact.displayName ||
                                            `${contact.givenName || ""} ${contact.familyName || ""}` ||
                                            m.unnamed_contact()}
                                    {/snippet}
                                    {#snippet renderForm({ remoteFunction: rf, schema, initialData: formData, onSuccess, onCancel, id })}
                                        <ContactForm
                                            remoteFunction={rf}
                                            {schema}
                                            initialData={formData}
                                            {onSuccess}
                                            {onCancel}
                                            contactId={id}
                                        >
                                            {#snippet children({ onLocationsChange })}
                                                <div
                                                    class="mt-8 border-t pt-8"
                                                >
                                                    <EntityManager
                                                        title={m.feature_locations_title()}
                                                        icon={MapPin}
                                                        type="location"
                                                        entityId={id}
                                                        initialItems={(
                                                            formData.locationAssociations ||
                                                            []
                                                        ).map(
                                                            (la: any) =>
                                                                la.location,
                                                        )}
                                                        embedded={true}
                                                        onchange={onLocationsChange}
                                                        listItemsRemote={listLocations as any}
                                                        addAssociationRemote={async (
                                                            p: any,
                                                        ) => {
                                                            return await addAssociation(
                                                                {
                                                                    type: "location",
                                                                    entityId:
                                                                        p.itemId,
                                                                    contactId:
                                                                        p.entityId,
                                                                },
                                                            );
                                                        }}
                                                        removeAssociationRemote={async (
                                                            p: any,
                                                        ) => {
                                                            return await removeAssociation(
                                                                {
                                                                    type: "location",
                                                                    entityId:
                                                                        p.itemId,
                                                                    contactId:
                                                                        p.entityId,
                                                                },
                                                            );
                                                        }}
                                                        deleteItemRemote={async (
                                                            ids,
                                                        ) => {
                                                            return await handleDelete(
                                                                {
                                                                    ids: Array.isArray(
                                                                        ids,
                                                                    )
                                                                        ? ids
                                                                        : [ids],
                                                                    deleteFn:
                                                                        deleteLocation,
                                                                    itemName: m
                                                                        .location()
                                                                        .toLowerCase(),
                                                                },
                                                            );
                                                        }}
                                                        createRemote={createLocation}
                                                        createSchema={createLocationSchema}
                                                        updateRemote={updateLocation}
                                                        updateSchema={updateLocationSchema}
                                                        getFormData={(
                                                            l: any,
                                                        ) => l}
                                                        searchPredicate={(
                                                            l: any,
                                                            q: string,
                                                        ) => {
                                                            return (
                                                                l.name
                                                                    .toLowerCase()
                                                                    .includes(
                                                                        q.toLowerCase(),
                                                                    ) ||
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
                                                        {#snippet renderForm({
                                                            remoteFunction:
                                                                rf,
                                                            schema,
                                                            id,
                                                            initialData:
                                                                formData,
                                                            onSuccess,
                                                            onCancel,
                                                        })}
                                                            <LocationForm
                                                                remoteFunction={rf}
                                                                validationSchema={schema}
                                                                isUpdating={!!id}
                                                                initialData={formData}
                                                                {onSuccess}
                                                                {onCancel}
                                                            />
                                                        {/snippet}
                                                    </EntityManager>
                                                </div>
                                            {/snippet}
                                        </ContactForm>
                                    {/snippet}
                                </EntityManager>
                            </div>
                        {/snippet}
                    </LocationForm>
                </div>
            </div>
        {:else}
            <ErrorSection
                headline={m.not_found({ item: m.feature_locations_title() })}
                message={m.not_found_message({ item: m.feature_locations_title() })}
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
