<script lang="ts">
    import { untrack } from "svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import * as m from "$lib/paraglide/messages";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { goto } from "$app/navigation";
    import { Euro, ChefHat, Plus, Trash2, Scale } from "@lucide/svelte";
    import type { Consumable } from "@ac/validations";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        allConsumables = [],
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/recipes",
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        allConsumables?: Consumable[];
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

    let portions = $state(untrack(() => initialData?.portions ?? 1));

    interface FormIngredient {
        consumableId: string;
        amount: number;
        unit?: string;
    }

    let ingredients = $state<FormIngredient[]>(untrack(() => {
        if (!initialData?.consumables) return [];
        return initialData.consumables.map((c: any) => ({
            consumableId: c.consumableId,
            amount: c.amount,
            unit: c.unit || c.consumable?.unit || '',
        }));
    }));

    // Find consumable by ID helper
    function getConsumable(id: string): Consumable | undefined {
        return allConsumables.find(c => c.id === id);
    }

    function getCostPerUnit(c?: Consumable | null): number {
        if (!c) return 0;
        const p = c.purchasePrice || 0;
        const a = c.amount || 1;
        return a > 0 ? p / a : p;
    }

    function addIngredientRow() {
        if (allConsumables.length === 0) {
            toast.error('No consumables available. Please create consumables first.');
            return;
        }
        const first = allConsumables[0];
        ingredients = [
            ...ingredients,
            {
                consumableId: first.id,
                amount: 1,
                unit: first.unit,
            }
        ];
    }

    function removeIngredientRow(index: number) {
        ingredients = ingredients.filter((_, i) => i !== index);
    }

    // Calculations
    const ingredientCalculations = $derived.by(() => {
        let total = 0;
        const list = ingredients.map(ing => {
            const c = getConsumable(ing.consumableId);
            const cpu = getCostPerUnit(c);
            const lineCost = cpu * (Number(ing.amount) || 0);
            total += lineCost;
            return {
                ...ing,
                consumableName: c?.name || 'Unknown item',
                unit: ing.unit || c?.unit || 'unit',
                costPerUnit: cpu,
                lineCost: Math.round(lineCost * 100) / 100,
            };
        });
        const p = Number(portions) > 0 ? Number(portions) : 1;
        const costPerPortion = Math.round((total / p) * 100) / 100;
        return {
            items: list,
            totalBatchCost: Math.round(total * 100) / 100,
            costPerPortion,
        };
    });

    const ingredientsJson = $derived(JSON.stringify(ingredients.map(i => ({
        consumableId: i.consumableId,
        amount: Number(i.amount) || 1,
        unit: i.unit || null,
    }))));
</script>

<form
    {...rf.enhance(async ({ submit }: any) => {
        try {
            const res = await submit();
            if (res?.success) {
                toast.success(
                    isUpdating
                        ? (m.item_updated?.({ item: m.recipe?.() || 'Recipe' }) || 'Recipe updated successfully')
                        : (m.item_created?.({ item: m.recipe?.() || 'Recipe' }) || 'Recipe created successfully')
                );
                if (onSuccess) {
                    onSuccess(res);
                } else {
                    await goto(cancelHref);
                }
            } else {
                toast.error(res?.error?.message || 'Action failed');
            }
        } catch (err: any) {
            console.error('Error submitting recipe form:', err);
            toast.error(err.message || 'Error submitting form');
        }
    })}
    class="space-y-6"
