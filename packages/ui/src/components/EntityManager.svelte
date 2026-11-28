<script lang="ts" generics="T extends { id?: string | null; name?: string }">
    import { onMount, untrack, type Component, type Snippet } from "svelte";
    import type { ListItemContext, FilterDefinition, FilterAssociation, FilterGroup, FilterStateMap, BooleanFilter, RadioFilterGroup } from "./EntityManager.types";
    // @ts-ignore
    import FilterMenu from "./FilterMenu.svelte";
    // @ts-ignore
    import ActiveFilterChips from "./ActiveFilterChips.svelte";
    import {
        Search,
        Plus,
        Link,
        Unlink,
        Pencil,
        X,
        Trash2,
        Database,
        Loader2,
        MapPin,
        Folder,
        Check,
    } from "@lucide/svelte";

    // @ts-ignore
    import Button from "./button/button.svelte";
    // @ts-ignore
    import AsyncButton from "./AsyncButton.svelte";
    import * as Dialog from "./dialog";
    import { toast } from "svelte-sonner";
    import { sortItemsList, sortHierarchically } from "../utils/hierarchy.js";
    import { getPreference, setPreference } from "../utils/idb.js";
    import { usePromiseOrRemoteQuery } from "../hooks/remoteQueryState.svelte.js";
    import { markLocalEntityMutation } from "../hooks/realtimeSync.svelte.js";
    import BulkActionToolbar from "./BulkActionToolbar.svelte";

    interface Props<T extends { id?: string | null; name?: string }> {
        title: string;
        icon?: Component<any>;
        type?: string;
        entityId?: string;
        mode?: "embedded" | "standalone";
        singleSelect?: boolean;
        onchange?: (ids: string[], items: T[]) => void;

        // Data fetchers
        listItemsRemote: (
            params?: any,
        ) => Promise<T[] | { data: T[]; total?: number }>;
        fetchAssociationsRemote?: (params: {
            type: string;
            entityId: string;
        }) => Promise<T[] | { data: T[]; total?: number }>;
        addAssociationRemote?: (params: {
            type: string;
            entityId: string;
            itemId: string;
        }) => Promise<any>;
        removeAssociationRemote?: (params: {
            type: string;
            entityId: string;
            itemId: string;
        }) => Promise<any>;
        deleteItemRemote?: (ids: string[]) => Promise<any>;
        relatedQueries?: any[];

        // Filters
        filterGroups?: FilterGroup[];
        filterAssociations?: FilterAssociation[];
        filters?: FilterDefinition[];
        booleanFilters?: BooleanFilter[];
        radioGroups?: RadioFilterGroup[];

        // Creation link (standalone mode)
        createHref?: string;
        createLabel?: string;

        // Form Data
        createRemote?: any;
        createSchema?: any;
        updateRemote?: any;
        updateSchema?: any;
        readItemRemote?: (id: string) => Promise<any>;

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
                    isUpdating?: boolean;
                },
            ]
        >;

        // Rendering snippets
        renderItem?: Snippet<[T]>;
        renderItemLabel?: Snippet<[T]>;
        renderItemBadge?: Snippet<[T]>;
        renderItemDetail?: Snippet<[T]>;
        renderSubItems?: Snippet<[T]>;
        participationSnippet?: Snippet<[T]>;
        rolesSnippet?: Snippet<[T]>;
        footerSnippet?: Snippet;
        toolbarActions?: Snippet<[{ items: T[]; count: number }]> | Snippet;

        // Initial state
        initialItems?: T[];

        // Search predicate
        searchPredicate?: (item: T, query: string) => boolean;

        // Grouping props
        groupBy?: ((item: T) => string | string[] | null | undefined) | string;
        selectorGroupBy?: ((item: T) => string | string[] | null | undefined) | string;
        groupIcon?: Component<any>;

        // Sorting props
        sortField?: string;
        sortOrder?: "asc" | "desc";
        selectorSortField?: string;
        selectorSortOrder?: "asc" | "desc";
        hierarchical?: boolean;

        // Localization props
        loadingLabel?: string;
        noItemsLabel?: string;
        noItemsFoundLabel?: string;
        searchPlaceholder?: string;
        linkItemLabel?: string;
        changeItemLabel?: string;
        associatedItemLabel?: string;
        quickCreateLabel?: string;
        showQuickCreateButton?: boolean;
        closeSearchLabel?: string;
        editLabel?: string;
        deleteLabel?: string;
        unlinkLabel?: string;
        deleteForeverLabel?: string;
        confirmUnlinkLabel?: string;
        selectAllLabel?: string;
        deselectAllLabel?: string;
        selectedText?: string;
        deletingLabel?: string;
        filtersLabel?: string;
        preferenceKey?: string;
        m?: any;
    }

    let {
        title,
        icon: Icon = Database,
        type = "",
        entityId = "",
        mode = "embedded",
        singleSelect = false,
        onchange = undefined,
        listItemsRemote,
        fetchAssociationsRemote,
        addAssociationRemote,
        removeAssociationRemote,
        deleteItemRemote,
        relatedQueries = [],
        filterGroups = undefined,
        filterAssociations = undefined,
        filters = undefined,
        booleanFilters = undefined,
        radioGroups = undefined,
        createHref = undefined,
        createLabel = undefined,
        createRemote,
        createSchema,
        updateRemote,
        updateSchema,
        readItemRemote,
        renderForm,
        renderItem,
        renderItemLabel,
        renderItemBadge,
        renderItemDetail,
        renderSubItems = undefined,
        participationSnippet,
        rolesSnippet,
        footerSnippet,
        toolbarActions,
        initialItems = [],
        searchPredicate = undefined,
        groupBy = undefined,
        selectorGroupBy = undefined,
        groupIcon = undefined,
        sortField: propSortField = undefined,
        sortOrder: propSortOrder = undefined,
        selectorSortField = undefined,
        selectorSortOrder = undefined,
        hierarchical = false,

        // Localization defaults (keep undefined when omitted so `m` takes precedence)
        loadingLabel = undefined,
        noItemsLabel = undefined,
        noItemsFoundLabel = undefined,
        searchPlaceholder = undefined,
        linkItemLabel = undefined,
        changeItemLabel = undefined,
        associatedItemLabel: _associatedItemLabel = undefined,
        quickCreateLabel = undefined,
        showQuickCreateButton = true,
        closeSearchLabel = undefined,
        editLabel = undefined,
        deleteLabel = undefined,
        unlinkLabel = undefined,
        deleteForeverLabel = undefined,
        confirmUnlinkLabel = undefined,
        selectAllLabel = undefined,
        deselectAllLabel = undefined,
        selectedText = undefined,
        deletingLabel = undefined,
        filtersLabel = undefined,
        preferenceKey = undefined,
        m = undefined,
    }: Props<T> = $props();

    const i18n = {
        get loadingLabel() {
            return loadingLabel ?? m?.loading_item?.({ item: title }) ?? `Loading ${title.toLowerCase()}...`;
        },
        get filtersLabel() {
            return filtersLabel ?? (typeof m?.filters === "function" ? m.filters() : m?.filters) ?? "Filters";
        },
        get noItemsLabel() {
            return noItemsLabel ?? m?.no_items_associated_label?.({ item: title }) ?? m?.no_items?.({ items: title }) ?? `No ${title.toLowerCase()} associated yet.`;
        },
        get noItemsFoundLabel() {
            return noItemsFoundLabel ?? m?.no_items_found?.({ item: title }) ?? m?.not_found?.({ item: title }) ?? `No ${title.toLowerCase()} found.`;
        },
        get searchPlaceholder() {
            return searchPlaceholder ?? m?.search_placeholder?.({ item: title }) ?? `Search ${title.toLowerCase()}...`;
        },
        get linkItemLabel() {
            return linkItemLabel ?? m?.link_item_label?.({ item: title }) ?? `Link ${title}`;
        },
        get changeItemLabel() {
            return changeItemLabel ?? m?.change_item_label?.({ item: title }) ?? `Change ${title}`;
        },
        get quickCreateLabel() {
            return quickCreateLabel ?? m?.quick_create?.() ?? "Quick Create";
        },
        get closeSearchLabel() {
            return closeSearchLabel ?? m?.close_search?.() ?? "Close Search";
        },
        get editLabel() {
            return editLabel ?? m?.edit?.() ?? "Edit";
        },
        get deleteLabel() {
            return deleteLabel ?? m?.delete?.() ?? "Delete";
        },
        get unlinkLabel() {
            return unlinkLabel ?? m?.unlink?.() ?? "Unlink";
        },
        get deleteForeverLabel() {
            return deleteForeverLabel ?? m?.delete_forever?.({ item: title }) ?? `Delete ${title.toLowerCase()} forever`;
        },
        get confirmUnlinkLabel() {
            return confirmUnlinkLabel ?? m?.confirm_unlink_label?.({ item: title }) ?? unlinkLabel ?? m?.unlink?.() ?? "Remove link";
        },
        get deleteConfirmLabel() {
            return m?.delete_confirm?.({ item: title }) ?? `Delete this ${title.toLowerCase()}?`;
        },
        get deleteSuccessLabel() {
            return m?.deleted_successfully?.() ?? "Deleted successfully";
        },
        get deleteFailedLabel() {
            return m?.failed_to_delete_item?.() ?? "Failed to delete item";
        },
        get updateAssociationFailedLabel() {
            return m?.failed_to_update_association?.() ?? "Failed to update association";
        },
        get createSuccessLabel() {
            return m?.item_created_and_associated?.({ item: title }) ?? `${title} created and associated`;
        },
        get updateSuccessLabel() {
            return m?.item_updated?.({ item: title }) ?? `${title} updated`;
        },
        get failedToLoadLabel() {
            return m?.failed_to_load?.({ item: title }) ?? `Failed to load ${title.toLowerCase()}`;
        },
        get failedToLoadAssociations() {
            return m?.failed_to_load_associations?.() ?? "Failed to load associations";
        },
        get activeFiltersLabel() {
            return m?.active_filters?.() ?? "Active Filters:";
        },
        get clearAllLabel() {
            return m?.clear_all_filters?.() ?? m?.clear_all?.() ?? "Clear all";
        },
        get unassignedGroupLabel() {
            return m?.no_location?.() ?? m?.no_locations_associated?.() ?? "No Location";
        },
        get unnamedItemLabel() {
            return m?.unnamed_item?.() ?? "Unnamed Item";
        },
        get selectLabel() {
            return m?.select?.() ?? "Select";
        },
        get deselectLabel() {
            return m?.deselect?.() ?? "Deselect";
        },
        get selectAllLabel() {
            return selectAllLabel ?? (m?.select_all ? `${m.select_all()} (${displayedFilteredItems.length})` : `Select All (${displayedFilteredItems.length})`);
        },
        get deselectAllLabel() {
            return deselectAllLabel ?? m?.deselect_all?.() ?? "Deselect All";
        },
        get selectedText() {
            return selectedText ?? m?.selected?.() ?? "selected";
        },
        get deletingLabel() {
            return deletingLabel ?? m?.deleting?.() ?? "Deleting...";
        }
    };

    let mounted = true;
    let searchQuery = $state("");
    let selectorSearchQuery = $state("");
    let activeFilters = $state<FilterStateMap>({});
    const effectivePreferenceKey = $derived(
        preferenceKey ?? (title ? `em_filters_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : undefined)
    );

    function persistActiveFilters(nextFilters: FilterStateMap) {
        activeFilters = nextFilters;
        if (effectivePreferenceKey) {
            void setPreference(effectivePreferenceKey, $state.snapshot(nextFilters)).catch((err) => {
                console.warn("Failed to persist filter preferences", err);
            });
        }
    }

    onMount(() => {
        mounted = true;
        if (effectivePreferenceKey) {
            getPreference<FilterStateMap | null>(effectivePreferenceKey, null)
                .then((saved) => {
                    if (mounted && saved && typeof saved === "object") {
                        activeFilters = saved;
                    }
                })
                .catch((err) => {
                    console.warn("Failed to load filter preferences", err);
                });
        }

        return () => {
            mounted = false;
        };
    });

    const allFilterGroups = $derived<FilterGroup[]>([
        ...(filterGroups || []),
        ...(filterAssociations || []),
        ...(filters || []),
    ]);

    const effectiveSortField = $derived(propSortField ?? "displayName");
    const effectiveSortOrder = $derived(propSortOrder ?? "asc");
    const effectiveSelectorSortField = $derived(selectorSortField ?? propSortField ?? "displayName");
    const effectiveSelectorSortOrder = $derived(selectorSortOrder ?? propSortOrder ?? "asc");
    const activeSelectorGroupBy = $derived(selectorGroupBy ?? groupBy);
    const GroupIcon = $derived(groupIcon || Folder);
    const isStandalone = $derived(
        mode === "standalone" || (mode !== "embedded" && !type && !entityId && !fetchAssociationsRemote && !onchange && (!initialItems || initialItems.length === 0))
    );
    const canDelete = $derived(mode === "standalone" && Boolean(deleteItemRemote));
    const activeSearch = $derived(!isStandalone ? selectorSearchQuery : searchQuery);

    const filterState = $derived({
        search: activeSearch || undefined,
        limit: 100,
        sortField: effectiveSortField,
        sortOrder: effectiveSortOrder,
        ...Object.fromEntries(
            Object.entries(activeFilters).filter(
                ([_, v]) => (v?.include && v.include.length > 0) || (v?.exclude && v.exclude.length > 0)
            )
        ),
    });

    function matchesFilters(item: any, currentFilters: FilterStateMap): boolean {
        if (!item) return false;
        for (const [groupId, state] of Object.entries(currentFilters || {})) {
            if (!state) continue;
            const { include = [], exclude = [] } = state;
            if (include.length === 0 && exclude.length === 0) continue;

            const values: string[] = [];
            if (item[groupId] !== undefined && item[groupId] !== null) {
                const rawVal = item[groupId];
                if (Array.isArray(rawVal)) {
                    for (const v of rawVal) values.push(String(v?.id ?? v?.value ?? v));
                } else {
                    values.push(String(rawVal?.id ?? rawVal?.value ?? rawVal));
                }
            }
            if (groupId === "locationId" || groupId === "location" || groupId === "locations") {
                for (const l of item.locations || []) values.push(String(l?.id ?? l?.locationId ?? l?.location?.id));
                for (const lid of item.locationIds || []) values.push(String(lid?.id ?? lid));
                if (item.location?.id) values.push(String(item.location.id));
                if (item.locationId) values.push(String(item.locationId));
            } else if (groupId === "tagId" || groupId === "tag" || groupId === "tags") {
                for (const t of item.tags || []) values.push(String(t?.id ?? t?.tagId ?? t?.tag?.id ?? t?.name));
                for (const tid of item.tagIds || []) values.push(String(tid?.id ?? tid));
                if (item.contact?.tags) {
                    for (const ct of item.contact.tags || []) values.push(String(ct?.id ?? ct?.tagId ?? ct?.tag?.id ?? ct?.name));
                }
            } else if (groupId === "categoryId" || groupId === "category" || groupId === "categories") {
                if (item.categoryId) values.push(String(item.categoryId));
                if (item.category?.id) values.push(String(item.category.id));
                if (item.category?.name) values.push(String(item.category.name));
                if (item.category?.slug) values.push(String(item.category.slug));
            } else if (groupId === "visibility") {
                if (item.visibility) values.push(String(item.visibility));
            } else if (groupId === "status") {
                if (item.status) values.push(String(item.status));
            } else if (groupId === "talentId" || groupId === "talent") {
                if (item.talent?.id) values.push(String(item.talent.id));
                if (item.talentId) values.push(String(item.talentId));
            } else if (groupId === "frameworkId" || groupId === "framework") {
                if (item.framework?.id) values.push(String(item.framework.id));
                if (item.frameworkId) values.push(String(item.frameworkId));
            } else if (groupId === "city") {
                if (item.city) values.push(String(item.city));
            } else if (groupId === "role") {
                if (item.role) values.push(String(item.role));
            } else if (groupId === "providerType") {
                if (item.providerType) values.push(String(item.providerType));
            }

            if (exclude.length > 0 && values.some((v) => exclude.includes(v))) {
                return false;
            }
            if (include.length > 0 && !values.some((v) => include.includes(v))) {
                return false;
            }
        }
        return true;
    }

    function groupItems<I>(
        items: I[],
        grouper: ((item: I) => string | string[] | null | undefined) | string,
        unassignedLabel = "No Location"
    ) {
        const groups: Record<string, I[]> = {};
        for (const item of items) {
            const rawKey = typeof grouper === "function" ? grouper(item) : (item as any)?.[grouper];
            const keys = Array.isArray(rawKey)
                ? (rawKey.length > 0 ? rawKey : [unassignedLabel])
                : [rawKey];

            for (let key of keys) {
                key = (typeof key === "string" ? key.trim() : (key != null ? String(key) : "")) || "";
                if (!key) key = unassignedLabel;
                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(item);
            }
        }

        return Object.entries(groups)
            .map(([name, groupItems]) => ({
                name,
                items: groupItems,
            }))
            .sort((a, b) => {
                const isUnassignedA = a.name === unassignedLabel || !a.name;
                const isUnassignedB = b.name === unassignedLabel || !b.name;
                if (isUnassignedA && !isUnassignedB) return 1;
                if (!isUnassignedA && isUnassignedB) return -1;
                return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
            });
    }

    function normalize<I = T>(res: any): { data: I[]; total: number } {
        if (!res) return { data: [], total: 0 };
        const data: I[] = Array.isArray(res) ? res : (res?.data ?? []);
        const total = Array.isArray(res)
            ? res.length
            : (res?.total ?? data.length);
        return { data, total };
    }

    function invokeRemote(fn: any, params?: any) {
        if (!fn) return null;
        if (typeof fn.run === "function") {
            return fn.run(params);
        }
        return fn(params);
    }

    // --- STATE ---
    let localAssociatedItems = $derived.by<T[]>(() => {
        void entityId;
        return untrack(() => initialItems ?? []);
    });
    let showSelector = $state(false);
    let plainRefreshTick = $state(0);

    const associationsQuery = $derived.by(() => {
        void plainRefreshTick;
        if (entityId && type) {
            if (fetchAssociationsRemote) {
                return invokeRemote(fetchAssociationsRemote, { type, entityId });
            }
            if (listItemsRemote) {
                return invokeRemote(listItemsRemote, {
                    associatedWith: { type, id: entityId },
                });
            }
        }
        return null;
    });

    const selectorListQuery = $derived.by(() => {
        void plainRefreshTick;
        if (isStandalone || showSelector) {
            return invokeRemote(listItemsRemote, filterState);
        }
        return null;
    });

    const associationsState = usePromiseOrRemoteQuery<any>(() => associationsQuery);
    const selectorListState = usePromiseOrRemoteQuery<any>(() => selectorListQuery);

    const rawAssociations = $derived.by<T[]>(() => {
        if (!entityId || !type) {
            return localAssociatedItems;
        }
        const current = associationsState.current;
        if (current !== undefined && current !== null) {
            return normalize<T>(current).data;
        }
        return localAssociatedItems;
    });

    const isAssociationsLoading = $derived.by(() => {
        if (!entityId || !type || !associationsQuery) return false;
        return associationsState.loading && localAssociatedItems.length === 0;
    });

    const associationsError = $derived.by(() => {
        if (!entityId || !type || !associationsQuery) return null;
        return associationsState.error;
    });

    const rawSelectorData = $derived.by<T[]>(() => {
        if (!selectorListQuery) return [];
        const current = selectorListState.current;
        if (current !== undefined && current !== null) {
            return normalize<T>(current).data;
        }
        return [];
    });

    const isSelectorLoading = $derived.by(() => {
        if (!selectorListQuery) return false;
        return selectorListState.loading;
    });

    const selectorError = $derived.by(() => {
        if (!selectorListQuery) return null;
        return selectorListState.error;
    });

    const isDisplayedLoading = $derived(
        isStandalone ? isSelectorLoading : isAssociationsLoading
    );

    const displayedError = $derived(
        isStandalone ? selectorError : associationsError
    );

    const currentAssociations = $derived(
        hierarchical
            ? sortHierarchically<T>(rawAssociations, effectiveSortField, effectiveSortOrder)
            : sortItemsList<T>(rawAssociations, effectiveSortField, effectiveSortOrder)
    );

    const displayedSortedItems = $derived(
        isStandalone
            ? (hierarchical
                ? sortHierarchically<T>(rawSelectorData, effectiveSortField, effectiveSortOrder)
                : sortItemsList<T>(rawSelectorData, effectiveSortField, effectiveSortOrder))
            : currentAssociations
    );

    const displayedSearchedItems = $derived.by<T[]>(() => {
        if (!searchQuery) return displayedSortedItems;
        return displayedSortedItems.filter((i: any) =>
            searchPredicate
                ? searchPredicate(i, searchQuery)
                : (i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   i.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   i.displayName?.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    });

    const displayedFilteredItems = $derived.by<T[]>(() => {
        const filtered = isStandalone
            ? displayedSearchedItems.filter((i: any) => matchesFilters(i, activeFilters))
            : displayedSearchedItems;
        return hierarchical
            ? sortHierarchically<T>(filtered, effectiveSortField, effectiveSortOrder)
            : filtered;
    });

    const selectorSortedItems = $derived(
        hierarchical
            ? sortHierarchically<T>(rawSelectorData, effectiveSelectorSortField, effectiveSelectorSortOrder)
            : sortItemsList<T>(rawSelectorData, effectiveSelectorSortField, effectiveSelectorSortOrder)
    );

    const selectorSearchedItems = $derived.by<T[]>(() => {
        if (!activeSearch) return selectorSortedItems;
        return selectorSortedItems.filter((i: any) =>
            searchPredicate
                ? searchPredicate(i, activeSearch)
                : (i.name?.toLowerCase().includes(activeSearch.toLowerCase()) ||
                   i.title?.toLowerCase().includes(activeSearch.toLowerCase()) ||
                   i.displayName?.toLowerCase().includes(activeSearch.toLowerCase()))
        );
    });

    const selectorFilteredItems = $derived.by<T[]>(() => {
        const filtered = selectorSearchedItems.filter((i: any) => matchesFilters(i, activeFilters));
        return hierarchical
            ? sortHierarchically<T>(filtered, effectiveSelectorSortField, effectiveSelectorSortOrder)
            : filtered;
    });

    function isRefreshableQuery(q: any): boolean {
        return Boolean(q && typeof q === 'object' && (typeof q.refresh === 'function' || typeof q.reconnect === 'function'));
    }

    async function refreshAssociations() {
        if (associationsQuery && typeof associationsQuery.refresh === 'function') {
            try {
                await associationsQuery.refresh();
            } catch (e) {
                console.warn("associationsQuery refresh error:", e);
            }
        } else if (associationsQuery && typeof associationsQuery.reconnect === 'function') {
            try {
                await associationsQuery.reconnect();
            } catch (e) {
                console.warn("associationsQuery reconnect error:", e);
            }
        } else {
            plainRefreshTick++;
        }
    }

    async function refreshSelector() {
        if (selectorListQuery && typeof selectorListQuery.refresh === 'function') {
            try {
                await selectorListQuery.refresh();
            } catch (e) {
                console.warn("selectorListQuery refresh error:", e);
            }
        } else if (selectorListQuery && typeof selectorListQuery.reconnect === 'function') {
            try {
                await selectorListQuery.reconnect();
            } catch (e) {
                console.warn("selectorListQuery reconnect error:", e);
            }
        } else {
            plainRefreshTick++;
        }
    }

    export async function refresh() {
        await Promise.all([refreshAssociations(), refreshSelector()]);
    }

    function withRelatedUpdates<R>(commandPromise: Promise<R> & { updates?: (...u: any[]) => Promise<R> }): Promise<R> {
        if (!commandPromise || typeof commandPromise.updates !== 'function') {
            return commandPromise;
        }
        const updates: any[] = [];
        if (isRefreshableQuery(associationsQuery)) {
            updates.push(associationsQuery);
        }
        if (isRefreshableQuery(selectorListQuery)) {
            updates.push(selectorListQuery);
        }
        for (const q of relatedQueries) {
            if (q && !updates.includes(q)) {
                updates.push(q);
            }
        }
        return updates.length > 0 ? commandPromise.updates(...updates) : commandPromise;
    }

    function toggleSelector() {
        showSelector = !showSelector;
        if (!showSelector) {
            selectorSearchQuery = "";
        }
    }
    let showQuickCreate = $state(false);
    let linkingItemId = $state<string | null>(null);
    let deletingItemId = $state<string | null>(null);
    let editingItem = $state<any | null>(null);

    const editItemQuery = $derived(editingItem?.id && readItemRemote ? invokeRemote(readItemRemote, editingItem.id) : null);
    const editItemState = usePromiseOrRemoteQuery<any>(() => editItemQuery);
    const editItemData = $derived(editItemQuery ? (editItemState.current ?? null) : null);
    const isEditItemLoading = $derived(editItemQuery ? editItemState.loading : false);
    const editItemError = $derived(editItemQuery ? editItemState.error : null);

    function isAssociated(item: T, list: T[]) {
        if (!item || !list || !Array.isArray(list)) return false;
        return list.some((ai) => {
            if (!ai) return false;
            if (item.id && ai.id) return ai.id === item.id;
            if (item.name && ai.name && item.name.trim() === ai.name.trim()) return true;
            return false;
        });
    }

    async function toggleAssociation(item: T, currentList: T[]) {
        linkingItemId = item.id ?? null;
        const associated = isAssociated(item, currentList);

        try {
            if (associated) {
                const newList = currentList.filter((ai) => {
                    if (item.id && ai.id) return ai.id !== item.id;
                    if (item.name && ai.name) return ai.name !== item.name;
                    return true;
                });
                if (entityId && removeAssociationRemote) {
                    markLocalEntityMutation(type || 'entity', [entityId]);
                    await withRelatedUpdates(
                        removeAssociationRemote({
                            type,
                            entityId,
                            itemId: item.id!,
                        })
                    );
                }
                localAssociatedItems = newList;
                await refreshAssociations();
                onchange?.(newList.map((i) => i.id!).filter(Boolean), newList);
            } else {
                if (singleSelect) {
                    const newList = [item];
                    if (entityId && removeAssociationRemote) {
                        markLocalEntityMutation(type || 'entity', [entityId]);
                        for (const existing of currentList) {
                            if (existing.id) {
                                await withRelatedUpdates(
                                    removeAssociationRemote({
                                        type,
                                        entityId,
                                        itemId: existing.id,
                                    })
                                );
                            }
                        }
                    }
                    if (entityId && addAssociationRemote) {
                        markLocalEntityMutation(type || 'entity', [entityId]);
                        await withRelatedUpdates(
                            addAssociationRemote({
                                type,
                                entityId,
                                itemId: item.id!,
                            })
                        );
                    }
                    localAssociatedItems = newList;
                    await refreshAssociations();
                    onchange?.(newList.map((i) => i.id!).filter(Boolean), newList);
                    showSelector = false;
                } else {
                    const newList = [...currentList, item];
                    if (entityId && addAssociationRemote) {
                        markLocalEntityMutation(type || 'entity', [entityId]);
                        await withRelatedUpdates(
                            addAssociationRemote({
                                type,
                                entityId,
                                itemId: item.id!,
                            })
                        );
                    }
                    localAssociatedItems = newList;
                    await refreshAssociations();
                    onchange?.(
                        newList.map((i) => i.id!).filter(Boolean),
                        newList,
                    );
                }
            }
        } catch (e: any) {
            if (!mounted) return;
            toast.error(e.message || i18n.updateAssociationFailedLabel);
        } finally {
            if (mounted) {
                linkingItemId = null;
            }
        }
    }

    async function deleteItem(item: T, currentList: T[]) {
        if (!item.id || !canDelete || !deleteItemRemote) return;
        deletingItemId = item.id;
        try {
            const result = await withRelatedUpdates(invokeRemote(deleteItemRemote, [item.id]));
            const success =
                result === true || (result && result.success !== false);
            if (!success) return;

            const newList = currentList.filter((i) => i.id !== item.id);
            localAssociatedItems = newList;
            selectedIds = selectedIds.filter((id) => id !== item.id);

            await refreshAssociations();
            await refreshSelector();
            onchange?.(newList.map((i) => i.id!).filter(Boolean), newList);

            if (success && mounted) {
                toast.success(i18n.deleteSuccessLabel);
            }
        } catch (e: any) {
            if (mounted) toast.error(e.message || i18n.deleteFailedLabel);
        } finally {
            if (mounted) deletingItemId = null;
        }
    }

    let selectedIds = $state<string[]>([]);

    function toggleSelect(id: string) {
        if (selectedIds.includes(id)) {
            selectedIds = selectedIds.filter((i) => i !== id);
        } else {
            selectedIds = [...selectedIds, id];
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0 || !canDelete || !deleteItemRemote) return;
        const confirmMsg = `${i18n.deleteConfirmLabel || "Delete selected items?"} (${selectedIds.length})`;
        if (!window.confirm(confirmMsg)) return;
        try {
            await withRelatedUpdates(invokeRemote(deleteItemRemote, selectedIds));
            toast.success(i18n.deleteSuccessLabel || "Deleted successfully");
            const idsToDelete = new Set(selectedIds);
            const remaining = currentAssociations.filter((i) => !i.id || !idsToDelete.has(i.id));
            selectedIds = [];
            localAssociatedItems = remaining;
            await refreshAssociations();
            await refreshSelector();
            onchange?.(remaining.map((i) => i.id!).filter(Boolean), remaining);
        } catch (e: any) {
            toast.error(e?.message || i18n.deleteFailedLabel || "Failed to delete");
        }
    }

    async function handleQuickCreateSuccess(result: any, currentList: T[]) {
        showQuickCreate = false;
        let newId = result?.id || result?.data?.id;
        if (!newId && result && typeof result === 'object') {
            for (const key of Object.keys(result)) {
                if (result[key] && typeof result[key] === 'object' && 'id' in result[key]) {
                    newId = result[key].id;
                    break;
                }
            }
        }

        let newItem = result?.data || result?.contact || result?.resource || result?.tag || result?.talent || result?.price || result?.location;
        if (!newItem && result && typeof result === 'object' && 'id' in result) {
            newItem = result;
        }

        if (newId) {
            if (!newItem && readItemRemote) {
                try {
                    const fullItem = await invokeRemote(readItemRemote, newId);
                    if (fullItem) {
                        newItem = fullItem?.data ?? fullItem;
                    }
                } catch (e) {
                    console.warn("Failed to fetch full item via readItemRemote:", e);
                }
            }

            if (!newItem) {
                newItem = { id: newId, ...(result?.data || result || {}) } as any;
            }

            if (singleSelect && entityId && removeAssociationRemote) {
                try {
                    markLocalEntityMutation(type || 'entity', [entityId]);
                    for (const existing of currentList) {
                        if (existing.id && existing.id !== newId) {
                            await withRelatedUpdates(
                                removeAssociationRemote({
                                    type,
                                    entityId,
                                    itemId: existing.id,
                                })
                            );
                        }
                    }
                } catch (err: any) {
                    toast.error(err.message || i18n.updateAssociationFailedLabel);
                    return;
                }
            }

            if (entityId && addAssociationRemote) {
                try {
                    markLocalEntityMutation(type || 'entity', [entityId]);
                    await withRelatedUpdates(
                        addAssociationRemote({
                            type,
                            entityId,
                            itemId: newId,
                        })
                    );
                } catch (err: any) {
                    toast.error(err.message || i18n.updateAssociationFailedLabel);
                    return;
                }
            }

            const newList = singleSelect
                ? (newItem ? [newItem] : [])
                : (newItem ? [...currentList.filter(i => i.id !== newId), newItem] : currentList);
            localAssociatedItems = newList;

            await refreshAssociations();
            await refreshSelector();

            onchange?.(newList.map((i) => i.id!).filter(Boolean), newList);
            if (singleSelect) {
                showSelector = false;
            }
            if (mounted) toast.success(i18n.createSuccessLabel);
        }
    }

    async function handleInPlaceUpdateSuccess(result: any, currentList: T[]) {
        const targetId = editingItem?.id;
        editingItem = null;
        if (!targetId) return;

        let updatedItem = result?.data || result?.contact || result?.resource || result?.tag || result?.talent || result?.price || result?.location;
        if (!updatedItem && result && typeof result === 'object' && 'id' in result) {
            updatedItem = result;
        }

        if (!updatedItem && readItemRemote) {
            try {
                const fullItem = await invokeRemote(readItemRemote, targetId);
                if (fullItem) {
                    updatedItem = fullItem?.data ?? fullItem;
                }
            } catch (e) {
                console.warn("Failed to fetch full item via readItemRemote on update:", e);
            }
        }

        const newList = updatedItem
            ? currentList.map((i) =>
                  i.id === targetId
                      ? {
                            ...i,
                            ...updatedItem,
                            partySize: updatedItem.partySize ?? (i as any).partySize,
                            participationStatus:
                                updatedItem.participationStatus ?? (i as any).participationStatus,
                            notifyOnChanges:
                                updatedItem.notifyOnChanges ?? (i as any).notifyOnChanges,
                            roles: updatedItem.roles ?? (i as any).roles,
                        }
                      : i
              )
            : currentList;

        localAssociatedItems = newList;

        await refreshAssociations();
        await refreshSelector();

        onchange?.(newList.map((i) => i.id!).filter(Boolean), newList);
        if (mounted) toast.success(i18n.updateSuccessLabel);
    }
</script>

<!-- Action Bar (Search, Filters, Actions) -->
<div class="flex flex-col gap-2 mb-3">
    <div class="flex flex-col md:flex-row gap-3">
        {#if isStandalone}
            <div class="relative flex-1">
                <Search
                    size={14}
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                    type="text"
                    placeholder={i18n.searchPlaceholder}
                    bind:value={searchQuery}
                    class="pl-9 w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-gray-800 dark:text-gray-100 transition-all bg-gray-50/50"
                />
            </div>
        {/if}

        <div class="flex flex-wrap items-center gap-1.5 {isStandalone ? 'md:ml-auto' : ''} shrink-0 w-full md:w-auto">
            {#if toolbarActions}
                {@render toolbarActions({ items: currentAssociations, count: currentAssociations.length })}
            {/if}

            {#if isStandalone && (allFilterGroups.length > 0 || (booleanFilters && booleanFilters.length > 0) || (radioGroups && radioGroups.length > 0))}
                <FilterMenu
                    groups={allFilterGroups}
                    bind:filters={activeFilters}
                    booleanFilters={booleanFilters}
                    radioGroups={radioGroups}
                    buttonLabel={i18n.filtersLabel}
                    systemFiltersLabel={m?.system_filters?.()}
                    filterCriteriaLabel={m?.filter_criteria?.()}
                    searchPlaceholder={m?.filter_group_placeholder ? (l: string) => m.filter_group_placeholder({ label: l }) : undefined}
                    cycleStateHelp={m?.cycle_state_help?.()}
                    includeHelp={m?.include_help?.()}
                    excludeHelp={m?.exclude_help?.()}
                    includeTooltip={m?.include?.()}
                    excludeTooltip={m?.exclude?.()}
                    loadingText={m?.loading_item ? (l: string) => m.loading_item({ item: l }) : undefined}
                    noOptionsText={m?.no_options_found ? () => m.no_options_found() : undefined}
                    clearGroupText={m?.clear_group ? (l: string) => m.clear_group({ label: l }) : undefined}
                    clearAllText={m?.clear_all_filters_count ? (c: number) => m.clear_all_filters_count({ count: c }) : undefined}
                    onfilterchange={(f) => persistActiveFilters(f)}
                    onclear={() => persistActiveFilters(activeFilters)}
                />
            {/if}

            {#if createHref}
                <Button
                    href={createHref}
                    size="sm"
                    class="h-9 px-3 rounded-xl shadow-xs"
                >
                    <Plus size={16} class="mr-1.5" />
                    <span class="text-sm font-semibold">{createLabel || i18n.quickCreateLabel}</span>
                </Button>
            {/if}

            {#if !isStandalone}
                {#if isAssociationsLoading}
                    <div class="flex items-center justify-center p-1">
                        <Loader2 class="h-4 w-4 animate-spin text-blue-500" />
                    </div>
                {:else}
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
                                >{i18n.closeSearchLabel}</span
                            >
                        {:else}
                            <Link size={16} class="mr-1.5" />
                            <span class="text-sm font-semibold"
                                >{singleSelect && currentAssociations.length > 0 ? i18n.changeItemLabel : i18n.linkItemLabel}</span
                            >
                        {/if}
                    </Button>
                {/if}
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
                    <span class="text-sm font-semibold">{i18n.quickCreateLabel}</span>
                </Button>
            {/if}
        </div>
    </div>

    <!-- Active Filter Chips (Standalone mode only) -->
    {#if isStandalone && allFilterGroups.length > 0}
        <ActiveFilterChips
            groups={allFilterGroups}
            filters={activeFilters}
            activeFiltersLabel={i18n.activeFiltersLabel}
            clearAllLabel={i18n.clearAllLabel}
            removeFilterTooltip={m?.remove_filter?.()}
            removeExclusionTooltip={m?.remove_exclusion?.()}
            turnOffFilterTooltip={m?.turn_off_filter?.()}
            onremove={(groupId: string, optId: string, type: "include" | "exclude") => {
                const current = activeFilters[groupId] || { include: [], exclude: [] };
                persistActiveFilters({
                    ...activeFilters,
                    [groupId]: {
                        include: type === "include" ? current.include.filter((id) => id !== optId) : current.include,
                        exclude: type === "exclude" ? current.exclude.filter((id) => id !== optId) : current.exclude,
                    },
                });
            }}
            onclearall={() => {
                const reset: FilterStateMap = {};
                for (const g of allFilterGroups) {
                    reset[g.id] = { include: [], exclude: [] };
                }
                persistActiveFilters(reset);
            }}
        />
    {/if}
</div>

{#if showSelector}
    <div
        class="bg-white border-2 border-blue-50 rounded-2xl p-2.5 mb-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 relative min-h-[100px]"
    >
        <!-- Link Mode Filter & Search Toolbar -->
        <div class="flex flex-col gap-2 mb-2 pb-2.5 border-b border-gray-100 dark:border-gray-800">
            <div class="flex items-center gap-2">
                <div class="relative flex-1">
                    <Search
                        size={14}
                        class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                        type="text"
                        placeholder={i18n.searchPlaceholder}
                        bind:value={selectorSearchQuery}
                        class="pl-9 w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-gray-800 dark:text-gray-100 transition-all bg-gray-50/50"
                    />
                </div>

                {#if allFilterGroups.length > 0 || (booleanFilters && booleanFilters.length > 0) || (radioGroups && radioGroups.length > 0)}
                    <FilterMenu
                        groups={allFilterGroups}
                        bind:filters={activeFilters}
                        booleanFilters={booleanFilters}
                        radioGroups={radioGroups}
                        buttonLabel={i18n.filtersLabel}
                        systemFiltersLabel={m?.system_filters?.()}
                        filterCriteriaLabel={m?.filter_criteria?.()}
                        searchPlaceholder={m?.filter_group_placeholder ? (l: string) => m.filter_group_placeholder({ label: l }) : undefined}
                        cycleStateHelp={m?.cycle_state_help?.()}
                        includeHelp={m?.include_help?.()}
                        excludeHelp={m?.exclude_help?.()}
                        includeTooltip={m?.include?.()}
                        excludeTooltip={m?.exclude?.()}
                        loadingText={m?.loading_item ? (l: string) => m.loading_item({ item: l }) : undefined}
                        noOptionsText={m?.no_options_found ? () => m.no_options_found() : undefined}
                        clearGroupText={m?.clear_group ? (l: string) => m.clear_group({ label: l }) : undefined}
                        clearAllText={m?.clear_all_filters_count ? (c: number) => m.clear_all_filters_count({ count: c }) : undefined}
                        onfilterchange={(f) => persistActiveFilters(f)}
                        onclear={() => persistActiveFilters(activeFilters)}
                    />
                {/if}
            </div>

            <!-- Active Filter Chips in Link Mode -->
            {#if allFilterGroups.length > 0}
                <ActiveFilterChips
                    groups={allFilterGroups}
                    filters={activeFilters}
                    activeFiltersLabel={i18n.activeFiltersLabel}
                    clearAllLabel={i18n.clearAllLabel}
                    removeFilterTooltip={m?.remove_filter?.()}
                    removeExclusionTooltip={m?.remove_exclusion?.()}
                    turnOffFilterTooltip={m?.turn_off_filter?.()}
                    onremove={(groupId: string, optId: string, type: "include" | "exclude") => {
                        const current = activeFilters[groupId] || { include: [], exclude: [] };
                        persistActiveFilters({
                            ...activeFilters,
                            [groupId]: {
                                include: type === "include" ? current.include.filter((id) => id !== optId) : current.include,
                                exclude: type === "exclude" ? current.exclude.filter((id) => id !== optId) : current.exclude,
                            },
                        });
                    }}
                    onclearall={() => {
                        const reset: FilterStateMap = {};
                        for (const g of allFilterGroups) {
                            reset[g.id] = { include: [], exclude: [] };
                        }
                        persistActiveFilters(reset);
                    }}
                />
            {/if}
        </div>

        <svelte:boundary>
            {#if $effect.pending()}
                <div class="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-xl">
                    <div class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
            {/if}

            <div class={["max-h-64 overflow-y-auto space-y-1 p-1 transition-opacity duration-200", $effect.pending() && "opacity-50 pointer-events-none"]}>
                {#if isSelectorLoading}
                    <div class="flex items-center justify-center py-8 text-gray-500 gap-2 font-medium text-sm">
                        <Loader2 class="h-5 w-5 animate-spin text-blue-600" />
                        <span>{i18n.loadingLabel}</span>
                    </div>
                {:else if selectorError}
                    <div class="text-xs text-center py-8 text-red-500 font-medium">
                        {selectorError?.message || i18n.failedToLoadLabel}
                    </div>
                {:else if selectorFilteredItems.length === 0}
                    <div class="text-xs text-center py-8 text-gray-400 font-medium italic">
                        {activeSearch || Object.values(activeFilters).some((f) => (f?.include?.length || 0) + (f?.exclude?.length || 0) > 0) ? i18n.noItemsFoundLabel : i18n.noItemsLabel}
                    </div>
                {:else}
                    {#snippet renderSelectorItem(item: T)}
                        {@const isLinked = isAssociated(item, currentAssociations)}
                        <div
                            class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 transition-all rounded-xl p-2 {isLinked
                                ? 'bg-blue-50/50'
                                : 'hover:bg-gray-50'}"
                        >
                            <div class="flex-1 min-w-0">
                                <div
                                    class="text-sm font-bold {isLinked
                                        ? 'text-blue-700'
                                        : 'text-gray-900'} truncate"
                                >
                                    {#if renderItem}
                                        {@render renderItem(item)}
                                    {:else if renderItemLabel}
                                        {@render renderItemLabel(item)}
                                    {:else}
                                        {(item as any).displayName ||
                                            item.name ||
                                            (`${(item as any).givenName || ""} ${(item as any).familyName || ""}`.trim() || undefined) ||
                                            (item as any).company ||
                                            item.id ||
                                            i18n.unnamedItemLabel}
                                    {/if}
                                </div>
                            </div>

                            <div class="flex items-center gap-1 w-full sm:w-auto justify-end sm:justify-start">
                                {#if updateRemote && renderForm && readItemRemote}
                                    <button
                                        type="button"
                                        class="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                        onclick={() => {
                                            editingItem = item;
                                        }}
                                        title={i18n.editLabel}
                                    >
                                        <Pencil size={15} />
                                    </button>
                                {/if}
                                <AsyncButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="h-8 w-8 p-0 rounded-lg {isLinked
                                        ? 'text-blue-600 bg-blue-100/50'
                                        : 'text-gray-400 hover:text-blue-500'}"
                                    loading={linkingItemId === item.id}
                                    loadingLabel=""
                                    onclick={() => {
                                        void toggleAssociation(
                                            item,
                                            currentAssociations,
                                        );
                                    }}
                                    title={isLinked
                                        ? i18n.confirmUnlinkLabel
                                        : i18n.linkItemLabel}
                                >
                                    {#if isLinked}
                                        <Unlink size={16} />
                                    {:else}
                                        <Link size={16} />
                                    {/if}
                                </AsyncButton>
                                {#if canDelete}
                                    <AsyncButton
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        class="h-8 w-8 p-0 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                        loading={deletingItemId === item.id}
                                        loadingLabel=""
                                        onclick={async () => {
                                            const confirmed = window.confirm(i18n.deleteConfirmLabel);
                                            if (confirmed) {
                                                await deleteItem(item, currentAssociations);
                                            }
                                        }}
                                        title={i18n.deleteForeverLabel}
                                    >
                                        <Trash2 size={15} />
                                    </AsyncButton>
                                {/if}
                            </div>
                        </div>
                    {/snippet}

                    {#if activeSelectorGroupBy}
                        {@const grouped = groupItems(selectorFilteredItems, activeSelectorGroupBy, i18n.unassignedGroupLabel)}
                        {#each grouped as group (group.name)}
                            {@const groupItemsSorted = hierarchical
                                ? sortHierarchically<T>(group.items, effectiveSelectorSortField, effectiveSelectorSortOrder)
                                : group.items}
                            <div class="pt-2.5 pb-1 px-2 first:pt-1 sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs z-1 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <div class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    <GroupIcon size={13} class="text-gray-400 shrink-0" />
                                    <span>{group.name}</span>
                                </div>
                                <span class="text-[11px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                                    {groupItemsSorted.length}
                                </span>
                            </div>
                            <div class="space-y-1">
                                {#each groupItemsSorted as item (group.name + '-' + item.id)}
                                    {@render renderSelectorItem(item)}
                                {/each}
                            </div>
                        {/each}
                    {:else}
                        {#each selectorFilteredItems as item (item.id)}
                            {@render renderSelectorItem(item)}
                        {/each}
                    {/if}
                {/if}
            </div>

            {#snippet pending()}
                <div class="text-xs text-center py-8 text-gray-400 font-medium">
                    <div class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    {i18n.loadingLabel}
                </div>
            {/snippet}

            {#snippet failed(error: any, reset)}
                <div class="text-xs text-center py-8 text-red-500 font-medium">
                    {error?.message || i18n.failedToLoadLabel}
                </div>
            {/snippet}
        </svelte:boundary>
    </div>
{/if}

<!-- Embedded Content -->
<div class="space-y-2 relative">
    <svelte:boundary>
        {#if $effect.pending()}
            <div class="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-2xl">
                <div class="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        {/if}
        <div class={$effect.pending() ? 'opacity-50 pointer-events-none transition-opacity duration-200' : 'transition-opacity duration-200'}>
            {#if isDisplayedLoading}
                <div class="flex items-center justify-center py-6 text-gray-500 gap-2 font-medium text-sm">
                    <Loader2 class="h-5 w-5 animate-spin text-blue-600" />
                    <span>{i18n.loadingLabel}</span>
                </div>
            {:else if displayedError}
                <div class="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                    <p class="text-sm font-medium text-red-600">
                        {displayedError?.message || i18n.failedToLoadAssociations}
                    </p>
                </div>
            {:else if displayedFilteredItems.length > 0}
                <div class="grid gap-2">
                    {#each displayedFilteredItems as item (item.id)}
                        <div
                            class="flex flex-col transition-all rounded-2xl border bg-white group/assoc overflow-hidden {item.id && selectedIds.includes(item.id)
                                ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/10'
                                : 'border-gray-100 hover:border-blue-100 hover:shadow-sm'}"
                        >
                            <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
                                {#if canDelete && item.id}
                                    <input
                                        type="checkbox"
                                        bind:group={selectedIds}
                                        value={item.id}
                                        class="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0 transition-colors"
                                        title={selectedIds.includes(item.id) ? i18n.deselectLabel : i18n.selectLabel}
                                    />
                                {/if}
                                <div class="flex-1 min-w-0">
                                    <div
                                        class="text-sm font-bold text-gray-900 group-hover/assoc:text-blue-600 transition-colors truncate"
                                    >
                                        {#if renderItem}
                                            {@render renderItem(item)}
                                        {:else if renderItemLabel}
                                            {@render renderItemLabel(item)}
                                        {:else}
                                            {(item as any).displayName ||
                                                item.name ||
                                                (`${(item as any).givenName || ""} ${(item as any).familyName || ""}`.trim() || undefined) ||
                                                (item as any).company ||
                                                item.id ||
                                                "Unnamed Item"}
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

                                {#if rolesSnippet}
                                    {@render rolesSnippet(item)}
                                {/if}

                                {#if participationSnippet}
                                    {@render participationSnippet(item)}
                                {/if}

                                <div class="flex items-center gap-1 w-full sm:w-auto justify-end sm:justify-start mt-1 sm:mt-0">
                                    {#if updateRemote && renderForm && readItemRemote}
                                        <button
                                            type="button"
                                            class="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                            onclick={() => {
                                                editingItem = item;
                                            }}
                                            title={i18n.editLabel}
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
                                        onclick={() =>
                                            toggleAssociation(
                                                item,
                                                currentAssociations,
                                            )}
                                        title={i18n.confirmUnlinkLabel}
                                    >
                                        <Unlink size={15} />
                                    </AsyncButton>
                                    {#if canDelete}
                                        <AsyncButton
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-8 w-8 p-0 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                            loading={deletingItemId === item.id}
                                            loadingLabel=""
                                            onclick={async () => {
                                                const confirmed = window.confirm(i18n.deleteConfirmLabel);
                                                if (confirmed) {
                                                    await deleteItem(item, currentAssociations);
                                                }
                                            }}
                                            title={i18n.deleteForeverLabel}
                                        >
                                            <Trash2 size={15} />
                                        </AsyncButton>
                                    {/if}
                                </div>
                            </div>

                            {#if renderSubItems}
                                <div class="border-t border-gray-100 bg-gray-50/40">
                                    {@render renderSubItems(item)}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {:else}
                <div
                    class="bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl p-8 text-center"
                >
                    <p class="text-sm font-medium text-gray-400 italic">
                        {i18n.noItemsLabel}
                    </p>
                </div>
            {/if}
        </div>
        {#if footerSnippet}
            {@render footerSnippet()}
        {/if}

        {#snippet pending()}
            <div class="text-center py-10 animate-pulse text-gray-400 font-medium">
                <div class="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                {i18n.loadingLabel}
            </div>
        {/snippet}

        {#snippet failed(error: any, reset)}
            <div class="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                <p class="text-sm font-medium text-red-600">
                    {error?.message || i18n.failedToLoadAssociations}
                </p>
            </div>
        {/snippet}
    </svelte:boundary>
</div>

<!-- Dialog for Create/Edit -->
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
                    {editingItem ? i18n.editLabel : i18n.quickCreateLabel}
                </Dialog.Title>
            </Dialog.Header>

            <div style="overflow-y: auto; flex: 1; min-height: 0;">
                <svelte:boundary>
                    {#if editingItem}
                        {#if readItemRemote && isEditItemLoading && !editItemData}
                            <div class="p-8 flex flex-col items-center justify-center gap-2">
                                <div class="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                <span class="text-xs text-gray-400 font-medium">{i18n.loadingLabel}</span>
                            </div>
                        {:else if readItemRemote && editItemError}
                            <div class="p-8 text-center text-red-500 text-sm">
                                {editItemError?.message || i18n.failedToLoadLabel}
                            </div>
                        {:else}
                            {@render renderForm({
                                remoteFunction: updateRemote,
                                schema: updateSchema,
                                initialData: (readItemRemote ? editItemData : editingItem) ?? editingItem,
                                isUpdating: true,
                                onSuccess: (result) => {
                                    void handleInPlaceUpdateSuccess(
                                        result,
                                        currentAssociations,
                                    );
                                },
                                onCancel: () => {
                                    editingItem = null;
                                },
                                id: editingItem.id,
                            })}
                        {/if}
                    {:else if showQuickCreate}
                        {@render renderForm({
                            remoteFunction: createRemote,
                            schema: createSchema,
                            isUpdating: false,
                            onSuccess: (result) => {
                                void handleQuickCreateSuccess(
                                    result,
                                    currentAssociations,
                                );
                            },
                            onCancel: () => {
                                showQuickCreate = false;
                            },
                        })}
                    {/if}
                    
                    {#snippet pending()}
                        <div class="p-8 flex justify-center">
                            <div class="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        </div>
                    {/snippet}

                    {#snippet failed(error: any)}
                        <div class="p-8 text-center text-red-500 text-sm">
                            {error?.message || i18n.failedToLoadAssociations}
                        </div>
                    {/snippet}
                </svelte:boundary>
            </div>
        </Dialog.Content>
    </Dialog.Root>
{/if}

{#if canDelete}
    <BulkActionToolbar
        {selectedIds}
        totalCount={displayedFilteredItems.length}
        onSelectAll={() => (selectedIds = displayedFilteredItems.map((i: any) => i.id).filter(Boolean))}
        onDeselectAll={() => (selectedIds = [])}
        onDelete={handleBulkDelete}
        deleteLabel={i18n.deleteForeverLabel}
        selectAllLabel={i18n.selectAllLabel}
        deselectAllLabel={i18n.deselectAllLabel}
        selectedText={i18n.selectedText}
        deletingLabel={i18n.deletingLabel}
        ariaLabel={m?.bulk_actions?.()}
        clearSelectionTitle={m?.clear_selection?.()}
    />
{/if}
