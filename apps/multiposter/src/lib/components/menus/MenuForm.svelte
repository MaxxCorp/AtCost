<script lang="ts">
    import { onMount, untrack } from "svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import * as m from "$lib/paraglide/messages";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { goto } from "$app/navigation";
    import {
        Utensils,
        ChefHat,
        Package,
        Plus,
        Trash2,
        Euro,
        Users,
        Layers,
        Calculator,
        Sparkles,
        TrendingUp,
        Percent,
        RotateCcw,
        Info,
    } from "@lucide/svelte";
    import { listConsumables } from "../../../routes/consumables/list.remote";
    import { listRecipes } from "../../../routes/recipes/list.remote";
    import { listMenus } from "../../../routes/menus/list.remote";
    import type { Consumable, Recipe, MenuItem } from "@ac/validations";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        allConsumables = [],
        allRecipes = [],
        participantsCount = 1,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/menus",
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        allConsumables?: Consumable[];
        allRecipes?: Recipe[];
        participantsCount?: number;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
    } = $props();

    // svelte-ignore state_referenced_locally
    const rf = (remoteFunction as any).preflight(validationSchema);

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (rf as any).allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation?.() || 'Please fix validation errors');
        }
        prevIssuesLength = issues.length;
    });

    // svelte-ignore state_referenced_locally
    let consumablesList = $state<Consumable[]>(allConsumables);
    // svelte-ignore state_referenced_locally
    let recipesList = $state<Recipe[]>(allRecipes);

    onMount(async () => {
        if (consumablesList.length === 0) {
            try {
                const res = await listConsumables({ limit: 200 });
                if (res?.data) consumablesList = res.data;
            } catch (e) {
                console.error('Failed to load consumables:', e);
            }
        }
        if (recipesList.length === 0) {
            try {
                const res = await listRecipes({ limit: 200 });
                if (res?.data) recipesList = res.data;
            } catch (e) {
                console.error('Failed to load recipes:', e);
            }
        }
        try {
            const tplRes = await listMenus({ isTemplate: true, limit: 100 });
            if (tplRes?.data) templatesList = tplRes.data;
        } catch (e) {
            console.error('Failed to load menu templates:', e);
        }
    });

    let currentParticipants = $state(untrack(() => participantsCount > 0 ? participantsCount : 1));

    // When the prop updates (e.g. user typing participants count in event form), reflect it
    $effect(() => {
        if (participantsCount > 0) {
            currentParticipants = participantsCount;
        }
    });

    // Default isTemplate to false if embedded in an event form, true if creating from standalone /menus
    let isTemplate = $state(untrack(() => {
        if (initialData?.isTemplate !== undefined) return Boolean(initialData.isTemplate);
        return onSuccess ? false : true;
    }));

    let templatesList = $state<any[]>([]);

    interface FormMenuItem {
        id?: string;
        itemType: 'consumable' | 'recipe';
        consumableId?: string | null;
        recipeId?: string | null;
        name: string;
        description?: string;
        portionAmount: number;
        unit?: string;
        costPrice: number;
        factor: number;
        unitPrice: number;
        sortOrder: number;
    }

    let defaultFactor = $state(2.0);

    let items = $state<FormMenuItem[]>(untrack(() => {
        if (!initialData?.items) return [];
        return initialData.items.map((it: any, index: number) => {
            const factor = it.factor !== undefined && it.factor !== null ? Number(it.factor) : 2.0;
            const costPrice = it.costPrice !== undefined && it.costPrice !== null
                ? Number(it.costPrice)
                : (it.unitPrice ? Math.round((Number(it.unitPrice) / (factor || 2)) * 100) / 100 : 0);
            const unitPrice = it.unitPrice !== undefined && it.unitPrice !== null
                ? Number(it.unitPrice)
                : Math.round(costPrice * factor * 100) / 100;

            return {
                id: it.id,
                itemType: it.itemType || 'consumable',
                consumableId: it.consumableId || null,
                recipeId: it.recipeId || null,
                name: it.name || '',
                description: it.description || '',
                portionAmount: it.portionAmount !== undefined ? it.portionAmount : 1,
                unit: it.unit || '',
                costPrice,
                factor,
                unitPrice,
                sortOrder: it.sortOrder !== undefined ? it.sortOrder : index,
            };
        });
    }));

    // New item selection states
    let activeTab = $state<'consumable' | 'recipe'>('consumable');
    let selectedConsumableId = $state<string>('');
    let selectedRecipeId = $state<string>('');

    function handleAddFromConsumable() {
        if (!selectedConsumableId) {
            toast.error(m.select_consumable?.() || 'Please select a consumable');
            return;
        }
        const c = consumablesList.find(x => x.id === selectedConsumableId);
        if (!c) return;

        const costPerUnit = c.amount > 0 ? c.purchasePrice / c.amount : c.purchasePrice;
        const roundedCost = Math.round(costPerUnit * 100) / 100;
        const itemFactor = defaultFactor > 0 ? defaultFactor : 2.0;
        const finalUnitPrice = Math.round(roundedCost * itemFactor * 100) / 100;

        items = [
            ...items,
            {
                itemType: 'consumable',
                consumableId: c.id,
                recipeId: null,
                name: c.name,
                description: c.description || '',
                portionAmount: 1,
                unit: c.unit || 'piece',
                costPrice: roundedCost,
                factor: itemFactor,
                unitPrice: finalUnitPrice,
                sortOrder: items.length,
            }
        ];
        selectedConsumableId = '';
        toast.success(`Added ${c.name}`);
    }

    function handleAddFromRecipe() {
        if (!selectedRecipeId) {
            toast.error(m.select_recipe?.() || 'Please select a recipe');
            return;
        }
        const r = recipesList.find(x => x.id === selectedRecipeId);
        if (!r) return;

        const portionCost = Math.round((r.costPerPortion ?? 0) * 100) / 100;
        const itemFactor = defaultFactor > 0 ? defaultFactor : 2.0;
        const finalUnitPrice = Math.round(portionCost * itemFactor * 100) / 100;

        items = [
            ...items,
            {
                itemType: 'recipe',
                consumableId: null,
                recipeId: r.id,
                name: r.name,
                description: r.description || '',
                portionAmount: 1,
                unit: 'portion',
                costPrice: portionCost,
                factor: itemFactor,
                unitPrice: finalUnitPrice,
                sortOrder: items.length,
            }
        ];
        selectedRecipeId = '';
        toast.success(`Added ${r.name}`);
    }

    function loadFromTemplate(templateId: string) {
        const tpl = templatesList.find(t => t.id === templateId);
        if (!tpl || !tpl.items) return;

        items = tpl.items.map((it: any, idx: number) => {
            const factor = it.factor !== undefined && it.factor !== null ? Number(it.factor) : defaultFactor;
            const costPrice = it.costPrice !== undefined && it.costPrice !== null ? Number(it.costPrice) : 0;
            const unitPrice = it.unitPrice !== undefined && it.unitPrice !== null
                ? Number(it.unitPrice)
                : Math.round(costPrice * factor * 100) / 100;

            return {
                id: undefined,
                itemType: it.itemType || 'consumable',
                consumableId: it.consumableId || null,
                recipeId: it.recipeId || null,
                name: it.name || '',
                description: it.description || '',
                portionAmount: it.portionAmount !== undefined ? it.portionAmount : 1,
                unit: it.unit || '',
                costPrice,
                factor,
                unitPrice,
                sortOrder: idx,
            };
        });
        toast.success(`Loaded items from template: ${tpl.name}`);
    }

    function updateFactor(index: number, newFactor: number) {
        const item = items[index];
        if (!item) return;
        const f = Math.max(0, Number(newFactor) || 0);
        item.factor = f;
        item.unitPrice = Math.round(item.costPrice * f * 100) / 100;
    }

    function updateUnitPrice(index: number, newPrice: number) {
        const item = items[index];
        if (!item) return;
        const p = Math.max(0, Number(newPrice) || 0);
        item.unitPrice = p;
        if (item.costPrice > 0) {
            item.factor = Math.round((p / item.costPrice) * 100) / 100;
        }
    }

    function updateCostPrice(index: number, newCost: number) {
        const item = items[index];
        if (!item) return;
        const c = Math.max(0, Number(newCost) || 0);
        item.costPrice = c;
        item.unitPrice = Math.round(c * item.factor * 100) / 100;
    }

    function applyDefaultFactorToAll() {
        items = items.map(item => ({
            ...item,
            factor: defaultFactor,
            unitPrice: Math.round(item.costPrice * defaultFactor * 100) / 100,
        }));
        toast.success(`Applied ${defaultFactor}× factor to all items`);
    }

    function removeItem(index: number) {
        items = items.filter((_, i) => i !== index);
    }

    // Calculations
    const calculations = $derived.by(() => {
        const p = currentParticipants > 0 ? currentParticipants : 1;
        let perPersonCost = 0;
        let perPersonSales = 0;

        const lines = items.map(it => {
            const cost = Number(it.costPrice) || 0;
            const price = Number(it.unitPrice) || 0;
            const pa = Number(it.portionAmount) || 1;

            const lineCostPerPerson = cost * pa;
            const linePricePerPerson = price * pa;

            perPersonCost += lineCostPerPerson;
            perPersonSales += linePricePerPerson;

            const totalCost = lineCostPerPerson * p;
            const totalPrice = linePricePerPerson * p;
            const grossProfit = totalPrice - totalCost;
            const marginPercent = totalPrice > 0 ? (grossProfit / totalPrice) * 100 : 0;

            return {
                ...it,
                lineCostPerPerson: Math.round(lineCostPerPerson * 100) / 100,
                linePricePerPerson: Math.round(linePricePerPerson * 100) / 100,
                totalCost: Math.round(totalCost * 100) / 100,
                totalPrice: Math.round(totalPrice * 100) / 100,
                grossProfit: Math.round(grossProfit * 100) / 100,
                marginPercent: Math.round(marginPercent * 10) / 10,
            };
        });

        const grandCost = perPersonCost * p;
        const grandTotal = perPersonSales * p;
        const totalProfit = grandTotal - grandCost;
        const totalMarginPercent = grandTotal > 0 ? (totalProfit / grandTotal) * 100 : 0;

        return {
            lines,
            perPersonCost: Math.round(perPersonCost * 100) / 100,
            perPersonSales: Math.round(perPersonSales * 100) / 100,
            totalCost: Math.round(grandCost * 100) / 100,
            grandTotal: Math.round(grandTotal * 100) / 100,
            grossProfit: Math.round(totalProfit * 100) / 100,
            marginPercent: Math.round(totalMarginPercent * 10) / 10,
        };
    });

    const itemsJson = $derived(JSON.stringify(items.map((it, idx) => ({
        id: it.id,
        itemType: it.itemType,
        consumableId: it.consumableId || null,
        recipeId: it.recipeId || null,
        name: it.name,
        description: it.description || null,
        portionAmount: Number(it.portionAmount) || 1,
        unit: it.unit || null,
        costPrice: Number(it.costPrice) || 0,
        factor: Number(it.factor) || 2,
        unitPrice: Number(it.unitPrice) || 0,
        sortOrder: idx,
    }))));
