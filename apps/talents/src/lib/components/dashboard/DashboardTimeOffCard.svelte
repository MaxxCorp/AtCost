<script lang="ts">
    import { Umbrella, Plus, History, ArrowRight } from "@lucide/svelte";
    import { Button } from "@ac/ui/components/button";
    import RequestTimeOffModal from "../time-off/RequestTimeOffModal.svelte";
    import * as m from "#lib/paraglide/messages.js";

    let { balances, requests, talentId, onRefresh }: { balances: any[], requests: any[], talentId: string, onRefresh: () => void } = $props();

    let showModal = $state(false);

    const vacationBalance = $derived(balances.find((b: any) => b.year === new Date().getFullYear()) || { totalDays: 25, usedDays: 0, pendingDays: 0 });
    const remainingDays = $derived(vacationBalance.totalDays - vacationBalance.usedDays - vacationBalance.pendingDays);
</script>

<div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
    <div class="p-6 bg-gradient-to-br from-rose-50/50 to-white flex-1">
        <div class="flex justify-between items-start mb-6">
            <div class="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                <Umbrella size={24} />
            </div>
            <Button
                variant="outline"
                size="sm"
                onclick={() => (showModal = true)}
                class="gap-1.5 font-bold text-xs hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
            >
                <Plus size={14} />
                {m.request_leave ? m.request_leave() : "Request Time Off"}
            </Button>
        </div>

        <div class="flex items-center justify-between">
            <a href="/time-off" class="group flex items-center gap-1.5">
                <h2 class="text-xl font-bold text-gray-900 group-hover:text-rose-600 transition-colors">
                    {m.time_off ? m.time_off() : "Time Off"}
                </h2>
                <ArrowRight size={16} class="text-gray-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all" />
            </a>
        </div>

        <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-black text-gray-900">{remainingDays}</span>
            <span class="text-gray-500 text-sm font-medium">{m.days_remaining ? m.days_remaining() : "days remaining"}</span>
        </div>

        <div class="mt-6 space-y-3">
            <div class="flex justify-between text-xs font-medium">
                <span class="text-gray-500">{m.total_allowance ? m.total_allowance() : "Total Allowance"}</span>
                <span class="text-gray-900 font-semibold">{vacationBalance.totalDays} {m.days ? m.days() : "days"}</span>
            </div>
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full bg-rose-500 transition-all duration-500" style={`width: ${vacationBalance.totalDays > 0 ? (vacationBalance.usedDays / vacationBalance.totalDays) * 100 : 0}%`}></div>
            </div>
            <div class="flex justify-between text-[10px] text-gray-400">
                <span>{vacationBalance.usedDays} {m.used ? m.used() : "used"}</span>
                <span>{vacationBalance.pendingDays} {m.pending ? m.pending() : "pending"}</span>
            </div>
        </div>
    </div>

    {#if requests?.length > 0}
        <div class="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <History size={10} />
                    {m.recent_requests ? m.recent_requests() : "Recent Requests"}
                </h3>
                <a href="/time-off" class="text-[10px] font-bold text-rose-600 hover:text-rose-800">
                    {m.view_all ? m.view_all() : "View all"} →
                </a>
            </div>
            <div class="space-y-2">
                {#each requests.slice(0, 3) as req}
                    <div class="flex justify-between items-center text-[11px]">
                        <span class="text-gray-700">{new Date(req.startDate).toLocaleDateString()}</span>
                        <span class={`px-1.5 py-0.5 rounded-full font-bold uppercase text-[9px] {
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

<RequestTimeOffModal
    bind:open={showModal}
    {talentId}
    onSuccess={onRefresh}
/>
