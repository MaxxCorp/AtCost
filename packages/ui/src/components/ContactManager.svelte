<script lang="ts">
    import { type Component, type Snippet } from "svelte";
    // @ts-ignore
    import EntityManager_ from "./EntityManager.svelte";
    const EntityManager = EntityManager_ as any;
    // @ts-ignore
    import ContactForm from "./forms/ContactForm.svelte";
    import { User } from "@lucide/svelte";
    import { matchContactSearch } from "../utils.js";
    import type { FilterGroup, ContactItem } from "./EntityManager.types.js";


    interface Props<T extends ContactItem = ContactItem> {
        title?: string;
        icon?: Component<any>;
        mode?: "embedded" | "standalone";
        type?: string;
        entityId?: string;
        preferenceKey?: string;
        singleSelect?: boolean;

        // Association & Events
        initialItems?: any[];
        onchange?: (ids: string[], items: T[]) => void;
        addAssociationRemote?: any;
        removeAssociationRemote?: any;
        fetchAssociationsRemote?: any;

        // Data Remotes
        listItemsRemote: (params?: any) => Promise<any>;
        deleteItemRemote?: (ids: string[]) => Promise<any>;
        createRemote?: any;
        createSchema?: any;
        updateRemote?: any;
        updateSchema?: any;
        readItemRemote?: (id: string) => Promise<any>;

        // Filters
        filters?: FilterGroup[];
        filterGroups?: FilterGroup[];

        // Form delegation
        listTagsRemote?: any;
        createTagRemote?: any;
        updateTagRemote?: any;
        deleteTagRemote?: any;

        // Snippets
        renderItem?: Snippet<[T]>;
        renderItemLabel?: Snippet<[T]>;
        renderItemBadge?: Snippet<[T]>;
        renderItemDetail?: Snippet<[T]>;
        renderForm?: Snippet<[any]>;
        rolesSnippet?: Snippet<[T]>;
        participationSnippet?: Snippet<[T]>;
        toolbarActions?: Snippet;

        // Search & Sort
        searchPredicate?: (item: T, query: string) => boolean;
        sortField?: string;
        sortOrder?: "asc" | "desc";

        showQuickCreateButton?: boolean;
        linkItemLabel?: string;
        associatedItemLabel?: string;
        searchPlaceholder?: string;
        noItemsLabel?: string;
        noItemsFoundLabel?: string;
        loadingLabel?: string;
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

        m?: any;
        labels?: any;
        [key: string]: any;
    }

    let {
        title = undefined,
        icon = User,
        mode = "embedded",
        type = "",
        entityId = "",
        preferenceKey = "em_filters_contacts",
        singleSelect = false,
        initialItems = [],
        onchange = undefined,
        addAssociationRemote = undefined,
        removeAssociationRemote = undefined,
        fetchAssociationsRemote = undefined,
        listItemsRemote,
        deleteItemRemote = undefined,
        createRemote = undefined,
        createSchema = undefined,
        updateRemote = undefined,
        updateSchema = undefined,
        readItemRemote = undefined,
        filters = undefined,
        filterGroups = undefined,
        listTagsRemote = undefined,
        createTagRemote = undefined,
        updateTagRemote = undefined,
        deleteTagRemote = undefined,
        renderItem: customRenderItem,
        renderItemLabel: customRenderItemLabel,
        renderItemBadge,
        renderItemDetail,
        renderForm: customRenderForm,
        rolesSnippet,
        participationSnippet,
        toolbarActions,
        searchPredicate = matchContactSearch,
        sortField = "displayName",
        sortOrder = "asc",
        showQuickCreateButton = true,
        linkItemLabel = undefined,
        associatedItemLabel = undefined,
        searchPlaceholder = undefined,
        noItemsLabel = undefined,
        noItemsFoundLabel = undefined,
        loadingLabel = undefined,
        quickCreateLabel = undefined,
        closeSearchLabel = undefined,
        editLabel = undefined,
        deleteLabel = undefined,
        unlinkLabel = undefined,
        deleteForeverLabel = undefined,
        bulkDeleteLabel = undefined,
        selectAllLabel = undefined,
        deselectAllLabel = undefined,
        confirmUnlinkLabel = undefined,
        m = undefined,
        labels = {},
        ...rest
    }: Props<any> = $props();

    const resolvedTitle = $derived(
        title ??
        (m?.feature_contacts_title ? m.feature_contacts_title() : undefined) ??
        (m?.contacts ? m.contacts() : undefined) ??
        labels?.title ??
        "Contacts"
    );

    // Normalize initial items if junction records like { contact: ContactItem } are passed
    const normalizedInitialItems = $derived.by(() => {
        return (initialItems || []).map((item: any) => {
            if (item && typeof item === "object" && "contact" in item && item.contact) {
                return {
                    ...item.contact,
                    participationStatus: item.participationStatus ?? item.contact.participationStatus,
                    roles: item.roles ?? item.contact.roles,
                };
            }
            return item;
        }).filter(Boolean);
    });
</script>

