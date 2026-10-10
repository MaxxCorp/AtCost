<script lang="ts">
    import type { Collaborator } from './types';
    import type { CollaborationProvider } from './collaboration.svelte';
    import * as Tooltip from '#lib/components/ui/tooltip/index.js';

    let {
        peers = [],
        connected = false,
        provider = 'none',
        offlineReason = null,
        maxVisible = 4,
        class: className = ''
    }: {
        peers?: Collaborator[];
        connected?: boolean;
        provider?: CollaborationProvider;
        offlineReason?: string | null;
        maxVisible?: number;
        class?: string;
    } = $props();

    const visiblePeers = $derived(peers.slice(0, maxVisible));
    const overflowCount = $derived(Math.max(0, peers.length - maxVisible));

    const statusLabel = $derived.by(() => {
        if (peers.length > 0) return `${peers.length} active`;
        if (connected) return provider === 'ably' ? 'Live (Cloud)' : 'Live (Direct)';
        if (provider === 'polling') return 'Polling Mode';
        return 'Offline';
    });

    const tooltipHeadline = $derived.by(() => {
        if (connected) {
            return provider === 'ably' ? 'Real-time Active (Cloud)' : 'Real-time Active (Direct Server)';
        }
        if (provider === 'polling') {
            return 'Polling Fallback Active';
        }
        return 'Real-time Inactive';
    });

    const tooltipDescription = $derived.by(() => {
        if (connected) {
            const providerName = provider === 'ably' ? 'Ably cloud network' : 'persistent server stream (SSE)';
            return `Collaborative presence and real-time updates are active via ${providerName}.`;
        }
        if (offlineReason) {
            return offlineReason;
        }
        return 'Real-time presence is currently unavailable. Your form inputs and saves work normally.';
    });

    function getInitials(name: string): string {
        if (!name) return '??';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }
</script>

<div class="flex items-center gap-3 {className}">
    <!-- Connection Status Indicator with Unobtrusive Offline Tooltip -->
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <button
                    type="button"
                    {...props}
                    class="flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-muted-foreground transition-colors cursor-help select-none bg-transparent border-0 p-0"
                >
                    <span class="relative flex h-2 w-2">
                        {#if connected}
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        {:else if provider === 'polling'}
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-400/80"></span>
                        {:else}
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/40"></span>
                        {/if}
                    </span>
                    <span class="hidden sm:inline text-[11px] font-medium tracking-tight">
                        {statusLabel}
                    </span>
                </button>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom" align="start" class="max-w-[260px] text-xs p-2.5 shadow-md">
            <div class="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                <span
                    class="size-1.5 rounded-full inline-block {connected
                        ? 'bg-emerald-500'
                        : provider === 'polling'
                        ? 'bg-blue-400'
                        : 'bg-muted-foreground/50'}"
                ></span>
                {tooltipHeadline}
            </div>
            <p class="text-muted-foreground text-[11px] leading-relaxed">
                {tooltipDescription}
            </p>
            {#if !connected}
                <div class="mt-1.5 pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground/80">
                    Form saving and validation are fully functional.
                </div>
            {/if}
        </Tooltip.Content>
    </Tooltip.Root>

    <!-- Active Collaborators Stack -->
    {#if peers.length > 0}
        <div class="flex items-center -space-x-2 overflow-hidden py-1 px-1">
            {#each visiblePeers as peer (peer.connectionId)}
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        {#snippet child({ props })}
                            <div
                                {...props}
                                class="relative inline-flex items-center justify-center size-7 rounded-full text-xs font-semibold ring-2 ring-background transition-transform duration-150 hover:scale-110 hover:z-10 shadow-sm cursor-default select-none"
                                style:background-color={peer.color.bg}
                                style:color={peer.color.text}
                            >
                                {#if peer.avatar}
                                    <img
                                        src={peer.avatar}
                                        alt={peer.name}
                                        class="size-full rounded-full object-cover"
                                    />
                                {:else}
                                    {getInitials(peer.name)}
                                {/if}

                                {#if peer.focusedField}
                                    <span
                                        class="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-background bg-emerald-400"
                                        title="Actively editing"
                                    ></span>
                                {/if}
                            </div>
                        {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content side="bottom" align="center" class="text-xs py-1 px-2.5 shadow-md">
                        <div class="font-medium text-foreground">{peer.name}</div>
                        {#if peer.email}
                            <div class="text-[11px] text-muted-foreground">{peer.email}</div>
                        {/if}
                        {#if peer.focusedField}
                            <div class="mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <span class="size-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                Editing {peer.focusedField}
                            </div>
                        {:else}
                            <div class="mt-0.5 text-[10px] text-muted-foreground">Viewing</div>
                        {/if}
                    </Tooltip.Content>
                </Tooltip.Root>
            {/each}

            {#if overflowCount > 0}
                <div
                    class="inline-flex items-center justify-center size-7 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground ring-2 ring-background shadow-sm select-none"
                    title="{overflowCount} more collaborators"
                >
                    +{overflowCount}
                </div>
            {/if}
        </div>
    {/if}
</div>
