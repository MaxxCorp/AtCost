<script lang="ts">
    import type { Collaborator } from './types';

    let {
        collaborator
    }: {
        collaborator?: Collaborator | null;
    } = $props();
</script>

{#if collaborator}
    <div
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-t-md text-[11px] font-medium tracking-tight shadow-sm select-none transition-all duration-150 animate-in fade-in zoom-in-95"
        style:background-color={collaborator.color.bg}
        style:color={collaborator.color.text}
    >
        <span class="size-1.5 rounded-full bg-white/90 animate-pulse"></span>
        <span class="truncate max-w-[150px]">{collaborator.name}</span>
        <span class="opacity-80 text-[10px]">is editing</span>
    </div>
{/if}
