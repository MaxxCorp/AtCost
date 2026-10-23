<script lang="ts">
    import {
        getLibraryRootConfig,
        saveLibraryRootConfig,
        listStorageTeams,
        listStorageTeamChannels,
        resolveStorageTeamChannelFolder,
        listStorageSharePointSites,
        listStorageSiteDrives,
        resolveStorageUserDrive,
    } from "../../../routes/files/library-root.remote";
    import { saveLibraryRootConfigSchema, type LibraryRootSettings } from "@ac/validations";
    import { AsyncButton, translateIssue, useFormValidationFeedback } from "@ac/ui";
    import * as m from "#lib/paraglide/messages.js";
    import { toast } from "svelte-sonner";
    import {
        Users,
        Globe,
        AlertTriangle,
        CheckCircle2,
        ExternalLink,
        RefreshCw,
        FolderTree,
        HardDrive,
    } from "@lucide/svelte";

    let {
        onSaved = undefined,
    }: {
        onSaved?: () => void;
    } = $props();

    const configQuery = getLibraryRootConfig();
    const activeConfig = $derived(configQuery.current);
    const savedSettings = $derived<Partial<LibraryRootSettings>>(activeConfig?.settings ?? {});

    const rf = saveLibraryRootConfig.preflight(saveLibraryRootConfigSchema);
    useFormValidationFeedback(() => rf, {
        message: () => m.please_fix_validation?.() || "Please fix validation errors",
    });

    // Local overrides (fallback to savedSettings when null/undefined so no $effect is needed)
    let targetTypeOverride = $state<"teams_channel" | "sharepoint_site" | "user_onedrive" | null>(null);
    let authModeOverride = $state<"auto" | "app" | "user" | null>(null);

    let selectedTeamIdOverride = $state<string | null>(null);
    let selectedTeamNameOverride = $state<string | null>(null);
    let selectedChannelIdOverride = $state<string | null>(null);
    let selectedChannelNameOverride = $state<string | null>(null);

    let selectedSiteIdOverride = $state<string | null>(null);
    let selectedSiteNameOverride = $state<string | null>(null);

    let driveIdOverride = $state<string | null>(null);
    let driveNameOverride = $state<string | null>(null);
    let rootFolderIdOverride = $state<string | null>(null);
    let rootFolderPathOverride = $state<string | null>(null);
    let webUrlOverride = $state<string | null>(null);
    let userEmailOverride = $state<string | null>(null);

    let eventsFolderNameOverride = $state<string | null>(null);
    let announcementsFolderNameOverride = $state<string | null>(null);
    let archiveFolderNameOverride = $state<string | null>(null);
    let autoArchiveOverride = $state<boolean | null>(null);

    const targetType = $derived(targetTypeOverride ?? savedSettings.targetType ?? "teams_channel");
    const authMode = $derived(authModeOverride ?? savedSettings.authMode ?? "auto");

    const selectedTeamId = $derived(selectedTeamIdOverride ?? savedSettings.teamId ?? "");
    const selectedTeamName = $derived(selectedTeamNameOverride ?? savedSettings.teamName ?? "");
    const selectedChannelId = $derived(selectedChannelIdOverride ?? savedSettings.channelId ?? "");
    const selectedChannelName = $derived(selectedChannelNameOverride ?? savedSettings.channelName ?? "");

    const selectedSiteId = $derived(selectedSiteIdOverride ?? savedSettings.siteId ?? "");
    const selectedSiteName = $derived(selectedSiteNameOverride ?? savedSettings.siteName ?? "");

    const driveId = $derived(driveIdOverride ?? savedSettings.driveId ?? "");
    const driveName = $derived(driveNameOverride ?? savedSettings.driveName ?? "");
    const rootFolderId = $derived(rootFolderIdOverride ?? savedSettings.rootFolderId ?? "");
    const rootFolderPath = $derived(rootFolderPathOverride ?? savedSettings.rootFolderPath ?? "");
    const webUrl = $derived(webUrlOverride ?? savedSettings.webUrl ?? "");
    const userEmail = $derived(userEmailOverride ?? savedSettings.userEmail ?? "");

    const eventsFolderName = $derived(eventsFolderNameOverride ?? savedSettings.eventsFolderName ?? "Events");
    const announcementsFolderName = $derived(
        announcementsFolderNameOverride ?? savedSettings.announcementsFolderName ?? "Announcements"
    );
    const archiveFolderName = $derived(archiveFolderNameOverride ?? savedSettings.archiveFolderName ?? "Archive");
    const autoArchivePastEvents = $derived(
        autoArchiveOverride ?? savedSettings.autoArchivePastEvents ?? true
    );

    let teamSearch = $state("");
    let siteSearch = $state("");

    const teamsQuery = $derived(
        targetType === "teams_channel" ? listStorageTeams({ search: teamSearch || undefined, authMode }) : null
    );
    const channelsQuery = $derived(
        targetType === "teams_channel" && selectedTeamId
            ? listStorageTeamChannels({ teamId: selectedTeamId, authMode })
            : null
    );

    const sitesQuery = $derived(
        targetType === "sharepoint_site"
            ? listStorageSharePointSites({ search: siteSearch || undefined, authMode })
            : null
    );
    const drivesQuery = $derived(
        targetType === "sharepoint_site" && selectedSiteId
            ? listStorageSiteDrives({ siteId: selectedSiteId, authMode })
            : null
    );

    function syncResolvedDriveToForm(params: {
        driveId: string;
        driveName?: string;
        rootFolderId?: string;
        rootFolderPath?: string;
        webUrl?: string;
    }) {
        driveIdOverride = params.driveId;
        rf.fields.driveId?.set?.(params.driveId);

        if (params.driveName !== undefined) {
            driveNameOverride = params.driveName;
            rf.fields.driveName?.set?.(params.driveName);
        }
        if (params.rootFolderId !== undefined) {
            rootFolderIdOverride = params.rootFolderId;
            rf.fields.rootFolderId?.set?.(params.rootFolderId);
        }
        if (params.rootFolderPath !== undefined) {
            rootFolderPathOverride = params.rootFolderPath;
            rf.fields.rootFolderPath?.set?.(params.rootFolderPath);
        }
        if (params.webUrl !== undefined) {
            webUrlOverride = params.webUrl;
            rf.fields.webUrl?.set?.(params.webUrl);
        }
    }

    async function handleChannelSelect(channelId: string) {
        selectedChannelIdOverride = channelId;
        const channels = channelsQuery?.current ?? [];
        const ch = channels.find((c: any) => c.id === channelId);
        if (ch) {
            selectedChannelNameOverride = ch.displayName;
        }
        if (!selectedTeamId || !channelId) return;

        try {
            const folderRef = await resolveStorageTeamChannelFolder({
                teamId: selectedTeamId,
                channelId,
                authMode,
            });
            syncResolvedDriveToForm({
                driveId: folderRef.driveId,
                driveName: selectedTeamName
                    ? `${selectedTeamName} — ${ch?.displayName || folderRef.name}`
                    : folderRef.name,
                rootFolderId: folderRef.itemId,
                rootFolderPath: folderRef.path,
                webUrl: folderRef.webUrl || "",
            });
            toast.success(`Resolved Teams channel folder: ${folderRef.path}`);
        } catch (err: any) {
            toast.error(err?.message || "Could not auto-resolve channel folder; you can enter Drive ID manually.");
        }
    }

    function handleSiteDriveSelect(selectedDriveId: string) {
        const drives = drivesQuery?.current ?? [];
        const d = drives.find((item: any) => item.id === selectedDriveId);
        syncResolvedDriveToForm({
            driveId: selectedDriveId,
            driveName: d?.name || "Document Library",
            rootFolderId: "root",
            rootFolderPath: "/",
            webUrl: d?.webUrl || "",
        });
    }

    async function handleResolveUserOneDrive() {
        try {
            const d = await resolveStorageUserDrive({
                userEmail: userEmail || undefined,
                authMode,
            });
            syncResolvedDriveToForm({
                driveId: d.id,
                driveName: d.name || `OneDrive (${userEmail || "User"})`,
                rootFolderId: "root",
                rootFolderPath: "/",
                webUrl: d.webUrl || "",
            });
            toast.success(`Resolved OneDrive: ${d.name}`);
        } catch (err: any) {
            toast.error(err?.message || "Failed to resolve user OneDrive");
        }
    }
