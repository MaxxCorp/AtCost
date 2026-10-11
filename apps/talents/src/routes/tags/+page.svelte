<script lang="ts">
    import { listTags } from "./list.remote.js";
    import { deleteTag } from "./[id]/delete.remote.js";
    import { createTag } from "./new/create.remote.js";
    import { updateTag } from "./[id]/update.remote.js";
    import { readTag } from "./[id]/read.remote.js";
    import {
        listTagCategories,
        readTagCategory,
        createTagCategoryAction,
        createTagCategoryCommand,
        updateTagCategoryAction,
        updateTagCategoryCommand,
        deleteTagCategoryAction
    } from "./categories.remote.js";

    import {
        createTagSchema,
        updateTagSchema,
        createTagCategorySchema,
        updateTagCategorySchema,
    } from "@ac/validations";

    import { EntityManager, TagForm, TagCategoryForm } from "@ac/ui";
    import { Tag as TagIcon, FolderTree, Globe, Lock, Sparkles, Layers } from "@lucide/svelte";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";

    breadcrumbState.set({ feature: "tags" });

    let activeTab = $state<"tags" | "categories">("tags");

    // Fetch categories for the TagForm dropdown
    const categoriesQuery = $derived(listTagCategories({ limit: 100 }));
    const availableCategories = $derived(categoriesQuery.current?.data ?? []);

    const tagFilterGroups = $derived([
        {
            id: "visibility",
            label: "Sichtbarkeit",
            icon: Globe,
            options: [
                { id: "internal", label: "Nur Intern (Talents / HR)" },
                { id: "external", label: "Nur Extern (Multiposter / Kioske)" },
            ]
        },
        {
            id: "categoryId",
            label: "Kategorie",
            icon: FolderTree,
            optionsRemote: listTagCategories,
            searchable: true,
        }
    ]);
</script>

<div class="container mx-auto px-4 py-8 max-w-6xl">
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-3">
                    <div class="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <TagIcon size={28} />
                    </div>
                    Tags & Kategorien
                </h1>
                <p class="text-gray-500 mt-1 text-sm">
                    Verwalten Sie Klassifizierungen, Sichtbarkeiten (Intern / Extern) und Kategorien für Lohnabrechnungsläufe und Systemgruppen.
                </p>
            </div>

            <!-- Tab Switcher -->
            <div class="bg-gray-100 p-1.5 rounded-2xl flex items-center shadow-2xs">
                <button
                    type="button"
                    onclick={() => activeTab = "tags"}
                    class={[
                        "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer",
                        activeTab === "tags"
                            ? "bg-white text-indigo-700 shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                    ]}
                >
                    <TagIcon size={14} />
                    Tags
                </button>
                <button
                    type="button"
                    onclick={() => activeTab = "categories"}
                    class={[
                        "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer",
                        activeTab === "categories"
                            ? "bg-white text-indigo-700 shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                    ]}
                >
                    <FolderTree size={14} />
                    Kategorien
                </button>
            </div>
        </div>

        <!-- Tab 1: Tags Manager -->
        {#if activeTab === "tags"}
            <div class="animate-in fade-in duration-150">
                <EntityManager
                    title="Tags"
                    icon={TagIcon}
                    mode="standalone"
                    preferenceKey="em_filters_tags"
                    listItemsRemote={listTags}
                    deleteItemRemote={deleteTag}
                    createRemote={createTag}
                    createSchema={createTagSchema}
                    updateRemote={updateTag}
                    updateSchema={updateTagSchema}
                    readItemRemote={readTag}
                    filterGroups={tagFilterGroups}
                >
                    {#snippet renderItem(t: any)}
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
                                                Öffentlich (Extern)
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
                    {/snippet}

                    {#snippet renderForm({ remoteFunction, schema, isUpdating, initialData, onSuccess, onCancel }: any)}
                        <TagForm
                            {remoteFunction}
                            validationSchema={schema}
                            {isUpdating}
                            {initialData}
                            categories={availableCategories}
                            createCategoryRemote={createTagCategoryCommand}
                            updateCategoryRemote={updateTagCategoryCommand}
                            deleteCategoryRemote={deleteTagCategoryAction}
                            onCategoryCreated={() => { void categoriesQuery.refresh(); }}
                            onCategoryUpdated={() => { void categoriesQuery.refresh(); }}
                            onCategoryDeleted={() => { void categoriesQuery.refresh(); }}
                            {onSuccess}
                            {onCancel}
                        />
                    {/snippet}
                </EntityManager>
            </div>
        {/if}

        <!-- Tab 2: Categories Manager -->
        {#if activeTab === "categories"}
            <div class="animate-in fade-in duration-150">
                <EntityManager
                    title="Tag-Kategorien"
                    icon={FolderTree}
                    mode="standalone"
                    preferenceKey="em_filters_tag_categories"
                    listItemsRemote={listTagCategories}
                    deleteItemRemote={deleteTagCategoryAction}
                    createRemote={createTagCategoryAction}
                    createSchema={createTagCategorySchema}
                    updateRemote={updateTagCategoryAction}
                    updateSchema={updateTagCategorySchema}
                    readItemRemote={async (id: string) => readTagCategory({ id })}
                >
                    {#snippet renderItem(cat: any)}
                        <div class="flex items-center justify-between gap-4 w-full">
                            <div class="flex items-center gap-3 min-w-0">
                                <span 
                                    class="w-3.5 h-3.5 rounded-lg shrink-0 shadow-2xs border border-black/10" 
                                    style={cat.color ? `background-color: ${cat.color};` : 'background-color: #3b82f6;'}
                                ></span>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-gray-900 text-sm">
                                            {cat.name}
                                        </span>
                                        {#if cat.order !== undefined && cat.order !== null}
                                            <span class="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 font-mono">
                                                Reihenfolge: {cat.order}
                                            </span>
                                        {/if}
                                    </div>
                                    {#if cat.description}
                                        <p class="text-xs text-gray-500 mt-0.5 truncate">
                                            {cat.description}
                                        </p>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/snippet}

                    {#snippet renderForm({ remoteFunction, schema, isUpdating, initialData, onSuccess, onCancel }: any)}
                        <TagCategoryForm
                            {remoteFunction}
                            validationSchema={schema}
                            {isUpdating}
                            {initialData}
                            {onSuccess}
                            {onCancel}
                        />
                    {/snippet}
                </EntityManager>
            </div>
        {/if}
    </div>
</div>
