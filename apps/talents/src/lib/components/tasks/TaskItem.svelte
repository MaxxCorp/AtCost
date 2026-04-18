<script lang="ts">
    import { format } from 'date-fns';
    import { AsyncButton } from '@ac/ui';
    import { completeTask } from '../../../routes/tasks.remote';
    import { manageTimesheets } from '../../../routes/my-timesheet/timesheets.remote';
    import { toast } from 'svelte-sonner';
    import { invalidateAll } from '$app/navigation';

    let { task } = $props<{ task: any }>();

    const ct = completeTask;
    const mt = manageTimesheets;

    async function handleTimesheetAction(action: 'approve' | 'reject') {
        // Fallback for custom logic if needed, but we'll try to use form submit
    }

    const typeColors = {
        timesheet_approval: 'bg-amber-50 text-amber-700 border-amber-100',
        profile_update: 'bg-blue-50 text-blue-700 border-blue-100',
        correction: 'bg-rose-50 text-rose-700 border-rose-100',
        manual: 'bg-gray-50 text-gray-700 border-gray-100'
    };
</script>

<div class="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
    <div class="flex items-start justify-between gap-4">
        <div class="flex gap-4">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-50 group-hover:bg-white border border-transparent group-hover:border-gray-100 transition-all">
                {#if task.type === 'timesheet_approval'}
                    <svg class="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {:else if task.type === 'correction'}
                    <svg class="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                {:else}
                    <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                {/if}
            </div>
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border {(typeColors as any)[task.type] || typeColors.manual}">
                        {task.type.replace('_', ' ')}
                    </span>
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {format(new Date(task.createdAt), 'MMM d, HH:mm')}
                    </span>
                </div>
                <h3 class="text-sm font-black text-gray-900 leading-tight mb-1">{task.title}</h3>
                <p class="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                
                {#if task.assignee?.contact}
                    <div class="mt-3 flex items-center gap-2">
                        <div class="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600 uppercase">
                            {task.assignee.contact.firstName[0]}{task.assignee.contact.lastName[0]}
                        </div>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assigned to {task.assignee.contact.firstName} {task.assignee.contact.lastName}</span>
                    </div>
                {/if}
            </div>
        </div>

        <div class="flex flex-col gap-2">
            {#if task.type === 'timesheet_approval'}
                <form 
                    {...mt.enhance(async ({ submit }) => {
                        const ok = await submit() as any;
                        if (ok) {
                            toast.success('Timesheet approved');
                            await invalidateAll();
                        }
                    })}
                >
                    <input {...(mt.fields as any).action.as('hidden', 'approve')} />
                    <input {...(mt.fields as any).entryId.as('hidden', task.data.timesheetEntryId)} />
                    <AsyncButton 
                        type="submit"
                        loading={mt.pending}
                        class="w-full px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        Approve
                    </AsyncButton>
                </form>

                <form 
                    {...mt.enhance(async ({ submit }) => {
                        const ok = await submit() as any;
                        if (ok) {
                            toast.success('Timesheet rejected');
                            await invalidateAll();
                        }
                    })}
                >
                    <input {...(mt.fields as any).action.as('hidden', 'reject')} />
                    <input {...(mt.fields as any).entryId.as('hidden', task.data.timesheetEntryId)} />
                    <input {...(mt.fields as any).comment.as('hidden', 'Rejected via task manager')} />
                    <AsyncButton 
                        type="submit"
                        loading={mt.pending}
                        class="w-full px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        Reject
                    </AsyncButton>
                </form>
            {:else}
                <form 
                    {...ct.enhance(async ({ submit }) => {
                        const ok = await submit() as any;
                        if (ok) {
                            toast.success('Task completed');
                            await invalidateAll();
                        }
                    })}
                >
                    <input {...ct.fields.taskId.as('hidden', task.id)} />
                    <AsyncButton 
                        type="submit"
                        loading={ct.pending}
                        class="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        Complete
                    </AsyncButton>
                </form>
            {/if}
        </div>
    </div>
</div>
