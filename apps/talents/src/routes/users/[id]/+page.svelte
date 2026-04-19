<script lang="ts">
    import { page } from "$app/state";
    import * as m from "$lib/paraglide/messages";
    import { goto } from "$app/navigation";
    import { readUser } from "./read.remote";
    import { updateUser } from "./update.remote";
    import { deleteUser } from "./delete.remote";
    import { updateUserSchema } from "@ac/validations";

    import { ErrorSection, LoadingSection, AsyncButton, UserForm, handleDelete } from "@ac/ui";
    import { User as UserIcon } from "@lucide/svelte";
    import { parseRoles } from "$lib/authorization";
    import { FEATURES } from "$lib/features";
    import { browser } from "$app/environment";
    import { authClient } from "$lib/auth";

    import { listTalents } from "../../talents/talents.remote";
    import { fetchEntityTalents, addAssociation, removeAssociation } from "../../talents/associate.remote";
    import { upsertTalent } from "../../talents/talents.remote";
    import { unifiedTalentSchema } from "@ac/validations";
    import { EntityManager } from "@ac/ui";
    import TalentForm from "$lib/components/talent/TalentForm.svelte";

    const userId = $derived(page.params.id || "");

    const appConfigList = [
        {
            namespace: "talents",
            name: "Talents App",
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
                    <LoadingSection message="Loading user and session data..." />
                {:then [user, session]}
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
                                            const confirmed = await handleDelete({
                                                ids: [user.id],
                                                deleteFn: async (ids: string[]) => deleteUser(ids),
                                                itemName: "Users",
                                            });
                                            if (confirmed) {
                                                goto("/users");
                                            }
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
                                canEditRoles={session?.data?.user ? parseRoles(session.data.user).includes("admin") : false}
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
                                        createRemote={upsertTalent}
                                        createSchema={unifiedTalentSchema}
                                        updateRemote={upsertTalent}
                                        updateSchema={unifiedTalentSchema}
                                        getFormData={(t: any) => ({
                                            talent: { ...t },
                                            contact: { ...t.contact },
                                            linkedUserId: userId
                                        })}
                                        searchPredicate={(t: any, q: string) => {
                                            const query = q.toLowerCase();
                                            const name = (
                                                t.contact?.displayName ||
                                                `${t.contact?.givenName || ""} ${t.contact?.familyName || ""}`
                                            ).toLowerCase();
                                            const jobTitle = (t.jobTitle || "").toLowerCase();
                                            const email = (t.contact?.emails?.[0]?.value || "").toLowerCase();
                                            
                                            return name.includes(query) || 
                                                jobTitle.includes(query) || 
                                                email.includes(query);
                                        }}
                                    >
                                        {#snippet renderItemLabel(talent: any)}
                                            <div class="flex flex-col">
                                                <span class="font-bold">
                                                    {talent.contact?.displayName ||
                                                        `${talent.contact?.givenName || ""} ${talent.contact?.familyName || ""}`}
                                                </span>
                                                {#if talent.jobTitle}
                                                    <span class="text-xs text-gray-500 font-normal">{talent.jobTitle}</span>
                                                {/if}
                                            </div>
                                        {/snippet}

                                        {#snippet renderForm({ remoteFunction, schema, initialData, onSuccess, onCancel, id }: { remoteFunction: any, schema: any, initialData?: any, onSuccess: (result: any) => void, onCancel: () => void, id?: string })}
                                            <TalentForm
                                                initialData={{
                                                    ...(initialData || {}),
                                                    contact: {
                                                        ...(initialData?.contact || {}),
                                                        linkedUserId: userId
                                                    }
                                                }}
                                                talentId={id}
                                                {remoteFunction}
                                                {onSuccess}
                                                {onCancel}
                                            />
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
        {/key}
    </div>
</div>
