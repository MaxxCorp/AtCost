<script lang="ts">
    import { listUsers } from "./list.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { onMount } from "svelte";
    import LoadingSection from "@ac/ui/components/LoadingSection.svelte";
    import ErrorSection from "@ac/ui/components/ErrorSection.svelte";
    import EmptyState from "@ac/ui/components/EmptyState.svelte";
    import { parseRoles } from "$lib/authorization";

    breadcrumbState.set({ feature: "users" });

    let users = $state<any[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    onMount(async () => {
        try {
            users = await listUsers();
        } catch (e: any) {
            error = e.message || "Failed to load users";
        } finally {
            loading = false;
        }
    });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Users</h1>
            <p class="text-sm text-gray-500 mt-1">
                Manage system users, roles, and access permissions
            </p>
        </div>
    </div>

    {#if loading}
        <LoadingSection message="Loading users..." />
    {:else if error}
        <ErrorSection headline="Error" message={error} />
    {:else if users.length === 0}
        <EmptyState
            title="No users found"
            description="No system users to display."
            actionLabel="Home"
            actionHref="/"
        />
    {:else}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >Name</th
                            >
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >Email</th
                            >
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >Roles</th
                            >
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >Verified</th
                            >
                            <th
                                class="px-4 py-3 text-left font-medium text-gray-600"
                                >Joined</th
                            >
                            <th
                                class="px-4 py-3 text-right font-medium text-gray-600"
                                >Actions</th
                            >
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        {#each users as u (u.id)}
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-3">
                                        {#if u.image}
                                            <img
                                                src={u.image}
                                                alt={u.name}
                                                class="w-8 h-8 rounded-full object-cover"
                                            />
                                        {:else}
                                            <div
                                                class="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-xs font-semibold text-white"
                                            >
                                                {u.name
                                                    ?.charAt(0)
                                                    .toUpperCase() || "?"}
                                            </div>
                                        {/if}
                                        <span class="font-medium text-gray-900"
                                            >{u.name}</span
                                        >
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-gray-600"
                                    >{u.email}</td
                                >
                                <td class="px-4 py-3">
                                    {#each parseRoles(u) as role}
                                        <span
                                            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 mr-1"
                                        >
                                            {role}
                                        </span>
                                    {/each}
                                </td>
                                <td class="px-4 py-3">
                                    {#if u.emailVerified}
                                        <span class="text-green-600 text-xs"
                                            >✓ Verified</span
                                        >
                                    {:else}
                                        <span class="text-gray-400 text-xs"
                                            >Unverified</span
                                        >
                                    {/if}
                                </td>
                                <td class="px-4 py-3 text-gray-600 text-xs">
                                    {new Date(u.createdAt).toLocaleDateString()}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <a
                                        href="/users/{u.id}"
                                        class="text-rose-600 hover:text-rose-800 font-medium text-sm"
                                    >
                                        Edit
                                    </a>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}
</div>
