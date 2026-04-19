<script lang="ts" generics="T extends { id?: string | null }">
    import { onMount, untrack, type Component, type Snippet } from "svelte";
    import {
        Search,
        Plus,
        Link,
        Unlink,
        ExternalLink,
        Pencil,
        X,
        Trash2,
        Filter as FilterIcon,
        Database,
    } from "@lucide/svelte";

    import * as DropdownMenu from "./dropdown-menu";

    import Button from "./button/button.svelte";
    import AsyncButton from "./AsyncButton.svelte";
    import * as Dialog from "./dialog";
    import EmptyState from "./EmptyState.svelte";
    import { toast } from "svelte-sonner";

    export interface FilterDefinition {
        id: string;
        label: string;
        type: "select";
        optionsRemote: (params?: any) => Promise<any[] | { data: any[]; total: number }>;
        options?: { value: string, label: string }[];
    }

    export interface FilterAssociation {
        id: string;
        label: string;
        listRemote: (params?: any) => Promise<any[] | { data: any[]; total: number }>;
        getOptionLabel: (item: any) => string;
    }

    interface Props<T extends { id?: string | null }> {
        title: string;
        icon: Component<any>;
        mode?: "embedded" | "standalone";
        type?: string;
        entityId?: string | null;
        embedded?: boolean;
        singleSelect?: boolean;
        onchange?: (ids: string[], items: T[]) => void;

        // Data fetchers
        listItemsRemote: (params?: any) => Promise<T[] | { data: T[], total?: number }>;
        fetchAssociationsRemote?: (params: {
            type: any;
            entityId: string;
        }) => Promise<T[]>;
        addAssociationRemote?: (params: {
            type: any;
            entityId: string;
            itemId: string;
        }) => Promise<any>;
        removeAssociationRemote?: (params: {
            type: any;
            entityId: string;
            itemId: string;
        }) => Promise<any>;
        deleteItemRemote?: (ids: string[]) => Promise<any>;

        // Form Data
        createRemote?: any;
        createSchema?: any;
        updateRemote?: any;
        updateSchema?: any;
        getFormData?: (item: T) => any;

        // Form Rendering
        renderForm?: Snippet<
            [
                {
                    remoteFunction: any;
                    schema: any;
                    initialData?: any;
                    onSuccess: (result: any) => void;
                    onCancel: () => void;
                    id?: string;
                },
            ]
        >;

        // Rendering snippets
        renderListItem?: Snippet<[T, { isSelected: boolean, toggleSelection: (id: string) => void, deleteItem: (item: T) => void, isAssociated: boolean, toggleAssociation: (item: T) => void, singleSelect: boolean }]>;
        renderItemLabel?: Snippet<[T]>;
        renderItemBadge?: Snippet<[T]>;
        renderItemDetail?: Snippet<[T]>;
        participationSnippet?: Snippet<[T]>;
        filtersSnippet?: Snippet<[]>;
        filters?: FilterDefinition[];
        filterAssociations?: FilterAssociation[];

        // Search
        searchPredicate: (item: T, query: string) => boolean;

        // Initial state
        initialItems?: T[];

        // Standalone mode empty state
        emptyTitle?: string;
        emptyDescription?: string;
        emptyActionLabel?: string;

        // Localization props
        loadingLabel?: string;
        noItemsLabel?: string;
        noItemsFoundLabel?: string;
        searchPlaceholder?: string;
        linkItemLabel?: string;
        associatedItemLabel?: string;
        quickCreateLabel?: string;
        closeSearchLabel?: string;
        editLabel?: string;
        deleteLabel?: string;
        unlinkLabel?: string;
        deleteForeverLabel?: string;
        bulkDeleteLabel?: string;
        selectAllLabel?: string;
        deselectAllLabel?: string;
        confirmUnlinkLabel?: string;
    }

    let {
        title,
        icon: Icon = Database,
        mode = "standalone",
        type,
        entityId = null,
        embedded = false,
        singleSelect = false,
        onchange = undefined,
        listItemsRemote,
        fetchAssociationsRemote,
        addAssociationRemote,
        removeAssociationRemote,
        deleteItemRemote,
        createRemote,
        createSchema,
        updateRemote,
        updateSchema,
        getFormData,
        renderForm,
        renderListItem,
        renderItemLabel,
        renderItemBadge,
        renderItemDetail,
        participationSnippet,
        filtersSnippet,
        searchPredicate,
        filters = [],
        filterAssociations = [],
        initialItems = [],
        emptyTitle,
        emptyDescription,
        emptyActionLabel,

        // Localization defaults
        loadingLabel = `Loading ${title.toLowerCase()}...`,
        noItemsLabel = `No ${title.toLowerCase()} associated yet.`,
        noItemsFoundLabel = `No ${title.toLowerCase()} found.`,
        searchPlaceholder = `Search ${title.toLowerCase()}...`,
        linkItemLabel = `Link ${title}`,
        associatedItemLabel = `Associated ${title}`,
        quickCreateLabel = "Quick Create",
        closeSearchLabel = "Close Search",
        editLabel = "Edit",
        deleteLabel = "Delete",
        unlinkLabel = "Unlink",
        deleteForeverLabel = `Delete ${title.toLowerCase()} forever`,
        bulkDeleteLabel = "Delete Selected",
        selectAllLabel = "Select All",
        deselectAllLabel = "Deselect All",
        confirmUnlinkLabel = "Remove link",
    }: Props<T> = $props();

    const effectiveFilters = $derived([
        ...filters,
        ...filterAssociations.map(assoc => ({
            id: assoc.id,
            label: assoc.label,
            type: "select" as const,
            optionsRemote: async (params: any) => {
                const result = await assoc.listRemote(params);
                const items = Array.isArray(result) ? result : result.data;
                return items.map(item => ({
                    label: assoc.getOptionLabel(item),
                    value: item.id
                }));
            }
        }))
    ]);

    const isStandalone = $derived(mode === "standalone");
    
    let page = $state(1);
    let limit = $state(50);
    let totalItems = $state(0);

    let searchQuery = $state("");
    
    // Filter persistence
    const storageKey = $derived(`em-filters-${title.toLowerCase().replace(/\s+/g, '-')}`);
    let selectedFilters = $state<Record<string, string[]>>({});
    const activeFiltersCount = $derived(Object.values(selectedFilters).filter(v => v.length > 0).length);

    onMount(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    selectedFilters = JSON.parse(saved);
                } catch (e) {
                    console.error("Failed to parse saved filters", e);
                }
            }
        }
    });

    $effect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify(selectedFilters));
        }
    });

    let filterOptions = $state<Record<string, { value: string, label: string }[]>>({});

    $effect(() => {
        if (filters && filters.length > 0) {
            for (const filter of filters) {
                if (filter.optionsRemote) {
                    filter.optionsRemote().then(opts => {
                        const items = Array.isArray(opts) ? opts : opts.data;
                        filterOptions[filter.id] = items;
                    });
                } else if (filter.options) {
                    filterOptions[filter.id] = filter.options;
                }
            }
        }
    });
    
    // Remote Query Initialization
    const listQuery = $derived.by(() => {
        const params: any = { page, limit, search: searchQuery, ...selectedFilters };
        return listItemsRemote(params);
    });

    const fetchQuery = $derived(!isStandalone && entityId && type && fetchAssociationsRemote 
        ? fetchAssociationsRemote({ type, entityId }) 
        : null);

    // svelte-ignore state_referenced_locally
    let associatedItems = $state<any[]>(initialItems ?? []);
    let allItems = $state<any[]>([]);
    let showSelector = $state(false);
    let showQuickCreate = $state(false);
    let loadingSearch = $state(false);
    let loadingItems = $state(false);
    let linkingItemId = $state<string | null>(null);
    let deletingItemId = $state<string | null>(null);
    let editingItem = $state<any | null>(null);
    let selectedIds = $state<Set<string>>(new Set());
    let bulkDeleting = $state(false);

    const filteredItems = $derived(
        allItems.filter((i) => searchPredicate(i, searchQuery)),
    );

    const displayedItems = $derived(
        isStandalone
            ? searchQuery
                ? associatedItems.filter((i) => searchPredicate(i, searchQuery))
                : associatedItems
            : associatedItems,
    );

    let fetchingAssociations = $state(false);

    $effect(() => {
        if (!isStandalone && initialItems !== undefined && !fetchAssociationsRemote && !loadingItems) {
            associatedItems = initialItems;
        }
    });

    $effect(() => {
        if (fetchQuery) {
            fetchingAssociations = true;
            fetchQuery.then((data: any) => {
                associatedItems = data;
                fetchingAssociations = false;
            }).catch((err: any) => {
                console.error("Failed to fetch associations", err);
                fetchingAssociations = false;
            });
        }
    });

    $effect(() => {
        if (isStandalone && listQuery) {
            loadingItems = true;
            Promise.resolve(listQuery).then((res: any) => {
                untrack(() => {
                    associatedItems = Array.isArray(res) ? res : (res?.data ?? []);
                    totalItems = Array.isArray(res) ? res.length : (res?.total ?? associatedItems.length);
                    loadingItems = false;
                });
            }).catch(e => {
                console.error("Failed to load items", e);
                untrack(() => {
                    loadingItems = false;
                });
            });
        }
    });

    function toggleSelection(id: string) {
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
        } else {
            selectedIds.add(id);
        }
        selectedIds = new Set(selectedIds);
    }

    function selectAll() {
        selectedIds = new Set(displayedItems.map((i: any) => i.id));
    }

    function deselectAll() {
        selectedIds = new Set();
    }

    async function bulkDelete() {
        if (!deleteItemRemote || selectedIds.size === 0) return;
        bulkDeleting = true;
        try {
            await deleteItemRemote(Array.from(selectedIds));
            associatedItems = associatedItems.filter(
                (i) => !selectedIds.has(i.id),
            );
            allItems = allItems.filter((i) => !selectedIds.has(i.id));
            if (onchange) onchange(associatedItems.map((i) => i.id), associatedItems);
            deselectAll();
            toast.success(`Deleted successfully`);
        } catch (e: any) {
            toast.error(e.message || "Failed to delete some items");
        } finally {
            bulkDeleting = false;
        }
    }

    async function toggleSelector() {
        showSelector = !showSelector;
        const query = listQuery;
        if (showSelector && allItems.length === 0 && query) {
            loadingSearch = true;
            try {
                const res = await query;
                allItems = Array.isArray(res) ? res : (res?.data ?? []);
            } catch (err: any) {
                toast.error(`${noItemsFoundLabel}: ${err.message}`);
            } finally {
                loadingSearch = false;
            }
        }
    }

    async function toggleAssociation(item: any) {
        linkingItemId = item.id;
        const isAssociated = associatedItems.some((ai) => ai.id === item.id);
        try {
            if (isAssociated) {
                if (entityId && removeAssociationRemote) {
                    await removeAssociationRemote({
                        type: type!,
                        entityId,
                        itemId: item.id,
                    });
                }
                associatedItems = associatedItems.filter(
                    (ai) => ai.id !== item.id,
                );
            } else {
                if (singleSelect) {
                    // In single-select mode, replace instead of append
                    if (entityId && removeAssociationRemote) {
                        for (const existing of associatedItems) {
                            await removeAssociationRemote({
                                type: type!,
                                entityId,
                                itemId: existing.id,
                            });
                        }
                    }
                    if (entityId && addAssociationRemote) {
                        await addAssociationRemote({
                            type: type!,
                            entityId,
                            itemId: item.id,
                        });
                    }
                    associatedItems = [item];
                    showSelector = false;
                } else {
                    if (entityId && addAssociationRemote) {
                        await addAssociationRemote({
                            type: type!,
                            entityId,
                            itemId: item.id,
                        });
                    }
                    associatedItems = [...associatedItems, item];
                }
            }
            if (onchange) onchange(associatedItems.map((i) => i.id), associatedItems);
        } catch (error: any) {
            toast.error(error.message || "Failed to update association");
        } finally {
            linkingItemId = null;
        }
    }

    async function handleQuickCreateSuccess(result: any) {
        showQuickCreate = false;

        if (result?.id) {
            const query = listQuery;
            const res: any = query ? await query : await listItemsRemote({ page, limit, search: searchQuery });
            const items = Array.isArray(res) ? res : (res?.data ?? []);

            if (isStandalone) {
                associatedItems = items;
                totalItems = Array.isArray(res) ? res.length : (res?.total ?? items.length);
                toast.success(`${title} created`);
            } else {
                const newItem = items.find((i: any) => i.id === result.id);
                if (newItem) {
                    if (entityId && addAssociationRemote) {
                        await addAssociationRemote({
                            type: type!,
                            entityId,
                            itemId: newItem.id,
                        });
                    }
                    allItems = [newItem, ...allItems];
                    associatedItems = [newItem, ...associatedItems];
                    if (onchange) onchange(associatedItems.map((i) => i.id), associatedItems);
                    toast.success(`${title} created and associated`);
                }
            }
        }
    }

    async function handleInPlaceUpdateSuccess(result: any) {
        const targetId = editingItem?.id;
        editingItem = null;

        if (!targetId) return;

        const query = listQuery;
        const res: any = query ? await query : await listItemsRemote({ page, limit, search: searchQuery });
        const items = Array.isArray(res) ? res : (res?.data ?? []);
        const updatedItem = items.find((i: any) => i.id === targetId);

        if (updatedItem) {
            associatedItems = associatedItems.map((i) =>
                i.id === targetId ? updatedItem : i,
            );
            allItems = allItems.map((i) =>
                i.id === targetId ? updatedItem : i,
            );
            if (onchange) onchange(associatedItems.map((i) => i.id), associatedItems);
            toast.success(`${title} updated`);
        }
    }

    async function deleteItem(item: T) {
        if (!item.id || !deleteItemRemote) return;
        deletingItemId = item.id;
        try {
            await deleteItemRemote([item.id]);
            allItems = allItems.filter((i) => i.id !== item.id);
            associatedItems = associatedItems.filter((i) => i.id !== item.id);
            if (onchange) onchange(associatedItems.map((i) => i.id), associatedItems);
            toast.success("Deleted successfully");
        } catch (e: any) {
            toast.error(e.message || "Failed to delete item");
        } finally {
            deletingItemId = null;
        }
    }
