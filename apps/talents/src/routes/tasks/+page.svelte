<script lang="ts">
    import TaskList from "$lib/components/tasks/TaskList.svelte";
    import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";

    breadcrumbState.set({ feature: "talents", current: 'Objective Center' });

    let showCompleted = $state(false);
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-100 pb-10">
        <div class="space-y-2">
            <h1 class="text-5xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">Objective Center</h1>
            <p class="text-gray-400 font-bold uppercase tracking-widest text-[10px] ml-1">Strategic queue management and operational oversight</p>
        </div>
        
        <div class="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100 shadow-inner">
            <button 
                onclick={() => showCompleted = false}
                class="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all {!showCompleted ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}"
            >
                Pending
            </button>
            <button 
                onclick={() => showCompleted = true}
                class="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all {showCompleted ? 'bg-white text-emerald-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}"
            >
                Completed
            </button>
        </div>
    </header>

    <div class="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <TaskList {showCompleted} />
    </div>
</div>
