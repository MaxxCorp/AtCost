<script lang="ts">
    import type { Collaborator } from './types';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    let {
        peers = [],
        connected = false,
        maxVisible = 4,
        class: className = ''
    }: {
        peers?: Collaborator[];
        connected?: boolean;
        maxVisible?: number;
        class?: string;
    } = $props();

    const visiblePeers = $derived(peers.slice(0, maxVisible));
    const overflowCount = $derived(Math.max(0, peers.length - maxVisible));

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
    <!-- Connection Status Indicator -->
    <div class="flex items-center gap-1.5 text-xs text-muted-foreground" title={connected ? "Connected to realtime room" : "Connecting..."}>
        <span class="relative flex h-2 w-2">
            {#if connected}
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            {:else}
                <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse"></span>
            {/if}
        </span>
        <span class="hidden sm:inline text-[11px] font-medium tracking-tight">
            {peers.length > 0 ? `${peers.length} active` : "Live"}
        </span>
    </div>

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
