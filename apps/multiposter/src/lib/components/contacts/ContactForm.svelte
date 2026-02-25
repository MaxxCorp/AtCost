<script lang="ts">
    import { MapPin } from "@lucide/svelte";
    import SharedContactForm from "@ac/ui/components/forms/ContactForm.svelte";
    import EntityManager from "../ui/EntityManager.svelte";
    import LocationForm from "../locations/LocationForm.svelte";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { listLocations } from "../../../routes/locations/list.remote";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";

    interface Props {
        initialData?: any;
        remoteFunction?: any;
        schema?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        contactId?: string;
        loading?: boolean;
    }

    let {
        initialData = {},
        remoteFunction,
        schema,
        onSuccess,
        onCancel,
        cancelHref = "/contacts",
        contactId,
        loading = false,
    }: Props = $props();
</script>

<SharedContactForm
    {initialData}
    {remoteFunction}
    {schema}
    {onSuccess}
    {onCancel}
    {cancelHref}
    {contactId}
    {loading}
    listContactsRemote={listContacts}
>
    <div class="mt-8 border-t pt-8">
        <EntityManager
            title="Locations"
            icon={MapPin}
            type="location"
            entityId={contactId}
            initialItems={(initialData.locationAssociations || []).map(
                (la: any) => la.location,
            )}
            embedded={true}
            listItemsRemote={listLocations}
            addAssociationRemote={async (p: any) => {
                const { addAssociation } = await import(
                    "../../../routes/contacts/associate.remote"
                );
                return await addAssociation({
                    type: "location",
                    entityId: p.itemId,
                    contactId: p.entityId,
                });
            }}
            removeAssociationRemote={async (p: any) => {
                const { removeAssociation } = await import(
                    "../../../routes/contacts/associate.remote"
                );
                return await removeAssociation({
                    type: "location",
                    entityId: p.itemId,
                    contactId: p.entityId,
                });
            }}
            deleteItemRemote={async (ids) => {
                return await handleDelete({
                    ids: Array.isArray(ids) ? ids : [ids],
                    deleteFn: deleteLocation,
                    itemName: "location",
                });
            }}
            createRemote={createLocation}
            createSchema={createLocationSchema}
            updateRemote={updateLocation}
            updateSchema={updateLocationSchema}
            getFormData={(l) => l}
            searchPredicate={(l, q) => {
                return (
                    l.name.toLowerCase().includes(q.toLowerCase()) ||
                    (l.roomId?.toLowerCase().includes(q.toLowerCase()) ?? false)
                );
            }}
        >
            {#snippet renderItemLabel(location)}
                {location.name}
                {location.roomId ? `(${location.roomId})` : ""}
            {/snippet}
            {#snippet renderForm({
                remoteFunction: rf,
                schema,
                id,
                initialData: formData,
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
</SharedContactForm>
