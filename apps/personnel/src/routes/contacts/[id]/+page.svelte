<script lang="ts">
    import { page } from "$app/state";
    import ContactForm from "@ac/ui/components/forms/ContactForm.svelte";
    import EntityManager from "@ac/ui/components/EntityManager.svelte";
    import LocationForm from "@ac/ui/components/forms/LocationForm.svelte";
    import LoadingSection from "@ac/ui/components/LoadingSection.svelte";
    import { MapPin } from "@lucide/svelte";
    import { readContact } from "./read.remote";
    import { updateExistingContact } from "./update.remote";
    import { deleteExistingContact } from "./delete.remote";
    import { listContacts } from "../list.remote";
    import { listLocations } from "../../locations/list.remote";
    import { createLocation } from "../../locations/new/create.remote";
    import { updateLocation } from "../../locations/[id]/update.remote";
    import { deleteLocation } from "../../locations/[id]/delete.remote";
    import { updateContactSchema } from "@ac/validations/contacts";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations/locations";
    import {
        addAssociation,
        removeAssociation,
        fetchContactLocations,
    } from "../associate.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";

    const id = $derived(page.params.id as string);
    const contactQuery = $derived(readContact(id) as any);

    $effect(() => {
        const data = contactQuery.data;
        if (data?.contact) {
            breadcrumbState.set({
                feature: "contacts",
                current: `Edit: ${data.contact.displayName || `${data.contact.givenName} ${data.contact.familyName}`}`,
            });
        }
    });

    const initialData = $derived(
        contactQuery.data
            ? {
                  contact: contactQuery.data.contact,
                  emails: contactQuery.data.emails,
                  phones: contactQuery.data.phones,
                  addresses: contactQuery.data.addresses,
                  locationAssociations: contactQuery.data.locationAssociations,
                  locationIds: contactQuery.data.locationIds,
                  relations: contactQuery.data.relations,
                  tags: contactQuery.data.tags,
              }
            : null,
    );

    let locationIds = $state<string[]>([]);
    $effect(() => {
        if (initialData?.locationIds) {
            locationIds = [...initialData.locationIds];
        }
    });
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    {#if contactQuery.pending}
        <LoadingSection message="Loading contact details..." />
    {:else if contactQuery.data}
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 line-clamp-1">
                {contactQuery.data.contact.displayName ||
                    `${contactQuery.data.contact.givenName} ${contactQuery.data.contact.familyName}`}
            </h1>
            <p class="text-gray-500 mt-2">
                Manage relationships and contact info
            </p>
        </div>

        <div
            class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8"
        >
            <ContactForm
                remoteFunction={updateExistingContact}
                schema={updateContactSchema}
                {initialData}
                contactId={id}
                bind:locationIds
                cancelHref="/contacts"
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
                        fetchAssociationsRemote={async (p) =>
                            fetchContactLocations(p.entityId)}
                        onchange={(ids: string[]) => (locationIds = ids)}
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
                            schema,
                            id: locId,
                            initialData: formData,
                            onSuccess,
                            onCancel,
                        })}
                            <LocationForm
                                remoteFunction={rf}
                                validationSchema={schema}
                                isUpdating={!!locId}
                                initialData={formData}
                                {onSuccess}
                                {onCancel}
                            />
                        {/snippet}
                    </EntityManager>
                </div>
            </ContactForm>
        </div>
    {:else}
        <div class="text-center py-12">
            <h2 class="text-xl font-semibold text-gray-900">
                Contact not found
            </h2>
            <p class="text-gray-500 mt-2">
                The person you're looking for doesn't exist.
            </p>
            <a
                href="/contacts"
                class="text-blue-600 hover:underline mt-4 inline-block"
                >Back to list</a
            >
        </div>
    {/if}
</div>
