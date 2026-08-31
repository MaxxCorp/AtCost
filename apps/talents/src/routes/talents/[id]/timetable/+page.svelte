<script lang="ts">
  import * as m from "$lib/paraglide/messages";
  import { page } from "$app/state";
  import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
  import { getTalentMonthlyTimetable, saveTalentDayTimetable } from "./timetable.remote";
  import { createTalentAzvCommand, deleteTalentAzvCommand } from "../../../talent-groups/talent-groups.remote";
  import { Button, AsyncButton, LoadingSection, ErrorSection } from "@ac/ui";
  import * as Dialog from "@ac/ui/components/dialog";
  import type { TimetableConflictItem } from "@ac/validations";
  import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    Clock,
    User,
    CheckCircle2,
    AlertTriangle,
    Plus,
    Trash2,
    Edit3,
    Save,
    RotateCcw,
    Sparkles,
    CalendarDays,
    ExternalLink,
    Users,
    ChevronDown,
  } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  const talentId = $derived(page.params.id as string);

  const now = new Date();
  let selectedYear = $state(now.getFullYear());
  let selectedMonth = $state(now.getMonth() + 1);
  let isEditMode = $state(false);
  let showGroupsPopover = $state(false);

  // Local draft state for editing days: key = date ("YYYY-MM-DD")
  let dayDrafts = $state<
    Record<
      string,
      {
        intervals: { startTime: string; endTime: string }[];
        excuseType: string;
        excuseReason: string;
      }
    >
  >({});

  let savingDate = $state<string | null>(null);
  let selectedWeekForConflicts = $state<{
    weekNumber: number;
    conflicts: TimetableConflictItem[];
  } | null>(null);
  let showWeekConflictsDialog = $state(false);

  // AZV Manage Modal State
  let showAzvManageModal = $state(false);
  let newAzvDate = $state("");
  let isCreatingAzv = $state(false);
  let deletingAzvId = $state<string | null>(null);

  let refreshKey = $state(0);

  function triggerRefresh() {
    refreshKey += 1;
    void getTalentMonthlyTimetable(filterState).refresh();
  }

  async function handleCreateAzv() {
    if (!newAzvDate) {
      toast.error("Please select a date for the new AZV");
      return;
    }
    isCreatingAzv = true;
    try {
      await createTalentAzvCommand({
        talentId,
        from: newAzvDate,
      });
      toast.success("AZV created successfully");
      newAzvDate = "";
      triggerRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create AZV");
    } finally {
      isCreatingAzv = false;
    }
  }

  async function handleDeleteAzv(azvId: string) {
    if (!confirm(m.delete_azv_confirm())) return;
    deletingAzvId = azvId;
    try {
      await deleteTalentAzvCommand({
        azvId,
        talentId,
      });
      toast.success("AZV deleted");
      triggerRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete AZV");
    } finally {
      deletingAzvId = null;
    }
  }

  const filterState = $derived({
    talentId,
    year: selectedYear,
    month: selectedMonth,
  });

  const timetableQuery = $derived.by(() => {
    refreshKey;
    return getTalentMonthlyTimetable(filterState);
  });

  $effect(() => {
    if (!talentId) return;
    getTalentMonthlyTimetable(filterState)
      .then((data) => {
        if (data) {
          breadcrumbState.set({
            feature: "talents",
            segments: [
              { label: m.talents(), href: "/talents" },
              { label: data.displayName, href: `/talents/${talentId}` },
            ],
            current: `Timetable: ${data.monthName} ${data.year}`,
          });
        }
      })
      .catch(() => {});
  });

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const EXCUSE_OPTIONS = [
    { value: "", label: m.none_no_absence() },
    { value: "AZV", label: "⏱️ AZV" },
    { value: "Urlaub", label: "🛫 Urlaub" },
    { value: "Krank", label: "🤒 Krank" },
    { value: "Kind krank", label: "🤒 Kind krank" },
    { value: "Tel. Krankmeldung", label: "📞 Tel. Krankmeld." },
    { value: "Wichtiger Grund", label: "🔴 Wichtiger Grund" },
    { value: "Unentschuldigt", label: "⚠️ Unentschuldigt" },
  ];

  function prevMonth() {
    if (selectedMonth === 1) {
      selectedMonth = 12;
      selectedYear -= 1;
    } else {
      selectedMonth -= 1;
    }
    dayDrafts = {};
  }

  function nextMonth() {
    if (selectedMonth === 12) {
      selectedMonth = 1;
      selectedYear += 1;
    } else {
      selectedMonth += 1;
    }
    dayDrafts = {};
  }

  function goToCurrentMonth() {
    selectedYear = now.getFullYear();
    selectedMonth = now.getMonth() + 1;
    dayDrafts = {};
  }

  function toggleEditMode(data: any) {
    if (!isEditMode) {
      // Initialize drafts for all days
      const newDrafts: Record<string, any> = {};
      for (const week of data.weeks || []) {
        for (const day of week.days || []) {
          newDrafts[day.date] = {
            intervals: day.intervals.map((i: any) => ({
              startTime: i.startTime,
              endTime: i.endTime,
            })),
            excuseType: day.excuse?.type || "",
            excuseReason: day.excuse?.note || day.excuse?.reason || "",
          };
        }
      }
      dayDrafts = newDrafts;
      isEditMode = true;
    } else {
      isEditMode = false;
      dayDrafts = {};
    }
  }

  function addInterval(date: string) {
    if (!dayDrafts[date]) {
      dayDrafts[date] = { intervals: [], excuseType: "", excuseReason: "" };
    }
    dayDrafts[date].intervals.push({ startTime: "08:00", endTime: "16:30" });
  }

  function removeInterval(date: string, index: number) {
    if (dayDrafts[date]) {
      dayDrafts[date].intervals.splice(index, 1);
    }
  }

  async function handleSaveDay(date: string) {
    const draft = dayDrafts[date];
    if (!draft) return;

    savingDate = date;
    try {
      await saveTalentDayTimetable({
        talentId,
        date,
        entries: draft.intervals.filter((i) => i.startTime && i.endTime),
        excuse: draft.excuseType
          ? {
              type: draft.excuseType,
              note: draft.excuseReason || undefined,
              reason: draft.excuseReason || draft.excuseType,
              status: "approved",
            }
          : {
              type: "",
              delete: true,
            },
      });

      toast.success(`Saved timetable for ${date}`);
      refreshKey += 1;
    } catch (err: any) {
      toast.error(err?.message || "Failed to save timetable");
    } finally {
      savingDate = null;
    }
  }

  let isSavingAll = $state(false);

  async function handleSaveAll() {
    const dates = Object.keys(dayDrafts);
    if (dates.length === 0) {
      toast.info("No day edits to save");
      return;
    }

    isSavingAll = true;
    try {
      let savedCount = 0;
      for (const date of dates) {
        const draft = dayDrafts[date];
        if (!draft) continue;
        await saveTalentDayTimetable({
          talentId,
          date,
          entries: draft.intervals.filter((i) => i.startTime && i.endTime),
          excuse: draft.excuseType
            ? {
                type: draft.excuseType,
                note: draft.excuseReason || undefined,
                reason: draft.excuseReason || draft.excuseType,
                status: "approved",
              }
            : {
                type: "",
                delete: true,
              },
        });
        savedCount++;
      }

      toast.success(`Saved all changes (${savedCount} days updated)`);
      refreshKey += 1;
    } catch (err: any) {
      toast.error(err?.message || "Failed to save all changes");
    } finally {
      isSavingAll = false;
    }
  }

  function calculateDraftHours(date: string): number {
    const draft = dayDrafts[date];
    if (!draft) return 0;

    let raw = 0;
    for (const item of draft.intervals) {
      if (item.startTime && item.endTime) {
        const [sh, sm] = item.startTime.split(":").map(Number);
        const [eh, em] = item.endTime.split(":").map(Number);
        if (!isNaN(sh) && !isNaN(eh)) {
          const diff = eh + (em || 0) / 60 - (sh + (sm || 0) / 60);
          if (diff > 0) raw += diff;
        }
      }
    }
    return Math.round(raw * 2) / 2;
  }
