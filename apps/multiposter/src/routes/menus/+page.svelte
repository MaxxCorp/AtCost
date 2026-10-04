<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { listMenus } from "./list.remote";
    import { deleteMenus } from "./[id]/delete.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import {
        Utensils,
        Pencil,
        Trash2,
        Plus,
        Search,
        Layers,
        ChefHat,
        Package,
        ArrowUpDown,
        RefreshCw,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    let searchQuery = $state("");
    let templateFilter = $state<string>("all");
    let sortField = $state<"name" | "isTemplate" | "createdAt" | "updatedAt">("name");
    let sortOrder = $state<"asc" | "desc">("asc");
    let page = $state(1);
    let limit = $state(50);

    const isTemplateParam = $derived(
        templateFilter === "all" ? undefined : templateFilter === "templates" ? "true" : "false"
    );

    const filterState = $derived({
        page,
        limit,
        search: searchQuery.trim() || undefined,
        isTemplate: isTemplateParam,
        sortField,
        sortOrder,
    });

    async function onDelete(item: { id: string; name: string }, currentCount: number) {
        if (!window.confirm(m.delete_confirm?.({ item: item.name }) || `Are you sure you want to delete ${item.name}?`)) return;
        try {
            await deleteMenus([item.id]);
            toast.success(m.delete_successful?.() || `${item.name} deleted successfully`);
            if (currentCount <= 1 && page > 1) {
                page = page - 1;
            } else {
                await listMenus(filterState).refresh();
            }
        } catch (e: any) {
            toast.error(e?.message || m.something_went_wrong?.() || 'Failed to delete');
        }
    }
</script>

