<script lang="ts">
    import TaskList from "#lib/components/tasks/TaskList.svelte";
    import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
    import { listTasks, listCompletedTasks } from '../tasks.remote.js';
    import { TrendingUp, ShieldAlert, Award, CheckCircle2 } from '@lucide/svelte';

    breadcrumbState.set({ feature: "tasks", current: 'Objective Center' });

    let showCompleted = $state(false);

    const activeQuery = listTasks();
    const completedQuery = listCompletedTasks();

    const activeData = $derived(activeQuery.current);
    const completedData = $derived(completedQuery.current);

    const sharedCount = $derived(
        Array.isArray((activeData as any)?.shared) ? (activeData as any).shared.length : 0
    );
    const selfCount = $derived(
        Array.isArray((activeData as any)?.self) ? (activeData as any).self.length : 0
    );
    const directCount = $derived(
        Array.isArray((activeData as any)?.direct) ? (activeData as any).direct.length : 0
    );
    const completedCount = $derived(
        Array.isArray(completedData) ? (completedData as any[]).length : 0
    );
    const totalPendingCount = $derived(sharedCount + selfCount + directCount);
</script>

<svelte:head>
    <title>Objective Center · AC Talents</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
    <!-- Header -->
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-100 pb-8">
        <div class="space-y-2">
            <div class="flex items-center gap-3">
                <span class="w-2.5 h-10 bg-indigo-600 rounded-full"></span>
                <h1 class="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">
                    Objective Center
                </h1>
            </div>
            <p class="text-gray-400 font-bold uppercase tracking-widest text-[10px] ml-5">
                Tarifliche Stufenaufstiege, Dienstjubiläen & strategische Management-Freigaben
            </p>
        </div>
        
        <div class="flex items-center gap-3 flex-wrap">
            <a 
                href="/contacts/obfuscations"
                class="px-5 py-2.5 rounded-2xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm"
            >
                <ShieldAlert class="w-4 h-4 text-rose-600" />
                DSGVO Obfuskierungen
            </a>

            <!-- Status Switcher -->
            <div class="flex bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200/80 shadow-inner">
                <button 
                    type="button"
                    onclick={() => showCompleted = false}
                    class="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 {!showCompleted ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}"
                >
                    Offen ({totalPendingCount})
                </button>
                <button 
                    type="button"
                    onclick={() => showCompleted = true}
                    class="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 {showCompleted ? 'bg-white text-emerald-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}"
                >
                    Erledigt ({completedCount})
                </button>
            </div>
        </div>
    </header>

    <!-- Metrics Stats Overview Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <!-- Shared Management Approvals -->
        <div class="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-1 relative overflow-hidden">
            <div class="flex items-center justify-between text-indigo-600">
                <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Management & HR</span>
                <ShieldAlert class="w-4 h-4" />
            </div>
            <div class="text-3xl font-black text-gray-900">{sharedCount}</div>
            <p class="text-[10px] text-gray-400 font-medium">Gemeinsame Freigaben</p>
        </div>

        <!-- Personal Objectives -->
        <div class="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-1 relative overflow-hidden">
            <div class="flex items-center justify-between text-indigo-600">
                <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Persönlich</span>
                <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
            </div>
            <div class="text-3xl font-black text-gray-900">{selfCount}</div>
            <p class="text-[10px] text-gray-400 font-medium">Offene Aufgaben</p>
        </div>

        <!-- Direct Line -->
        <div class="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-1 relative overflow-hidden">
            <div class="flex items-center justify-between text-emerald-600">
                <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Team</span>
                <TrendingUp class="w-4 h-4" />
            </div>
            <div class="text-3xl font-black text-gray-900">{directCount}</div>
            <p class="text-[10px] text-gray-400 font-medium">Direkte Berichte</p>
        </div>

        <!-- Completed History -->
        <div class="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-1 relative overflow-hidden">
            <div class="flex items-center justify-between text-emerald-600">
                <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Archiv</span>
                <CheckCircle2 class="w-4 h-4" />
            </div>
            <div class="text-3xl font-black text-gray-900">{completedCount}</div>
            <p class="text-[10px] text-gray-400 font-medium">Erledigte Historie</p>
        </div>
    </div>

    <!-- Main Content Area -->
    <div class="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <TaskList {showCompleted} />
    </div>
</div>
