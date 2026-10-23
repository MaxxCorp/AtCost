<script lang="ts">
    import { EntityManager, AsyncButton } from "@ac/ui";
    import * as m from "#lib/paraglide/messages.js";
    import { listFiles } from "../../../routes/files/list.remote";
    import {
        addFileAssociation,
        removeFileAssociation,
        fetchEntityFiles,
        getEntityFolderInfo,
        syncEntityFolderCommand,
        toggleEntityFolderArchive,
        resolveShareLinkCommand,
    } from "../../../routes/files/associate.remote";
    import { createFile } from "../../../routes/files/new/create.remote";
    import { updateFile } from "../../../routes/files/[id]/update.remote";
    import { readFile } from "../../../routes/files/[id]/read.remote";
    import { deleteFiles } from "../../../routes/files/[id]/delete.remote";
    import { createFileSchema, updateFileSchema, type FileItem } from "@ac/validations";
    import FileForm from "./FileForm.svelte";
    import { toast } from "svelte-sonner";
    import {
        Folder,
        FileText,
        FileSpreadsheet,
        Presentation,
        Link2,
        ExternalLink,
        RefreshCw,
        Archive,
        ArchiveRestore,
    } from "@lucide/svelte";

    let {
        type,
        entityId = undefined,
        initialItems = [],
        onchange = undefined,
    }: {
        type: "event" | "announcement";
        entityId?: string;
        initialItems?: FileItem[];
        onchange?: (ids: string[], items: FileItem[]) => void;
    } = $props();

    const folderInfoQuery = $derived(entityId ? getEntityFolderInfo({ type, entityId }) : null);
    const folderInfo = $derived(folderInfoQuery?.current ?? null);

    async function handleSyncFolder() {
        if (!entityId) return;
        try {
            await syncEntityFolderCommand({ type, entityId, forceEnsure: true });
            await folderInfoQuery?.refresh();
            toast.success("Folder synced with SharePoint / OneDrive");
        } catch (err: any) {
            toast.error(err?.message || "Failed to sync folder");
        }
    }

    async function handleToggleArchive() {
        if (!entityId || !folderInfo) return;
        try {
            const nextArchived = !folderInfo.isArchived;
            await toggleEntityFolderArchive({
                type,
                entityId,
                isArchived: nextArchived,
            });
            await folderInfoQuery?.refresh();
            toast.success(nextArchived ? "Moved folder to Archive" : "Restored folder from Archive");
        } catch (err: any) {
            toast.error(err?.message || "Failed to toggle folder archive status");
        }
    }

    async function handleFollowShortcut(item: FileItem) {
        const url = item.targetUrl || item.webUrl;
        if (!url) return;
        try {
            await resolveShareLinkCommand({ url, fileId: item.id });
            if (entityId) {
                await fetchEntityFiles({ type, entityId }).refresh();
            }
            void listFiles().refresh();
            toast.success(`Refreshed link target for ${item.name}`);
        } catch (err: any) {
            toast.error(err?.message || "Failed to refresh link");
        }
    }

    function formatBytes(bytes?: number | null) {
        if (!bytes || bytes <= 0) return "";
        const units = ["B", "KB", "MB", "GB"];
        let i = 0;
        let val = bytes;
        while (val >= 1024 && i < units.length - 1) {
            val /= 1024;
            i++;
        }
        return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
    }
</script>

