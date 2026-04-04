<script lang="ts">
    import { page } from "$app/state";
    import * as m from "$lib/paraglide/messages";
    import { goto } from "$app/navigation";
    import { readUser } from "./read.remote";
    import { updateUser } from "./update.remote";
    import { deleteUser } from "./delete.remote";
    import { updateUserSchema } from "$lib/validations/users";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { ErrorSection, LoadingSection, AsyncButton, UserForm, handleDelete } from "@ac/ui";
    import { FEATURES } from "$lib/features";
    import { browser } from "$app/environment";
    import { User as UserIcon } from "@lucide/svelte";

    import { listTalents } from "../../talents/talents.remote";
    import { fetchEntityTalents, addAssociation, removeAssociation } from "../../talents/associate.remote";
    import { createTalent, updateTalent } from "../../talents/talents.remote";
    import { createTalentSchema, updateTalentSchema } from "@ac/validations";
    import { EntityManager } from "@ac/ui";

    const userId = page.params.id || "";

    const appConfigList = [
        {
            namespace: "talents",
            name: "Talents App",
            features: FEATURES as any[]
        }
    ];
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
        {#if browser}
            {#await readUser(userId)}
                <LoadingSection message="Loading user..." />
            {:then user}
            {#if user}
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
                                loadingLabel="Deleting..."
                                loading={deleteUser.pending}
                                variant="destructive"
                                onclick={async () => {
                                    await handleDelete({
                                        ids: [user.id],
                                        deleteFn: async (ids: string[]) => deleteUser(ids),
                                        itemName: "Users",
                                    });
                                    goto("/users");
                                }}
                            >
                                Delete
                            </AsyncButton>
                        </div>
                    </div>

                    <h2 class="text-xl font-semibold mb-4">Edit User</h2>
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
                                title="Associated Talents"
                                icon={UserIcon}
                                type="user"
                                entityId={data.id}
                                listItemsRemote={listTalents as any}
                                fetchAssociationsRemote={fetchEntityTalents as any}
                                addAssociationRemote={async (p: any) =>
                                    addAssociation({ ...p, talentId: p.itemId } as any)}
                                removeAssociationRemote={async (p: any) =>
                                    removeAssociation({ ...p, talentId: p.itemId } as any)}
                                createRemote={createTalent}
                                createSchema={createTalentSchema}
                                updateRemote={updateTalent}
                                updateSchema={updateTalentSchema}
                                getFormData={(t: any) => ({
                                    ...t,
                                    id: t.id,
                                })}
                                searchPredicate={(t: any, q: string) => {
                                    const name = (
                                        t.contact?.displayName ||
                                        `${t.contact?.givenName || ""} ${t.contact?.familyName || ""}`
                                    ).toLowerCase();
                                    return name.includes(q.toLowerCase());
                                }}
                            >
                                {#snippet renderItemLabel(talent: any)}
                                    {talent.contact?.displayName ||
                                        `${talent.contact?.givenName || ""} ${talent.contact?.familyName || ""}`}
                                {/snippet}
                            </EntityManager>
                        {/snippet}
                    </UserForm>
                </div>
            {:else}
                <ErrorSection
                    headline="User not found"
                    message="The user you are trying to edit could not be found."
                    href="/users"
                    button="Back to Users"
                />
            {/if}
        {:catch error}
            <ErrorSection
                headline="Error"
                message={error instanceof Error
                    ? error.message
                    : "Failed to load user"}
                href="/users"
                button="Back to Users"
            />
            {/await}
        {:else}
            <LoadingSection message="Loading user..." />
        {/if}
    </div>
</div>
