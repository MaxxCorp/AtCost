<script lang="ts">
    import { manageTimesheets } from '../../../routes/my-timesheet/timesheets.remote';
    import { manageTimesheetsSchema } from '@ac/validations';
    import { AsyncButton } from '@ac/ui';
    import { format } from 'date-fns';
    import { toast } from 'svelte-sonner';
    import { browser } from "$app/environment";
    import * as m from "$lib/paraglide/messages";

    /**
     * DASHBOARD COMPONENT - Dedicated Handle Pattern
     * Uses a specific handle (manageTimesheetsDashboard) to avoid collisions
     * with other timesheet forms on the same page.
     */

    let { status, talentId, onRefresh } = $props<{ 
        status: any, 
        talentId: string, 
        onRefresh: () => void 
    }>();

    // Reactive Form Proxy (initialized only in browser)
    const rf = $derived(browser ? manageTimesheets : null);

    // Local form state
    let formAction = $state<'clock_in' | 'clock_out'>('clock_in');
    let formEntryId = $state('');

    function getNowLocal() {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    }

    let startTimeOverride = $state(getNowLocal());
    let endTimeOverride = $state(getNowLocal());

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (rf as any)?.allIssues ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = issues.length;
    });

    function getFieldMetadata(name: string): any {
        const def = { as: () => ({}), issues: () => [], value: () => undefined };
        if (!rf?.fields) return def;
        const parts = name.split(".");
        let current: any = (rf as any).fields; 
        for (const part of parts) {
            if (!current?.[part]) return def;
            current = current[part];
        }
        return current ?? def;
    }
</script>

{#if browser}
    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
        <div class="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <h3 class="font-bold text-gray-900 leading-tight">Time Tracking</h3>
                    <p class="text-xs text-gray-500 font-medium">Manage your active shift</p>
                </div>
            </div>
        </div>

        <div class="flex-1 p-6 flex flex-col justify-center">
            {#if !status}
                <div class="text-center py-4">
                    <p class="text-xs text-red-500 font-medium">Failed to fetch status</p>
                    <button onclick={() => onRefresh()} class="text-xs text-indigo-600 underline mt-1">Try again</button>
                </div>
            {:else}
                {@const isActive = !!status.activeEntry}
                <div class="text-center space-y-4">
                    <div class="relative inline-block">
                        <div class="absolute -inset-2 rounded-full blur-xl opacity-20 {isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-200'}"></div>
                        <div class="relative h-20 w-20 rounded-full flex items-center justify-center border-4 border-white shadow-xl {isActive ? 'bg-emerald-500' : 'bg-gray-100'}">
                            <svg class="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                    
                    <div>
                        <p class="text-sm font-bold {isActive ? 'text-emerald-600' : 'text-gray-400'}">
                            {isActive ? 'Currently Clocked In' : 'Currently Offline'}
                        </p>
                        {#if isActive && status.activeEntry}
                            <p class="text-[10px] text-gray-400 font-medium">Started at {format(new Date(status.activeEntry.startTime), 'HH:mm')}</p>
                        {/if}
                    </div>

                    {#if rf}
                        <form
                            class="pt-2"
                            {...(rf as any).preflight(manageTimesheetsSchema).enhance(async ({ submit }: { submit: any }) => {
                                try {
                                    const result: any = await submit();
                                    if (result?.success) {
                                        toast.success(formAction === 'clock_in' ? 'Clocked In!' : 'Clocked Out!');
                                        onRefresh();
                                    } else {
                                        toast.error(result?.error?.message || result?.message || 'Error');
                                    }
                                } catch (e: any) {
                                    toast.error('Sync failed');
                                }
                            })}
                        >
                            {#if formAction === 'clock_in'}
                                <input {...getFieldMetadata('action').as('hidden', formAction)} />
                                <input {...getFieldMetadata('talentId').as('hidden', talentId)} />
                                <input {...getFieldMetadata('type').as('hidden', 'manual')} />
                                <input {...(getFieldMetadata('startTime') as any).as('hidden', startTimeOverride)} />
                                
                                <div class="mb-4">
                                    <label for="start-override" class="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">Start Override</label>
                                    <input 
                                        id="start-override"
                                        type="datetime-local" 
                                        bind:value={startTimeOverride}
                                        class="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-[10px] font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            {:else if formAction === 'clock_out'}
                                <input {...getFieldMetadata('action').as('hidden', formAction)} />
                                <input {...getFieldMetadata('talentId').as('hidden', talentId)} />
                                <input {...getFieldMetadata('entryId').as('hidden', formEntryId)} />
                                <input {...(getFieldMetadata('endTime') as any).as('hidden', endTimeOverride)} />

                                <div class="mb-4">
                                    <label for="end-override" class="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">End Override</label>
                                    <input 
                                        id="end-override"
                                        type="datetime-local" 
                                        bind:value={endTimeOverride}
                                        class="w-full bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 text-[10px] font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                                    />
                                </div>
                            {/if}

                            {#if !isActive}
                                <AsyncButton 
                                    type="submit"
                                    onclick={() => { formAction = 'clock_in'; }}
                                    loading={rf.pending}
                                    class="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 font-bold text-sm shadow-lg shadow-emerald-50 transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    Start Shift
                                </AsyncButton>
                            {:else if status.activeEntry}
                                <AsyncButton 
                                    type="submit"
                                    onclick={() => { formAction = 'clock_out'; formEntryId = status.activeEntry.id; }}
                                    loading={rf.pending}
                                    class="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-3 font-bold text-sm shadow-lg shadow-rose-50 transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    End Shift
                                </AsyncButton>
                            {/if}
                        </form>
                    {/if}
                </div>
            {/if}
        </div>

        <div class="p-4 bg-gray-50/50 border-t border-gray-50">
            <a href="/my-timesheet" class="block text-center text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                View Full Timesheet →
            </a>
        </div>
    </div>
{:else}
    <div class="h-64 flex items-center justify-center bg-white rounded-3xl shadow-sm border border-gray-100">
        <div class="animate-pulse text-gray-400">Loading module...</div>
    </div>
{/if}