<EntityManager
    title={resolvedTitle}
    icon={icon}
    {mode}
    {type}
    {entityId}
    {preferenceKey}
    {singleSelect}
    initialItems={normalizedInitialItems}
    {onchange}
    {addAssociationRemote}
    {removeAssociationRemote}
    {fetchAssociationsRemote}
    {listItemsRemote}
    {deleteItemRemote}
    {createRemote}
    {createSchema}
    {updateRemote}
    {updateSchema}
    {readItemRemote}
    filters={filters ?? filterGroups}
    {searchPredicate}
    {sortField}
    {sortOrder}
    {showQuickCreateButton}
    linkItemLabel={linkItemLabel ?? (m?.link_item_label ? m.link_item_label({ item: resolvedTitle }) : undefined)}
    associatedItemLabel={associatedItemLabel ?? (m?.associated_item_label ? m.associated_item_label({ item: resolvedTitle }) : undefined)}
    searchPlaceholder={searchPlaceholder ?? (m?.search_placeholder ? m.search_placeholder({ item: resolvedTitle }) : (m?.search_contacts_placeholder ? m.search_contacts_placeholder() : undefined))}
    noItemsLabel={noItemsLabel ?? (m?.no_items_associated_label ? m.no_items_associated_label({ item: resolvedTitle }) : (m?.no_contact_selected ? m.no_contact_selected() : undefined))}
    noItemsFoundLabel={noItemsFoundLabel ?? (m?.no_items_found ? m.no_items_found({ item: resolvedTitle }) : undefined)}
    loadingLabel={loadingLabel ?? (m?.loading_item ? m.loading_item({ item: resolvedTitle }) : undefined)}
    quickCreateLabel={quickCreateLabel ?? (m?.quick_create ? m.quick_create() : undefined)}
    closeSearchLabel={closeSearchLabel ?? (m?.close_search ? m.close_search() : undefined)}
    editLabel={editLabel ?? (m?.edit ? m.edit() : undefined)}
    deleteLabel={deleteLabel ?? (m?.delete ? m.delete() : undefined)}
    unlinkLabel={unlinkLabel ?? (m?.unlink ? m.unlink() : undefined)}
    deleteForeverLabel={deleteForeverLabel ?? (m?.delete_forever ? m.delete_forever({ item: m?.contact ? m.contact() : "Contact" }) : undefined)}
    bulkDeleteLabel={bulkDeleteLabel ?? (m?.delete_selected ? m.delete_selected({ count: 0 }) : undefined)}
    selectAllLabel={selectAllLabel ?? (m?.select_all ? m.select_all() : undefined)}
    deselectAllLabel={deselectAllLabel ?? (m?.deselect_all ? m.deselect_all() : undefined)}
    confirmUnlinkLabel={confirmUnlinkLabel ?? (m?.confirm_unlink_label ? m.confirm_unlink_label({ item: m?.contact ? m.contact() : "Contact" }) : undefined)}
    {m}
    {...rest}
>
    {#snippet renderItem(contactItem: any)}
        {#if customRenderItem}
            {@render customRenderItem(contactItem)}
        {:else}
            {@const contactName = contactItem.displayName ||
                `${contactItem.givenName || ""} ${contactItem.familyName || ""}`.trim() ||
                contactItem.company ||
                (m?.unnamed_contact ? m.unnamed_contact() : "Unnamed Contact")}
            <div class="flex flex-col min-w-0">
                <span class="text-sm font-medium truncate">{contactName}</span>
                {#if contactItem.emails?.[0]?.value}
                    <span class="text-xs text-gray-500 truncate">{contactItem.emails[0].value}</span>
                {:else if contactItem.role || contactItem.company}
                    <span class="text-xs text-gray-400 truncate">{[contactItem.role, contactItem.company].filter(Boolean).join(" · ")}</span>
                {/if}
            </div>
        {/if}
    {/snippet}

    {#snippet renderItemLabel(contactItem: any)}
        {#if customRenderItemLabel}
            {@render customRenderItemLabel(contactItem)}
        {:else}
            {@render renderItem(contactItem)}
        {/if}
    {/snippet}

    {#snippet renderItemBadge(contactItem: any)}
        {#if renderItemBadge}
            {@render renderItemBadge(contactItem)}
        {/if}
    {/snippet}

    {#snippet renderItemDetail(contactItem: any)}
        {#if renderItemDetail}
            {@render renderItemDetail(contactItem)}
        {/if}
    {/snippet}

    {#snippet rolesSnippet(contactItem: any)}
        {#if rolesSnippet}
            {@render rolesSnippet(contactItem)}
        {/if}
    {/snippet}

    {#snippet participationSnippet(contactItem: any)}
        {#if participationSnippet}
            {@render participationSnippet(contactItem)}
        {/if}
    {/snippet}

    {#snippet toolbarActions()}
        {#if toolbarActions}
            {@render toolbarActions()}
        {/if}
    {/snippet}

    {#snippet renderForm({ remoteFunction, schema, isUpdating, initialData, onSuccess, onCancel, id }: any)}
        {#if customRenderForm}
            {@render customRenderForm({ remoteFunction, schema, isUpdating, initialData, onSuccess, onCancel, id })}
        {:else}
            <ContactForm
                {remoteFunction}
                {schema}
                isUpdating={isUpdating || !!id}
                contactId={id}
                initialData={initialData || {}}
                {onSuccess}
                {onCancel}
                listContactsRemote={listItemsRemote}
                {listTagsRemote}
                {createTagRemote}
                {updateTagRemote}
                {deleteTagRemote}
                {m}
                {labels}
            />
        {/if}
    {/snippet}
</EntityManager>
