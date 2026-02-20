<script lang="ts">
    interface Props {
        children?: any;
        emptyMessage?: string;
        showSelector?: boolean;
        showQuickCreate?: boolean;
        itemCount?: number;
    }

    let {
        children,
        emptyMessage = "No items associated.",
        showSelector = false,
        showQuickCreate = false,
        itemCount = 0,
    }: Props = $props();
</script>

{#if itemCount > 0}
    <div class="flex flex-wrap gap-2">
        {@render children?.()}
    </div>
{:else if !showSelector && !showQuickCreate}
    <p class="text-sm text-gray-500 italic">{emptyMessage}</p>
{/if}
