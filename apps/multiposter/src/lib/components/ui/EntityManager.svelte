<script lang="ts">
    import { onMount, type Component, type Snippet } from "svelte";
    import {
        Search,
        Plus,
        Link,
        Unlink,
        ExternalLink,
        Pencil,
        X,
        Trash2,
    } from "@lucide/svelte";

    import Button from "./button/button.svelte";
    import AsyncButton from "./AsyncButton.svelte";
    import * as Dialog from "./dialog";
    import { toast } from "svelte-sonner";

    interface Props<T extends { id: string }> {
        title: string;
        icon: Component<any>;
        type?: string;
        entityId?: string | null;
        embedded?: boolean;
        onchange?: (ids: string[]) => void;

        // Data fetchers
        listItemsRemote: () => Promise<T[]>;
        fetchAssociationsRemote?: (params: {
            type: string;
            entityId: string;
        }) => Promise<T[]>;
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
        deleteItemRemote: (id: string) => Promise<boolean>;

        // Form Data
        createRemote: any;
        createSchema: any;
        updateRemote: any;
        updateSchema: any;
        getFormData: (item: T) => any;

        // Form Rendering
        renderForm: Snippet<
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
        renderItemLabel: Snippet<[T]>;
        renderItemBadge?: Snippet<[T]>;
        participationSnippet?: Snippet<[T]>;

        // Search
        searchPredicate: (item: T, query: string) => boolean;

        // Initial state
        initialItems?: T[];
    }

    let {
        title,
        icon: Icon,
        type,
        entityId = null,
        embedded = false,
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
        participationSnippet,
        searchPredicate,
        initialItems = [],
    }: Props<any> = $props();

    // svelte-ignore state_referenced_locally
    let associatedItems = $state<any[]>(initialItems);
    let allItems = $state<any[]>([]);
    let showSelector = $state(false);
    let showQuickCreate = $state(false);
    let searchQuery = $state("");
    let loadingSearch = $state(false);
    let editingItem = $state<any | null>(null);
    let linkingItemId = $state<string | null>(null);
    let deletingItemId = $state<string | null>(null);

    const filteredItems = $derived(
        allItems.filter((i) => searchPredicate(i, searchQuery)),
    );

    onMount(async () => {
        if (entityId && fetchAssociationsRemote) {
            associatedItems = await fetchAssociationsRemote({
                type: type!,
                entityId,
            });
        }
    });

    async function toggleSelector() {
        showSelector = !showSelector;
        if (showSelector && allItems.length === 0) {
            loadingSearch = true;
            allItems = await listItemsRemote();
            loadingSearch = false;
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
                if (entityId && addAssociationRemote) {
                    await addAssociationRemote({
                        type: type!,
                        entityId,
                        itemId: item.id,
                    });
                }
                associatedItems = [...associatedItems, item];
            }
            if (onchange) onchange(associatedItems.map((i) => i.id));
        } catch (error: any) {
            toast.error(error.message || "Failed to update association");
        } finally {
            linkingItemId = null;
        }
    }

    async function handleQuickCreateSuccess(result: any) {
        showQuickCreate = false;

        if (result?.id) {
            const items = await listItemsRemote();
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
                if (onchange) onchange(associatedItems.map((i) => i.id));
                toast.success(`${title} created and associated`);
            }
        }
    }

    async function handleInPlaceUpdateSuccess(result: any) {
        const targetId = editingItem?.id;
        editingItem = null;

        if (!targetId) return;

        const items = await listItemsRemote();
        const updatedItem = items.find((i: any) => i.id === targetId);

        if (updatedItem) {
            associatedItems = associatedItems.map((i) =>
                i.id === targetId ? updatedItem : i,
            );
            allItems = allItems.map((i) =>
                i.id === targetId ? updatedItem : i,
            );
            if (onchange) onchange(associatedItems.map((i) => i.id));
            toast.success(`${title} updated`);
        }
    }

    async function deleteItem(item: any) {
        if (!item.id) return;
        deletingItemId = item.id;
        try {
            const success = await deleteItemRemote(item.id);
            if (success) {
                allItems = allItems.filter((i) => i.id !== item.id);
                associatedItems = associatedItems.filter(
                    (i) => i.id !== item.id,
                );
                if (onchange) onchange(associatedItems.map((i) => i.id));
            }
        } finally {
            deletingItemId = null;
        }
    }
</script>

