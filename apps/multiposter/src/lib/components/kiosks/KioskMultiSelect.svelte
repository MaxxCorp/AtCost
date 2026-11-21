<script lang="ts">
    import { Search, Check, Lock } from "@lucide/svelte";
    import * as m from "#lib/paraglide/messages.js";
    
    let { 
        items = [], 
        selectedIds = $bindable([]),
        title = "Items",
        labelKey = "name",
        idKey = "id",
        onToggle
    }: {
        items?: any[];
        selectedIds?: string[];
        title?: string;
        labelKey?: string;
        idKey?: string;
        onToggle?: (item: any, isNowSelected: boolean) => void;
    } = $props();

    let search = $state("");
    let filteredItems = $derived(
        items.filter((item: any) => (item[labelKey] || "").toLowerCase().includes(search.toLowerCase()))
    );

    function isItemSelected(item: any): boolean {
        return (
            selectedIds.includes(item[idKey]) ||
            (labelKey !== idKey && Boolean(item[labelKey]) && selectedIds.includes(item[labelKey]))
        );
    }

    function toggle(item: any) {
        const wasSelected = isItemSelected(item);
        const itemId = item[idKey];
        const itemLabel = labelKey !== idKey ? item[labelKey] : undefined;

        if (wasSelected) {
            selectedIds = selectedIds.filter((i: any) => i !== itemId && (!itemLabel || i !== itemLabel));
        } else {
            selectedIds = selectedIds.includes(itemId) ? selectedIds : [...selectedIds, itemId];
        }
        onToggle?.(item, !wasSelected);
    }

    function selectAll() {
        selectedIds = filteredItems.map((i: any) => i[idKey]);
    }

    function selectNone() {
        selectedIds = [];
    }
</script>

<div class="border rounded-md shadow-sm bg-white overflow-hidden flex flex-col h-64">
    <div class="bg-gray-50 border-b px-3 py-2 flex items-center justify-between">
        <span class="font-medium text-sm text-gray-700">{title}</span>
        <div class="flex gap-2">
            <button type="button" class="text-xs text-blue-600 hover:underline font-medium" onclick={selectAll}>All</button>
            <button type="button" class="text-xs text-blue-600 hover:underline font-medium" onclick={selectNone}>None</button>
        </div>
    </div>
    
    <div class="p-2 border-b flex items-center gap-2 bg-gray-50/50">
        <Search class="w-4 h-4 text-gray-400" />
        <input 
            type="text" 
            bind:value={search} 
            placeholder="Search..." 
            class="bg-transparent border-none outline-none text-sm w-full"
        />
    </div>

    <div class="overflow-y-auto flex-1 p-2 space-y-1">
        {#each filteredItems as item, idx (item[idKey] ?? idx)}
            {@const isSelected = isItemSelected(item)}
            {@const isInternal = item.isPublic === false || item.visibility === 'internal'}
            <button 
                type="button" 
                class="w-full text-left px-2 py-1.5 rounded text-sm flex items-start gap-2 {isSelected ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-100 text-gray-700'}"
                onclick={() => toggle(item)}
            >
                <div class="mt-0.5 border rounded border-gray-300 w-4 h-4 flex items-center justify-center shrink-0 {isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white'}">
                    {#if isSelected}
                        <Check class="w-3 h-3 text-white" strokeWidth={3} />
                    {/if}
                </div>
                <span class="leading-tight line-clamp-2 flex-1">{item[labelKey] || "Untitled"}</span>
                {#if isInternal}
                    <span class="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        <Lock class="w-2.5 h-2.5" />
                        {m.private_label?.() ?? 'Internal'}
                    </span>
                {/if}
            </button>
        {/each}
        {#if filteredItems.length === 0}
            <div class="text-center text-sm text-gray-500 py-4">No matching items</div>
        {/if}
    </div>
</div>
