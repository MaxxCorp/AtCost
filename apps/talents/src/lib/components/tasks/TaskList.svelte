<script lang="ts">
    import TaskItem from './TaskItem.svelte';
    import TaskConfigModal from './TaskConfigModal.svelte';
    import { LoadingSection } from '@ac/ui';
    import { listTasks, listCompletedTasks, runTaskCheck } from '../../../routes/tasks.remote.js';
    import { slide } from 'svelte/transition';
    import {
        ShieldAlert,
        Sparkles,
        TrendingUp,
        Award,
        Clock,
        Filter,
        Search,
        X,
        SlidersHorizontal,
        RefreshCw,
        CheckCircle2,
        UserCheck,
        Users,
    } from '@lucide/svelte';
    import { toast } from 'svelte-sonner';
    import { AsyncButton } from '@ac/ui';

    let { showCompleted = false } = $props<{ showCompleted?: boolean }>();

    const activeTasksQuery = listTasks();
    const completedTasksQuery = listCompletedTasks();

    const rtc = runTaskCheck;

    const currentQuery = $derived(showCompleted ? completedTasksQuery : activeTasksQuery);
    const rawData = $derived(currentQuery.current);
    const loading = $derived(currentQuery.loading && !rawData);

    // Filter states
    let searchQuery = $state('');
    let selectedType = $state<string>('all');
    let selectedUrgency = $state<'all' | 'due_soon' | 'overdue'>('all');
    let activeTab = $state<'shared' | 'self' | 'team'>('shared');
    let subordinatesExpanded = $state(false);
    let isConfigModalOpen = $state(false);

    // Helper filter function
    function filterTask(t: any): boolean {
        if (!t) return false;

        // Type filter
        if (selectedType !== 'all') {
            if (t.type !== selectedType) return false;
        }

        // Urgency filter
        if (selectedUrgency !== 'all' && t.dueDate) {
            const due = new Date(t.dueDate).getTime();
            const now = Date.now();
            const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

            if (selectedUrgency === 'overdue' && diffDays >= 0) return false;
            if (selectedUrgency === 'due_soon' && (diffDays < 0 || diffDays > 30)) return false;
        }

        // Search text
        if (searchQuery.trim().length > 0) {
            const q = searchQuery.toLowerCase();
            const title = (t.title || '').toLowerCase();
            const desc = (t.description || '').toLowerCase();
            const assignee = t.assignee?.contact
                ? `${t.assignee.contact.firstName} ${t.assignee.contact.lastName}`.toLowerCase()
                : '';
            const talent = t.data?.talentName ? String(t.data.talentName).toLowerCase() : '';
            return title.includes(q) || desc.includes(q) || assignee.includes(q) || talent.includes(q);
        }

        return true;
    }

    // Filtered data collections
    const sharedTasks = $derived(
        Array.isArray((rawData as any)?.shared) ? (rawData as any).shared.filter(filterTask) : []
    );
    const selfTasks = $derived(
        Array.isArray((rawData as any)?.self) ? (rawData as any).self.filter(filterTask) : []
    );
    const directTasks = $derived(
        Array.isArray((rawData as any)?.direct) ? (rawData as any).direct.filter(filterTask) : []
    );
    const subordinateTasks = $derived(
        Array.isArray((rawData as any)?.subordinates) ? (rawData as any).subordinates.filter(filterTask) : []
    );
    const completedList = $derived(
        Array.isArray(rawData) ? (rawData as any[]).filter(filterTask) : []
    );

    const stepTasksCount = $derived(
        sharedTasks.filter((t: any) => t.type === 'experience_step_increase').length
    );
    const anniversaryTasksCount = $derived(
        sharedTasks.filter((t: any) => t.type === 'tenure_anniversary').length
    );
    const conditionTasksCount = $derived(
        sharedTasks.filter((t: any) => t.type === 'condition_update_approval').length
    );
</script>

