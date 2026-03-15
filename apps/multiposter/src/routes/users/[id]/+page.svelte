<script lang="ts">
    import { page } from "$app/state";
    import * as m from "$lib/paraglide/messages";
    import { goto } from "$app/navigation";
    import { readUser } from "./read.remote";
    import { updateUser } from "./update.remote";
    import { deleteUser } from "./delete.remote";
    import { updateUserSchema } from "$lib/validations/users";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";

    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import UserForm from "$lib/components/users/UserForm.svelte";

    const userId = page.params.id || "";
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
                                        deleteFn: deleteUser,
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
                    />
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
