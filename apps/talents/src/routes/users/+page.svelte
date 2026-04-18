<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { UserList } from "@ac/ui";
    import { listUsers } from "./list.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { onMount } from "svelte";

    const rf = listUsers();

    onMount(() => {
        breadcrumbState.set({ feature: "users" });
    });
</script>

<h1>{m.users()}</h1>

{#await rf}
    <div class="flex justify-center p-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
    </div>
{:then items}
    <UserList 
        {items} 
        onRefresh={() => rf.refresh()} 
        deleteUserFn={async (ids) => {
            console.log('Delete users:', ids);
            // We can implement actual deletion later
            return true;
        }} 
        {m} 
    />
{:catch error}
    <div class="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
        Error loading users: {error.message}
    </div>
{/await}
