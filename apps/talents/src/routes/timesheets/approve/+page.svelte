<script lang="ts">
    import { onMount } from 'svelte';
    import { listPendingApprovals, approveEntry, rejectEntry } from '../timesheets.remote';
    import { breadcrumbState } from '$lib/stores/breadcrumb.svelte';
    import LoadingSection from '@ac/ui/components/LoadingSection.svelte';
    import AsyncButton from '@ac/ui/components/AsyncButton.svelte';
    import { toast } from 'svelte-sonner';
    import { format, differenceInMinutes, parseISO } from 'date-fns';

    let pendingEntries = $state<any[]>([]);
    let loading = $state(true);

    onMount(async () => {
        breadcrumbState.set({ feature: 'timesheets', segments: [{ label: 'Time Tracking', href: '/timesheets' }], current: 'Approve Entries' });
        pendingEntries = await (listPendingApprovals as any)();
        loading = false;
    });

    async function handleApprove(entryId: string) {
        try {
            await (approveEntry as any)({ entryId });
            pendingEntries = await (listPendingApprovals as any)();
            toast.success('Entry approved');
        } catch (e: any) {
            toast.error(e.message || 'Failed to approve');
        }
    }

    async function handleReject(entryId: string) {
        const comment = prompt('Reason for rejection:');
        if (comment === null) return;
        try {
            await (rejectEntry as any)({ entryId, comment });
            pendingEntries = await (listPendingApprovals as any)();
            toast.success('Entry rejected');
        } catch (e: any) {
            toast.error(e.message || 'Failed to reject');
        }
    }

    function calculateDiff(entry: any) {
        if (!entry.shiftPlan || !entry.endTime) return null;
        const plannedMinutes = differenceInMinutes(new Date(entry.shiftPlan.endTime), new Date(entry.shiftPlan.startTime));
        const actualMinutes = differenceInMinutes(new Date(entry.endTime), new Date(entry.startTime));
        const diff = actualMinutes - plannedMinutes;
        return diff;
    }
</script>

<div class="space-y-6">
    <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <div class="text-sm text-gray-500">{pendingEntries.length} entries awaiting review</div>
    </div>

    {#if loading}
        <LoadingSection message="Loading pending approvals..." />
    {:else if pendingEntries.length === 0}
        <div class="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-gray-500 italic">All caught up! No pending timesheet entries.</p>
        </div>
    {:else}
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table class="w-full text-left border-collapse">
                <thead class="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                        <th class="px-6 py-4">Employee</th>
                        <th class="px-6 py-4">Time Entry</th>
                        <th class="px-6 py-4">Shift Plan</th>
                        <th class="px-6 py-4">Status</th>
                        <th class="text-right px-6 py-4">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    {#each pendingEntries as entry}
                        {@const diff = calculateDiff(entry)}
                        <tr class="hover:bg-gray-50/50 transition-colors">
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                                        {(entry.talent?.contact?.givenName?.[0] || '') + (entry.talent?.contact?.familyName?.[0] || '')}
                                    </div>
                                    <div class="text-sm font-semibold text-gray-900">
                                        {entry.talent?.contact?.displayName || `${entry.talent?.contact?.givenName} ${entry.talent?.contact?.familyName}`}
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <div class="text-sm text-gray-900">{format(new Date(entry.startTime), 'HH:mm')} - {entry.endTime ? format(new Date(entry.endTime), 'HH:mm') : 'Active'}</div>
                                <div class="text-xs text-gray-500">{format(new Date(entry.startTime), 'EEE, MMM d')}</div>
                            </td>
                            <td class="px-6 py-4">
                                {#if entry.shiftPlan}
                                    <div class="text-sm text-gray-900">{format(new Date(entry.shiftPlan.startTime), 'HH:mm')} - {format(new Date(entry.shiftPlan.endTime), 'HH:mm')}</div>
                                    <div class="text-xs text-gray-500">Planned Shift</div>
                                {:else}
                                    <span class="text-xs text-gray-400 italic font-medium">None</span>
                                {/if}
                            </td>
                            <td class="px-6 py-4">
                                {#if diff !== null}
                                    <div class="flex items-center gap-2">
                                        {#if diff > 0}
                                            <span class="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold">OVERTIME: +{diff}m</span>
                                        {:else if diff < 0}
                                            <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">UNDERTIME: {diff}m</span>
                                        {:else}
                                            <span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">ON TIME</span>
                                        {/if}
                                    </div>
                                {:else}
                                    <span class="text-[10px] text-gray-400 font-medium">PENDING END</span>
                                {/if}
                            </td>
                            <td class="px-6 py-4 text-right">
                                <div class="flex justify-end gap-2">
                                    <AsyncButton 
                                        onclick={() => handleReject(entry.id)}
                                        class="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
                                    >
                                        Reject
                                    </AsyncButton>
                                    <AsyncButton 
                                        onclick={() => handleApprove(entry.id)}
                                        class="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                                    >
                                        Approve
                                    </AsyncButton>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>
