<script lang="ts">
    import { untrack } from "svelte";
    // @ts-ignore
    import AsyncButton from "../AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "../button/index.js";
    import { goto } from "$app/navigation";
    import { translateIssue } from "../../utils.js";
    import { useFormValidationFeedback } from "../../hooks/formValidationFeedback.svelte.ts";
    import { Shield, Globe, Plus, Pencil, Trash2, FolderPlus, FolderEdit, Check, X, Loader2 } from "@lucide/svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        categories = [],
        createCategoryRemote = undefined,
        updateCategoryRemote = undefined,
        deleteCategoryRemote = undefined,
        onCategoryCreated = undefined,
        onCategoryUpdated = undefined,
        onCategoryDeleted = undefined,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/tags",
        labels = {},
        m = undefined,
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        categories?: Array<{ id: string; name: string; color?: string; description?: string | null; slug?: string | null }>;
        createCategoryRemote?: any;
        updateCategoryRemote?: any;
        deleteCategoryRemote?: any;
        onCategoryCreated?: (newCategory: any) => void;
        onCategoryUpdated?: (updatedCategory: any) => void;
        onCategoryDeleted?: (categoryId: string) => void;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        labels?: any;
        m?: any;
    } = $props();

    const colorPresets = [
        { name: "Indigo", value: "indigo", bg: "bg-indigo-500" },
        { name: "Emerald", value: "emerald", bg: "bg-emerald-500" },
        { name: "Blue", value: "blue", bg: "bg-blue-500" },
        { name: "Amber", value: "amber", bg: "bg-amber-500" },
        { name: "Rose", value: "rose", bg: "bg-rose-500" },
        { name: "Purple", value: "purple", bg: "bg-purple-500" },
        { name: "Teal", value: "teal", bg: "bg-teal-500" },
        { name: "Slate", value: "slate", bg: "bg-slate-500" },
    ];

    const effectiveIsUpdating = $derived(isUpdating || !!initialData?.id || !!initialData?.data?.id);
    // svelte-ignore state_referenced_locally
    let selectedVisibility = $state(initialData?.data?.visibility || initialData?.visibility || "internal");
    // svelte-ignore state_referenced_locally
    let selectedColor = $state(initialData?.data?.color || initialData?.color || "indigo");
    // svelte-ignore state_referenced_locally
    let selectedCategoryId = $state(initialData?.data?.categoryId || initialData?.categoryId || "");

    // svelte-ignore state_referenced_locally
    let lastInitializedId = $state<string | null>(initialData?.data?.id || initialData?.id || null);
    $effect(() => {
        const item = initialData?.data || initialData;
        const currentId = item?.id;
        if (currentId && currentId !== lastInitializedId) {
            lastInitializedId = currentId;
            untrack(() => {
                if (item.visibility) selectedVisibility = item.visibility;
                if (item.color) selectedColor = item.color;
                if (item.categoryId !== undefined) selectedCategoryId = item.categoryId || "";
            });
        }
    });

    let categoriesList = $state<Array<{ id: string; name: string; color?: string; description?: string | null; slug?: string | null }>>([]);

    $effect(() => {
        categoriesList = [...categories];
    });

    const selectedCategory = $derived(categoriesList.find(c => c.id === selectedCategoryId));

    let isCategoryModalOpen = $state(false);
    let categoryModalMode = $state<'create' | 'edit'>('create');
    let catFormName = $state('');
    let catFormColor = $state('indigo');
    let catFormDescription = $state('');
    let catFormSlug = $state('');
    let isSavingCategory = $state(false);

    function openCreateCategory() {
        categoryModalMode = 'create';
        catFormName = '';
        catFormColor = 'indigo';
        catFormDescription = '';
        catFormSlug = '';
        isCategoryModalOpen = true;
    }

    function openEditCategory(cat: any) {
        if (!cat) return;
        categoryModalMode = 'edit';
        catFormName = cat.name || '';
        catFormColor = cat.color || 'indigo';
        catFormDescription = cat.description || '';
        catFormSlug = cat.slug || '';
        isCategoryModalOpen = true;
    }

    async function handleSaveCategory() {
        if (!catFormName.trim()) {
            toast.error(m?.category_name_required?.() ?? "Please enter a category name");
            return;
        }

        isSavingCategory = true;
        try {
            if (categoryModalMode === 'create') {
                if (createCategoryRemote) {
                    const res = await createCategoryRemote({
                        name: catFormName.trim(),
                        color: catFormColor,
                        description: catFormDescription.trim() || undefined,
                        slug: catFormSlug.trim() || undefined,
                    });
                    const newCat = res?.category || res;
                    if (newCat?.id) {
                        categoriesList = [...categoriesList, newCat];
                        selectedCategoryId = newCat.id;
                        if (remoteFunction?.fields?.categoryId) {
                            remoteFunction.fields.categoryId.set(newCat.id);
                        }
                        onCategoryCreated?.(newCat);
                    }
                } else {
                    const newCat = {
                        id: crypto.randomUUID(),
                        name: catFormName.trim(),
                        color: catFormColor,
                        description: catFormDescription.trim() || null,
                        slug: catFormSlug.trim() || null,
                    };
                    categoriesList = [...categoriesList, newCat];
                    selectedCategoryId = newCat.id;
                    if (remoteFunction?.fields?.categoryId) {
                        remoteFunction.fields.categoryId.set(newCat.id);
                    }
                    onCategoryCreated?.(newCat);
                }
                toast.success(m?.category_created?.() ?? "Category created successfully");
            } else {
                if (updateCategoryRemote && selectedCategoryId) {
                    const res = await updateCategoryRemote({
                        id: selectedCategoryId,
                        name: catFormName.trim(),
                        color: catFormColor,
                        description: catFormDescription.trim() || undefined,
                        slug: catFormSlug.trim() || undefined,
                    });
                    const updatedCat = res?.category || res;
                    categoriesList = categoriesList.map(c => c.id === selectedCategoryId ? { ...c, name: catFormName.trim(), color: catFormColor, description: catFormDescription.trim() } : c);
                    onCategoryUpdated?.(updatedCat);
                } else {
                    categoriesList = categoriesList.map(c => c.id === selectedCategoryId ? { ...c, name: catFormName.trim(), color: catFormColor, description: catFormDescription.trim() } : c);
                    onCategoryUpdated?.({ id: selectedCategoryId, name: catFormName.trim(), color: catFormColor, description: catFormDescription.trim() });
                }
                toast.success(m?.category_updated?.() ?? "Category updated successfully");
            }
            isCategoryModalOpen = false;
        } catch (err: any) {
            toast.error(err?.message || (m?.error_saving_category?.() ?? "Error saving category"));
        } finally {
            isSavingCategory = false;
        }
    }

    async function handleDeleteCategory() {
        if (!selectedCategoryId) return;
        if (!confirm(m?.confirm_delete_category?.() ?? "Are you sure you want to delete this category?")) return;

        isSavingCategory = true;
        try {
            if (deleteCategoryRemote) {
                await deleteCategoryRemote({ id: selectedCategoryId });
            }
            const deletedId = selectedCategoryId;
            categoriesList = categoriesList.filter(c => c.id !== deletedId);
            selectedCategoryId = '';
            if (remoteFunction?.fields?.categoryId) {
                remoteFunction.fields.categoryId.set(null);
            }
            onCategoryDeleted?.(deletedId);
            toast.success(m?.category_deleted?.() ?? "Category deleted");
            isCategoryModalOpen = false;
        } catch (err: any) {
            toast.error(err?.message || (m?.error_deleting_category?.() ?? "Error deleting category"));
        } finally {
            isSavingCategory = false;
        }
    }

    const feedback = useFormValidationFeedback(() => remoteFunction, {
        message: () => m?.please_fix_validation?.() ?? "Please fix the validation errors in the form.",
    });
