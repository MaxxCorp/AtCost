<script lang="ts">
    import TimesheetsManager from "#lib/components/dashboard_timesheets/TimesheetsManager.svelte";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { getMyTalentProfile } from "../talents/talents.remote";
    import { getMyStatus } from "./timesheets.remote";
    import { LoadingSection, ErrorSection } from "@ac/ui";
    import * as m from "#lib/paraglide/messages.js";

    breadcrumbState.set({ feature: "timesheets", current: m.time_tracking ? m.time_tracking() : 'My Time Tracking' });

    const profileQuery = getMyTalentProfile();
    const profile = $derived(profileQuery.current);
    const statusQuery = $derived(profile?.id ? getMyStatus(profile.id) : null);
    const status = $derived(statusQuery?.current);
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if profileQuery.loading && !profile}
        <LoadingSection message={m.loading ? m.loading() : "Loading..."} />
    {:else if profileQuery.error}
        <ErrorSection headline={m.failed_to_load ? m.failed_to_load({ item: "Profile" }) : "Authentication Failed"} message={profileQuery.error.message} />
    {:else if profile}
        {#if statusQuery?.loading && !status}
            <LoadingSection message={m.loading ? m.loading() : "Loading status..."} />
        {:else if statusQuery?.error}
            <ErrorSection headline={m.sync_failure ? m.sync_failure() : "Error loading status"} message={statusQuery.error.message} />
        {:else if status}
            {#key status}
                <TimesheetsManager {profile} {status} />
            {/key}
        {/if}
    {:else}
        <div class="flex flex-col items-center justify-center min-h-[400px] p-12 bg-white rounded-3xl border border-dashed border-gray-200">
            <div class="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mb-6">
                <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707.293h-3.172v-3.172" /></svg>
            </div>
            <h3 class="text-xl font-black text-gray-400 italic text-center tracking-tight leading-relaxed uppercase">{m.neural_node_disconnected()}<br/><span class="text-xs font-bold opacity-60 uppercase tracking-widest">{m.bridging_service_unavailable()}</span></h3>
        </div>
    {/if}
</div>
