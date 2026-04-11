<script lang="ts">
    import { onMount } from 'svelte';
    import { LoadingSection, AsyncButton, ErrorSection } from '@ac/ui';
    import { toast } from 'svelte-sonner';
    import { format, differenceInMinutes } from 'date-fns';
    import { browser } from "$app/environment";
    
    // Import remote functions
    import { getMyStatus, manageTimesheets } from '../../../routes/my-timesheet/timesheets.remote';

    /**
     * TIMESHEET MANAGER 
     * Uses Svelte's native {#await} for experimental remote functions.
     */

    type Props = {
        profilePromise: Promise<any>;
    };

    let { profilePromise }: Props = $props();
    
    // Status Promise depends on the resolved profile
    const statusPromise = $derived.by(async () => {
        if (!browser || !profilePromise) return null;
        const p = await profilePromise;
        if (!p?.id) return null;
        return getMyStatus(p.id);
    });

    // Forms
    const shiftForm = $derived(browser ? (manageTimesheets as any)() : null);
    
    // Metadata Helper
    function getFieldMetadata(name: string) {
        const def = { as: () => ({}), issues: () => [], value: () => undefined };
        if (!shiftForm?.fields) return def;
        const parts = name.split(".");
        let current: any = shiftForm.fields;
        for (const part of parts) {
            if (!current?.[part]) return def;
            current = current[part];
        }
        return current ?? def;
    }

    let formAction = $state<'clock_in' | 'clock_out'>('clock_in');
    let formEntryId = $state('');
</script>

