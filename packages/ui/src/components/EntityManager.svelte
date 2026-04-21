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
        optionsRemote: (
            params?: any,
        ) => Promise<any[] | { data: any[]; total: number }>;
        options?: { value: string; label: string }[];
    }

    export interface FilterAssociation {
        id: string;
        label: string;
        listRemote: (
            params?: any,
        ) => Promise<any[] | { data: any[]; total: number }>;
        getOptionLabel: (item: any) => string;
    }

    interface Props<T extends { id?: string | null }> {
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
        renderListItem?: Snippet<
            [
                T,
                {
                    isSelected: boolean;
                    toggleSelection: (id: string) => void;
                    deleteItem: (item: T) => void;
                    isAssociated: boolean;
                    toggleAssociation: (item: T) => void;
                    singleSelect: boolean;
                },
            ]
        >;
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

    const effectiveFilters = $derived([
        ...filters,
        ...filterAssociations.map((assoc) => ({
            id: assoc.id,
            label: assoc.label,
            type: "select" as const,
            optionsRemote: async (params: any) => {
                const result = await assoc.listRemote(params);
                const items = Array.isArray(result) ? result : result.data;
                return items.map((item) => ({
                    label: assoc.getOptionLabel(item),
                    value: item.id,
                }));
            },
        })),
    ]);

    const isStandalone = $derived(mode === "standalone");

    let page = $state(1);
    let limit = $state(50);
    let totalItems = $state(0);

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

    let filterOptions = $state<
        Record<string, { value: string; label: string }[]>
    >({});

    $effect(() => {
        if (filters && filters.length > 0) {
            for (const filter of filters) {
                if (filter.optionsRemote) {
                    filter.optionsRemote().then((opts) => {
                        const items = Array.isArray(opts) ? opts : opts.data;
                        filterOptions[filter.id] = items;
                    });
                } else if (filter.options) {
                    filterOptions[filter.id] = filter.options;
                }
            }
        }
    });

    const currentParams = $derived({
        page,
        limit,
        search: searchQuery,
        ...selectedFilters,
    });

    const fetchQuery = $derived(
        !isStandalone && entityId && type && fetchAssociationsRemote
            ? fetchAssociationsRemote({ type, entityId })
            : null,
    );

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
            : associatedItems.filter((item) => {
                  // Search
                  if (
                      searchQuery &&
                      searchPredicate &&
                      !searchPredicate(item, searchQuery)
                  ) {
                      return false;
                  }

                  // Filters
                  for (const [key, values] of Object.entries(selectedFilters)) {
                      if (!values || values.length === 0) continue;

                      // Check if the item has the property directly
                      if (
                          item[key] !== undefined &&
                          !values.includes(item[key])
                      ) {
                          return false;
                      }

                      // Fallback for nested objects if key might be an ID but item has object
                      // (e.g. key is 'locationId' and item has 'location: { id: ... }')
                      if (key.endsWith("Id")) {
                          const objKey = key.slice(0, -2);
                          if (
                              item[objKey]?.id !== undefined &&
                              !values.includes(item[objKey].id)
                          ) {
                              return false;
                          }
                      }
                  }

                  return true;
              }),
    );

    let fetchingAssociations = $state(false);

    $effect(() => {
        if (
            !isStandalone &&
            initialItems !== undefined &&
            !fetchAssociationsRemote &&
            !loadingItems
        ) {
            associatedItems = initialItems;
        }
    });

    $effect(() => {
        if (fetchQuery) {
            fetchingAssociations = true;
            fetchQuery
                .then((data: any) => {
                    associatedItems = data;
                    fetchingAssociations = false;
                })
                .catch((err: any) => {
                    console.error("Failed to fetch associations", err);
                    fetchingAssociations = false;
                });
        }
    });

    const refresh = async () => {
        loadingItems = true;
        try {
            const res = await listItemsRemote(currentParams);
            untrack(() => {
                associatedItems = Array.isArray(res) ? res : (res?.data ?? []);
                totalItems = Array.isArray(res)
                    ? res.length
                    : (res?.total ?? associatedItems.length);
            });
        } catch (e) {
            console.error("Failed to load items", e);
        } finally {
            loadingItems = false;
        }
    };

    $effect(() => {
        if (isStandalone) {
            // Trigger refresh on params change
            currentParams;
            refresh();
        } else if (showSelector) {
            // In embedded mode, if selector is open, refresh allItems when filters or search change
            refreshAllItems();
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
            const result = await deleteItemRemote(Array.from(selectedIds));
            const success = result === true || (result && result.success !== false);
            if (!success) return;

            associatedItems = associatedItems.filter(
                (i) => !selectedIds.has(i.id),
            );
            allItems = allItems.filter((i) => !selectedIds.has(i.id));
            if (onchange)
                onchange(
                    associatedItems.map((i) => i.id),
                    associatedItems,
                );
            deselectAll();
            // Success toast is usually handled by deleteItemRemote (e.g. handleDelete)
            // but if not, we can show one. However, avoid doubling up.
            if (result !== true) {
                toast.success(`Deleted successfully`);
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to delete some items");
        } finally {
            bulkDeleting = false;
        }
    }

    async function refreshAllItems() {
        loadingSearch = true;
        try {
            const res = await listItemsRemote(currentParams);
            allItems = Array.isArray(res) ? res : (res?.data ?? []);
        } catch (err: any) {
            // Ignore abort errors common in reactive systems
            if (err.name === "AbortError" || err.message?.includes("aborted")) {
                return;
            }
            toast.error(`${noItemsFoundLabel}: ${err.message}`);
        } finally {
            loadingSearch = false;
        }
    }

    async function toggleSelector() {
        showSelector = !showSelector;
        // Effect at line 396 automatically handles the first-time/reactive refresh
    }

    async function toggleAssociation(item: any) {
        linkingItemId = item.id;
        const isAssociated = associatedItems.some((ai) => {
            if (item.id && ai.id) return item.id === ai.id;
            // Fallback for ID-less items (like tags initialized by name)
            return item.name === ai.name;
        });
        try {
            if (isAssociated) {
                if (entityId && removeAssociationRemote) {
                    await removeAssociationRemote({
                        type: type!,
                        entityId,
                        itemId: item.id,
                    });
                }
                associatedItems = associatedItems.filter((ai) => {
                    if (item.id && ai.id) return ai.id !== item.id;
                    return ai.name !== item.name;
                });
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
            if (onchange)
                onchange(
                    associatedItems.map((i) => i.id),
                    associatedItems,
                );
        } catch (error: any) {
            toast.error(error.message || "Failed to update association");
        } finally {
            linkingItemId = null;
        }
    }

    async function handleQuickCreateSuccess(result: any) {
        showQuickCreate = false;

        if (result?.id) {
            const res: any = await listItemsRemote(currentParams);
            const items = Array.isArray(res) ? res : (res?.data ?? []);

            if (isStandalone) {
                associatedItems = items;
                totalItems = Array.isArray(res)
                    ? res.length
                    : (res?.total ?? items.length);
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
                    if (onchange)
                        onchange(
                            associatedItems.map((i) => i.id),
                            associatedItems,
                        );
                    toast.success(`${title} created and associated`);
                }
            }
        }
    }

    async function handleInPlaceUpdateSuccess(result: any) {
        const targetId = editingItem?.id;
        editingItem = null;

        if (!targetId) return;

        const res: any = await listItemsRemote(currentParams);
        const items = Array.isArray(res) ? res : (res?.data ?? []);
        const updatedItem = items.find((i: any) => i.id === targetId);

        if (updatedItem) {
            associatedItems = associatedItems.map((i) => {
                const isMatch = targetId && i.id ? i.id === targetId : i.name === updatedItem.name;
                return isMatch ? updatedItem : i;
            });
            allItems = allItems.map((i) => {
                const isMatch = targetId && i.id ? i.id === targetId : i.name === updatedItem.name;
                return isMatch ? updatedItem : i;
            });
            if (onchange)
                onchange(
                    associatedItems.map((i) => i.id),
                    associatedItems,
                );
            toast.success(`${title} updated`);
        }
    }

    async function deleteItem(item: T) {
        if (!item.id || !deleteItemRemote) return;
        deletingItemId = item.id;
        try {
            console.log(`[EntityManager] Deleting item:`, item.id);
            const result = await deleteItemRemote([item.id]);
            console.log(`[EntityManager] Deletion result:`, result);
            
            // If result is false, it means handleDelete showed its own error or user cancelled
            if (result === false) {
                console.log(`[EntityManager] Deletion was cancelled or failed in the wrapper`);
                return;
            }

            const success = result === true || (result && result.success !== false);
            if (!success) {
                console.log(`[EntityManager] Deletion reported failure:`, result);
                return;
            }

            allItems = allItems.filter((i) => i.id !== item.id);
            associatedItems = associatedItems.filter((i) => i.id !== item.id);
            if (onchange)
                onchange(
                    associatedItems.map((i) => i.id),
                    associatedItems,
                );
            
            // Avoid redundant toast if handleDelete already showed one (result would be true)
            if (result !== true) {
                toast.success("Deleted successfully");
            }
        } catch (e: any) {
            console.error(`[EntityManager] Exception during deleteItem:`, e);
            toast.error(e.message || "Failed to delete item");
        } finally {
            deletingItemId = null;
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
                    {#if !singleSelect || associatedItems.length === 0}
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
            {#if loadingSearch}
                <div class="text-xs text-center py-8 text-gray-400 font-medium">
                    <div
                        class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"
                    ></div>
                    {loadingLabel}
                </div>
            {:else if filteredItems.length === 0}
                <div
                    class="text-xs text-center py-8 text-gray-400 font-medium italic"
                >
                    {noItemsFoundLabel}
                </div>
            {:else}
                {#each filteredItems as item}
                    {@const isAssociated = associatedItems.some((ai) => {
                        if (item.id && ai.id) return ai.id === item.id;
                        return ai.name === item.name;
                    })}
                    <div
                        class="flex items-center gap-3 transition-all rounded-xl p-2 {isAssociated
                            ? 'bg-blue-50/50'
                            : 'hover:bg-gray-50'}"
                    >
                        <div class="flex-1 min-w-0">
                            <div
                                class="text-sm font-bold {isAssociated
                                    ? 'text-blue-700'
                                    : 'text-gray-900'} truncate"
                            >
                                {#if renderItemLabel}
                                    {@render renderItemLabel(item)}
                                {:else}
                                    {item.id || "Unnamed Item"}
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
                                class="h-8 w-8 p-0 rounded-lg {isAssociated
                                    ? 'text-blue-600 bg-blue-100/50'
                                    : 'text-gray-400 hover:text-blue-500'}"
                                loading={linkingItemId === item.id}
                                loadingLabel=""
                                onclick={() => toggleAssociation(item)}
                                title={isAssociated
                                    ? unlinkLabel
                                    : linkItemLabel}
                            >
                                {#if isAssociated}
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
                                    onclick={() => deleteItem(item)}
                                    title={deleteForeverLabel}
                                >
                                    <Trash2 size={16} />
                                </AsyncButton>
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}

{#if isStandalone}
    {#if loadingItems}
        <div class="text-center py-20 text-gray-400 font-medium animate-pulse">
            {loadingLabel}
        </div>
    {:else if associatedItems.length === 0 && !searchQuery && activeFiltersCount === 0}
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
    {:else if displayedItems.length === 0}
        <div
            class="text-center py-20 text-gray-400 font-medium italic bg-gray-50/50 rounded-2xl border border-dashed border-gray-200"
        >
            {noItemsFoundLabel}
        </div>
    {:else}
        <div class="grid gap-4">
            {#each displayedItems as item (item.id)}
                {#if renderListItem}
                    {@render renderListItem(item, {
                        isSelected: selectedIds.has(item.id),
                        toggleSelection,
                        deleteItem,
                        isAssociated: true,
                        toggleAssociation,
                        singleSelect,
                    })}
                {:else}
                    <div
                        class="bg-white rounded-2xl p-5 flex items-center gap-6 border border-gray-100 hover:shadow-xl hover:border-blue-100 transition-all group/item"
                    >
                        {#if !singleSelect}
                            <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onchange={() => toggleSelection(item.id)}
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
                                    {item.id}
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
                                    onclick={() => deleteItem(item)}
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

        {#if totalItems > limit}
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
                        >{Math.min(page * limit, totalItems)}</span
                    >
                    of <span class="text-gray-900">{totalItems}</span>
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
                        disabled={page * limit >= totalItems}
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
{:else}
    <!-- Embedded Content -->
    <div class="space-y-2">
        {#if fetchingAssociations}
            <div
                class="text-center py-10 animate-pulse text-gray-400 font-medium"
            >
                <div
                    class="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"
                ></div>
                {loadingLabel}
            </div>
        {:else if associatedItems.length > 0}
            <div class="grid gap-2">
                {#each associatedItems as item}
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
                                    {item.id}
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
                                onclick={() => toggleAssociation(item)}
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
                                    onclick={() => deleteItem(item)}
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
