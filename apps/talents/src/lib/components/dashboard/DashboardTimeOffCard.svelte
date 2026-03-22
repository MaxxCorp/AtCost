<script lang="ts">
    import { Umbrella, Plus, History, Clock } from "@lucide/svelte";
    import { Button } from "@ac/ui/components/button";

    let { balances, requests, talentId, onRefresh } = $props<{ balances: any[], requests: any[], talentId: string, onRefresh: () => void }>();

    const vacationBalance = $derived(balances.find((b: any) => b.year === new Date().getFullYear()) || { totalDays: 25, usedDays: 0, pendingDays: 0 });
    const remainingDays = $derived(vacationBalance.totalDays - vacationBalance.usedDays - vacationBalance.pendingDays);
</script>

<div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
    <div class="p-6 bg-gradient-to-br from-rose-50/50 to-white flex-1">
        <div class="flex justify-between items-start mb-6">
            <div class="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                <Umbrella size={24} />
            </div>
            <Button variant="outline" size="sm" class="gap-2">
                <Plus size={14} />
                Request Time Off
            </Button>
        </div>

        <h2 class="text-xl font-bold text-gray-900 mb-1">Time Off</h2>
        <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-black text-gray-900">{remainingDays}</span>
            <span class="text-gray-500 text-sm font-medium">days remaining</span>
        </div>

        <div class="mt-6 space-y-3">
            <div class="flex justify-between text-xs font-medium">
                <span class="text-gray-500">Total Allowance</span>
                <span class="text-gray-900">{vacationBalance.totalDays} days</span>
            </div>
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full bg-rose-500 transition-all duration-500" style={`width: ${(vacationBalance.usedDays / vacationBalance.totalDays) * 100}%`}></div>
            </div>
            <div class="flex justify-between text-[10px] text-gray-400">
                <span>{vacationBalance.usedDays} used</span>
                <span>{vacationBalance.pendingDays} pending</span>
            </div>
        </div>
    </div>

    {#if requests?.length > 0}
        <div class="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <History size={10} />
                Recent Requests
            </h3>
            <div class="space-y-2">
                {#each requests as req}
                    <div class="flex justify-between items-center text-[11px]">
                        <span class="text-gray-700">{new Date(req.startDate).toLocaleDateString()}</span>
                        <span class={`px-1.5 py-0.5 rounded-full font-bold uppercase {
                            req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            req.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {req.status}
                        </span>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>
