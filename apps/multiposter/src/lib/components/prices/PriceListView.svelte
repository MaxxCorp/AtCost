<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import {
        Printer,
        Tag as TagIcon,
        ChefHat,
        Package,
        Layers,
        Calculator,
        TrendingUp,
        Receipt,
    } from "@lucide/svelte";
    import Button from "#lib/components/ui/button/button.svelte";

    interface PriceItemData {
        id?: string;
        itemType?: 'consumable' | 'recipe';
        name: string;
        description?: string | null;
        portionAmount?: number | null;
        unit?: string | null;
        costPrice?: number | null;
        factor?: number | null;
        unitPrice?: number | null;
        sortOrder?: number | null;
        tags?: Array<{
            id?: string;
            name: string;
            color?: string | null;
        }>;
    }

    interface PriceData {
        id?: string;
        name: string;
        description?: string | null;
        isTemplate?: boolean | null;
        totalPricePerPortion?: number | null;
        totalCostPerPortion?: number | null;
        items?: PriceItemData[];
    }

    let {
        prices = [],
        participantsCount = 1,
        canEdit = false,
        eventSummary = "",
    }: {
        prices?: PriceData[];
        participantsCount?: number;
        canEdit?: boolean;
        eventSummary?: string;
    } = $props();

    const displayPrices = $derived(prices || []);

    let activeSectionId = $state<string>("all");

    interface SectionGroup {
        id: string;
        name: string;
        color: string;
        items: PriceItemData[];
        subtotal: number;
        costSubtotal: number;
    }

    // Process each price list and organize items into sections based on their tags
    function computeSections(items: PriceItemData[] = []): SectionGroup[] {
        const sectionMap = new Map<string, SectionGroup>();
        const otherSection: SectionGroup = {
            id: "__other__",
            name: m.other_items?.() || "Other Items",
            color: "#64748b",
            items: [],
            subtotal: 0,
            costSubtotal: 0,
        };

        for (const item of items) {
            const itemPrice = Number(item.unitPrice) || 0;
            const itemCost = Number(item.costPrice) || 0;
            const portion = Number(item.portionAmount) || 1;
            const linePrice = itemPrice * portion;
            const lineCost = itemCost * portion;

            if (item.tags && item.tags.length > 0) {
                // Group by primary tag
                const primaryTag = item.tags[0];
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

        const result = Array.from(sectionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        if (otherSection.items.length > 0) {
            result.push(otherSection);
        }
        return result;
    }

    function handlePrint() {
        if (typeof window !== "undefined") {
            window.print();
        }
    }
</script>

<div class="price-list-view space-y-6">
    <!-- Header / Print Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div class="flex items-center gap-2">
            <Receipt size={20} class="text-violet-600" />
            <h2 class="text-lg font-bold text-gray-900">
                {m.feature_prices_title?.() || 'Prices'}
            </h2>
            {#if eventSummary}
                <span class="text-xs text-gray-500 font-medium hidden sm:inline">
                    • {eventSummary}
                </span>
            {/if}
        </div>

        <Button
            variant="outline"
            size="sm"
            class="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900 border-gray-300 self-start sm:self-auto"
            onclick={handlePrint}
        >
            <Printer size={14} />
            {m.print_price_list?.() || 'Print Price List'}
        </Button>
    </div>

    <!-- Print-only Title Header -->
    <div class="hidden print:block mb-4 border-b pb-3">
        <h1 class="text-2xl font-bold text-gray-900">
            {eventSummary || (m.price_list?.() || 'Price List')}
        </h1>
        <p class="text-xs text-gray-500 mt-1">
            {m.feature_prices_description?.() || 'Items and prices for this event.'}
            {#if participantsCount > 1}
                • {participantsCount} {m.participants?.() || 'participants'}
            {/if}
        </p>
    </div>

    {#if !displayPrices || displayPrices.length === 0}
        <div class="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
            <Receipt size={32} class="mx-auto text-gray-300 mb-2" />
            <p class="text-sm font-medium text-gray-500">
                {m.no_items_in_price_list?.() || 'No price items listed.'}
            </p>
        </div>
    {:else}
        {#each displayPrices as priceList (priceList.id || priceList.name)}
            {@const sections = computeSections(priceList.items || [])}
            {@const totalItemCount = (priceList.items || []).length}
            {@const activeSections = activeSectionId === "all" ? sections : sections.filter(s => s.id === activeSectionId)}

            <div class="price-list-card border border-gray-200 rounded-xl overflow-hidden shadow-xs bg-white">
                <!-- Price List Header -->
                <div class="bg-gray-50/80 p-4 border-b border-gray-200">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-gray-900 text-lg">{priceList.name}</h3>
                                {#if priceList.isTemplate}
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800">
                                        <Layers size={10} /> {m.template?.() || 'Template'}
                                    </span>
                                {/if}
                            </div>
                            {#if priceList.description}
                                <p class="text-xs text-gray-500 mt-1">{priceList.description}</p>
                            {/if}
                        </div>

                        {#if priceList.totalPricePerPortion != null}
                            <div class="text-left sm:text-right">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
                                    {m.price_list?.() || 'Price / Portion'}
                                </span>
                                <span class="text-xl font-extrabold text-violet-900 font-mono">
                                    €{Number(priceList.totalPricePerPortion).toFixed(2)}
                                </span>
                            </div>
                        {/if}
                    </div>

                    <!-- Section Filter Tabs (Hidden in Print) -->
                    {#if sections.length > 1}
                        <div class="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-200/70 overflow-x-auto print:hidden">
                            <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
                                {m.sections?.() || 'Sections'}:
                            </span>
                            <button
                                type="button"
                                onclick={() => (activeSectionId = "all")}
                                class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer {activeSectionId === 'all' ? 'bg-violet-600 text-white shadow-2xs' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'}"
                            >
                                {m.all_sections?.() || 'All'} ({totalItemCount})
                            </button>
                            {#each sections as sec (sec.id)}
                                <button
                                    type="button"
                                    onclick={() => (activeSectionId = sec.id)}
                                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer {activeSectionId === sec.id ? 'bg-violet-600 text-white shadow-2xs' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'}"
                                >
                                    <span
                                        class="w-2 h-2 rounded-full inline-block"
                                        style="background-color: {sec.color || '#6366f1'};"
                                    ></span>
                                    <span>{sec.name}</span>
                                    <span class="text-[10px] opacity-75">({sec.items.length})</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Sections & Items -->
                {#if (priceList.items || []).length === 0}
                    <div class="p-8 text-center text-sm text-gray-500">
                        {m.no_items_in_price_list?.() || 'No items listed in this price list.'}
                    </div>
                {:else}
                    <div class="divide-y divide-gray-100">
                        {#each activeSections as section (section.id)}
                            <div class="section-group">
                                <!-- Section Subheader -->
                                <div class="bg-gray-50/60 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="w-2.5 h-2.5 rounded-full inline-block shadow-2xs"
                                            style="background-color: {section.color || '#6366f1'};"
                                        ></span>
                                        <h4 class="text-xs font-bold text-gray-800 uppercase tracking-wider">
                                            {section.name}
                                        </h4>
                                        <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-200/70 text-gray-600">
                                            {section.items.length}
                                        </span>
                                    </div>

                                    <div class="text-right">
                                        <span class="text-xs font-mono font-semibold text-gray-700">
                                            €{section.subtotal.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <!-- Items List -->
                                <div class="divide-y divide-gray-50">
                                    {#each section.items as item (item.id || item.name)}
                                        <div class="p-3.5 flex items-start justify-between gap-4 hover:bg-gray-50/40 transition-colors">
                                            <div class="space-y-1">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <span class="font-semibold text-gray-900 text-sm">{item.name}</span>
                                                    <span class="text-[10px] px-1.5 py-0.5 rounded font-medium {item.itemType === 'recipe' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                                                        {item.itemType === 'recipe' ? (m.recipe?.() || 'Recipe') : (m.consumable?.() || 'Consumable')}
                                                    </span>
                                                    {#if item.tags && item.tags.length > 0}
                                                        {#each item.tags as t (t.id || t.name)}
                                                            <span
                                                                class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border"
                                                                style="background-color: {t.color ? t.color + '15' : '#f1f5f9'}; color: {t.color || '#475569'}; border-color: {t.color ? t.color + '40' : '#cbd5e1'};"
                                                            >
                                                                {t.name}
                                                            </span>
                                                        {/each}
                                                    {/if}
                                                </div>

                                                {#if item.description}
                                                    <p class="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                                                {/if}

                                                {#if item.portionAmount}
                                                    <p class="text-[11px] text-gray-400">
                                                        {m.portion_size?.() || 'Portion'}: {item.portionAmount} {item.unit || ''}
                                                    </p>
                                                {/if}
                                            </div>

                                            <div class="text-right shrink-0">
                                                <span class="font-mono font-bold text-sm text-gray-900">
                                                    €{(Number(item.unitPrice) || 0).toFixed(2)}
                                                </span>
                                                {#if canEdit && item.costPrice != null && item.costPrice > 0}
                                                    <span class="block text-[10px] text-gray-400 font-mono mt-0.5">
                                                        cost €{Number(item.costPrice).toFixed(2)} • {item.factor ? `${Number(item.factor).toFixed(1)}×` : ''}
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}

                <!-- Totals Footer -->
                {#if participantsCount && participantsCount > 1 && priceList.totalPricePerPortion}
                    <div class="bg-violet-50/70 p-3.5 border-t border-violet-100 flex items-center justify-between text-xs text-violet-950 font-medium">
                        <div class="flex items-center gap-1.5">
                            <Calculator size={14} class="text-violet-600" />
                            <span>
                                {m.total_for_participants?.() || 'Total for'} {participantsCount} {m.participants?.() || 'participants'}:
                            </span>
                        </div>
                        <div class="text-right">
                            <span class="font-mono font-black text-base text-violet-900">
                                €{(Number(priceList.totalPricePerPortion) * participantsCount).toFixed(2)}
                            </span>
                        </div>
                    </div>
                {/if}
            </div>
        {/each}
    {/if}
</div>

<style>
    @media print {
        :global(body) {
            background: white !important;
            color: black !important;
        }
        .price-list-card {
            border: 1px solid #ccc !important;
            box-shadow: none !important;
            break-inside: avoid;
        }
    }
</style>