</script>

{#if isStandalone}
    <div class="space-y-4">
        <div
            class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
            <h1 class="text-3xl font-bold flex items-center gap-3">
                <Icon size={28} />
                {title}
            </h1>
            <div class="flex flex-wrap gap-2">
                {#if selectedIds.size > 0}
                    <Button
                        type="button"
                        variant="secondary"
                        size="default"
                        onclick={selectedIds.size === displayedItems.length
                            ? deselectAll
                            : selectAll}
                    >
                        {selectedIds.size === displayedItems.length
                            ? deselectAllLabel
                            : selectAllLabel}
                    </Button>
                    <AsyncButton
                        onclick={bulkDelete}
                        variant="destructive"
                        class="px-4 py-2"
                        loading={bulkDeleting}
                        loadingLabel={loadingLabel}
                    >
                        {bulkDeleteLabel} ({selectedIds.size})
                    </AsyncButton>
                {/if}
                {#if createRemote && renderForm}
                    <Button
                        type="button"
                        variant="default"
                        size="default"
                        onclick={() => (showQuickCreate = true)}
                    >
                        <Plus size={16} class="mr-1" />
                        {quickCreateLabel}
                    </Button>
                {/if}
            </div>
        </div>

        <div class="flex flex-col md:flex-row gap-3">
            <div class="relative flex-1">
                <Search
                    size={16}
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                    type="text"
                    placeholder={searchPlaceholder}
                    bind:value={searchQuery}
                    class="pl-9 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            {#if effectiveFilters.length > 0}
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                        <Button variant="outline" size="icon" class="relative">
                            <FilterIcon size={18} />
                            {#if activeFiltersCount > 0}
                                <span class="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">
                                    {activeFiltersCount}
                                </span>
                            {/if}
                        </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end" class="min-w-[200px]">
                        <DropdownMenu.Label>Filters</DropdownMenu.Label>
                        <DropdownMenu.Separator />
                        {#each effectiveFilters as filter}
                            <DropdownMenu.Sub>
                                <DropdownMenu.SubTrigger class="flex items-center gap-2">
                                    <span>{filter.label}</span>
                                    {#if selectedFilters[filter.id]?.length > 0}
                                        <span class="ml-auto text-[10px] py-0.5 px-2 h-4 bg-gray-100 text-gray-900 rounded-full flex items-center justify-center font-medium">
                                            {selectedFilters[filter.id].length}
                                        </span>
                                    {/if}
                                </DropdownMenu.SubTrigger>
                                <DropdownMenu.SubContent class="w-56 p-0 max-h-[300px] overflow-y-auto">
                                    {#await filter.optionsRemote({ limit: 100 })}
                                        <div class="p-2 text-xs text-muted-foreground animate-pulse">Loading...</div>
                                    {:then options}
                                        {#each Array.isArray(options) ? options : [] as option}
                                            <DropdownMenu.CheckboxItem
                                                checked={selectedFilters[filter.id]?.includes(option.value)}
                                                onCheckedChange={(checked) => {
                                                    const current = selectedFilters[filter.id] || [];
                                                    if (checked) {
                                                        selectedFilters[filter.id] = [...current, option.value];
                                                    } else {
                                                        selectedFilters[filter.id] = current.filter(v => v !== option.value);
                                                        if (selectedFilters[filter.id].length === 0) {
                                                            delete selectedFilters[filter.id];
                                                        }
                                                    }
                                                    selectedFilters = { ...selectedFilters };
                                                    page = 1;
                                                }}
                                            >
                                                {option.label}
                                            </DropdownMenu.CheckboxItem>
                                        {/each}
                                        {#if (Array.isArray(options) ? options : []).length === 0}
                                            <div class="p-2 text-xs text-muted-foreground">No items found</div>
                                        {/if}
                                    {/await}
                                </DropdownMenu.SubContent>
                            </DropdownMenu.Sub>
                        {/each}
                        {#if activeFiltersCount > 0}
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item 
                                onclick={() => {
                                    selectedFilters = {};
                                    page = 1;
                                }}
                                class="text-red-600 justify-center font-medium"
                            >
                                Clear All
                            </DropdownMenu.Item>
                        {/if}
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            {/if}
            {#if filtersSnippet}
                {@render filtersSnippet()}
            {/if}
        </div>

        {#if !singleSelect || associatedItems.length === 0}
            <div class="flex items-center gap-2 mb-4 bg-white/50 p-2 rounded-lg border border-dashed border-gray-200">
                <Button 
                    variant="outline" 
                    size="sm"
                    onclick={() => (showSelector = true)}
                    disabled={loadingItems}
                >
                    <Link class="mr-2 h-4 w-4" />
                    {linkItemLabel}
                </Button>
                {#if createRemote && createSchema}
                    <Button 
                        variant="secondary" 
                        size="sm"
                        onclick={() => (showQuickCreate = true)}
                        disabled={loadingItems}
                    >
                        <Plus class="mr-2 h-4 w-4" />
                        {quickCreateLabel}
                    </Button>
                {/if}
            </div>
        {/if}

        {#if loadingItems}
            <div class="text-center py-12 text-gray-400">
                {loadingLabel}
            </div>
        {:else if associatedItems.length === 0}
            <EmptyState
                icon={Icon}
                title={emptyTitle || `No ${title}`}
                description={emptyDescription ||
                    `Get started by creating your first ${title.toLowerCase().replace(/s$/, "")}`}
                actionLabel={emptyActionLabel ||
                    `Create ${title.replace(/s$/, "")}`}
                onclick={() => (showQuickCreate = true)}
            />
        {:else if displayedItems.length === 0}
            <div class="text-center py-8 text-gray-400 text-sm">
                {noItemsFoundLabel}
            </div>
        {:else}
            <div class="grid gap-3">
                {#each displayedItems as item (item.id)}
                    {#if renderListItem}
                        {@render renderListItem(item, {
                            isSelected: selectedIds.has(item.id),
                            toggleSelection,
                            deleteItem,
                            isAssociated: associatedItems.some((ai) => ai.id === item.id),
                            toggleAssociation,
                            singleSelect
                        })}
                    {:else}
                        <div
                            class="bg-white shadow-sm rounded-lg p-4 flex items-center gap-4 border border-gray-100 hover:shadow-md transition-shadow group/item"
                        >
                            {#if !singleSelect}
                            <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onchange={() => toggleSelection(item.id)}
                                class="w-4 h-4 text-blue-600 shrink-0"
                            />
                            {/if}

                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-gray-900">
                                    {#if renderItemLabel}
                                        {@render renderItemLabel(item)}
                                    {/if}
                                </div>
                                {#if renderItemBadge}
                                    <div class="mt-1">
                                        {@render renderItemBadge(item)}
                                    </div>
                                {/if}
                                {#if renderItemDetail}
                                    <div class="mt-1 text-sm text-gray-500">
                                        {@render renderItemDetail(item)}
                                    </div>
                                {/if}
                            </div>
                            <div
                                class="flex items-center gap-1 shrink-0"
                            >
                                {#if updateRemote && renderForm && getFormData}
                                    <button
                                        type="button"
                                        class="h-8 px-2 text-gray-400 hover:text-blue-500 transition-colors"
                                        onclick={() => {
                                            editingItem = item;
                                            showQuickCreate = false;
                                        }}
                                        title={editLabel}
                                    >
                                        <Pencil size={16} />
                                    </button>
                                {/if}
                                {#if deleteItemRemote}
                                    <AsyncButton
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        class="h-8 px-2 text-gray-400 hover:text-red-500"
                                        loading={deletingItemId === item.id}
                                        loadingLabel=""
                                        onclick={() => deleteItem(item)}
                                        title={deleteLabel}
                                    >
                                        <Trash2 size={16} />
                                    </AsyncButton>
                                {/if}
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
            
            {#if totalItems > limit}
                <div class="flex justify-between items-center py-4 border-t mt-4 text-sm text-gray-600">
                    <div>
                        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalItems)} of {totalItems}
                    </div>
                    <div class="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={page === 1}
                            onclick={() => page--}
                        >
                            Previous
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={page * limit >= totalItems}
                            onclick={() => page++}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            {/if}
        {/if}
    </div>
{:else}
    <div class="space-y-4 border rounded-lg p-4 bg-gray-50">
        <div
            class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
        >
            <h3
                class="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2"
            >
                <Icon size={16} />
                {showSelector ? linkItemLabel : associatedItemLabel}
            </h3>
            <div class="flex gap-2 flex-wrap">
                {#if !singleSelect || associatedItems.length === 0}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onclick={toggleSelector}
                    class="flex items-center gap-1"
                >
                    {#if showSelector}
                        <X size={16} />
                        <span class="hidden sm:inline">{closeSearchLabel}</span>
                        <span class="sm:hidden">{closeSearchLabel}</span>
                    {:else}
                        <Link size={16} />
                        <span class="hidden sm:inline">{linkItemLabel}</span>
                        <span class="sm:hidden">{linkItemLabel}</span>
                    {/if}
                </Button>
                {/if}
                {#if renderForm}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onclick={() => (showQuickCreate = !showQuickCreate)}
                        class="flex items-center gap-1"
                    >
                        <Plus size={16} />
                        <span class="hidden sm:inline">{quickCreateLabel}</span>
                        <span class="sm:hidden">{quickCreateLabel}</span>
                    </Button>
                {/if}
            </div>
        </div>

        {#if showSelector}
            <div class="bg-white border rounded-lg p-3 shadow-inner space-y-3">
                <div class="relative">
                    <Search
                        size={16}
                        class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        bind:value={searchQuery}
                        class="pl-9 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div class="max-h-64 overflow-y-auto space-y-1">
                    {#if loadingSearch}
                        <div class="text-xs text-center py-4 text-gray-400">
                            {loadingLabel}
                        </div>
                    {:else if filteredItems.length === 0}
                        <div class="text-xs text-center py-4 text-gray-400">
                            {noItemsFoundLabel}
                        </div>
                    {:else}
                        {#each filteredItems as item}
                            {@const isAssociated = associatedItems.some(
                                (ai) => ai.id === item.id,
                            )}
                            <div
                                class="flex items-center gap-2 group/item transition-colors rounded-md p-1 {isAssociated
                                    ? 'bg-blue-50'
                                    : 'hover:bg-gray-100'}"
                            >
                                <div class="flex-1 px-2 py-1">
                                    <span
                                        class="text-sm font-medium {isAssociated
                                            ? 'text-blue-700'
                                            : 'text-gray-700'}"
                                    >
                                        {#if renderItemLabel}
                                            {@render renderItemLabel(item)}
                                        {/if}
                                    </span>
                                </div>

                                <div class="flex items-center gap-1">
                                    <AsyncButton
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        class="h-8 px-2 text-gray-400 hover:text-blue-500"
                                        loading={linkingItemId === item.id}
                                        loadingLabel=""
                                        onclick={() => toggleAssociation(item)}
                                        title={isAssociated ? unlinkLabel : linkItemLabel}
                                    >
                                        {#if isAssociated}
                                            <Unlink size={14} />
                                        {:else}
                                            <Link size={14} />
                                        {/if}
                                    </AsyncButton>
                                    {#if deleteItemRemote}
                                        <AsyncButton
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-8 px-2 text-gray-400 hover:text-red-500"
                                            loading={deletingItemId === item.id}
                                            loadingLabel=""
                                            onclick={() => deleteItem(item)}
                                            title={deleteForeverLabel}
                                        >
                                            <Trash2 size={14} />
                                        </AsyncButton>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
        {:else}
            <!-- Home Mode -->
            {#if fetchingAssociations}
                <div class="text-xs text-center py-4 text-gray-400">
                    {loadingLabel}
                </div>
            {:else if associatedItems.length > 0}
                <div class="space-y-1">
                    {#each associatedItems as item}
                        <div
                            class="flex items-center gap-2 group/item transition-colors rounded-md p-1 hover:bg-gray-100"
                        >
                            <div class="flex-1 px-2 py-1">
                                <span class="text-sm font-medium text-gray-700">
                                    {#if renderItemLabel}
                                        {@render renderItemLabel(item)}
                                    {/if}
                                </span>
                            </div>

                            {#if participationSnippet}
                                {@render participationSnippet(item)}
                            {/if}

                            <div class="flex items-center gap-1">
                                {#if updateRemote && renderForm && getFormData}
                                    <button
                                        type="button"
                                        class="h-8 px-2 text-gray-400 hover:text-blue-500 transition-colors"
                                        onclick={() => {
                                            editingItem = item;
                                            showQuickCreate = false;
                                            showSelector = false;
                                        }}
                                        title={editLabel}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                {/if}
                                <AsyncButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="h-8 px-2 text-gray-400 hover:text-red-500"
                                    loading={linkingItemId === item.id}
                                    loadingLabel=""
                                    onclick={() => toggleAssociation(item)}
                                    title={confirmUnlinkLabel}
                                >
                                    <Unlink size={14} />
                                </AsyncButton>
                                {#if deleteItemRemote}
                                    <AsyncButton
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        class="h-8 px-2 text-gray-400 hover:text-red-500"
                                        loading={deletingItemId === item.id}
                                        loadingLabel=""
                                        onclick={() => deleteItem(item)}
                                        title={deleteForeverLabel}
                                    >
                                        <Trash2 size={14} />
                                    </AsyncButton>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="text-sm text-gray-500 italic">
                    {noItemsLabel}
                </p>
            {/if}
        {/if}
    </div>
{/if}

<!-- Dialog for Create/Edit (shared by both modes) -->
{#if renderForm}
    <Dialog.Root
        open={showQuickCreate || editingItem !== null}
        onOpenChange={(open: boolean) => {
            if (!open) {
                showQuickCreate = false;
                editingItem = null;
            }
        }}
    >
        <Dialog.Content
            style="max-height: 85vh; max-width: 900px; width: calc(100vw - 2rem); display: flex; flex-direction: column; overflow: hidden;"
        >
            <Dialog.Header class="mb-4" style="flex-shrink: 0;">
                <Dialog.Title class="text-xl font-bold">
                    {editingItem ? editLabel : quickCreateLabel}
                </Dialog.Title>
            </Dialog.Header>

            <div style="overflow-y: auto; flex: 1; min-height: 0;">
                {#if editingItem && getFormData}
                    {@render renderForm({
                        remoteFunction: updateRemote,
                        schema: updateSchema,
                        initialData: getFormData(editingItem),
                        onSuccess: handleInPlaceUpdateSuccess,
                        onCancel: () => {
                            editingItem = null;
                        },
                        id: editingItem.id,
                    })}
                {:else if showQuickCreate}
                    {@render renderForm({
                        remoteFunction: createRemote,
                        schema: createSchema,
                        onSuccess: handleQuickCreateSuccess,
                        onCancel: () => {
                            showQuickCreate = false;
                        },
                    })}
                {/if}
            </div>
        </Dialog.Content>
    </Dialog.Root>
{/if}
