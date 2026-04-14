<script lang="ts">
    import { onMount } from "svelte";
    import { fetchTalentTimeOff } from "../../../routes/shiftplans/associate.remote";
    import { AlertTriangle, CheckCircle2, Clock } from "@lucide/svelte";

    let { talent } = $props<{ talent: any }>();

    let timeOffRequests = $state<any[]>([]);
    let loading = $state(true);

    onMount(async () => {
        try {
            timeOffRequests = await fetchTalentTimeOff([talent.id]);
        } catch (e) {
            console.error("Failed to fetch time off for talent", e);
        } finally {
            loading = false;
        }
    });

    const hasUpcomingTimeOff = $derived(timeOffRequests.length > 0);
</script>

<div class="flex items-center gap-2">
    {#if loading}
        <Clock size={14} class="text-gray-400 animate-pulse" />
    {:else if hasUpcomingTimeOff}
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700">
            <AlertTriangle size={12} />
            <span class="text-[10px] font-medium leading-none">Time Off Soon</span>
        </div>
    {:else}
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
            <CheckCircle2 size={12} />
            <span class="text-[10px] font-medium leading-none">Available</span>
        </div>
    {/if}
</div>