</script>

<form
    {...rf.enhance(async ({ submit }: any) => {
        try {
            const res = await submit();
            if (res?.success) {
                toast.success(
                    isUpdating
                        ? (m.item_updated?.({ item: m.menu?.() || 'Menu' }) || 'Menu updated successfully')
                        : (m.item_created?.({ item: m.menu?.() || 'Menu' }) || 'Menu created successfully')
                );
                if (onSuccess) {
                    onSuccess(res);
                } else {
                    await goto(cancelHref);
                }
            } else if (res === false) {
                toast.error(m.please_fix_validation?.() || 'Please fix validation errors');
            } else {
                const errorMsg = typeof res?.error === 'string' ? res.error : (res?.error?.message || 'Action failed');
                toast.error(errorMsg);
            }
        } catch (err: any) {
            console.error('Error submitting menu form:', err);
            toast.error(err.message || 'Error submitting form');
        }
    })}
    class="space-y-6"
>
    {#if isUpdating && initialData?.id}
        <input {...rf.fields.id.as('hidden', initialData.id)} />
    {/if}

    <input {...rf.fields.items.as('hidden', itemsJson)} />
    <input {...rf.fields.isTemplate.as('hidden', isTemplate ? 'true' : 'false')} />

    <!-- Shared Template Notice (when editing template from an event context) -->
    {#if isUpdating && initialData?.isTemplate && onSuccess}
        <div class="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
            <Info size={16} class="text-amber-600 shrink-0" />
            <span>{m.shared_template_notice?.() || 'This menu is a shared template. To customize it only for this event without affecting other events, uncheck "Reusable Template" below.'}</span>
        </div>
    {/if}

    <!-- Basic Information -->
    <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-xs space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="sm:col-span-2">
                <label for="name" class="block text-sm font-semibold text-gray-700 mb-1">
                    {m.name?.() || 'Menu Name'} <span class="text-red-500">*</span>
                </label>
                <input
                    id="name"
                    {...rf.fields.name.as('text', initialData?.name ?? '')}
                    placeholder="e.g., Wedding Catering Dinner, Coffee Break, BBQ Package"
                    class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                {#each rf.fields.name.issues() as issue}
                    <p class="text-xs text-red-500 mt-1">{issue.message}</p>
                {/each}
            </div>

            <div>
                <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <Layers size={15} class="text-indigo-600" />
                    {m.is_template?.() || 'Template'}
                </label>
                <label class="flex items-center gap-2.5 cursor-pointer mt-1">
                    <input
                        type="checkbox"
                        checked={isTemplate}
                        onchange={(e: any) => isTemplate = e.target.checked}
                        class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span class="text-sm text-gray-700">
                        {m.menu_template?.() || 'Reusable Template'}
                    </span>
                </label>
            </div>
        </div>

        <div>
            <label for="description" class="block text-sm font-semibold text-gray-700 mb-1">
                {m.description?.() || 'Description'}
            </label>
            <input
                id="description"
                {...rf.fields.description.as('text', initialData?.description ?? '')}
                placeholder="Optional description of the menu / catering package"
                class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
        </div>
    </div>

    <!-- Menu Items Selection Section -->
    <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-xs space-y-5">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
                <h3 class="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Utensils size={18} class="text-blue-600" />
                    {m.menu_items?.() || 'Menu Items'}
                </h3>
                <p class="text-xs text-gray-500 mt-0.5">
                    {m.markup_factor?.() || 'Pricing Factor'}: items default to {defaultFactor}× cost markup. Modify per item or apply across the menu.
                </p>
            </div>

            <!-- Controller Bar: Default Factor & Participants -->
            <div class="flex flex-wrap items-center gap-3">
                <!-- Default Factor Selector -->
                <div class="flex items-center gap-1.5 bg-violet-50/80 border border-violet-200/80 px-3 py-1.5 rounded-lg text-xs">
                    <TrendingUp size={15} class="text-violet-600 shrink-0" />
                    <span class="font-semibold text-violet-900">{m.default_factor?.() || 'Default Factor'}:</span>
                    <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        bind:value={defaultFactor}
                        class="w-14 px-1.5 py-0.5 text-xs text-center font-bold bg-white rounded border border-violet-200 focus:outline-hidden focus:ring-1 focus:ring-violet-500"
                    />
                    <div class="hidden sm:flex items-center gap-1 ml-1">
                        {#each [1.5, 2.0, 2.5, 3.0] as preset}
                            <button
                                type="button"
                                onclick={() => defaultFactor = preset}
                                class="px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors {defaultFactor === preset ? 'bg-violet-600 text-white' : 'bg-white hover:bg-violet-100 text-violet-800 border border-violet-200'}"
                            >
                                {preset}×
                            </button>
                        {/each}
                    </div>
                    {#if items.length > 0}
                        <button
                            type="button"
                            onclick={applyDefaultFactorToAll}
                            title={m.apply_to_all?.() || 'Apply to all items'}
                            class="ml-1 p-1 rounded hover:bg-violet-200/70 text-violet-700 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                        >
                            <RotateCcw size={12} />
                            <span class="hidden md:inline">{m.apply_to_all?.() || 'Apply to all'}</span>
                        </button>
                    {/if}
                </div>

                <!-- Participant count controller -->
                <div class="flex items-center gap-2 bg-blue-50/70 border border-blue-100 px-3 py-1.5 rounded-lg">
                    <Users size={15} class="text-blue-600 shrink-0" />
                    <label for="participantsInput" class="text-xs font-semibold text-blue-900">
                        {m.participants?.() || 'Participants'}:
                    </label>
                    <input
                        id="participantsInput"
                        type="number"
                        min="1"
                        step="1"
                        bind:value={currentParticipants}
                        class="w-16 px-2 py-0.5 text-xs text-center font-bold bg-white rounded border border-blue-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>
        </div>

        <!-- Add Items Bar -->
        <div class="bg-gray-50/80 p-4 rounded-xl border border-gray-200/70 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        onclick={() => activeTab = 'consumable'}
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors {activeTab === 'consumable' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'}"
                    >
                        <Package size={14} />
                        {m.add_from_consumables?.() || 'From Consumables'}
                    </button>
                    <button
                        type="button"
                        onclick={() => activeTab = 'recipe'}
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors {activeTab === 'recipe' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'}"
                    >
                        <ChefHat size={14} />
                        {m.add_from_recipes?.() || 'From Recipes'}
                    </button>
                </div>

                {#if templatesList.length > 0}
                    <div class="flex items-center gap-1.5 text-xs">
                        <Sparkles size={14} class="text-violet-600" />
                        <select
                            onchange={(e: any) => { if (e.target.value) { loadFromTemplate(e.target.value); e.target.value = ''; } }}
                            class="px-2.5 py-1 rounded-lg border border-violet-200 bg-violet-50/70 hover:bg-violet-100/60 text-violet-900 text-xs font-semibold focus:ring-2 focus:ring-violet-500 cursor-pointer"
                        >
                            <option value="">{m.load_from_template?.() || 'Copy from Template...'} ▾</option>
                            {#each templatesList as tpl (tpl.id)}
                                <option value={tpl.id}>
                                    {tpl.name} ({tpl.items?.length || 0} items)
                                </option>
                            {/each}
                        </select>
                    </div>
                {/if}
            </div>

            {#if activeTab === 'consumable'}
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                        bind:value={selectedConsumableId}
                        class="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">-- {m.select_consumable?.() || 'Select Consumable'} --</option>
                        {#each consumablesList as c (c.id)}
                            {@const cpu = c.amount > 0 ? c.purchasePrice / c.amount : c.purchasePrice}
                            <option value={c.id}>
                                {c.name} — Cost: €{cpu.toFixed(2)} / {c.unit} ({c.storageLocation || 'Storage'})
                            </option>
                        {/each}
                    </select>
                    <Button
                        type="button"
                        onclick={handleAddFromConsumable}
                        class="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs whitespace-nowrap"
                    >
                        <Plus size={14} />
                        {m.add_item_label?.({ item: m.consumable?.() || 'Consumable' }) || 'Add Item'}
                    </Button>
                </div>
            {:else}
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                        bind:value={selectedRecipeId}
                        class="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">-- {m.select_recipe?.() || 'Select Recipe'} --</option>
                        {#each recipesList as r (r.id)}
                            <option value={r.id}>
                                {r.name} — Cost: €{(r.costPerPortion ?? 0).toFixed(2)} / portion
                            </option>
                        {/each}
                    </select>
                    <Button
                        type="button"
                        onclick={handleAddFromRecipe}
                        class="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs whitespace-nowrap"
                    >
                        <Plus size={14} />
                        {m.add_item_label?.({ item: m.recipe?.() || 'Recipe' }) || 'Add Recipe'}
                    </Button>
                </div>
            {/if}
        </div>

        <!-- Items Table -->
        {#if items.length === 0}
            <div class="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
                <Utensils size={32} class="mx-auto text-gray-300 mb-2" />
                <p class="text-sm font-medium text-gray-500">No menu items added yet.</p>
                <p class="text-xs text-gray-400 mt-1">Use the bar above to add consumables or recipes to this menu.</p>
            </div>
        {:else}
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left border-collapse">
                    <thead>
                        <tr class="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <th class="py-2.5 px-3 min-w-[160px]">Item</th>
                            <th class="py-2.5 px-2.5 w-24">Type</th>
                            <th class="py-2.5 px-2.5 w-28">{m.base_cost?.() || 'Base Cost'}</th>
                            <th class="py-2.5 px-2.5 w-44">{m.factor?.() || 'Markup Factor'}</th>
                            <th class="py-2.5 px-2.5 w-32">{m.selling_price?.() || 'Selling Price'}</th>
                            <th class="py-2.5 px-2.5 w-28">{m.portion_size?.() || 'Portion'}</th>
                            <th class="py-2.5 px-3 w-36 text-right">Total ({currentParticipants}p)</th>
                            <th class="py-2.5 px-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        {#each items as item, index (index)}
                            {@const calc = calculations.lines[index]}
                            {@const lineMargin = (item.unitPrice || 0) - (item.costPrice || 0)}
                            {@const marginPct = (item.unitPrice || 0) > 0 ? (lineMargin / item.unitPrice) * 100 : 0}
                            <tr class="hover:bg-gray-50/60 transition-colors">
                                <!-- Item name -->
                                <td class="py-2.5 px-3">
                                    <input
                                        type="text"
                                        bind:value={item.name}
                                        class="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500"
                                    />
                                    {#if item.description}
                                        <p class="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
                                    {/if}
                                </td>

                                <!-- Type badge -->
                                <td class="py-2.5 px-2.5">
                                    {#if item.itemType === 'recipe'}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                            <ChefHat size={12} /> Recipe
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                            <Package size={12} /> Consumable
                                        </span>
                                    {/if}
                                </td>

                                <!-- Base Cost (Purchase Cost) -->
                                <td class="py-2.5 px-2.5">
                                    <div class="relative">
                                        <span class="absolute left-2.5 top-2 text-gray-400 text-xs">€</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={item.costPrice}
                                            oninput={(e: any) => updateCostPrice(index, parseFloat(e.target.value) || 0)}
                                            class="w-full pl-6 pr-2 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-gray-50/60 focus:bg-white focus:ring-2 focus:ring-blue-500"
                                            title="Cost per unit / portion"
                                        />
                                    </div>
                                </td>

                                <!-- Factor (Multiplier) with quick presets -->
                                <td class="py-2.5 px-2.5">
                                    <div class="space-y-1">
                                        <div class="relative">
                                            <input
                                                type="number"
                                                step="0.05"
                                                min="0.1"
                                                value={item.factor}
                                                oninput={(e: any) => updateFactor(index, parseFloat(e.target.value) || 0)}
                                                class="w-full pr-6 pl-2 py-1.5 rounded-lg border border-indigo-200 text-sm font-bold text-indigo-900 bg-indigo-50/40 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <span class="absolute right-2.5 top-2 text-indigo-400 text-xs font-bold">×</span>
                                        </div>
                                        <div class="flex items-center gap-1">
                                            {#each [1.5, 2.0, 2.5, 3.0] as preset}
                                                <button
                                                    type="button"
                                                    onclick={() => updateFactor(index, preset)}
                                                    class="px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors {Math.abs(item.factor - preset) < 0.01 ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700'}"
                                                >
                                                    {preset}×
                                                </button>
                                            {/each}
                                        </div>
                                    </div>
                                </td>

                                <!-- Selling Price (Bidirectional with factor) -->
                                <td class="py-2.5 px-2.5">
                                    <div class="relative">
                                        <span class="absolute left-2.5 top-2 text-gray-400 text-xs">€</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={item.unitPrice}
                                            oninput={(e: any) => updateUnitPrice(index, parseFloat(e.target.value) || 0)}
                                            class="w-full pl-6 pr-2 py-1.5 rounded-lg border border-gray-300 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <span class="text-[10px] font-semibold text-emerald-600 block mt-1 leading-tight">
                                        +€{lineMargin.toFixed(2)} ({marginPct.toFixed(0)}%)
                                    </span>
                                </td>

                                <!-- Portion Amount -->
                                <td class="py-2.5 px-2.5">
                                    <div class="flex items-center gap-1">
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            bind:value={item.portionAmount}
                                            class="w-16 px-2 py-1.5 rounded-lg border border-gray-300 text-sm text-center font-medium focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span class="text-xs text-gray-500 truncate">{item.unit || ''}</span>
                                    </div>
                                </td>

                                <!-- Total for Participants -->
                                <td class="py-2.5 px-3 text-right">
                                    <span class="text-sm font-black text-gray-900">
                                        €{calc?.totalPrice.toFixed(2) ?? '0.00'}
                                    </span>
                                    <span class="text-[10px] text-gray-500 font-normal block leading-tight mt-0.5">
                                        Cost: €{calc?.totalCost.toFixed(2)} • Profit: <span class="text-emerald-600 font-semibold">+€{calc?.grossProfit.toFixed(2)}</span>
                                    </span>
                                </td>

                                <!-- Remove -->
                                <td class="py-2.5 px-2 text-right">
                                    <button
                                        type="button"
                                        onclick={() => removeItem(index)}
                                        class="p-1 text-gray-400 hover:text-red-600 rounded-md transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <!-- Grand Totals & Margin Executive Card -->
            <div class="mt-4 p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-md border border-indigo-900/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    <div>
                        <span class="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                            {m.menu_items?.() || 'Items'} & {m.participants?.() || 'Participants'}
                        </span>
                        <p class="text-xl font-bold text-white mt-0.5">
                            {items.length} {items.length === 1 ? 'item' : 'items'}
                            <span class="text-sm font-normal text-slate-400">({currentParticipants} {m.participants?.() || 'p'})</span>
                        </p>
                    </div>

                    <div class="sm:border-l sm:border-slate-800 sm:pl-6">
                        <span class="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                            {m.base_cost?.() || 'Total Base Cost'}
                        </span>
                        <p class="text-xl font-bold text-slate-200 mt-0.5">
                            €{calculations.totalCost.toFixed(2)}
                        </p>
                        <span class="text-[10px] text-slate-400 block">
                            €{calculations.perPersonCost.toFixed(2)} / {m.portion?.() || 'person'}
                        </span>
                    </div>

                    <div class="col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6">
                        <span class="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider block flex items-center gap-1">
                            <TrendingUp size={13} />
                            {m.gross_profit?.() || 'Gross Profit'}
                        </span>
                        <p class="text-xl font-bold text-emerald-300 mt-0.5">
                            +€{calculations.grossProfit.toFixed(2)}
                        </p>
                        <span class="text-[10px] text-emerald-400/80 font-medium block">
                            {calculations.marginPercent.toFixed(1)}% {m.margin?.() || 'margin'}
                        </span>
                    </div>
                </div>

                <div class="text-left md:text-right border-t md:border-t-0 border-slate-800 pt-4 md:pt-0 md:border-l md:border-slate-800 md:pl-6">
                    <span class="text-xs text-indigo-300 font-bold uppercase tracking-wider flex items-center md:justify-end gap-1.5">
                        <Calculator size={14} class="text-indigo-400" />
                        {m.selling_price?.() || 'Grand Total Selling Price'}
                    </span>
                    <p class="text-3xl font-black text-white mt-1">
                        €{calculations.grandTotal.toFixed(2)}
                    </p>
                    <span class="text-xs text-indigo-300/80 block mt-0.5">
                        €{calculations.perPersonSales.toFixed(2)} / {m.portion?.() || 'person'}
                    </span>
                </div>
            </div>
        {/if}
    </div>

    <div class="flex items-center justify-end gap-3 pt-2">
        {#if onCancel}
            <Button variant="outline" onclick={onCancel}>
                {m.cancel?.() || 'Cancel'}
            </Button>
        {:else if cancelHref}
            <Button variant="outline" href={cancelHref}>
                {m.cancel?.() || 'Cancel'}
            </Button>
        {/if}

        <AsyncButton isPending={rf.submitting} type="submit">
            {isUpdating ? (m.save_changes?.() || 'Save Changes') : (m.create?.() || 'Create')}
        </AsyncButton>
    </div>
</form>