<div class="space-y-3">
    {#if entityId && folderInfo}
        <div class="px-3.5 py-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2 min-w-0">
                <Folder size={16} class="text-blue-600 shrink-0" />
                <span class="font-mono text-gray-800 truncate" title={folderInfo.folderPath}>
                    {folderInfo.folderPath}
                </span>
                {#if folderInfo.isArchived}
                    <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px]">
                        Archive
                    </span>
                {/if}
            </div>

            {#if folderInfo.webUrl}
                <a
                    href={folderInfo.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline shrink-0"
                >
                    Open Folder <ExternalLink size={12} />
                </a>
            {/if}
        </div>
    {/if}

    <EntityManager
        {m}
        title="Files & Documents"
        icon={Folder}
        mode="embedded"
        {type}
        {entityId}
        {initialItems}
        {onchange}
        listItemsRemote={listFiles as any}
        fetchAssociationsRemote={fetchEntityFiles as any}
        addAssociationRemote={async (p: any) => addFileAssociation({ ...p, fileId: p.itemId } as any)}
        removeAssociationRemote={async (p: any) => removeFileAssociation({ ...p, fileId: p.itemId } as any)}
        deleteItemRemote={deleteFiles}
        createRemote={createFile}
        createSchema={createFileSchema}
        updateRemote={updateFile}
        updateSchema={updateFileSchema}
        readItemRemote={readFile}
        searchPredicate={(item: FileItem, q: string) => {
            const lower = q.toLowerCase();
            return (
                Boolean(item.name?.toLowerCase().includes(lower)) ||
                Boolean(item.description?.toLowerCase().includes(lower)) ||
                Boolean(item.folderPath?.toLowerCase().includes(lower))
            );
        }}
    >
        {#snippet toolbarActions()}
            {#if entityId}
                <div class="flex items-center gap-1.5">
                    <AsyncButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onclick={handleSyncFolder}
                        class="h-8 px-2.5 text-xs font-medium"
                    >
                        <RefreshCw size={13} class="mr-1" />
                        Sync Folder
                    </AsyncButton>

                    {#if folderInfo}
                        <AsyncButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onclick={handleToggleArchive}
                            class="h-8 px-2.5 text-xs font-medium"
                        >
                            {#if folderInfo.isArchived}
                                <ArchiveRestore size={13} class="mr-1 text-emerald-600" />
                                Unarchive Folder
                            {:else}
                                <Archive size={13} class="mr-1 text-amber-600" />
                                Archive Folder
                            {/if}
                        </AsyncButton>
                    {/if}
                </div>
            {/if}
        {/snippet}

        {#snippet renderItemLabel(item: FileItem)}
            <div class="flex items-center gap-2 flex-wrap">
                {#if item.itemType === "folder" || item.targetType === "folder"}
                    <Folder size={15} class="text-amber-500 shrink-0" />
                {:else if item.isShortcut || item.itemType === "link" || item.extension === "url"}
                    <Link2 size={15} class="text-indigo-600 shrink-0" />
                {:else if item.extension === "xlsx"}
                    <FileSpreadsheet size={15} class="text-emerald-600 shrink-0" />
                {:else if item.extension === "pptx"}
                    <Presentation size={15} class="text-orange-600 shrink-0" />
                {:else}
                    <FileText size={15} class="text-blue-600 shrink-0" />
                {/if}

                <span class="font-semibold text-gray-900">{item.name}</span>

                {#if item.isShortcut}
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Shortcut / Link
                    </span>
                {/if}
                {#if item.isArchived}
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Archived
                    </span>
                {/if}
            </div>
        {/snippet}

        {#snippet renderItemDetail(item: FileItem)}
            <div class="flex items-center gap-2 text-xs text-gray-500">
                {#if item.folderPath}
                    <span class="font-mono truncate max-w-xs">{item.folderPath}</span>
                {/if}
                {#if item.size && item.size > 0}
                    <span>• {formatBytes(item.size)}</span>
                {/if}
            </div>
        {/snippet}

        {#snippet participationSnippet(item: FileItem)}
            <div class="flex items-center gap-1.5 shrink-0">
                {#if item.webUrl || item.targetUrl}
                    <a
                        href={item.webUrl || item.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onclick={(e) => e.stopPropagation()}
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-medium transition-colors"
                    >
                        <ExternalLink size={12} />
                        Open in SharePoint / OneDrive
                    </a>
                {/if}

                {#if item.isShortcut}
                    <AsyncButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onclick={(e: MouseEvent) => {
                            e.stopPropagation();
                            return handleFollowShortcut(item);
                        }}
                        class="h-7 px-2 text-xs text-indigo-700 hover:bg-indigo-50"
                    >
                        <RefreshCw size={12} class="mr-1" />
                        Follow / Refresh Link
                    </AsyncButton>
                {/if}
            </div>
        {/snippet}

        {#snippet renderSubItems(item: FileItem)}
            {#if item.remoteChildren && item.remoteChildren.length > 0}
                <div class="mt-2 pl-4 border-l-2 border-indigo-100 space-y-1">
                    <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Followed Folder Contents ({item.remoteChildren.length})
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {#each item.remoteChildren as child (child.id)}
                            <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs">
                                <div class="flex items-center gap-1.5 min-w-0">
                                    {#if child.isFolder}
                                        <Folder size={13} class="text-amber-500 shrink-0" />
                                    {:else}
                                        <FileText size={13} class="text-blue-600 shrink-0" />
                                    {/if}
                                    <span class="truncate text-gray-800">{child.name}</span>
                                </div>
                                {#if child.webUrl}
                                    <a
                                        href={child.webUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="text-blue-600 hover:underline inline-flex items-center gap-0.5 shrink-0"
                                    >
                                        Open <ExternalLink size={11} />
                                    </a>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        {/snippet}

        {#snippet renderForm({
            remoteFunction: rfFile,
            schema: fileSchema,
            id: fileId,
            initialData: fileFormData = null,
            onSuccess: fileSuccess,
            onCancel: fileCancel,
        }: any)}
            <FileForm
                remoteFunction={rfFile}
                validationSchema={fileSchema}
                isUpdating={!!fileId}
                initialData={fileFormData}
                entityType={type}
                {entityId}
                onSuccess={fileSuccess}
                onCancel={fileCancel}
            />
        {/snippet}
    </EntityManager>
</div>