<div class="space-y-6">
    {#if browser && profilePromise}
        {#await profilePromise}
            <div class="flex flex-col items-center justify-center min-h-[400px] p-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <div class="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                <h2 class="text-xl font-black text-gray-900 mb-2 tracking-tight">Synchronizing Profile</h2>
                <p class="text-gray-500 font-medium tracking-tight">Verifying talent association...</p>
            </div>
        {:then profile}
            {#if profile}
                {#await statusPromise}
                    <div class="flex flex-col items-center justify-center min-h-[400px] p-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <div class="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                        <h2 class="text-xl font-black text-gray-900 mb-2 tracking-tight">Fetching Shift Status</h2>
                        <p class="text-gray-500 font-medium tracking-tight">Loading timesheet data...</p>
                    </div>
                {:then status}
                    {@const isActive = !!status?.activeEntry}
                    
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div class="lg:col-span-2 space-y-8">
                            <div class="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden group">
                                <div class="p-10 bg-gradient-to-br from-indigo-50/50 via-white to-white relative overflow-hidden">
                                    <div class="flex flex-col items-center justify-center space-y-8 relative z-10 text-center">
                                        <div class="w-40 h-40 rounded-full flex items-center justify-center border-8 border-white shadow-2xl transition-all duration-700 {isActive ? 'bg-emerald-500 shadow-emerald-200 animate-pulse' : 'bg-gray-100 shadow-gray-100'}">
                                            <svg class="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>

                                        <div>
                                            <h1 class="text-4xl font-black text-gray-900 tracking-tight leading-tight">
                                                {isActive ? 'Keep up the great work!' : 'Shift Ready?'}
                                            </h1>
                                            <div class="mt-3">
                                                {#if isActive && status?.activeEntry}
                                                    <p class="text-emerald-600 font-bold text-lg italic tracking-tight">
                                                        Clocked in since {format(new Date(status.activeEntry.startTime), 'HH:mm')}
                                                    </p>
                                                {:else}
                                                    <p class="text-gray-500 text-lg font-medium tracking-tight">Ready to start tracking your time?</p>
                                                {/if}
                                            </div>
                                        </div>

                                        {#if shiftForm && profile}
                                            <form
                                                class="flex gap-4 w-full max-sm:flex-col sm:max-w-sm"
                                                {...shiftForm.enhance(async ({ submit }: any) => {
                                                    try {
                                                        await submit();
                                                        const result = shiftForm.result;
                                                        if (result?.success) {
                                                            toast.success(formAction === 'clock_in' ? 'Successfully clocked in!' : 'Successfully clocked out!');
                                                            // Refresh status
                                                            (getMyStatus as any)(profile.id).refresh();
                                                        } else {
                                                            toast.error(result?.error?.message || result?.message || 'Action failed');
                                                        }
                                                    } catch (e: any) {
                                                        toast.error(e.message || 'Sync error');
                                                    }
                                                })}
                                            >
                                                <input {...getFieldMetadata('action').as('hidden', formAction)} />
                                                <input {...getFieldMetadata('talentId').as('hidden', profile.id)} />
                                                <input {...getFieldMetadata('entryId').as('hidden', formEntryId)} />
                                                <input {...getFieldMetadata('type').as('hidden', 'manual')} />

                                                {#if !isActive}
                                                    <AsyncButton 
                                                        type="submit"
                                                        onclick={() => { formAction = 'clock_in'; }}
                                                        loading={shiftForm.pending}
                                                        class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-16 rounded-2xl text-xl font-bold shadow-xl shadow-emerald-100 active:scale-95 transition-all"
                                                    >
                                                        Start Shift
                                                    </AsyncButton>
                                                {:else if status?.activeEntry}
                                                    <AsyncButton 
                                                        type="submit"
                                                        onclick={() => { formAction = 'clock_out'; formEntryId = status.activeEntry.id; }}
                                                        loading={shiftForm.pending}
                                                        class="flex-1 bg-rose-600 hover:bg-rose-700 text-white h-16 rounded-2xl text-xl font-bold shadow-xl shadow-rose-100 active:scale-95 transition-all"
                                                    >
                                                        End Shift
                                                    </AsyncButton>
                                                {/if}
                                            </form>
                                        {/if}
                                    </div>
                                </div>
                            </div>

                            <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                                <div class="px-8 py-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/20">
                                    <h2 class="font-extrabold text-gray-800 text-lg tracking-tight">Activity History</h2>
                                    <button 
                                        onclick={() => (getMyStatus as any)(profile.id).refresh()} 
                                        class="text-indigo-600 font-bold hover:text-indigo-700 flex items-center gap-1.5 transition-colors"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        Refresh
                                    </button>
                                </div>
                                <div class="divide-y divide-gray-50">
                                    {#if status?.recentEntries?.length}
                                        {#each status.recentEntries as entry}
                                            <div class="px-8 py-5 flex items-center justify-between hover:bg-indigo-50/10 transition-all group">
                                                <div class="flex items-center gap-4">
                                                    <div class="w-10 h-10 rounded-xl flex items-center justify-center {entry.endTime ? 'bg-gray-100 text-gray-400' : 'bg-emerald-100 text-emerald-600 shadow-sm'}">
                                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    </div>
                                                    <div>
                                                        <div class="text-base font-bold text-gray-900 tracking-tight">{format(new Date(entry.startTime), 'EEEE, MMM d')}</div>
                                                        <div class="text-sm text-gray-500 font-medium tabular-nums tracking-tight">
                                                            {format(new Date(entry.startTime), 'HH:mm')} — 
                                                            {entry.endTime ? format(new Date(entry.endTime), 'HH:mm') : 'Active Now'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="flex flex-col items-end gap-1">
                                                    <div class="text-lg font-black text-gray-800 tabular-nums tracking-tighter">
                                                        {#if entry.endTime}
                                                            {(differenceInMinutes(new Date(entry.endTime), new Date(entry.startTime)) / 60).toFixed(1)}<span class="text-xs text-gray-400 ml-0.5">h</span>
                                                        {:else}
                                                            <span class="text-emerald-500 font-black animate-pulse">ACTIVE</span>
                                                        {/if}
                                                    </div>
                                                    <span class="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border {
                                                        entry.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                                        entry.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-primary-50 text-primary-600 border-primary-100'
                                                    }">{entry.status}</span>
                                                </div>
                                            </div>
                                        {/each}
                                    {:else}
                                        <div class="p-12 text-center text-gray-400 italic font-medium tracking-tight">No activity records found for this talent.</div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </div>
                {:catch error}
                    <ErrorSection headline="Failed to load shift status" message={error.message} />
                {/await}
            {:else}
                 <div class="flex flex-col items-center justify-center min-h-[400px] p-12 bg-white rounded-3xl border border-dashed border-gray-200">
                    <div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707.293h-3.172v-3.172" /></svg>
                    </div>
                    <h3 class="text-lg font-bold text-gray-400 italic text-center tracking-tight">No talent profile found for your account.<br/><span class="text-sm font-normal">Please contact your administrator to link your account.</span></h3>
                    <div class="mt-4 text-xs text-gray-300 font-mono text-center">
                        Session Status: <span class="text-indigo-400 font-black">Connected</span>
                    </div>
                </div>
            {/if}
        {:catch error}
             <ErrorSection headline="Failed to synchronize profile" message={error.message} />
        {/await}
    {:else if !browser}
        <div class="min-h-screen flex items-center justify-center bg-gray-50">
             <div class="animate-pulse text-indigo-400 uppercase tracking-widest font-black italic">Server Context Active — Awaiting Hydration</div>
        </div>
    {/if}
</div>
