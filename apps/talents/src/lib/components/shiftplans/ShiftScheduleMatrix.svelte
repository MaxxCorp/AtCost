<script lang="ts">
    import { listShifts, listSchedulingGroups, shareSchedule } from "../../../routes/shiftplans/shifts.remote";
    import { listTalents } from "../../../routes/talents/list.remote";
    import { listLocations } from "../../../routes/locations/list.remote";
    import ShiftCard from "./ShiftCard.svelte";
    import ShiftModal from "./ShiftModal.svelte";
    import CopyScheduleModal from "./CopyScheduleModal.svelte";
    import type { ShiftDetail, SchedulingGroupDetail } from "@ac/validations";
    import { Button, AsyncButton } from "@ac/ui";
    import {
        ChevronLeft,
        ChevronRight,
        Calendar,
        Clock,
        Share2,
        Copy,
        Plus,
        Users,
        MapPin,
        Search,
        CheckCircle2,
        Sparkles,
        ChevronDown,
        ChevronUp,
        Filter
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    // Date Utilities (Pure / Immutable)
    function getMonday(d: Date): Date {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const m = new Date(date);
        m.setDate(diff);
        m.setHours(0, 0, 0, 0);
        return m;
    }

    function getSunday(monday: Date): Date {
        return new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000 + 86399999);
    }

    function getDaysOfWeek(monday: Date): Date[] {
        return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 24 * 60 * 60 * 1000));
    }

    function isSameDay(d1: Date, d2: Date): boolean {
        return (
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
        );
    }

    function formatShortDate(d: Date): string {
        return d.toLocaleDateString([], { day: "numeric", month: "short" });
    }

    function getWeekNumber(d: Date): number {
        const target = new Date(d.valueOf());
        const dayNr = (d.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    }

    // State
    let currentMonday = $state(getMonday(new Date()));
    let selectedLocationId = $state<string>("");
    let selectedGroupId = $state<string>("");
    let searchQuery = $state("");
    let collapsedGroups = $state<Record<string, boolean>>({});

    // Modals
    let showShiftModal = $state(false);
    let showCopyModal = $state(false);
    let selectedShiftForEdit = $state<ShiftDetail | null>(null);
    let modalInitialDate = $state<Date | undefined>(undefined);
    let modalInitialTalentId = $state<string | null>(null);
    let modalInitialGroupId = $state<string | null>(null);
    let isSharing = $state(false);

    // Derived Dates
    const currentSunday = $derived(getSunday(currentMonday));
    const daysOfWeek = $derived(getDaysOfWeek(currentMonday));
    const today = new Date();

    const weekRangeLabel = $derived(
        `${formatShortDate(currentMonday)} – ${formatShortDate(currentSunday)}, ${currentMonday.getFullYear()}`
    );
    const weekNumber = $derived(getWeekNumber(currentMonday));

    // Remote Queries via Runes (per modern-svelte-only rules)
    const shiftsFilter = $derived({
        startDate: currentMonday.toISOString(),
        endDate: currentSunday.toISOString(),
        locationId: selectedLocationId || undefined,
        schedulingGroupId: selectedGroupId || undefined,
    });

    const shiftsQuery = $derived(listShifts(shiftsFilter));
    const shifts = $derived(shiftsQuery.current ?? []);

    const groupsQuery = listSchedulingGroups();
    const schedulingGroups = $derived(groupsQuery.current ?? []);

    const talentsQuery = listTalents({});
    const talents = $derived(talentsQuery.current?.data ?? []);

    const locationsQuery = listLocations({});
    const locations = $derived(locationsQuery.current?.data ?? []);

    // Filtered Talents
    const filteredTalents = $derived.by(() => {
        let list = talents;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((t: any) =>
                (t.contact?.displayName || t.jobTitle || "").toLowerCase().includes(q)
            );
        }
        return list;
    });

    // Shifts mapped by Day and by Talent
    function getShiftsForTalentAndDay(talentId: string | null, day: Date): ShiftDetail[] {
        return shifts.filter((s) => {
            const shiftDate = new Date(s.startTime);
            const matchesTalent = talentId === null ? !s.talentId : s.talentId === talentId;
            return matchesTalent && isSameDay(shiftDate, day);
        });
    }

    // Hours calculation
    function calculateHours(shiftList: ShiftDetail[]): number {
        let total = 0;
        for (const s of shiftList) {
            const start = new Date(s.startTime).getTime();
            const end = new Date(s.endTime).getTime();
            let ms = end - start;
            if (ms < 0) ms += 24 * 60 * 60 * 1000;
            total += ms / (1000 * 60 * 60);
        }
        return total;
    }

    const totalWeekHours = $derived(calculateHours(shifts).toFixed(1));

    function getDayTotalHours(day: Date): string {
        const dayShifts = shifts.filter((s) => isSameDay(new Date(s.startTime), day));
        return calculateHours(dayShifts).toFixed(1);
    }

    function getTalentWeeklyHours(tId: string): string {
        const talentShifts = shifts.filter((s) => s.talentId === tId);
        return calculateHours(talentShifts).toFixed(1);
    }

    const draftShiftsCount = $derived(shifts.filter((s) => !s.isShared).length);

    // Navigation actions
    function prevWeek() {
        currentMonday = new Date(currentMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    function nextWeek() {
        currentMonday = new Date(currentMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    function goToToday() {
        currentMonday = getMonday(new Date());
    }

    // Modal Triggers
    function openNewShift(day?: Date, tId?: string | null, gId?: string | null) {
        selectedShiftForEdit = null;
        modalInitialDate = day || new Date();
        modalInitialTalentId = tId || null;
        modalInitialGroupId = gId || null;
        showShiftModal = true;
    }

    function openEditShift(shift: ShiftDetail) {
        selectedShiftForEdit = shift;
        showShiftModal = true;
    }

    async function handleShareSchedule() {
        if (draftShiftsCount === 0) {
            toast.info("All shifts for this week are already shared");
            return;
        }

        isSharing = true;
        try {
            const result = await shareSchedule({
                startDate: currentMonday.toISOString(),
                endDate: currentSunday.toISOString(),
                locationId: selectedLocationId || undefined,
                notifyTeam: true,
            });

            toast.success(`${result.sharedCount} shift changes published and shared with team`);
            void shiftsQuery.refresh();
        } catch (error: any) {
            toast.error(error?.message || "Failed to share schedule");
        } finally {
            isSharing = false;
        }
    }

    function toggleGroupCollapse(groupId: string) {
        collapsedGroups = {
            ...collapsedGroups,
            [groupId]: !collapsedGroups[groupId],
        };
    }
</script>

<div class="space-y-6">
    <!-- Top Bar: Navigation, Stats, and Actions -->
    <div class="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <!-- Week Navigator -->
        <div class="flex items-center gap-3">
            <div class="flex items-center bg-gray-50 border border-gray-200 rounded-2xl p-1 shadow-2xs">
                <button
                    type="button"
                    onclick={prevWeek}
                    aria-label="Previous week"
                    class="p-2 hover:bg-white rounded-xl text-gray-600 hover:text-purple-600 transition-all cursor-pointer"
                >
                    <ChevronLeft size={18} />
                </button>
                <button
                    type="button"
                    onclick={goToToday}
                    class="px-3.5 py-1.5 text-xs font-bold text-gray-700 hover:text-purple-600 hover:bg-white rounded-xl transition-all cursor-pointer"
                >
                    Today
                </button>
                <button
                    type="button"
                    onclick={nextWeek}
                    aria-label="Next week"
                    class="p-2 hover:bg-white rounded-xl text-gray-600 hover:text-purple-600 transition-all cursor-pointer"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            <div>
                <div class="flex items-center gap-2">
                    <span class="text-lg font-black text-gray-900 tracking-tight">
                        {weekRangeLabel}
                    </span>
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        W{weekNumber}
                    </span>
                </div>
                <p class="text-xs text-gray-400 font-medium flex items-center gap-1.5 mt-0.5">
                    <Clock size={12} class="text-purple-400" />
                    <span>Total Scheduled: <strong>{totalWeekHours} hrs</strong></span>
                </p>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2.5 flex-wrap">
            <!-- Share with team (Publish Changes) -->
            <AsyncButton
                onclick={handleShareSchedule}
                loading={isSharing}
                class={[
                    "font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2",
                    draftShiftsCount > 0
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white animate-pulse"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                ]}
            >
                {#if draftShiftsCount > 0}
                    <Share2 size={15} />
                    <span>Share with team ({draftShiftsCount} drafts)</span>
                {:else}
                    <CheckCircle2 size={15} class="text-emerald-600" />
                    <span>All shifts shared</span>
                {/if}
            </AsyncButton>

            <!-- Copy Week Schedule -->
            <Button
                variant="outline"
                size="sm"
                onclick={() => showCopyModal = true}
                class="font-bold text-xs border-gray-200 text-gray-700 hover:text-purple-700 hover:border-purple-200 rounded-xl px-3.5 py-2.5"
            >
                <Copy size={15} class="mr-1.5 text-purple-500" />
                Copy Schedule
            </Button>

            <!-- Add Shift Button -->
            <Button
                onclick={() => openNewShift()}
                class="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs"
            >
                <Plus size={16} class="mr-1.5" />
                Add Shift
            </Button>
        </div>
    </div>

    <!-- Filter & Search Strip -->
    <div class="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 flex flex-col md:flex-row items-center gap-3">
        <!-- Search Staff -->
        <div class="relative flex-1 w-full">
            <Search size={15} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                type="text"
                placeholder="Filter team member by name or role..."
                bind:value={searchQuery}
                class="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
            />
        </div>

        <!-- Location Filter -->
        <div class="w-full md:w-auto flex items-center gap-2">
            <MapPin size={15} class="text-purple-500 shrink-0" />
            <select
                bind:value={selectedLocationId}
                class="w-full md:w-48 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
            >
                <option value="">All Locations</option>
                {#each locations as loc (loc.id)}
                    <option value={loc.id}>{loc.name}</option>
                {/each}
            </select>
        </div>

        <!-- Group Filter -->
        <div class="w-full md:w-auto flex items-center gap-2">
            <Filter size={15} class="text-purple-500 shrink-0" />
            <select
                bind:value={selectedGroupId}
                class="w-full md:w-48 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
            >
                <option value="">All Scheduling Groups</option>
                {#each schedulingGroups as grp (grp.id)}
                    <option value={grp.id}>{grp.name}</option>
                {/each}
            </select>
        </div>
    </div>

    <!-- Main Schedule Roster Matrix Grid -->
    <div class="bg-white rounded-3xl shadow-xs border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
            <div class="min-w-[1050px]">
                <!-- Grid Header: Columns for Staff and 7 Days -->
                <div class="grid grid-cols-8 border-b border-gray-200 bg-gray-50/70 text-gray-700">
                    <!-- Staff Column Header -->
                    <div class="p-4 border-r border-gray-200 flex items-center justify-between">
                        <span class="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                            <Users size={14} class="text-purple-500" />
                            Team Members
                        </span>
                        <span class="text-[11px] font-bold text-gray-400">
                            {filteredTalents.length}
                        </span>
                    </div>

                    <!-- 7 Days of the Week Headers -->
                    {#each daysOfWeek as day (day.toISOString())}
                        {@const isToday = isSameDay(day, today)}
                        {@const dayHours = getDayTotalHours(day)}
                        <div
                            class={[
                                "p-3 border-r border-gray-200 last:border-r-0 text-center transition-colors",
                                isToday ? "bg-purple-50/80" : ""
                            ]}
                        >
                            <div class="flex flex-col items-center gap-0.5">
                                <span class="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                    {day.toLocaleDateString([], { weekday: "short" })}
                                </span>
                                <span
                                    class={[
                                        "text-sm font-black w-7 h-7 flex items-center justify-center rounded-full transition-all",
                                        isToday ? "bg-purple-600 text-white shadow-xs" : "text-gray-900"
                                    ]}
                                >
                                    {day.getDate()}
                                </span>
                                <span class="text-[10px] font-bold text-gray-400 mt-0.5">
                                    {dayHours} hrs
                                </span>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- SECTION 1: Open Shifts Row (Unassigned) -->
                <div class="grid grid-cols-8 border-b-2 border-purple-100 bg-purple-50/20">
                    <!-- Open Shifts Left Label -->
                    <div class="p-3.5 border-r border-gray-200 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                                <Sparkles size={14} />
                            </div>
                            <div>
                                <span class="text-xs font-black text-purple-900 block leading-tight">
                                    Open Shifts
                                </span>
                                <span class="text-[10px] text-purple-600 font-semibold block">
                                    Unassigned
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Open Shifts per Day -->
                    {#each daysOfWeek as day (day.toISOString())}
                        {@const dayOpenShifts = getShiftsForTalentAndDay(null, day)}
                        <div class="p-2 border-r border-gray-200 last:border-r-0 min-h-[90px] flex flex-col gap-1.5 relative group hover:bg-purple-50/40 transition-colors">
                            {#each dayOpenShifts as oShift (oShift.id)}
                                <ShiftCard shift={oShift} onclick={() => openEditShift(oShift)} />
                            {/each}

                            <!-- Quick Add Open Shift Button on Hover -->
                            <button
                                type="button"
                                onclick={() => openNewShift(day, null)}
                                class="w-full py-1.5 rounded-lg border border-dashed border-purple-300 text-purple-600 text-[11px] font-bold flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 hover:bg-purple-100/60 transition-all cursor-pointer mt-auto"
                            >
                                <Plus size={12} />
                                <span>Add Open</span>
                            </button>
                        </div>
                    {/each}
                </div>

                <!-- SECTION 2: Scheduling Groups & Assigned Staff -->
                {#if schedulingGroups.length > 0}
                    {#each schedulingGroups as grp (grp.id)}
                        {@const isCollapsed = !!collapsedGroups[grp.id]}
                        {@const groupShifts = shifts.filter(s => s.schedulingGroupId === grp.id)}
                        {@const groupHours = calculateHours(groupShifts).toFixed(1)}

                        <!-- Group Accordion Header -->
                        <div class="bg-gray-100/70 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                            <button
                                type="button"
                                onclick={() => toggleGroupCollapse(grp.id)}
                                class="flex items-center gap-2 text-left cursor-pointer group"
                            >
                                {#if isCollapsed}
                                    <ChevronRight size={14} class="text-gray-400 group-hover:text-purple-600" />
                                {:else}
                                    <ChevronDown size={14} class="text-gray-400 group-hover:text-purple-600" />
                                {/if}
                                <span class="text-xs font-black text-gray-800 tracking-tight">
                                    {grp.name}
                                </span>
                                {#if grp.code}
                                    <span class="text-[10px] font-bold bg-white text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                        {grp.code}
                                    </span>
                                {/if}
                            </button>

                            <div class="flex items-center gap-3">
                                <span class="text-[11px] font-bold text-gray-500">
                                    Group Total: <strong class="text-purple-700">{groupHours} hrs</strong>
                                </span>
                                <button
                                    type="button"
                                    onclick={() => openNewShift(undefined, null, grp.id)}
                                    class="text-[11px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-white hover:bg-purple-50 px-2 py-0.5 rounded-md border border-gray-200 transition-colors cursor-pointer"
                                >
                                    <Plus size={11} />
                                    Add to Group
                                </button>
                            </div>
                        </div>

                        <!-- Staff Rows for this Group (if not collapsed) -->
                        {#if !isCollapsed}
                            {#each filteredTalents as talentItem (talentItem.id)}
                                {@const talentWeekHours = getTalentWeeklyHours(talentItem.id)}
                                <div class="grid grid-cols-8 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                    <!-- Talent Info Column -->
                                    <div class="p-3 border-r border-gray-200 flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-2.5 min-w-0">
                                            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                                {(talentItem.contact?.displayName || "T")[0].toUpperCase()}
                                            </div>
                                            <div class="min-w-0">
                                                <p class="text-xs font-bold text-gray-900 truncate leading-tight">
                                                    {talentItem.contact?.displayName || "Staff Member"}
                                                </p>
                                                <p class="text-[10px] text-gray-400 truncate">
                                                    {talentItem.jobTitle || "Team Member"}
                                                </p>
                                            </div>
                                        </div>

                                        <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 shrink-0">
                                            {talentWeekHours}h
                                        </span>
                                    </div>

                                    <!-- 7 Day Cells for this Talent -->
                                    {#each daysOfWeek as day (day.toISOString())}
                                        {@const talentShifts = getShiftsForTalentAndDay(talentItem.id, day)}
                                        <div class="p-2 border-r border-gray-200 last:border-r-0 min-h-[90px] flex flex-col gap-1.5 relative group hover:bg-purple-50/20 transition-colors">
                                            {#each talentShifts as shft (shft.id)}
                                                <ShiftCard shift={shft} onclick={() => openEditShift(shft)} />
                                            {/each}

                                            <!-- Quick Add Shift Button on Hover -->
                                            <button
                                                type="button"
                                                onclick={() => openNewShift(day, talentItem.id, grp.id)}
                                                class="w-full py-1.5 rounded-lg border border-dashed border-gray-300 hover:border-purple-400 text-gray-400 hover:text-purple-600 text-[11px] font-bold flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 hover:bg-purple-50 transition-all cursor-pointer mt-auto"
                                            >
                                                <Plus size={12} />
                                                <span>Add</span>
                                            </button>
                                        </div>
                                    {/each}
                                </div>
                            {/each}
                        {/if}
                    {/each}
                {:else}
                    <!-- Fallback if no groups: direct talent rows -->
                    {#each filteredTalents as talentItem (talentItem.id)}
                        {@const talentWeekHours = getTalentWeeklyHours(talentItem.id)}
                        <div class="grid grid-cols-8 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                            <div class="p-3 border-r border-gray-200 flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <div class="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                        {(talentItem.contact?.displayName || "T")[0].toUpperCase()}
                                    </div>
                                    <div class="min-w-0">
                                        <p class="text-xs font-bold text-gray-900 truncate">
                                            {talentItem.contact?.displayName || "Staff Member"}
                                        </p>
                                        <p class="text-[10px] text-gray-400 truncate">
                                            {talentItem.jobTitle || "Team Member"}
                                        </p>
                                    </div>
                                </div>
                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                                    {talentWeekHours}h
                                </span>
                            </div>

                            {#each daysOfWeek as day (day.toISOString())}
                                {@const talentShifts = getShiftsForTalentAndDay(talentItem.id, day)}
                                <div class="p-2 border-r border-gray-200 last:border-r-0 min-h-[90px] flex flex-col gap-1.5 relative group hover:bg-purple-50/20 transition-colors">
                                    {#each talentShifts as shft (shft.id)}
                                        <ShiftCard shift={shft} onclick={() => openEditShift(shft)} />
                                    {/each}

                                    <button
                                        type="button"
                                        onclick={() => openNewShift(day, talentItem.id)}
                                        class="w-full py-1.5 rounded-lg border border-dashed border-gray-300 hover:border-purple-400 text-gray-400 hover:text-purple-600 text-[11px] font-bold flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 hover:bg-purple-50 transition-all cursor-pointer mt-auto"
                                    >
                                        <Plus size={12} />
                                        <span>Add</span>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/each}
                {/if}

                {#if filteredTalents.length === 0}
                    <div class="py-16 text-center text-gray-400">
                        <Users class="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p class="text-sm font-semibold">No team members match the search filters.</p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<!-- Shift Modal (Create / Edit) -->
{#if showShiftModal}
    {#key selectedShiftForEdit?.id || modalInitialDate?.toISOString() || modalInitialTalentId || 'new'}
        <ShiftModal
            bind:isOpen={showShiftModal}
            shift={selectedShiftForEdit}
            initialDate={modalInitialDate}
            initialTalentId={modalInitialTalentId}
            initialSchedulingGroupId={modalInitialGroupId}
            {talents}
            {schedulingGroups}
            {locations}
            onclose={() => showShiftModal = false}
            onSuccess={() => void shiftsQuery.refresh()}
        />
    {/key}
{/if}

<!-- Copy Schedule Modal -->
<CopyScheduleModal
    bind:isOpen={showCopyModal}
    currentWeekMonday={currentMonday}
    locationId={selectedLocationId}
    onclose={() => showCopyModal = false}
    onSuccess={() => void shiftsQuery.refresh()}
/>
