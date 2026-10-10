<script lang="ts">
    import type { ShiftDetail, ShiftActivity } from "@ac/validations";
    import { SCHEDULE_ENTITY_THEMES } from "@ac/validations";
    import { Clock, Coffee, Sparkles, Check, Users } from "@lucide/svelte";

    interface Props {
        shift: ShiftDetail;
        onclick?: () => void;
    }

    let { shift, onclick }: Props = $props();

    const themeStyles: Record<string, { bg: string; border: string; text: string; badge: string; pill: string }> = {
        blue: { bg: "bg-blue-50/90 hover:bg-blue-100/90", border: "border-blue-200", text: "text-blue-900", badge: "bg-blue-200/80 text-blue-800", pill: "bg-blue-600" },
        green: { bg: "bg-emerald-50/90 hover:bg-emerald-100/90", border: "border-emerald-200", text: "text-emerald-900", badge: "bg-emerald-200/80 text-emerald-800", pill: "bg-emerald-600" },
        purple: { bg: "bg-purple-50/90 hover:bg-purple-100/90", border: "border-purple-200", text: "text-purple-900", badge: "bg-purple-200/80 text-purple-800", pill: "bg-purple-600" },
        pink: { bg: "bg-pink-50/90 hover:bg-pink-100/90", border: "border-pink-200", text: "text-pink-900", badge: "bg-pink-200/80 text-pink-800", pill: "bg-pink-600" },
        yellow: { bg: "bg-amber-50/90 hover:bg-amber-100/90", border: "border-amber-200", text: "text-amber-900", badge: "bg-amber-200/80 text-amber-800", pill: "bg-amber-600" },
        gray: { bg: "bg-slate-100/90 hover:bg-slate-200/90", border: "border-slate-300", text: "text-slate-800", badge: "bg-slate-200 text-slate-700", pill: "bg-slate-600" },
        darkBlue: { bg: "bg-indigo-50/90 hover:bg-indigo-100/90", border: "border-indigo-200", text: "text-indigo-950", badge: "bg-indigo-200/80 text-indigo-900", pill: "bg-indigo-600" },
        darkGreen: { bg: "bg-teal-50/90 hover:bg-teal-100/90", border: "border-teal-200", text: "text-teal-950", badge: "bg-teal-200/80 text-teal-900", pill: "bg-teal-600" },
        darkPurple: { bg: "bg-fuchsia-50/90 hover:bg-fuchsia-100/90", border: "border-fuchsia-200", text: "text-fuchsia-950", badge: "bg-fuchsia-200/80 text-fuchsia-900", pill: "bg-fuchsia-600" },
        darkPink: { bg: "bg-rose-50/90 hover:bg-rose-100/90", border: "border-rose-200", text: "text-rose-950", badge: "bg-rose-200/80 text-rose-900", pill: "bg-rose-600" },
        darkYellow: { bg: "bg-orange-50/90 hover:bg-orange-100/90", border: "border-orange-200", text: "text-orange-950", badge: "bg-orange-200/80 text-orange-900", pill: "bg-orange-600" },
        white: { bg: "bg-white hover:bg-gray-50", border: "border-gray-200", text: "text-gray-900", badge: "bg-gray-100 text-gray-700", pill: "bg-gray-500" },
    };

    const currentStyle = $derived(themeStyles[shift.theme] || themeStyles.blue);

    function formatTime(isoStr: string) {
        const d = new Date(isoStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const timeRange = $derived(`${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`);

    const durationHours = $derived.by(() => {
        const start = new Date(shift.startTime).getTime();
        const end = new Date(shift.endTime).getTime();
        const diffHours = (end - start) / (1000 * 60 * 60);
        return diffHours > 0 ? `${diffHours.toFixed(1)}h` : "0h";
    });

    const unpaidBreaksCount = $derived(
        (shift.activities as ShiftActivity[] || []).filter(a => !a.isPaid).length
    );

    const isOpenShift = $derived(!shift.talentId);
</script>

<button
    type="button"
    {onclick}
    class={[
        "w-full text-left p-2.5 rounded-xl border transition-all duration-150 group relative shadow-xs hover:shadow-md cursor-pointer select-none",
        currentStyle.bg,
        shift.isShared ? currentStyle.border : "border-dashed border-purple-400 bg-white/90"
    ]}
>
    <!-- Left Theme Color Stripe -->
    <div class={["absolute left-0 top-2 bottom-2 w-1 rounded-r-full", currentStyle.pill]}></div>

    <div class="pl-2 space-y-1">
        <!-- Top Status Row -->
        <div class="flex items-center justify-between gap-1">
            <span class="text-xs font-bold tracking-tight {currentStyle.text} flex items-center gap-1">
                <Clock size={11} class="opacity-70 shrink-0" />
                {timeRange}
            </span>

            <div class="flex items-center gap-1 shrink-0">
                {#if !shift.isShared}
                    <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200">
                        Draft
                    </span>
                {/if}
                <span class="text-[10px] font-semibold px-1 py-0.2 rounded {currentStyle.badge}">
                    {durationHours}
                </span>
            </div>
        </div>

        <!-- Shift Display Name or Group -->
        <div class="text-xs font-semibold text-gray-800 truncate leading-snug">
            {#if shift.displayName}
                {shift.displayName}
            {:else if isOpenShift}
                <span class="text-purple-700 flex items-center gap-1">
                    <Users size={11} />
                    Open ({shift.openSlotCount} {shift.openSlotCount === 1 ? 'slot' : 'slots'})
                </span>
            {:else if shift.schedulingGroupName}
                <span class="text-gray-600">{shift.schedulingGroupName}</span>
            {:else}
                <span class="text-gray-500 italic">Shift</span>
            {/if}
        </div>

        <!-- Meta Footer: Breaks & Activities Indicator -->
        {#if unpaidBreaksCount > 0 || (shift.notes && shift.notes.trim())}
            <div class="flex items-center gap-2 pt-0.5 text-[10px] text-gray-500 font-medium">
                {#if unpaidBreaksCount > 0}
                    <span class="flex items-center gap-0.5 text-amber-700">
                        <Coffee size={10} />
                        {unpaidBreaksCount} break
                    </span>
                {/if}
                {#if shift.notes}
                    <span class="truncate text-gray-400 max-w-[120px]">{shift.notes}</span>
                {/if}
            </div>
        {/if}
    </div>
</button>
