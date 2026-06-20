<script lang="ts" generics="T extends { id?: string | null; name?: string }">
    import { onMount, untrack, type Component, type Snippet } from "svelte";
    import type { ListItemContext } from "./EntityManager.types";
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
    } from "@lucide/svelte";

    import Button from "./button/button.svelte";
    import AsyncButton from "./AsyncButton.svelte";
    import * as Dialog from "./dialog";
    import { toast } from "svelte-sonner";

    interface Props<T extends { id?: string | null; name?: string }> {
        title: string;
        icon?: Component<any>;
        type: string;
        entityId: string;
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
        renderItemLabel?: Snippet<[T]>;
        renderItemBadge?: Snippet<[T]>;
        renderItemDetail?: Snippet<[T]>;
        participationSnippet?: Snippet<[T]>;

        // Initial state
        initialItems?: T[];

        // Localization props
        loadingLabel?: string;
        noItemsLabel?: string;
        noItemsFoundLabel?: string;
        searchPlaceholder?: string;
        linkItemLabel?: string;
        quickCreateLabel?: string;
        showQuickCreateButton?: boolean;
        closeSearchLabel?: string;
        editLabel?: string;
        deleteForeverLabel?: string;
        confirmUnlinkLabel?: string;
    }

    let {
        title,
        icon: Icon = Database,
        type,
        entityId,
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
        renderItemLabel,
        renderItemBadge,
        renderItemDetail,
        participationSnippet,
        initialItems = [],

        // Localization defaults
        loadingLabel = `Loading ${title.toLowerCase()}...`,
        noItemsLabel = `No ${title.toLowerCase()} associated yet.`,
        noItemsFoundLabel = `No ${title.toLowerCase()} found.`,
        searchPlaceholder = `Search ${title.toLowerCase()}...`,
        linkItemLabel = `Link ${title}`,
        quickCreateLabel = "Quick Create",
        showQuickCreateButton = true,
        closeSearchLabel = "Close Search",
        editLabel = "Edit",
        deleteForeverLabel = `Delete ${title.toLowerCase()} forever`,
        confirmUnlinkLabel = "Remove link",
    }: Props<T> = $props();

    let mounted = true;
    onMount(() => {
        return () => {
            mounted = false;
        };
    });

    let searchQuery = $state("");

    const filterState = $derived({
        search: searchQuery || undefined,
        limit: 100,
        sortField: "name",
        sortOrder: "asc",
    });

    function normalize(res: any) {
        if (!res) return { data: [], total: 0 };
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        const total = Array.isArray(res)
            ? res.length
            : (res?.total ?? data.length);
        return { data, total };
    }

    function invokeRemote(fn: any, params?: any) {
        if (!fn) return Promise.resolve(null);
        if (typeof fn.run === "function") {
            return fn.run(params);
        }
        return fn(params);
    }

    // --- STATE ---
    let localAssociatedItems = $state<T[]>(untrack(() => initialItems ?? []));

    const associationsPromise = $derived(
        entityId && type
            ? fetchAssociationsRemote
                ? invokeRemote(fetchAssociationsRemote, { type, entityId })
                : invokeRemote(listItemsRemote, {
                      associatedWith: { type, id: entityId },
                  })
            : Promise.resolve(localAssociatedItems)
    );

    const selectorListPromise = $derived(invokeRemote(listItemsRemote, filterState));


    $effect(() => {
        if (initialItems) {
            untrack(() => {
                localAssociatedItems = initialItems;
            });
        }
    });
    let showSelector = $state(false);
    function toggleSelector() {
        showSelector = !showSelector;
    }
    let showQuickCreate = $state(false);
    let linkingItemId = $state<string | null>(null);
    let deletingItemId = $state<string | null>(null);
    let editingItem = $state<any | null>(null);

    // --- HELPERS ---
    function isAssociated(item: T, list: T[]) {
        return list.some((ai) => {
            if (item.id && ai.id) return ai.id === item.id;
            if (item.name && ai.name) return ai.name === item.name;
            return false;
        });
    }

    async function toggleAssociation(item: T, currentList: T[]) {
        linkingItemId = item.id ?? null;
        const associated = isAssociated(item, currentList);

        try {
            if (associated) {
                if (entityId && removeAssociationRemote) {
                    await removeAssociationRemote({
                        type,
                        entityId,
                        itemId: item.id!,
                    });
                    if (typeof associationsPromise?.refresh === 'function') {
                        await associationsPromise.refresh();
                    }
                } else {
                    const newList = currentList.filter((ai) => {
                        if (item.id && ai.id) return ai.id !== item.id;
                        if (item.name && ai.name) return ai.name !== item.name;
                        return true;
                    });
                    localAssociatedItems = newList;
                    onchange?.(newList.map((i) => i.id!).filter(Boolean), newList);
                }
            } else {
                if (singleSelect) {
                    if (entityId && removeAssociationRemote) {
                        for (const existing of currentList) {
                            if (existing.id) {
                                await removeAssociationRemote({
                                    type,
                                    entityId,
                                    itemId: existing.id,
                                });
                            }
                        }
                    }
                    if (entityId && addAssociationRemote) {
                        await addAssociationRemote({
                            type,
                            entityId,
                            itemId: item.id!,
                        });
                        if (typeof associationsPromise?.refresh === 'function') {
                            await associationsPromise.refresh();
                        }
                    }
                    if (entityId && addAssociationRemote) {
                        // Already handled
                    } else {
                        const newList = [item];
                        localAssociatedItems = newList;
                        onchange?.(
                            newList.map((i) => i.id!).filter(Boolean),
                            newList,
                        );
                    }
                    showSelector = false;
                } else {
                    if (entityId && addAssociationRemote) {
                        await addAssociationRemote({
                            type,
                            entityId,
                            itemId: item.id!,
                        });
                        if (typeof associationsPromise?.refresh === 'function') {
                            await associationsPromise.refresh();
                        }
                    } else {
                        if (!mounted) return;
                        const newList = [...currentList, item];
                        localAssociatedItems = newList;
                        onchange?.(
                            newList.map((i) => i.id!).filter(Boolean),
                            newList,
                        );
                    }
                }
            }
        } catch (e: any) {
            if (!mounted) return;
            toast.error(e.message || "Failed to update association");
        } finally {
            if (mounted) {
                linkingItemId = null;
            }
        }
    }

    async function deleteItem(item: T, currentList: T[]) {
        if (!item.id || !deleteItemRemote) return;
        deletingItemId = item.id;
        try {
            const result = await invokeRemote(deleteItemRemote, [item.id]);
            const success =
                result === true || (result && result.success !== false);
            if (!success) return;

            if (typeof selectorListPromise?.refresh === 'function') {
                await selectorListPromise.refresh();
            }

            if (typeof associationsPromise?.refresh === 'function') {
                await associationsPromise.refresh();
            } else {
                const newList = currentList.filter((i) => i.id !== item.id);
                localAssociatedItems = newList;
                onchange?.(newList.map((i) => i.id!).filter(Boolean), newList);
            }

            if (success && mounted) {
                toast.success("Deleted successfully");
            }
        } catch (e: any) {
            if (mounted) toast.error(e.message || "Failed to delete item");
        } finally {
            if (mounted) deletingItemId = null;
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

        if (newId) {
            if (typeof selectorListPromise?.refresh === 'function') {
                await selectorListPromise.refresh();
            }

            if (entityId && addAssociationRemote) {
                await addAssociationRemote({
                    type,
                    entityId,
                    itemId: newId,
                });
                
                if (typeof associationsPromise?.refresh === 'function') {
                    await associationsPromise.refresh();
                }
            } else {
                const res = await selectorListPromise;
                const { data: items } = normalize(res);
                const newItem = items.find((i: any) => i.id === newId);

                if (newItem && mounted) {
                    const newList = [newItem, ...currentList];
                    localAssociatedItems = newList;
                    onchange?.(newList.map((i) => i.id!).filter(Boolean), newList);
                }
            }
            if (mounted) toast.success(`${title} created and associated`);
        }
    }

    async function handleInPlaceUpdateSuccess(result: any, currentList: T[]) {
        const targetId = editingItem?.id;
        editingItem = null;
        if (!targetId) return;

        if (typeof selectorListPromise?.refresh === 'function') {
            await selectorListPromise.refresh();
        }

        if (typeof associationsPromise?.refresh === 'function') {
            await associationsPromise.refresh();
        } else {
            const res = await selectorListPromise;
            const { data: items } = normalize(res);
            const updatedItem = items.find((i: any) => i.id === targetId);

            if (updatedItem && mounted) {
                const newList = currentList.map((i) =>
                    i.id === targetId ? updatedItem : i,
                );
                localAssociatedItems = newList;
                onchange?.(newList.map((i) => i.id!).filter(Boolean), newList);
            }
        }
        if (mounted) toast.success(`${title} updated`);
    }
</script>

<!-- Action Bar (Search, Actions) -->
<div class="flex flex-col gap-3 mb-3">
    <div class="flex flex-col md:flex-row gap-3">
        <div class="relative flex-1">
            <Search
                size={14}
                class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
                type="text"
                placeholder={searchPlaceholder}
                bind:value={searchQuery}
                class="pl-9 w-full px-2 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all bg-gray-50/50"
            />
        </div>

        <div class="flex items-center gap-1.5 ml-auto shrink-0">
            {#await associationsPromise}
                <div class="flex items-center justify-center p-1">
                    <Loader2 class="h-4 w-4 animate-spin text-blue-500" />
                </div>
            {:then res}
                {@const { data: currentAssociations } = normalize(res)}
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
                    <span class="text-sm font-semibold">{quickCreateLabel}</span
                    >
                </Button>
            {/if}
        </div>
    </div>
</div>

{#if showSelector}
    <div
        class="bg-white border-2 border-blue-50 rounded-2xl p-2 mb-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 relative min-h-[100px]"
    >
        <svelte:boundary>
            {#if $effect.pending()}
                <div class="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-xl">
                    <div class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
            {/if}

            <div class={["max-h-64 overflow-y-auto space-y-1 p-1 transition-opacity duration-200", $effect.pending() && "opacity-50 pointer-events-none"]}>
                {#await selectorListPromise then res}
                    {@const allItems = normalize(res).data}
                    {@const filteredItems = searchQuery
                        ? allItems.filter(
                              (i: any) =>
                                  i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  i.title?.toLowerCase().includes(searchQuery.toLowerCase()),
                          )
                        : allItems}
                    
                    {#if filteredItems.length === 0}
                        <div class="text-xs text-center py-8 text-gray-400 font-medium italic">
                            {searchQuery ? noItemsFoundLabel : noItemsLabel}
                        </div>
                    {:else}
                        {#await associationsPromise then ares}
                            {@const currentAssociations = normalize(ares).data}
                            {#each filteredItems as item (item.id)}
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
                                                {item.name ||
                                                    item.id ||
                                                    "Unnamed Item"}
                                            {/if}
                                        </div>
                                    </div>

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
                                                ? confirmUnlinkLabel
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
                                                class="h-8 w-8 p-0 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                loading={deletingItemId === item.id}
                                                loadingLabel=""
                                                onclick={() =>
                                                    deleteItem(item, currentAssociations)}
                                                title={deleteForeverLabel}
                                            >
                                                <Trash2 size={15} />
                                            </AsyncButton>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        {/await}
                    {/if}
                {/await}
            </div>

            {#snippet pending()}
                <div class="text-xs text-center py-8 text-gray-400 font-medium">
                    <div class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    {loadingLabel}
                </div>
            {/snippet}

            {#snippet failed(error: any, reset)}
                <div class="text-xs text-center py-8 text-red-500 font-medium">
                    {error?.message || "Failed to load items"}
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
            {#await associationsPromise then res}
                {@const { data: currentAssociations } = normalize(res)}
                {@const items = searchQuery
                    ? currentAssociations.filter(
                          (i: any) =>
                              i.name
                                  ?.toLowerCase()
                                  .includes(searchQuery.toLowerCase()) ||
                              i.title
                                  ?.toLowerCase()
                                  .includes(searchQuery.toLowerCase()),
                      )
                    : currentAssociations}
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
                                onclick={() =>
                                    toggleAssociation(
                                        item,
                                        currentAssociations,
                                    )}
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
                                    onclick={() =>
                                        deleteItem(item, currentAssociations)}
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
            {/await}
        </div>

        {#snippet pending()}
            <div class="text-center py-10 animate-pulse text-gray-400 font-medium">
                <div class="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                {loadingLabel}
            </div>
        {/snippet}

        {#snippet failed(error: any, reset)}
            <div class="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                <p class="text-sm font-medium text-red-600">
                    {error?.message || "Failed to load associations"}
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
                    {editingItem ? editLabel : quickCreateLabel}
                </Dialog.Title>
            </Dialog.Header>

            <div style="overflow-y: auto; flex: 1; min-height: 0;">
                {#await associationsPromise}
                    <div class="p-8 flex justify-center">
                        <div class="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                {:then res}
                    {@const currentAssociations = normalize(res).data}
                    <svelte:boundary>
                        {#if editingItem && getFormData}
                            {@render renderForm({
                                remoteFunction: updateRemote,
                                schema: updateSchema,
                                initialData: getFormData(editingItem),
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
                        {:else if showQuickCreate}
                            {@render renderForm({
                                remoteFunction: createRemote,
                                schema: createSchema,
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
                    </svelte:boundary>
                {/await}
            </div>
        </Dialog.Content>
    </Dialog.Root>
{/if}
