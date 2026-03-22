<script lang="ts">
    import { onMount } from 'svelte';
    import { getMyTalentId, getMyStatus, clockIn, clockOut } from './timesheets.remote';
    import { breadcrumbState } from '$lib/stores/breadcrumb.svelte';
    import LoadingSection from '@ac/ui/components/LoadingSection.svelte';
    import AsyncButton from '@ac/ui/components/AsyncButton.svelte';
    import { toast } from 'svelte-sonner';
    import { format, differenceInMinutes } from 'date-fns';

    let talentId = $state<string | null>(null);
    let status = $state<any>(null);
    let loading = $state(true);
    let now = $state(new Date());

    onMount(() => {
        const init = async () => {
            breadcrumbState.set({ feature: 'timesheets', current: 'My Time Tracking' });
            talentId = await (getMyTalentId as any)();
            if (talentId) {
                status = await (getMyStatus as any)(talentId);
            }
            loading = false;
        };
        init();

        const timer = setInterval(() => {
            now = new Date();
            checkReminders();
        }, 1000 * 60); // Check every minute

        return () => clearInterval(timer);
    });

    async function handleClockIn(type: 'qr' | 'manual' = 'manual', locationId?: string) {
        if (!talentId) return;
        try {
            await (clockIn as any)({ talentId, type, locationId });
            status = await (getMyStatus as any)(talentId);
            toast.success('Successfully clocked in!');
        } catch (e: any) {
            toast.error(e.message || 'Failed to clock in');
        }
    }

    async function handleClockOut() {
        if (!talentId || !status.activeEntry) return;
        try {
            await (clockOut as any)({ entryId: status.activeEntry.id, talentId });
            status = await (getMyStatus as any)(talentId);
            toast.success('Successfully clocked out!');
        } catch (e: any) {
            toast.error(e.message || 'Failed to clock out');
        }
    }

    function checkReminders() {
        if (!status?.shiftPlans?.length) return;
        const upcomingShift = status.shiftPlans.find((s: any) => {
            const start = new Date(s.startTime);
            const diff = differenceInMinutes(start, now);
            return diff <= 10 && diff > 0 && !status.activeEntry;
        });

        if (upcomingShift) {
            toast.info('Your shift starts in less than 10 minutes. Don\'t forget to clock in!', { duration: 10000 });
        }
    }

    const isActive = $derived(!!status?.activeEntry);
</script>

