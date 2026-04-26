<script lang="ts">
    import { LoadingSection, AsyncButton, ErrorSection } from '@ac/ui';
    import { toast } from 'svelte-sonner';
    import { format, differenceInMinutes } from 'date-fns';
    import { browser } from "$app/environment";
    import { invalidateAll } from "$app/navigation";
    
    // Import action handle
    import { manageTimesheets } from '../../../routes/my-timesheet/timesheets.remote';
    import { manageTimesheetsSchema } from '@ac/validations';
    import * as m from "$lib/paraglide/messages";

    /**
     * TIMESHEET MANAGER (Native Remote Functions)
     */

    let { profile, status } = $props<{ 
        profile: any, 
        status: any 
    }>();

    // Dedicated action handle
    const rf = manageTimesheets as any;
    const fields = rf.fields;

    // UI State for form submission
    // svelte-ignore state_referenced_locally
    let formAction = $state<'clock_in' | 'clock_out'>(status?.activeEntry ? 'clock_out' : 'clock_in');
    // svelte-ignore state_referenced_locally
    let formEntryId = $state(status?.activeEntry?.id || '');

    function getNowLocal() {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    }

    let startTimeOverride = $state(getNowLocal());
    let endTimeOverride = $state(getNowLocal());

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (rf as any).allIssues ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = issues.length;
    });

    async function handleRefresh() {
        // Re-run the server-side load function
        await invalidateAll();
    }

</script>

