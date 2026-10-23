<script lang="ts">
    import { untrack } from "svelte";
    import type { FileItem } from "@ac/validations";
    import { resolveShareLinkCommand } from "../../../routes/files/associate.remote";
    import { AsyncButton, Button, translateIssue, useFormValidationFeedback } from "@ac/ui";
    import * as m from "#lib/paraglide/messages.js";
    import { toast } from "svelte-sonner";
    import {
        FileText,
        FileSpreadsheet,
        Presentation,
        Upload,
        Link2,
        Folder,
        ExternalLink,
        Sparkles,
        CheckCircle2,
    } from "@lucide/svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        entityType = undefined,
        entityId = undefined,
        onSuccess = undefined,
        onCancel = undefined,
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: FileItem | null;
        entityType?: "event" | "announcement";
        entityId?: string;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
    } = $props();

    // svelte-ignore state_referenced_locally
    const rf = (remoteFunction as any).preflight(validationSchema);

    useFormValidationFeedback(() => rf, {
        message: () => m.please_fix_validation?.() || "Please fix validation errors",
    });

    let creationMode = $state<"office_doc" | "upload" | "link">("office_doc");
    let officeDocType = $state<"docx" | "xlsx" | "pptx" | "txt" | "md">("docx");
    let openInOfficeOnlineAfterCreate = $state(true);
    let createShortcutInFolder = $state(true);

    let fileContentBase64 = $state<string | undefined>(undefined);
    let fileMimeType = $state<string | undefined>(undefined);
    let fileSize = $state<number | undefined>(undefined);
    let selectedLocalFileName = $state<string>("");

    let isArchived = $state<boolean>(untrack(() => Boolean(initialData?.isArchived)));
    let resolvedLinkInfo = $state<{
        name: string;
        webUrl: string;
        targetType: "file" | "folder" | "external_url";
        childrenCount: number;
    } | null>(null);

    function handleFileSelect(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const f = input.files?.[0];
        if (!f) return;

        selectedLocalFileName = f.name;
        fileMimeType = f.type || "application/octet-stream";
        fileSize = f.size;

        const currentName = rf.fields.name?.value?.() || "";
        if (!currentName.trim()) {
            rf.fields.name?.set?.(f.name);
        }

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                fileContentBase64 = reader.result;
            }
        };
        reader.readAsDataURL(f);
    }

    async function handleResolveShareLink() {
        const urlValue = (rf.fields.targetUrl?.value?.() || initialData?.targetUrl || "").trim();
        if (!urlValue) {
            toast.error("Please enter a SharePoint or OneDrive URL first");
            return;
        }
        try {
            const resolved = await resolveShareLinkCommand({
                url: urlValue,
                fileId: isUpdating && initialData?.id ? initialData.id : undefined,
            });
            if (!resolved) {
                toast.error("Could not resolve the link via Microsoft Graph");
                return;
            }
            resolvedLinkInfo = {
                name: resolved.name,
                webUrl: resolved.webUrl,
                targetType: resolved.targetType,
                childrenCount: resolved.children?.length ?? 0,
            };
            const currentName = rf.fields.name?.value?.() || "";
            if (!currentName.trim() && resolved.name) {
                rf.fields.name?.set?.(resolved.name);
            }
            toast.success(`Resolved ${resolved.targetType}: ${resolved.name}`);
        } catch (err: any) {
            toast.error(err?.message || "Failed to resolve link");
        }
    }

    function formatBytes(bytes?: number) {
        if (!bytes || bytes <= 0) return "0 B";
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

<form
    {...rf.enhance(async ({ submit }: any) => {
        try {
            await submit();
            const res = rf.result;
            if (res?.success === false) {
                toast.error(res?.error?.message || m.something_went_wrong?.() || "Failed to save file");
                return;
            }
            toast.success(m.successfully_saved?.() || "File saved successfully");
            if (
                !isUpdating &&
                creationMode === "office_doc" &&
                openInOfficeOnlineAfterCreate &&
                res?.data?.webUrl
            ) {
                window.open(res.data.webUrl, "_blank", "noopener,noreferrer");
            }
            onSuccess?.(res);
        } catch (err: any) {
            toast.error(err?.message || m.something_went_wrong?.() || "Failed to save file");
        }
    })}
    class="space-y-5 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs"
>
    {#if isUpdating && initialData?.id}
        <input {...rf.fields.id.as("hidden", initialData.id)} />
    {/if}

    {#if entityType}
        <input {...rf.fields.entityType.as("hidden", entityType)} />
    {/if}

    {#if entityId}
        <input {...rf.fields.entityId.as("hidden", entityId)} />
    {/if}

    {#if !isUpdating}
        <input {...rf.fields.creationMode.as("hidden", creationMode)} />

        <!-- Creation Mode Selector -->
        <div class="space-y-2">
            <span class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Creation Mode
            </span>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                    type="button"
                    onclick={() => (creationMode = "office_doc")}
                    class="flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer {creationMode === 'office_doc'
                        ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'}"
                >
                    <Sparkles size={18} class={creationMode === "office_doc" ? "text-blue-600" : "text-gray-400"} />
                    <div>
                        <div class="text-sm font-semibold">New Office / Text Doc</div>
                        <div class="text-[11px] text-gray-500">Create directly in SharePoint/Teams</div>
                    </div>
                </button>

                <button
                    type="button"
                    onclick={() => (creationMode = "upload")}
                    class="flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer {creationMode === 'upload'
                        ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'}"
                >
                    <Upload size={18} class={creationMode === "upload" ? "text-blue-600" : "text-gray-400"} />
                    <div>
                        <div class="text-sm font-semibold">Upload File</div>
                        <div class="text-[11px] text-gray-500">Upload from your device</div>
                    </div>
                </button>

                <button
                    type="button"
                    onclick={() => (creationMode = "link")}
                    class="flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer {creationMode === 'link'
                        ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'}"
                >
                    <Link2 size={18} class={creationMode === "link" ? "text-blue-600" : "text-gray-400"} />
                    <div>
                        <div class="text-sm font-semibold">SharePoint / OneDrive Link</div>
                        <div class="text-[11px] text-gray-500">Follow external file or folder</div>
                    </div>
                </button>
            </div>
        </div>

        {#if creationMode === "office_doc"}
            <input {...rf.fields.officeDocType.as("hidden", officeDocType)} />

            <div class="space-y-2 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80">
                <span class="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Document Format
                </span>
                <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <button
                        type="button"
                        onclick={() => (officeDocType = "docx")}
                        class="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors {officeDocType === 'docx'
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                    >
                        <FileText size={15} />
                        Word (.docx)
                    </button>
                    <button
                        type="button"
                        onclick={() => (officeDocType = "xlsx")}
                        class="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors {officeDocType === 'xlsx'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                    >
                        <FileSpreadsheet size={15} />
                        Excel (.xlsx)
                    </button>
                    <button
                        type="button"
                        onclick={() => (officeDocType = "pptx")}
                        class="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors {officeDocType === 'pptx'
                            ? 'border-orange-600 bg-orange-600 text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                    >
                        <Presentation size={15} />
                        PowerPoint (.pptx)
                    </button>
                    <button
                        type="button"
                        onclick={() => (officeDocType = "txt")}
                        class="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors {officeDocType === 'txt'
                            ? 'border-gray-800 bg-gray-800 text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                    >
                        <FileText size={15} />
                        Text (.txt)
                    </button>
                    <button
                        type="button"
                        onclick={() => (officeDocType = "md")}
                        class="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors {officeDocType === 'md'
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                    >
                        <FileText size={15} />
                        Markdown (.md)
                    </button>
                </div>

                <label class="flex items-center gap-2 pt-2 text-xs text-gray-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={openInOfficeOnlineAfterCreate}
                        onchange={(e) => (openInOfficeOnlineAfterCreate = (e.currentTarget as HTMLInputElement).checked)}
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Open immediately in Microsoft Office Online / SharePoint after creation</span>
                </label>
            </div>
        {:else if creationMode === "upload"}
            {#if fileContentBase64 !== undefined && fileContentBase64 !== null}
                <input {...rf.fields.fileContentBase64.as("hidden", fileContentBase64)} />
            {/if}
            {#if fileMimeType !== undefined && fileMimeType !== null}
                <input {...rf.fields.fileMimeType.as("hidden", fileMimeType)} />
            {/if}
            {#if fileSize !== undefined && fileSize !== null}
                <input {...rf.fields.fileSize.as("hidden", String(fileSize))} />
            {/if}

            <div class="p-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/60 text-center space-y-2">
                <Upload size={24} class="mx-auto text-blue-600" />
                <div class="text-sm font-medium text-gray-800">
                    {selectedLocalFileName ? selectedLocalFileName : "Choose a file to upload to the Library"}
                </div>
                {#if fileSize !== undefined}
                    <div class="text-xs text-gray-500">
                        {formatBytes(fileSize)} • {fileMimeType}
                    </div>
                {/if}
                <div class="pt-1">
                    <label class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer shadow-2xs">
                        <Upload size={13} />
                        Browse File...
                        <input type="file" onchange={handleFileSelect} class="hidden" />
                    </label>
                </div>
            </div>
        {:else if creationMode === "link"}
            <input {...rf.fields.createShortcutInFolder.as("hidden", String(createShortcutInFolder))} />

            <div class="space-y-3 p-4 rounded-xl bg-blue-50/40 border border-blue-200/70">
                <div>
                    <label for="file-target-url" class="block text-xs font-semibold text-gray-700 mb-1">
                        SharePoint / OneDrive / External URL
                    </label>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <input
                            id="file-target-url"
                            {...rf.fields.targetUrl.as("text", initialData?.targetUrl ?? "")}
                            placeholder="https://tenant.sharepoint.com/..."
                            class="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                        <AsyncButton
                            type="button"
                            variant="outline"
                            onclick={handleResolveShareLink}
                            class="shrink-0 text-xs font-medium"
                        >
                            <Link2 size={14} class="mr-1.5" />
                            Resolve SharePoint / OneDrive Link
                        </AsyncButton>
                    </div>
                </div>

                {#if resolvedLinkInfo}
                    <div class="p-3 rounded-lg bg-white border border-emerald-200 flex items-center justify-between gap-3 text-xs">
                        <div class="flex items-center gap-2">
                            <CheckCircle2 size={16} class="text-emerald-600 shrink-0" />
                            <div>
                                <div class="font-semibold text-gray-900 flex items-center gap-1.5">
                                    {#if resolvedLinkInfo.targetType === "folder"}
                                        <Folder size={13} class="text-amber-500" />
                                    {:else}
                                        <FileText size={13} class="text-blue-600" />
                                    {/if}
                                    {resolvedLinkInfo.name}
                                    <span class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase text-[10px]">
                                        {resolvedLinkInfo.targetType}
                                    </span>
                                </div>
                                {#if resolvedLinkInfo.targetType === "folder"}
                                    <div class="text-gray-500">
                                        {resolvedLinkInfo.childrenCount} item{resolvedLinkInfo.childrenCount === 1 ? "" : "s"} found inside folder
                                    </div>
                                {/if}
                            </div>
                        </div>
                        {#if resolvedLinkInfo.webUrl}
                            <a
                                href={resolvedLinkInfo.webUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium shrink-0"
                            >
                                Open <ExternalLink size={12} />
                            </a>
                        {/if}
                    </div>
                {/if}

                <label class="flex items-center gap-2 text-xs text-gray-700 cursor-pointer pt-1">
                    <input
                        type="checkbox"
                        checked={createShortcutInFolder}
                        onchange={(e) => (createShortcutInFolder = (e.currentTarget as HTMLInputElement).checked)}
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Also create a .url shortcut inside the entity's SharePoint/Teams folder</span>
                </label>
            </div>
        {/if}
    {:else}
        {#if initialData?.isShortcut}
            <div class="space-y-2">
                <label for="edit-target-url" class="block text-sm font-medium text-gray-700">
                    Target Link URL
                </label>
                <div class="flex gap-2">
                    <input
                        id="edit-target-url"
                        {...rf.fields.targetUrl.as("text", initialData?.targetUrl ?? "")}
                        placeholder="https://tenant.sharepoint.com/..."
                        class="flex-1 px-3.5 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <AsyncButton
                        type="button"
                        variant="outline"
                        onclick={handleResolveShareLink}
                        class="text-xs"
                    >
                        <Link2 size={14} class="mr-1.5" />
                        Refresh Link
                    </AsyncButton>
                </div>
            </div>
        {/if}

        <input {...rf.fields.isArchived.as("hidden", String(isArchived))} />
        <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
                type="checkbox"
                checked={isArchived}
                onchange={(e) => (isArchived = (e.currentTarget as HTMLInputElement).checked)}
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Archived</span>
        </label>
    {/if}

    <!-- File Name -->
    <div>
        <label for="file-name-input" class="block text-sm font-medium text-gray-700 mb-1">
            {m.name?.() || "File / Document Name"} *
        </label>
        <input
            id="file-name-input"
            {...rf.fields.name.as("text", initialData?.name ?? "")}
            placeholder={creationMode === "office_doc" ? `Meeting Notes.${officeDocType}` : "Document name"}
            class="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        />
        {#each rf.fields.name.issues() ?? [] as issue (issue.message)}
            <p class="mt-1 text-xs text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </div>

    <!-- Description -->
    <div>
        <label for="file-description-input" class="block text-sm font-medium text-gray-700 mb-1">
            {m.description?.() || "Description"} ({m.optional?.() || "optional"})
        </label>
        <input
            id="file-description-input"
            {...rf.fields.description.as("text", initialData?.description ?? "")}
            placeholder="Optional notes or context for this file..."
            class="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        />
        {#each rf.fields.description?.issues?.() ?? [] as issue (issue.message)}
            <p class="mt-1 text-xs text-red-600">{translateIssue(issue.message, m)}</p>
        {/each}
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
        {#if onCancel}
            <Button type="button" variant="outline" onclick={onCancel}>
                {m.cancel?.() || "Cancel"}
            </Button>
        {/if}
        <AsyncButton type="submit" loading={Boolean(rf.pending)} class="bg-blue-600 hover:bg-blue-700 text-white">
            {isUpdating ? (m.save_changes?.() || "Save Changes") : (m.create?.() || "Create File")}
        </AsyncButton>
    </div>
</form>