>
    {#if isUpdating && initialData?.id}
        <input type="hidden" name="id" value={initialData.id} />
    {/if}

    <input type="hidden" {...rf.fields.ingredients.as('text')} value={ingredientsJson} />

    <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-xs space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="sm:col-span-2">
                <label for="name" class="block text-sm font-semibold text-gray-700 mb-1">
                    {m.name?.() || 'Recipe Name'} <span class="text-red-500">*</span>
                </label>
                <input
                    id="name"
                    {...rf.fields.name.as('text')}
                    value={initialData?.name ?? ''}
                    placeholder="e.g., Spaghetti Bolognese, Caesar Salad, Fruit Punch"
                    class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                {#each rf.fields.name.issues() as issue}
                    <p class="text-xs text-red-500 mt-1">{issue.message}</p>
                {/each}
            </div>

            <div>
                <label for="portions" class="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <ChefHat size={15} class="text-emerald-600" />
                    {m.portions?.() || 'Portions Yield'} <span class="text-red-500">*</span>
                </label>
                <input
                    id="portions"
                    type="number"
                    step="1"
                    min="1"
                    {...rf.fields.portions.as('number')}
                    value={initialData?.portions ?? 1}
                    oninput={(e: any) => portions = parseFloat(e.target.value) || 1}
                    class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                {#each rf.fields.portions.issues() as issue}
                    <p class="text-xs text-red-500 mt-1">{issue.message}</p>
                {/each}
            </div>
        </div>

        <div>
            <label for="description" class="block text-sm font-semibold text-gray-700 mb-1">
                {m.description?.() || 'Description'}
            </label>
            <input
                id="description"
                {...rf.fields.description.as('text')}
                value={initialData?.description ?? ''}
                placeholder="Short summary or dietary note (e.g. Vegetarian, Gluten-free)"
                class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
        </div>

        <div>
            <label for="instructions" class="block text-sm font-semibold text-gray-700 mb-1">
                {m.instructions?.() || 'Preparation Instructions'}
            </label>
            <textarea
                id="instructions"
                {...rf.fields.instructions.as('text')}
                value={initialData?.instructions ?? ''}
                rows="4"
                placeholder="Step 1: Chop vegetables...&#10;Step 2: Sauté in pan...&#10;Step 3: Simmer for 20 minutes..."
                class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
            ></textarea>
        </div>
    </div>

    <!-- Ingredients Section -->
    <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-xs space-y-4">
        <div class="flex items-center justify-between">
            <div>
                <h3 class="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Scale size={18} class="text-blue-600" />
                    {m.ingredients?.() || 'Ingredients'}
                </h3>
                <p class="text-xs text-gray-500 mt-0.5">
                    Select consumables needed for this recipe to calculate the cost per portion.
                </p>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={addIngredientRow}
                class="flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
                <Plus size={15} />
                {m.add_ingredient?.() || 'Add Ingredient'}
            </Button>
        </div>

        {#if ingredients.length === 0}
            <div class="py-6 text-center border-2 border-dashed border-gray-200 rounded-xl">
                <p class="text-sm text-gray-400 mb-2">No ingredients added yet.</p>
                <Button type="button" variant="outline" size="sm" onclick={addIngredientRow}>
                    <Plus size={14} class="mr-1" /> {m.add_ingredient?.() || 'Add Ingredient'}
                </Button>
            </div>
        {:else}
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left border-collapse">
                    <thead>
                        <tr class="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <th class="py-2.5 px-3">Consumable</th>
                            <th class="py-2.5 px-3 w-32">Amount</th>
                            <th class="py-2.5 px-3 w-28">Unit</th>
                            <th class="py-2.5 px-3 w-32 text-right">Cost</th>
                            <th class="py-2.5 px-2 w-12"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        {#each ingredients as ing, index (index)}
                            {@const c = getConsumable(ing.consumableId)}
                            {@const calc = ingredientCalculations.items[index]}
                            <tr class="hover:bg-gray-50/50">
                                <td class="py-2 px-3">
                                    <select
                                        bind:value={ing.consumableId}
                                        onchange={() => {
                                            const selected = getConsumable(ing.consumableId);
                                            if (selected) {
                                                ing.unit = selected.unit;
                                            }
                                        }}
                                        class="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {#each allConsumables as item (item.id)}
                                            <option value={item.id}>
                                                {item.name} (€{item.purchasePrice}/{item.amount} {item.unit})
                                            </option>
                                        {/each}
                                    </select>
                                </td>
                                <td class="py-2 px-3">
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        bind:value={ing.amount}
                                        class="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </td>
                                <td class="py-2 px-3">
                                    <span class="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                                        {ing.unit || c?.unit || '-'}
                                    </span>
                                </td>
                                <td class="py-2 px-3 text-right font-medium text-gray-900">
                                    €{calc?.lineCost.toFixed(2) ?? '0.00'}
                                </td>
                                <td class="py-2 px-2 text-right">
                                    <button
                                        type="button"
                                        onclick={() => removeIngredientRow(index)}
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

            <!-- Cost Summary Box -->
            <div class="mt-4 p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center gap-6">
                    <div>
                        <span class="text-xs text-gray-500 uppercase font-semibold">Total Batch Cost</span>
                        <p class="text-lg font-bold text-gray-900">€{ingredientCalculations.totalBatchCost.toFixed(2)}</p>
                    </div>
                    <div class="border-l border-emerald-200 pl-6">
                        <span class="text-xs text-gray-500 uppercase font-semibold">Portions</span>
                        <p class="text-lg font-bold text-gray-900">{portions}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-xs text-emerald-700 uppercase font-bold flex items-center justify-end gap-1">
                        <Euro size={14} /> {m.cost_per_portion?.() || 'Cost per Portion'}
                    </span>
                    <p class="text-2xl font-extrabold text-emerald-900">
                        €{ingredientCalculations.costPerPortion.toFixed(2)}
                    </p>
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
