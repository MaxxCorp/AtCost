<script lang="ts">
    import { MapPin } from "@lucide/svelte";
    import * as m from "$lib/paraglide/messages";
    import { onMount } from "svelte";
    import ContactForm from "@ac/ui/components/forms/ContactForm.svelte";
    import EntityManager from "../ui/EntityManager.svelte";
    // import LocationForm from "../locations/LocationForm.svelte"; // Circular dependency
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

    let LocationFormComp = $state<any>(null);
    onMount(async () => {
        LocationFormComp = (await import("../locations/LocationForm.svelte"))
            .default;
    });
</script>

<ContactForm
    {initialData}
    {remoteFunction}
    {schema}
    {onSuccess}
    {onCancel}
    {cancelHref}
    {contactId}
    {loading}
    listContactsRemote={listContacts}
    labels={{
        basicInformation: m.basic_information(),
        displayName: m.display_name(),
        givenName: m.given_name(),
        familyName: m.family_name(),
        birthday: m.birthday(),
        company: m.company(),
        department: m.department(),
        role: m.role(),
        notes: m.notes(),
        isPublicLabel: m.public_profile(),
        isPublicDescription: m.public_profile_description(),
        tagsPlaceholder: m.tag_placeholder(),
        relations: m.relations(),
        contactSearchPlaceholder: m.search_contact_to_link(),
        emailAddresses: m.email_addresses(),
        addEmail: m.add_email(),
        emailPlaceholder: m.email_address(),
        home: m.home_label(),
        work: m.work_label(),
        mobile: m.mobile_label(),
        other: m.other_label(),
        primary: m.primary(),
        phoneNumbers: m.phone_numbers(),
        addPhone: m.add_phone(),
        phonePlaceholder: m.phone_number(),
        saveContact: m.save_contact(),
        cancel: m.cancel(),
        saving: m.loading(),
        errorSomethingWentWrong: m.something_went_wrong(),
        successfullySaved: m.successfully_saved(),
        reportsTo: m.reports_to(),
        cooperatesWith: m.cooperates_with(),
        managerOf: m.manager_of(),
    }}
>
    {#snippet children({
        onLocationsChange,
    }: {
        onLocationsChange: (ids: string[]) => void;
    })}
        <div class="mt-8 border-t pt-8">
            <EntityManager
                title={m.feature_locations_title()}
                icon={MapPin}
                type="location"
                entityId={contactId}
                initialItems={(initialData.locationAssociations || []).map(
                    (la: any) => la.location,
                )}
                embedded={true}
                onchange={onLocationsChange}
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
                        itemName: m.location().toLowerCase(),
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
                        (l.roomId?.toLowerCase().includes(q.toLowerCase()) ??
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
                    id,
                    initialData: formData,
                    onSuccess,
                    onCancel,
                })}
                    {#if LocationFormComp}
                        <svelte:component
                            this={LocationFormComp}
                            remoteFunction={rf}
                            validationSchema={schema}
                            isUpdating={!!id}
                            initialData={formData}
                            {onSuccess}
                            {onCancel}
                        />
                    {/if}
                {/snippet}
            </EntityManager>
        </div>
    {/snippet}
</ContactForm>
