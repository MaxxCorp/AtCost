<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { Button, AsyncButton } from "@ac/ui";
    
    import { listUsers } from "./list.remote";
    import { deleteUser } from "./[id]/delete.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { 
        User as UserIcon, 
        Mail, 
        Shield, 
        Calendar as CalendarIcon, 
        Pencil, 
        Trash2,
        Search,
        Filter,
        ChevronDown,
        ChevronRight,
        ArrowLeft,
        ArrowRight,
        ChevronsLeft,
        ChevronsRight,
        X
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    breadcrumbState.set({ feature: "users" });

    type User = Awaited<ReturnType<typeof listUsers>>["data"][number];

    function formatRoles(user: User) {
        const roles = Array.isArray(user.roles) ? user.roles : [];
        if (roles.length === 0) return m.role_user();
        return roles.join(", ");
    }

    let sortField = $state<"updatedAt" | "createdAt" | "name">("updatedAt");
    let sortOrder = $state<"asc" | "desc">("desc");
    let searchQuery = $state("");
    let page = $state(1);
    let limit = $state(50);
    let selectedRole = $state<string | null>(null);

    const filterState = $derived({
        page,
        limit,
        search: searchQuery,
        role: selectedRole || undefined,
        sortField,
        sortOrder,
    });

    const activeFiltersCount = $derived((selectedRole ? 1 : 0));

    async function deleteItem(user: User) {
        if (!window.confirm("Are you sure you want to delete this user?")) return;
        try {
            await deleteUser([user.id]);
            toast.success("User deleted successfully");
            listUsers(filterState).refresh();
        } catch (error: any) {
            toast.error(error?.message || "Something went wrong");
        }
    }
</script>