<div class="container mx-auto px-4 py-6 max-w-7xl space-y-6">
    <Breadcrumb feature="menus" />

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                <Utensils size={28} class="text-violet-600" />
                {m.feature_menus_title?.() || 'Menus'}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
                {m.feature_menus_description?.() || 'Aggregate consumables and recipes into event menus and templates.'}
            </p>
        </div>

        <Button
            href="/menus/new"
            class="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white self-start sm:self-auto"
        >
            <Plus size={16} />
            {m.create_item_label?.({ item: m.menu?.() || 'Menu' }) || 'New Menu'}
        </Button>
    </div>

    <!-- Filters & Search Bar -->
    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div class="relative w-full sm:w-80">
            <Search size={16} class="absolute left-3 top-3 text-gray-400" />
            <input
                type="text"
                bind:value={searchQuery}
                oninput={() => (page = 1)}
                placeholder={m.search_placeholder?.({ item: m.menus?.() || 'Menus' }) || 'Search menus...'}
                class="w-full pl-9 pr-3.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <!-- Template filter -->
            <select
                bind:value={templateFilter}
                onchange={() => (page = 1)}
                class="px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
                <option value="all">All Menus</option>
                <option value="templates">Templates Only</option>
                <option value="custom">Custom Menus Only</option>
            </select>

            <span class="text-xs text-gray-500 flex items-center gap-1">
                <ArrowUpDown size={14} /> Sort:
            </span>
            <select
                bind:value={sortField}
                onchange={() => (page = 1)}
                class="px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
                <option value="name">Name</option>
                <option value="isTemplate">Template Status</option>
                <option value="createdAt">Created Date</option>
                <option value="updatedAt">Updated Date</option>
            </select>
            <button
                type="button"
                onclick={() => {
                    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                    page = 1;
                }}
                class="px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold bg-white hover:bg-gray-50 cursor-pointer"
            >
                {sortOrder.toUpperCase()}
            </button>
            <button
                type="button"
                onclick={() => listMenus(filterState).refresh()}
                title={m.refresh?.() || "Refresh"}
                class="p-2 rounded-lg border border-gray-300 text-xs bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
            >
                <RefreshCw size={13} class={deleteMenus.pending ? 'animate-spin' : ''} />
            </button>
        </div>
    </div>

    <!-- Content Cards -->
    <svelte:boundary>
        {#if $effect.pending()}
            <div class="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
                <RefreshCw size={18} class="animate-spin text-violet-600" />
                <span>{m.loading?.() || 'Loading menus...'}</span>
            </div>
        {/if}
        <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
            {#await listMenus(filterState)}
                <LoadingSection message={m.loading?.() || 'Loading menus...'} />
            {:then result}
                {#if !result?.data || result.data.length === 0}
                    <div class="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-xs space-y-3">
                        <Utensils size={40} class="mx-auto text-gray-300" />
                        <h3 class="text-base font-bold text-gray-900">{m.no_items_found?.({ item: m.menus?.() || 'Menus' }) || 'No menus found'}</h3>
                        <p class="text-sm text-gray-500 max-w-md mx-auto">
                            Create your first concerted menu template aggregating consumables and recipes.
                        </p>
                        <Button href="/menus/new" class="bg-violet-600 hover:bg-violet-700 text-white mt-2">
                            <Plus size={16} class="mr-1.5" />
                            {m.create_item_label?.({ item: m.menu?.() || 'Menu' }) || 'New Menu'}
                        </Button>
                    </div>
                {:else}
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {#each result.data as item (item.id)}
                            <div class="bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between space-y-4">
                                <div class="space-y-3">
                                    <div class="flex items-start justify-between gap-2">
                                        <h3 class="text-lg font-bold text-gray-900 leading-snug">{item.name}</h3>
                                        {#if item.isTemplate}
                                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 flex-shrink-0">
                                                <Layers size={11} /> Template
                                            </span>
                                        {/if}
                                    </div>

                                    {#if item.description}
                                        <p class="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                                    {/if}

                                    <!-- Item pills preview -->
                                    <div class="space-y-1.5 pt-1">
                                        <span class="text-[10px] text-gray-400 uppercase tracking-wider font-bold block">
                                            {(item.items || []).length} Items:
                                        </span>
                                        <div class="flex flex-wrap gap-1.5 max-h-24 overflow-hidden">
                                            {#each (item.items || []).slice(0, 5) as mi (mi.id || mi.name)}
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700">
                                                    {#if mi.itemType === 'recipe'}
                                                        <ChefHat size={11} class="text-emerald-600" />
                                                    {:else}
                                                        <Package size={11} class="text-amber-600" />
                                                    {/if}
                                                    {mi.name} (€{mi.unitPrice})
                                                </span>
                                            {/each}
                                            {#if (item.items || []).length > 5}
                                                <span class="text-[11px] text-gray-400 px-1 py-0.5">
                                                    +{(item.items || []).length - 5} more
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>

                                <div class="pt-3 border-t border-gray-100 flex items-center justify-between">
                                    <div>
                                        <span class="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
                                            Price / Person
                                        </span>
                                        <span class="text-xl font-extrabold text-violet-900">
                                            €{(item.totalPricePerPortion ?? 0).toFixed(2)}
                                        </span>
                                    </div>

                                    <div class="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            href={`/menus/${item.id}`}
                                            class="h-8 px-2.5 text-xs font-medium flex items-center gap-1"
                                            title={m.edit?.() || 'Edit'}
                                        >
                                            <Pencil size={13} /> Edit
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onclick={() => onDelete(item, result.data.length)}
                                            disabled={Boolean(deleteMenus.pending)}
                                            class="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                                            title={m.delete?.() || 'Delete'}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <!-- Pagination footer -->
                    {#if Math.ceil((result.total || 0) / limit) > 1}
                        {@const totalPages = Math.ceil((result.total || 0) / limit)}
                        <div class="p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs text-gray-500 shadow-2xs">
                            <span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, result.total)} of {result.total}</span>
                            <div class="flex items-center gap-1">
                                <button
                                    disabled={page <= 1}
                                    onclick={() => page--}
                                    class="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-50 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                                >
                                    Prev
                                </button>
                                <span>Page {page} of {totalPages}</span>
                                <button
                                    disabled={page >= totalPages}
                                    onclick={() => page++}
                                    class="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-50 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    {/if}
                {/if}
            {:catch error}
                <ErrorSection
                    headline={m.error?.() || 'Error'}
                    message={error.message || 'Failed to load menus'}
                    href="/menus"
                    button={m.try_again?.() || 'Try Again'}
                />
            {/await}
        </div>
    </svelte:boundary>
</div>
