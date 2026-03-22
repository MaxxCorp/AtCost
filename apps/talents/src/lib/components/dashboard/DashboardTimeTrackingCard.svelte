<script lang="ts">
    import { Clock, Play, Square, MapPin, Calendar } from "@lucide/svelte";
    import { Button } from "@ac/ui/components/button";
    import { format } from "date-fns";
    import { clockIn, clockOut } from "../../../routes/timesheets/timesheets.remote";
    import { toast } from "svelte-sonner";

    let { status, talentId, onRefresh } = $props<{ status: any, talentId: string, onRefresh: () => void }>();

    const isActive = $derived(!!status?.activeEntry);

    async function handleClockIn() {
        try {
            await (clockIn as any)({ talentId, type: 'manual' });
            toast.success("Clocked in successfully");
            onRefresh();
        } catch (e: any) {
            toast.error(e.message || "Failed to clock in");
        }
    }

    async function handleClockOut() {
        try {
            await (clockOut as any)({ entryId: status.activeEntry.id, talentId });
            toast.success("Clocked out successfully");
            onRefresh();
        } catch (e: any) {
            toast.error(e.message || "Failed to clock out");
        }
    }
</script>

<div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
    <div class="p-6 bg-gradient-to-br from-emerald-50/50 to-white flex-1">
        <div class="flex justify-between items-start mb-6">
            <div class="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Clock size={24} />
            </div>
            {#if isActive}
                <div class="bg-emerald-100 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full animate-pulse border border-emerald-200">
                    ACTIVE
                </div>
            {/if}
        </div>

        <h2 class="text-xl font-bold text-gray-900 mb-1">Time Tracking</h2>
        {#if isActive}
            <p class="text-emerald-600 font-medium text-sm mb-6">Started at {format(new Date(status.activeEntry.startTime), 'HH:mm')}</p>
        {:else}
            <p class="text-gray-500 font-medium text-sm mb-6">Ready for your shift?</p>
        {/if}

        <div class="flex gap-3 mt-auto">
            {#if !isActive}
                <Button onclick={handleClockIn} class="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl text-lg font-semibold shadow-lg shadow-emerald-100">
                    <Play size={18} class="mr-2" />
                    Clock In
                </Button>
            {:else}
                <Button onclick={handleClockOut} class="flex-1 bg-rose-600 hover:bg-rose-700 h-12 rounded-xl text-lg font-semibold shadow-lg shadow-rose-100">
                    <Square size={18} class="mr-2" />
                    Clock Out
                </Button>
            {/if}
        </div>
    </div>

    {#if status?.shiftPlans?.length > 0}
        {@const nextShift = status.shiftPlans[0]}
        <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-gray-500">
                <Calendar size={14} />
                <span>Next: {format(new Date(nextShift.startTime), 'MMM d, HH:mm')}</span>
            </div>
            {#if nextShift.locationId}
                <div class="flex items-center gap-1 text-gray-400">
                    <MapPin size={12} />
                    <span>Lobby A</span>
                </div>
            {/if}
        </div>
    {/if}
</div>