<div class="space-y-6">
    {#if loading}
        <LoadingSection message="Loading your time tracking status..." />
    {:else if !talentId}
        <div class="bg-yellow-50 border border-yellow-200 p-6 rounded-lg text-center">
            <p class="text-yellow-800 font-medium">No Talent Profile Found</p>
            <p class="text-yellow-700 text-sm mt-1">Please contact an administrator to link your user account to a talent profile.</p>
        </div>
    {:else}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main Control Card -->
            <div class="lg:col-span-2 space-y-6">
                <div class="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-2xl">
                    <div class="p-8 pb-10 bg-gradient-to-br from-gray-50 to-white relative">
                        <div class="flex flex-col items-center justify-center space-y-6">
                            <div class="relative">
                                <div class="w-32 h-32 rounded-full flex items-center justify-center border-4 border-white shadow-lg transition-transform duration-500 hover:scale-105 {isActive ? 'bg-emerald-500 shadow-emerald-200 animate-pulse' : 'bg-gray-200'}">
                                    <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                {#if isActive}
                                    <div class="absolute -top-1 -right-1 bg-emerald-100 text-emerald-600 text-xs font-bold px-2 py-1 rounded-full border border-emerald-200">ACTIVE</div>
                                {/if}
                            </div>

                            <div class="text-center">
                                <h1 class="text-3xl font-bold text-gray-900">{isActive ? 'You are Clocked In' : 'Ready to Start?'}</h1>
                                <p class="text-gray-500 mt-2">
                                    {isActive 
                                        ? `Started at ${format(new Date(status.activeEntry.startTime), 'HH:mm')}` 
                                        : 'Press the button below to start your shift.'}
                                </p>
                            </div>

                            <div class="flex gap-4 w-full max-w-md">
                                {#if !isActive}
                                    <AsyncButton 
                                        onclick={() => handleClockIn('manual')}
                                        class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-14 rounded-xl text-lg font-semibold shadow-lg shadow-emerald-100"
                                    >
                                        Clock In
                                    </AsyncButton>
                                    <button 
                                        onclick={() => handleClockIn('qr')}
                                        class="w-14 h-14 flex items-center justify-center bg-white border-2 border-emerald-600 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-colors shadow-sm"
                                        title="Scan QR Code"
                                    >
                                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                        </svg>
                                    </button>
                                {:else}
                                    <AsyncButton 
                                        onclick={handleClockOut}
                                        class="flex-1 bg-rose-600 hover:bg-rose-700 text-white h-14 rounded-xl text-lg font-semibold shadow-lg shadow-rose-100"
                                    >
                                        Clock Out
                                    </AsyncButton>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h2 class="font-bold text-gray-800">Recent Activity</h2>
                        <span class="text-xs text-gray-500">Last 10 entries</span>
                    </div>
                    <div class="divide-y divide-gray-50">
                        {#each status.recentEntries as entry}
                            <div class="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 rounded-full flex items-center justify-center {entry.endTime ? 'bg-gray-100 text-gray-400' : 'bg-emerald-100 text-emerald-600 animate-pulse'}">
                                        {#if entry.type === 'qr'}
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                        {:else}
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {/if}
                                    </div>
                                    <div>
                                        <div class="text-sm font-semibold text-gray-900">{format(new Date(entry.startTime), 'EEE, MMM d')}</div>
                                        <div class="text-xs text-gray-500">
                                            {format(new Date(entry.startTime), 'HH:mm')} - 
                                            {entry.endTime ? format(new Date(entry.endTime), 'HH:mm') : 'Active'}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <div class="text-right">
                                        <div class="text-sm font-bold text-gray-700">
                                            {#if entry.endTime}
                                                {Math.round(differenceInMinutes(new Date(entry.endTime), new Date(entry.startTime)) / 60 * 10) / 10}h
                                            {:else}
                                                --
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider {
                                        entry.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                                        entry.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                    }">
                                        {entry.status}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Sidebar Info -->
            <div class="space-y-6">
                <!-- Shift Plan Card -->
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 class="font-bold text-gray-800">Your Shift Plan</h2>
                    </div>
                    <div class="p-6 space-y-4">
                        {#if status.shiftPlans?.length}
                            {#each status.shiftPlans as shift}
                                <div class="p-4 rounded-xl border border-gray-50 bg-gray-50/30 space-y-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-bold text-indigo-600 uppercase pb-1 border-b border-indigo-100">
                                            {format(new Date(shift.startTime), 'EEEE')}
                                        </span>
                                        <span class="text-[10px] text-gray-400">
                                            {format(new Date(shift.startTime), 'MMM d')}
                                        </span>
                                    </div>
                                    <div class="text-sm font-bold text-gray-900 leading-none pt-1">
                                        {format(new Date(shift.startTime), 'HH:mm')} - {format(new Date(shift.endTime), 'HH:mm')}
                                    </div>
                                    {#if shift.notes}
                                        <div class="text-[11px] text-gray-500 italic truncate" title={shift.notes}>
                                            "{shift.notes}"
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        {:else}
                            <p class="text-sm text-gray-500 italic text-center py-4">No upcoming shifts planned.</p>
                        {/if}
                    </div>
                </div>

                <!-- Stats Summary -->
                <div class="bg-indigo-600 rounded-2xl shadow-lg border border-indigo-500 p-6 text-white overflow-hidden relative">
                    <div class="absolute -right-4 -bottom-4 opacity-10">
                        <svg class="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 class="text-indigo-100 text-sm font-medium">This Week</h3>
                    <div class="mt-2 flex items-baseline gap-2">
                        <span class="text-4xl font-black">32.5</span>
                        <span class="text-indigo-200 text-sm">hours logged</span>
                    </div>
                    <div class="mt-4 h-1 bg-indigo-400 rounded-full overflow-hidden">
                        <div class="h-full bg-white w-[80%]"></div>
                    </div>
                    <p class="mt-2 text-xs text-indigo-200">80% of your weekly target</p>
                </div>
            </div>
        </div>
    {/if}
</div>
