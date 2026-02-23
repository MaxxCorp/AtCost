<script lang="ts">
    import { User, ExternalLink } from "@lucide/svelte";
    import EntityManager from "../ui/EntityManager.svelte";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { type Contact } from "$lib/validations/contacts";
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
        updateAssociationStatus as updateAssociationStatusRemote,
    } from "../../../routes/contacts/associate.remote";
    import ContactForm from "./ContactForm.svelte";
    import { createNewContact } from "../../../routes/contacts/new/create.remote";
    import { updateExistingContact } from "../../../routes/contacts/[id]/update.remote";
    import {
        createContactSchema,
        updateContactSchema,
    } from "$lib/validations/contacts";
    import { deleteExistingContact } from "../../../routes/contacts/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import { toast } from "svelte-sonner";

    let { type, entityId = null, onchange = null, embedded = false } = $props();

    async function updateStatus(contact: Contact, status: string) {
        try {
            if (entityId) {
                await (updateAssociationStatusRemote as any)({
                    type,
                    entityId,
                    contactId: contact.id,
                    status,
                });
            }
            // Note: Since EntityManager manages its own state, we might need a way to force update
            // if we are editing associated items directly here.
            // However, the current implementation of ContactManager also had this limitation
            // where it updated its local 'associatedContacts' state manually.
            // With EntityManager, we can pass a function that updates the state if we exposed it,
            // or we just rely on the next fetch.
        } catch (error: any) {
            toast.error(error.message || "Failed to update status");
        }
    }
</script>

<EntityManager
    title="Contacts"
    icon={User}
    {type}
    {entityId}
    {embedded}
    {onchange}
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
            c.displayName || `${c.givenName || ""} ${c.familyName || ""}`
        ).toLowerCase();
        return name.includes(q.toLowerCase());
    }}
>
    {#snippet renderItemLabel(contact)}
        {contact.displayName ||
            `${contact.givenName || ""} ${contact.familyName || ""}`}
    {/snippet}

    {#snippet renderItemBadge(contact)}
        <a
            href="/contacts/{contact.id}"
            class="text-gray-700 hover:text-blue-600 flex items-center gap-1"
            title="View contact"
        >
            {contact.displayName || contact.givenName || "Unnamed"}
            <ExternalLink
                size={12}
                class="opacity-0 group-hover:opacity-100 transition-opacity"
            />
        </a>
    {/snippet}

    {#snippet participationSnippet(contact)}
        {#if type === "event"}
            <select
                value={contact.participationStatus || "needsAction"}
                onchange={(e) => {
                    const newStatus = e.currentTarget.value;
                    updateStatus(contact, newStatus);
                    contact.participationStatus = newStatus; // Local update for UI
                }}
                class="text-xs bg-transparent border-0 focus:ring-0 cursor-pointer text-gray-500 hover:text-blue-600 font-medium"
            >
                <option value="needsAction">Needs Action</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="tentative">Tentative</option>
            </select>
        {/if}
    {/snippet}

    {#snippet renderForm({
        remoteFunction,
        schema,
        initialData,
        onSuccess,
        onCancel,
        id,
    })}
        <ContactForm
            {remoteFunction}
            {schema}
            {initialData}
            {onSuccess}
            {onCancel}
            contactId={id}
        />
    {/snippet}
</EntityManager>
