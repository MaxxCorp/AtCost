<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { page } from "$app/state";
    import { readLocation } from "./read.remote";
    import { updateLocation } from "./update.remote";
    import { deleteLocation } from "./delete.remote";
    import { LocationDetailView, EntityManager, handleDelete, matchContactSearch } from "@ac/ui";
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import { User } from "@lucide/svelte";
    import { getContactFilterGroups } from "#lib/filters/index.js";
    import ContactForm from "#lib/components/contacts/ContactForm.svelte";
    import { listContacts } from "../../contacts/list.remote";
    import { fetchEntityContacts, addAssociation, removeAssociation } from "../../contacts/associate.remote";
    import { deleteContact } from "../../contacts/[id]/delete.remote";
    import { createContact } from "../../contacts/new/create.remote";
    import { updateContact } from "../../contacts/[id]/update.remote";
    import { readContact } from "../../contacts/[id]/read.remote";
    import { createContactSchema, updateContactSchema, updateLocationSchema } from "@ac/validations";
    import EventContactRoleSelector from "#lib/components/events/EventContactRoleSelector.svelte";
    import EventRoleManagerModal from "#lib/components/events/EventRoleManagerModal.svelte";

    const locationId = $derived(page.params.id || "");
    let isRoleManagerOpen = $state(false);
</script>

{#snippet contactLabel(item: any)}
    <div class="flex flex-col">
        <span class="font-medium">
            {item.displayName || `${item.givenName || ""} ${item.familyName || ""}`.trim() || item.company || m.unnamed_contact()}
        </span>
        <span class="text-xs text-gray-500">
            {item.emails?.[0]?.value || ""}
        </span>
    </div>
{/snippet}

{#snippet contactForm({
    remoteFunction,
    schema,
    initialData,
    onSuccess,
    onCancel,
}: any)}
    <ContactForm
        {remoteFunction}
        {schema}
        {initialData}
        {onSuccess}
        {onCancel}
    />
{/snippet}

<LocationDetailView
    {locationId}
    readLocationRemote={readLocation}
    updateLocationRemote={updateLocation}
    deleteLocationRemote={deleteLocation}
    validationSchema={updateLocationSchema}
    cancelHref="/locations"
    {m}
>
    {#snippet breadcrumb({ location }: any)}
        <Breadcrumb feature="locations" current={location.name} />
    {/snippet}

    {#snippet children({ location }: any)}
        <div class="mt-8 pt-8 border-t border-gray-100">
            <EntityManager {m}
                title={m.feature_contacts_title()}
                icon={User}
                type="location"
                entityId={location.id}
                filters={getContactFilterGroups(m)}
                listItemsRemote={listContacts as any}
                fetchAssociationsRemote={fetchEntityContacts as any}
                addAssociationRemote={async (p: any) =>
                    addAssociation({ ...p, contactId: p.itemId } as any)}
                removeAssociationRemote={async (p: any) =>
                    removeAssociation({ ...p, contactId: p.itemId } as any)}
                deleteItemRemote={async (ids: string[]) => {
                    return await handleDelete({
                        ids,
                        deleteFn: deleteContact,
                        itemName: m.contact_label().toLowerCase(),
                    });
                }}
                createRemote={createContact}
                createSchema={createContactSchema}
                updateRemote={updateContact}
                updateSchema={updateContactSchema}
                readItemRemote={readContact}
                renderItemLabel={contactLabel}
                searchPredicate={matchContactSearch}
                renderForm={contactForm}
                loadingLabel={m.loading_item({ item: m.feature_contacts_title() })}
                noItemsLabel={m.no_items_associated_label({
                    item: m.feature_contacts_title(),
                })}
                noItemsFoundLabel={m.no_items_found({
                    item: m.feature_contacts_title(),
                })}
                searchPlaceholder={m.search_placeholder({
                    item: m.feature_contacts_title(),
                })}
                linkItemLabel={m.link_item_label({
                    item: m.feature_contacts_title(),
                })}
                associatedItemLabel={m.associated_item_label({
                    item: m.feature_contacts_title(),
                })}
                quickCreateLabel={m.quick_create()}
                closeSearchLabel={m.close_search()}
                editLabel={m.edit()}
                deleteLabel={m.delete()}
                unlinkLabel={m.unlink()}
                deleteForeverLabel={m.delete_forever({ item: m.contact() })}
                bulkDeleteLabel={m.delete_selected({ count: 0 })}
                selectAllLabel={m.select_all()}
                deselectAllLabel={m.deselect_all()}
                confirmUnlinkLabel={m.confirm_unlink_label({ item: m.contact() })}
            >
                {#snippet rolesSnippet(contact: any)}
                    <EventContactRoleSelector
                        {contact}
                        entityType="location"
                        entityId={location.id}
                        onopenManager={() => (isRoleManagerOpen = true)}
                    />
                {/snippet}
            </EntityManager>
        </div>
    {/snippet}
</LocationDetailView>

<EventRoleManagerModal
    bind:open={isRoleManagerOpen}
/>