</script>

<form
    {...rf.enhance(async ({ submit }: any) => {
        try {
            await submit();
            const res = rf.result;
            if (res?.success === false) {
                toast.error(res?.error?.message || "Failed to save Library Root configuration");
                return;
            }
            toast.success("Library Root configuration saved and base folders verified");
            await configQuery.refresh();
            onSaved?.();
        } catch (err: any) {
            toast.error(err?.message || "Failed to save Library Root configuration");
        }
    })}
    class="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-6"
>
    {#if activeConfig?.id}
        <input {...rf.fields.id.as("hidden", activeConfig.id)} />
    {/if}
    <input {...rf.fields.targetType.as("hidden", targetType)} />
    <input {...rf.fields.authMode.as("hidden", authMode)} />
    {#if selectedTeamId}
        <input {...rf.fields.teamId.as("hidden", selectedTeamId)} />
    {/if}
    {#if selectedTeamName}
        <input {...rf.fields.teamName.as("hidden", selectedTeamName)} />
    {/if}
    {#if selectedChannelId}
        <input {...rf.fields.channelId.as("hidden", selectedChannelId)} />
    {/if}
    {#if selectedChannelName}
        <input {...rf.fields.channelName.as("hidden", selectedChannelName)} />
    {/if}
    {#if selectedSiteId}
        <input {...rf.fields.siteId.as("hidden", selectedSiteId)} />
    {/if}
    {#if selectedSiteName}
        <input {...rf.fields.siteName.as("hidden", selectedSiteName)} />
    {/if}
    {#if driveName}
        <input {...rf.fields.driveName.as("hidden", driveName)} />
    {/if}
    {#if rootFolderId}
        <input {...rf.fields.rootFolderId.as("hidden", rootFolderId)} />
    {/if}
    {#if userEmail}
        <input {...rf.fields.userEmail.as("hidden", userEmail)} />
    {/if}
    <input {...rf.fields.autoArchivePastEvents.as("hidden", String(autoArchivePastEvents))} />

    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
            <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                <HardDrive size={20} class="text-blue-600" />
                SharePoint & Microsoft Teams Library Root
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">
                Configure the shared cloud storage root where Event and Announcement folders are automatically provisioned.
            </p>
        </div>

        <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500 font-medium">Auth Mode:</span>
            <div class="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-xs">
                {#each ["auto", "app", "user"] as mode (mode)}
                    <button
                        type="button"
                        onclick={() => (authModeOverride = mode as "auto" | "app" | "user")}
                        class="px-2.5 py-1 rounded-md font-medium capitalize cursor-pointer transition-colors {authMode === mode
                            ? 'bg-white shadow-2xs text-blue-700'
                            : 'text-gray-500 hover:text-gray-800'}"
                    >
                        {mode}
                    </button>
                {/each}
            </div>
        </div>
    </div>

    <!-- Primary Target Type Cards: Teams Channel & SharePoint Document Library -->
    <div class="space-y-3">
        <span class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Recommended Shared Storage Target
        </span>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
                type="button"
                onclick={() => (targetTypeOverride = "teams_channel")}
                class="p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 {targetType === 'teams_channel'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'}"
            >
                <div class="p-2.5 rounded-lg {targetType === 'teams_channel' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}">
                    <Users size={20} />
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-sm text-gray-900">Microsoft Teams Channel</span>
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            Recommended
                        </span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">
                        Store event & announcement folders directly inside a shared Microsoft Teams channel Files tab.
                    </p>
                </div>
            </button>

            <button
                type="button"
                onclick={() => (targetTypeOverride = "sharepoint_site")}
                class="p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 {targetType === 'sharepoint_site'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'}"
            >
                <div class="p-2.5 rounded-lg {targetType === 'sharepoint_site' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}">
                    <Globe size={20} />
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-sm text-gray-900">SharePoint Document Library</span>
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Recommended
                        </span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">
                        Connect any SharePoint Online site document library for organization-wide access.
                    </p>
                </div>
            </button>
        </div>
    </div>

    <!-- Target-specific discovery UI -->
    {#if targetType === "teams_channel"}
        <div class="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Select Microsoft Team & Channel
                </h3>
                <button
                    type="button"
                    onclick={() => void teamsQuery?.refresh()}
                    class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline cursor-pointer"
                >
                    <RefreshCw size={12} class={teamsQuery?.loading ? "animate-spin" : ""} />
                    Refresh Teams
                </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="team-select" class="block text-xs font-medium text-gray-700 mb-1">
                        Microsoft Team
                    </label>
                    <input
                        type="text"
                        bind:value={teamSearch}
                        placeholder="Filter teams..."
                        class="w-full mb-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white"
                    />
                    <select
                        id="team-select"
                        value={selectedTeamId}
                        onchange={(e) => {
                            const val = (e.currentTarget as HTMLSelectElement).value;
                            selectedTeamIdOverride = val;
                            selectedChannelIdOverride = "";
                            const t = (teamsQuery?.current ?? []).find((x: any) => x.id === val);
                            if (t) selectedTeamNameOverride = t.displayName;
                        }}
                        class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white"
                    >
                        <option value="">-- Choose a Team --</option>
                        {#each teamsQuery?.current ?? [] as team (team.id)}
                            <option value={team.id}>{team.displayName}</option>
                        {/each}
                    </select>
                </div>

                <div>
                    <label for="channel-select" class="block text-xs font-medium text-gray-700 mb-1">
                        Team Channel
                    </label>
                    <div class="text-[11px] text-gray-400 mb-1.5">
                        Selecting a channel resolves its SharePoint Drive & Folder automatically
                    </div>
                    <select
                        id="channel-select"
                        value={selectedChannelId}
                        disabled={!selectedTeamId}
                        onchange={(e) => handleChannelSelect((e.currentTarget as HTMLSelectElement).value)}
                        class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white disabled:opacity-50"
                    >
                        <option value="">-- Choose a Channel --</option>
                        {#each channelsQuery?.current ?? [] as ch (ch.id)}
                            <option value={ch.id}>{ch.displayName}</option>
                        {/each}
                    </select>
                </div>
            </div>
        </div>
    {:else if targetType === "sharepoint_site"}
        <div class="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Select SharePoint Site & Document Library
                </h3>
                <button
                    type="button"
                    onclick={() => void sitesQuery?.refresh()}
                    class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline cursor-pointer"
                >
                    <RefreshCw size={12} class={sitesQuery?.loading ? "animate-spin" : ""} />
                    Refresh Sites
                </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="site-select" class="block text-xs font-medium text-gray-700 mb-1">
                        SharePoint Site
                    </label>
                    <input
                        type="text"
                        bind:value={siteSearch}
                        placeholder="Search SharePoint sites..."
                        class="w-full mb-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white"
                    />
                    <select
                        id="site-select"
                        value={selectedSiteId}
                        onchange={(e) => {
                            const val = (e.currentTarget as HTMLSelectElement).value;
                            selectedSiteIdOverride = val;
                            const s = (sitesQuery?.current ?? []).find((x: any) => x.id === val);
                            if (s) selectedSiteNameOverride = s.displayName;
                        }}
                        class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white"
                    >
                        <option value="">-- Choose a SharePoint Site --</option>
                        {#each sitesQuery?.current ?? [] as site (site.id)}
                            <option value={site.id}>{site.displayName} ({site.name})</option>
                        {/each}
                    </select>
                </div>

                <div>
                    <label for="drive-select" class="block text-xs font-medium text-gray-700 mb-1">
                        Document Library (Drive)
                    </label>
                    <div class="text-[11px] text-gray-400 mb-1.5">
                        Select which document library on the site holds your folders
                    </div>
                    <select
                        id="drive-select"
                        value={driveId}
                        disabled={!selectedSiteId}
                        onchange={(e) => handleSiteDriveSelect((e.currentTarget as HTMLSelectElement).value)}
                        class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white disabled:opacity-50"
                    >
                        <option value="">-- Choose a Document Library --</option>
                        {#each drivesQuery?.current ?? [] as drv (drv.id)}
                            <option value={drv.id}>{drv.name} ({drv.driveType})</option>
                        {/each}
                    </select>
                </div>
            </div>
        </div>
    {/if}

    <!-- Discouraged Exception UX for Individual OneDrive -->
    <details
        open={targetType === "user_onedrive"}
        class="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 text-xs"
    >
        <summary
            onclick={() => (targetTypeOverride = "user_onedrive")}
            class="font-semibold text-amber-900 cursor-pointer flex items-center gap-2"
        >
            <AlertTriangle size={15} class="text-amber-600 shrink-0" />
            Advanced: Individual OneDrive (Exception — Not recommended for multi-user collaboration)
        </summary>
        <div class="mt-3 space-y-3 pl-1">
            <div class="p-3 rounded-lg bg-amber-100/70 border border-amber-300 text-amber-900">
                <strong>Warning:</strong> In a multi-user environment, storing files in an individual user's personal OneDrive can cause permission bottlenecks when other team members manage Events or Announcements. Use a shared Microsoft Teams Channel or SharePoint Document Library whenever possible.
            </div>

            <div class="flex flex-col sm:flex-row gap-2 items-end">
                <div class="flex-1 w-full">
                    <label for="onedrive-email" class="block text-xs font-medium text-gray-700 mb-1">
                        OneDrive User Email / UPN
                    </label>
                    <input
                        id="onedrive-email"
                        type="email"
                        value={userEmail}
                        oninput={(e) => (userEmailOverride = (e.currentTarget as HTMLInputElement).value)}
                        placeholder="user@organization.com"
                        class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white"
                    />
                </div>
                <AsyncButton
                    type="button"
                    variant="outline"
                    onclick={handleResolveUserOneDrive}
                    class="shrink-0 text-xs"
                >
                    Resolve User Drive
                </AsyncButton>
            </div>
        </div>
    </details>

    <!-- Resolved / Manual Connection Details -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        <div>
            <label for="cfg-name" class="block text-xs font-semibold text-gray-700 mb-1">
                Configuration Label *
            </label>
            <input
                id="cfg-name"
                {...rf.fields.name.as("text", activeConfig?.name ?? "Primary Library Root")}
                placeholder="Primary Library Root"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
            {#each rf.fields.name.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-xs text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </div>

        <div>
            <label for="cfg-drive-id" class="block text-xs font-semibold text-gray-700 mb-1">
                Graph Drive ID *
            </label>
            <input
                id="cfg-drive-id"
                {...rf.fields.driveId.as("text", driveId)}
                oninput={(e) => (driveIdOverride = (e.currentTarget as HTMLInputElement).value)}
                placeholder="b!..."
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono"
            />
            {#each rf.fields.driveId.issues() ?? [] as issue (issue.message)}
                <p class="mt-1 text-xs text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </div>

        <div>
            <label for="cfg-root-path" class="block text-xs font-semibold text-gray-700 mb-1">
                Root Folder Path
            </label>
            <input
                id="cfg-root-path"
                {...rf.fields.rootFolderPath.as("text", rootFolderPath)}
                oninput={(e) => (rootFolderPathOverride = (e.currentTarget as HTMLInputElement).value)}
                placeholder="/General"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono"
            />
        </div>

        <div>
            <label for="cfg-web-url" class="block text-xs font-semibold text-gray-700 mb-1">
                SharePoint / Teams Web URL
            </label>
            <input
                id="cfg-web-url"
                {...rf.fields.webUrl.as("text", webUrl)}
                oninput={(e) => (webUrlOverride = (e.currentTarget as HTMLInputElement).value)}
                placeholder="https://tenant.sharepoint.com/..."
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
        </div>
    </div>

    <!-- Folder Structure Preview & Naming -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-3 border-t border-gray-100">
        <div class="space-y-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-gray-600">
                Base Folder Naming & Archiving Rules
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label for="cfg-events-folder" class="block text-xs font-medium text-gray-700 mb-1">
                        Events Folder
                    </label>
                    <input
                        id="cfg-events-folder"
                        {...rf.fields.eventsFolderName.as("text", eventsFolderName)}
                        oninput={(e) => (eventsFolderNameOverride = (e.currentTarget as HTMLInputElement).value)}
                        class="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                    />
                </div>
                <div>
                    <label for="cfg-announcements-folder" class="block text-xs font-medium text-gray-700 mb-1">
                        Announcements Folder
                    </label>
                    <input
                        id="cfg-announcements-folder"
                        {...rf.fields.announcementsFolderName.as("text", announcementsFolderName)}
                        oninput={(e) => (announcementsFolderNameOverride = (e.currentTarget as HTMLInputElement).value)}
                        class="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                    />
                </div>
                <div>
                    <label for="cfg-archive-folder" class="block text-xs font-medium text-gray-700 mb-1">
                        Archive Subfolder
                    </label>
                    <input
                        id="cfg-archive-folder"
                        {...rf.fields.archiveFolderName.as("text", archiveFolderName)}
                        oninput={(e) => (archiveFolderNameOverride = (e.currentTarget as HTMLInputElement).value)}
                        class="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                    />
                </div>
            </div>

            <label class="flex items-center gap-2 pt-1 text-xs text-gray-700 cursor-pointer">
                <input
                    type="checkbox"
                    checked={autoArchivePastEvents}
                    onchange={(e) => (autoArchiveOverride = (e.currentTarget as HTMLInputElement).checked)}
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Automatically move past or cancelled Event folders into <strong>{archiveFolderName}</strong></span>
            </label>
        </div>

        <div class="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs space-y-1.5">
            <div class="flex items-center gap-2 text-slate-400 font-sans text-[11px] font-semibold uppercase tracking-wider pb-1">
                <FolderTree size={14} class="text-blue-400" />
                Provisioned Folder Hierarchy Preview
            </div>
            <div class="text-blue-300">
                &lt;Root&gt; / {eventsFolderName} / {archiveFolderName}
            </div>
            <div class="text-emerald-300">
                &lt;Root&gt; / {eventsFolderName} / &lt;startdate&gt; &lt;name of event&gt; &lt;uuid&gt;
            </div>
            <div class="text-blue-300 pt-1">
                &lt;Root&gt; / {announcementsFolderName} / {archiveFolderName}
            </div>
            <div class="text-emerald-300">
                &lt;Root&gt; / {announcementsFolderName} / &lt;startdate&gt; &lt;title&gt; &lt;uuid&gt;
            </div>
        </div>
    </div>

    <div class="flex items-center justify-between pt-3 border-t border-gray-100">
        <div class="text-xs text-gray-500 flex items-center gap-2">
            {#if activeConfig?.lastSyncAt}
                <CheckCircle2 size={14} class="text-emerald-600" />
                <span>Last verified: {new Date(activeConfig.lastSyncAt).toLocaleString()}</span>
            {/if}
            {#if webUrl}
                <a
                    href={webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium ml-2"
                >
                    Open Root in Browser <ExternalLink size={12} />
                </a>
            {/if}
        </div>

        <AsyncButton type="submit" loading={Boolean(rf.pending)} class="bg-blue-600 hover:bg-blue-700 text-white">
            Save Library Root & Provision Base Folders
        </AsyncButton>
    </div>
</form>
