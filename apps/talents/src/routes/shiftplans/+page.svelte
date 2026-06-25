<script lang="ts">
    import * as m from "$lib/paraglide/messages.js";
    import { listShiftplans } from "./list.remote";
    import { deleteShiftplans } from "./[id]/delete.remote";
    import { Button, AsyncButton } from "@ac/ui";
    
    import { listLocations } from "../locations/list.remote";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { 
        Calendar, 
        MapPin, 
        Pencil, 
        Trash2, 
        ChevronRight,
        Search,
        Filter,
        ChevronDown,
        ArrowLeft,
        ArrowRight,
        ChevronsLeft,
        ChevronsRight,
        X,
        Plus
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    breadcrumbState.set({ feature: "shiftplans" });

    type Shiftplan = Awaited<ReturnType<typeof listShiftplans>>["data"][number];

    let sortField = $state<"updatedAt" | "createdAt" | "name">("updatedAt");
    let sortOrder = $state<"asc" | "desc">("desc");
    let searchQuery = $state("");
    let page = $state(1);
    let limit = $state(50);
    let selectedLocationId = $state<string | null>(null);

    const filterState = $derived({
        page,
        limit,
        search: searchQuery,
        locationId: selectedLocationId || undefined,
        sortField,
        sortOrder,
    });

    const activeFiltersCount = $derived((selectedLocationId ? 1 : 0));

    const allLocationsQuery = listLocations({ limit: 1000, sortField: 'name', sortOrder: 'asc' });

    async function deleteItem(plan: Shiftplan) {
        if (!window.confirm("Are you sure you want to delete this shift plan?")) return;
        try {
            await deleteShiftplans([plan.id]);
            toast.success("Shift plan deleted successfully");
            listShiftplans(filterState).refresh();
        } catch (error: any) {
            toast.error(error?.message || "Something went wrong");
        }
    }
</script>

<div class="container mx-auto px-4 py-8 max-w-5xl">
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-3">
                    <Calendar class="text-purple-500" size={32} />
                    Shift Plans
                </h1>
                <p class="text-gray-500 mt-1">Manage schedules, templates, and workdays.</p>
            </div>
            <Button href="/shiftplans/new" class="w-full md:w-auto shadow-sm">
                <Plus class="w-4 h-4 mr-2" />
                Create Shift Plan
            </Button>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h1 class="text-2xl font-black mb-6 text-gray-900 px-1">Shiftplans</h1>

            <!-- Action Bar -->
            <div class="flex flex-col md:flex-row gap-3 mb-6">
                <div class="relative flex-1">
                    <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder={m.search_shift_plans()}
                        bind:value={searchQuery}
                        oninput={() => (page = 1)}
                        class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all bg-gray-50/50"
                    />
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    
    <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500 font-medium">Location:</span>
        <select
            bind:value={selectedLocationId}
            onchange={() => page = 1}
            class="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
        >
            <option value={null}>{m.all_locations()}</option>
            {#await allLocationsQuery then locations}
                {#each locations.data as loc}
                    <option value={loc.id}>{loc.name}</option>
                {/each}
            {/await}
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
                        {#each (await listShiftplans(filterState)).data || [] as plan (plan.id)}
                            <div class="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl hover:border-purple-200 transition-all duration-300">
                                <div class="flex items-start justify-between gap-4 mb-4">
                                    <div class="flex items-center gap-3">
                                        <div class="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl text-purple-600 border border-purple-200 shadow-sm">
                                            <Calendar size={20} />
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                        <Button
                                            href={`/shiftplans/${plan.id}`}
                                            variant="ghost"
                                            size="icon"
                                            class="h-9 w-9 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl"
                                        >
                                            <Pencil size={18} />
                                        </Button>
                                        <AsyncButton
                                            onclick={() => deleteItem(plan)}
                                            variant="ghost"
                                            size="icon"
                                            class="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                                        >
                                            <Trash2 size={18} />
                                        </AsyncButton>
                                    </div>
                                </div>

                                <a href={`/shiftplans/${plan.id}`} class="block space-y-4">
                                    <div>
                                        <h3 class="text-xl font-black text-gray-900 group-hover:text-purple-600 transition-colors leading-tight">
                                            {plan.name}
                                        </h3>
                                        
                                        <div class="mt-3 space-y-2">
                                            <div class="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                                <MapPin size={14} class="text-purple-400" />
                                                <span>{plan.locationName || 'Unassigned Location'}</span>
                                            </div>
                                            <div class="flex items-center gap-2 text-sm text-gray-500 font-medium font-mono uppercase tracking-tighter">
                                                <Calendar size={14} class="text-purple-400" />
                                                <span>
                                                    {(plan.schedule as any[])?.filter((d: any) => d.isActive).length ?? 0} Workdays configured
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="pt-4 border-t border-gray-50 flex items-center justify-between">
                                        <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                            Identified {new Date(plan.createdAt).toLocaleDateString()}
                                        </span>
                                        <div class="p-2 bg-gray-50 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-all">
                                            <ChevronRight size={16} />
                                        </div>
                                    </div>
                                </a>
                            </div>
                        {:else}
                            <div class="text-center py-12 bg-white rounded-xl border border-gray-100 col-span-full">
                                <Calendar class="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <h3 class="text-lg font-medium text-gray-900">
                                    No shift plans found
                                </h3>
                            </div>
                        {/each}
                    </div>

                    <!-- Pagination -->
                    {#await listShiftplans(filterState) then result}
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
