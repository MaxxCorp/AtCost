<script lang="ts">
    import { listUsers } from "./list.remote";
    import * as m from "$lib/paraglide/messages";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import { LoadingSection, ErrorSection, UserList } from "@ac/ui";
    import { deleteUser } from "./[id]/delete.remote";

    let itemsPromise = $state(listUsers());

    function refresh() {
        itemsPromise = listUsers();
    }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <Breadcrumb feature="users" />

        {#await itemsPromise}
            <LoadingSection message={m.loading_users()} />
        {:then items}
            <UserList {items} onRefresh={refresh} deleteUserFn={async (id) => await deleteUser(id)} {m} />
        {:catch error}
            <ErrorSection
                headline={m.failed_to_load_users()}
                message={error?.message || m.something_went_wrong()}
                href="/users"
                button={m.retry()}
            />
        {/await}
    </div>
</div>
