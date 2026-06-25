<script lang="ts">
    import * as m from "$lib/paraglide/messages.js";
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
        Archive,
        ChevronDown,
        ChevronRight,
        ArrowLeft,
        ArrowRight,
        ChevronsLeft,
        ChevronsRight,
        X,
        MapPin,
        Tag
    } from "@lucide/svelte";
    import { listTalents } from "./list.remote";
    import { deleteTalent } from "./[id]/delete.remote";
    import { bulkDeleteTalents, listTags } from "./talents.remote";
    import { listLocations } from "../locations/list.remote";
    import { toast } from "svelte-sonner";
    import { Button, AsyncButton } from "@ac/ui";
    
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { onMount } from "svelte";

    breadcrumbState.set({ feature: "talents" });

    type Talent = Awaited<ReturnType<typeof listTalents>>["data"][number];

    let stats = $state({ total: 0, applicants: 0, active: 0 });

    let sortField = $state<"updatedAt" | "createdAt" | "name">("updatedAt");
    let sortOrder = $state<"asc" | "desc">("desc");
    let searchQuery = $state("");
    let page = $state(1);
    let limit = $state(50);
    let selectedLocationId = $state<string | null>(null);
    let selectedTagId = $state<string | null>(null);
    let selectedStatus = $state<string | null>(null);

    const filterState = $derived({
        page,
        limit,
        search: searchQuery,
        locationId: selectedLocationId || undefined,
        tagId: selectedTagId || undefined,
        status: selectedStatus || undefined,
        sortField,
        sortOrder,
    });

    const activeFiltersCount = $derived((selectedLocationId ? 1 : 0) + (selectedTagId ? 1 : 0) + (selectedStatus ? 1 : 0));

    const allLocationsQuery = listLocations({ limit: 1000 });
    const allTagsQuery = listTags({ limit: 1000 });

    async function deleteItem(talent: Talent) {
        if (!window.confirm("Are you sure you want to delete this talent?")) return;
        try {
            await deleteTalent(talent.id);
            toast.success("Talent deleted successfully");
            listTalents(filterState).refresh();
        } catch (error: any) {
            toast.error(error?.message || "Something went wrong");
        }
    }

</script>

<div class="space-y-6 container mx-auto px-4 py-8 max-w-5xl">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
            <h1 class="text-4xl font-black text-gray-900 tracking-tight">Talents</h1>
            <p class="text-gray-500 mt-1 font-medium italic">
                Strategic recruitment pipeline and professional network
            </p>
        </div>
        <Button href="/talents/new" class="w-full md:w-auto shadow-sm">
            <UserPlusIcon class="w-4 h-4 mr-2" />
            Create Talent
        </Button>
    </div>

    <!-- Action Bar -->
    <div class="flex flex-col md:flex-row gap-3 mb-6">
        <div class="relative flex-1">
            <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                type="text"
                placeholder={m.search_talents()}
                bind:value={searchQuery}
                oninput={() => (page = 1)}
                class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all bg-gray-50/50"
            />
        </div>
        <div class="flex items-center gap-2 shrink-0">
            
    <div class="flex items-center gap-2">
        <select
            bind:value={selectedLocationId}
            onchange={() => page = 1}
            class="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white max-w-[120px]"
        >
            <option value={null}>{m.all_locations()}</option>
            {#await allLocationsQuery then locations}
                {#each locations.data as loc}
                    <option value={loc.id}>{loc.name}</option>
                {/each}
            {/await}
        </select>

        <select
            bind:value={selectedTagId}
            onchange={() => page = 1}
            class="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white max-w-[120px]"
        >
            <option value={null}>{m.all_tags()}</option>
            {#await allTagsQuery then tags}
                {#each tags.data as tag}
                    <option value={tag.id}>{tag.name}</option>
                {/each}
            {/await}
        </select>

        <select
            bind:value={selectedStatus}
            onchange={() => page = 1}
            class="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white max-w-[120px] capitalize"
        >
            <option value={null}>{m.all_statuses()}</option>
            <option value="active">{m.status_active()}</option>
            <option value="applicant">{m.status_applicant()}</option>
            <option value="inactive">{m.status_inactive()}</option>
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
            <div class="grid grid-cols-1 gap-5">
                {#each (await listTalents(filterState)).data || [] as talent (talent.id)}
                    <div class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-6 transition-all hover:shadow-lg hover:border-indigo-100 group">
                        <div class="flex items-center gap-4 flex-1 w-full">
                            
                            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg border border-indigo-200 shrink-0">
                                {talent.contact?.displayName?.charAt(0) || "U"}
                            </div>

                            <div class="flex-1 min-w-0">
                                <div class="flex flex-wrap items-center gap-2 mb-1">
                                    <a href="/talents/{talent.id}" class="font-black text-gray-900 hover:text-indigo-600 transition-colors text-lg truncate block">
                                        {talent.contact?.displayName}
                                    </a>
                                    
                                    {#if talent.status === 'active'}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-wider border border-green-100">
                                            <CheckCircle2 size={10} /> Active
                                        </span>
                                    {:else if talent.status === 'applicant'}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                                            <Clock size={10} /> Applicant
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 text-[10px] font-bold uppercase tracking-wider border border-gray-100">
                                            <Archive size={10} /> Inactive
                                        </span>
                                    {/if}
                                </div>
                                
                                <p class="text-sm font-bold text-indigo-600 italic mb-1">{talent.jobTitle || "Professional Talent"}</p>
                                <p class="text-xs text-gray-400 font-medium">{talent.contact?.emails?.[0]?.value || "No contact email provided"}</p>
                            </div>
                        </div>

                        <div class="flex flex-wrap md:flex-nowrap items-center gap-4 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-gray-50">
                            <div class="flex-1 md:flex-initial">
                                {#if talent.linkedUser}
                                    <div class="flex flex-col">
                                        <span class="text-[10px] uppercase font-black text-gray-300 tracking-tighter mb-0.5">Linked Account</span>
                                        <span class="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600">
                                            <User size={12} class="text-indigo-400" /> {talent.linkedUser.name}
                                        </span>
                                    </div>
                                {:else}
                                    <span class="text-[10px] uppercase font-black text-gray-200 tracking-tighter">No Account Link</span>
                                {/if}
                            </div>

                            <div class="flex gap-2">
                                <Button 
                                    href="/talents/{talent.id}" 
                                    variant="ghost"
                                    class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                    title="Edit Profile"
                                >
                                    <Edit2 size={18} />
                                </Button>
                                <AsyncButton 
                                    variant="ghost"
                                    class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    onclick={() => deleteItem(talent)}
                                    title="Remove Talent"
                                >
                                    <Trash2 size={18} />
                                </AsyncButton>
                            </div>
                        </div>
                    </div>
                {:else}
                    <div class="text-center py-12 bg-white rounded-xl border border-gray-100">
                        <User class="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 class="text-lg font-medium text-gray-900">
                            No talents found
                        </h3>
                    </div>
                {/each}
            </div>

            <!-- Pagination -->
            {#await listTalents(filterState) then result}
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
