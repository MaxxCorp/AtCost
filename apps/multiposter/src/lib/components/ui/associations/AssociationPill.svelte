<script lang="ts">
    import { X, Pencil } from "@lucide/svelte";

    interface Props {
        onedit?: () => void;
        onunlink?: () => void;
        children?: any;
    }

    let { onedit, onunlink, children }: Props = $props();
</script>

<div
    class="flex items-center gap-2 bg-white border rounded-full px-3 py-1 text-sm shadow-sm group flex-wrap"
>
    {@render children?.()}

    <div class="flex items-center border-l pl-2 ml-1 gap-1">
        {#if onedit}
            <button
                type="button"
                class="text-gray-400 hover:text-blue-500 transition-colors"
                onclick={onedit}
                title="Edit"
            >
                <Pencil size={12} />
            </button>
        {/if}
        {#if onunlink}
            <button
                type="button"
                class="text-gray-400 hover:text-red-500 transition-colors"
                onclick={onunlink}
                title="Unlink"
            >
                <X size={14} />
            </button>
        {/if}
    </div>
</div>
