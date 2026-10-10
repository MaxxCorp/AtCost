<script lang="ts">
    import type { ShiftDetail, ShiftActivity, SchedulingGroupDetail } from "@ac/validations";
    import { createShift, updateShift, deleteShift } from "../../../routes/shiftplans/shifts.remote";
    import { SCHEDULE_ENTITY_THEMES } from "@ac/validations";
    import { Button, AsyncButton } from "@ac/ui";
    import { 
        X, 
        Calendar, 
        Clock, 
        Coffee, 
        Plus, 
        Trash2, 
        Check, 
        Sparkles, 
        Users, 
        MapPin, 
        Tag, 
        FileText 
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    interface Props {
        isOpen: boolean;
        shift?: ShiftDetail | null;
        initialDate?: Date;
        initialTalentId?: string | null;
        initialSchedulingGroupId?: string | null;
        talents: any[];
        schedulingGroups: SchedulingGroupDetail[];
        locations: any[];
        onclose: () => void;
        onSuccess: () => void;
    }

    let {
        isOpen = $bindable(),
        shift = null,
        initialDate,
        initialTalentId = null,
        initialSchedulingGroupId = null,
        talents = [],
        schedulingGroups = [],
        locations = [],
        onclose,
        onSuccess,
    }: Props = $props();

    const isEditing = $derived(!!shift);

    function padZero(n: number) {
        return n < 10 ? `0${n}` : `${n}`;
    }

    function formatDateForInput(d: Date) {
        return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
    }

    // svelte-ignore state_referenced_locally
    const initialStartDate = shift ? new Date(shift.startTime) : (initialDate || new Date());
    // svelte-ignore state_referenced_locally
    const initialEndDate = shift ? new Date(shift.endTime) : new Date();

    // Form states initialized directly from props (Svelte 5 best practice)
    // svelte-ignore state_referenced_locally
    let displayName = $state(shift?.displayName || "");
    // svelte-ignore state_referenced_locally
    let talentId = $state<string | null>(shift ? shift.talentId : (initialTalentId || null));
    // svelte-ignore state_referenced_locally
    let schedulingGroupId = $state<string | null>(shift ? shift.schedulingGroupId : (initialSchedulingGroupId || schedulingGroups[0]?.id || null));
    // svelte-ignore state_referenced_locally
    let locationId = $state<string | null>(shift ? shift.locationId : (locations[0]?.id || null));
    let shiftDate = $state(formatDateForInput(initialStartDate));
    // svelte-ignore state_referenced_locally
    let startTime = $state(shift ? `${padZero(initialStartDate.getHours())}:${padZero(initialStartDate.getMinutes())}` : "09:00");
    // svelte-ignore state_referenced_locally
    let endTime = $state(shift ? `${padZero(initialEndDate.getHours())}:${padZero(initialEndDate.getMinutes())}` : "17:00");
    // svelte-ignore state_referenced_locally
    let theme = $state(shift?.theme || "blue");
    // svelte-ignore state_referenced_locally
    let notes = $state(shift?.notes || "");
    // svelte-ignore state_referenced_locally
    let isShared = $state(shift?.isShared ?? false);
    // svelte-ignore state_referenced_locally
    let openSlotCount = $state(shift?.openSlotCount || 1);
    // svelte-ignore state_referenced_locally
    let activities = $state<ShiftActivity[]>(Array.isArray(shift?.activities) ? [...shift.activities] : []);
    let isSaving = $state(false);
    let isDeleting = $state(false);

    const themeColors: { id: string; label: string; class: string }[] = [
        { id: "blue", label: "Blue", class: "bg-blue-500" },
        { id: "green", label: "Green", class: "bg-emerald-500" },
        { id: "purple", label: "Purple", class: "bg-purple-500" },
        { id: "pink", label: "Pink", class: "bg-pink-500" },
        { id: "yellow", label: "Yellow", class: "bg-amber-500" },
        { id: "darkBlue", label: "Navy", class: "bg-indigo-600" },
        { id: "darkGreen", label: "Teal", class: "bg-teal-600" },
        { id: "gray", label: "Slate", class: "bg-slate-500" },
    ];

    function addBreakActivity() {
        activities = [
            ...activities,
            {
                id: Math.random().toString(36).substring(2, 9),
                displayName: "Rest Break",
                startTime: "12:30",
                endTime: "13:00",
                isPaid: false,
            }
        ];
    }

    function removeBreakActivity(index: number) {
        activities = activities.filter((_, i) => i !== index);
    }

    const calculatedHours = $derived.by(() => {
        if (!shiftDate || !startTime || !endTime) return "0.0";
        const start = new Date(`${shiftDate}T${startTime}:00`).getTime();
        const end = new Date(`${shiftDate}T${endTime}:00`).getTime();
        let totalMs = end - start;
        if (totalMs < 0) totalMs += 24 * 60 * 60 * 1000; // Overnight shift
        const hours = totalMs / (1000 * 60 * 60);
        return hours.toFixed(1);
    });

    async function handleSave() {
        if (!shiftDate || !startTime || !endTime) {
            toast.error("Please enter a valid shift date and time");
            return;
        }

        const startIso = new Date(`${shiftDate}T${startTime}:00`).toISOString();
        let endIso = new Date(`${shiftDate}T${endTime}:00`).toISOString();
        if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
            const nextDayMs = new Date(`${shiftDate}T${endTime}:00`).getTime() + 24 * 60 * 60 * 1000;
            endIso = new Date(nextDayMs).toISOString();
        }

        isSaving = true;
        try {
            if (isEditing && shift) {
                await updateShift({
                    id: shift.id,
                    displayName: displayName || null,
                    talentId: talentId || null,
                    schedulingGroupId: schedulingGroupId || null,
                    locationId: locationId || null,
                    startTime: startIso,
                    endTime: endIso,
                    theme,
                    notes: notes || null,
                    isShared,
                    openSlotCount,
                    activities,
                });
                toast.success("Shift updated successfully");
            } else {
                await createShift({
                    displayName: displayName || undefined,
                    talentId: talentId || null,
                    schedulingGroupId: schedulingGroupId || null,
                    locationId: locationId || null,
                    startTime: startIso,
                    endTime: endIso,
                    theme,
                    notes: notes || undefined,
                    isShared,
                    openSlotCount,
                    activities,
                });
                toast.success("Shift created successfully");
            }

            onSuccess();
            onclose();
        } catch (error: any) {
            toast.error(error?.message || "Failed to save shift");
        } finally {
            isSaving = false;
        }
    }

    async function handleDelete() {
        if (!shift) return;
        if (!window.confirm("Are you sure you want to delete this shift?")) return;

        isDeleting = true;
        try {
            await deleteShift({ id: shift.id });
            toast.success("Shift deleted successfully");
            onSuccess();
            onclose();
        } catch (error: any) {
            toast.error(error?.message || "Failed to delete shift");
        } finally {
            isDeleting = false;
        }
    }
