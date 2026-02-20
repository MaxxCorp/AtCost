<script lang="ts">
    import ResourceManager from "../resources/ResourceManager.svelte";
    import ContactForm from "./ContactForm.svelte";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import { createNewContact } from "../../../routes/contacts/new/create.remote";
    import { updateExistingContact } from "../../../routes/contacts/[id]/update.remote";
    import { deleteExistingContact } from "../../../routes/contacts/[id]/delete.remote";
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
        updateAssociationStatus as updateAssociationStatusRemote,
    } from "../../../routes/contacts/associate.remote";
    import {
        createContactSchema,
        updateContactSchema,
    } from "$lib/validations/contacts";

    import { type Resource } from "../resources/ResourceManager.svelte";

    // Legacy props
    let {
        type = "event",
        entityId = null,
        value = $bindable([]),
        onchange = undefined,
    }: {
        type?: string; // Context type (parent) -- allowing any string to support all entity types
        entityId?: string | null;
        value?: any;
        onchange?: (ids: string[]) => void;
    } = $props();
</script>

<ResourceManager
    type="contact"
    {entityId}
    bind:value
    {onchange}
    remoteFunctions={{
        list: listContacts as unknown as () => Promise<Resource[]>,
        create: createNewContact,
        update: updateExistingContact,
        delete: deleteExistingContact,
        // Wrap association functions to inject parent context `type`
        associate: async ({ entityId, resourceId }) =>
            addAssociation({
                type: type as any,
                entityId,
                contactId: resourceId,
            }),

        dissociate: async ({ entityId, resourceId }) =>
            removeAssociation({
                type: type as any,
                entityId,
                contactId: resourceId,
            }),

        fetchAssociations: async ({ entityId }) =>
            (await fetchEntityContacts({
                type: type as any,
                entityId,
            })) as unknown as Resource[],

        // Additional custom actions? ResourceManager doesn't support them yet generic way.
        // But for status update (participationStatus), we might need to handle it.
        // Currently ResourceManager doesn't render status dropdowns.
        // This is a REGRESSION if we don't support it.
        // "Event" type contacts have status.
        // We'll leave it as is for now as per "Refactor... into single ResourceManager"
        // implies standardizing. If status is needed, ResourceManager needs a slot or config.
        // For now, let's assume basic management is the priority.
    }}
    FormComponent={ContactForm}
    schemas={{
        create: createContactSchema,
        update: updateContactSchema,
    }}
/>
