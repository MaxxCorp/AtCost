<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { listShiftplans } from "./list.remote";
    import { deleteShiftplans } from "./[id]/delete.remote";
    import ShiftScheduleMatrix from "#lib/components/shiftplans/ShiftScheduleMatrix.svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { goto } from "$app/navigation";
    import { page as pageState } from "$app/state";
    import {
        Button,
        AsyncButton,
        FilterMenu,
        ActiveFilterChips,
        BulkActionToolbar,
        type FilterGroup,
        type FilterStateMap,
        initPageFromUrl,
        syncPageToUrl,
        recordActiveItem,
        activeItemAnchor,
    } from "@ac/ui";
    
    import { listLocations } from "../locations/list.remote";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { 
        Calendar, 
        MapPin, 
        Pencil, 
        Trash2, 
        ChevronRight, 
        Search, 
        Plus,
        ArrowLeft,
        ArrowRight,
        ChevronsLeft,
        ChevronsRight,
        Layers,
        CalendarDays,
        Check,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    breadcrumbState.set({ feature: "shiftplans" });

    type Shiftplan = Awaited<ReturnType<typeof listShiftplans>>["data"][number];

    let activeTab = $state<"schedule" | "templates">("schedule");

    // Templates view state
    let sortField = $state<"updatedAt" | "createdAt" | "name">("updatedAt");
    let sortOrder = $state<"asc" | "desc">("desc");
    let searchQuery = $state("");
    let filterValues = $state<FilterStateMap>({});
    const page = $derived(initPageFromUrl(pageState.url));
    let limit = $state(50);

    function setPage(newPage: number) {
        syncPageToUrl("shiftplans", newPage, pageState.url, goto);
    }

    const filterGroups = $derived<FilterGroup[]>([
        {
            id: "locationId",
            label: m.locations ? m.locations() : "Locations",
            icon: MapPin,
            optionsRemote: listLocations,
            searchable: true,
        },
    ]);

    const filterState = $derived({
        page,
        limit,
        search: searchQuery || undefined,
        locationId: (filterValues.locationId?.include?.length || filterValues.locationId?.exclude?.length) ? filterValues.locationId : undefined,
        sortField,
        sortOrder,
    });

    const shiftplansQuery = $derived(listShiftplans(filterState));
    const templatesList = $derived(shiftplansQuery.current?.data ?? []);
    const templatesTotal = $derived(shiftplansQuery.current?.total ?? 0);

    let selectedIds = $state<string[]>([]);

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        const confirmMsg = m.delete_confirm?.({ item: `${selectedIds.length} ${m.shiftplans ? m.shiftplans() : 'shift plans'}` }) || `Delete ${selectedIds.length} shift plans?`;
        if (!window.confirm(confirmMsg)) return;
        try {
            await deleteShiftplans(selectedIds);
            toast.success(m.successfully_saved ? m.successfully_saved() : 'Deleted successfully');
            selectedIds = [];
            void shiftplansQuery.refresh();
        } catch (e: any) {
            toast.error(e?.message || (m.something_went_wrong ? m.something_went_wrong() : 'Failed to delete'));
        }
    }

    async function deleteItem(plan: Shiftplan) {
        if (!window.confirm(m.delete_confirm ? m.delete_confirm({ item: m.shiftplans ? m.shiftplans() : "Shift plan" }) : "Delete this shift plan?")) return;
        try {
            await deleteShiftplans([plan.id]);
            toast.success(m.successfully_saved ? m.successfully_saved() : "Deleted successfully");
            void shiftplansQuery.refresh();
        } catch (error: any) {
            toast.error(error?.message || (m.something_went_wrong ? m.something_went_wrong() : "Something went wrong"));
        }
    }
</script>