</script>

<form
    class="space-y-4 text-xs"
    {...remoteFunction
        .preflight(validationSchema)
        .enhance(async ({ submit }: { submit: any }) => {
            try {
                await submit();
                const result = (remoteFunction as any).result;
                const error = (remoteFunction as any).error;

                if (error || (result && result.success === false)) {
                    toast.error(error?.message || result?.error || (m?.error_saving?.() ?? "Error saving"));
                    return;
                }

                toast.success(m?.tag_saved_success?.() ?? "Tag saved successfully!");
                if (onSuccess) onSuccess(result);
                else await goto(cancelHref);
            } catch (error: any) {
                toast.error(error?.message || (m?.error_saving?.() ?? "Error saving"));
            }
        })}
>
    {#if (effectiveIsUpdating || initialData?.id || initialData?.data?.id) && remoteFunction.fields.id}
        <input {...remoteFunction.fields.id.as("hidden", initialData?.id || initialData?.data?.id)} />
    {/if}

    <!-- Name -->
    <div>
        <label for="tag-name" class="block font-semibold text-gray-700 mb-1">
            {m?.tag_name?.() ?? "Tag Name"} *
        </label>
        <input
            id="tag-name"
            {...remoteFunction.fields.name.as("text", initialData?.data?.name || initialData?.name || "")}
            placeholder={m?.tag_name_placeholder?.() ?? "e.g. Salaried, Barista, VIP, Permanent"}
            class="w-full px-3.5 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden {(remoteFunction.fields.name.issues() ?? []).length > 0 ? 'border-rose-500' : 'border-gray-200'}"
            onblur={() => { void remoteFunction.validate().catch(() => {}); }}
        />
        {#each remoteFunction.fields.name.issues() ?? [] as issue, i (`${i}-${issue.message}`)}
            <p class="mt-1 text-[11px] text-rose-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </div>

    <!-- Visibility: Internal vs External -->
    <div>
        <span class="block font-semibold text-gray-700 mb-1">
            {m?.visibility?.() ?? "Visibility"} *
        </span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label
                class="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all {selectedVisibility === 'internal' ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-gray-200 bg-white hover:bg-gray-50'}"
            >
                {#if remoteFunction.fields.visibility}
                    <input
                        {...remoteFunction.fields.visibility.as("radio", "internal", selectedVisibility === "internal")}
                        onchange={() => {
                            selectedVisibility = 'internal';
                        }}
                        class="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                {/if}
                <div>
                    <div class="font-bold text-gray-900 flex items-center gap-1">
                        <Shield class="w-3.5 h-3.5 text-indigo-600" />
                        {m?.tag_visibility_internal?.() ?? "Internal (Default)"}
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5">
                        {m?.tag_visibility_internal_desc?.() ?? "For internal use only (accounting, payroll, HR, internal filters). Never visible on kiosks or public views."}
                    </p>
                </div>
            </label>

            <label
                class="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all {selectedVisibility === 'external' ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600' : 'border-gray-200 bg-white hover:bg-gray-50'}"
            >
                {#if remoteFunction.fields.visibility}
                    <input
                        {...remoteFunction.fields.visibility.as("radio", "external", selectedVisibility === "external")}
                        onchange={() => {
                            selectedVisibility = 'external';
                        }}
                        class="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                {/if}
                <div>
                    <div class="font-bold text-gray-900 flex items-center gap-1">
                        <Globe class="w-3.5 h-3.5 text-emerald-600" />
                        {m?.tag_visibility_external?.() ?? "Public (External)"}
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5">
                        {m?.tag_visibility_external_desc?.() ?? "Visible on public displays, kiosks, and event web pages for external visitors."}
                    </p>
                </div>
            </label>
        </div>
    </div>

    <!-- Category -->
    <div>
        <div class="flex items-center justify-between mb-1">
            <label for="tag-category" class="block font-semibold text-gray-700">
                {m?.category?.() ?? "Category"}
            </label>
            <div class="flex items-center gap-2">
                {#if selectedCategoryId && selectedCategory}
                    <button
                        type="button"
                        onclick={() => openEditCategory(selectedCategory)}
                        class="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline transition-colors cursor-pointer"
                        title={m?.edit_category?.() ?? "Edit Category"}
                    >
                        <Pencil class="w-3 h-3" />
                        {m?.edit_category?.() ?? "Edit Category"}
                    </button>
                {/if}
                <button
                    type="button"
                    onclick={openCreateCategory}
                    class="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline transition-colors cursor-pointer"
                    title={m?.new_category?.() ?? "New Category"}
                >
                    <Plus class="w-3 h-3" />
                    {m?.new_category?.() ?? "New Category"}
                </button>
            </div>
        </div>

        <div class="flex items-center gap-1.5">
            {#if remoteFunction.fields.categoryId}
                <select
                    id="tag-category"
                    {...remoteFunction.fields.categoryId.as("select", selectedCategoryId)}
                    onchange={(e) => {
                        const val = (e.target as HTMLSelectElement).value;
                        selectedCategoryId = val;
                    }}
                    class="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden bg-white"
                >
                    <option value="">{m?.no_category_general?.() ?? "No Category (General)"}</option>
                    {#each categoriesList as cat (cat.id)}
                        <option value={cat.id}>{cat.name}</option>
                    {/each}
                </select>
            {/if}

            <button
                type="button"
                onclick={openCreateCategory}
                class="p-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-600 hover:text-indigo-600 transition-colors shrink-0 shadow-2xs cursor-pointer"
                title={m?.create_category?.() ?? "Create Category"}
                aria-label={m?.create_category?.() ?? "Create Category"}
            >
                <Plus class="w-4 h-4" />
            </button>

            {#if selectedCategoryId && selectedCategory}
                <button
                    type="button"
                    onclick={() => openEditCategory(selectedCategory)}
                    class="p-2 border border-indigo-200 rounded-xl bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 transition-colors shrink-0 shadow-2xs cursor-pointer"
                    title={m?.edit_category?.() ?? "Edit Category"}
                    aria-label={m?.edit_category?.() ?? "Edit Category"}
                >
                    <Pencil class="w-4 h-4" />
                </button>
            {/if}
        </div>

        {#if selectedCategory?.description}
            <p class="text-[11px] text-gray-500 mt-1 italic">
                {selectedCategory.description}
            </p>
        {/if}
    </div>

    <!-- Color Preset -->
    <div>
        <span class="block font-semibold text-gray-700 mb-1.5">
            {m?.color_tag_pill?.() ?? "Color / Tag Pill"}
        </span>
        <div class="flex items-center gap-2 flex-wrap">
            {#each colorPresets as preset (preset.value)}
                <button
                    type="button"
                    onclick={() => {
                        selectedColor = preset.value;
                        if (remoteFunction.fields.color) {
                            remoteFunction.fields.color.set(preset.value);
                        }
                    }}
                    class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all {selectedColor === preset.value ? 'border-gray-900 bg-gray-900 text-white shadow-xs font-bold' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                >
                    <span class="w-2.5 h-2.5 rounded-full {preset.bg}"></span>
                    {preset.name}
                </button>
            {/each}
        </div>
        {#if remoteFunction.fields.color}
            <input {...remoteFunction.fields.color.as("hidden", selectedColor)} />
        {/if}
    </div>

    <!-- Description -->
    <div>
        <label for="tag-desc" class="block font-semibold text-gray-700 mb-1">
            {m?.description_optional?.() ?? "Description (optional)"}
        </label>
        <textarea
            id="tag-desc"
            {...remoteFunction.fields.description.as("text", initialData?.data?.description || initialData?.description || "")}
            rows="2"
            placeholder={m?.tag_description_placeholder?.() ?? "Optional description of the tag..."}
            class="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
        ></textarea>
    </div>

    <div class="flex justify-end gap-2 mt-6 border-t pt-4">
        {#if onCancel}
            <Button variant="outline" type="button" size="sm" onclick={onCancel}>
                {m?.cancel?.() ?? "Cancel"}
            </Button>
        {:else}
            <Button variant="outline" href={cancelHref} size="sm">
                {m?.cancel?.() ?? "Cancel"}
            </Button>
        {/if}
        <AsyncButton
            type="submit"
            size="sm"
            loadingLabel={effectiveIsUpdating ? (m?.saving?.() ?? "Saving...") : (m?.creating?.() ?? "Creating...")}
            loading={(remoteFunction as any).pending}
            class="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
            {effectiveIsUpdating ? (m?.save_changes?.() ?? "Save Changes") : (m?.create_tag?.() ?? "Create Tag")}
        </AsyncButton>
    </div>
</form>

<!-- Category Modal -->
{#if isCategoryModalOpen}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
    >
        <div class="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden text-xs">
            <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div class="flex items-center gap-2">
                    <div class="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                        {#if categoryModalMode === 'create'}
                            <FolderPlus class="w-4 h-4" />
                        {:else}
                            <FolderEdit class="w-4 h-4" />
                        {/if}
                    </div>
                    <h3 id="category-modal-title" class="font-bold text-gray-900 text-sm">
                        {categoryModalMode === 'create' ? (m?.create_category?.() ?? 'Create Category') : (m?.edit_category?.() ?? 'Edit Category')}
                    </h3>
                </div>
                <button
                    type="button"
                    onclick={() => { isCategoryModalOpen = false; }}
                    class="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                    <X class="w-4 h-4" />
                </button>
            </div>

            <div class="p-5 space-y-4">
                <div>
                    <label for="cat-modal-name" class="block font-semibold text-gray-700 mb-1">
                        {m?.category_name?.() ?? "Category Name"} *
                    </label>
                    <input
                        id="cat-modal-name"
                        type="text"
                        bind:value={catFormName}
                        placeholder={m?.category_name_placeholder?.() ?? "e.g. Accounting, Permanent Staff, Sales..."}
                        class="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden text-xs"
                    />
                </div>

                <div>
                    <span class="block font-semibold text-gray-700 mb-1.5">
                        {m?.color?.() ?? "Color"}
                    </span>
                    <div class="flex items-center gap-1.5 flex-wrap">
                        {#each colorPresets as preset (preset.value)}
                            <button
                                type="button"
                                onclick={() => { catFormColor = preset.value; }}
                                class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer {catFormColor === preset.value ? 'border-gray-900 bg-gray-900 text-white font-bold' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                            >
                                <span class="w-2.5 h-2.5 rounded-full {preset.bg}"></span>
                                {preset.name}
                            </button>
                        {/each}
                    </div>
                </div>

                <div>
                    <label for="cat-modal-desc" class="block font-semibold text-gray-700 mb-1">
                        {m?.description_optional?.() ?? "Description (optional)"}
                    </label>
                    <textarea
                        id="cat-modal-desc"
                        bind:value={catFormDescription}
                        rows="2"
                        placeholder={m?.category_description_placeholder?.() ?? "Optional description for this tag category..."}
                        class="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden text-xs"
                    ></textarea>
                </div>
            </div>

            <div class="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                    {#if categoryModalMode === 'edit'}
                        <AsyncButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onclick={handleDeleteCategory}
                            loading={isSavingCategory}
                            loadingLabel={m?.deleting?.() ?? "Deleting..."}
                            class="text-rose-600 hover:bg-rose-50 border-rose-200 hover:border-rose-300"
                        >
                            <Trash2 class="w-3.5 h-3.5 mr-1" />
                            {m?.delete?.() ?? "Delete"}
                        </AsyncButton>
                    {/if}
                </div>
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        onclick={() => { isCategoryModalOpen = false; }}
                        disabled={isSavingCategory}
                        class="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 font-medium text-gray-700 transition-colors cursor-pointer text-xs"
                    >
                        {m?.cancel?.() ?? "Cancel"}
                    </button>
                    <AsyncButton
                        type="button"
                        size="sm"
                        onclick={handleSaveCategory}
                        loading={isSavingCategory}
                        loadingLabel={m?.saving?.() ?? "Saving..."}
                        class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
                    >
                        <Check class="w-3.5 h-3.5 mr-1" />
                        {categoryModalMode === 'create' ? (m?.create_category?.() ?? 'Create Category') : (m?.apply?.() ?? 'Apply')}
                    </AsyncButton>
                </div>
            </div>
        </div>
    </div>
{/if}
