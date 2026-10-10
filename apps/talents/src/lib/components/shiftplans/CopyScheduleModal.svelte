<script lang="ts">
    import { copySchedule } from "../../../routes/shiftplans/shifts.remote";
    import { Button, AsyncButton } from "@ac/ui";
    import { X, Copy, Calendar, Users, ArrowRight } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    interface Props {
        isOpen: boolean;
        currentWeekMonday: Date;
        locationId?: string;
        onclose: () => void;
        onSuccess: () => void;
    }

    let {
        isOpen = $bindable(),
        currentWeekMonday,
        locationId,
        onclose,
        onSuccess,
    }: Props = $props();

    function padZero(n: number) {
        return n < 10 ? `0${n}` : `${n}`;
    }

    function formatDateInput(d: Date) {
        return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
    }

    function formatDisplayDate(d: Date) {
        return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
    }

    const currentWeekSunday = $derived(
        new Date(currentWeekMonday.getTime() + 6 * 24 * 60 * 60 * 1000 + 86399999)
    );

    const defaultNextMonday = $derived(
        new Date(currentWeekMonday.getTime() + 7 * 24 * 60 * 60 * 1000)
    );

    // svelte-ignore state_referenced_locally
    let targetDateStr = $state(formatDateInput(defaultNextMonday));
    let includeAssigned = $state(true);
    let isCopying = $state(false);

    async function handleCopy() {
        if (!targetDateStr) {
            toast.error("Please select a target week start date");
            return;
        }

        const targetMonday = new Date(`${targetDateStr}T00:00:00`);

        isCopying = true;
        try {
            const result = await copySchedule({
                sourceStartDate: currentWeekMonday.toISOString(),
                sourceEndDate: currentWeekSunday.toISOString(),
                targetStartDate: targetMonday.toISOString(),
                locationId: locationId || undefined,
                includeAssignedTalents: includeAssigned,
            });

            toast.success(`${result.copiedCount} shifts copied to target week as drafts`);
            onSuccess();
            onclose();
        } catch (error: any) {
            toast.error(error?.message || "Failed to copy schedule");
        } finally {
            isCopying = false;
        }
    }
</script>

{#if isOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <!-- Header -->
            <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50/50 to-blue-50/50">
                <div class="flex items-center gap-3">
                    <div class="p-2.5 bg-purple-100 text-purple-700 rounded-2xl shadow-xs">
                        <Copy size={20} />
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-gray-900 tracking-tight">Copy Schedule</h2>
                        <p class="text-xs text-gray-500 font-medium">Replicate this week's shift pattern to future weeks.</p>
                    </div>
                </div>

                <button
                    type="button"
                    onclick={onclose}
                    class="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            <!-- Body -->
            <div class="p-6 space-y-5">
                <!-- Source Week Card -->
                <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-1.5">
                    <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Source Week</span>
                    <p class="text-sm font-black text-gray-800 flex items-center gap-2">
                        <Calendar size={14} class="text-purple-500" />
                        {formatDisplayDate(currentWeekMonday)} – {formatDisplayDate(currentWeekSunday)}
                    </p>
                </div>

                <div class="flex items-center justify-center -my-2 text-purple-400">
                    <ArrowRight size={20} class="rotate-90" />
                </div>

                <!-- Target Week Input -->
                <div>
                    <label for="target-monday-date" class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Target Week (Monday)
                    </label>
                    <input
                        id="target-monday-date"
                        type="date"
                        bind:value={targetDateStr}
                        class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
                    />
                    <p class="text-[11px] text-gray-400 mt-1">Shifts will be created as unpublished drafts for this week.</p>
                </div>

                <!-- Options -->
                <div class="p-3.5 bg-purple-50/60 border border-purple-100 rounded-2xl">
                    <label class="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            bind:checked={includeAssigned}
                            class="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                            <span class="text-xs font-bold text-purple-900 block">Keep assigned team members</span>
                            <span class="text-[11px] text-purple-600 block">
                                If unchecked, shifts will be copied as unassigned Open Shifts.
                            </span>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onclick={onclose} disabled={isCopying}>
                    Cancel
                </Button>
                <AsyncButton
                    onclick={handleCopy}
                    loading={isCopying}
                    class="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs"
                >
                    Copy Shifts
                </AsyncButton>
            </div>
        </div>
    </div>
{/if}
