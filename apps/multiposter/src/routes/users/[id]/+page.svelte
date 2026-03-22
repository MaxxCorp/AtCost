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
    import { createNewContact } from "../../contacts/new/create.remote";
    import { updateExistingContact } from "../../contacts/[id]/update.remote";
    import { createContactSchema, updateContactSchema } from "$lib/validations/contacts";
    import { deleteExistingContact } from "../../contacts/[id]/delete.remote";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import { User as UserIcon } from "@lucide/svelte";

    const userId = page.params.id || "";

    const appConfigList = [
        {
            namespace: "multiposter",
            name: "Multiposter App",
            features: FEATURES as any[]
        }
    ];
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
        {#await readUser(userId)}
            <LoadingSection message={m.loading_user()} />
        {:then user}
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
                                    await handleDelete({
                                        ids: [user.id],
                                        deleteFn: async (ids: string[]) => deleteUser(ids),
                                        itemName: m.users(),
                                    });
                                    goto("/users");
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
                        onSuccess={() => goto("/users")}
                        onCancel={() => goto("/users")}
                    >
                        {#snippet extraEntities(data: any)}
                            <EntityManager
                                title={m.feature_contacts_title()}
                                icon={UserIcon}
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
                                        deleteFn: async (ids: string[]) => deleteExistingContact(ids),
                                        itemName: m.feature_contacts_title(),
                                    });
                                }}
                                createRemote={createNewContact}
                                createSchema={createContactSchema}
                                updateRemote={updateExistingContact}
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
                                        onSuccess={props.onSuccess as any}
                                        onCancel={props.onCancel as any}
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
    </div>
</div>
