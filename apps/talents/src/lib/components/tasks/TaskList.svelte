<script lang="ts">
    import TaskItem from './TaskItem.svelte';
    import { LoadingSection } from '@ac/ui';
    import { listTasks, listCompletedTasks } from '../../../routes/tasks.remote.js';
    import { slide } from 'svelte/transition';
    import { ShieldAlert, Sparkles } from '@lucide/svelte';

    let { showCompleted = false } = $props<{ showCompleted?: boolean }>();

    const activeTasksQuery = listTasks();
    const completedTasksQuery = listCompletedTasks();

    const currentQuery = $derived(showCompleted ? completedTasksQuery : activeTasksQuery);
    const data = $derived(currentQuery.current);
    const loading = $derived(currentQuery.loading && !data);

    let subordinatesExpanded = $state(false);
</script>

<div class="space-y-12">
    {#if loading}
        <LoadingSection message="Retrieving objective queue..." />
    {:else if showCompleted}
        <div class="space-y-4">
            <div class="flex items-center gap-4 mb-6">
                <h2 class="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Completed History</h2>
                <div class="h-px flex-1 bg-gray-100"></div>
            </div>
            {#if !data || (data as any[]).length === 0}
                <p class="text-sm text-gray-400 italic">No historical objectives found.</p>
            {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each (data as any[]) as task}
                        <div class="opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                            <TaskItem {task} />
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {:else if data}
        <!-- Shared Management Tasks (Admins, HR Managers, Top Management) -->
        {#if (data as any).shared && (data as any).shared.length > 0}
            <section class="space-y-6 p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-50/70 via-white to-amber-50/40 border-2 border-indigo-200/60 shadow-lg shadow-indigo-100/50 relative overflow-hidden">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30">
                            <ShieldAlert size={24} />
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="text-2xl font-black text-gray-900 uppercase italic tracking-tight">
                                    Gemeinsame Freigaben (Management & HR)
                                </h2>
                                <span class="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                                    {(data as any).shared.length}
                                </span>
                            </div>
                            <p class="text-xs text-indigo-950 font-medium">
                                Aufgaben für Administratoren, HR Manager und Geschäftsführung zur Freigabe automatischer Tarif- & Versicherungskonditionen.
                            </p>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {#each (data as any).shared as task}
                        <TaskItem {task} />
                    {/each}
                </div>
            </section>
        {/if}

        <!-- Self Tasks -->
        <section class="space-y-6">
            <div class="flex items-center gap-4">
                <h2 class="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Personal Objectives</h2>
                <span class="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{(data as any).self?.length ?? 0}</span>
                <div class="h-px flex-1 bg-gray-100"></div>
            </div>
            {#if !(data as any).self || (data as any).self.length === 0}
                <div class="p-12 border-2 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center justify-center text-center">
                    <svg class="w-12 h-12 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                    <p class="text-sm font-bold text-gray-300 uppercase tracking-widest">Clear Horizons</p>
                </div>
            {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {#each (data as any).self as task}
                        <TaskItem {task} />
                    {/each}
                </div>
            {/if}
        </section>

        <!-- Direct Reports -->
        <section class="space-y-6">
            <div class="flex items-center gap-4">
                <h2 class="text-2xl font-black text-gray-900 uppercase italic tracking-tighter text-emerald-600">Direct Reports</h2>
                <span class="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{(data as any).direct?.length ?? 0}</span>
                <div class="h-px flex-1 bg-gray-100"></div>
            </div>
            {#if !(data as any).direct || (data as any).direct.length === 0}
                <p class="text-xs font-bold text-gray-300 uppercase tracking-widest ml-1">No pending actions for direct line</p>
            {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {#each (data as any).direct as task}
                        <TaskItem {task} />
                    {/each}
                </div>
            {/if}
        </section>

        <!-- Subordinates (Collapsed) -->
        <section class="space-y-6">
            <button 
                onclick={() => subordinatesExpanded = !subordinatesExpanded}
                class="flex items-center gap-4 w-full group outline-none"
            >
                <h2 class="text-xl font-black text-gray-400 group-hover:text-gray-600 uppercase italic tracking-tighter transition-colors">Extended Hierarchy</h2>
                <span class="bg-gray-200 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full">{(data as any).subordinates?.length ?? 0}</span>
                <div class="h-px flex-1 bg-gray-100"></div>
                <svg class="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-all {subordinatesExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            
            {#if subordinatesExpanded}
                <div transition:slide={{ duration: 400 }}>
                    {#if !(data as any).subordinates || (data as any).subordinates.length === 0}
                        <p class="text-xs font-bold text-gray-300 uppercase tracking-widest ml-1 italic">Network quiet</p>
                    {:else}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            {#each (data as any).subordinates as task}
                                <TaskItem {task} />
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        </section>
    {/if}
</div>
