<script lang="ts">
    import { User } from "@lucide/svelte";
    import SharedLocationForm from "@ac/ui/components/forms/LocationForm.svelte";
    import EntityManager from "../ui/EntityManager.svelte";
    import ContactForm from "../contacts/ContactForm.svelte";
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
</script>

<SharedLocationForm
    {remoteFunction}
    {validationSchema}
    {isUpdating}
    {initialData}
    {onSuccess}
    {onCancel}
    {cancelHref}
>
    {#if isUpdating && initialData}
        <div class="mt-8 border-t pt-8">
            <EntityManager
                title="Contacts"
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
                        itemName: "contact",
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
                        `${contact.givenName || ""} ${contact.familyName || ""}`}
                {/snippet}
                {#snippet renderForm({
                    remoteFunction: rf,
                    schema,
                    initialData: formData,
                    onSuccess,
                    onCancel,
                    id,
                })}
                    <ContactForm
                        remoteFunction={rf}
                        {schema}
                        initialData={formData}
                        {onSuccess}
                        {onCancel}
                        contactId={id}
                    />
                {/snippet}
            </EntityManager>
        </div>
    {/if}
</SharedLocationForm>
