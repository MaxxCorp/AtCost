<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { LocationForm, EntityManager } from "@ac/ui";
    import ImageUploader from "$lib/components/cms/ImageUploader.svelte";
    import { onMount, type Snippet } from "svelte";
    import { User, MapPin } from "@lucide/svelte";
    import { listContacts } from "../../../routes/contacts/list.remote";
    import {
        addAssociation,
        removeAssociation,
        fetchEntityContacts,
    } from "../../../routes/contacts/associate.remote";
    import { createContact } from "../../../routes/contacts/new/create.remote";
    import { updateContact } from "../../../routes/contacts/[id]/update.remote";
    import { deleteContact } from "../../../routes/contacts/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import {
        createContactSchema,
        updateContactSchema,
        type Contact,
    } from "$lib/validations/contacts";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import { toast } from "svelte-sonner";
    import * as v from "valibot";

    interface Props {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        children?: Snippet;
    }

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/locations",
        children,
    }: Props = $props();

    // Initialize remoteFunction if it's a definition function to ensure reactive context
    const rf = $derived(typeof remoteFunction === "function" ? (remoteFunction as any)() : remoteFunction);

    // svelte-ignore state_referenced_locally
    let heroImage = $state(initialData?.heroImage ?? "");

    function getField(name: string) {
        const def = { as: (type: string, value?: any) => ({ name, type, value }), issues: () => [], value: () => undefined };
        if (!(rf as any)?.fields) return def;
        const parts = name.split(".");
        let current: any = (rf as any).fields;
        for (const part of parts) {
            if (current?.[part] === undefined) return def;
            current = current[part];
        }
        return current ?? def;
    }

    let selectedContactIds = $state<string[]>([]);
</script>

<LocationForm
    remoteFunction={rf}
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
        isPublic: m.public(),
        heroImage: m.hero_image(),
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
    {#snippet heroImageSlot()}
        <div class="mb-4">
            <ImageUploader bind:value={heroImage} label={m.hero_image()} />
            {#if heroImage}
                <input {...getField("heroImage").as("hidden", heroImage)} />
            {/if}
        </div>
    {/snippet}

    {#snippet children()}
        <div class="mt-8 border-t pt-8">
            <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
                <User size={18} class="text-blue-600" />
                {m.contacts()}
            </h3>
            <EntityManager
                title={m.contacts()}
                icon={User}
                mode="embedded"
                type="location"
                entityId={initialData?.id || ""}
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
                        deleteFn: deleteContact,
                        itemName: m.contacts().toLowerCase(),
                    });
                }}
                createRemote={createContact}
                createSchema={createContactSchema}
                updateRemote={updateContact}
                updateSchema={updateContactSchema}
                getFormData={((c: any) => ({
                    contact: c as Contact,
                    emails: (c as Contact).emails,
                    phones: (c as Contact).phones,
                    addresses: (c as Contact).addresses,
                    relations: (c as Contact).relations,
                    tags: (c as Contact).tags,
                    locationAssociations: (c as Contact).locationAssociations,
                })) as any}
                searchPredicate={((c: any, q: string) => {
                    const contact = c as Contact;
                    const name = (
                        contact.displayName ||
                        `${contact.givenName || ""} ${contact.familyName || ""}`
                    ).toLowerCase();
                    return name.includes(q.toLowerCase());
                }) as any}
                loadingLabel={m.loading_item({ item: m.contacts() })}
                noItemsLabel={m.no_items_associated_label({
                    item: m.contacts(),
                })}
                noItemsFoundLabel={m.no_items_found({
                    item: m.contacts(),
                })}
                searchPlaceholder={m.search_placeholder({
                    item: m.contacts(),
                })}
                linkItemLabel={m.link_item_label({ item: m.contacts() })}
                associatedItemLabel={m.associated_item_label({
                    item: m.contacts(),
                })}
                quickCreateLabel={m.quick_create()}
                closeSearchLabel={m.close_search()}
                editLabel={m.edit()}
                deleteLabel={m.delete()}
                unlinkLabel={m.unlink()}
                deleteForeverLabel={m.delete_forever({
                    item: m.contact(),
                })}
                bulkDeleteLabel={m.delete_selected({ count: 0 })}
                selectAllLabel={m.select_all()}
                deselectAllLabel={m.deselect_all()}
                confirmUnlinkLabel={m.confirm_unlink_label({
                    item: m.contact(),
                })}
            >
                {#snippet renderItemLabel(contact: any)}
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
                }: any)}
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
        {@render children?.()}
    {/snippet}
</LocationForm>
