<script lang="ts">
    import { list } from "../../../routes/synchronizations/list.remote";
    import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
    import * as m from "$lib/paraglide/messages";
    import { translateIssue } from "@ac/ui";
    
    let {
        syncFieldConfig,
        initialSelectedIds = []
    }: {
        syncFieldConfig: any; // Remote Function field object
        initialSelectedIds?: string[];
    } = $props();

    // svelte-ignore state_referenced_locally
    let selectedIds = $state<string[]>(initialSelectedIds?.length ? [...initialSelectedIds] : []);
    let configsPromise = list();

    function toggleConfig(id: string) {
        if (selectedIds.includes(id)) {
            selectedIds = selectedIds.filter(x => x !== id);
        } else {
            selectedIds = [...selectedIds, id];
        }
    }

    // Prepare JSON for hidden input
    let hiddenValue = $derived(JSON.stringify(selectedIds));

</script>

<div class="bg-white shadow rounded-lg p-6 space-y-4">
    <div class="flex gap-2 items-center mb-4 border-b pb-2">
        <RefreshCw class="w-5 h-5 text-gray-600" />
        <h2 class="text-xl font-semibold">{m.synchronization()}</h2>
    </div>

    <p class="text-sm text-gray-600 mb-4">
        {m.sync_description()}
    </p>

    {#await configsPromise}
        <p class="text-sm text-gray-500">{m.loading_item({ item: m.feature_synchronizations_title() })}</p>
    {:then result}
        {#if !result.data || result.data.length === 0}
            <p class="text-sm text-gray-500 italic">{m.no_syncs_configured()}</p>
        {:else}
            <div class="space-y-2 border rounded-md p-4 bg-gray-50 max-h-64 overflow-y-auto">
                {#each result.data as config}
                    {#if config.enabled}
                        <label class="flex items-center gap-3 py-2 px-2 hover:bg-white border border-transparent hover:border-gray-200 rounded transition-colors cursor-pointer">
                            <input 
                                type="checkbox"
                                class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2"
                                checked={selectedIds.includes(config.id)}
                                onchange={() => toggleConfig(config.id)}
                            />
                            <div class="flex flex-col">
                                <span class="text-sm font-medium text-gray-900 capitalize">{config.providerType?.replace(/-/g, ' ') ?? 'Unknown'}</span>
                                <span class="text-xs text-gray-500 font-mono">{config.providerId}</span>
                            </div>
                        </label>
                    {/if}
                {/each}
            </div>
        {/if}
    {/await}

    
    <input {...syncFieldConfig.as("text", hiddenValue)} class="hidden" />
    {#each syncFieldConfig.issues() ?? [] as issue}
        <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
    {/each}
</div>
