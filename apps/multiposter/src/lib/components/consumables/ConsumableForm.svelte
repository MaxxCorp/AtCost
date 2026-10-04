<script lang="ts">
    import { untrack } from "svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import * as m from "$lib/paraglide/messages";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { goto } from "$app/navigation";
    import { Euro, Calendar, MapPin, Package, Scale } from "@lucide/svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/consumables",
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
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

    let purchasePrice = $state(untrack(() => initialData?.purchasePrice ?? 0));
    let amount = $state(untrack(() => initialData?.amount ?? 1));
    let unit = $state(untrack(() => initialData?.unit ?? 'piece'));

    const calculatedCostPerUnit = $derived.by(() => {
        const p = Number(purchasePrice) || 0;
        const a = Number(amount) || 1;
        if (a <= 0) return p;
        return Math.round((p / a) * 100) / 100;
    });

    function formatForInput(dateVal: any): string {
        if (!dateVal) return "";
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return "";
            return d.toISOString().slice(0, 10);
        } catch {
            return "";
        }
    }
</script>

<form
    {...rf.enhance(async ({ submit }: any) => {
        try {
            const res = await submit();
            if (res?.success) {
                toast.success(
                    isUpdating
                        ? (m.item_updated?.({ item: m.consumable?.() || 'Consumable' }) || 'Consumable updated successfully')
                        : (m.item_created?.({ item: m.consumable?.() || 'Consumable' }) || 'Consumable created successfully')
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
            console.error('Error submitting consumable form:', err);
            toast.error(err.message || 'Error submitting form');
        }
    })}
    class="space-y-6"
>
    {#if isUpdating && initialData?.id}
        <input {...rf.fields.id.as('hidden', initialData.id)} />
    {/if}

    <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-xs space-y-4">
        <div>
            <label for="name" class="block text-sm font-semibold text-gray-700 mb-1">
                {m.name?.() || 'Name'} <span class="text-red-500">*</span>
            </label>
            <input
                id="name"
                {...rf.fields.name.as('text', initialData?.name ?? '')}
                placeholder="e.g., Organic Milk 1L, Coffee Beans, Red Wine Bottle"
                class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {#each rf.fields.name.issues() as issue}
                <p class="text-xs text-red-500 mt-1">{issue.message}</p>
            {/each}
        </div>

        <div>
            <label for="description" class="block text-sm font-semibold text-gray-700 mb-1">
                {m.description?.() || 'Description'}
            </label>
            <textarea
                id="description"
                {...rf.fields.description.as('text', initialData?.description ?? '')}
                rows="2"
                placeholder="Optional details, brand, packaging notes..."
                class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            ></textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
                <label for="purchasePrice" class="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Euro size={15} class="text-emerald-600" />
                    {m.purchase_price?.() || 'Purchase Price'} (€) <span class="text-red-500">*</span>
                </label>
                <input
                    id="purchasePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    {...rf.fields.purchasePrice.as('number', initialData?.purchasePrice ?? 0)}
                    oninput={(e: any) => purchasePrice = parseFloat(e.target.value) || 0}
                    class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                {#each rf.fields.purchasePrice.issues() as issue}
                    <p class="text-xs text-red-500 mt-1">{issue.message}</p>
                {/each}
            </div>

            <div>
                <label for="amount" class="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Package size={15} class="text-blue-600" />
                    {m.amount?.() || 'Amount / Size'} <span class="text-red-500">*</span>
                </label>
                <input
                    id="amount"
                    type="number"
                    step="any"
                    min="0.0001"
                    {...rf.fields.amount.as('number', initialData?.amount ?? 1)}
                    oninput={(e: any) => amount = parseFloat(e.target.value) || 1}
                    class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                {#each rf.fields.amount.issues() as issue}
                    <p class="text-xs text-red-500 mt-1">{issue.message}</p>
                {/each}
            </div>

            <div>
                <label for="unit" class="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Scale size={15} class="text-purple-600" />
                    {m.unit?.() || 'Unit'} <span class="text-red-500">*</span>
                </label>
                <input
                    id="unit"
                    {...rf.fields.unit.as('text', initialData?.unit ?? 'piece')}
                    oninput={(e: any) => unit = e.target.value}
                    placeholder="e.g. kg, g, l, ml, piece, bottle, pack"
                    class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                {#each rf.fields.unit.issues() as issue}
                    <p class="text-xs text-red-500 mt-1">{issue.message}</p>
                {/each}
            </div>
        </div>

        <!-- Calculated cost preview card -->
        <div class="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100 flex items-center justify-between text-sm">
            <span class="text-emerald-800 font-medium flex items-center gap-1.5">
                <Euro size={16} class="text-emerald-600" />
                {m.cost_per_unit?.() || 'Cost per Unit'}:
            </span>
            <span class="text-base font-bold text-emerald-900">
                €{calculatedCostPerUnit.toFixed(2)} / {unit || 'unit'}
            </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
                <label for="storageLocation" class="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <MapPin size={15} class="text-orange-500" />
                    {m.storage_location?.() || 'Storage Location'}
                </label>
                <input
                    id="storageLocation"
                    {...rf.fields.storageLocation.as('text', initialData?.storageLocation ?? '')}
                    placeholder="e.g., Pantry Shelf A3, Bar Cooler, Cold Storage"
                    class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
            </div>

            <div>
                <label for="expirationDate" class="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Calendar size={15} class="text-red-500" />
                    {m.expiration_date?.() || 'Expiration Date'}
                </label>
                <input
                    id="expirationDate"
                    type="date"
                    {...rf.fields.expirationDate.as('text', formatForInput(initialData?.expirationDate))}
                    class="w-full px-3.5 py-2 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
            </div>
        </div>
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
