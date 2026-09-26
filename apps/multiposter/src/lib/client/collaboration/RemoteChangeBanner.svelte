<script lang="ts">
    import type { EntityChangeMessage } from './types';
    import { Button } from '$lib/components/ui/button';
    import { RefreshCw, X, AlertCircle } from '@lucide/svelte';

    let {
        remoteChange,
        onRefresh,
        onDismiss
    }: {
        remoteChange: EntityChangeMessage | null;
        onRefresh: () => void | Promise<void>;
        onDismiss: () => void;
    } = $props();

    let refreshing = $state(false);

    async function handleRefresh() {
        refreshing = true;
        try {
            await onRefresh();
            onDismiss();
        } finally {
            refreshing = false;
        }
    }

    const updaterName = $derived(remoteChange?.updatedBy?.name || remoteChange?.updatedBy?.email || 'Another collaborator');
    const actionLabel = $derived(
        remoteChange?.action === 'delete'
            ? 'deleted'
            : remoteChange?.action === 'create'
            ? 'created'
            : 'updated'
    );
</script>

{#if remoteChange}
    <div
        role="alert"
        class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-4 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
    >
        <div class="flex items-center gap-3">
            <AlertCircle class="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div class="text-sm">
                <span class="font-semibold">{updaterName}</span> {actionLabel} this item just now.
                <span class="text-xs text-amber-700/80 dark:text-amber-300/80 ml-1">
                    Refresh to view the latest changes.
                </span>
            </div>
        </div>

        <div class="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                disabled={refreshing}
                onclick={handleRefresh}
                class="bg-white hover:bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-700 h-8 gap-1.5 font-medium"
            >
                <RefreshCw class="size-3.5 {refreshing ? 'animate-spin' : ''}" />
                {refreshing ? 'Refreshing...' : 'Load Changes'}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onclick={onDismiss}
                class="size-8 text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
                aria-label="Dismiss"
            >
                <X class="size-4" />
            </Button>
        </div>
    </div>
{/if}
