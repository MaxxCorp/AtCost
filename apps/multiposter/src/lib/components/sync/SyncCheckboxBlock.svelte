<script lang="ts">
    import { onMount } from "svelte";
    import { list } from "../../../routes/synchronizations/list.remote";
    import RefreshCw from "#lib/components/icons/refresh-cw.svelte";
    import * as m from "#lib/paraglide/messages.js";
    import { translateIssue } from "@ac/ui";
    
    import { toast } from "svelte-sonner";
    
    let {
        syncFieldConfig,
        initialSelectedIds = [],
        isSeries = false
    }: {
        syncFieldConfig: any; // Remote Function field object
        initialSelectedIds?: string[];
        isSeries?: boolean;
    } = $props();

    // svelte-ignore state_referenced_locally
    let selectedIds = $state<string[]>(initialSelectedIds?.length ? [...initialSelectedIds] : []);
    const query = list();
    const configs = $derived(query.current?.data ?? []);

    let prevIsSeries = false;
    $effect(() => {
        if (isSeries && !prevIsSeries && configs.length > 0) {
            const berlinConfigs = configs.filter((c: any) => c.providerType === 'berlin-de-mh-calendar' || c.providerType === 'berlin-de-main-calendar');
            const berlinIds = berlinConfigs.map((c: any) => c.id);
            const hasBerlinSelected = selectedIds.some(id => berlinIds.includes(id));
            if (hasBerlinSelected) {
                selectedIds = selectedIds.filter(id => !berlinIds.includes(id));
                toast.error(m.berlin_de_series_sync_not_allowed());
            }
        }
        prevIsSeries = isSeries;
    });

    onMount(async () => {
        if (!initialSelectedIds || initialSelectedIds.length === 0) {
            try {
                const res = await query;
                if (res?.data) {
                    const defaultIds = res.data
                        .filter((c: any) => c.enabled && (c.settings?.isDefault === true || c.settings?.isDefault === 'true' || c.settings?.isDefault === 1) && (!isSeries || (c.providerType !== 'berlin-de-mh-calendar' && c.providerType !== 'berlin-de-main-calendar')))
                        .map((c: any) => c.id);
                    if (defaultIds.length > 0) {
                        selectedIds = Array.from(new Set([...selectedIds, ...defaultIds]));
                    }
                }
            } catch (err) {
                console.error("Failed to load default sync configurations:", err);
            }
        }
    });

    function toggleConfig(config: any) {
        if (selectedIds.includes(config.id)) {
            selectedIds = selectedIds.filter(x => x !== config.id);
        } else {
            if (isSeries && (config.providerType === 'berlin-de-mh-calendar' || config.providerType === 'berlin-de-main-calendar')) {
                if (config.providerType === 'berlin-de-main-calendar') {
                    toast.error(m.berlin_de_main_series_sync_not_allowed());
                } else {
                    toast.error(m.berlin_de_mh_series_sync_not_allowed());
                }
                return;
            }
            selectedIds = [...selectedIds, config.id];
        }
    }

    function getProviderLabel(providerType: string) {
        if (providerType === "google-calendar") return m.google_calendar ? m.google_calendar() : "Google Calendar";
        if (providerType === "microsoft-calendar") return m.microsoft_calendar ? m.microsoft_calendar() : "Microsoft Calendar";
        if (providerType === "microsoft-contacts") return "Microsoft Contacts";
        if (providerType === "microsoft-resources") return "Microsoft Resources & Rooms";
        if (providerType === "berlin-de-main-calendar") return m.berlin_de_main_calendar ? m.berlin_de_main_calendar() : "Berlin.de (Main)";
        if (providerType === "berlin-de-mh-calendar") return m.berlin_de_mh_calendar ? m.berlin_de_mh_calendar() : "Berlin.de (MH)";
        if (providerType === "wp-the-events-calendar") return m.wp_the_events_calendar ? m.wp_the_events_calendar() : "WP Events Calendar";
        if (providerType === "email") return m.email_brevo ? m.email_brevo() : "Email (Brevo)";
        if (providerType === "instagram") return "Instagram";
        if (providerType === "nebenan-de") return "Nebenan.de";
        if (providerType === "eventbrite") return "Eventbrite";
        if (providerType === "meetup") return "Meetup";
        if (providerType === "seniorennetz-berlin") return "Seniorennetz Berlin";
        if (providerType === "bewegungsatlas-berlin") return "Bewegungsatlas Berlin";
        return providerType;
    }

    function getTargetSubtitle(config: any): string {
        const settings = config.settings || {};
        if (config.providerType?.startsWith("microsoft-")) {
            const mailbox = settings.mailboxEmail || (settings.calendarId && settings.calendarId.includes("@") ? settings.calendarId : undefined);
            if (mailbox) return `${getProviderLabel(config.providerType)} • ${mailbox}`;
            return `${getProviderLabel(config.providerType)} • Personal (me)`;
        }
        if (settings.calendarId && settings.calendarId !== "primary") {
            return `${getProviderLabel(config.providerType)} • ${settings.calendarId}`;
        }
        return getProviderLabel(config.providerType);
    }

    // Prepare JSON for hidden input
    let hiddenValue = $derived(JSON.stringify(selectedIds));

</script>

<div class="bg-white shadow rounded-lg p-6 space-y-4">
    <div class="flex gap-2 items-center mb-4 border-b pb-2">
        <RefreshCw class="w-5 h-5 text-gray-600" />
        <h2 class="text-xl font-semibold">{m.synchronization()}</h2>
    </div>

    <p class="text-sm text-gray-600 mb-4">
        {m.sync_description()}
    </p>

    {#if query.loading && !query.current}
        <p class="text-sm text-gray-500">{m.loading_item({ item: m.feature_synchronizations_title() })}</p>
    {:else if configs.length === 0}
        <p class="text-sm text-gray-500 italic">{m.no_syncs_configured()}</p>
    {:else}
        <div class="space-y-2 border rounded-md p-4 bg-gray-50 max-h-64 overflow-y-auto">
            {#each configs as config (config.id)}
                {@const isDefaultTarget = (config.settings as any)?.isDefault === true || (config.settings as any)?.isDefault === 'true' || (config.settings as any)?.isDefault === 1}
                {@const isBlockedSeries = isSeries && (config.providerType === 'berlin-de-mh-calendar' || config.providerType === 'berlin-de-main-calendar')}
                {#if config.enabled}
                    <label class="flex items-center gap-3 py-2 px-2 hover:bg-white border border-transparent hover:border-gray-200 rounded transition-colors cursor-pointer {isBlockedSeries ? 'opacity-60' : ''}">
                        <input 
                            type="checkbox"
                            class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2"
                            checked={selectedIds.includes(config.id)}
                            onchange={() => toggleConfig(config)}
                        />
                        <div class="flex flex-col min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium text-gray-900 truncate">
                                    {config.name || getProviderLabel(config.providerType)}
                                </span>
                                {#if isDefaultTarget}
                                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        {m.default_badge ? m.default_badge() : "Default"}
                                    </span>
                                {/if}
                            </div>
                            <span class="text-xs text-gray-500 font-mono truncate">
                                {getTargetSubtitle(config)}
                            </span>
                        </div>
                    </label>
                {/if}
            {/each}
        </div>
    {/if}

    
    <input {...syncFieldConfig.as("text", hiddenValue)} class="hidden" />
    {#each syncFieldConfig.issues() ?? [] as issue (issue.message)}
        <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
    {/each}
</div>