</script>

{#if isOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity">
        <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <!-- Modal Header -->
            <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50/50 via-white to-blue-50/50">
                <div class="flex items-center gap-3">
                    <div class="p-2.5 bg-purple-100 text-purple-700 rounded-2xl shadow-xs">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-gray-900 tracking-tight">
                            {isEditing ? "Edit Shift" : "Add New Shift"}
                        </h2>
                        <p class="text-xs text-gray-500 font-medium">
                            Configure work hours, team assignment, and activities.
                        </p>
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

            <!-- Modal Body (Scrollable) -->
            <div class="p-6 overflow-y-auto space-y-6 flex-1">
                <!-- Assignee & Group Selection -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label for="talent-select" class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Users size={13} class="text-purple-500" />
                            Assigned Staff
                        </label>
                        <select
                            id="talent-select"
                            bind:value={talentId}
                            class="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
                        >
                            <option value={null}>✨ Open Shift (Unassigned)</option>
                            {#each talents as t (t.id)}
                                <option value={t.id}>
                                    {t.contact?.displayName || t.jobTitle || "Staff Member"} {t.jobTitle ? `(${t.jobTitle})` : ""}
                                </option>
                            {/each}
                        </select>
                    </div>

                    <div>
                        <label for="group-select" class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Tag size={13} class="text-purple-500" />
                            Scheduling Group
                        </label>
                        <select
                            id="group-select"
                            bind:value={schedulingGroupId}
                            class="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
                        >
                            <option value={null}>General / No Group</option>
                            {#each schedulingGroups as g (g.id)}
                                <option value={g.id}>{g.name}</option>
                            {/each}
                        </select>
                    </div>
                </div>

                <!-- If Open Shift, display open slots count -->
                {#if !talentId}
                    <div class="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl flex items-center justify-between">
                        <div>
                            <p class="text-xs font-bold text-purple-900">Open Shift Slots</p>
                            <p class="text-[11px] text-purple-600">Available positions for team members to claim</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <input
                                type="number"
                                min="1"
                                max="50"
                                bind:value={openSlotCount}
                                class="w-16 px-2.5 py-1.5 bg-white border border-purple-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-purple-500"
                            />
                            <span class="text-xs font-bold text-purple-700">slots</span>
                        </div>
                    </div>
                {/if}

                <!-- Shift Title / Label -->
                <div>
                    <label for="shift-label" class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <FileText size={13} class="text-purple-500" />
                        Shift Title / Role Label
                    </label>
                    <input
                        id="shift-label"
                        type="text"
                        placeholder="e.g. Morning Shift, Opening Barista, Supervisor"
                        bind:value={displayName}
                        class="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
                    />
                </div>

                <!-- Date & Times -->
                <div class="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/70 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                            <Calendar size={13} class="text-purple-500" />
                            Work Timing
                        </span>
                        <span class="text-xs font-black text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">
                            Total: {calculatedHours} hrs
                        </span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label for="shift-date" class="block text-[11px] font-semibold text-gray-500 mb-1">Date</label>
                            <input
                                id="shift-date"
                                type="date"
                                bind:value={shiftDate}
                                class="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>

                        <div>
                            <label for="start-time" class="block text-[11px] font-semibold text-gray-500 mb-1">Start Time</label>
                            <input
                                id="start-time"
                                type="time"
                                bind:value={startTime}
                                class="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>

                        <div>
                            <label for="end-time" class="block text-[11px] font-semibold text-gray-500 mb-1">End Time</label>
                            <input
                                id="end-time"
                                type="time"
                                bind:value={endTime}
                                class="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                <!-- Color Theme Swatches (MS Teams scheduleEntityTheme) -->
                <div>
                    <span class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Color Theme
                    </span>
                    <div class="flex items-center gap-2 flex-wrap">
                        {#each themeColors as tc (tc.id)}
                            <button
                                type="button"
                                onclick={() => theme = tc.id}
                                class={[
                                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer relative shadow-2xs hover:scale-105",
                                    tc.class,
                                    theme === tc.id ? "ring-3 ring-purple-600 ring-offset-2 scale-105" : "opacity-85 hover:opacity-100"
                                ]}
                                title={tc.label}
                            >
                                {#if theme === tc.id}
                                    <Check size={14} class="text-white drop-shadow-md stroke-[3]" />
                                {/if}
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Breaks & Activities Section -->
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Coffee size={13} class="text-purple-500" />
                            Breaks & Tasks ({activities.length})
                        </label>
                        <button
                            type="button"
                            onclick={addBreakActivity}
                            class="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                            <Plus size={13} />
                            Add Break
                        </button>
                    </div>

                    {#if activities.length > 0}
                        <div class="space-y-2">
                            {#each activities as act, index (act.id || index)}
                                <div class="p-3 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center gap-3">
                                    <input
                                        type="text"
                                        placeholder="Break or Task Name"
                                        bind:value={act.displayName}
                                        class="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-purple-500"
                                    />
                                    <input
                                        type="time"
                                        bind:value={act.startTime}
                                        class="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-purple-500"
                                    />
                                    <span class="text-gray-400 text-xs">to</span>
                                    <input
                                        type="time"
                                        bind:value={act.endTime}
                                        class="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-purple-500"
                                    />
                                    <label class="flex items-center gap-1 text-[11px] font-bold text-gray-600 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            bind:checked={act.isPaid}
                                            class="rounded text-purple-600 focus:ring-purple-500"
                                        />
                                        Paid
                                    </label>
                                    <button
                                        type="button"
                                        onclick={() => removeBreakActivity(index)}
                                        class="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Notes / Instructions -->
                <div>
                    <label for="shift-notes" class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Notes & Instructions
                    </label>
                    <textarea
                        id="shift-notes"
                        rows="2"
                        placeholder="Add special instructions or shift requirements..."
                        bind:value={notes}
                        class="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none resize-none"
                    ></textarea>
                </div>

                <!-- Publishing Status Toggle (MS Teams draftShift vs sharedShift) -->
                <div class="p-4 bg-gradient-to-r from-purple-50/60 to-blue-50/60 border border-purple-100 rounded-2xl flex items-center justify-between">
                    <div>
                        <p class="text-xs font-black text-gray-900">
                            {isShared ? "Published Shift (Shared)" : "Draft Shift (Manager Only)"}
                        </p>
                        <p class="text-[11px] text-gray-500">
                            {isShared ? "Visible to assigned team member" : "Keep as unpublished draft until schedule is shared"}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Toggle publish or draft status"
                        onclick={() => isShared = !isShared}
                        class={[
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            isShared ? "bg-purple-600" : "bg-gray-300"
                        ]}
                    >
                        <span
                            class={[
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                                isShared ? "translate-x-5" : "translate-x-0"
                            ]}
                        ></span>
                    </button>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                    {#if isEditing}
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={isDeleting || isSaving}
                            onclick={handleDelete}
                            class="shadow-xs"
                        >
                            <Trash2 size={14} class="mr-1.5" />
                            Delete
                        </Button>
                    {/if}
                </div>

                <div class="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={onclose}
                        disabled={isSaving || isDeleting}
                    >
                        Cancel
                    </Button>
                    <AsyncButton
                        onclick={handleSave}
                        loading={isSaving}
                        class="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs"
                    >
                        {isEditing ? "Save Changes" : "Create Shift"}
                    </AsyncButton>
                </div>
            </div>
        </div>
    </div>
{/if}
