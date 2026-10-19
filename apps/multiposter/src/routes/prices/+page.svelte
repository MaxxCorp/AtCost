<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { listPrices } from "./list.remote";
    import { deletePrices } from "./[id]/delete.remote";
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import { page as pageState } from "$app/state";
    import { goto } from "$app/navigation";
    import {
        LoadingSection,
        ErrorSection,
        Button,
        BulkActionToolbar,
        initPageFromUrl,
        syncPageToUrl,
        recordActiveItem,
        activeItemAnchor
    } from "@ac/ui";
    import {
        Tag,
        Receipt,
        Pencil,
        Trash2,
        Plus,
        Search,
        Layers,
        ChefHat,
        Package,
        ArrowUpDown,
        RefreshCw,
        Check,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    let searchQuery = $state("");
    let templateFilter = $state<string>("all");
    let sortField = $state<"name" | "isTemplate" | "createdAt" | "updatedAt">("name");
    let sortOrder = $state<"asc" | "desc">("asc");
    const page = $derived(initPageFromUrl(pageState.url));
    let limit = $state(50);

    function setPage(newPage: number) {
        syncPageToUrl("prices", newPage, pageState.url, goto);
    }

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

    let selectedIds = $state<string[]>([]);
    const pricesQuery = $derived(listPrices(filterState));
    const result = $derived(pricesQuery.current);
    const priceItems = $derived(result?.data ?? []);
    const total = $derived(result?.total ?? 0);
    const totalPages = $derived(Math.ceil(total / limit));

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        const confirmMsg = m.delete_confirm?.({ item: `${selectedIds.length} ${m.feature_prices_title?.() || 'prices'}` }) || `Delete ${selectedIds.length} price lists?`;
        if (!window.confirm(confirmMsg)) return;
        try {
            await deletePrices(selectedIds);
            toast.success(m.delete_successful?.() || 'Deleted successfully');
            selectedIds = [];
            await pricesQuery.refresh();
        } catch (e: any) {
            toast.error(e?.message || m.something_went_wrong?.() || 'Failed to delete');
        }
    }

    async function onDelete(item: { id: string; name: string }, currentCount: number) {
        if (!window.confirm(m.delete_confirm?.({ item: item.name }) || `Are you sure you want to delete ${item.name}?`)) return;
        try {
            await deletePrices([item.id]);
            toast.success(m.delete_successful?.() || `${item.name} deleted successfully`);
            if (currentCount <= 1 && page > 1) {
                setPage(page - 1);
            } else {
                await pricesQuery.refresh();
            }
        } catch (e: any) {
            toast.error(e?.message || m.something_went_wrong?.() || 'Failed to delete');
        }
    }
</script>

