<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import {
        ChefHat,
        Package,
        Pencil,
        Unlink,
        Loader2,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";
    import * as Dialog from "#lib/components/ui/dialog/index.js";
    import { removePriceItem } from "../../../routes/prices/[id]/update.remote";
    import { updateConsumable } from "../../../routes/consumables/[id]/update.remote";
    import { readConsumable } from "../../../routes/consumables/[id]/read.remote";
    import { updateRecipe } from "../../../routes/recipes/[id]/update.remote";
    import { readRecipe } from "../../../routes/recipes/[id]/read.remote";
    import { updateConsumableSchema, updateRecipeSchema } from "@ac/validations";
    import ConsumableForm from "#lib/components/consumables/ConsumableForm.svelte";
    import RecipeForm from "#lib/components/recipes/RecipeForm.svelte";

    let {
        priceList,
        participantsCount = 1,
        onItemUpdated = undefined,
        onItemRemoved = undefined,
    }: {
        priceList: any;
        participantsCount?: number;
        onItemUpdated?: (priceListId: string, updatedItem: any) => void;
        onItemRemoved?: (priceListId: string, itemId: string) => void;
    } = $props();

    interface SectionGroup {
        id: string;
        name: string;
        color: string;
        items: any[];
        subtotal: number;
        costSubtotal: number;
    }

    function normalizeTag(t: any) {
        if (!t) return null;
        const tagObj = t.tag || t;
        if (!tagObj || !tagObj.name) return null;
        return {
            id: tagObj.id,
            name: tagObj.name,
            color: tagObj.color || "#6366f1",
        };
    }

    function computeSections(rawItems: any[] = []): SectionGroup[] {
        const sectionMap = new Map<string, SectionGroup>();
        const otherSection: SectionGroup = {
            id: "__other__",
            name: m.other_items?.() || "Other Items",
            color: "#64748b",
            items: [],
            subtotal: 0,
            costSubtotal: 0,
        };

        for (const item of rawItems) {
            const itemPrice = Number(item.unitPrice) || 0;
            const itemCost = Number(item.costPrice) || 0;
            const portion = Number(item.portionAmount) || 1;
            const linePrice = itemPrice * portion;
            const lineCost = itemCost * portion;

            const tags = (item.tags || []).map(normalizeTag).filter(Boolean);

            if (tags.length > 0) {
                const primaryTag = tags[0];
                const key = primaryTag.id || primaryTag.name.toLowerCase();

                if (!sectionMap.has(key)) {
                    sectionMap.set(key, {
                        id: key,
                        name: primaryTag.name,
                        color: primaryTag.color || "#6366f1",
                        items: [],
                        subtotal: 0,
                        costSubtotal: 0,
                    });
                }
                const sec = sectionMap.get(key)!;
                sec.items.push(item);
                sec.subtotal += linePrice;
                sec.costSubtotal += lineCost;
            } else {
                otherSection.items.push(item);
                otherSection.subtotal += linePrice;
                otherSection.costSubtotal += lineCost;
            }
        }

        const result = Array.from(sectionMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
        if (otherSection.items.length > 0) {
            result.push(otherSection);
        }
        return result;
    }

    let localItems = $state<any[]>([]);

    $effect(() => {
        localItems = priceList?.items ? [...priceList.items] : [];
    });

    const sections = $derived.by(() => computeSections(localItems));

    // Item Edit State (delegated to canonical forms)
    let activeItem = $state<any>(null);
    let editingConsumableId = $state<string | null>(null);
    let editingRecipeId = $state<string | null>(null);

    const consumableQuery = $derived(
        editingConsumableId ? readConsumable(editingConsumableId) : null
    );
    const consumableData = $derived(
        consumableQuery?.current ??
            (activeItem?.consumable &&
            (activeItem.consumable.id === editingConsumableId ||
                activeItem.consumableId === editingConsumableId)
                ? activeItem.consumable
                : null)
    );

    const recipeQuery = $derived(
        editingRecipeId ? readRecipe(editingRecipeId) : null
    );
    const recipeData = $derived(
        recipeQuery?.current ??
            (activeItem?.recipe &&
            (activeItem.recipe.id === editingRecipeId ||
                activeItem.recipeId === editingRecipeId)
                ? activeItem.recipe
                : null)
    );

    function openEdit(item: any) {
        activeItem = item;
        if (item.itemType === "recipe" || item.recipeId) {
            editingRecipeId = item.recipeId || item.recipe?.id || item.id;
        } else {
            editingConsumableId = item.consumableId || item.consumable?.id || item.id;
        }
    }

    function handleConsumableUpdated(result: any) {
        const updated = result?.consumable || result?.data || result;
        if (updated && activeItem) {
            const costPerUnit =
                Number(updated.amount) > 0
                    ? (Number(updated.purchasePrice) || 0) / Number(updated.amount)
                    : Number(updated.purchasePrice) || 0;
            const roundedCost = Math.round(costPerUnit * 100) / 100;
            const factor = Number(activeItem.factor) || 2;
            const unitPrice = Math.round(roundedCost * factor * 100) / 100;
            const updatedTags = (updated.tags || []).map(normalizeTag).filter(Boolean);

            const merged = {
                ...activeItem,
                name: updated.name || activeItem.name,
                description: updated.description ?? activeItem.description,
                unit: updated.unit || activeItem.unit,
                costPrice: roundedCost,
                unitPrice,
                tags: updatedTags.length > 0 ? updatedTags : activeItem.tags,
                consumable: updated,
            };

            const idx = localItems.findIndex((it) => it.id === activeItem.id);
            if (idx !== -1) {
                localItems[idx] = merged;
                localItems = [...localItems];
            }
            onItemUpdated?.(priceList.id, merged);
        }
        editingConsumableId = null;
        activeItem = null;
    }

    function handleRecipeUpdated(result: any) {
        const updated = result?.recipe || result?.data || result;
        if (updated && activeItem) {
            const costPerPortion =
                Number(updated.costPerPortion) ||
                (Number(updated.portions) > 0
                    ? (Number(updated.totalCost) || 0) / Number(updated.portions)
                    : Number(updated.totalCost) || 0);
            const roundedCost = Math.round(costPerPortion * 100) / 100;
            const factor = Number(activeItem.factor) || 2;
            const unitPrice = Math.round(roundedCost * factor * 100) / 100;
            const updatedTags = (updated.tags || []).map(normalizeTag).filter(Boolean);

            const merged = {
                ...activeItem,
                name: updated.name || activeItem.name,
                description: updated.description ?? activeItem.description,
                costPrice: roundedCost,
                unitPrice,
                tags: updatedTags.length > 0 ? updatedTags : activeItem.tags,
                recipe: updated,
            };

            const idx = localItems.findIndex((it) => it.id === activeItem.id);
            if (idx !== -1) {
                localItems[idx] = merged;
                localItems = [...localItems];
            }
            onItemUpdated?.(priceList.id, merged);
        }
        editingRecipeId = null;
        activeItem = null;
    }

    async function handleDisassociate(item: any) {
        if (!priceList?.id || !item?.id) return;
        const confirmMsg =
            m.delete_confirm?.({ item: item.name }) ||
            `Remove "${item.name}" from "${priceList.name}"?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            await removePriceItem({
                priceId: priceList.id,
                itemId: item.id,
            });

            localItems = localItems.filter((it) => it.id !== item.id);
            onItemRemoved?.(priceList.id, item.id);
            toast.success(
                m.delete_successful?.() || `Removed ${item.name}`
            );
        } catch (err: any) {
            toast.error(
                err?.message ||
                    m.something_went_wrong?.() ||
                    "Failed to remove item"
            );
        }
    }
</script>

<div class="price-items-section-container">
    {#if localItems.length === 0}
        <div class="py-5 px-4 text-center text-xs text-gray-500 italic bg-gray-50/50">
            {m.no_items_in_price_list?.() || "No items listed in this price list."}
        </div>
    {:else}
        <div class="divide-y divide-gray-200/80">
            {#each sections as section (section.id)}
                <div class="section-group">
                    <!-- Section Header (Acting as section of price list) -->
                    {#if sections.length > 1}
                        <div
                            class="bg-gray-100/75 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/60"
                        >
                            <div class="flex items-center gap-2">
                                <span
                                    class="w-2.5 h-2.5 rounded-full inline-block shadow-2xs shrink-0"
                                    style="background-color: {section.color};"
                                ></span>
                                <span
                                    class="text-[11px] font-bold text-gray-800 uppercase tracking-wider"
                                >
                                    {section.name}
                                </span>
                                <span
                                    class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-200 text-gray-700"
                                >
                                    {section.items.length} {section.items.length === 1 ? "item" : "items"}
                                </span>
                            </div>
                            <div class="flex items-center gap-2 text-right">
                                <span class="text-xs font-mono font-semibold text-gray-700">
                                    €{section.subtotal.toFixed(2)} / {m.portion?.() || "portion"}
                                </span>
                                {#if participantsCount > 1}
                                    <span class="text-[11px] font-mono text-emerald-700 font-medium">
                                        • €{(section.subtotal * participantsCount).toFixed(2)} ({participantsCount}p)
                                    </span>
                                {/if}
                            </div>
                        </div>
                    {/if}

                    <!-- Items in Section -->
                    <div class="divide-y divide-gray-100 bg-white">
                        {#each section.items as item (item.id || item.name)}
                            {@const portion = Number(item.portionAmount) || 1}
                            {@const unitPrice = Number(item.unitPrice) || 0}
                            {@const costPrice = Number(item.costPrice) || 0}
                            {@const lineTotalPerPortion = unitPrice * portion}
                            {@const lineCostPerPortion = costPrice * portion}
                            {@const lineProfitPerPortion = lineTotalPerPortion - lineCostPerPortion}
                            {@const tags = (item.tags || []).map(normalizeTag).filter(Boolean)}

                            <div
                                class="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors"
                            >
                                <div class="flex items-start gap-2.5 min-w-0 flex-1">
                                    <div
                                        class="mt-0.5 p-1.5 rounded-lg shrink-0 {item.itemType === 'recipe'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-amber-50 text-amber-700'}"
                                        title={item.itemType === 'recipe' ? (m.recipe?.() || 'Recipe') : (m.consumable?.() || 'Consumable')}
                                    >
                                        {#if item.itemType === "recipe"}
                                            <ChefHat size={15} />
                                        {:else}
                                            <Package size={15} />
                                        {/if}
                                    </div>
                                    <div class="min-w-0 space-y-0.5">
                                        <div class="flex flex-wrap items-center gap-1.5">
                                            <span class="font-semibold text-gray-900 text-xs sm:text-sm">
                                                {item.name}
                                            </span>
                                            <span
                                                class="text-[10px] px-1.5 py-0.2 rounded font-medium {item.itemType === 'recipe'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-amber-100 text-amber-800'}"
                                            >
                                                {item.itemType === "recipe"
                                                    ? (m.recipe?.() || "Recipe")
                                                    : (m.consumable?.() || "Consumable")}
                                            </span>
                                            {#if tags.length > 0}
                                                {#each tags as t (t.id || t.name)}
                                                    <span
                                                        class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border"
                                                        style="background-color: {t.color + '15'}; color: {t.color}; border-color: {t.color + '40'};"
                                                    >
                                                        {t.name}
                                                    </span>
                                                {/each}
                                            {/if}
                                        </div>
                                        {#if item.description}
                                            <p class="text-xs text-gray-500 line-clamp-1">
                                                {item.description}
                                            </p>
                                        {/if}
                                        <div class="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 font-medium">
                                            <span>
                                                {m.portion_size?.() || "Portion"}: {portion} {item.unit || ""}
                                            </span>
                                            {#if costPrice > 0}
                                                <span>• Cost: €{costPrice.toFixed(2)}</span>
                                                {#if item.factor}
                                                    <span>• {Number(item.factor).toFixed(1)}×</span>
                                                {/if}
                                                {#if lineProfitPerPortion > 0}
                                                    <span class="text-emerald-700 font-semibold">
                                                        • Margin: +€{lineProfitPerPortion.toFixed(2)}
                                                    </span>
                                                {/if}
                                            {/if}
                                        </div>
                                    </div>
                                </div>

                                <!-- Right: Pricing & Actions -->
                                <div
                                    class="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100"
                                >
                                    <div class="text-left sm:text-right">
                                        <div class="font-mono font-bold text-xs sm:text-sm text-gray-900">
                                            €{lineTotalPerPortion.toFixed(2)}
                                            <span class="text-[10px] text-gray-400 font-normal">
                                                / {m.portion?.() || "portion"}
                                            </span>
                                        </div>
                                        {#if participantsCount > 1}
                                            <div class="font-mono text-xs font-semibold text-emerald-700">
                                                €{(lineTotalPerPortion * participantsCount).toFixed(2)}
                                                <span class="text-[10px] text-emerald-600 font-normal">
                                                    ({participantsCount}p)
                                                </span>
                                            </div>
                                        {/if}
                                    </div>

                                    <div class="flex items-center gap-1">
                                        <button
                                            type="button"
                                            class="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                            onclick={() => openEdit(item)}
                                            title={m.edit?.() || "Edit item"}
                                        >
                                            <Pencil size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            class="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                            onclick={() => handleDisassociate(item)}
                                            title={m.unlink?.() || "Disassociate item from price list"}
                                        >
                                            <Unlink size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<!-- Edit Consumable Modal (reusing canonical ConsumableForm with TagManager) -->
<Dialog.Root
    open={!!editingConsumableId}
    onOpenChange={(open) => {
        if (!open) {
            editingConsumableId = null;
            activeItem = null;
        }
    }}
>
    <Dialog.Content class="max-w-2xl max-h-[85vh] overflow-y-auto z-[80]">
        <Dialog.Header>
            <Dialog.Title class="text-xl font-bold flex items-center gap-2 text-amber-900">
                <Package size={22} class="text-amber-600" />
                <span>{m.edit?.() || "Edit"} {m.consumable?.() || "Consumable"}</span>
            </Dialog.Title>
        </Dialog.Header>

        {#if consumableData}
            {#key consumableData.id}
                <ConsumableForm
                    remoteFunction={updateConsumable}
                    validationSchema={updateConsumableSchema}
                    isUpdating={true}
                    initialData={consumableData}
                    onSuccess={handleConsumableUpdated}
                    onCancel={() => {
                        editingConsumableId = null;
                        activeItem = null;
                    }}
                />
            {/key}
        {:else if consumableQuery?.loading}
            <div class="py-12 flex flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 size={24} class="animate-spin text-amber-600" />
                <span class="text-xs">Loading consumable details...</span>
            </div>
        {/if}
    </Dialog.Content>
</Dialog.Root>

<!-- Edit Recipe Modal (reusing canonical RecipeForm with TagManager) -->
<Dialog.Root
    open={!!editingRecipeId}
    onOpenChange={(open) => {
        if (!open) {
            editingRecipeId = null;
            activeItem = null;
        }
    }}
>
    <Dialog.Content class="max-w-3xl max-h-[85vh] overflow-y-auto z-[80]">
        <Dialog.Header>
            <Dialog.Title class="text-xl font-bold flex items-center gap-2 text-emerald-900">
                <ChefHat size={22} class="text-emerald-600" />
                <span>{m.edit?.() || "Edit"} {m.recipe?.() || "Recipe"}</span>
            </Dialog.Title>
        </Dialog.Header>

        {#if recipeData}
            {#key recipeData.id}
                <RecipeForm
                    remoteFunction={updateRecipe}
                    validationSchema={updateRecipeSchema}
                    isUpdating={true}
                    initialData={recipeData}
                    onSuccess={handleRecipeUpdated}
                    onCancel={() => {
                        editingRecipeId = null;
                        activeItem = null;
                    }}
                />
            {/key}
        {:else if recipeQuery?.loading}
            <div class="py-12 flex flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 size={24} class="animate-spin text-emerald-600" />
                <span class="text-xs">Loading recipe details...</span>
            </div>
        {/if}
    </Dialog.Content>
</Dialog.Root>
