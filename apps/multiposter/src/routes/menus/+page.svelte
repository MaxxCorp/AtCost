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
        Euro,
        Layers,
        ChefHat,
        Package,
        ArrowUpDown,
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

    const dataPromise = $derived(
        listMenus({
            page,
            limit,
            search: searchQuery,
            isTemplate: isTemplateParam,
            sortField,
            sortOrder,
        })
    );

    async function onDelete(id: string, name: string) {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await deleteMenus([id]);
            toast.success(`${name} deleted`);
        } catch (e: any) {
            toast.error(e.message || 'Failed to delete');
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
                placeholder={m.search_placeholder?.({ item: m.menus?.() || 'Menus' }) || 'Search menus...'}
                class="w-full pl-9 pr-3.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <!-- Template filter -->
            <select
                bind:value={templateFilter}
                class="px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-blue-500"
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
                class="px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-blue-500"
            >
                <option value="name">Name</option>
                <option value="isTemplate">Template Status</option>
                <option value="createdAt">Created Date</option>
                <option value="updatedAt">Updated Date</option>
            </select>
            <button
                type="button"
                onclick={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
                class="px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold bg-white hover:bg-gray-50"
            >
                {sortOrder.toUpperCase()}
            </button>
        </div>
    </div>

    <!-- Content Cards -->
    {#await dataPromise}
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
                                >
                                    <Pencil size={13} /> Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => onDelete(item.id, item.name)}
                                    class="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                    <span>Showing {result.data.length} of {result.total}</span>
                    <div class="flex items-center gap-1">
                        <button
                            disabled={page <= 1}
                            onclick={() => page--}
                            class="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <span>Page {page} of {totalPages}</span>
                        <button
                            disabled={page >= totalPages}
                            onclick={() => page++}
                            class="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-50"
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
