<script lang="ts">
    import { type Component, type Snippet } from "svelte";
    // @ts-ignore
    import EntityManager_ from "./EntityManager.svelte";
    const EntityManager = EntityManager_ as any;
    import { MapPin } from "@lucide/svelte";
    import LocationForm from "./forms/LocationForm.svelte";

    interface Props<T extends { id?: string | null; name?: string; roomId?: string | null; city?: string | null }> {
        title?: string;
        icon?: Component<any>;
        type?: string;
        entityId?: string;
        mode?: "embedded" | "standalone";
        singleSelect?: boolean;
        onchange?: (ids: string[], items: T[]) => void;
        initialItems?: T[];

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
        renderForm?: Snippet<[any]>;
        // Rendering snippets
        renderItemLabel?: Snippet<[T]>;
        renderItemBadge?: Snippet<[T]>;
        renderItemDetail?: Snippet<[T]>;
        participationSnippet?: Snippet<[T]>;

        // Search
        searchPredicate?: (item: T, query: string) => boolean;

        // Sorting
        sortField?: string;
        sortOrder?: "asc" | "desc";

        // Localization & options
        m?: any;
        labels?: any;
        filters?: any[];
        filterAssociations?: any[];
        showQuickCreateButton?: boolean;
        loadingLabel?: string;
        noItemsLabel?: string;
        noItemsFoundLabel?: string;
        searchPlaceholder?: string;
        linkItemLabel?: string;
        quickCreateLabel?: string;
        closeSearchLabel?: string;
        editLabel?: string;
        deleteForeverLabel?: string;
        confirmUnlinkLabel?: string;
    }

    let {
        title = undefined,
        icon = MapPin,
        type = "location",
        entityId = "",
        mode = "embedded",
        singleSelect = false,
        onchange = undefined,
        initialItems = [],
        listItemsRemote,
        fetchAssociationsRemote = undefined,
        addAssociationRemote = undefined,
        removeAssociationRemote = undefined,
        deleteItemRemote = undefined,
        createRemote = undefined,
        createSchema = undefined,
        updateRemote = undefined,
        updateSchema = undefined,
        getFormData = (loc: any) => loc,
        renderForm = undefined,
        renderItemLabel = undefined,
        renderItemBadge = undefined,
        renderItemDetail = undefined,
        participationSnippet = undefined,
        searchPredicate = (loc: any, q: string) => {
            if (!loc) return false;
            const term = q.toLowerCase();
            return (
                (loc.name?.toLowerCase().includes(term) ?? false) ||
                (loc.roomId?.toLowerCase().includes(term) ?? false) ||
                (loc.city?.toLowerCase().includes(term) ?? false)
            );
        },
        sortField = "name",
        sortOrder = "asc",
        m = undefined,
        labels = undefined,
        filters = undefined,
        filterAssociations = undefined,
        showQuickCreateButton = true,
        loadingLabel = undefined,
        noItemsLabel = undefined,
        noItemsFoundLabel = undefined,
        searchPlaceholder = undefined,
        linkItemLabel = undefined,
        quickCreateLabel = undefined,
        closeSearchLabel = undefined,
        editLabel = undefined,
        deleteForeverLabel = undefined,
        confirmUnlinkLabel = undefined,
        ...rest
    }: Props<any> = $props();

    const effectiveTitle = $derived(
        title ?? m?.feature_locations_title?.() ?? "Locations"
    );

    const resolvedLoadingLabel = $derived(
        loadingLabel ?? (m?.loading_item ? m.loading_item({ item: effectiveTitle.toLowerCase() }) : undefined)
    );
    const resolvedNoItemsLabel = $derived(
        noItemsLabel ?? (m?.no_items_associated_label ? m.no_items_associated_label({ item: effectiveTitle }) : undefined)
    );
    const resolvedNoItemsFoundLabel = $derived(
        noItemsFoundLabel ?? (m?.no_items_found ? m.no_items_found({ item: effectiveTitle }) : undefined)
    );
    const resolvedSearchPlaceholder = $derived(
        searchPlaceholder ?? (m?.search_placeholder ? m.search_placeholder({ item: effectiveTitle }) : undefined)
    );
    const resolvedLinkItemLabel = $derived(
        linkItemLabel ?? (m?.link_item_label ? m.link_item_label({ item: effectiveTitle }) : undefined)
    );
    const resolvedQuickCreateLabel = $derived(
        quickCreateLabel ?? m?.quick_create?.()
    );
    const resolvedCloseSearchLabel = $derived(
        closeSearchLabel ?? m?.close_search?.()
    );
    const resolvedEditLabel = $derived(
        editLabel ?? m?.edit?.()
    );
    const resolvedDeleteForeverLabel = $derived(
        deleteForeverLabel ?? (m?.delete_forever ? m.delete_forever({ item: m?.location ? m.location() : 'location' }) : undefined)
    );
    const resolvedConfirmUnlinkLabel = $derived(
        confirmUnlinkLabel ?? (m?.confirm_unlink_label ? m.confirm_unlink_label({ item: m?.location ? m.location() : 'location' }) : undefined)
    );
</script>

{#snippet defaultItemLabel(loc: any)}
    <span>{loc.name}</span>
    {#if loc.roomId}
        <span class="text-gray-400 text-xs ml-1">({loc.roomId})</span>
    {:else if loc.city}
        <span class="text-gray-400 text-xs ml-1">({loc.city})</span>
    {/if}
{/snippet}

{#snippet defaultLocationForm({ remoteFunction: rf, schema, id, initialData: fData, onSuccess, onCancel }: any)}
    <LocationForm
        remoteFunction={rf}
        validationSchema={schema}
        isUpdating={!!id}
        initialData={fData}
        {onSuccess}
        {onCancel}
        {m}
        {labels}
    />
{/snippet}

<EntityManager
    title={effectiveTitle}
    {icon}
    {type}
    {entityId}
    {mode}
    {singleSelect}
    {onchange}
    {initialItems}
    {listItemsRemote}
    {fetchAssociationsRemote}
    {addAssociationRemote}
    {removeAssociationRemote}
    {deleteItemRemote}
    {createRemote}
    {createSchema}
    {updateRemote}
    {updateSchema}
    {getFormData}
    renderForm={renderForm ?? defaultLocationForm}
    renderItemLabel={renderItemLabel ?? defaultItemLabel}
    {renderItemBadge}
    {renderItemDetail}
    {participationSnippet}
    {searchPredicate}
    {sortField}
    {sortOrder}
    {m}
    {filters}
    {filterAssociations}
    {showQuickCreateButton}
    loadingLabel={resolvedLoadingLabel}
    noItemsLabel={resolvedNoItemsLabel}
    noItemsFoundLabel={resolvedNoItemsFoundLabel}
    searchPlaceholder={resolvedSearchPlaceholder}
    linkItemLabel={resolvedLinkItemLabel}
    quickCreateLabel={resolvedQuickCreateLabel}
    closeSearchLabel={resolvedCloseSearchLabel}
    editLabel={resolvedEditLabel}
    deleteForeverLabel={resolvedDeleteForeverLabel}
    confirmUnlinkLabel={resolvedConfirmUnlinkLabel}
    {...rest}
/>
