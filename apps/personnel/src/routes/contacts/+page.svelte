<script lang="ts">
    import { User, MapPin } from "@lucide/svelte";
    import EntityManager from "@ac/ui/components/EntityManager.svelte";
    import ContactForm from "@ac/ui/components/forms/ContactForm.svelte";
    import LocationForm from "@ac/ui/components/forms/LocationForm.svelte";
    import { listContacts } from "./list.remote";
    import { createNewContact } from "./new/create.remote";
    import { updateExistingContact } from "./[id]/update.remote";
    import { deleteExistingContact } from "./[id]/delete.remote";
    import { listLocations } from "../locations/list.remote";
    import { createLocation } from "../locations/new/create.remote";
    import { updateLocation } from "../locations/[id]/update.remote";
    import { deleteLocation } from "../locations/[id]/delete.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import {
        createContactSchema,
        updateContactSchema,
    } from "@ac/validations/contacts";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations/locations";
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
    } from "./associate.remote";

    breadcrumbState.set({ feature: "contacts" });

    // Personnel specific search logic
    const searchPredicate = (c: any, q: string) => {
        const query = q.toLowerCase();
        const displayName = (c.displayName || "").toLowerCase();
        const givenName = (c.givenName || "").toLowerCase();
        const familyName = (c.familyName || "").toLowerCase();
        const email = (c.emails?.[0]?.value || "").toLowerCase();
        return (
            displayName.includes(query) ||
            givenName.includes(query) ||
            familyName.includes(query) ||
            email.includes(query)
        );
    };
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between mb-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Personnel</h1>
            <p class="text-sm text-gray-500 mt-1">
                Manage your team, employees, and external contacts
            </p>
        </div>
    </div>

    <EntityManager
        title="Contacts"
        icon={User}
        mode="standalone"
        listItemsRemote={listContacts}
        deleteItemRemote={(ids) =>
            deleteExistingContact(Array.isArray(ids) ? ids : [ids])}
        createRemote={createNewContact}
        createSchema={createContactSchema}
        updateRemote={updateExistingContact}
        updateSchema={updateContactSchema}
        getFormData={(c) => ({
            contact: c,
            emails: c.emails,
            phones: c.phones,
            addresses: c.addresses,
            relations: c.relations,
            tags: c.tags,
            locationAssociations: c.locationAssociations,
        })}
        {searchPredicate}
    >
        {#snippet renderItemLabel(contact)}
            <div class="flex flex-col">
                <span class="font-medium"
                    >{contact.displayName ||
                        `${contact.givenName || ""} ${contact.familyName || ""}`}</span
                >
                <span class="text-xs text-gray-500">
                    {contact.emails?.[0]?.value || "No email"}
                    {#if contact.phones?.[0]}
                        · {contact.phones[0].value}
                    {/if}
                </span>
            </div>
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
                listContactsRemote={listContacts}
            >
                <div class="mt-8 border-t pt-8">
                    <EntityManager
                        title="Locations"
                        icon={MapPin}
                        type="location"
                        entityId={id}
                        initialItems={(
                            initialData?.locationAssociations || []
                        ).map((la: any) => la.location)}
                        embedded={true}
                        listItemsRemote={listLocations}
                        addAssociationRemote={async (p: any) =>
                            addAssociation({
                                type: "location",
                                entityId: p.itemId,
                                contactId: p.entityId,
                            } as any)}
                        removeAssociationRemote={async (p: any) =>
                            removeAssociation({
                                type: "location",
                                entityId: p.itemId,
                                contactId: p.entityId,
                            } as any)}
                        fetchAssociationsRemote={fetchEntityContacts as any}
                        deleteItemRemote={(ids) =>
                            deleteLocation(Array.isArray(ids) ? ids : [ids])}
                        createRemote={createLocation}
                        createSchema={createLocationSchema}
                        updateRemote={updateLocation}
                        updateSchema={updateLocationSchema}
                        getFormData={(l: any) => l}
                        searchPredicate={(l: any, q: string) => {
                            return (
                                l.name
                                    .toLowerCase()
                                    .includes(q.toLowerCase()) ||
                                (l.roomId
                                    ?.toLowerCase()
                                    .includes(q.toLowerCase()) ??
                                    false)
                            );
                        }}
                    >
                        {#snippet renderItemLabel(location)}
                            {location.name}
                            {location.roomId ? `(${location.roomId})` : ""}
                        {/snippet}
                        {#snippet renderForm({
                            remoteFunction: rf,
                            schema: locSchema,
                            id: locId,
                            initialData: formData,
                            onSuccess: onLocSuccess,
                            onCancel: onLocCancel,
                        })}
                            <LocationForm
                                remoteFunction={rf}
                                validationSchema={locSchema}
                                isUpdating={!!locId}
                                initialData={formData}
                                onSuccess={onLocSuccess}
                                onCancel={onLocCancel}
                            />
                        {/snippet}
                    </EntityManager>
                </div>
            </ContactForm>
        {/snippet}
    </EntityManager>
</div>
