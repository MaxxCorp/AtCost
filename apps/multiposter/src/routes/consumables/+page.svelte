<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { listConsumables } from "./list.remote";
    import { deleteConsumables } from "./[id]/delete.remote";
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import Button from "#lib/components/ui/button/button.svelte";
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import {
        Package,
        Pencil,
        Trash2,
        Plus,
        Search,
        MapPin,
        Calendar,
        ArrowUpDown,
        RefreshCw,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    let searchQuery = $state("");
    let sortField = $state<"name" | "purchasePrice" | "amount" | "storageLocation" | "expirationDate" | "createdAt" | "updatedAt">("name");
    let sortOrder = $state<"asc" | "desc">("asc");
    let page = $state(1);
    let limit = $state(50);

    const filterState = $derived({
        page,
        limit,
        search: searchQuery.trim() || undefined,
        sortField,
        sortOrder,
    });

    function isExpired(dateStr?: string | null): boolean {
        if (!dateStr) return false;
        return new Date(dateStr).getTime() < Date.now();
    }

    function isExpiringSoon(dateStr?: string | null): boolean {
        if (!dateStr) return false;
        const target = new Date(dateStr).getTime();
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        return target >= now && target <= now + sevenDays;
    }

    function formatDate(dateStr?: string | null): string {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString();
    }

    async function onDelete(item: { id: string; name: string }, currentCount: number) {
        if (!window.confirm(m.delete_confirm?.({ item: item.name }) || `Are you sure you want to delete ${item.name}?`)) return;
        try {
            await deleteConsumables([item.id]);
            toast.success(m.delete_successful?.() || `${item.name} deleted successfully`);
            if (currentCount <= 1 && page > 1) {
                page = page - 1;
            } else {
                await listConsumables(filterState).refresh();
            }
        } catch (e: any) {
            toast.error(e?.message || m.something_went_wrong?.() || 'Failed to delete');
        }
    }
</script>

<div class="container mx-auto px-4 py-6 max-w-7xl space-y-6">
    <Breadcrumb feature="consumables" />

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                <Package size={28} class="text-amber-600" />
                {m.feature_consumables_title?.() || 'Consumables'}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
                {m.feature_consumables_description?.() || 'Track purchase prices, amounts, storage locations, and expiration dates.'}
            </p>
        </div>

        <Button
            href="/consumables/new"
            class="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white self-start sm:self-auto"
        >
            <Plus size={16} />
            {m.create_item_label?.({ item: m.consumable?.() || 'Consumable' }) || 'New Consumable'}
        </Button>
    </div>

    <!-- Filters & Search Bar -->
    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div class="relative w-full sm:w-80">
            <Search size={16} class="absolute left-3 top-3 text-gray-400" />
            <input
                type="text"
                bind:value={searchQuery}
                oninput={() => (page = 1)}
                placeholder={m.search_placeholder?.({ item: m.consumables?.() || 'Consumables' }) || 'Search consumables...'}
                class="w-full pl-9 pr-3.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span class="text-xs text-gray-500 flex items-center gap-1">
                <ArrowUpDown size={14} /> Sort:
            </span>
            <select
                bind:value={sortField}
                onchange={() => (page = 1)}
                class="px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
                <option value="name">Name</option>
                <option value="purchasePrice">Purchase Price</option>
                <option value="amount">Amount</option>
                <option value="storageLocation">Storage Location</option>
                <option value="expirationDate">Expiration Date</option>
                <option value="createdAt">Created Date</option>
            </select>
            <button
                type="button"
                onclick={() => {
                    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                    page = 1;
                }}
                class="px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold bg-white hover:bg-gray-50 cursor-pointer"
            >
                {sortOrder.toUpperCase()}
            </button>
            <button
                type="button"
                onclick={() => listConsumables(filterState).refresh()}
                title={m.refresh?.() || "Refresh"}
                class="p-2 rounded-lg border border-gray-300 text-xs bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
            >
                <RefreshCw size={13} class={deleteConsumables.pending ? 'animate-spin' : ''} />
            </button>
        </div>
    </div>

    <!-- Content Table -->
    <svelte:boundary>
        {@const result = await listConsumables(filterState)}
        {#if $effect.pending()}
            <div class="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
                <RefreshCw size={18} class="animate-spin text-amber-600" />
                <span>{m.loading?.() || 'Loading consumables...'}</span>
            </div>
        {/if}
        <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
            {#if !result?.data || result.data.length === 0}
                <div class="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-xs space-y-3">
                    <Package size={40} class="mx-auto text-gray-300" />
                    <h3 class="text-base font-bold text-gray-900">{m.no_items_found?.({ item: m.consumables?.() || 'Consumables' }) || 'No consumables found'}</h3>
                    <p class="text-sm text-gray-500 max-w-md mx-auto">
                        Get started by adding items you purchase for events and catering recipes.
                    </p>
                    <Button href="/consumables/new" class="bg-amber-600 hover:bg-amber-700 text-white mt-2">
                        <Plus size={16} class="mr-1.5" />
                        {m.create_item_label?.({ item: m.consumable?.() || 'Consumable' }) || 'New Consumable'}
                    </Button>
                </div>
            {:else}
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-left border-collapse">
                                <thead class="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th class="py-3 px-4">Item</th>
                                        <th class="py-3 px-4">Price / Package</th>
                                        <th class="py-3 px-4">Cost per Unit</th>
                                        <th class="py-3 px-4">Storage Location</th>
                                        <th class="py-3 px-4">Expiration Date</th>
                                        <th class="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100">
                                    {#each result.data as item (item.id)}
                                        {@const expired = isExpired(item.expirationDate)}
                                        {@const soon = isExpiringSoon(item.expirationDate)}
                                        <tr class="hover:bg-gray-50/60 transition-colors">
                                            <td class="py-3 px-4">
                                                <div class="font-bold text-gray-900">{item.name}</div>
                                                {#if item.description}
                                                    <div class="text-xs text-gray-400 truncate max-w-xs">{item.description}</div>
                                                {/if}
                                            </td>
                                            <td class="py-3 px-4 text-gray-700">
                                                <span class="font-medium text-gray-900">€{item.purchasePrice.toFixed(2)}</span>
                                                <span class="text-xs text-gray-400"> / {item.amount} {item.unit}</span>
                                            </td>
                                            <td class="py-3 px-4">
                                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                                    €{(item.costPerUnit ?? 0).toFixed(2)} / {item.unit}
                                                </span>
                                            </td>
                                            <td class="py-3 px-4 text-gray-600">
                                                {#if item.storageLocation}
                                                    <span class="inline-flex items-center gap-1.5 text-xs font-medium">
                                                        <MapPin size={13} class="text-orange-500" />
                                                        {item.storageLocation}
                                                    </span>
                                                {:else}
                                                    <span class="text-xs text-gray-300">-</span>
                                                {/if}
                                            </td>
                                            <td class="py-3 px-4">
                                                {#if item.expirationDate}
                                                    <div class="flex items-center gap-1.5 text-xs font-medium">
                                                        <Calendar size={13} class="text-gray-400" />
                                                        <span class={expired ? 'text-red-600 font-bold' : soon ? 'text-amber-600 font-semibold' : 'text-gray-700'}>
                                                            {formatDate(item.expirationDate)}
                                                        </span>
                                                        {#if expired}
                                                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 rounded">
                                                                {m.expired?.() || 'Expired'}
                                                            </span>
                                                        {:else if soon}
                                                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                                                                {m.expires_soon?.() || 'Soon'}
                                                            </span>
                                                        {/if}
                                                    </div>
                                                {:else}
                                                    <span class="text-xs text-gray-300">-</span>
                                                {/if}
                                            </td>
                                            <td class="py-3 px-4 text-right">
                                                <div class="inline-flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        href={`/consumables/${item.id}`}
                                                        class="h-8 w-8 p-0"
                                                        title={m.edit?.() || 'Edit'}
                                                    >
                                                        <Pencil size={15} class="text-gray-600" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onclick={() => onDelete(item, result.data.length)}
                                                        disabled={Boolean(deleteConsumables.pending)}
                                                        class="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                                                        title={m.delete?.() || 'Delete'}
                                                    >
                                                        <Trash2 size={15} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>

                        <!-- Pagination footer -->
                        {#if Math.ceil((result.total || 0) / limit) > 1}
                            {@const totalPages = Math.ceil((result.total || 0) / limit)}
                            <div class="p-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                <span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, result.total)} of {result.total}</span>
                                <div class="flex items-center gap-1">
                                    <button
                                        disabled={page <= 1}
                                        onclick={() => page--}
                                        class="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-50 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        Prev
                                    </button>
                                    <span>Page {page} of {totalPages}</span>
                                    <button
                                        disabled={page >= totalPages}
                                        onclick={() => page++}
                                        class="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-50 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
            {#snippet failed(error: unknown, reset: () => void)}
                <ErrorSection
                    headline={m.error?.() || 'Error'}
                    message={error instanceof Error ? error.message : 'Failed to load consumables'}
                    href="/consumables"
                    button={m.try_again?.() || 'Try Again'}
                />
            {/snippet}
        </svelte:boundary>
</div>
