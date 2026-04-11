<script lang="ts">
    import { goto } from "$app/navigation";
    import { createNewContact } from "./create.remote";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";

    import { createContactSchema } from "$lib/validations/contacts";
    import { EntityManager } from "@ac/ui";
    import { MapPin } from "@lucide/svelte";
    import * as m from "$lib/paraglide/messages";
    import { listLocations } from "../../locations/list.remote";
    import { createLocation } from "../../locations/new/create.remote";
    import { updateLocation } from "../../locations/[id]/update.remote";
    import { deleteLocation } from "../../locations/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";
    import LocationForm from "$lib/components/locations/LocationForm.svelte";

    function handleSuccess(result: any) {
        const finalId = result?.id || result?.contact?.id;
        if (finalId) {
            goto(`/contacts/${finalId}`);
        } else {
            goto("/contacts");
        }
    }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
        <Breadcrumb feature="contacts" />
        <div class="bg-white shadow rounded-lg p-6">
            <h1 class="text-2xl font-bold mb-6">Create New Contact</h1>
            <ContactForm
                remoteFunction={createNewContact}
                schema={createContactSchema}
                onSuccess={handleSuccess}
            >
                {#snippet children({ onLocationsChange })}
                    <div class="mt-8 border-t pt-8">
                        <EntityManager
                            title={m.feature_locations_title()}
                            icon={MapPin}
                            type="location"
                            entityId={""}
                            initialItems={[]}
                            embedded={true}
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
                                />
                            {/snippet}
                        </EntityManager>
                    </div>
                {/snippet}
            </ContactForm>
        </div>
    </div>
</div>
