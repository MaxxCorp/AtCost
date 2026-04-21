<script lang="ts">
    import { page } from "$app/state";
    import * as m from "$lib/paraglide/messages";
    import { goto } from "$app/navigation";
    import { readUser } from "./read.remote";
    import { updateUser } from "./update.remote";
    import { deleteUser } from "./delete.remote";
    import { updateUserSchema } from "$lib/validations/users";

    import { UserForm, EntityManager, ErrorSection, LoadingSection, AsyncButton, handleDelete } from "@ac/ui";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import { FEATURES } from "$lib/features";

    import { listContacts } from "../../contacts/list.remote";
    import { addAssociation, removeAssociation, fetchEntityContacts } from "../../contacts/associate.remote";
    import { createContact } from "../../contacts/new/create.remote";
    import { updateContact } from "../../contacts/[id]/update.remote";
    import { createContactSchema, updateContactSchema } from "$lib/validations/contacts";
    import { deleteContact } from "../../contacts/[id]/delete.remote";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import { User as UserIcon } from "@lucide/svelte";
    import { parseRoles } from "$lib/authorization";
    import { browser } from "$app/environment";
    import { authClient } from "$lib/auth";

    const userId = $derived(page.params.id || "");

    const appConfigList = [
        {
            namespace: "multiposter",
            name: "Multiposter App",
            features: FEATURES as any[]
        }
    ];

    let dataPromise = $derived(Promise.all([readUser(userId), authClient.getSession()]));
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
        {#key userId}
            {#if browser}
                {#await dataPromise}
                    <LoadingSection message={m.loading_user()} />
                {:then [user, session]}
                {#if user}
                    <Breadcrumb feature="users" current={user.name} />
                    <div class="bg-white shadow rounded-lg p-6 space-y-4">
                        <div class="flex justify-between items-start mb-6">
                            <div>
                                <h1 class="text-3xl font-bold mb-2">
                                    {user.name}
                                </h1>
                                <p class="text-gray-500">{user.email}</p>
                            </div>
                            <div class="flex gap-2">
                                <AsyncButton
                                    type="button"
                                    loadingLabel={m.deleting()}
                                    loading={deleteUser.pending}
                                    variant="destructive"
                                    onclick={async () => {
                                        const confirmed = await handleDelete({
                                            ids: [user.id],
                                            deleteFn: async (ids: string[]) => deleteUser(ids),
                                            itemName: m.users(),
                                        });
                                        if (confirmed) {
                                            goto("/users");
                                        }
                                    }}
                                >
                                    {m.delete()}
                                </AsyncButton>
                            </div>
                        </div>

                        <h2 class="text-xl font-semibold mb-4">{m.edit_user()}</h2>
                        <UserForm
                            remoteFunction={updateUser}
                            validationSchema={updateUserSchema}
                            isUpdating={true}
                            initialData={user}
                            {m}
                            {appConfigList}
                            canEditRoles={session?.data?.user ? parseRoles(session.data.user).includes("admin") : false}
                            onSuccess={() => goto("/users")}
                            onCancel={() => goto("/users")}
                        >
                        {#snippet extraEntities(data: any)}
                            <EntityManager
                                title={m.feature_contacts_title()}
                                icon={UserIcon}
                                mode="embedded"
                                type="user"
                                entityId={data.id}
                                listItemsRemote={listContacts as any}
                                fetchAssociationsRemote={fetchEntityContacts as any}
                                addAssociationRemote={async (p: any) =>
                                    addAssociation({ ...p, contactId: p.itemId } as any)}
                                removeAssociationRemote={async (p: any) =>
                                    removeAssociation({ ...p, contactId: p.itemId } as any)}
                                deleteItemRemote={async (ids: string[]) => {
                                    return await handleDelete({
                                        ids: ids,
                                        deleteFn: async (ids: string[]) => deleteContact(ids),
                                        itemName: m.feature_contacts_title(),
                                    });
                                }}
                                createRemote={createContact}
                                createSchema={createContactSchema}
                                updateRemote={updateContact}
                                updateSchema={updateContactSchema}
                                getFormData={(c: any) => ({
                                    contact: c,
                                    emails: c.emails,
                                    phones: c.phones,
                                    addresses: c.addresses,
                                    relations: c.relations,
                                    tags: c.tags,
                                })}
                                searchPredicate={(c: any, q: string) => {
                                    const name = (
                                        c.displayName ||
                                        `${c.givenName || ""} ${c.familyName || ""}`
                                    ).toLowerCase();
                                    return name.includes(q.toLowerCase());
                                }}
                                    loadingLabel={m.loading_item({ item: m.feature_contacts_title() })}
                                    noItemsFoundLabel={m.no_items_found({ item: m.feature_contacts_title() })}
                                    searchPlaceholder={m.search_placeholder({ item: m.feature_contacts_title() })}
                                    linkItemLabel={m.link_item_label({ item: m.feature_contacts_title() })}
                                    associatedItemLabel={m.associated_item_label({ item: m.feature_contacts_title() })}
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
                                    noItemsLabel={m.no_items_associated_label({ item: m.feature_contacts_title() })}
                                >
                                {#snippet renderItemLabel(contact: any)}
                                    {contact.displayName ||
                                        `${contact.givenName || ""} ${contact.familyName || ""}`}
                                {/snippet}
                                {#snippet renderForm(props: any)}
                                    <ContactForm
                                        remoteFunction={props.remoteFunction}
                                        schema={props.schema}
                                        initialData={props.initialData}
                                        onSuccess={props.onSuccess}
                                        onCancel={props.onCancel}
                                        contactId={props.id}
                                    />
                                {/snippet}
                            </EntityManager>
                        {/snippet}
                    </UserForm>
                </div>
            {:else}
                <ErrorSection
                    headline={m.user_not_found()}
                    message={m.user_not_found_message()}
                    href="/users"
                    button={m.back_to_users()}
                />
            {/if}
            {:catch error}
                <ErrorSection
                    headline="Error"
                    message={error instanceof Error
                        ? error.message
                        : m.failed_to_load_user()}
                    href="/users"
                    button={m.back_to_users()}
                />
            {/await}
            {:else}
                <LoadingSection message={m.loading_user()} />
            {/if}
        {/key}
    </div>
</div>
