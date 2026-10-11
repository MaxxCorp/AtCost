<script lang="ts">
    import { type Component, type Snippet } from "svelte";
    // @ts-ignore
    import EntityManager_ from "./EntityManager.svelte";
    const EntityManager = EntityManager_ as any;
    // @ts-ignore
    import TagForm from "./forms/TagForm.svelte";
    import { Tag as TagIcon, Globe, Lock, FolderTree } from "@lucide/svelte";
    import { handleDelete } from "../hooks/handleDelete.svelte.js";

    interface TagItem {
        id: string;
        name: string;
        color?: string | null;
        visibility?: "internal" | "external";
        description?: string | null;
        categoryId?: string | null;
        category?: { id: string; name: string; color?: string } | null;
    }

    interface Props<T extends TagItem = TagItem> {
        title?: string;
        icon?: Component<any>;
        mode?: "embedded" | "standalone";
        preferenceKey?: string;
        singleSelect?: boolean;

        // Association & Events
        initialItems?: any[];
        onchange?: (ids: string[], items: T[]) => void;
        entityId?: string;
        addAssociationRemote?: any;
        removeAssociationRemote?: any;

        // Data Remotes
        listItemsRemote: any;
        deleteItemRemote?: any;
        createRemote?: any;
        createSchema?: any;
        updateRemote?: any;
        updateSchema?: any;
        readItemRemote?: any;

        // Categories & Category Commands
        categories?: Array<{ id: string; name: string; color?: string; description?: string | null; slug?: string | null }>;
        categoriesRemote?: any;
        createCategoryRemote?: any;
        updateCategoryRemote?: any;
        deleteCategoryRemote?: any;
        onCategoryCreated?: (cat: any) => void;
        onCategoryUpdated?: (cat: any) => void;
        onCategoryDeleted?: (id: string) => void;

        // Custom snippets if overrides needed
        renderItem?: Snippet<[T]>;
        renderItemLabel?: Snippet<[T]>;
        renderForm?: Snippet<[any]>;

        m?: any;
        labels?: any;
    }

    let {
        title = "Tags",
        icon = TagIcon,
        mode = "embedded",
        preferenceKey = "em_filters_tags",
        singleSelect = false,
        initialItems = [],
        onchange = undefined,
        entityId = undefined,
        addAssociationRemote = undefined,
        removeAssociationRemote = undefined,
        listItemsRemote,
        deleteItemRemote = undefined,
        createRemote = undefined,
        createSchema = undefined,
        updateRemote = undefined,
        updateSchema = undefined,
        readItemRemote = undefined,
        categories = [],
        categoriesRemote = undefined,
        createCategoryRemote = undefined,
        updateCategoryRemote = undefined,
        deleteCategoryRemote = undefined,
        onCategoryCreated = undefined,
        onCategoryUpdated = undefined,
        onCategoryDeleted = undefined,
        renderItem: customRenderItem,
        renderItemLabel: customRenderItemLabel,
        renderForm: customRenderForm,
        m = undefined,
        labels = {},
        ...rest
    }: Props<any> = $props();

    // Default filter groups for Tags (Visibility and Category)
    const filterGroups = $derived([
        {
            id: "visibility",
            label: "Sichtbarkeit",
            icon: Globe,
            options: [
                { id: "internal", label: "Nur Intern (HR / Abrechnung)" },
                { id: "external", label: "Nur Extern (Multiposter / Kioske)" },
            ]
        },
        ...(categoriesRemote ? [{
            id: "categoryId",
            label: "Kategorie",
            icon: FolderTree,
            optionsRemote: categoriesRemote,
            searchable: true,
        }] : categories.length > 0 ? [{
            id: "categoryId",
            label: "Kategorie",
            icon: FolderTree,
            options: categories.map(c => ({ id: c.id, label: c.name })),
            searchable: true,
        }] : [])
    ]);

    // Normalize initial items if junction records like { tag: TagItem } are passed
    const normalizedInitialItems = $derived.by(() => {
        return (initialItems || []).map((item: any) => {
            if (item && 'tag' in item && item.tag) {
                return item.tag;
            }
            return item;
        }).filter(Boolean);
    });
</script>

<EntityManager
    {title}
    icon={icon}
    groupIcon={FolderTree}
    {mode}
    {preferenceKey}
    {singleSelect}
    initialItems={normalizedInitialItems}
    {onchange}
    {entityId}
    {addAssociationRemote}
    {removeAssociationRemote}
    {listItemsRemote}
    {createRemote}
    {createSchema}
    {updateRemote}
    {updateSchema}
    {readItemRemote}
    {deleteItemRemote}
    {filterGroups}
    searchPredicate={(t: any, q: string) => {
        if (!t) return false;
        const query = q.toLowerCase();
        return (
            (t.name && t.name.toLowerCase().includes(query)) ||
            (t.description && t.description.toLowerCase().includes(query)) ||
            (t.category?.name && t.category.name.toLowerCase().includes(query))
        );
    }}
    groupBy={(t: any) => t.category?.name || "Allgemein"}
    selectorGroupBy={(t: any) => t.category?.name || "Allgemein"}
    {m}
    {...rest}
>
    {#snippet renderItem(t: any)}
        {#if customRenderItem}
            {@render customRenderItem(t)}
        {:else}
            <div class="flex items-center justify-between gap-4 w-full">
                <div class="flex items-center gap-3 min-w-0">
                    <span 
                        class="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-black/10" 
                        style={t.color ? `background-color: ${t.color};` : 'background-color: #6366f1;'}
                    ></span>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-gray-900 text-sm">
                                {t.name}
                            </span>
                            {#if t.category}
                                <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                    {t.category.name}
                                </span>
                            {/if}
                            {#if t.visibility === 'external'}
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Globe size={10} />
                                    Öffentlich
                                </span>
                            {:else}
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    <Lock size={10} />
                                    Intern
                                </span>
                            {/if}
                        </div>
                        {#if t.description}
                            <p class="text-xs text-gray-500 mt-0.5 truncate">
                                {t.description}
                            </p>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    {/snippet}

    {#snippet renderItemLabel(t: any)}
        {#if customRenderItemLabel}
            {@render customRenderItemLabel(t)}
        {:else}
            {@render renderItem(t)}
        {/if}
    {/snippet}

    {#snippet renderForm({ remoteFunction, schema, isUpdating, initialData, onSuccess, onCancel, id }: any)}
        {#if customRenderForm}
            {@render customRenderForm({ remoteFunction, schema, isUpdating, initialData, onSuccess, onCancel, id })}
        {:else}
            <TagForm
                {remoteFunction}
                validationSchema={schema}
                isUpdating={isUpdating || !!id}
                {initialData}
                {categories}
                {createCategoryRemote}
                {updateCategoryRemote}
                {deleteCategoryRemote}
                {onCategoryCreated}
                {onCategoryUpdated}
                {onCategoryDeleted}
                {onSuccess}
                {onCancel}
                {m}
            />
        {/if}
    {/snippet}
</EntityManager>
