<script lang="ts">
    import { Search, Check } from "@lucide/svelte";
    
    let { 
        items = [], 
        selectedIds = $bindable([]),
        title = "Items",
        labelKey = "name",
        idKey = "id"
    } = $props<{
        items: any[];
        selectedIds: string[];
        title: string;
        labelKey?: string;
        idKey?: string;
    }>();

    let search = $state("");
    let filteredItems = $derived(
        items.filter((item: any) => (item[labelKey] || "").toLowerCase().includes(search.toLowerCase()))
    );

    function toggle(id: string) {
        if (selectedIds.includes(id)) {
            selectedIds = selectedIds.filter((i: any) => i !== id);
        } else {
            selectedIds = [...selectedIds, id];
        }
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
        {#each filteredItems as item}
            {@const isSelected = selectedIds.includes(item[idKey])}
            <button 
                type="button" 
                class="w-full text-left px-2 py-1.5 rounded text-sm flex items-start gap-2 {isSelected ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-100 text-gray-700'}"
                onclick={() => toggle(item[idKey])}
            >
                <div class="mt-0.5 border rounded border-gray-300 w-4 h-4 flex items-center justify-center shrink-0 {isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white'}">
                    {#if isSelected}
                        <Check class="w-3 h-3 text-white" strokeWidth={3} />
                    {/if}
                </div>
                <span class="leading-tight line-clamp-2">{item[labelKey] || "Untitled"}</span>
            </button>
        {/each}
        {#if filteredItems.length === 0}
            <div class="text-center text-sm text-gray-500 py-4">No matching items</div>
        {/if}
    </div>
</div>