<div class="space-y-6">
    {#if !profile}
         <div class="flex flex-col items-center justify-center min-h-[400px] p-12 bg-white rounded-3xl border border-dashed border-gray-200">
            <div class="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mb-6">
                <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707.293h-3.172v-3.172" /></svg>
            </div>
            <h3 class="text-xl font-black text-gray-400 italic text-center tracking-tight leading-relaxed uppercase">Neural Node Ddisconnected<br/><span class="text-xs font-bold opacity-60 uppercase tracking-widest">Bridging service unavailable.</span></h3>
        </div>
    {:else if status}
        {@const isActive = !!status.activeEntry}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div class="lg:col-span-2 space-y-8">
                <!-- Clock Control Card -->
                <div class="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden group">
                    <div class="p-10 bg-gradient-to-br from-indigo-50/10 via-white to-white relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-100/20 blur-3xl rounded-full -mr-32 -mt-32"></div>

                        <div class="flex flex-col items-center justify-center space-y-8 relative z-10 text-center">
                            <div class="relative w-48 h-48 rounded-full flex items-center justify-center border-8 border-white shadow-2xl transition-all duration-1000 {isActive ? 'bg-emerald-500 shadow-emerald-200 scale-105' : 'bg-gray-100 shadow-gray-100'}">
                                <svg class="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {#if isActive}
                                    <div class="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-25"></div>
                                {/if}
                            </div>

                            <div class="space-y-1">
                                <h1 class="text-4xl font-black text-gray-901 tracking-tighter leading-tight uppercase italic">
                                    {isActive ? 'Live Stream Active' : 'Session Standby'}
                                </h1>
                                <div class="mt-2 text-center flex justify-center">
                                    {#if isActive && status.activeEntry}
                                        <div class="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                                            <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                            <span class="text-[10px] font-black uppercase tracking-widest">Entry confirmed at {format(new Date(status.activeEntry.startTime), 'HH:mm')}</span>
                                        </div>
                                    {:else}
                                        <p class="text-gray-400 text-xs font-bold tracking-[0.2em] italic uppercase">Internal clock synchronized</p>
                                    {/if}
                                </div>
                            </div>

                                <form
                                    class="flex gap-4 w-full max-sm:flex-col sm:max-w-sm"
                                    {...(rf as any).preflight(manageTimesheetsSchema).enhance(async ({ submit }: { submit: any }) => {
                                        try {
                                            const result: any = await submit();
                                            if (result?.success) {
                                                toast.success(formAction === 'clock_in' ? 'Successfully clocked in!' : 'Successfully clocked out!');
                                                await handleRefresh();
                                            } else {
                                                toast.error(result?.error?.message || result?.message || 'Action failed');
                                            }
                                        } catch (e: any) {
                                            toast.error(e.message || 'Sync error');
                                        }
                                    })}
                                >
                                    <!-- Proper SvelteKit Remote Form Hidden Inputs -->
                                    <input {...rf.fields.action.as('hidden', formAction)} />
                                    {#if profile?.id}
                                        <input {...rf.fields.talentId.as('hidden', profile.id)} />
                                    {/if}
                                    {#if formAction === 'clock_out' && formEntryId}
                                        <input {...rf.fields.entryId.as('hidden', formEntryId)} />
                                    {/if}
                                    
                                    {#if formAction === 'clock_in'}
                                        <input {...rf.fields.type.as('hidden', 'manual')} />
                                        <input {...rf.fields.startTime.as('hidden', startTimeOverride)} />
                                    {:else}
                                        <input {...rf.fields.endTime.as('hidden', endTimeOverride)} />
                                    {/if}

                                    <div class="flex flex-col gap-6 w-full">
                                        <div class="space-y-3">
                                            {#if !isActive}
                                                <div class="animate-in fade-in slide-in-from-top-2 duration-500">
                                                    <label for="startTime" class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1 mb-1 block">Start Time Record</label>
                                                    <input 
                                                        id="startTime"
                                                        type="datetime-local" 
                                                        bind:value={startTimeOverride}
                                                        class="w-full bg-white/50 backdrop-blur-sm border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-black focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm hover:border-gray-200"
                                                    />
                                                </div>
                                            {:else}
                                                <div class="animate-in fade-in slide-in-from-top-2 duration-500">
                                                    <label for="endTime" class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1 mb-1 block">End Time Record</label>
                                                    <input 
                                                        id="endTime"
                                                        type="datetime-local" 
                                                        bind:value={endTimeOverride}
                                                        class="w-full bg-white/50 backdrop-blur-sm border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-black focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all shadow-sm hover:border-gray-200"
                                                    />
                                                </div>
                                            {/if}
                                        </div>

                                        <div class="flex gap-4">
                                            {#if !isActive}
                                                <AsyncButton 
                                                    type="submit"
                                                    onclick={() => { formAction = 'clock_in'; formEntryId = ''; }}
                                                    loading={rf.pending}
                                                    class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-20 rounded-[2rem] text-xl font-black shadow-2xl shadow-emerald-200 active:scale-95 transition-all uppercase tracking-widest border-b-4 border-emerald-800"
                                                >
                                                    Initiate
                                                </AsyncButton>
                                            {:else}
                                                <AsyncButton 
                                                    type="submit"
                                                    onclick={() => { formAction = 'clock_out'; formEntryId = status.activeEntry.id; }}
                                                    loading={rf.pending}
                                                    class="flex-1 bg-rose-600 hover:bg-rose-700 text-white h-20 rounded-[2rem] text-xl font-black shadow-2xl shadow-rose-200 active:scale-95 transition-all uppercase tracking-widest border-b-4 border-rose-800"
                                                >
                                                    Terminate
                                                </AsyncButton>
                                            {/if}
                                        </div>
                                    </div>
                                </form>
                        </div>
                    </div>
                </div>

                <!-- Activity History -->
                <div class="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                    <div class="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                        <h2 class="font-black text-gray-901 text-lg tracking-widest uppercase italic border-l-4 border-indigo-600 pl-4 leading-none">Activity Log</h2>
                        <button 
                            type="button"
                            onclick={() => handleRefresh()} 
                            aria-label="Refresh activity log"
                            class="p-2 hover:bg-indigo-50 rounded-xl text-indigo-600 transition-colors"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                    <div class="divide-y divide-gray-50">
                        {#if status.recentEntries?.length}
                            {#each status.recentEntries as entry}
                                <div class="px-8 py-5 flex items-center justify-between hover:bg-indigo-50/10 transition-all group">
                                    <div class="flex items-center gap-6">
                                        <div class="w-10 h-10 rounded-2xl flex items-center justify-center transition-all bg-white border border-gray-100 shadow-sm group-hover:shadow-md {entry.endTime ? 'text-gray-400' : 'text-emerald-600 border-emerald-100'}">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <div>
                                            <div class="text-[14px] font-black text-gray-900 tracking-tight uppercase italic leading-none mb-1">{format(new Date(entry.startTime), 'EEEE, MMM d')}</div>
                                            <div class="text-[10px] text-gray-400 font-bold tabular-nums tracking-widest uppercase">
                                                {format(new Date(entry.startTime), 'HH:mm')} — 
                                                {#if entry.endTime}
                                                    {format(new Date(entry.endTime), 'HH:mm')}
                                                {:else}
                                                    <span class="text-emerald-500 font-black animate-pulse">LIVE</span>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex flex-col items-end gap-1.5">
                                        {#if entry.endTime}
                                            <div class="text-[18px] font-black text-gray-901 tabular-nums tracking-tighter italic">
                                                {(differenceInMinutes(new Date(entry.endTime), new Date(entry.startTime)) / 60).toFixed(1)}<span class="text-[10px] text-gray-400 ml-0.5 uppercase">hrs</span>
                                            </div>
                                        {/if}
                                        <span class="text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border shadow-sm {
                                            entry.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                                            entry.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                                        }">{entry.status}</span>
                                    </div>
                                </div>
                            {/each}
                        {:else}
                            <div class="p-12 text-center">
                                <p class="text-gray-300 font-black uppercase tracking-widest italic text-[10px]">No historical data found</p>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
