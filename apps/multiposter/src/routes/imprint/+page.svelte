<script lang="ts">
    import { afterNavigate } from "$app/navigation";
	import { LoadingSection, ErrorSection } from "@ac/ui";
    import ContentBlockEditor from "#lib/components/cms/ContentBlockEditor.svelte";
    import { readContent } from "./read.remote";
    import { updateContent } from "./update.remote";
    import { createBlockFunction } from "./create.remote";
    import { linkBlockFunction } from "./link.remote";
    import { deleteBlockFunction } from "./delete.remote";
    import { listBlocksFunction } from "./list.remote";
    import { renameBlockFunction } from "./rename.remote";
    import * as m from "#lib/paraglide/messages.js";

    const contentQuery = readContent({});

    afterNavigate(({ from }) => {
        if (from) void contentQuery.refresh();
    });
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">{m.imprint_title()}</h1>

        {#if contentQuery.loading && !contentQuery.current}
            <LoadingSection />
        {:else if contentQuery.error}
            <ErrorSection
                headline={m.error_loading_imprint()}
                message={contentQuery.error instanceof Error ? contentQuery.error.message : String(contentQuery.error)}
            />
        {:else if contentQuery.current}
            <ContentBlockEditor
                slotName="main"
                currentResult={contentQuery.current}
                remoteRead={readContent}
                remoteUpdate={updateContent}
                remoteCreate={createBlockFunction}
                remoteLink={linkBlockFunction}
                remoteDelete={deleteBlockFunction}
                remoteList={listBlocksFunction}
                remoteRename={renameBlockFunction}
            />
        {/if}
    </div>
</div>
