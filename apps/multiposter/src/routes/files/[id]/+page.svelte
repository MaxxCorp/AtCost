<script lang="ts">
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import FileForm from "#lib/components/files/FileForm.svelte";
    import { readFile } from "./read.remote";
    import { updateFile } from "./update.remote";
    import { updateFileSchema } from "@ac/validations";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import { Folder, FileText, ExternalLink, Calendar, Megaphone } from "@lucide/svelte";

    const fileId = $derived(page.params.id || "");
    const fileQuery = $derived(readFile(fileId));
    const currentFile = $derived(fileQuery.current);
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl space-y-6">
    {#if fileQuery.loading && !currentFile}
        <LoadingSection message="Loading file details..." />
    {:else if fileQuery.error}
        <ErrorSection
            headline="Error"
            message={fileQuery.error instanceof Error ? fileQuery.error.message : "Failed to load file"}
            href="/files"
            button="Back to Files"
        />
    {:else if currentFile}
        <Breadcrumb feature="files" current={currentFile.name} />

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                    <Folder size={28} class="text-blue-600" />
                    {currentFile.name}
                </h1>
                {#if currentFile.folderPath}
                    <p class="text-xs font-mono text-gray-500 mt-1">
                        {currentFile.folderPath}
                    </p>
                {/if}
            </div>

            {#if currentFile.webUrl || currentFile.targetUrl}
                <a
                    href={currentFile.webUrl || currentFile.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold self-start sm:self-auto"
                >
                    <ExternalLink size={14} />
                    Open in SharePoint / OneDrive
                </a>
            {/if}
        </div>

        <FileForm
            remoteFunction={updateFile}
            validationSchema={updateFileSchema}
            isUpdating={true}
            initialData={currentFile}
            onSuccess={() => goto("/files")}
            onCancel={() => goto("/files")}
        />

        <!-- Linked Events & Announcements -->
        {#if (currentFile.linkedEvents && currentFile.linkedEvents.length > 0) || (currentFile.linkedAnnouncements && currentFile.linkedAnnouncements.length > 0)}
            <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3">
                <h2 class="text-sm font-bold text-gray-900">Linked Entities</h2>
                <div class="flex flex-wrap gap-2">
                    {#each currentFile.linkedEvents ?? [] as ev (ev.id)}
                        <a
                            href={`/events/${ev.id}`}
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                        >
                            <Calendar size={13} />
                            {ev.summary}
                        </a>
                    {/each}
                    {#each currentFile.linkedAnnouncements ?? [] as ann (ann.id)}
                        <a
                            href={`/announcements/${ann.id}`}
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                        >
                            <Megaphone size={13} />
                            {ann.title}
                        </a>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Followed Folder Children -->
        {#if currentFile.remoteChildren && currentFile.remoteChildren.length > 0}
            <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3">
                <h2 class="text-sm font-bold text-gray-900">
                    Followed Folder Contents ({currentFile.remoteChildren.length})
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {#each currentFile.remoteChildren as child (child.id)}
                        <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                            <div class="flex items-center gap-2 min-w-0">
                                {#if child.isFolder}
                                    <Folder size={14} class="text-amber-500 shrink-0" />
                                {:else}
                                    <FileText size={14} class="text-blue-600 shrink-0" />
                                {/if}
                                <span class="truncate font-medium text-gray-800">{child.name}</span>
                            </div>
                            {#if child.webUrl}
                                <a
                                    href={child.webUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="inline-flex items-center gap-1 text-blue-600 hover:underline shrink-0"
                                >
                                    Open <ExternalLink size={12} />
                                </a>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    {:else}
        <ErrorSection
            headline="File Not Found"
            message="The requested file or document could not be found."
            href="/files"
            button="Back to Files"
        />
    {/if}
</div>
