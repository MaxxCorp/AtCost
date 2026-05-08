<script lang="ts" generics="T extends { id?: string | null; name?: string }">
    import { onMount, type Component, type Snippet } from "svelte";
    import type { FilterDefinition, FilterAssociation, ListItemContext } from "./EntityManager.types";
    import {
        Search,
        Plus,
        Link,
        Unlink,
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



    interface Props<T extends { id?: string | null; name?: string }> {
        title: string;
        icon: Component<any>;
        mode?: "embedded" | "standalone";
        type?: string;
        entityId?: string | null;
        singleSelect?: boolean;
        onchange?: (ids: string[], items: T[]) => void;

        // Data fetchers
        listItemsRemote: (
            params?: any,
        ) => Promise<T[] | { data: T[]; total?: number }>;
        fetchAssociationsRemote?: (params: {
            type: any;
            entityId: string;
        }) => Promise<T[] | { data: T[]; total?: number }>;
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
        renderListItem?: Snippet<[T, ListItemContext<T>]>;
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
        createLabel?: string;
        quickCreateLabel?: string;
        createHref?: string;
        showCreateButton?: boolean;
        showQuickCreateButton?: boolean;
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
        createLabel = `Create ${title}`,
        quickCreateLabel = "Quick Create",
        createHref,
        showCreateButton = true,
        showQuickCreateButton = true,
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

    const isStandalone = $derived(mode === "standalone");

    let page = $state(1);
    let limit = $state(50);
    let searchQuery = $state("");

    // Filter persistence
    const storageKey = $derived(
        `em-filters-${title.toLowerCase().replace(/\s+/g, "-")}`,
    );
    let selectedFilters = $state<Record<string, string[]>>({});
    const activeFiltersCount = $derived(
        Object.values(selectedFilters).filter((v) => v.length > 0).length,
    );

    onMount(() => {
        if (typeof window !== "undefined") {
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
        if (typeof window !== "undefined") {
            localStorage.setItem(storageKey, JSON.stringify(selectedFilters));
        }
    });

    let refreshCounter = $state(0);

    const currentParams = $derived({
        page,
        limit,
        search: searchQuery,
        refreshCounter,
        ...selectedFilters,
    });

    // --- PROMISES ---
    
    function normalize(res: T[] | { data: T[]; total?: number }) {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        const total = Array.isArray(res) ? res.length : (res?.total ?? data.length);
        return { data, total };
    }

    // Main list promise (Standalone list OR Embedded selector)
    const listPromise = $derived.by(() => {
        if (isStandalone || showSelector) {
            void refreshCounter; // track
            return listItemsRemote(currentParams).then(normalize);
        }
        return Promise.resolve({ data: [], total: 0 });
    });

    // Embedded associations promise
    const associationsPromise = $derived.by(() => {
        if (!isStandalone) {
            void refreshCounter; // track
            if (entityId && type) {
                if (fetchAssociationsRemote) {
                    return fetchAssociationsRemote({ type, entityId }).then(normalize);
                } else {
                    return listItemsRemote({ 
                        associatedWith: { type, id: entityId } 
                    }).then(normalize);
                }
            }
            // Fallback to local state if no remote entity or not fetching
            return Promise.resolve({ data: localAssociatedItems, total: localAssociatedItems.length });
        }
        return Promise.resolve({ data: [], total: 0 });
    });

    // --- STATE ---
    let localAssociatedItems = $state<T[]>(initialItems ?? []);
    let showSelector = $state(false);
    function toggleSelector() {
        showSelector = !showSelector;
    }
    let showQuickCreate = $state(false);
    let linkingItemId = $state<string | null>(null);
    let deletingItemId = $state<string | null>(null);
    let editingItem = $state<any | null>(null);
    let selectedIds = $state<Set<string>>(new Set());
    let bulkDeleting = $state(false);

    // --- HELPERS ---
    const effectiveFilters = $derived([
        ...filters,
        ...filterAssociations.map((assoc) => ({
            id: assoc.id,
            label: assoc.label,
            type: "select" as const,
            optionsRemote: async (params: any) => {
                const result = await assoc.listRemote(params);
                const { data } = normalize(result as any);
                return data.map((item: any) => ({
                    label: assoc.getOptionLabel(item),
                    value: item.id,
                }));
            },
        })),
    ]);

    function isAssociated(item: T, list: T[]) {
        return list.some((ai) => {
            if (item.id && ai.id) return ai.id === item.id;
            if (item.name && ai.name) return ai.name === item.name;
            return false;
        });
    }

    function toggleSelection(id: string) {
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
        } else {
            selectedIds.add(id);
        }
        selectedIds = new Set(selectedIds);
    }

    function selectAll(items: T[]) {
        selectedIds = new Set(items.map((i: any) => i.id!).filter(Boolean));
    }

    function deselectAll() {
        selectedIds = new Set();
    }

    async function toggleAssociation(item: T, currentList: T[]) {
        linkingItemId = item.id ?? null;
        const associated = isAssociated(item, currentList);
        
        try {
            if (associated) {
                if (entityId && removeAssociationRemote) {
                    await removeAssociationRemote({
                        type: type!,
                        entityId,
                        itemId: item.id!,
                    });
                }
                const newList = currentList.filter((ai) => {
                    if (item.id && ai.id) return ai.id !== item.id;
                    if (item.name && ai.name) return ai.name !== item.name;
                    return true;
                });
                localAssociatedItems = newList;
                onchange?.(newList.map(i => i.id!).filter(Boolean), newList);
            } else {
                if (singleSelect) {
                    if (entityId && removeAssociationRemote) {
                        for (const existing of currentList) {
                            if (existing.id) {
                                await removeAssociationRemote({
                                    type: type!,
                                    entityId,
                                    itemId: existing.id,
                                });
                            }
                        }
                    }
                    if (entityId && addAssociationRemote) {
                        await addAssociationRemote({
                            type: type!,
                            entityId,
                            itemId: item.id!,
                        });
                    }
                    const newList = [item];
                    localAssociatedItems = newList;
                    onchange?.(newList.map(i => i.id!).filter(Boolean), newList);
                    showSelector = false;
                } else {
                    if (entityId && addAssociationRemote) {
                        await addAssociationRemote({
                            type: type!,
                            entityId,
                            itemId: item.id!,
                        });
                    }
                    const newList = [...currentList, item];
                    localAssociatedItems = newList;
                    onchange?.(newList.map(i => i.id!).filter(Boolean), newList);
                }
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to update association");
        } finally {
            linkingItemId = null;
        }
    }

    async function deleteItem(item: T, currentList: T[]) {
        if (!item.id || !deleteItemRemote) return;
        deletingItemId = item.id;
        try {
            const result = await deleteItemRemote([item.id]);
            const success = result === true || (result && result.success !== false);
            if (!success) return;

            const newList = currentList.filter((i) => i.id !== item.id);
            localAssociatedItems = newList;
            onchange?.(newList.map(i => i.id!).filter(Boolean), newList);
            
            if (result !== true) {
                toast.success("Deleted successfully");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to delete item");
        } finally {
            deletingItemId = null;
        }
    }

    async function bulkDelete(items: T[]) {
        if (!deleteItemRemote || selectedIds.size === 0) return;
        bulkDeleting = true;
        try {
            const result = await deleteItemRemote(Array.from(selectedIds));
            const success = result === true || (result && result.success !== false);
            if (!success) return;

            const newList = items.filter((i) => !selectedIds.has(i.id!));
            localAssociatedItems = newList;
            onchange?.(newList.map(i => i.id!).filter(Boolean), newList);
            deselectAll();
            
            if (result !== true) {
                toast.success(`Deleted successfully`);
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to delete some items");
        } finally {
            bulkDeleting = false;
        }
    }

    async function handleQuickCreateSuccess(result: any, currentList: T[]) {
        showQuickCreate = false;
        const newId = result?.id || result?.tag?.id || result?.data?.id;

        if (newId) {
            const res = await listItemsRemote(currentParams);
            const { data: items } = normalize(res);
            const newItem = items.find((i: any) => i.id === newId);

            if (isStandalone) {
                toast.success(`${title} created`);
                refreshCounter++;
            } else if (newItem) {
                if (entityId && addAssociationRemote) {
                    await addAssociationRemote({
                        type: type!,
                        entityId,
                        itemId: newItem.id!,
                    });
                }
                const newList = [newItem, ...currentList];
                localAssociatedItems = newList;
                onchange?.(newList.map(i => i.id!).filter(Boolean), newList);
                toast.success(`${title} created and associated`);
                refreshCounter++;
            }
        }
    }

    async function handleInPlaceUpdateSuccess(result: any, currentList: T[]) {
        const targetId = editingItem?.id;
        editingItem = null;
        if (!targetId) return;

        const res = await listItemsRemote(currentParams);
        const { data: items } = normalize(res);
        const updatedItem = items.find((i: any) => i.id === targetId);

        if (updatedItem) {
            const newList = currentList.map((i) => (i.id === targetId ? updatedItem : i));
            localAssociatedItems = newList;
            onchange?.(newList.map(i => i.id!).filter(Boolean), newList);
            toast.success(`${title} updated`);
            refreshCounter++;
        }
    }
</script>

<!-- Action Bar (Search, Filter, Actions) -->
<div class="flex flex-col gap-3 {isStandalone ? 'mb-4' : 'mb-3'}">
    <div class="flex flex-col md:flex-row gap-3">
        <div class="relative flex-1">
            <Search
                size={isStandalone ? 16 : 14}
                class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
                type="text"
                placeholder={searchPlaceholder}
                bind:value={searchQuery}
                class="pl-9 w-full {isStandalone
                    ? 'px-3 py-2'
                    : 'px-2 py-1.5'} border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all bg-gray-50/50"
            />
        </div>

        <div class="flex items-center gap-2">
            {#if effectiveFilters.length > 0}
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                        <Button
                            variant="outline"
                            size={isStandalone ? "icon" : "sm"}
                            class="relative border-gray-200 rounded-xl hover:bg-gray-50"
                        >
                            <FilterIcon size={isStandalone ? 18 : 16} />

                            {#if activeFiltersCount > 0}
                                <span
                                    class="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white"
                                >
                                    {activeFiltersCount}
                                </span>
                            {/if}
                        </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content
                        align="end"
                        class="min-w-[200px] rounded-2xl shadow-xl border-gray-100 p-1"
                    >
                        <DropdownMenu.Label
                            class="text-xs font-bold uppercase tracking-wider text-gray-400 px-3 py-2"
                            >System Filters</DropdownMenu.Label
                        >
                        <DropdownMenu.Separator class="bg-gray-50" />
                        {#each effectiveFilters as filter}
                            <DropdownMenu.Sub>
                                <DropdownMenu.SubTrigger
                                    class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg"
                                >
                                    <span>{filter.label}</span>
                                    {#if selectedFilters[filter.id]?.length > 0}
                                        <span
                                            class="ml-auto text-[10px] py-0.5 px-2 h-4 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center font-bold"
                                        >
                                            {selectedFilters[filter.id].length}
                                        </span>
                                    {/if}
                                </DropdownMenu.SubTrigger>
                                <DropdownMenu.SubContent
                                    class="w-56 p-1 max-h-[300px] overflow-y-auto rounded-xl shadow-lg border-gray-100"
                                >
                                    {#await filter.optionsRemote( { limit: 100 }, )}
                                        <div
                                            class="p-3 text-xs text-muted-foreground animate-pulse text-center"
                                        >
                                            Loading options...
                                        </div>
                                    {:then options}
                                        {@const items = Array.isArray(options)
                                            ? options
                                            : options?.data || []}
                                        {#each items as option}
                                            <DropdownMenu.CheckboxItem
                                                class="rounded-lg"
                                                checked={selectedFilters[
                                                    filter.id
                                                ]?.includes(option.value)}
                                                onCheckedChange={(checked) => {
                                                    const current =
                                                        selectedFilters[
                                                            filter.id
                                                        ] || [];
                                                    if (checked) {
                                                        selectedFilters[
                                                            filter.id
                                                        ] = [
                                                            ...current,
                                                            option.value,
                                                        ];
                                                    } else {
                                                        selectedFilters[
                                                            filter.id
                                                        ] = current.filter(
                                                            (v) =>
                                                                v !==
                                                                option.value,
                                                        );
                                                        if (
                                                            selectedFilters[
                                                                filter.id
                                                            ].length === 0
                                                        ) {
                                                            delete selectedFilters[
                                                                filter.id
                                                            ];
                                                        }
                                                    }
                                                    selectedFilters = {
                                                        ...selectedFilters,
                                                    };
                                                    page = 1;
                                                }}
                                            >
                                                {option.label}
                                            </DropdownMenu.CheckboxItem>
                                        {/each}
                                        {#if (Array.isArray(options) ? options : (options?.data ?? [])).length === 0}
                                            <div
                                                class="p-3 text-xs text-muted-foreground text-center italic"
                                            >
                                                No options found
                                            </div>
                                        {/if}
                                    {/await}
                                </DropdownMenu.SubContent>
                            </DropdownMenu.Sub>
                        {/each}
                        {#if activeFiltersCount > 0}
                            <DropdownMenu.Separator class="bg-gray-50" />
                            <DropdownMenu.Item
                                onclick={() => {
                                    selectedFilters = {};
                                    page = 1;
                                }}
                                class="text-red-600 justify-center font-bold text-xs py-2 hover:bg-red-50 rounded-lg"
                            >
                                Clear All Filters
                            </DropdownMenu.Item>
                        {/if}
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            {/if}

            {#if filtersSnippet}
                {@render filtersSnippet()}
            {/if}

            {#if isStandalone && showCreateButton && (renderForm || createHref)}
                <div class="flex items-center gap-1.5 ml-auto">
                    {#if renderForm}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onclick={() => (showQuickCreate = !showQuickCreate)}
                            class="h-9 px-3 text-gray-500 hover:bg-gray-100 rounded-xl"
                        >
                            <Plus size={16} class="mr-1.5" />
                            <span class="text-sm font-semibold"
                                >{createLabel}</span
                            >
                        </Button>
                    {:else if createHref}
                        <Button
                            href={createHref}
                            variant="ghost"
                            size="sm"
                            class="h-9 px-3 text-gray-500 hover:bg-gray-100 rounded-xl"
                        >
                            <Plus size={16} class="mr-1.5" />
                            <span class="text-sm font-semibold"
                                >{createLabel}</span
                            >
                        </Button>
                    {/if}
                </div>
            {:else if !isStandalone}
                <div class="flex items-center gap-1.5 ml-auto">
                    {#await associationsPromise then { data: currentAssociations }}
                        {#if !singleSelect || currentAssociations.length === 0}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onclick={toggleSelector}
                                class="h-9 px-3 rounded-xl {showSelector
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-gray-500 hover:bg-gray-100'}"
                            >
                                {#if showSelector}
                                    <X size={16} class="mr-1.5" />
                                    <span class="text-sm font-semibold"
                                        >{closeSearchLabel}</span
                                    >
                                {:else}
                                    <Link size={16} class="mr-1.5" />
                                    <span class="text-sm font-semibold"
                                        >{linkItemLabel}</span
                                    >
                                {/if}
                            </Button>
                        {/if}
                    {/await}
                    {#if renderForm && showQuickCreateButton}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onclick={() => (showQuickCreate = !showQuickCreate)}
                            class="h-9 px-3 text-gray-500 hover:bg-gray-100 rounded-xl"
                        >
                            <Plus size={16} class="mr-1.5" />
                            <span class="text-sm font-semibold"
                                >{quickCreateLabel}</span
                            >
                        </Button>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>

{#if showSelector && !isStandalone}
    <div
        class="bg-white border-2 border-blue-50 rounded-2xl p-2 mb-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
    >
        <div class="max-h-64 overflow-y-auto space-y-1 p-1">
            {#await listPromise}
                <div class="text-xs text-center py-8 text-gray-400 font-medium">
                    <div
                        class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"
                    ></div>
                    {loadingLabel}
                </div>
            {:then { data: allItems }}
                {@const filteredItems = searchPredicate ? allItems.filter(i => searchPredicate(i, searchQuery)) : allItems}
                {#if filteredItems.length === 0}
                    <div
                        class="text-xs text-center py-8 text-gray-400 font-medium italic"
                    >
                        {noItemsFoundLabel}
                    </div>
                {:else}
                    {#await associationsPromise then { data: currentAssociations }}
                        {#each filteredItems as item}
                            {@const isLinked = isAssociated(item, currentAssociations)}
                            <div
                                class="flex items-center gap-3 transition-all rounded-xl p-2 {isLinked
                                    ? 'bg-blue-50/50'
                                    : 'hover:bg-gray-50'}"
                            >
                                <div class="flex-1 min-w-0">
                                    <div
                                        class="text-sm font-bold {isLinked
                                            ? 'text-blue-700'
                                            : 'text-gray-900'} truncate"
                                    >
                                        {#if renderItemLabel}
                                            {@render renderItemLabel(item)}
                                        {:else}
                                            {item.name || item.id || "Unnamed Item"}
                                        {/if}
                                    </div>
                                    {#if renderItemBadge}
                                        <div class="mt-0.5">
                                            {@render renderItemBadge(item)}
                                        </div>
                                    {/if}
                                </div>

                                <div class="flex items-center gap-1">
                                    <AsyncButton
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        class="h-8 w-8 p-0 rounded-lg {isLinked
                                            ? 'text-blue-600 bg-blue-100/50'
                                            : 'text-gray-400 hover:text-blue-500'}"
                                        loading={linkingItemId === item.id}
                                        loadingLabel=""
                                        onclick={() => { void toggleAssociation(item, currentAssociations); }}
                                        title={isLinked
                                            ? unlinkLabel
                                            : linkItemLabel}
                                    >
                                        {#if isLinked}
                                            <Unlink size={16} />
                                        {:else}
                                            <Link size={16} />
                                        {/if}
                                    </AsyncButton>
                                    {#if deleteItemRemote}
                                        <AsyncButton
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-8 w-8 p-0 rounded-lg text-gray-400 hover:text-red-500"
                                            loading={deletingItemId === item.id}
                                            loadingLabel=""
                                            onclick={() => { void deleteItem(item, currentAssociations); }}
                                            title={deleteForeverLabel}
                                        >
                                            <Trash2 size={16} />
                                        </AsyncButton>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    {/await}
                {/if}
            {:catch error}
                <div class="text-xs text-center py-8 text-red-500 font-medium">
                    {error.message || "Failed to load items"}
                </div>
            {/await}
        </div>
    </div>
{/if}

{#if isStandalone}
    {#await listPromise}
        <div class="text-center py-20 text-gray-400 font-medium animate-pulse">
            {loadingLabel}
        </div>
    {:then { data: items, total }}
        {#if items.length === 0 && !searchQuery && activeFiltersCount === 0}
            <div class="py-10">
                <EmptyState
                    icon={Icon}
                    title={emptyTitle || `No ${title}`}
                    description={emptyDescription ||
                        `No ${title.toLowerCase()} were found in this selection.`}
                    actionLabel={emptyActionLabel ||
                        `Create First ${title.replace(/s$/, "")}`}
                    onclick={renderForm
                        ? () => (showQuickCreate = true)
                        : undefined}
                    actionHref={!renderForm ? createHref : undefined}
                />
            </div>
        {:else if items.length === 0}
            <div
                class="text-center py-20 text-gray-400 font-medium italic bg-gray-50/50 rounded-2xl border border-dashed border-gray-200"
            >
                {noItemsFoundLabel}
            </div>
        {:else}
            <div class="grid gap-4">
                {#each items as item (item.id)}
                    {#if renderListItem}
                        {@render renderListItem(item, {
                            isSelected: selectedIds.has(item.id!),
                            toggleSelection,
                            deleteItem: (i: T) => { void deleteItem(i, items); },
                            isAssociated: true,
                            toggleAssociation: (i: T) => { void toggleAssociation(i, items); },
                            singleSelect,
                        })}
                    {:else}
                        <div
                            class="bg-white rounded-2xl p-5 flex items-center gap-6 border border-gray-100 hover:shadow-xl hover:border-blue-100 transition-all group/item"
                        >
                            {#if !singleSelect}
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(item.id!)}
                                    onchange={() => toggleSelection(item.id!)}
                                    class="w-5 h-5 text-blue-600 rounded-lg border-gray-200 focus:ring-blue-500 transition-all cursor-pointer"
                                />
                            {/if}

                            <div class="flex-1 min-w-0">
                                <div
                                    class="text-lg font-black text-gray-900 group-hover/item:text-blue-600 transition-colors"
                                >
                                    {#if renderItemLabel}
                                        {@render renderItemLabel(item)}
                                    {:else}
                                        {item.name || item.id}
                                    {/if}
                                </div>
                                <div
                                    class="flex flex-wrap items-center gap-3 mt-1.5"
                                >
                                    {#if renderItemBadge}
                                        {@render renderItemBadge(item)}
                                    {/if}
                                    {#if renderItemDetail}
                                        <div
                                            class="text-xs font-bold text-gray-400 uppercase tracking-widest"
                                        >
                                            {@render renderItemDetail(item)}
                                        </div>
                                    {/if}
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                {#if updateRemote && renderForm && getFormData}
                                    <button
                                        type="button"
                                        class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                        onclick={() => {
                                            editingItem = item;
                                        }}
                                        title={editLabel}
                                    >
                                        <Pencil size={20} />
                                    </button>
                                {/if}
                                {#if deleteItemRemote}
                                    <AsyncButton
                                        type="button"
                                        variant="ghost"
                                        class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                        loading={deletingItemId === item.id}
                                        loadingLabel=""
                                        onclick={() => deleteItem(item, items)}
                                        title={deleteLabel}
                                    >
                                        <Trash2 size={20} />
                                    </AsyncButton>
                                {/if}
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>

            {#if total > limit}
                <div
                    class="flex flex-col sm:flex-row justify-between items-center py-6 gap-4 border-t border-gray-50 mt-6"
                >
                    <div
                        class="text-xs font-bold text-gray-400 uppercase tracking-widest"
                    >
                        Showing <span class="text-gray-900"
                            >{(page - 1) * limit + 1}</span
                        >
                        to
                        <span class="text-gray-900"
                            >{Math.min(page * limit, total)}</span
                        >
                        of <span class="text-gray-900">{total}</span>
                    </div>
                    <div class="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            class="rounded-xl font-bold px-4 hover:bg-gray-50"
                            disabled={page === 1}
                            onclick={() => {
                                page--;
                                window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            class="rounded-xl font-bold px-4 hover:bg-gray-50"
                            disabled={page * limit >= total}
                            onclick={() => {
                                page++;
                                window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            {/if}
        {/if}
    {:catch error}
        <div class="text-center py-20 text-red-500 font-medium">
            {error.message || "Failed to load items"}
        </div>
    {/await}
{:else}
    <!-- Embedded Content -->
    <div class="space-y-2">
        {#await associationsPromise}
            <div
                class="text-center py-10 animate-pulse text-gray-400 font-medium"
            >
                <div
                    class="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"
                ></div>
                {loadingLabel}
            </div>
        {:then { data: currentAssociations }}
            {@const items = searchPredicate ? currentAssociations.filter((i: any) => searchPredicate(i, searchQuery)) : currentAssociations}
            {#if items.length > 0}
                <div class="grid gap-2">
                    {#each items as item (item.id)}
                        <div
                            class="flex items-center gap-3 transition-all rounded-2xl p-3 border border-gray-100 hover:border-blue-100 hover:shadow-sm bg-white group/assoc"
                        >
                            <div class="flex-1 min-w-0">
                                <div
                                    class="text-sm font-bold text-gray-900 group-hover/assoc:text-blue-600 transition-colors truncate"
                                >
                                    {#if renderItemLabel}
                                        {@render renderItemLabel(item)}
                                    {:else}
                                        {item.name || item.id}
                                    {/if}
                                </div>
                                <div class="flex items-center gap-2 mt-0.5">
                                    {#if renderItemBadge}
                                        {@render renderItemBadge(item)}
                                    {/if}
                                    {#if renderItemDetail}
                                        <div
                                            class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter"
                                        >
                                            {@render renderItemDetail(item)}
                                        </div>
                                    {/if}
                                </div>
                            </div>

                            {#if participationSnippet}
                                {@render participationSnippet(item)}
                            {/if}

                            <div class="flex items-center gap-1">
                                {#if updateRemote && renderForm && getFormData}
                                    <button
                                        type="button"
                                        class="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                        onclick={() => {
                                            editingItem = item;
                                        }}
                                        title={editLabel}
                                    >
                                        <Pencil size={15} />
                                    </button>
                                {/if}
                                <AsyncButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="h-8 w-8 p-0 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                    loading={linkingItemId === item.id}
                                    loadingLabel=""
                                    onclick={() => toggleAssociation(item, currentAssociations)}
                                    title={confirmUnlinkLabel}
                                >
                                    <Unlink size={15} />
                                </AsyncButton>
                                {#if deleteItemRemote}
                                    <AsyncButton
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        class="h-8 w-8 p-0 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                        loading={deletingItemId === item.id}
                                        loadingLabel=""
                                        onclick={() => deleteItem(item, currentAssociations)}
                                        title={deleteForeverLabel}
                                    >
                                        <Trash2 size={15} />
                                    </AsyncButton>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <div
                    class="bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl p-8 text-center"
                >
                    <p class="text-sm font-medium text-gray-400 italic">
                        {noItemsLabel}
                    </p>
                </div>
            {/if}
        {:catch error}
            <div class="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                <p class="text-sm font-medium text-red-600">
                    {error.message || "Failed to load associations"}
                </p>
            </div>
        {/await}
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
                {#await isStandalone ? listPromise : associationsPromise then res}
                    {@const currentList = res?.data ?? []}
                    {#if editingItem && getFormData}
                        {@render renderForm({
                            remoteFunction: updateRemote,
                            schema: updateSchema,
                            initialData: getFormData(editingItem),
                            onSuccess: (result) => { void handleInPlaceUpdateSuccess(result, currentList); },
                            onCancel: () => {
                                editingItem = null;
                            },
                            id: editingItem.id,
                        })}
                    {:else if showQuickCreate}
                        {@render renderForm({
                            remoteFunction: createRemote,
                            schema: createSchema,
                            onSuccess: (result) => { void handleQuickCreateSuccess(result, currentList); },
                            onCancel: () => {
                                showQuickCreate = false;
                            },
                        })}
                    {/if}
                {/await}
            </div>
        </Dialog.Content>
    </Dialog.Root>
{/if}
