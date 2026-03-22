<script lang="ts">
    import { page } from "$app/state";
    import * as m from "$lib/paraglide/messages";
    import { goto } from "$app/navigation";
    import { updateUser } from "./update.remote";
    import { deleteUser } from "./delete.remote";
    import { updateUserSchema } from "$lib/validations/users";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { ErrorSection, AsyncButton, UserForm, handleDelete } from "@ac/ui";
    import { FEATURES } from "$lib/features";
    import { onMount, untrack } from "svelte";

    let { data } = $props();
    let user = $derived(data.user);
    let error = $derived(data.error);

    onMount(() => {
        if (user) {
            untrack(() => breadcrumbState.set({ feature: "users", current: user.name }));
        }
    });

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
        {#if error}
            <ErrorSection
                headline="Load Error"
                message={error}
                href="/users"
                button="Back to Users"
            />
        {:else if user}
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
                />
            </div>
        {:else}
            <ErrorSection
                headline="User not found"
                message="The user you are trying to edit could not be found."
                href="/users"
                button="Back to Users"
            />
        {/if}
    </div>
</div>
