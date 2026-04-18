<script lang="ts">
    import { listTasks } from '../../../routes/tasks.remote';
    import { LoadingSection } from '@ac/ui';
    import { format } from 'date-fns';
    import { browser } from "$app/environment";

    /**
     * DASHBOARD TASK CARD
     * Quick view of pending objectives.
     */

    const tasksPromise = $derived(browser ? listTasks() : null);
</script>

<div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col group">
    <div class="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            </div>
            <div>
                <h3 class="font-bold text-gray-900 leading-tight">Objectives</h3>
                <p class="text-xs text-gray-500 font-medium">Pending actions required</p>
            </div>
        </div>
    </div>

    <div class="flex-1 p-6">
        {#if !browser}
            <div class="animate-pulse text-gray-300 text-center py-8">Initializing...</div>
        {:else}
            {#await tasksPromise}
                <LoadingSection message="Retrieving queue..." />
            {:then data}
                {#if !data || (data.self.length === 0 && data.direct.length === 0)}
                    <div class="h-full flex flex-col items-center justify-center text-center py-8 opacity-40">
                        <svg class="w-12 h-12 text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                        <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">All clear</p>
                    </div>
                {:else}
                    <div class="space-y-4">
                        {#each [...data.self, ...data.direct].slice(0, 3) as task}
                            <div class="flex items-center gap-4 p-3 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all">
                                <div class="w-2 h-2 rounded-full {task.type === 'timesheet_approval' ? 'bg-amber-400' : 'bg-rose-400'}"></div>
                                <div class="flex-1 min-w-0">
                                    <div class="text-[10px] font-black text-gray-900 uppercase italic truncate">{task.title}</div>
                                    <div class="text-[8px] text-gray-400 font-bold uppercase tracking-wider">
                                        {format(new Date(task.createdAt), 'MMM d, HH:mm')}
                                    </div>
                                </div>
                                <a href="/tasks" aria-label="View task details" class="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-indigo-600 transition-all">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                </a>
                            </div>
                        {/each}
                        
                        {#if [...data.self, ...data.direct].length > 3}
                            <p class="text-[9px] text-center text-gray-400 font-bold uppercase tracking-widest">+ {[...data.self, ...data.direct].length - 3} more objectives</p>
                        {/if}
                    </div>
                {/if}
            {/await}
        {/if}
    </div>

    <div class="p-4 bg-gray-50/50 border-t border-gray-50">
        <a href="/tasks" class="block text-center text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
            Task Management Center →
        </a>
    </div>
</div>