</script>

<div class="space-y-6 container mx-auto px-4 py-6 max-w-6xl">
  <!-- Top Navigation & Return Link -->
  <div class="flex items-center justify-between">
    <a
      href="/talent-groups"
      class="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-indigo-600 transition-colors"
    >
      <ArrowLeft size={16} class="mr-1.5" />
      {m.back_to_talent_groups()}
    </a>

    <!-- Month Controls Toolbar -->
    <div class="flex items-center gap-2">
      <div class="flex items-center bg-gray-50 border border-gray-200 rounded-2xl p-1 shadow-xs">
        <button
          type="button"
          onclick={prevMonth}
          class="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-xl transition-all"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>

        <span class="px-3 text-xs font-black text-gray-800 min-w-[130px] text-center">
          {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
        </span>

        <button
          type="button"
          onclick={nextMonth}
          class="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-xl transition-all"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <Button
        variant="outline"
        size="sm"
        onclick={goToCurrentMonth}
        class="rounded-xl border-gray-200 text-xs font-bold"
      >
        {m.current_month()}
      </Button>
    </div>
  </div>

  {#await timetableQuery}
    <div class="bg-white rounded-3xl p-12 border border-gray-200/80 shadow-xs text-center">
      <LoadingSection message={m.loading_monthly_timetable()} />
    </div>
  {:then data}
    {@const monthlyDiff = Math.round((data.monthlyWorkedHours - data.monthlyAdjustedExpectedHours) * 10) / 10}
    <!-- Profile Card Header -->
    <div class="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xl shadow-2xs">
          {data.displayName?.charAt(0) || "T"}
        </div>
        <div class="space-y-1">
          <div class="flex items-center gap-2.5 flex-wrap">
            <h1 class="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {data.displayName}
            </h1>
            {#if (data.openAzvCount ?? 0) > 0}
              {@const azvDates = (data.openAzvs || []).map(a => a.formattedFrom).join(', ')}
              <button
                type="button"
                onclick={() => (showAzvManageModal = true)}
                class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                title={m.open_azv_detail_tooltip({ count: data.openAzvCount ?? 0, dates: azvDates })}
              >
                <Sparkles size={13} class="text-indigo-600 shrink-0" />
                {(data.openAzvCount ?? 0) === 1 ? m.open_azv_badge({ count: 1 }) : m.open_azvs_badge({ count: data.openAzvCount ?? 0 })}
              </button>
            {:else}
              <button
                type="button"
                onclick={() => (showAzvManageModal = true)}
                class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                title={m.manage_talent_azvs({ name: data.displayName })}
              >
                {m.no_open_azvs()}
              </button>
            {/if}
          </div>
          <p class="text-xs text-indigo-600 font-semibold">
            {data.jobTitle || "Talent Monthly Timetable"} · {data.monthName} {data.year}
          </p>
        </div>
      </div>

      <!-- Actions Toolbar -->
      <div class="flex items-center gap-3 flex-wrap">
        <!-- To Group(s) Button as its own prominent element -->
        {#if data.groups && data.groups.length > 0}
          {#if data.groups.length === 1}
            <a
              href="/talent-groups/{data.groups[0].id}"
              class="px-4 py-2 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
              title="Go to group: {data.groups[0].name}"
            >
              <Users size={14} class="text-indigo-600" />
              <span>{m.to_group_single({ name: data.groups[0].name })}</span>
            </a>
          {:else}
            <div class="relative">
              <button
                type="button"
                onclick={() => (showGroupsPopover = !showGroupsPopover)}
                class="px-4 py-2 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                title="Select talent group to navigate to"
              >
                <Users size={14} class="text-indigo-600" />
                <span>{m.to_group_multiple({ count: data.groups.length })}</span>
                <ChevronDown size={13} class="transition-transform duration-200 {showGroupsPopover ? 'rotate-180' : ''}" />
              </button>

              {#if showGroupsPopover}
                <!-- Backdrop to close popover -->
                <button
                  type="button"
                  tabindex="-1"
                  onclick={() => (showGroupsPopover = false)}
                  class="fixed inset-0 z-20 cursor-default bg-transparent border-0"
                  aria-label="Close popover"
                ></button>

                <div class="absolute right-0 sm:left-0 sm:right-auto mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  <div class="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {m.select_talent_group()}
                  </div>
                  {#each data.groups as grp}
                    <a
                      href="/talent-groups/{grp.id}"
                      onclick={() => (showGroupsPopover = false)}
                      class="flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors"
                    >
                      <span class="truncate">{grp.name}</span>
                      <span class="text-[10px] text-gray-400 font-normal uppercase">{grp.type || "group"}</span>
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}

        <!-- Save All Button (Top) -->
        {#if isEditMode}
          <AsyncButton
            size="sm"
            loading={isSavingAll}
            loadingLabel={m.saving()}
            onclick={handleSaveAll}
            class="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Save all day edits at once"
          >
            <Save size={14} />
            <span>{m.save_all()}</span>
          </AsyncButton>
        {/if}

        <!-- Edit Mode Toggle -->
        <button
          type="button"
          onclick={() => toggleEditMode(data)}
          class="px-4 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer {isEditMode
            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}"
        >
          <Edit3 size={14} />
          {isEditMode ? m.exit_edit_mode() : m.activate_edit_mode()}
        </button>
      </div>
    </div>

    <!-- Monthly Stats Overview -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-1">
        <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">{m.target_hours_adjusted()}</span>
        <div class="text-2xl font-black text-gray-900">{data.monthlyAdjustedExpectedHours.toFixed(1)}h</div>
        <p class="text-[11px] text-gray-400">
          {m.target_hours_base_desc({ hours: data.monthlyExpectedHours.toFixed(1) })}
        </p>
      </div>

      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-1">
        <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">{m.actual_worked_hours()}</span>
        <div class="text-2xl font-black text-indigo-600">{data.monthlyWorkedHours.toFixed(1)}h</div>
        <p class="text-[11px] text-gray-400">{m.recorded_across_weeks({ count: data.weeks.length })}</p>
      </div>

      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-1">
        <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">{m.balance_difference()}</span>
        <div class="text-2xl font-black {monthlyDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}">
          {monthlyDiff >= 0 ? `+${monthlyDiff.toFixed(1)}h` : `${monthlyDiff.toFixed(1)}h`}
        </div>
        <p class="text-[11px] {monthlyDiff >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}">
          {monthlyDiff >= 0 ? m.target_met_exceeded() : m.monthly_deficit()}
        </p>
      </div>

      <button
        type="button"
        onclick={() => (showAzvManageModal = true)}
        class="bg-white hover:bg-indigo-50/40 rounded-2xl p-5 border border-gray-200/80 hover:border-indigo-300 shadow-xs space-y-1 text-left transition-all cursor-pointer group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-gray-400 group-hover:text-indigo-600 uppercase tracking-wider transition-colors">{m.open_azvs()}</span>
          <Sparkles size={14} class="text-indigo-500 group-hover:scale-110 transition-transform" />
        </div>
        <div class="text-2xl font-black {(data.openAzvCount ?? 0) > 0 ? 'text-indigo-600' : 'text-gray-400'}">
          {data.openAzvCount ?? 0}
        </div>
        <p class="text-[11px] {(data.openAzvCount ?? 0) > 0 ? 'text-indigo-600 font-semibold truncate' : 'text-gray-400'}">
          {#if (data.openAzvCount ?? 0) > 0}
            {(data.openAzvs || []).map(a => a.formattedFrom).join(', ')}
          {:else}
            {m.no_open_azvs()}
          {/if}
        </p>
      </button>
    </div>

    <!-- Timetable Table with Week Separator Rows -->
    <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs space-y-4">
      <!-- Open AZVs Ribbon for Profile -->
      {#if (data.openAzvCount ?? 0) > 0}
        <div class="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2.5 flex-wrap">
            <div class="flex items-center gap-1.5 font-black text-xs text-indigo-950 uppercase tracking-wider">
              <Sparkles size={14} class="text-indigo-600" />
              <span>{m.open_azvs_for_profile({ count: data.openAzvCount ?? 0 })}</span>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              {#each data.openAzvs || [] as oAzv}
                <span
                  class="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-800 font-bold rounded-xl text-xs shadow-2xs"
                  title={m.open_azv_earned_on_day({ date: oAzv.formattedFrom })}
                >
                  <Sparkles size={11} class="text-indigo-600" />
                  <span>{m.azv_vom({ date: oAzv.formattedFrom.slice(0, 5) })} ({oAzv.formattedFrom})</span>
                </span>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      <div class="overflow-x-auto rounded-2xl border border-gray-200">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-gray-50 text-gray-600 font-black uppercase tracking-wider border-b border-gray-200">
              <th class="py-3 px-4 min-w-[130px]">{m.timetable_th_date_day()}</th>
              <th class="py-3 px-4 text-center min-w-[100px]">{m.timetable_th_expected()}</th>
              <th class="py-3 px-4 min-w-[200px]">{m.timetable_th_intervals()}</th>
              <th class="py-3 px-4 min-w-[180px]">{m.timetable_th_excuse()}</th>
              <th class="py-3 px-4 text-center min-w-[110px]">{m.timetable_th_worked_total()}</th>
              {#if isEditMode}
                <th class="py-3 px-4 text-center min-w-[120px]">{m.timetable_th_actions()}</th>
              {/if}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each data.weeks as week (week.weekNumber)}
              <!-- Days in Week -->
              {#each week.days as day (day.date)}
                {@const draft = dayDrafts[day.date]}
                {@const hasDraft = !!draft}
                {@const dayConflict = data.conflicts.find(c => c.day === day.date && !c.isWeekConflict)}
                {@const isPassed = week.isPassedWeek}
                {@const isWeekUnfulfilled = isPassed && !week.isTargetMet && week.adjustedExpectedHours > 0}
                <tr class="{day.hasConflict || dayConflict ? 'bg-red-200/85 text-red-950 hover:bg-red-200 font-medium' : day.isOutsideMonth ? 'bg-slate-100/50 opacity-60 text-gray-400' : isPassed ? (isWeekUnfulfilled ? (day.isWeekend ? 'bg-amber-200/70 text-amber-950 hover:bg-amber-200/90' : 'bg-amber-100/60 text-amber-950 hover:bg-amber-100/80') : (day.isWeekend ? 'bg-blue-200/60 text-blue-950 hover:bg-blue-200/80' : 'bg-blue-100/50 text-gray-900 hover:bg-blue-100/80')) : day.isWeekend ? 'bg-gray-50/50 text-gray-400' : 'hover:bg-gray-50/40'} transition-colors">
                  <!-- Date & Day of Week -->
                  <td class="py-3 px-4 font-bold text-gray-800">
                    <div class="flex items-center gap-2 flex-wrap">
                      {#if dayConflict || day.hasConflict}
                        <AlertTriangle size={14} class="text-red-600 shrink-0" title={dayConflict?.title || "Discrepancy / Conflict on this day"} />
                      {:else}
                        <span class="w-2 h-2 rounded-full {day.isWeekend ? 'bg-gray-300' : 'bg-indigo-500'}"></span>
                      {/if}
                      <span>{day.formattedDate}</span>
                      <span class="text-[11px] font-normal text-gray-500">({day.dayOfWeek})</span>
                      {#if day.isOutsideMonth}
                        <span class="text-[9px] text-gray-400 bg-gray-200/60 px-1 py-0.5 rounded font-normal">{m.outside_month()}</span>
                      {/if}
                      {#if data.openAzvs?.some(a => a.from === day.date)}
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200"
                          title={m.open_azv_earned_on_day({ date: day.formattedDate })}
                        >
                          <Sparkles size={10} class="text-indigo-600 shrink-0" />
                          <span>{m.open_azv_earned()}</span>
                        </span>
                      {/if}
                    </div>
                  </td>

                  <!-- Expected Hours -->
                  <td class="py-3 px-4 text-center font-bold text-gray-600">
                    {day.expectedHours > 0 ? `${day.expectedHours.toFixed(1)}h` : "—"}
                  </td>

                  <!-- Arrived / Left Intervals -->
                  <td class="py-3 px-4">
                    {#if isEditMode && hasDraft}
                      <div class="space-y-1.5">
                        {#each draft.intervals as interval, idx}
                          <div class="flex items-center gap-1.5">
                            <input
                              type="time"
                              bind:value={interval.startTime}
                              class="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-mono w-24"
                            />
                            <span class="text-gray-400">–</span>
                            <input
                              type="time"
                              bind:value={interval.endTime}
                              class="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-mono w-24"
                            />
                            <button
                              type="button"
                              onclick={() => removeInterval(day.date, idx)}
                              class="p-1 text-gray-400 hover:text-red-600 rounded"
                              title={m.remove_interval()}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        {/each}
                        <button
                          type="button"
                          onclick={() => addInterval(day.date)}
                          class="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 pt-0.5"
                        >
                          <Plus size={12} /> {m.add_interval()}
                        </button>
                      </div>
                    {:else}
                      {#if day.intervals.length === 0}
                        {#if !day.hasContract}
                          <span class="text-gray-300 italic text-[11px]">{m.no_contract()}</span>
                        {:else if day.isCurrentOrFutureWeek && day.plannedInterval && !day.excuse}
                          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-gray-50 rounded-md font-mono text-[11px] font-medium text-gray-400 border border-dashed border-gray-200" title="Planned Shift: {day.plannedInterval.startTime} – {day.plannedInterval.endTime} ({day.plannedInterval.durationHours}h)">
                            <Clock size={11} class="opacity-50" />
                            Plan: {day.plannedInterval.startTime} – {day.plannedInterval.endTime} ({day.plannedInterval.durationHours}h)
                          </span>
                        {:else}
                          <span class="text-gray-400 italic text-[11px]">{m.no_recordings()}</span>
                        {/if}
                      {:else}
                        <div class="flex flex-wrap gap-1.5">
                          {#each day.intervals as interval}
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-md font-mono text-[11px] font-semibold text-gray-700">
                              <Clock size={11} class="text-gray-400" />
                              {interval.startTime} – {interval.endTime || "Active"}
                              <span class="text-gray-400 font-normal">({interval.durationHours}h)</span>
                            </span>
                          {/each}
                        </div>
                      {/if}
                    {/if}
                  </td>

                  <!-- Excuse / Absence -->
                  <td class="py-3 px-4">
                    {#if isEditMode && hasDraft}
                      <div class="space-y-1">
                        <select
                          bind:value={draft.excuseType}
                          class="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium"
                        >
                          {#each EXCUSE_OPTIONS as opt}
                            <option value={opt.value}>{opt.label}</option>
                          {/each}
                        </select>
                        {#if draft.excuseType}
                          <input
                            type="text"
                            bind:value={draft.excuseReason}
                            placeholder={m.reason_note_placeholder()}
                            class="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs"
                          />
                        {/if}
                      </div>
                    {:else}
                      {#if day.excuse}
                        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold" title={day.excuse.note ? `Note: ${day.excuse.note}` : undefined}>
                          {#if day.excuse.type === 'AZV' && day.excuse.azvFormattedFrom}
                            <span>{m.azv_vom({ date: day.excuse.azvFormattedFrom.slice(0, 5) })}</span>
                          {:else}
                            <span>{day.excuse.type}</span>
                          {/if}
                          {#if day.excuse.note && day.excuse.type !== 'AZV'}
                            <span class="text-[11px] font-normal text-amber-800">({day.excuse.note})</span>
                          {/if}
                        </div>
                      {:else}
                        <span class="text-gray-300 text-[11px]">—</span>
                      {/if}
                    {/if}
                  </td>

                  <!-- Total Hours Worked (30min rounded) -->
                  <td class="py-3 px-4 text-center font-black">
                    {#if isEditMode && hasDraft}
                      <span class="text-indigo-600">
                        {calculateDraftHours(day.date).toFixed(1)}h
                      </span>
                    {:else}
                      <span class="{day.workedHours > 0 ? 'text-indigo-950 font-black' : 'text-gray-400'}">
                        {day.workedHours > 0 ? `${day.workedHours.toFixed(1)}h` : "0.0h"}
                      </span>
                    {/if}
                  </td>

                  <!-- Actions (Edit Mode Only) -->
                  {#if isEditMode}
                    <td class="py-3 px-4 text-center">
                      <AsyncButton
                        size="sm"
                        loading={savingDate === day.date}
                        loadingLabel={m.saving()}
                        onclick={() => handleSaveDay(day.date)}
                        class="text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                      >
                        <Save size={12} class="mr-1" />
                        {m.save()}
                      </AsyncButton>
                    </td>
                  {/if}
                </tr>
              {/each}

              <!-- Week Separator Row with Week Conflict Button -->
              {@const weekConflicts = data.conflicts.filter(c => (c.isWeekConflict && c.formattedDate.includes(String(week.weekNumber))) || week.days.some(d => d.date === c.day))}
              {@const isDeficitPassedWeek = week.isPassedWeek && !week.isTargetMet && week.adjustedExpectedHours > 0}
              {@const isConflictPassedWeek = week.isPassedWeek && !isDeficitPassedWeek && weekConflicts.length > 0}
              <tr class="font-bold border-y-2 text-xs transition-colors {isDeficitPassedWeek ? 'bg-red-950 text-red-100 border-red-900' : isConflictPassedWeek ? 'bg-amber-950 text-amber-100 border-amber-900' : 'bg-indigo-950 text-white border-indigo-900'}">
                <td class="py-3 px-4 flex items-center gap-2">
                  <CalendarDays size={15} class={isDeficitPassedWeek ? 'text-red-400' : isConflictPassedWeek ? 'text-amber-400' : 'text-indigo-400'} />
                  <span>{m.kw_summary({ week: week.weekNumber })}</span>
                  {#if week.isPassedWeek}
                    <span class="text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold {isDeficitPassedWeek ? 'bg-red-900 text-red-200' : isConflictPassedWeek ? 'bg-amber-900 text-amber-200' : 'bg-indigo-900 text-indigo-200'}">
                      {m.passed()}
                    </span>
                  {/if}
                  {#if weekConflicts.length > 0}
                    <button
                      type="button"
                      onclick={() => {
                        selectedWeekForConflicts = {
                          weekNumber: week.weekNumber,
                          conflicts: weekConflicts,
                        };
                        showWeekConflictsDialog = true;
                      }}
                      class="ml-2 px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black inline-flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                      title="View conflicts for KW {week.weekNumber}"
                    >
                      <AlertTriangle size={11} />
                      {m.conflicts_count({ count: weekConflicts.length })}
                    </button>
                  {/if}
                </td>
                <td class="py-3 px-4 text-center" title="Base expected: {week.totalExpectedHours.toFixed(1)}h">
                  <div>{m.target_hours_label({ hours: week.adjustedExpectedHours.toFixed(1) })}</div>
                  {#if week.adjustedExpectedHours !== week.totalExpectedHours}
                    <div class="text-[10px] {isDeficitPassedWeek ? 'text-red-300' : isConflictPassedWeek ? 'text-amber-300' : 'text-indigo-300'} font-normal">{m.hours_excused({ hours: (week.totalExpectedHours - week.adjustedExpectedHours).toFixed(1) })}</div>
                  {/if}
                </td>
                <td colspan="2" class="py-3 px-4">
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider {week.isTargetMet ? 'bg-green-500/30 text-green-300 border border-green-400/40' : 'bg-red-500/30 text-red-300 border border-red-400/40'}">
                    {#if week.isTargetMet}
                      <CheckCircle2 size={12} /> {m.target_met_plus({ hours: week.differenceHours.toFixed(1) })}
                    {:else}
                      <AlertTriangle size={12} /> {m.deficit_minus({ hours: week.differenceHours.toFixed(1) })}
                    {/if}
                  </span>
                </td>
                <td class="py-3 px-4 text-center text-sm font-black {isDeficitPassedWeek ? 'text-red-200' : isConflictPassedWeek ? 'text-amber-200' : 'text-indigo-300'}">
                  {week.totalWorkedHours.toFixed(1)}h
                </td>
                {#if isEditMode}
                  <td class="py-3 px-4"></td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Save All Action Bar (Bottom) -->
      {#if isEditMode}
        <div class="flex items-center justify-between p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex-wrap gap-3">
          <div class="text-xs text-indigo-900 font-semibold flex items-center gap-2">
            <Edit3 size={15} class="text-indigo-600 shrink-0" />
            <span>{m.edit_mode_active_note()}</span>
          </div>
          <AsyncButton
            size="sm"
            loading={isSavingAll}
            loadingLabel={m.saving()}
            onclick={handleSaveAll}
            class="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Save all day edits at once"
          >
            <Save size={14} />
            <span>{m.save_all_changes()}</span>
          </AsyncButton>
        </div>
      {/if}
    </div>

    <!-- AZV Management Modal for Talent -->
    <Dialog.Root bind:open={showAzvManageModal}>
      <Dialog.Content class="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
        <Dialog.Header>
          <Dialog.Title class="text-lg font-black text-gray-900 flex items-center gap-2">
            <Sparkles size={20} class="text-indigo-600" />
            {m.manage_talent_azvs({ name: data.displayName })}
          </Dialog.Title>
          <Dialog.Description class="text-xs text-gray-500">
            {m.manage_talent_azvs_desc()}
          </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-6 pt-3">
          <!-- Section 1: Create New AZV -->
          <div class="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl space-y-3">
            <div class="flex items-center gap-2 text-xs font-bold text-indigo-950 uppercase tracking-wider">
              <Plus size={14} class="text-indigo-600" />
              <span>{m.add_new_azv()}</span>
            </div>
            <p class="text-xs text-indigo-800/80">{m.add_new_azv_desc()}</p>
            <div class="flex items-center gap-2 pt-1 flex-wrap">
              <input
                type="date"
                bind:value={newAzvDate}
                class="px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-medium text-gray-800"
              />
              <AsyncButton
                size="sm"
                loading={isCreatingAzv}
                loadingLabel={m.creating()}
                onclick={handleCreateAzv}
                class="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus size={13} class="mr-1" />
                {m.add()}
              </AsyncButton>
            </div>
          </div>

          <!-- Section 2: List of all AZVs for this Talent -->
          <div class="space-y-3">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-gray-700 uppercase tracking-wider">
                {m.open_azvs()} ({(data.availableAzvs || []).length})
              </span>
              <span class="text-indigo-600 font-bold">
                {m.open_azvs_available({ count: data.openAzvCount ?? 0 })}
              </span>
            </div>

            {#if !data.availableAzvs || data.availableAzvs.length === 0}
              <div class="p-6 text-center bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-400">
                {m.no_azvs_recorded()}
              </div>
            {:else}
              <div class="space-y-2">
                {#each data.availableAzvs as azvItem (azvItem.id)}
                  <div class="p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all {azvItem.usedOn ? 'bg-gray-50/70 border-gray-200 text-gray-600' : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'}">
                    <div class="space-y-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold flex items-center gap-1.5">
                          <Calendar size={13} class={azvItem.usedOn ? 'text-gray-400' : 'text-indigo-600'} />
                          {m.azv_vom({ date: azvItem.formattedFrom })}
                        </span>
                        {#if azvItem.usedOn}
                          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-200 text-gray-700">
                            {m.azv_used_on_date({ date: azvItem.formattedUsedOn || azvItem.usedOn })}
                          </span>
                        {:else}
                          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {m.azv_open_available()}
                          </span>
                        {/if}
                      </div>
                      <p class="text-[11px] text-gray-400">
                        {azvItem.from}
                      </p>
                    </div>

                    <AsyncButton
                      size="sm"
                      variant="ghost"
                      loading={deletingAzvId === azvItem.id}
                      loadingLabel={m.saving()}
                      onclick={() => handleDeleteAzv(azvItem.id)}
                      class="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl p-2 shrink-0 cursor-pointer"
                      title={m.delete_azv()}
                    >
                      <Trash2 size={14} />
                    </AsyncButton>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <Dialog.Footer class="pt-4">
          <Button
            type="button"
            variant="outline"
            onclick={() => (showAzvManageModal = false)}
          >
            {m.close()}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>

    <!-- Week Conflicts Modal -->
    <Dialog.Root bind:open={showWeekConflictsDialog}>
      <Dialog.Content class="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <Dialog.Header>
          <Dialog.Title class="text-lg font-black text-gray-900 flex items-center gap-2">
            <AlertTriangle size={20} class="text-amber-500" />
            {m.timetable_conflicts_kw({ week: selectedWeekForConflicts?.weekNumber ?? 0 })}
          </Dialog.Title>
          <Dialog.Description class="text-xs text-gray-500">
            {m.timetable_conflicts_kw_desc()}
          </Dialog.Description>
        </Dialog.Header>

        {#if selectedWeekForConflicts?.conflicts && selectedWeekForConflicts.conflicts.length > 0}
          <div class="space-y-3 pt-2">
            {#each selectedWeekForConflicts.conflicts as conflict, idx (idx)}
              <div class="p-4 rounded-2xl border transition-all {conflict.isWeekConflict ? 'bg-amber-50/70 border-amber-200' : 'bg-red-50/70 border-red-200'}">
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider {conflict.isWeekConflict ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">
                    {conflict.isWeekConflict ? m.weekly_target_deficit() : m.worked_on_excused_day()}
                  </span>
                  <span class="text-[11px] text-gray-500 font-semibold">{conflict.formattedDate}</span>
                </div>
                <p class="text-xs text-gray-700">{conflict.description}</p>
              </div>
            {/each}
          </div>
        {:else}
          <div class="py-8 text-center text-xs text-gray-400">
            {m.no_conflicts_for_week()}
          </div>
        {/if}

        <Dialog.Footer class="pt-4">
          <Button
            type="button"
            variant="outline"
            onclick={() => (showWeekConflictsDialog = false)}
          >
            {m.close()}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  {:catch error}
    <div class="p-8 bg-red-50 border border-red-200 rounded-3xl text-red-800 space-y-3">
      <div class="flex items-center gap-2 font-black text-base">
        <AlertTriangle size={18} class="text-red-600" />
        {m.failed_to_load_monthly_timetable()}
      </div>
      <p class="text-xs text-red-700">{error instanceof Error ? error.message : String(error)}</p>
      <Button
        variant="outline"
        size="sm"
        onclick={() => getTalentMonthlyTimetable(filterState).refresh()}
        class="rounded-xl border-red-300 text-xs font-bold hover:bg-red-100"
      >
        {m.retry_loading()}
      </Button>
    </div>
  {/await}
</div>