<div class="container mx-auto px-4 py-8 max-w-7xl">
    <div class="space-y-6">
        <!-- Header & Top Navigation -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-3">
                    <Calendar class="text-purple-600" size={32} />
                    {m.shiftplans_title ? m.shiftplans_title() : "Shift Plans"}
                </h1>
                <p class="text-gray-500 mt-1">
                    {m.shiftplans_subtitle ? m.shiftplans_subtitle() : "Manage schedules, templates, and workdays."}
                </p>
            </div>

            <!-- Tab Switcher & New Template Action -->
            <div class="flex items-center gap-3 w-full md:w-auto">
                <div class="bg-gray-100 p-1 rounded-2xl flex items-center shadow-2xs">
                    <button
                        type="button"
                        onclick={() => activeTab = "schedule"}
                        class={[
                            "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer",
                            activeTab === "schedule"
                                ? "bg-white text-purple-700 shadow-xs"
                                : "text-gray-600 hover:text-gray-900"
                        ]}
                    >
                        <CalendarDays size={15} />
                        <span>Weekly Schedule</span>
                    </button>
                    <button
                        type="button"
                        onclick={() => activeTab = "templates"}
                        class={[
                            "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer",
                            activeTab === "templates"
                                ? "bg-white text-purple-700 shadow-xs"
                                : "text-gray-600 hover:text-gray-900"
                        ]}
                    >
                        <Layers size={15} />
                        <span>Templates & Presets</span>
                    </button>
                </div>

                {#if activeTab === "templates"}
                    <Button href="/shiftplans/new" class="shadow-xs shrink-0">
                        <Plus class="w-4 h-4 mr-1.5" />
                        Create Template
                    </Button>
                {/if}
            </div>
        </div>

        <!-- TAB 1: Weekly Schedule Matrix (MS Teams Shifts Roster) -->
        {#if activeTab === "schedule"}
            <ShiftScheduleMatrix />
        {/if}

        <!-- TAB 2: Templates & Presets List -->
        {#if activeTab === "templates"}
            <div class="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-black text-gray-900">Shiftplan Templates</h2>
                        <p class="text-xs text-gray-500">Reusable schedule blueprints that can be assigned to staff.</p>
                    </div>
                </div>

                <!-- Action Bar -->
                <div class="flex flex-col md:flex-row gap-3">
                    <div class="relative flex-1">
                        <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={m.search_shift_plans()}
                            bind:value={searchQuery}
                            oninput={() => setPage(1)}
                            class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all bg-gray-50/50"
                        />
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <FilterMenu
                            groups={filterGroups}
                            bind:filters={filterValues}
                            buttonLabel={m.filters ? m.filters() : "Filters"}
                            onchange={() => setPage(1)}
                        />
                    </div>
                </div>

                <!-- Active Filter Chips -->
                <ActiveFilterChips
                    groups={filterGroups}
                    filters={filterValues}
                    activeFiltersLabel={m.active_filters ? m.active_filters() : "Active Filters:"}
                    clearAllLabel={m.clear_all_filters ? m.clear_all_filters() : "Clear all"}
                    onremove={(groupId: string, optId: string, type: "include" | "exclude") => {
                        const current = filterValues[groupId] || { include: [], exclude: [] };
                        filterValues = {
                            ...filterValues,
                            [groupId]: {
                                include: type === "include" ? current.include.filter((id) => id !== optId) : current.include,
                                exclude: type === "exclude" ? current.exclude.filter((id) => id !== optId) : current.exclude,
                            },
                        };
                        setPage(1);
                    }}
                    onclearall={() => {
                        const reset: FilterStateMap = {};
                        for (const g of filterGroups) {
                            reset[g.id] = { include: [], exclude: [] };
                        }
                        filterValues = reset;
                        setPage(1);
                    }}
                />

                <!-- Templates Grid (Reactive with query.current, NO {#await}) -->
                {#if shiftplansQuery.loading && !shiftplansQuery.current}
                    <div class="py-12 text-center text-gray-400 font-medium">Loading templates...</div>
                {:else if shiftplansQuery.error}
                    <div class="py-12 text-center text-red-500 font-medium">
                        Failed to load templates: {shiftplansQuery.error.message}
                    </div>
                {:else}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {#each templatesList as plan (plan.id)}
                            <div
                                id="item-{plan.id}"
                                use:activeItemAnchor={{ feature: "shiftplans", id: plan.id }}
                                class="p-6 rounded-2xl bg-white border transition-all hover:shadow-lg group flex flex-col justify-between {selectedIds.includes(plan.id)
                                    ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-md bg-purple-50/10'
                                    : 'border-gray-100 hover:border-purple-200'}"
                            >
                                <div class="flex items-start justify-between mb-4">
                                    <div class="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            bind:group={selectedIds}
                                            value={plan.id}
                                            class="h-4.5 w-4.5 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500 cursor-pointer flex-shrink-0 transition-colors"
                                            title={selectedIds.includes(plan.id) ? "Deselect" : "Select"}
                                        />
                                        <div class="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl text-purple-600 border border-purple-200 shadow-xs">
                                            <Calendar size={20} />
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                        <Button
                                            href={`/shiftplans/${plan.id}`}
                                            variant="ghost"
                                            size="icon"
                                            class="h-9 w-9 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl"
                                            onclick={() => recordActiveItem("shiftplans", plan.id)}
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

                                <a
                                    href={`/shiftplans/${plan.id}`}
                                    class="block space-y-4"
                                    onclick={() => recordActiveItem("shiftplans", plan.id)}
                                >
                                    <div>
                                        <h3 class="text-xl font-black text-gray-900 group-hover:text-purple-600 transition-colors leading-tight">
                                            {plan.name}
                                        </h3>
                                        
                                        <div class="mt-3 space-y-2">
                                            <div class="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                                <MapPin size={14} class="text-purple-400" />
                                                <span>{plan.locationName || (m.unassigned_location ? m.unassigned_location() : "Unassigned Location")}</span>
                                            </div>
                                            <div class="flex items-center gap-2 text-sm text-gray-500 font-medium font-mono uppercase tracking-tighter">
                                                <Calendar size={14} class="text-purple-400" />
                                                <span>
                                                    {m.workdays_configured ? m.workdays_configured({ count: (plan.schedule as any[])?.filter((d: any) => d.isActive).length ?? 0 }) : `${(plan.schedule as any[])?.filter((d: any) => d.isActive).length ?? 0} Workdays configured`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="pt-4 border-t border-gray-50 flex items-center justify-between">
                                        <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                            {m.identified ? m.identified() : "Identified"} {new Date(plan.createdAt).toLocaleDateString()}
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
                                    {m.no_shiftplans_found ? m.no_shiftplans_found() : "No shift plans found"}
                                </h3>
                            </div>
                        {/each}
                    </div>

                    <!-- Pagination -->
                    {#if templatesTotal > limit}
                        {@const totalPages = Math.ceil(templatesTotal / limit)}
                        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100">
                            <div class="flex items-center gap-3 text-sm text-gray-500">
                                <span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, templatesTotal)} of {templatesTotal}</span>
                                <div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                    <select
                                        bind:value={limit}
                                        onchange={() => setPage(1)}
                                        class="text-xs bg-transparent border-gray-200 rounded-md py-1 pl-2 pr-6 text-gray-500 cursor-pointer focus:ring-0"
                                    >
                                        <option value={10}>10 per page</option>
                                        <option value={20}>20 per page</option>
                                        <option value={50}>50 per page</option>
                                    </select>
                                </div>
                            </div>
                            <div class="flex items-center gap-1 sm:gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={page === 1}
                                    onclick={() => setPage(1)}
                                    class="h-9 w-9 border-gray-200 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
                                >
                                    <ChevronsLeft size={16} />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onclick={() => page > 1 && setPage(page - 1)}
                                    class="h-9 px-3 border-gray-200 shrink-0"
                                >
                                    <ArrowLeft size={16} class="mr-1.5 hidden sm:block" />
                                    Previous
                                </Button>
                                <div class="flex items-center gap-1 px-1 sm:px-2 font-medium text-sm text-gray-700">
                                    <select
                                        value={page}
                                        onchange={(e) => setPage(Number((e.currentTarget as HTMLSelectElement).value))}
                                        class="text-sm bg-transparent border-none font-medium p-0 focus:ring-0 text-center cursor-pointer hover:bg-gray-50 rounded px-1 min-w-[2.5rem]"
                                    >
                                        {#each Array(totalPages) as _, i (i)}
                                            <option value={i + 1}>{i + 1}</option>
                                        {/each}
                                    </select>
                                    <span class="text-gray-400">/ {totalPages}</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === totalPages}
                                    onclick={() => page < totalPages && setPage(page + 1)}
                                    class="h-9 px-3 border-gray-200 shrink-0"
                                >
                                    Next
                                    <ArrowRight size={16} class="ml-1.5 hidden sm:block" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={page === totalPages}
                                    onclick={() => setPage(totalPages)}
                                    class="h-9 w-9 border-gray-200 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
                                >
                                    <ChevronsRight size={16} />
                                </Button>
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>
        {/if}

        {#if activeTab === "templates"}
            <BulkActionToolbar
                {selectedIds}
                totalCount={templatesList.length}
                onSelectAll={() => (selectedIds = templatesList.map((p: any) => p.id))}
                onDeselectAll={() => (selectedIds = [])}
                onDelete={handleBulkDelete}
                deleteLabel={m.delete ? m.delete() : "Delete"}
                selectAllLabel={m.select_all ? m.select_all() : `Select All (${templatesList.length})`}
                deselectAllLabel={m.deselect_all ? m.deselect_all() : "Deselect All"}
            />
        {/if}
    </div>
</div>