<div class="container mx-auto px-4 py-6 max-w-7xl space-y-6">
    <Breadcrumb feature="prices" />

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                <Receipt size={28} class="text-violet-600" />
                {m.feature_prices_title?.() || 'Price Lists'}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
                {m.feature_prices_description?.() || 'Create customized price lists with consumables and prepared recipes.'}
            </p>
        </div>

        <Button
            href="/prices/new"
            class="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white self-start sm:self-auto"
        >
            <Plus size={16} />
            {m.create_item_label?.({ item: m.price_list?.() || 'Price List' }) || 'New Price List'}
        </Button>
    </div>

    <!-- Filters & Search Bar -->
    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto flex-1">
            <div class="relative w-full sm:w-80">
                <Search size={16} class="absolute left-3 top-3 text-gray-400" />
                <input
                    type="text"
                    bind:value={searchQuery}
                    oninput={() => setPage(1)}
                    placeholder={m.search_placeholder?.({ item: m.prices?.() || 'Price lists' }) || 'Search price lists...'}
                    class="w-full pl-9 pr-3.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <!-- Template Type Filter Toggle -->
            <div class="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-xs self-start">
                <button
                    type="button"
                    class="px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer {templateFilter === 'all' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-900'}"
                    onclick={() => { templateFilter = 'all'; setPage(1); }}
                >
                    All
                </button>
                <button
                    type="button"
                    class="px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer {templateFilter === 'templates' ? 'bg-white shadow-xs text-violet-700' : 'text-gray-500 hover:text-gray-900'}"
                    onclick={() => { templateFilter = 'templates'; setPage(1); }}
                >
                    Templates Only
                </button>
                <button
                    type="button"
                    class="px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer {templateFilter === 'custom' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-900'}"
                    onclick={() => { templateFilter = 'custom'; setPage(1); }}
                >
                    Custom
                </button>
            </div>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto justify-end">
            <span class="text-xs text-gray-500 flex items-center gap-1">
                <ArrowUpDown size={14} /> Sort:
            </span>
            <select
                bind:value={sortField}
                onchange={() => setPage(1)}
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
                    setPage(1);
                }}
                class="px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold bg-white hover:bg-gray-50 cursor-pointer"
            >
                {sortOrder.toUpperCase()}
            </button>
            <button
                type="button"
                onclick={() => void pricesQuery.refresh()}
                title={m.refresh?.() || "Refresh"}
                class="p-2 rounded-lg border border-gray-300 text-xs bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
            >
                <RefreshCw size={13} class={pricesQuery.loading ? 'animate-spin' : ''} />
            </button>
        </div>
    </div>

    <!-- Content -->
    {#if pricesQuery.loading && !result}
        <LoadingSection message={m.loading?.() || 'Loading prices...'} />
    {:else if pricesQuery.error}
        <ErrorSection
            headline={m.error?.() || 'Error'}
            message={pricesQuery.error instanceof Error ? pricesQuery.error.message : 'Failed to load prices'}
            href="/prices"
            button={m.try_again?.() || 'Try Again'}
        />
    {:else if !result?.data || result.data.length === 0}
        <div class="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-xs space-y-3">
            <Receipt size={40} class="mx-auto text-gray-300" />
            <h3 class="text-base font-bold text-gray-900">{m.no_items_found?.({ item: m.prices?.() || 'Prices' }) || 'No price lists found'}</h3>
            <p class="text-sm text-gray-500 max-w-md mx-auto">
                Create your first price list aggregating consumables and recipes.
            </p>
            <Button href="/prices/new" class="bg-violet-600 hover:bg-violet-700 text-white mt-2">
                <Plus size={16} class="mr-1.5" />
                {m.create_item_label?.({ item: m.price_list?.() || 'Price List' }) || 'New Price List'}
            </Button>
        </div>
    {:else}
        <div class={[pricesQuery.loading && "opacity-60 transition-opacity"]}>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {#each result.data as item (item.id)}
                    <div
                        id="item-{item.id}"
                        use:activeItemAnchor={{ feature: "prices", id: item.id }}
                        class="bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between space-y-4 {selectedIds.includes(item.id)
                            ? 'border-violet-500 ring-2 ring-violet-500/20 shadow-md bg-violet-50/10'
                            : 'border-gray-100 shadow-xs hover:shadow-md'}"
                    >
                        <div class="space-y-3">
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex items-start gap-2.5">
                                    <input
                                        type="checkbox"
                                        bind:group={selectedIds}
                                        value={item.id}
                                        class="h-4.5 w-4.5 rounded border-gray-300 dark:border-gray-600 text-violet-600 focus:ring-violet-500 cursor-pointer mt-1 flex-shrink-0 transition-colors"
                                        title={selectedIds.includes(item.id) ? "Deselect" : "Select"}
                                    />
                                    <h3 class="text-lg font-bold text-gray-900 leading-snug">{item.name}</h3>
                                </div>
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
                                    href={`/prices/${item.id}`}
                                    onclick={() => recordActiveItem("prices", item.id)}
                                    class="h-8 px-2.5 text-xs font-medium flex items-center gap-1"
                                    title={m.edit?.() || 'Edit'}
                                >
                                    <Pencil size={13} /> Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => onDelete(item, result.data.length)}
                                    disabled={Boolean(deletePrices.pending)}
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
            {#if totalPages > 1}
                <div class="p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs text-gray-500 shadow-2xs mt-4">
                    <span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}</span>
                    <div class="flex items-center gap-1">
                        <button
                            disabled={page <= 1}
                            onclick={() => setPage(page - 1)}
                            class="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-50 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            Prev
                        </button>
                        <span>Page {page} of {totalPages}</span>
                        <button
                            disabled={page >= totalPages}
                            onclick={() => setPage(page + 1)}
                            class="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-50 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    {/if}

    <BulkActionToolbar
        {selectedIds}
        totalCount={priceItems.length}
        onSelectAll={() => (selectedIds = priceItems.map((p: any) => p.id))}
        onDeselectAll={() => (selectedIds = [])}
        onDelete={handleBulkDelete}
        deleteLabel={m.delete ? m.delete() : "Delete"}
        selectAllLabel={m.select_all ? m.select_all() : `Select All (${priceItems.length})`}
        deselectAllLabel={m.deselect_all ? m.deselect_all() : "Deselect All"}
    />
</div>
