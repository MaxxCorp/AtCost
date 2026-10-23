<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { listFiles } from "./list.remote";
    import { deleteFiles } from "./[id]/delete.remote";
    import { getLibraryRootConfig } from "./library-root.remote";
    import { resolveShareLinkCommand } from "./associate.remote";
    import LibraryRootConfigPanel from "#lib/components/files/LibraryRootConfigPanel.svelte";
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import { page as pageState } from "$app/state";
    import { goto } from "$app/navigation";
    import type { FileItem } from "@ac/validations";
    import {
        LoadingSection,
        ErrorSection,
        Button,
        AsyncButton,
        BulkActionToolbar,
        initPageFromUrl,
        syncPageToUrl,
        recordActiveItem,
        activeItemAnchor,
    } from "@ac/ui";
    import {
        Folder,
        FileText,
        FileSpreadsheet,
        Presentation,
        Link2,
        ExternalLink,
        Pencil,
        Trash2,
        Plus,
        Search,
        ArrowUpDown,
        RefreshCw,
        Settings2,
        Calendar,
        Megaphone,
        HardDrive,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    let searchQuery = $state("");
    let activeTab = $state<"all" | "office_doc" | "file" | "link" | "archived">("all");
    let sortField = $state<"name" | "itemType" | "size" | "createdAt" | "updatedAt">("updatedAt");
    let sortOrder = $state<"asc" | "desc">("desc");
    let showLibraryRootConfig = $state(false);

    const page = $derived(initPageFromUrl(pageState.url));
    let limit = $state(50);

    function setPage(newPage: number) {
        syncPageToUrl("files", newPage, pageState.url, goto);
    }

    const filterState = $derived({
        page,
        limit,
        search: searchQuery.trim() || undefined,
        itemType:
            activeTab === "office_doc" || activeTab === "file" || activeTab === "link"
                ? activeTab
                : undefined,
        isArchived: activeTab === "archived" ? true : undefined,
        sortField,
        sortOrder,
    });

    let selectedIds = $state<string[]>([]);

    const filesQuery = $derived(listFiles(filterState));
    const result = $derived(filesQuery.current);
    const fileItems = $derived(result?.data ?? []);
    const total = $derived(result?.total ?? 0);
    const totalPages = $derived(Math.ceil(total / limit));

    const rootConfigQuery = getLibraryRootConfig();
    const activeRoot = $derived(rootConfigQuery.current);

    const rootSummaryLabel = $derived.by(() => {
        if (!activeRoot?.settings) return "Not Configured (Local DB fallback)";
        const s = activeRoot.settings;
        if (s.targetType === "teams_channel") {
            return `Teams: ${s.teamName || "Team"} / ${s.channelName || s.rootFolderPath || "Channel"}`;
        }
        if (s.targetType === "sharepoint_site") {
            return `SharePoint: ${s.siteName || s.driveName || "Document Library"}`;
        }
        return `OneDrive: ${s.userEmail || s.driveName || "User Drive"}`;
    });

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Delete ${selectedIds.length} selected file(s)?`)) return;
        try {
            await deleteFiles(selectedIds);
            toast.success(m.delete_successful?.() || "Deleted successfully");
            selectedIds = [];
            await filesQuery.refresh();
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete files");
        }
    }

    async function onDelete(item: FileItem, currentCount: number) {
        if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;
        try {
            await deleteFiles([item.id]);
            toast.success(`"${item.name}" deleted`);
            if (currentCount <= 1 && page > 1) {
                setPage(page - 1);
            } else {
                await filesQuery.refresh();
            }
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete file");
        }
    }

    async function handleRefreshLink(item: FileItem) {
        const url = item.targetUrl || item.webUrl;
        if (!url) return;
        try {
            await resolveShareLinkCommand({ url, fileId: item.id });
            await filesQuery.refresh();
            toast.success(`Refreshed link: ${item.name}`);
        } catch (e: any) {
            toast.error(e?.message || "Failed to refresh link");
        }
    }
</script>

<div class="container mx-auto px-4 py-6 max-w-7xl space-y-6">
    <Breadcrumb feature="files" />

    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="space-y-1.5">
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                <Folder size={28} class="text-blue-600" />
                {m.feature_files_title?.() || "Files & Documents"}
            </h1>
            <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>SharePoint, Teams & OneDrive document synchronization for Events and Announcements.</span>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium {activeRoot
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'}">
                    <HardDrive size={12} />
                    {rootSummaryLabel}
                    {#if activeRoot?.settings?.webUrl}
                        <a
                            href={activeRoot.settings.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex items-center gap-0.5 text-blue-600 hover:underline ml-1"
                        >
                            Open <ExternalLink size={11} />
                        </a>
                    {/if}
                </span>
            </div>
        </div>

        <div class="flex items-center gap-2.5 self-start lg:self-auto">
            <Button
                type="button"
                variant="outline"
                onclick={() => (showLibraryRootConfig = !showLibraryRootConfig)}
                class="flex items-center gap-2"
            >
                <Settings2 size={16} />
                Configure Library Root
            </Button>

            <Button
                href="/files/new"
                class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
                <Plus size={16} />
                New File / Link
            </Button>
        </div>
    </div>

    {#if showLibraryRootConfig}
        <LibraryRootConfigPanel onSaved={() => (showLibraryRootConfig = false)} />
    {/if}

    <!-- Filters & Search Bar -->
    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto flex-1">
            <div class="relative w-full sm:w-72">
                <Search size={16} class="absolute left-3 top-3 text-gray-400" />
                <input
                    type="text"
                    bind:value={searchQuery}
                    oninput={() => setPage(1)}
                    placeholder="Search files, folders, paths..."
                    class="w-full pl-9 pr-3.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <!-- Filter Tabs -->
            <div class="flex flex-wrap rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-xs self-start">
                <button
                    type="button"
                    onclick={() => { activeTab = "all"; setPage(1); }}
                    class="px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer {activeTab === 'all' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-900'}"
                >
                    All
                </button>
                <button
                    type="button"
                    onclick={() => { activeTab = "office_doc"; setPage(1); }}
                    class="px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer {activeTab === 'office_doc' ? 'bg-white shadow-xs text-blue-700' : 'text-gray-500 hover:text-gray-900'}"
                >
                    Office Docs
                </button>
                <button
                    type="button"
                    onclick={() => { activeTab = "file"; setPage(1); }}
                    class="px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer {activeTab === 'file' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-900'}"
                >
                    Files
                </button>
                <button
                    type="button"
                    onclick={() => { activeTab = "link"; setPage(1); }}
                    class="px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer {activeTab === 'link' ? 'bg-white shadow-xs text-indigo-700' : 'text-gray-500 hover:text-gray-900'}"
                >
                    Links & Shortcuts
                </button>
                <button
                    type="button"
                    onclick={() => { activeTab = "archived"; setPage(1); }}
                    class="px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer {activeTab === 'archived' ? 'bg-white shadow-xs text-amber-700' : 'text-gray-500 hover:text-gray-900'}"
                >
                    Archived
                </button>
            </div>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto justify-end">
            <span class="text-xs text-gray-500 flex items-center gap-1">
                <ArrowUpDown size={14} /> Sort:
            </span>
            <select
                bind:value={sortField}
                onchange={() => setPage(1)}
                class="px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
                <option value="updatedAt">Updated Date</option>
                <option value="createdAt">Created Date</option>
                <option value="name">Name</option>
                <option value="itemType">Type</option>
                <option value="size">Size</option>
            </select>
            <button
                type="button"
                onclick={() => {
                    sortOrder = sortOrder === "asc" ? "desc" : "asc";
                    setPage(1);
                }}
                class="px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold bg-white hover:bg-gray-50 cursor-pointer"
            >
                {sortOrder.toUpperCase()}
            </button>
            <button
                type="button"
                onclick={() => void filesQuery.refresh()}
                title={m.refresh?.() || "Refresh"}
                class="p-2 rounded-lg border border-gray-300 text-xs bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
            >
                <RefreshCw size={13} class={filesQuery.loading ? "animate-spin" : ""} />
            </button>
        </div>
    </div>

    <!-- Content -->
    {#if filesQuery.loading && !result}
        <LoadingSection message="Loading files & documents..." />
    {:else if filesQuery.error}
        <ErrorSection
            headline="Error"
            message={filesQuery.error instanceof Error ? filesQuery.error.message : "Failed to load files"}
            href="/files"
            button="Try Again"
        />
    {:else if !result?.data || result.data.length === 0}
        <div class="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-xs space-y-3">
            <Folder size={40} class="mx-auto text-gray-300" />
            <h3 class="text-base font-bold text-gray-900">No files or documents found</h3>
            <p class="text-sm text-gray-500 max-w-md mx-auto">
                Create a Word, Excel, PowerPoint, or Markdown document, upload a file, or link a SharePoint/OneDrive folder.
            </p>
            <Button href="/files/new" class="bg-blue-600 hover:bg-blue-700 text-white mt-2">
                <Plus size={16} class="mr-1.5" />
                New File / Link
            </Button>
        </div>
    {:else}
        <div class={[filesQuery.loading && "opacity-60 transition-opacity"]}>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {#each result.data as item (item.id)}
                    <div
                        id="item-{item.id}"
                        use:activeItemAnchor={{ feature: "files", id: item.id }}
                        class="bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between space-y-4 {selectedIds.includes(item.id)
                            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/10'
                            : 'border-gray-100 shadow-xs hover:shadow-md'}"
                    >
                        <div class="space-y-3">
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex items-start gap-2.5 min-w-0">
                                    <input
                                        type="checkbox"
                                        bind:group={selectedIds}
                                        value={item.id}
                                        class="h-4.5 w-4.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-1 shrink-0"
                                    />
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-1.5">
                                            {#if item.itemType === "folder" || item.targetType === "folder"}
                                                <Folder size={16} class="text-amber-500 shrink-0" />
                                            {:else if item.isShortcut || item.itemType === "link"}
                                                <Link2 size={16} class="text-indigo-600 shrink-0" />
                                            {:else if item.extension === "xlsx"}
                                                <FileSpreadsheet size={16} class="text-emerald-600 shrink-0" />
                                            {:else if item.extension === "pptx"}
                                                <Presentation size={16} class="text-orange-600 shrink-0" />
                                            {:else}
                                                <FileText size={16} class="text-blue-600 shrink-0" />
                                            {/if}
                                            <h3 class="text-base font-bold text-gray-900 truncate" title={item.name}>
                                                {item.name}
                                            </h3>
                                        </div>
                                        {#if item.folderPath}
                                            <p class="text-[11px] font-mono text-gray-400 truncate mt-0.5" title={item.folderPath}>
                                                {item.folderPath}
                                            </p>
                                        {/if}
                                    </div>
                                </div>

                                <div class="flex flex-col items-end gap-1 shrink-0">
                                    {#if item.isShortcut}
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                                            Shortcut
                                        </span>
                                    {/if}
                                    {#if item.isArchived}
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                                            Archived
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            {#if item.description}
                                <p class="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                            {/if}

                            <!-- Linked Events & Announcements -->
                            {#if (item.linkedEvents && item.linkedEvents.length > 0) || (item.linkedAnnouncements && item.linkedAnnouncements.length > 0)}
                                <div class="flex flex-wrap gap-1.5 pt-1">
                                    {#each item.linkedEvents ?? [] as ev (ev.id)}
                                        <a
                                            href={`/events/${ev.id}`}
                                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                                        >
                                            <Calendar size={11} />
                                            <span class="truncate max-w-40">{ev.summary}</span>
                                        </a>
                                    {/each}
                                    {#each item.linkedAnnouncements ?? [] as ann (ann.id)}
                                        <a
                                            href={`/announcements/${ann.id}`}
                                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 hover:bg-purple-100"
                                        >
                                            <Megaphone size={11} />
                                            <span class="truncate max-w-40">{ann.title}</span>
                                        </a>
                                    {/each}
                                </div>
                            {/if}

                            <!-- Remote Children Preview for Followed Folder Links -->
                            {#if item.remoteChildren && item.remoteChildren.length > 0}
                                <div class="p-2.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                                        Followed Folder ({item.remoteChildren.length} items)
                                    </span>
                                    {#each item.remoteChildren.slice(0, 4) as child (child.id)}
                                        <div class="flex items-center justify-between text-xs text-gray-700">
                                            <span class="truncate">{child.name}</span>
                                            {#if child.webUrl}
                                                <a
                                                    href={child.webUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="text-blue-600 hover:underline text-[11px] shrink-0"
                                                >
                                                    Open
                                                </a>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>

                        <div class="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5">
                                {#if item.webUrl || item.targetUrl}
                                    <a
                                        href={item.webUrl || item.targetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition-colors"
                                    >
                                        <ExternalLink size={12} />
                                        Open in SharePoint/OneDrive
                                    </a>
                                {/if}
                                {#if item.isShortcut}
                                    <AsyncButton
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onclick={() => handleRefreshLink(item)}
                                        class="h-7 px-2 text-xs text-indigo-600"
                                    >
                                        <RefreshCw size={12} />
                                    </AsyncButton>
                                {/if}
                            </div>

                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    href={`/files/${item.id}`}
                                    onclick={() => recordActiveItem("files", item.id)}
                                    class="h-8 px-2.5 text-xs font-medium flex items-center gap-1"
                                >
                                    <Pencil size={13} /> Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => onDelete(item, result.data.length)}
                                    disabled={Boolean(deleteFiles.pending)}
                                    class="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            {#if totalPages > 1}
                <div class="p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs text-gray-500 shadow-2xs mt-4">
                    <span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}</span>
                    <div class="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onclick={() => setPage(page - 1)}
                            class="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-50 hover:bg-gray-50 cursor-pointer"
                        >
                            Prev
                        </button>
                        <span>Page {page} of {totalPages}</span>
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onclick={() => setPage(page + 1)}
                            class="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-50 hover:bg-gray-50 cursor-pointer"
                        >
                            Next
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    {/if}

    <BulkActionToolbar
        {selectedIds}
        totalCount={fileItems.length}
        onSelectAll={() => (selectedIds = fileItems.map((f) => f.id))}
        onDeselectAll={() => (selectedIds = [])}
        onDelete={handleBulkDelete}
        deleteLabel={m.delete ? m.delete() : "Delete"}
        selectAllLabel={m.select_all ? m.select_all() : `Select All (${fileItems.length})`}
        deselectAllLabel={m.deselect_all ? m.deselect_all() : "Deselect All"}
    />
</div>
