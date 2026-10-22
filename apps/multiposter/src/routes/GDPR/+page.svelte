<script lang="ts">
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

    let contentPromise = $state(readContent({}));
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h1 class="text-3xl font-bold">{m.gdpr_title()}</h1>
            <a
                href="/gdpr-self-service"
                class="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-xl border border-indigo-200 transition-all flex items-center gap-2"
            >
                <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                Selbstauskunft & Datenanonymisierung
            </a>
        </div>

        {#await contentPromise}
            <LoadingSection />
        {:then result}
            <ContentBlockEditor
                slotName="main"
                currentResult={result}
                remoteRead={readContent}
                remoteUpdate={updateContent}
                remoteCreate={createBlockFunction}
                remoteLink={linkBlockFunction}
                remoteDelete={deleteBlockFunction}
                remoteList={listBlocksFunction}
                remoteRename={renameBlockFunction}
            />
        {:catch error}
            <ErrorSection
                headline={m.error_loading_gdpr()}
                message={error.message}
            />
        {/await}
    </div>
</div>
