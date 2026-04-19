<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { EntityManager, Button, AsyncButton } from "@ac/ui";
    import { listUsers } from "./list.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { User as UserIcon, Mail, Shield, Calendar as CalendarIcon, Pencil, Trash2 } from "@lucide/svelte";

    breadcrumbState.set({ feature: "users" });

    type User = Awaited<ReturnType<typeof listUsers>>["data"][number];

    function formatRoles(user: User) {
        const roles = Array.isArray(user.roles) ? user.roles : [];
        if (roles.length === 0) return m.role_user();
        return roles.join(", ");
    }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-5xl mx-auto space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold tracking-tight text-gray-900">{m.users()}</h1>
                <p class="text-gray-500 mt-1">Manage system access, roles, and user profiles.</p>
            </div>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <EntityManager
                title={m.users()}
                icon={UserIcon}
                mode="standalone"
                listItemsRemote={listUsers as any}
                loadingLabel="Synchronizing users..."
                noItemsFoundLabel="No users found."
                searchPredicate={(user: User, q: string) => 
                    user.name.toLowerCase().includes(q.toLowerCase()) ||
                    user.email.toLowerCase().includes(q.toLowerCase())
                }
            >
                {#snippet renderListItem(user: User, { isSelected, toggleSelection, deleteItem })}
                    <div class="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
                        <div class="flex flex-col sm:flex-row items-start gap-6">
                            <div class="flex items-center gap-4 shrink-0">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onchange={() => toggleSelection(user.id)}
                                    class="w-5 h-5 text-blue-600 rounded-lg border-gray-300 focus:ring-blue-500"
                                />
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
                            </div>

                            <div class="flex-1 min-w-0 space-y-3">
                                <div>
                                    <h2 class="text-xl font-black text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                        {user.name}
                                    </h2>
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
                {/snippet}
            </EntityManager>
        </div>
    </div>
</div>