<div class="space-y-8">
    <!-- Top Action & Filter Toolbar -->
    <div class="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <!-- Search Input -->
            <div class="relative flex-1 max-w-md">
                <Search class="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Aufgaben, Mitarbeiter, Stufen oder Entgelt durchsuchen..."
                    class="w-full pl-10 pr-9 py-2.5 bg-gray-50 hover:bg-gray-100/80 focus:bg-white rounded-2xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                />
                {#if searchQuery}
                    <button
                        type="button"
                        onclick={() => searchQuery = ''}
                        class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                    >
                        <X class="w-3 h-3" />
                    </button>
                {/if}
            </div>

            <!-- Toolbar Action Buttons -->
            <div class="flex items-center gap-2 flex-wrap">
                <!-- Trigger Runner Form -->
                <form
                    {...rtc.enhance(async ({ submit }) => {
                        const res = await submit() as any;
                        if (res?.success) {
                            toast.success(res.message || 'Prüflauf erfolgreich durchgeführt!');
                            void activeTasksQuery.refresh();
                            void completedTasksQuery.refresh();
                        }
                    })}
                >
                    {#if true}
                        <input {...rtc.fields.force.as('hidden', false)} />
                    {/if}
                    <AsyncButton
                        type="submit"
                        loading={rtc.pending}
                        class="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider bg-gray-50 hover:bg-indigo-50 text-indigo-700 border border-gray-200 hover:border-indigo-200 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <RefreshCw class="w-3.5 h-3.5 {rtc.pending ? 'animate-spin' : ''}" />
                        Prüflauf starten
                    </AsyncButton>
                </form>

                <!-- Open Config Modal Button -->
                <button
                    type="button"
                    onclick={() => isConfigModalOpen = true}
                    class="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                    <SlidersHorizontal class="w-3.5 h-3.5" />
                    Vorlaufzeiten & Regeln
                </button>
            </div>
        </div>

        <!-- Filter Chips & Urgency Pills -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
            <!-- Type Filter Buttons -->
            <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1 flex items-center gap-1">
                    <Filter class="w-3 h-3" />
                    Typ:
                </span>
                <button
                    type="button"
                    onclick={() => selectedType = 'all'}
                    class="px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all {selectedType === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                >
                    Alle
                </button>
                <button
                    type="button"
                    onclick={() => selectedType = 'experience_step_increase'}
                    class="px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 {selectedType === 'experience_step_increase' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}"
                >
                    <TrendingUp class="w-3 h-3" />
                    Stufenaufstiege ({stepTasksCount})
                </button>
                <button
                    type="button"
                    onclick={() => selectedType = 'tenure_anniversary'}
                    class="px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 {selectedType === 'tenure_anniversary' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}"
                >
                    <Award class="w-3 h-3" />
                    Dienstjubiläen ({anniversaryTasksCount})
                </button>
                <button
                    type="button"
                    onclick={() => selectedType = 'condition_update_approval'}
                    class="px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 {selectedType === 'condition_update_approval' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'}"
                >
                    <ShieldAlert class="w-3 h-3" />
                    Tarif & HMO ({conditionTasksCount})
                </button>
            </div>

            <!-- Urgency Pills -->
            <div class="flex items-center gap-1.5 self-start sm:self-auto">
                <span class="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1 flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    Fälligkeit:
                </span>
                <button
                    type="button"
                    onclick={() => selectedUrgency = 'all'}
                    class="px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider {selectedUrgency === 'all' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}"
                >
                    Alle
                </button>
                <button
                    type="button"
                    onclick={() => selectedUrgency = 'due_soon'}
                    class="px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider {selectedUrgency === 'due_soon' ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-50'}"
                >
                    ≤ 30 Tage
                </button>
                <button
                    type="button"
                    onclick={() => selectedUrgency = 'overdue'}
                    class="px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider {selectedUrgency === 'overdue' ? 'bg-rose-600 text-white' : 'text-rose-600 hover:bg-rose-50'}"
                >
                    Überfällig
                </button>
            </div>
        </div>
    </div>

    {#if loading}
        <LoadingSection message="Warteschlange wird synchronisiert..." />
    {:else if showCompleted}
        <!-- Completed History View -->
        <div class="space-y-4">
            <div class="flex items-center gap-4 mb-6">
                <h2 class="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Erledigte Aufgaben</h2>
                <div class="h-px flex-1 bg-gray-100"></div>
                <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">{completedList.length} Einträge</span>
            </div>

            {#if completedList.length === 0}
                <div class="p-12 border-2 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center justify-center text-center">
                    <CheckCircle2 class="w-10 h-10 text-gray-200 mb-2" />
                    <p class="text-sm font-bold text-gray-300 uppercase tracking-widest">Keine erledigten Aufgaben im Filter</p>
                </div>
            {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each completedList as task (task.id)}
                        <div class="opacity-75 hover:opacity-100 transition-all">
                            <TaskItem {task} />
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {:else}
        <!-- Tab Navigation for Active Tasks -->
        <div class="flex items-center gap-2 border-b border-gray-200 pb-2">
            <button
                type="button"
                onclick={() => activeTab = 'shared'}
                class="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 {activeTab === 'shared' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}"
            >
                <ShieldAlert class="w-4 h-4" />
                Gemeinsame Freigaben
                {#if sharedTasks.length > 0}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black {activeTab === 'shared' ? 'bg-white text-indigo-600' : 'bg-indigo-100 text-indigo-700'}">
                        {sharedTasks.length}
                    </span>
                {/if}
            </button>

            <button
                type="button"
                onclick={() => activeTab = 'self'}
                class="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 {activeTab === 'self' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}"
            >
                <UserCheck class="w-4 h-4" />
                Meine Aufgaben
                {#if selfTasks.length > 0}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black {activeTab === 'self' ? 'bg-white text-indigo-600' : 'bg-gray-200 text-gray-700'}">
                        {selfTasks.length}
                    </span>
                {/if}
            </button>

            <button
                type="button"
                onclick={() => activeTab = 'team'}
                class="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 {activeTab === 'team' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}"
            >
                <Users class="w-4 h-4" />
                Team & Direkte Berichte
                {#if directTasks.length + subordinateTasks.length > 0}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black {activeTab === 'team' ? 'bg-white text-indigo-600' : 'bg-gray-200 text-gray-700'}">
                        {directTasks.length + subordinateTasks.length}
                    </span>
                {/if}
            </button>
        </div>

        <!-- 1. Shared Management Tasks Tab -->
        {#if activeTab === 'shared'}
            <div class="space-y-6">
                {#if sharedTasks.length > 0}
                    <section class="space-y-6 p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-50/80 via-white to-emerald-50/50 border-2 border-indigo-200/60 shadow-lg shadow-indigo-100/50 relative overflow-hidden">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30">
                                    <ShieldAlert size={24} />
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h2 class="text-2xl font-black text-gray-900 uppercase italic tracking-tight">
                                            Gemeinsame Management-Warteschlange
                                        </h2>
                                        <span class="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                                            {sharedTasks.length}
                                        </span>
                                    </div>
                                    <p class="text-xs text-indigo-950 font-medium">
                                        Periodische Stufenaufstiege, tarifliche Jubiläen und HMO-/Tarifkonditionen zur Freigabe für Admins, HR Manager und Geschäftsführung.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            {#each sharedTasks as task (task.id)}
                                <TaskItem {task} />
                            {/each}
                        </div>
                    </section>
                {:else}
                    <div class="p-16 border-2 border-dashed border-gray-100 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-3">
                        <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 class="w-8 h-8" />
                        </div>
                        <h3 class="text-base font-black text-gray-900 uppercase tracking-tight">Keine ausstehenden Management-Freigaben</h3>
                        <p class="text-xs text-gray-400 max-w-md">
                            Alle periodischen Stufenaufstiege, Dienstjubiläen und Tarifaktualisierungen sind bearbeitet oder liegen außerhalb der konfigurierten Vorlaufzeiten.
                        </p>
                    </div>
                {/if}
            </div>

        <!-- 2. Personal Objectives Tab -->
        {:else if activeTab === 'self'}
            <section class="space-y-6">
                {#if selfTasks.length === 0}
                    <div class="p-16 border-2 border-dashed border-gray-100 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                        <CheckCircle2 class="w-12 h-12 text-gray-200 mb-2" />
                        <h3 class="text-sm font-black text-gray-400 uppercase tracking-widest">Keine offenen persönlichen Aufgaben</h3>
                    </div>
                {:else}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {#each selfTasks as task (task.id)}
                            <TaskItem {task} />
                        {/each}
                    </div>
                {/if}
            </section>

        <!-- 3. Direct Line & Hierarchy Tab -->
        {:else if activeTab === 'team'}
            <div class="space-y-8">
                <!-- Direct Reports -->
                <section class="space-y-4">
                    <div class="flex items-center gap-4">
                        <h3 class="text-lg font-black text-gray-900 uppercase italic tracking-tighter">Direkte Berichte</h3>
                        <span class="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{directTasks.length}</span>
                        <div class="h-px flex-1 bg-gray-100"></div>
                    </div>
                    {#if directTasks.length === 0}
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Keine ausstehenden Aktionen für direkte Berichte</p>
                    {:else}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {#each directTasks as task (task.id)}
                                <TaskItem {task} />
                            {/each}
                        </div>
                    {/if}
                </section>

                <!-- Subordinates Tree -->
                <section class="space-y-4">
                    <button 
                        type="button"
                        onclick={() => subordinatesExpanded = !subordinatesExpanded}
                        class="flex items-center gap-4 w-full group outline-none"
                    >
                        <h3 class="text-lg font-black text-gray-400 group-hover:text-gray-600 uppercase italic tracking-tighter transition-colors">
                            Erweiterte Hierarchie
                        </h3>
                        <span class="bg-gray-200 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full">
                            {subordinateTasks.length}
                        </span>
                        <div class="h-px flex-1 bg-gray-100"></div>
                        <svg class="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-all {subordinatesExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    
                    {#if subordinatesExpanded}
                        <div transition:slide={{ duration: 300 }}>
                            {#if subordinateTasks.length === 0}
                                <p class="text-xs font-bold text-gray-300 uppercase tracking-widest ml-1 italic">Keine Aufgaben in der erweiterten Hierarchie</p>
                            {:else}
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                    {#each subordinateTasks as task (task.id)}
                                        <TaskItem {task} />
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                </section>
            </div>
        {/if}
    {/if}
</div>

{#if isConfigModalOpen}
    <TaskConfigModal
        open={true}
        onClose={() => { isConfigModalOpen = false; }}
    />
{/if}
