<script lang="ts">
    import TimesheetsManager from "$lib/components/dashboard_timesheets/TimesheetsManager.svelte";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
    import { getMyTalentProfile } from "../talents/talents.remote";
    import { getMyStatus } from "./timesheets.remote";
    import { LoadingSection, ErrorSection } from "@ac/ui";

    breadcrumbState.set({ feature: "timesheets", current: 'My Time Tracking' });

    const profilePromise = $state(getMyTalentProfile());
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#await profilePromise}
        <LoadingSection message="Authenticating credentials..." />
    {:then profile}
        {#if profile}
            {#await getMyStatus(profile.id)}
                <LoadingSection message="Synchronizing status..." />
            {:then status}
                {#key status}
                    <TimesheetsManager {profile} {status} />
                {/key}
            {:catch error}
                <ErrorSection headline="Synchronization Diverged" message={error.message} />
            {/await}
        {:else}
            <div class="flex flex-col items-center justify-center min-h-[400px] p-12 bg-white rounded-3xl border border-dashed border-gray-200">
                <div class="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mb-6">
                    <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707.293h-3.172v-3.172" /></svg>
                </div>
                <h3 class="text-xl font-black text-gray-400 italic text-center tracking-tight leading-relaxed uppercase">Neural Node Disconnected<br/><span class="text-xs font-bold opacity-60 uppercase tracking-widest">Bridging service unavailable.</span></h3>
            </div>
        {/if}
    {:catch error}
        <ErrorSection headline="Authentication Failed" message={error.message} />
    {/await}
</div>
