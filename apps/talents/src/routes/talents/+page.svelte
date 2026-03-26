<script lang="ts">
    import { 
        User, 
        UserPlus as UserPlusIcon, 
        Search, 
        Filter, 
        Edit2, 
        Trash2, 
        MoreVertical, 
        ExternalLink,
        CheckCircle2,
        Clock,
        Archive
    } from "@lucide/svelte";
    import { listTalents, deleteTalent, bulkDeleteTalents } from "./talents.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { LoadingSection, AsyncButton } from "@ac/ui";
    import { toast } from "svelte-sonner";

    breadcrumbState.set({ feature: "talents" });

    let talentsPromise = $state(listTalents());
    let searchQuery = $state("");
    let selectedIds = $state<string[]>([]);

    function getFilteredTalents(talents: any[]) {
        const query = searchQuery.toLowerCase();
        return talents.filter((t: any) =>
            t.contact?.displayName?.toLowerCase().includes(query) ||
            t.jobTitle?.toLowerCase().includes(query) ||
            t.contact?.emails?.[0]?.value?.toLowerCase().includes(query)
        );
    }

    function toggleSelectAll(talents: any[]) {
        const filtered = getFilteredTalents(talents);
        if (selectedIds.length === filtered.length) {
            selectedIds = [];
        } else {
            selectedIds = filtered.map((t: any) => t.id);
        }
    }

    function toggleSelect(id: string) {
        if (selectedIds.includes(id)) {
            selectedIds = selectedIds.filter(i => i !== id);
        } else {
            selectedIds = [...selectedIds, id];
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this talent?")) return;
        try {
            await (deleteTalent as any)(id);
            toast.success("Talent deleted");
            talentsPromise = listTalents();
        } catch (e: any) {
            toast.error(e.message || "Failed to delete");
        }
    }

    async function handleBulkDelete() {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} talents?`)) return;
        try {
            await (bulkDeleteTalents as any)(selectedIds);
            selectedIds = [];
            toast.success("Talents deleted");
            talentsPromise = listTalents();
        } catch (e: any) {
            toast.error(e.message || "Bulk delete failed");
        }
    }

    function getStats(talents: any[]) {
        return {
            total: talents.length,
            applicants: talents.filter((t: any) => t.status === 'applicant').length,
            active: talents.filter((t: any) => t.status === 'active').length,
        };
    }
</script>

<div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
            <h1 class="text-4xl font-black text-gray-900 tracking-tight">Talents</h1>
            <p class="text-gray-500 mt-1 font-medium italic">
                Strategic recruitment pipeline and professional network
            </p>
        </div>
        <div class="flex gap-3">
            <a 
                href="/talents/new" 
                class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md font-bold text-sm"
            >
                <UserPlusIcon size={18} />
                Register New Talent
            </a>
        </div>
    </div>

    {#await talentsPromise}
        <LoadingSection />
    {:then talents}
        {@const filteredTalents = getFilteredTalents(talents)}
        {@const stats = getStats(talents)}

        <!-- Stats Summary -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Pipeline</p>
                <p class="text-3xl font-black text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div class="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-sm">
                <p class="text-xs font-bold text-indigo-400 uppercase tracking-widest">Active Applicants</p>
                <p class="text-3xl font-black text-indigo-600 mt-1">{stats.applicants}</p>
            </div>
            <div class="bg-green-50/50 p-4 rounded-2xl border border-green-100 shadow-sm">
                <p class="text-xs font-bold text-green-400 uppercase tracking-widest">Active Talents</p>
                <p class="text-3xl font-black text-green-600 mt-1">{stats.active}</p>
            </div>
        </div>

        <!-- Toolbar -->
        <div class="flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div class="relative w-full md:w-96">
                <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search by name, title or email..." 
                    bind:value={searchQuery}
                    class="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm"
                />
            </div>
            
            {#if selectedIds.length > 0}
                <div class="flex items-center gap-3 animate-in fade-in slide-in-from-right-2">
                    <span class="text-sm font-bold text-gray-500">{selectedIds.length} selected</span>
                    <AsyncButton 
                        variant="ghost" 
                        class="text-red-600 border border-red-100 bg-red-50 hover:bg-red-100 px-4"
                        onclick={handleBulkDelete}
                    >
                        <Trash2 size={16} class="mr-2" />
                        Delete Selected
                    </AsyncButton>
                </div>
            {/if}
        </div>

        <!-- Table -->
        {#if filteredTalents.length > 0}
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-gray-50/50 border-b border-gray-100">
                            <th class="p-4 w-10">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.length === filteredTalents.length && filteredTalents.length > 0}
                                    onchange={() => toggleSelectAll(talents)}
                                    class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </th>
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase">Talent / Professional</th>
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase">Linked Account</th>
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase">Target Role</th>
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase">Last Activity</th>
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                        {#each filteredTalents as talent (talent.id)}
                            <tr class="hover:bg-gray-50/50 transition-colors group">
                                <td class="p-4">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.includes(talent.id)}
                                        onchange={() => toggleSelect(talent.id)}
                                        class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </td>
                                <td class="p-4">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                            {talent.contact?.displayName?.charAt(0) || "U"}
                                        </div>
                                        <div>
                                            <a href="/talents/{talent.id}" class="font-bold text-gray-900 hover:text-indigo-600 transition-colors">
                                                {talent.contact?.displayName}
                                            </a>
                                            <p class="text-xs text-gray-500">{talent.contact?.emails?.[0]?.value || "No email"}</p>
                                        </div>
                                    </div>
                                </td>
                                <td class="p-4">
                                    {#if talent.linkedUser}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/50 text-indigo-700 text-[10px] font-bold tracking-widest border border-indigo-100" title={talent.linkedUser.email}>
                                            <User size={10} /> {talent.linkedUser.name}
                                        </span>
                                    {:else}
                                        <span class="text-xs text-gray-400">—</span>
                                    {/if}
                                </td>
                                <td class="p-4">
                                    <span class="text-sm font-medium text-gray-700">{talent.jobTitle || "—"}</span>
                                </td>
                                <td class="p-4">
                                    {#if talent.status === 'active'}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-wider border border-green-100">
                                            <CheckCircle2 size={10} /> Active
                                        </span>
                                    {:else if talent.status === 'applicant'}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                                            <Clock size={10} /> Applicant
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 text-[10px] font-bold uppercase tracking-wider border border-gray-100">
                                            <Archive size={10} /> Inactive
                                        </span>
                                    {/if}
                                </td>
                                <td class="p-4">
                                    <p class="text-xs text-gray-500">
                                        {talent.timelineEntries?.[0] ? `Last: ${talent.timelineEntries[0].type}` : "No history"}
                                    </p>
                                </td>
                                <td class="p-4 text-right">
                                    <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a 
                                            href="/talents/{talent.id}" 
                                            class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                            title="Edit"
                                        >
                                            <Edit2 size={16} />
                                        </a>
                                        <button 
                                            onclick={() => handleDelete(talent.id)}
                                            class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {:else}
            <div class="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                <div class="w-16 h-16 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center mx-auto mb-4">
                    <User size={32} class="text-gray-300" />
                </div>
                <h2 class="text-xl font-bold text-gray-900">No talents found</h2>
                <p class="text-gray-500 mt-2 max-w-xs mx-auto">
                    {searchQuery ? `No results for "${searchQuery}". Try a different term.` : "Your talent pipeline is empty. Start by registering your first talent."}
                </p>
                <a href="/talents/new" class="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold text-sm shadow-sm">
                    <UserPlusIcon size={18} />
                    Register New Talent
                </a>
            </div>
        {/if}
    {:catch error}
        <div class="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            Error loading talents: {error.message}
        </div>
    {/await}
</div>
