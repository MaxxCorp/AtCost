<script lang="ts">
    import { Plus } from "@lucide/svelte";
    import { Button } from "@ac/ui";

    interface Props {
        title: string;
        icon?: any; // Component type
        showSelector: boolean;
        showQuickCreate?: boolean; // Optional if quick create isn't supported
        onToggleSelector: () => void;
        onToggleQuickCreate?: () => void;
    }

    let {
        title,
        icon: Icon,
        showSelector,
        showQuickCreate,
        onToggleSelector,
        onToggleQuickCreate,
    }: Props = $props();
</script>

<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
    <h3
        class="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2"
    >
        {#if Icon}
            <Icon size={16} />
        {/if}
        {title}
    </h3>
    <div class="flex gap-2 flex-wrap">
        <Button
            type="button"
            variant="outline"
            size="sm"
            onclick={onToggleSelector}
        >
            {showSelector ? "Close Search" : "Link"}
        </Button>
        {#if onToggleQuickCreate}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={onToggleQuickCreate}
            >
                <Plus size={16} class="mr-1" /> Quick Create
            </Button>
        {/if}
    </div>
</div>
