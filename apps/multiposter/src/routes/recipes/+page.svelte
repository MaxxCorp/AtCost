<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { listRecipes } from "./list.remote";
    import { deleteRecipes } from "./[id]/delete.remote";
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import Button from "#lib/components/ui/button/button.svelte";
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import {
        ChefHat,
        Pencil,
        Trash2,
        Plus,
        Search,
        Scale,
        ArrowUpDown,
        RefreshCw,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    let searchQuery = $state("");
    let sortField = $state<"name" | "portions" | "createdAt" | "updatedAt">("name");
    let sortOrder = $state<"asc" | "desc">("asc");
    let page = $state(1);
    let limit = $state(50);

    const filterState = $derived({
        page,
        limit,
        search: searchQuery.trim() || undefined,
        sortField,
        sortOrder,
    });

    async function onDelete(item: { id: string; name: string }, currentCount: number) {
        if (!window.confirm(m.delete_confirm?.({ item: item.name }) || `Are you sure you want to delete ${item.name}?`)) return;
        try {
            await deleteRecipes([item.id]);
            toast.success(m.delete_successful?.() || `${item.name} deleted successfully`);
            if (currentCount <= 1 && page > 1) {
                page = page - 1;
            } else {
                await listRecipes(filterState).refresh();
            }
        } catch (e: any) {
            toast.error(e?.message || m.something_went_wrong?.() || 'Failed to delete');
        }
    }
</script>

<div class="container mx-auto px-4 py-6 max-w-7xl space-y-6">
    <Breadcrumb feature="recipes" />

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                <ChefHat size={28} class="text-emerald-600" />
                {m.feature_recipes_title?.() || 'Recipes'}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
                {m.feature_recipes_description?.() || 'Track ingredients, portion amounts, and preparation instructions.'}
            </p>
        </div>

        <Button
            href="/recipes/new"
            class="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white self-start sm:self-auto"
        >
            <Plus size={16} />
            {m.create_item_label?.({ item: m.recipe?.() || 'Recipe' }) || 'New Recipe'}
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
                placeholder={m.search_placeholder?.({ item: m.recipes?.() || 'Recipes' }) || 'Search recipes...'}
                class="w-full pl-9 pr-3.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span class="text-xs text-gray-500 flex items-center gap-1">
                <ArrowUpDown size={14} /> Sort:
            </span>
            <select
                bind:value={sortField}
                onchange={() => (page = 1)}
                class="px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
                <option value="name">Name</option>
                <option value="portions">Portions</option>
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
                onclick={() => listRecipes(filterState).refresh()}
                title={m.refresh?.() || "Refresh"}
                class="p-2 rounded-lg border border-gray-300 text-xs bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
            >
                <RefreshCw size={13} class={deleteRecipes.pending ? 'animate-spin' : ''} />
            </button>
        </div>
    </div>

    <!-- Content Cards -->
    <svelte:boundary>
        {@const result = await listRecipes(filterState)}
        {#if $effect.pending()}
            <div class="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
                <RefreshCw size={18} class="animate-spin text-emerald-600" />
                <span>{m.loading?.() || 'Loading recipes...'}</span>
            </div>
        {/if}
        <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
            {#if !result?.data || result.data.length === 0}
                <div class="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-xs space-y-3">
                    <ChefHat size={40} class="mx-auto text-gray-300" />
                    <h3 class="text-base font-bold text-gray-900">{m.no_items_found?.({ item: m.recipes?.() || 'Recipes' }) || 'No recipes found'}</h3>
                    <p class="text-sm text-gray-500 max-w-md mx-auto">
                        Create your first recipe by combining consumables into prepared items with cost per portion calculations.
                    </p>
                    <Button href="/recipes/new" class="bg-emerald-600 hover:bg-emerald-700 text-white mt-2">
                        <Plus size={16} class="mr-1.5" />
                        {m.create_item_label?.({ item: m.recipe?.() || 'Recipe' }) || 'New Recipe'}
                    </Button>
                </div>
            {:else}
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {#each result.data as item (item.id)}
                            <div class="bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between space-y-4">
                                <div class="space-y-2">
                                    <div class="flex items-start justify-between gap-2">
                                        <h3 class="text-lg font-bold text-gray-900 leading-snug">{item.name}</h3>
                                        <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 flex-shrink-0">
                                            {item.portions} {item.portions === 1 ? 'portion' : 'portions'}
                                        </span>
                                    </div>

                                    {#if item.description}
                                        <p class="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                                    {/if}

                                    <div class="pt-2 text-xs text-gray-600 flex items-center gap-1.5">
                                        <Scale size={13} class="text-blue-500" />
                                        <span>{(item.consumables || []).length} {m.ingredients?.() || 'ingredients'}</span>
                                    </div>
                                </div>

                                <div class="pt-3 border-t border-gray-100 flex items-center justify-between">
                                    <div>
                                        <span class="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
                                            {m.cost_per_portion?.() || 'Cost / Portion'}
                                        </span>
                                        <span class="text-xl font-extrabold text-emerald-700">
                                            €{(item.costPerPortion ?? 0).toFixed(2)}
                                        </span>
                                    </div>

                                    <div class="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            href={`/recipes/${item.id}`}
                                            class="h-8 px-2.5 text-xs font-medium flex items-center gap-1"
                                            title={m.edit?.() || 'Edit'}
                                        >
                                            <Pencil size={13} /> Edit
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onclick={() => onDelete(item, result.data.length)}
                                            disabled={Boolean(deleteRecipes.pending)}
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
        </div>
        {#snippet failed(error: unknown, reset: () => void)}
            <ErrorSection
                headline={m.error?.() || 'Error'}
                message={error instanceof Error ? error.message : 'Failed to load recipes'}
                href="/recipes"
                button={m.try_again?.() || 'Try Again'}
            />
        {/snippet}
    </svelte:boundary>
</div>