<div class="container mx-auto px-4 py-8 max-w-5xl">
    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold tracking-tight text-gray-900">{m.users()}</h1>
                <p class="text-gray-500 mt-1">Manage system access, roles, and user profiles.</p>
            </div>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h1 class="text-2xl font-black mb-6 text-gray-900 px-1">{m.users()}</h1>

            <!-- Action Bar -->
            <div class="flex flex-col md:flex-row gap-3 mb-6">
                <div class="relative flex-1">
                    <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder={m.search_users()}
                        bind:value={searchQuery}
                        oninput={() => (page = 1)}
                        class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all bg-gray-50/50"
                    />
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    
    <div class="flex items-center gap-2">
        <select
            bind:value={selectedRole}
            onchange={() => page = 1}
            class="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize"
        >
            <option value={null}>{m.all_roles()}</option>
            <option value="admin">{m.admin()}</option>
            <option value="manager">{m.manager()}</option>
            <option value="user">{m.role_user()}</option>
        </select>
    </div>
    
                </div>
            </div>

            <!-- Main List -->
            <svelte:boundary>
                {#if $effect.pending()}
                    <div class="py-12 text-center text-gray-500">Loading...</div>
                {/if}
                <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {#each (await listUsers(filterState)).data || [] as user (user.id)}
                            <div class="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
                                <div class="flex flex-col sm:flex-row items-start gap-6">
                                    <div class="flex items-center gap-4 shrink-0">
                                        <a href={`/users/${user.id}`} class="shrink-0">
                                            {#if user.image}
                                                <img
                                                    src={user.image}
                                                    alt={user.name}
                                                    class="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md group-hover:scale-105 transition-transform"
                                                />
                                            {:else}
                                                <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center border border-blue-200 shadow-sm group-hover:scale-105 transition-transform">
                                                    <UserIcon size={28} class="text-blue-600" />
                                                </div>
                                            {/if}
                                        </a>
                                    </div>

                                    <div class="flex-1 min-w-0 space-y-3">
                                        <div>
                                            <a href={`/users/${user.id}`} class="text-xl font-black text-gray-900 hover:underline group-hover:text-blue-600 transition-colors truncate block">
                                                {user.name}
                                            </a>
                                            <div class="flex items-center gap-2 text-gray-500 mt-1">
                                                <Mail size={14} class="text-blue-400" />
                                                <span class="text-sm font-medium truncate">{user.email}</span>
                                            </div>
                                        </div>

                                        <div class="flex flex-wrap gap-2">
                                            <div class="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-black uppercase tracking-wider border border-blue-100">
                                                <Shield size={12} />
                                                {formatRoles(user)}
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2">
                                            <CalendarIcon size={12} />
                                            {m.joined_label()} {new Date(user.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div class="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto mt-4 sm:mt-0 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                        <Button
                                            href={`/users/${user.id}`}
                                            variant="ghost"
                                            class="flex-1 sm:flex-none justify-start px-4 h-10 hover:bg-blue-50 hover:text-blue-600 rounded-xl"
                                        >
                                            <Pencil size={16} class="mr-2" />
                                            {m.edit()}
                                        </Button>
                                        <AsyncButton
                                            onclick={() => deleteItem(user)}
                                            variant="ghost"
                                            class="flex-1 sm:flex-none justify-start px-4 h-10 hover:bg-red-50 hover:text-red-600 rounded-xl"
                                        >
                                            <Trash2 size={16} class="mr-2" />
                                            {m.delete()}
                                        </AsyncButton>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="text-center py-12 bg-white rounded-xl border border-gray-100 col-span-full">
                                <UserIcon class="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <h3 class="text-lg font-medium text-gray-900">
                                    No users found
                                </h3>
                            </div>
                        {/each}
                    </div>

                    <!-- Pagination -->
                    {#await listUsers(filterState) then result}
                        {#if result && result.total > limit}
                            {@const totalPages = Math.ceil(result.total / limit)}
                            <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100">
                                <div class="flex items-center gap-3 text-sm text-gray-500">
                                    <span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, result.total)} of {result.total}</span>
                                    <div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                        <select
                                            bind:value={limit}
                                            onchange={() => (page = 1)}
                                            class="text-xs bg-transparent border-gray-200 rounded-md py-1 pl-2 pr-6 text-gray-500 cursor-pointer focus:ring-0"
                                        >
                                            <option value={10}>{m.items_per_page({ count: 10 })}</option>
                                            <option value={20}>{m.items_per_page({ count: 20 })}</option>
                                            <option value={50}>{m.items_per_page({ count: 50 })}</option>
                                            <option value={100}>{m.items_per_page({ count: 100 })}</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1 sm:gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={page === 1}
                                        onclick={() => page = 1}
                                        class="h-9 w-9 border-gray-200 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
                                    >
                                        <ChevronsLeft size={16} />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 1}
                                        onclick={() => page > 1 && page--}
                                        class="h-9 px-3 border-gray-200 shrink-0"
                                    >
                                        <ArrowLeft size={16} class="mr-1.5 hidden sm:block" />
                                        Previous
                                    </Button>
                                    <div class="flex items-center gap-1 px-1 sm:px-2 font-medium text-sm text-gray-700">
                                        <select
                                            bind:value={page}
                                            class="text-sm bg-transparent border-none font-medium p-0 focus:ring-0 text-center cursor-pointer hover:bg-gray-50 rounded px-1 min-w-[2.5rem]"
                                        >
                                            {#each Array(totalPages) as _, i}
                                                <option value={i + 1}>{i + 1}</option>
                                            {/each}
                                        </select>
                                        <span class="text-gray-400">/ {totalPages}</span>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === totalPages}
                                        onclick={() => page < totalPages && page++}
                                        class="h-9 px-3 border-gray-200 shrink-0"
                                    >
                                        Next
                                        <ArrowRight size={16} class="ml-1.5 hidden sm:block" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={page === totalPages}
                                        onclick={() => page = totalPages}
                                        class="h-9 w-9 border-gray-200 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
                                    >
                                        <ChevronsRight size={16} />
                                    </Button>
                                </div>
                            </div>
                        {/if}
                    {/await}
                </div>
                {#snippet failed(error: unknown)}
                    <div class="py-12 text-center text-red-500">{error instanceof Error ? error.message : "Failed to load."}</div>
                {/snippet}
            </svelte:boundary>
        </div>
    </div>
</div>