<div class="space-y-4 border rounded-lg p-4 bg-gray-50">
    <div
        class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
    >
        <h3
            class="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2"
        >
            <Icon size={16} />
            {showSelector ? `Link ${title}` : `Associated ${title}`}
        </h3>
        <div class="flex gap-2 flex-wrap">
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={toggleSelector}
                class="flex items-center gap-1"
            >
                {#if showSelector}
                    <X size={16} />
                    <span class="hidden sm:inline">Close Search</span>
                    <span class="sm:hidden">Close</span>
                {:else}
                    <Link size={16} />
                    <span class="hidden sm:inline">Link {title}</span>
                    <span class="sm:hidden">Link</span>
                {/if}
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={() => (showQuickCreate = !showQuickCreate)}
                class="flex items-center gap-1"
            >
                <Plus size={16} />
                <span class="hidden sm:inline">Quick Create</span>
                <span class="sm:hidden">Create</span>
            </Button>
        </div>
    </div>

    {#if showSelector}
        <!-- Search Mode -->
        <div class="bg-white border rounded-lg p-3 shadow-inner space-y-3">
            <div class="relative">
                <Search
                    size={16}
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                    type="text"
                    placeholder={`Search ${title.toLowerCase()}...`}
                    bind:value={searchQuery}
                    class="pl-9 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div class="max-h-64 overflow-y-auto space-y-1">
                {#if loadingSearch}
                    <div class="text-xs text-center py-4 text-gray-400">
                        Loading {title.toLowerCase()}...
                    </div>
                {:else if filteredItems.length === 0}
                    <div class="text-xs text-center py-4 text-gray-400">
                        No {title.toLowerCase()} found.
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
                                    {@render renderItemLabel(item)}
                                </span>
                            </div>

                            <div class="flex items-center gap-1">
                                <AsyncButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="h-8 px-2 text-gray-400 hover:text-blue-500 opacity-0 group-hover/item:opacity-100"
                                    loading={linkingItemId === item.id}
                                    loadingLabel=""
                                    onclick={() => toggleAssociation(item)}
                                    title={isAssociated ? "Unlink" : "Link"}
                                >
                                    {#if isAssociated}
                                        <Unlink size={14} />
                                    {:else}
                                        <Link size={14} />
                                    {/if}
                                </AsyncButton>
                                <AsyncButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="h-8 px-2 text-gray-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100"
                                    loading={deletingItemId === item.id}
                                    loadingLabel=""
                                    onclick={() => deleteItem(item)}
                                    title={`Delete ${title.toLowerCase()} forever`}
                                >
                                    <Trash2 size={14} />
                                </AsyncButton>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {:else}
        <!-- Home Mode -->
        {#if associatedItems.length > 0}
            <div class="space-y-1">
                {#each associatedItems as item}
                    <div
                        class="flex items-center gap-2 group/item transition-colors rounded-md p-1 hover:bg-gray-100"
                    >
                        <div class="flex-1 px-2 py-1">
                            <span class="text-sm font-medium text-gray-700">
                                {@render renderItemLabel(item)}
                            </span>
                        </div>

                        {#if participationSnippet}
                            {@render participationSnippet(item)}
                        {/if}

                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                class="h-8 px-2 text-gray-400 hover:text-blue-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                onclick={() => {
                                    editingItem = item;
                                    showQuickCreate = false;
                                    showSelector = false;
                                }}
                                title="Edit in place"
                            >
                                <Pencil size={14} />
                            </button>
                            <AsyncButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                class="h-8 px-2 text-gray-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100"
                                loading={linkingItemId === item.id}
                                loadingLabel=""
                                onclick={() => toggleAssociation(item)}
                                title="Remove link"
                            >
                                <Unlink size={14} />
                            </AsyncButton>
                            <AsyncButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                class="h-8 px-2 text-gray-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100"
                                loading={deletingItemId === item.id}
                                loadingLabel=""
                                onclick={() => deleteItem(item)}
                                title={`Delete ${title.toLowerCase()} forever`}
                            >
                                <Trash2 size={14} />
                            </AsyncButton>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <p class="text-sm text-gray-500 italic">
                No {title.toLowerCase()} associated yet.
            </p>
        {/if}
    {/if}

    <Dialog.Root
        open={showQuickCreate || editingItem !== null}
        onOpenChange={(open) => {
            if (!open) {
                showQuickCreate = false;
                editingItem = null;
            }
        }}
    >
        <Dialog.Content class="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
            <Dialog.Header class="mb-4">
                <Dialog.Title class="text-xl font-bold">
                    {editingItem ? `Edit ${title}` : `Quick Create ${title}`}
                </Dialog.Title>
            </Dialog.Header>

            <div class="mt-2">
                {#if editingItem}
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
</div>
