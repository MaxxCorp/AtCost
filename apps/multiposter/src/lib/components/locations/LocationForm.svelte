<script lang="ts">
    import { User } from "@lucide/svelte";
    import * as m from "$lib/paraglide/messages";
    import { onMount } from "svelte";
    import LocationForm from "@ac/ui/components/forms/LocationForm.svelte";
    import EntityManager from "../ui/EntityManager.svelte";
    // import ContactForm from "../contacts/ContactForm.svelte"; // Circular dependency
    import { listContacts } from "../../../routes/contacts/list.remote";
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
    } from "../../../routes/contacts/associate.remote";
    import { createNewContact } from "../../../routes/contacts/new/create.remote";
    import { updateExistingContact } from "../../../routes/contacts/[id]/update.remote";
    import { deleteExistingContact } from "../../../routes/contacts/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import {
        createContactSchema,
        updateContactSchema,
        type Contact,
    } from "$lib/validations/contacts";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/locations",
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
    } = $props();

    let ContactForm = $state<any>(null);
    onMount(async () => {
        ContactForm = (await import("../contacts/ContactForm.svelte")).default;
    });
</script>

<LocationForm
    {remoteFunction}
    {validationSchema}
    {isUpdating}
    {initialData}
    {onSuccess}
    {onCancel}
    {cancelHref}
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
    {#if isUpdating && initialData}
        <div class="mt-8 border-t pt-8">
            <EntityManager
                title={m.contacts()}
                icon={User}
                type="location"
                entityId={initialData.id}
                listItemsRemote={listContacts as any}
                fetchAssociationsRemote={fetchEntityContacts as any}
                addAssociationRemote={async (p: any) =>
                    addAssociation({ ...p, contactId: p.itemId } as any)}
                removeAssociationRemote={async (p: any) =>
                    removeAssociation({ ...p, contactId: p.itemId } as any)}
                deleteItemRemote={async (id: string) => {
                    return await handleDelete({
                        ids: [id],
                        deleteFn: deleteExistingContact,
                        itemName: m.contacts().toLowerCase(),
                    });
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
                })}
                searchPredicate={(c: Contact, q: string) => {
                    const name = (
                        c.displayName ||
                        `${c.givenName || ""} ${c.familyName || ""}`
                    ).toLowerCase();
                    return name.includes(q.toLowerCase());
                }}
            >
                {#snippet renderItemLabel(contact)}
                    {contact.displayName ||
                        `${contact.givenName || ""} ${contact.familyName || ""}` ||
                        m.unnamed_contact()}
                {/snippet}
                {#snippet renderForm({
                    remoteFunction: rf,
                    schema,
                    initialData: formData,
                    onSuccess,
                    onCancel,
                    id,
                })}
                    {#if ContactForm}
                        <svelte:component
                            this={ContactForm}
                            remoteFunction={rf}
                            {schema}
                            initialData={formData}
                            {onSuccess}
                            {onCancel}
                            contactId={id}
                        />
                    {/if}
                {/snippet}
            </EntityManager>
        </div>
    {/if}
</LocationForm>
