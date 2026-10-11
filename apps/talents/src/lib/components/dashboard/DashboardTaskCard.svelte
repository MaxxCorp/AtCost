<script lang="ts">
    import { listTasks } from '../../../routes/tasks.remote';
    import { LoadingSection } from '@ac/ui';
    import { format } from 'date-fns';
    import { TrendingUp, ShieldAlert, Award, Clock } from '@lucide/svelte';

    /**
     * DASHBOARD TASK CARD
     * Quick view of pending objectives and shared approvals.
     */

    const tasksQuery = listTasks();
    const data = $derived(tasksQuery.current);
    const loading = $derived(tasksQuery.loading && !data);

    const allTasks = $derived([
        ...(data?.shared || []),
        ...(data?.self || []),
        ...(data?.direct || [])
    ]);
</script>

<div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col group">
    <div class="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
        <div class="flex items-center gap-3">
            <div
                class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors"
            >
                <svg
                    class="w-5 h-5 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    ></path>
                </svg>
            </div>
            <div>
                <h3 class="font-bold text-gray-900 leading-tight">Objective Center</h3>
                <p class="text-xs text-gray-500 font-medium">Offene Freigaben & Aufgaben</p>
            </div>
        </div>

        {#if allTasks.length > 0}
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                {allTasks.length}
            </span>
        {/if}
    </div>

    <div class="flex-1 p-6">
        {#if loading}
            <LoadingSection message="Warteschlange wird abgerufen..." />
        {:else if allTasks.length === 0}
            <div
                class="h-full flex flex-col items-center justify-center text-center py-8 opacity-40"
            >
                <svg
                    class="w-12 h-12 text-gray-200 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                    ></path>
                </svg>

                <p
                    class="text-[10px] font-black uppercase tracking-widest text-gray-400"
                >Keine offenen Aufgaben</p>
            </div>
        {:else}
            <div class="space-y-3">
                {#each allTasks.slice(0, 3) as task (task.id)}
                    <div class="flex items-center gap-3 p-3 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all">
                        <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 {task.type === 'experience_step_increase' ? 'bg-emerald-100 text-emerald-700' : task.type === 'condition_update_approval' ? 'bg-indigo-100 text-indigo-700' : task.type === 'tenure_anniversary' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}">
                            {#if task.type === 'experience_step_increase'}
                                <TrendingUp class="w-3.5 h-3.5" />
                            {:else if task.type === 'condition_update_approval'}
                                <ShieldAlert class="w-3.5 h-3.5" />
                            {:else if task.type === 'tenure_anniversary'}
                                <Award class="w-3.5 h-3.5" />
                            {:else}
                                <Clock class="w-3.5 h-3.5" />
                            {/if}
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="text-[10px] font-black text-gray-900 uppercase italic truncate">{task.title}</div>
                            <div class="text-[8px] text-gray-400 font-bold uppercase tracking-wider">
                                {task.dueDate ? `Fällig: ${format(new Date(task.dueDate), 'dd.MM.')}` : format(new Date(task.createdAt), 'MMM d, HH:mm')}
                            </div>
                        </div>

                        <a
                            href="/tasks"
                            aria-label="Aufgabe ansehen"
                            class="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-indigo-600 transition-all"
                        >
                            <svg
                                class="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M9 5l7 7-7 7"
                                ></path>
                            </svg>
                        </a>
                    </div>
                {/each}
                
                {#if allTasks.length > 3}
                    <p class="text-[9px] text-center text-gray-400 font-bold uppercase tracking-widest pt-1">
                        + {allTasks.length - 3} weitere Aufgaben
                    </p>
                {/if}
            </div>
        {/if}
    </div>

    <div class="p-4 bg-gray-50/50 border-t border-gray-50">
        <a href="/tasks" class="block text-center text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
            Objective Center öffnen →
        </a>
    </div>
</div>
