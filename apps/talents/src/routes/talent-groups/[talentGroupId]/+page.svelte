<script lang="ts">
  import * as m from "$lib/paraglide/messages";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { breadcrumbState } from "$lib/stores/breadcrumb.svelte";
  import {
    listTalentGroups,
    readTalentGroup,
    deleteTalentGroup,
    addTalentToGroup,
    removeTalentFromGroup,
    updateTalentGroup,
    getGroupWeeklyTimesheet,
    getGroupTotalConflicts,
    updateTimeOffStatus,
    deleteTimesheetEntryCommand,
    createManualTimesheetEntry,
    setDayExcuseCommand,
    createTalentAzvCommand,
    linkAzvToExcuseCommand,
    awardWeekSurplusAzvCommand,
    deleteTalentAzvCommand,
  } from "../talent-groups.remote";
  import { listTalents } from "../../talents/list.remote";
  import {
    updateTalentGroupSchema,
    TALENT_GROUP_TYPES,
    type TalentGroupDetail,
    type GroupWeeklyTimesheetData,
    type GroupWeeklyTalentRow,
    type GroupWeeklyDayEntry,
    type TimetableConflictItem,
    type TalentAzvItem,
  } from "@ac/validations";
  import { Button, AsyncButton, LoadingSection, ErrorSection } from "@ac/ui";
  import * as Dialog from "@ac/ui/components/dialog";
  import {
    ArrowLeft,
    Users,
    UserPlus,
    Trash2,
    Edit2,
    Folder,
    CheckCircle2,
    Clock,
    Archive,
    Search,
    Mail,
    Briefcase,
    Calendar,
    CalendarDays,
    Sparkles,
    UserCheck,
    Plus,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    ExternalLink,
    ShieldAlert,
    FileSpreadsheet,
  } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { exportWeeklyAttendanceToExcel } from "$lib/utils/weeklyAttendanceExport";

  const groupId = $derived(page.params.talentGroupId as string);

  function getMondayOfDate(d: Date): string {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const dayStr = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${dayStr}`;
  }

  let showAddTalentDialog = $state(false);
  let showEditDialog = $state(false);
  let talentSearchQuery = $state("");
  let memberFilterQuery = $state("");
  let isDeleting = $state(false);
  let addingTalentId = $state<string | null>(null);
  let removingTalentId = $state<string | null>(null);

  // Week navigation state
  let currentWeekMonday = $state(getMondayOfDate(new Date()));

  function getISOWeekNumber(dateStr: string): { weekNumber: number; year: number; rangeFormatted: string } {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const dayNr = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNr + 3);
    const firstThursday = date.valueOf();
    date.setUTCMonth(0, 1);
    if (date.getUTCDay() !== 4) {
      date.setUTCMonth(0, 1 + ((4 - date.getUTCDay() + 7) % 7));
    }
    const weekNumber = 1 + Math.ceil((firstThursday - date.valueOf()) / 604800000);
    const mondayObj = new Date(y, m - 1, d);
    const sundayObj = new Date(y, m - 1, d + 6);
    const startFmt = `${String(mondayObj.getDate()).padStart(2, "0")}.${String(mondayObj.getMonth() + 1).padStart(2, "0")}`;
    const endFmt = `${String(sundayObj.getDate()).padStart(2, "0")}.${String(sundayObj.getMonth() + 1).padStart(2, "0")}.${sundayObj.getFullYear()}`;
    return {
      weekNumber,
      year: y,
      rangeFormatted: `${startFmt}. – ${endFmt}`,
    };
  }

  const currentWeekInfo = $derived(getISOWeekNumber(currentWeekMonday));

  // Day pop-up & conflict resolution state
  let selectedDayDetail = $state<{
    talent: GroupWeeklyTalentRow;
    day: GroupWeeklyDayEntry;
  } | null>(null);
  let showDayDetailDialog = $state(false);
  let isResolvingConflict = $state(false);
  let showTotalConflictsDialog = $state(false);

  // Manual interval adding state in dialog
  let newStartTime = $state("08:00");
  let newEndTime = $state("16:30");
  let isAddingManualEntry = $state(false);

  let refreshKey = $state(0);

  const groupQuery = $derived.by(() => {
    refreshKey;
    return readTalentGroup(groupId);
  });

  const weeklyFilterState = $derived({
    groupId,
    weekStartDate: currentWeekMonday,
  });

  const weeklyQuery = $derived.by(() => {
    refreshKey;
    return getGroupWeeklyTimesheet(weeklyFilterState);
  });

  function stepWeek(offsetWeeks: number) {
    const [y, m, d] = currentWeekMonday.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + offsetWeeks * 7);
    currentWeekMonday = getMondayOfDate(date);
  }

  function goToCurrentWeek() {
    currentWeekMonday = getMondayOfDate(new Date());
  }

  // Conflicts overview dialog state
  let showConflictsDialog = $state(false);

  function openDayDetailFromConflict(conflict: TimetableConflictItem, talents: GroupWeeklyTalentRow[]) {
    const tRow = talents.find((t) => t.talentId === conflict.talentId);
    if (!tRow) return;
    const dayEntry = tRow.days.find((d) => d.date === conflict.day);
    if (dayEntry) {
      showConflictsDialog = false;
      openDayDetail(tRow, dayEntry);
    }
  }

  function goToWeekFromConflict(conflictDay: string) {
    const [y, m, d] = conflictDay.split('-').map(Number);
    currentWeekMonday = getMondayOfDate(new Date(y, m - 1, d));
    showConflictsDialog = false;
    toast.info(`Switched to week of ${conflictDay}`);
  }

  // Excuse management state in dialog
  let excuseType = $state("Urlaub");
  let excuseNote = $state("");
  let isSavingExcuse = $state(false);

  const EXCUSE_OPTIONS = [
    { value: "AZV", label: "⏱️ AZV" },
    { value: "Urlaub", label: "🛫 Urlaub" },
    { value: "Krank", label: "🤒 Krank" },
    { value: "Kind krank", label: "🤒 Kind krank" },
    { value: "Tel. Krankmeldung", label: "📞 Tel. Krankmeld." },
    { value: "Wichtiger Grund", label: "🔴 Wichtiger Grund" },
    { value: "Unentschuldigt", label: "⚠️ Unentschuldigt" },
  ];

  function openDayDetail(talent: GroupWeeklyTalentRow, day: GroupWeeklyDayEntry) {
    selectedDayDetail = { talent, day };
    newStartTime = "08:00";
    newEndTime = "16:30";
    excuseType = day.excuse?.type || "Urlaub";
    excuseNote = day.excuse?.note || day.excuse?.reason || "";
    showDayDetailDialog = true;
  }

  function triggerRefresh() {
    refreshKey += 1;
    void readTalentGroup(groupId).refresh();
    void getGroupWeeklyTimesheet(weeklyFilterState).refresh();
    void getGroupTotalConflicts(groupId).refresh();
  }

  async function handleResolveExcuse(requestId: string, status: "approved" | "rejected") {
    isResolvingConflict = true;
    try {
      await updateTimeOffStatus({ requestId, status, groupId });
      toast.success(status === "rejected" ? "Excuse marked rejected (Work hours prioritized)" : "Excuse approved");
      triggerRefresh();
      showDayDetailDialog = false;
    } catch (err: any) {
      toast.error(err?.message || "Failed to update excuse status");
    } finally {
      isResolvingConflict = false;
    }
  }

  async function handleDeleteTimesheetEntry(entryId: string) {
    isResolvingConflict = true;
    try {
      await deleteTimesheetEntryCommand({ entryId, groupId });
      toast.success("Timesheet entry removed (Excuse prioritized)");
      triggerRefresh();
      showDayDetailDialog = false;
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove entry");
    } finally {
      isResolvingConflict = false;
    }
  }

  async function handleAddManualWorkEntry() {
    if (!selectedDayDetail) return;
    isAddingManualEntry = true;
    try {
      const dateStr = selectedDayDetail.day.date;
      const startIso = new Date(`${dateStr}T${newStartTime}:00.000Z`).toISOString();
      const endIso = new Date(`${dateStr}T${newEndTime}:00.000Z`).toISOString();

      await createManualTimesheetEntry({
        talentId: selectedDayDetail.talent.talentId,
        startTime: startIso,
        endTime: endIso,
        groupId,
      });

      toast.success("Time entry recorded");
      triggerRefresh();
      showDayDetailDialog = false;
    } catch (err: any) {
      toast.error(err?.message || "Failed to add time entry");
    } finally {
      isAddingManualEntry = false;
    }
  }

  async function handleSaveExcuse() {
    if (!selectedDayDetail) return;
    if (!excuseType) {
      toast.error("Please select an excuse type");
      return;
    }
    isSavingExcuse = true;
    try {
      await setDayExcuseCommand({
        talentId: selectedDayDetail.talent.talentId,
        date: selectedDayDetail.day.date,
        type: excuseType,
        note: excuseNote.trim() || undefined,
        status: "approved",
        groupId,
      });
      toast.success("Absence excuse saved");
      triggerRefresh();
      showDayDetailDialog = false;
    } catch (err: any) {
      toast.error(err?.message || "Failed to save excuse");
    } finally {
      isSavingExcuse = false;
    }
  }

  async function handleRemoveExcuse() {
    if (!selectedDayDetail) return;
    isSavingExcuse = true;
    try {
      await setDayExcuseCommand({
        talentId: selectedDayDetail.talent.talentId,
        date: selectedDayDetail.day.date,
        delete: true,
        groupId,
      });
      toast.success("Absence excuse removed");
      triggerRefresh();
      showDayDetailDialog = false;
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove excuse");
    } finally {
      isSavingExcuse = false;
    }
  }

  // AZV Selection & Creation Modal State
  type AzvTargetTalent = {
    talentId: string;
    displayName: string;
    availableAzvs?: TalentAzvItem[];
    openAzvs?: TalentAzvItem[];
    openAzvCount?: number;
  };

  let showAzvModal = $state(false);
  let azvModalTalent = $state<AzvTargetTalent | null>(null);
  let azvModalDay = $state<GroupWeeklyDayEntry | null>(null);
  let selectedExistingAzvId = $state<string>("");
  let newAzvFromDate = $state<string>("");
  let isProcessingAzv = $state(false);
  let deletingAzvId = $state<string | null>(null);

  function openAzvSelection(talent: AzvTargetTalent, day: GroupWeeklyDayEntry) {
    azvModalTalent = talent;
    azvModalDay = day;
    selectedExistingAzvId = "";
    newAzvFromDate = "";
    showAzvModal = true;
  }

  function openAzvManagement(talent: AzvTargetTalent) {
    azvModalTalent = talent;
    azvModalDay = null;
    selectedExistingAzvId = "";
    newAzvFromDate = "";
    showAzvModal = true;
  }

  async function handleCreateAzvDirect() {
    if (!azvModalTalent || !newAzvFromDate) {
      toast.error("Please enter the origin date (from) for the new AZV");
      return;
    }
    isProcessingAzv = true;
    try {
      const res = await createTalentAzvCommand({
        talentId: azvModalTalent.talentId,
        from: newAzvFromDate,
        groupId,
      });
      toast.success("New AZV created");
      if (res.azv) {
        const fromDate = new Date(res.azv.from);
        const fDay = String(fromDate.getUTCDate()).padStart(2, '0');
        const fMonth = String(fromDate.getUTCMonth() + 1).padStart(2, '0');
        const newItem: TalentAzvItem = {
          id: res.azv.id,
          talentId: res.azv.talentId,
          from: newAzvFromDate,
          formattedFrom: `${fDay}.${fMonth}.${fromDate.getUTCFullYear()}`,
          usedOn: null,
          formattedUsedOn: null,
          createdAt: new Date(res.azv.createdAt).toISOString(),
        };
        const currentList = azvModalTalent.availableAzvs || [];
        azvModalTalent = {
          ...azvModalTalent,
          availableAzvs: [newItem, ...currentList],
          openAzvs: [newItem, ...(azvModalTalent.openAzvs || [])],
          openAzvCount: (azvModalTalent.openAzvCount ?? 0) + 1,
        };
      }
      newAzvFromDate = "";
      triggerRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create AZV");
    } finally {
      isProcessingAzv = false;
    }
  }

  async function handleDeleteAzv(azvId: string) {
    if (!azvModalTalent) return;
    if (!confirm(m.delete_azv_confirm())) return;
    deletingAzvId = azvId;
    try {
      await deleteTalentAzvCommand({
        azvId,
        talentId: azvModalTalent.talentId,
        groupId,
      });
      toast.success("AZV deleted");
      if (azvModalTalent.availableAzvs) {
        const updated = azvModalTalent.availableAzvs.filter((a) => a.id !== azvId);
        azvModalTalent = {
          ...azvModalTalent,
          availableAzvs: updated,
          openAzvs: updated.filter((a) => !a.usedOn),
          openAzvCount: updated.filter((a) => !a.usedOn).length,
        };
      }
      triggerRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete AZV");
    } finally {
      deletingAzvId = null;
    }
  }

  async function handleLinkExistingAzv() {
    if (!azvModalTalent || !azvModalDay || !selectedExistingAzvId) {
      toast.error("Please select an AZV to link");
      return;
    }
    isProcessingAzv = true;
    try {
      await linkAzvToExcuseCommand({
        azvId: selectedExistingAzvId,
        usedOn: azvModalDay.date,
        talentId: azvModalTalent.talentId,
        groupId,
      });
      toast.success("AZV successfully linked to excuse");
      triggerRefresh();
      showAzvModal = false;
      showDayDetailDialog = false;
      showConflictsDialog = false;
      showTotalConflictsDialog = false;
    } catch (err: any) {
      toast.error(err?.message || "Failed to link AZV");
    } finally {
      isProcessingAzv = false;
    }
  }

  async function handleAwardSurplusAzv(talent: GroupWeeklyTalentRow) {
    isProcessingAzv = true;
    try {
      await awardWeekSurplusAzvCommand({
        talentId: talent.talentId,
        fromDate: currentWeekMonday,
        groupId,
      });
      toast.success(`AZV awarded to ${talent.displayName} from KW ${currentWeekInfo.weekNumber} (${currentWeekMonday})`);
      triggerRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to award AZV");
    } finally {
      isProcessingAzv = false;
    }
  }

  $effect(() => {
    if (!groupId) return;
    readTalentGroup(groupId)
      .then((group) => {
        if (group) {
          breadcrumbState.set({
            feature: "talents",
            segments: [{ label: "Talent Groups", href: "/talent-groups" }],
            current: group.name,
          });
        }
      })
      .catch(() => {});
  });

  async function handleDeleteGroup(groupName: string) {
    if (!confirm(`Are you sure you want to delete the group "${groupName}"? This action cannot be undone.`)) {
      return;
    }

    isDeleting = true;
    try {
      await deleteTalentGroup(groupId);
      toast.success("Talent group deleted");
      listTalentGroups().refresh();
      await goto("/talent-groups");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete group");
    } finally {
      isDeleting = false;
    }
  }

  async function handleAddTalent(talentId: string, talentName: string) {
    addingTalentId = talentId;
    try {
      await addTalentToGroup({ groupId, talentId });
      toast.success(`Added ${talentName} to group`);
      triggerRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add talent");
    } finally {
      addingTalentId = null;
    }
  }

  async function handleRemoveTalent(talentId: string, talentName: string) {
    if (!confirm(`Remove "${talentName}" from this group?`)) {
      return;
    }

    removingTalentId = talentId;
    try {
      await removeTalentFromGroup({ groupId, talentId });
      toast.success(`Removed ${talentName} from group`);
      triggerRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove talent");
    } finally {
      removingTalentId = null;
    }
  }

  const typeColorAccents: Record<string, { bg: string; text: string; border: string; lightBg: string }> = {
    Type1: { bg: "bg-indigo-600", text: "text-indigo-700", border: "border-indigo-200", lightBg: "bg-indigo-50/70" },
    Type2: { bg: "bg-emerald-600", text: "text-emerald-700", border: "border-emerald-200", lightBg: "bg-emerald-50/70" },
    Type3: { bg: "bg-amber-600", text: "text-amber-700", border: "border-amber-200", lightBg: "bg-amber-50/70" },
  };

  function getTypeAccent(type: string) {
    return (
      typeColorAccents[type] || {
        bg: "bg-purple-600",
        text: "text-purple-700",
        border: "border-purple-200",
        lightBg: "bg-purple-50/70",
      }
    );
  }
</script>

<div class="space-y-8 container mx-auto px-4 py-6 max-w-7xl">
  <svelte:boundary>
    {#if $effect.pending()}
      <LoadingSection message="Loading group details..." />
    {/if}

    <div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
      {#await groupQuery}
        <LoadingSection message="Loading group details..." />
      {:then group}
        {#if !group}
          <div class="text-center py-16 bg-white rounded-3xl border border-gray-200/80 p-8 shadow-xs">
            <Folder class="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h2 class="text-xl font-bold text-gray-900">Talent Group Not Found</h2>
            <p class="text-gray-500 mt-1 text-sm">
              {m.groups_does_not_exist()}.
            </p>
            <Button href="/talent-groups" class="mt-6">
              <ArrowLeft size={16} class="mr-2" />
              {m.groups_return_groups()}
            </Button>
          </div>
        {:else}
          {@const accent = getTypeAccent(group.type)}
          {@const members = group.members || []}
          {@const filteredMembers = memberFilterQuery
            ? members.filter((m) =>
                m.displayName.toLowerCase().includes(memberFilterQuery.toLowerCase()) ||
                (m.jobTitle && m.jobTitle.toLowerCase().includes(memberFilterQuery.toLowerCase())) ||
                (m.email && m.email.toLowerCase().includes(memberFilterQuery.toLowerCase()))
              )
            : members}

          <!-- Header / Navigation -->
          <div class="space-y-4">
            <a
              href="/talent-groups"
              class="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft size={16} class="mr-1.5" />
              {m.groups_return_groups()}
            </a>

            <div class="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-3">
                  <h1 class="text-3xl font-black text-gray-900 tracking-tight">
                    {group.name}
                  </h1>
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider {accent.lightBg} {accent.text} border {accent.border}">
                    {group.type}
                  </span>
                </div>

                <div class="flex items-center gap-4 text-xs font-medium text-gray-400">
                  <span class="inline-flex items-center gap-1.5 text-gray-600 font-semibold">
                    <Users size={14} class="text-indigo-500" />
                    {members.length} {members.length === 1 ? "assigned talent" : "assigned talents"}
                  </span>
                  <span>•</span>
                  <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>Updated {new Date(group.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div class="flex items-center gap-2.5 flex-wrap">
                <!-- Total Group Conflicts Button in Header (from contract start to current week) -->
                {#await getGroupWeeklyTimesheet(weeklyFilterState)}
                  <!-- loading header button -->
                {:then weeklyData}
                  {@const totalCount = weeklyData.totalHistoricalConflicts?.length || 0}
                  <button
                    type="button"
                    onclick={() => (showTotalConflictsDialog = true)}
                    class="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black transition-all border shadow-xs {totalCount > 0
                      ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}"
                    title="View all timetable conflicts and deficits across the group from contract start to current week"
                  >
                    <AlertTriangle size={14} class={totalCount > 0 ? 'text-white' : 'text-amber-500'} />
                    <span>{m.groups_total_conflicts()} ({totalCount})</span>
                  </button>
                {/await}

                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => (showEditDialog = true)}
                  class="rounded-xl border-gray-200 shadow-xs"
                >
                  <Edit2 size={14} class="mr-1.5" />
                  {m.edit_group()}
                </Button>

                <Button
                  size="sm"
                  onclick={() => (showAddTalentDialog = true)}
                  class="rounded-xl shadow-xs"
                >
                  <UserPlus size={14} class="mr-1.5" />
                  {m.add_talents()}
                </Button>

                <AsyncButton
                  variant="ghost"
                  size="sm"
                  loading={isDeleting}
                  loadingLabel={m.deleting()}
                  onclick={() => handleDeleteGroup(group.name)}
                  class="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl"
                  title="Delete Group"
                >
                  <Trash2 size={15} />
                </AsyncButton>
              </div>
            </div>
          </div>

          <!-- Section 1: Members Summary Cards -->
          <div class="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h2 class="text-xl font-black text-gray-900 tracking-tight">{m.group_members()}</h2>
                <p class="text-xs text-gray-500 mt-0.5">
                  {m.group_members_desc()}
                </p>
              </div>

              {#if members.length > 0}
                <div class="relative w-full sm:w-64">
                  <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={m.search_in_group_placeholder()}
                    bind:value={memberFilterQuery}
                    class="pl-8 pr-3 py-1.5 w-full bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              {/if}
            </div>

            {#if members.length === 0}
              <div class="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 p-6">
                <Users class="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <h3 class="text-base font-bold text-gray-800">{m.no_talents_in_group_yet()}</h3>
                <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  {m.no_talents_in_group_desc()}
                </p>
                <div class="mt-4">
                  <Button size="sm" onclick={() => (showAddTalentDialog = true)}>
                    <UserPlus size={14} class="mr-1.5" />
                    {m.add_first_talent()}
                  </Button>
                </div>
              </div>
            {:else if filteredMembers.length === 0}
              <div class="text-center py-8 text-sm text-gray-500">
                {m.groups_no_talent_match()} "{memberFilterQuery}".
              </div>
            {:else}
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {#each filteredMembers as member (member.talentId)}
                  <div class="bg-gray-50/60 rounded-2xl p-4 border border-gray-200/70 hover:border-indigo-200 hover:bg-white transition-all flex items-center justify-between gap-4 group">
                    <a
                      href="/talents/{member.talentId}/timetable"
                      class="flex items-center gap-3.5 min-w-0 flex-1 hover:opacity-90 transition-opacity"
                      title="Open Timetable for {member.displayName}"
                    >
                      <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 text-indigo-700 font-black flex items-center justify-center text-sm shrink-0">
                        {member.displayName?.charAt(0) || "T"}
                      </div>

                      <div class="min-w-0 space-y-0.5">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-gray-900 hover:text-indigo-600 transition-colors text-sm truncate block">
                            {member.displayName}
                          </span>
                        </div>

                        <p class="text-xs text-indigo-600 font-semibold truncate">
                          {member.jobTitle || "Professional Talent"}
                        </p>

                        {#if member.email}
                          <p class="text-[11px] text-gray-400 truncate flex items-center gap-1">
                            <Mail size={10} />
                            {member.email}
                          </p>
                        {/if}

                        {#if (member.openAzvCount ?? 0) > 0}
                          {@const azvDates = (member.openAzvs || []).map(a => a.formattedFrom).join(', ')}
                          <button
                            type="button"
                            onclick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openAzvManagement(member);
                            }}
                            class="inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded-md text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 max-w-fit shadow-2xs transition-colors cursor-pointer"
                            title={m.open_azv_symbol_title({ name: member.displayName, count: member.openAzvCount ?? 0, dates: azvDates })}
                          >
                            <Sparkles size={10} class="text-indigo-600 shrink-0" />
                            <span>{(member.openAzvCount ?? 0) === 1 ? m.open_azv_badge({ count: 1 }) : m.open_azvs_badge({ count: member.openAzvCount ?? 0 })}</span>
                          </button>
                        {/if}
                      </div>
                    </a>

                    <div class="shrink-0 flex items-center gap-1">
                      <Button
                        href="/talents/{member.talentId}/timetable"
                        variant="ghost"
                        size="sm"
                        class="text-xs font-semibold text-indigo-600 hover:bg-indigo-50 p-2 rounded-xl"
                        title={m.view_timetable()}
                      >
                        <CalendarDays size={14} />
                      </Button>

                      <AsyncButton
                        variant="ghost"
                        size="sm"
                        loading={removingTalentId === member.talentId}
                        loadingLabel="..."
                        onclick={() => handleRemoveTalent(member.talentId, member.displayName)}
                        class="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl"
                        title={m.remove_from_group()}
                      >
                        <Trash2 size={14} />
                      </AsyncButton>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Section 2: Weekly Timesheet & Attendance Overview Table -->
          <div class="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs space-y-6">
            <!-- Week Navigation Bar (Always rendered) -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div class="space-y-1">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <CalendarDays size={22} class="text-indigo-600" />
                  <h2 class="text-xl font-black text-gray-900 tracking-tight">
                    {m.groups_week_timesheet_att()}
                  </h2>
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {m.week_calendar_short()} {currentWeekInfo.weekNumber} / {currentWeekInfo.year}
                  </span>
                </div>
                <p class="text-xs text-gray-500">
                  {m.week()} {currentWeekInfo.weekNumber} · {currentWeekInfo.rangeFormatted}
                </p>
              </div>

              <div class="flex items-center gap-2">
                <div class="flex items-center bg-gray-50 border border-gray-200 rounded-2xl p-1 shadow-xs">
                  <button
                    type="button"
                    onclick={() => stepWeek(-1)}
                    class="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-xl transition-all"
                    title="Previous Week"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span class="px-3 text-xs font-black text-gray-800 min-w-[170px] text-center">
                    {m.week_calendar_short()} {currentWeekInfo.weekNumber} ({currentWeekInfo.rangeFormatted})
                  </span>

                  <button
                    type="button"
                    onclick={() => stepWeek(1)}
                    class="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-xl transition-all"
                    title="Next Week"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onclick={goToCurrentWeek}
                  class="rounded-xl border-gray-200 text-xs font-bold"
                >
                  {m.week_current()}
                </Button>
              </div>
            </div>

            {#await weeklyQuery}
              <div class="py-12 text-center text-gray-400">
                <LoadingSection message="Loading weekly attendance table..." />
              </div>
            {:then weeklyData}
              {#if weeklyData.talents.length === 0}
                <div class="text-center py-8 text-xs text-gray-400">
                  {m.groups_no_data_week()}.
                </div>
              {:else}
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onclick={() => (showConflictsDialog = true)}
                      class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-black transition-all border shadow-xs {weeklyData.conflicts.length > 0
                        ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}"
                    >
                      <AlertTriangle size={14} class={weeklyData.conflicts.length > 0 ? 'text-white' : 'text-amber-500'} />
                      <span>{m.groups_show_conflicts()} ({weeklyData.conflicts.length})</span>
                    </button>

                    <button
                      type="button"
                      onclick={() => {
                        try {
                          exportWeeklyAttendanceToExcel(weeklyData, {
                            groupName: group.name,
                            groupNumber: group.type,
                            organization: "Ball e.V.",
                          });
                          toast.success("Weekly attendance Excel sheet exported successfully");
                        } catch (e: any) {
                          toast.error(e?.message || "Failed to export Excel sheet");
                        }
                      }}
                      class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-black transition-all border bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-xs cursor-pointer"
                      title="Export weekly attendance list as styled Excel file (.xlsx)"
                    >
                      <FileSpreadsheet size={14} />
                      <span>{m.groups_export_excel()}</span>
                    </button>
                  </div>

                  <p class="text-xs text-gray-500">
                    {m.members_in_group_count({ count: weeklyData.talents.length })}
                  </p>
                </div>

                <div class="overflow-x-auto rounded-2xl border border-gray-200 shadow-xs">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr class="bg-gray-50 text-gray-600 font-black uppercase tracking-wider border-b border-gray-200">
                        <th class="py-3 px-3 text-center w-10">lfd. Nr.</th>
                        <th class="py-3 px-3 min-w-[110px]">{m.name()}</th>
                        <th class="py-3 px-3 min-w-[110px]">{m.last_name()}</th>
                        <th class="py-3 px-2.5 text-center min-w-[80px]">{m.start()}</th>
                        <th class="py-3 px-2.5 text-center min-w-[80px]">{m.end()}</th>
                        {#if weeklyData.hasAnyJcNumber}
                          <th class="py-3 px-2.5 text-center min-w-[80px]">{m.talent_jc_number()}</th>
                        {/if}
                        <th class="py-3 px-2.5 text-center min-w-[90px]">{m.groups_daily_hrs()}</th>

                        <!-- Monday to Sunday Columns with DD.MM Header -->
                        {#if weeklyData.talents[0]?.days}
                          {#each weeklyData.talents[0].days as d}
                            <th class="py-3 px-2 text-center min-w-[75px]">
                              <div>{d.dayName.slice(0, 2)}</div>
                              <div class="text-[10px] font-semibold text-gray-400 mt-0.5">{d.formattedDate}</div>
                            </th>
                          {/each}
                        {/if}

                        <th class="py-3 px-3 text-center min-w-[100px]">{m.groups_week_total()}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 font-medium text-gray-800">
                      {#each weeklyData.talents as t (t.talentId)}
                        {@const rowClass = t.isUnderTarget
                          ? 'bg-red-50/70 border-l-4 border-l-red-500'
                          : t.isOverTarget
                          ? 'bg-sky-50/70 border-l-4 border-l-sky-500'
                          : 'hover:bg-gray-50/70'}

                        <tr class="transition-colors {rowClass}">
                          <!-- lfd. Nr. with Warning tooltip if under target -->
                          <td class="py-3 px-3 text-center font-bold text-gray-600">
                            <div class="flex items-center justify-center gap-1">
                              {#if t.isUnderTarget}
                                <span title={t.statusMessage} class="text-red-600 cursor-help">
                                  <AlertTriangle size={14} />
                                </span>
                              {/if}
                              <span>{t.index}</span>
                            </div>
                          </td>

                          <!-- Name (Given Name, linked to timetable) -->
                          <td class="py-3 px-3 font-bold text-gray-900">
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <a
                                href="/talents/{t.talentId}/timetable"
                                class="hover:text-indigo-600 hover:underline inline-flex items-center gap-1"
                                title="View monthly timetable for {t.displayName}"
                              >
                                {t.givenName}
                              </a>
                              {#if (t.openAzvCount ?? 0) > 0}
                                {@const azvDates = (t.openAzvs || []).map(a => a.formattedFrom).join(', ')}
                                <button
                                  type="button"
                                  onclick={() => openAzvManagement(t)}
                                  class="inline-flex items-center justify-center p-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-700 shadow-2xs transition-transform hover:scale-110 cursor-pointer"
                                  title={m.open_azv_symbol_title({ name: t.displayName, count: t.openAzvCount ?? 0, dates: azvDates })}
                                >
                                  <Sparkles size={12} class="text-indigo-600 shrink-0" />
                                  <span class="sr-only">{m.open_azv_badge({ count: t.openAzvCount ?? 0 })}</span>
                                </button>
                              {/if}
                            </div>
                          </td>

                          <!-- Last Name -->
                          <td class="py-3 px-3 font-semibold text-gray-900">
                            <a
                              href="/talents/{t.talentId}/timetable"
                              class="hover:text-indigo-600 hover:underline"
                            >
                              {t.familyName}
                            </a>
                          </td>

                          <!-- Contract Start -->
                          <td class="py-3 px-2.5 text-center text-gray-500 text-[11px]">
                            {t.contractStart || "—"}
                          </td>

                          <!-- Contract End -->
                          <td class="py-3 px-2.5 text-center text-gray-500 text-[11px]">
                            {t.contractEnd || "—"}
                          </td>

                          <!-- JC Number (hidden if not present anywhere in group) -->
                          {#if weeklyData.hasAnyJcNumber}
                            <td class="py-3 px-2.5 text-center text-gray-600 font-mono text-[11px]">
                              {t.jcNumber || "—"}
                            </td>
                          {/if}

                          <!-- Daily Expected Hours -->
                          <td class="py-3 px-2.5 text-center font-bold text-indigo-700">
                            <div>{t.dailyExpectedHours.toFixed(1)}h</div>
                            {#if t.totalWeeklyExcusedHours > 0}
                              <div class="text-[10px] text-amber-700 font-bold" title="Base {t.totalWeeklyExpectedHours.toFixed(1)}h - {t.totalWeeklyExcusedHours.toFixed(1)}h excused">
                                ({t.adjustedWeeklyExpectedHours.toFixed(1)}h target)
                              </div>
                            {:else}
                              <div class="text-[10px] text-gray-400 font-medium">({t.totalWeeklyExpectedHours.toFixed(1)}h/wk)</div>
                            {/if}
                          </td>

                          <!-- Monday to Sunday Cells -->
                          {#each t.days as day (day.date)}
                            {@const hasWorked = day.timesheetEntries.length > 0}
                            {@const hasExcuse = day.excuse !== null}
                            {@const hasConflict = day.hasConflict}
                            {@const hasContract = day.hasContract}
                            {@const hasPlan = day.isCurrentOrFutureWeek && day.plannedInterval !== null}

                            <td class="py-2.5 px-1.5 text-center">
                              <button
                                type="button"
                                onclick={() => openDayDetail(t, day)}
                                class="w-full min-h-[38px] py-1.5 px-1 rounded-xl transition-all text-center cursor-pointer flex flex-col items-center justify-center {hasConflict
                                  ? 'bg-red-500 text-white font-black shadow-xs hover:bg-red-600'
                                  : hasWorked
                                  ? 'bg-indigo-50/80 text-indigo-900 font-bold border border-indigo-100 hover:bg-indigo-100'
                                  : hasExcuse
                                  ? 'bg-amber-100 text-amber-900 font-bold border border-amber-200 hover:bg-amber-200'
                                  : !hasContract
                                  ? 'text-gray-300 hover:bg-gray-50'
                                  : hasPlan
                                  ? 'bg-gray-50/70 border border-dashed border-gray-200 text-gray-400 hover:bg-gray-100 hover:border-gray-300'
                                  : 'text-gray-400 hover:bg-gray-100'}"
                                title={hasConflict
                                  ? "Conflict: Worked hours on an excused absence day. Click to resolve."
                                  : hasWorked
                                  ? `${day.workedHours}h recorded. Click for details.`
                                  : hasExcuse
                                  ? `Excuse: ${day.excuse?.type}${day.excuse?.note ? ` (${day.excuse?.note})` : ''}`
                                  : !hasContract
                                  ? "No active contract on this date."
                                  : hasPlan
                                  ? `Shiftplan: ${day.plannedInterval?.startTime} - ${day.plannedInterval?.endTime} (${day.plannedInterval?.durationHours}h). Click to record time.`
                                  : "No entries. Click to add time."}
                              >
                                {#if hasConflict}
                                  <div class="flex items-center justify-center gap-0.5 text-[11px]">
                                    <AlertTriangle size={11} />
                                    <span>{day.workedHours.toFixed(1)}h</span>
                                  </div>
                                {:else if hasWorked}
                                  <span class="font-bold">{day.workedHours.toFixed(1)}h</span>
                                {:else if hasExcuse}
                                  {#if day.excuse?.type === 'AZV'}
                                    {#if day.excuse.azvFormattedFrom}
                                      <div class="text-[9px] font-bold leading-tight text-indigo-900" title="AZV vom {day.excuse.azvFormattedFrom}">
                                        <div>AZV</div>
                                        <div class="text-[8px] text-indigo-700 font-semibold opacity-90">{day.excuse.azvFormattedFrom.slice(0, 5)}</div>
                                      </div>
                                    {:else}
                                      <div class="flex items-center justify-center gap-0.5 text-[9px] text-amber-900 font-bold" title="AZV missing origin date! Click to select or create AZV.">
                                        <AlertTriangle size={10} class="text-amber-600 shrink-0" />
                                        <span>AZV (?)</span>
                                      </div>
                                    {/if}
                                  {:else}
                                    <span class="text-[10px] truncate block max-w-[65px] mx-auto font-bold" title="{day.excuse?.type}{day.excuse?.note ? `: ${day.excuse?.note}` : ''}">
                                      {day.excuse?.type}
                                    </span>
                                  {/if}
                                {:else if !hasContract}
                                  <span class="text-[9px] text-gray-400 font-medium">No contract</span>
                                {:else if hasPlan && day.plannedInterval}
                                  <div class="text-[9px] font-mono leading-tight text-gray-400">
                                    <div class="text-[8px] uppercase tracking-wider font-semibold opacity-70">Plan</div>
                                    <div>{day.plannedInterval.startTime}–{day.plannedInterval.endTime}</div>
                                  </div>
                                {:else}
                                  <span class="text-[10px] opacity-40">0.0</span>
                                {/if}

                                {#if t.openAzvs?.some(a => a.from === day.date)}
                                  <span
                                    class="inline-flex items-center gap-0.5 text-[8px] font-bold text-indigo-700 bg-indigo-100/90 px-1 py-0.2 rounded mt-0.5"
                                    title={m.open_azv_earned_on_day({ date: day.formattedDate })}
                                  >
                                    <Sparkles size={8} />
                                    <span>+AZV</span>
                                  </span>
                                {/if}
                              </button>
                            </td>
                          {/each}

                          <!-- Week Total Hours Worked -->
                          <td class="py-3 px-3 text-center font-black">
                            <div class="flex flex-col items-center justify-center gap-0.5">
                              <div class="flex items-center justify-center gap-1.5 flex-wrap">
                                <span
                                  class="px-2 py-0.5 rounded-lg text-xs {t.isUnderTarget ? 'bg-red-100 text-red-800 font-black' : t.isOverTarget ? 'bg-sky-100 text-sky-800 font-black' : 'bg-emerald-100 text-emerald-800 font-bold'}"
                                  title={t.statusMessage}
                                >
                                  {t.totalWeeklyWorkedHours.toFixed(1)}h
                                </span>

                                {#if t.isOverTarget}
                                  <button
                                    type="button"
                                    onclick={() => handleAwardSurplusAzv(t)}
                                    disabled={isProcessingAzv}
                                    class="px-1.5 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs text-[10px] font-black cursor-pointer inline-flex items-center gap-0.5"
                                    title="Award AZV for this overfulfilled week (+{(t.totalWeeklyWorkedHours - t.adjustedWeeklyExpectedHours).toFixed(1)}h surplus)"
                                  >
                                    <Sparkles size={10} />
                                    <span>+AZV</span>
                                  </button>
                                {/if}
                              </div>

                              {#if t.totalWeeklyExcusedHours > 0}
                                <div class="text-[10px] text-amber-700 font-bold" title="Base {t.totalWeeklyExpectedHours.toFixed(1)}h - {t.totalWeeklyExcusedHours.toFixed(1)}h excused">
                                  ({t.adjustedWeeklyExpectedHours.toFixed(1)}h target)
                                </div>
                              {:else}
                                <div class="text-[10px] text-gray-400 font-medium">({t.totalWeeklyExpectedHours.toFixed(1)}h target)</div>
                              {/if}
                            </div>
                          </td>
                        </tr>
                      {/each}

                      <!-- Total Daily Hours Grayed Sum Row -->
                      <tr class="bg-gray-50 font-bold text-gray-400 border-t-2 border-gray-200">
                        <td colspan={weeklyData.hasAnyJcNumber ? 6 : 5} class="py-2.5 px-3 text-right text-[11px] uppercase tracking-wider">
                          {m.group_daily_hours_sum()}
                        </td>
                        <td class="py-2.5 px-2.5 text-center font-black text-gray-500 text-xs">
                          {weeklyData.totalGroupDailyHours.toFixed(1)}h
                        </td>
                        <td colspan="8" class="py-2.5 px-3 text-right text-[11px] text-gray-400 italic">
                          {m.target_calculation_note()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Conflicts Overview Modal -->
                <Dialog.Root bind:open={showConflictsDialog}>
                  <Dialog.Content class="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
                    <Dialog.Header>
                      <Dialog.Title class="text-lg font-black text-gray-900 flex items-center gap-2">
                        <AlertTriangle size={20} class="text-amber-500" />
                        {m.groups_timetable_conflicts()} ({m.week_calendar_short()} {weeklyData.weekNumber})
                      </Dialog.Title>
                      <Dialog.Description class="text-xs text-gray-500">
                        {m.groups_confict_day_level()}.
                      </Dialog.Description>
                    </Dialog.Header>

                    {#if weeklyData.conflicts.length === 0}
                      <div class="py-10 text-center space-y-2">
                        <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle2 size={24} />
                        </div>
                        <p class="text-sm font-bold text-gray-900">{m.groups_confict_none()}</p>
                        <p class="text-xs text-gray-500">{m.groups_hrs_align()}.</p>
                      </div>
                    {:else}
                      <div class="space-y-3 pt-2">
                        {#each weeklyData.conflicts as conflict, cIdx (cIdx)}
                          <div class="p-4 rounded-2xl border transition-all {conflict.type === 'azv_missing_origin' ? 'bg-indigo-50/70 border-indigo-200' : conflict.isWeekConflict ? 'bg-amber-50/70 border-amber-200' : 'bg-red-50/70 border-red-200'}">
                            <div class="flex items-start justify-between gap-3">
                              <div class="space-y-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                  <span class="text-xs font-black text-gray-900">{conflict.talentName}</span>
                                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider {conflict.type === 'azv_missing_origin' ? 'bg-indigo-100 text-indigo-800' : conflict.isWeekConflict ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">
                                    {conflict.type === 'azv_missing_origin' ? m.azv_origin_missing() : conflict.isWeekConflict ? m.weekly_target_deficit() : m.worked_on_excused_day()}
                                  </span>
                                  <span class="text-[11px] text-gray-500 font-semibold">{conflict.formattedDate}</span>
                                </div>
                                <p class="text-xs text-gray-700">{conflict.description}</p>
                                {#if conflict.isWeekConflict}
                                  <p class="text-[10px] text-amber-700 italic">
                                    {m.groups_conflict_no_auto_resolve()}.
                                  </p>
                                {/if}
                              </div>
                            </div>

                            <!-- Action buttons in conflict card -->
                            <div class="flex items-center gap-2 pt-3 mt-3 border-t {conflict.type === 'azv_missing_origin' ? 'border-indigo-200/60' : conflict.isWeekConflict ? 'border-amber-200/60' : 'border-red-200/60'}">
                              {#if conflict.type === 'azv_missing_origin'}
                                <button
                                  type="button"
                                  onclick={() => {
                                    const tRow = weeklyData.talents.find((t) => t.talentId === conflict.talentId);
                                    if (tRow) {
                                      const dEntry = tRow.days.find((d) => d.date === conflict.day);
                                      if (dEntry) {
                                        showConflictsDialog = false;
                                        openAzvSelection(tRow, dEntry);
                                      }
                                    }
                                  }}
                                  class="px-3 py-1 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-xs inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Sparkles size={12} />
                                  {m.groups_select_azv()}
                                </button>
                              {:else if !conflict.isWeekConflict}
                                {#if conflict.excuseId}
                                  <button
                                    type="button"
                                    onclick={() => handleResolveExcuse(conflict.excuseId!, 'rejected')}
                                    disabled={isResolvingConflict}
                                    class="px-2.5 py-1 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 shadow-xs"
                                  >
                                    {m.groups_conflict_prio_work()}
                                  </button>
                                {/if}
                                {#if conflict.timesheetEntryId}
                                  <button
                                    type="button"
                                    onclick={() => handleDeleteTimesheetEntry(conflict.timesheetEntryId!)}
                                    disabled={isResolvingConflict}
                                    class="px-2.5 py-1 bg-white border border-red-300 text-red-700 rounded-xl font-bold text-xs hover:bg-red-50"
                                  >
                                    {m.groups_conflict_prio_excuse()}
                                  </button>
                                {/if}
                                <button
                                  type="button"
                                  onclick={() => openDayDetailFromConflict(conflict, weeklyData.talents)}
                                  class="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-200"
                                >
                                  {m.edit_day()}
                                </button>
                              {:else}
                                <button
                                  type="button"
                                  onclick={() => goToWeekFromConflict(conflict.day)}
                                  class="px-3 py-1 bg-amber-600 text-white rounded-xl font-bold text-xs hover:bg-amber-700 shadow-xs"
                                >
                                  {m.groups_go_to_week()}
                                </button>
                                <a
                                  href="/talents/{conflict.talentId}/timetable"
                                  class="px-3 py-1 bg-white border border-amber-300 text-amber-800 rounded-xl font-bold text-xs hover:bg-amber-50 inline-flex items-center gap-1"
                                >
                                  <ExternalLink size={12} />
                                  {m.groups_open_monthly()}
                                </a>
                              {/if}
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}

                    <Dialog.Footer class="pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onclick={() => (showConflictsDialog = false)}
                      >
                        {m.close()}
                      </Button>
                    </Dialog.Footer>
                  </Dialog.Content>
                </Dialog.Root>

                <!-- Total Group Historical Conflicts Modal -->
                <Dialog.Root bind:open={showTotalConflictsDialog}>
                  <Dialog.Content class="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                    <Dialog.Header>
                      <Dialog.Title class="text-lg font-black text-gray-900 flex items-center gap-2">
                        <AlertTriangle size={20} class="text-amber-500" />
                        {m.total_group_conflicts_title({ groupName: group.name })}
                      </Dialog.Title>
                      <Dialog.Description class="text-xs text-gray-500">
                        {m.total_group_conflicts_desc()}
                      </Dialog.Description>
                    </Dialog.Header>

                    {#if !weeklyData.totalHistoricalConflicts || weeklyData.totalHistoricalConflicts.length === 0}
                      <div class="py-10 text-center space-y-2">
                        <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle2 size={24} />
                        </div>
                        <p class="text-sm font-bold text-gray-900">{m.zero_historical_conflicts()}</p>
                        <p class="text-xs text-gray-500">{m.zero_historical_conflicts_desc()}</p>
                      </div>
                    {:else}
                      <div class="space-y-3 pt-2">
                        {#each weeklyData.totalHistoricalConflicts as conflict, hIdx (hIdx)}
                          <div class="p-4 rounded-2xl border transition-all {conflict.type === 'azv_missing_origin' ? 'bg-indigo-50/70 border-indigo-200' : conflict.isWeekConflict ? 'bg-amber-50/70 border-amber-200' : 'bg-red-50/70 border-red-200'}">
                            <div class="flex items-start justify-between gap-3">
                              <div class="space-y-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                  <span class="text-xs font-black text-gray-900">{conflict.talentName}</span>
                                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider {conflict.type === 'azv_missing_origin' ? 'bg-indigo-100 text-indigo-800' : conflict.isWeekConflict ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">
                                    {conflict.type === 'azv_missing_origin' ? m.azv_origin_missing() : conflict.isWeekConflict ? m.weekly_target_deficit() : m.worked_on_excused_day()}
                                  </span>
                                  <span class="text-[11px] text-gray-500 font-semibold">{conflict.formattedDate}</span>
                                </div>
                                <p class="text-xs text-gray-700">{conflict.description}</p>
                              </div>
                            </div>

                            <div class="flex items-center gap-2 pt-3 mt-3 border-t {conflict.type === 'azv_missing_origin' ? 'border-indigo-200/60' : conflict.isWeekConflict ? 'border-amber-200/60' : 'border-red-200/60'}">
                              {#if conflict.type === 'azv_missing_origin'}
                                <button
                                  type="button"
                                  onclick={() => {
                                    const tRow = weeklyData.talents.find((t) => t.talentId === conflict.talentId);
                                    if (tRow) {
                                      const dEntry = tRow.days.find((d) => d.date === conflict.day);
                                      if (dEntry) {
                                        showTotalConflictsDialog = false;
                                        openAzvSelection(tRow, dEntry);
                                      }
                                    }
                                  }}
                                  class="px-3 py-1 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-xs inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Sparkles size={12} />
                                  {m.groups_select_azv()}
                                </button>
                              {:else}
                                <button
                                  type="button"
                                  onclick={() => {
                                    showTotalConflictsDialog = false;
                                    goToWeekFromConflict(conflict.day);
                                  }}
                                  class="px-3 py-1 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-xs"
                                >
                                  {m.groups_go_to_week()}
                                </button>
                              {/if}

                              <a
                                href="/talents/{conflict.talentId}/timetable"
                                class="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 inline-flex items-center gap-1"
                              >
                                <ExternalLink size={12} />
                                {m.groups_open_monthly()}
                              </a>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}

                    <Dialog.Footer class="pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onclick={() => (showTotalConflictsDialog = false)}
                      >
                        {m.close()}
                      </Button>
                    </Dialog.Footer>
                  </Dialog.Content>
                </Dialog.Root>
              {/if}
            {:catch error}
              <div class="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs space-y-2">
                <p class="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={15} class="text-red-600" />
                  Failed to load weekly attendance data
                </p>
                <p class="text-red-700">{error instanceof Error ? error.message : String(error)}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => getGroupWeeklyTimesheet(weeklyFilterState).refresh()}
                  class="rounded-xl text-xs font-bold border-red-300 hover:bg-red-100 mt-2"
                >
                  {m.retry_loading()}
                </Button>
              </div>
            {/await}
          </div>

          <!-- Edit Group Dialog -->
          <Dialog.Root bind:open={showEditDialog}>
            <Dialog.Content class="sm:max-w-[480px]">
              <Dialog.Header>
                <Dialog.Title class="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Edit2 class="text-indigo-600" size={18} />
                  {m.groups_edit()}
                </Dialog.Title>
                <Dialog.Description class="text-sm text-gray-500">
                  {m.groups_update()}.
                </Dialog.Description>
              </Dialog.Header>

              <form
                class="space-y-4 pt-3"
                {...updateTalentGroup.preflight(updateTalentGroupSchema).enhance(async ({ submit }) => {
                  try {
                    await submit();
                    toast.success("Talent group updated");
                    showEditDialog = false;
                    readTalentGroup(groupId).refresh();
                    listTalentGroups().refresh();
                    getGroupWeeklyTimesheet(weeklyFilterState).refresh();
                  } catch (error: any) {
                    toast.error(error?.message || "Failed to update group");
                  }
                })}
              >
                <input {...updateTalentGroup.fields.id.as("hidden", group.id)} />

                <div class="space-y-1.5">
                  <label for="edit-name" class="text-xs font-bold uppercase tracking-wider text-gray-700">
                    {m.group_name()}
                  </label>
                  <input
                    id="edit-name"
                    {...updateTalentGroup.fields.name.as("text")}
                    value={group.name}
                    class="w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-gray-200"
                    required
                  />
                  {#each updateTalentGroup.fields.name.issues?.() ?? [] as issue}
                    <p class="text-xs font-medium text-red-600 mt-1">{issue.message}</p>
                  {/each}
                </div>

                <div class="space-y-1.5">
                  <label for="edit-type" class="text-xs font-bold uppercase tracking-wider text-gray-700">
                    {m.groups_type()}
                  </label>
                  <select
                    id="edit-type"
                    {...updateTalentGroup.fields.type.as("select")}
                    value={group.type}
                    class="w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-gray-200"
                    required
                  >
                    {#each TALENT_GROUP_TYPES as typeOption}
                      <option value={typeOption}>{typeOption}</option>
                    {/each}
                  </select>
                  {#each updateTalentGroup.fields.type.issues?.() ?? [] as issue}
                    <p class="text-xs font-medium text-red-600 mt-1">{issue.message}</p>
                  {/each}
                </div>

                <Dialog.Footer class="pt-4 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onclick={() => (showEditDialog = false)}
                  >
                    {m.cancel()}
                  </Button>
                  <AsyncButton
                    type="submit"
                    loadingLabel={m.saving()}
                    loading={updateTalentGroup.pending}
                    class="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {m.save_changes()}
                  </AsyncButton>
                </Dialog.Footer>
              </form>
            </Dialog.Content>
          </Dialog.Root>

          <!-- Add Talent Dialog -->
          <Dialog.Root bind:open={showAddTalentDialog}>
            <Dialog.Content class="sm:max-w-[560px]">
              <Dialog.Header>
                <Dialog.Title class="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <UserPlus class="text-indigo-600" size={20} />
                  {m.groups_add_talents_to()} {group.name}
                </Dialog.Title>
                <Dialog.Description class="text-sm text-gray-500">
                  {m.groups_search_talents()}.
                </Dialog.Description>
              </Dialog.Header>

              <div class="space-y-4 pt-2">
                <div class="relative">
                  <Search size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={m.search_talents()}
                    bind:value={talentSearchQuery}
                    class="pl-10 pr-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div class="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-gray-100">
                  {#await listTalents({ search: talentSearchQuery.trim() || undefined, limit: 100 })}
                    <div class="py-6 text-center text-xs text-gray-400">{m.loading()}</div>
                  {:then result}
                    {@const memberIds = new Set(members.map((m) => m.talentId))}
                    {@const candidateTalents = (result?.data || []).filter((t: any) => !memberIds.has(t.id))}

                    {#if candidateTalents.length === 0}
                      <div class="py-8 text-center text-xs text-gray-500">
                        {talentSearchQuery
                          ? "No matching talents found to add."
                          : "All available talents are already in this group."}
                      </div>
                    {:else}
                      {#each candidateTalents as candidate (candidate.id)}
                        <div class="pt-2 first:pt-0 flex items-center justify-between gap-3 py-2">
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {candidate.contact?.displayName?.charAt(0) || "T"}
                            </div>
                            <div class="min-w-0">
                              <p class="font-bold text-sm text-gray-900 truncate">
                                {candidate.contact?.displayName || "Unnamed"}
                              </p>
                              <p class="text-xs text-gray-400 truncate">
                                {candidate.jobTitle || "Professional Talent"}
                              </p>
                            </div>
                          </div>

                          <AsyncButton
                            size="sm"
                            loading={addingTalentId === candidate.id}
                            loadingLabel={m.saving()}
                            onclick={() => handleAddTalent(candidate.id, candidate.contact?.displayName || "Talent")}
                            class="rounded-xl text-xs font-bold shrink-0"
                          >
                            <Plus size={13} class="mr-1" />
                            {m.add()}
                          </AsyncButton>
                        </div>
                      {/each}
                    {/if}
                  {/await}
                </div>
              </div>

              <Dialog.Footer class="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onclick={() => (showAddTalentDialog = false)}
                >
                  {m.done()}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>

          <!-- Day Pop-up & Conflict Resolution Dialog -->
          <Dialog.Root bind:open={showDayDetailDialog}>
            <Dialog.Content class="sm:max-w-[500px]">
              {#if selectedDayDetail}
                {@const { talent, day } = selectedDayDetail}

                <Dialog.Header>
                  <Dialog.Title class="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Clock size={18} class="text-indigo-600" />
                    {talent.displayName} · {day.dayName}, {day.formattedDate}
                  </Dialog.Title>
                  <Dialog.Description class="text-xs text-gray-500">
                    Timesheet recordings and absence excuse details for this date.
                  </Dialog.Description>
                </Dialog.Header>

                <div class="space-y-4 pt-2">
                  <!-- Conflict Warning Banner -->
                  {#if day.hasConflict}
                    <div class="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-800">
                      <ShieldAlert size={18} class="text-red-600 shrink-0 mt-0.5" />
                      <div class="text-xs space-y-1">
                        <p class="font-bold">{m.groups_conflict_detected()}</p>
                        <p>
                          {m.groups_conflict_work_on_excuse()} ({day.excuse?.type}{day.excuse?.note ? ` · ${day.excuse.note}` : ''}). {m.groups_conflict_work_on_excuse_choose()}:
                        </p>
                        <div class="flex gap-2 pt-2">
                          <button
                            type="button"
                            onclick={() => handleResolveExcuse(day.excuse!.id, "rejected")}
                            disabled={isResolvingConflict}
                            class="px-2.5 py-1 bg-red-600 text-white rounded-lg font-bold text-[11px] hover:bg-red-700 shadow-xs"
                          >
                            {m.groups_conflict_prio_work()}
                          </button>
                          {#if day.timesheetEntries[0]}
                            <button
                              type="button"
                              onclick={() => handleDeleteTimesheetEntry(day.timesheetEntries[0].id)}
                              disabled={isResolvingConflict}
                              class="px-2.5 py-1 bg-white border border-red-300 text-red-700 rounded-lg font-bold text-[11px] hover:bg-red-50"
                            >
                              {m.groups_conflict_prio_excuse()}
                            </button>
                          {/if}
                        </div>
                      </div>
                    </div>
                  {/if}

                  <!-- Excuse Details -->
                  {#if day.excuse}
                    <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-amber-900 uppercase tracking-wider text-[10px]">{m.add_absence_excuse()}</span>
                        <span class="font-semibold text-amber-700 uppercase text-[10px]">{m.status()}: {day.excuse.status}</span>
                      </div>
                      <p class="text-sm font-bold text-amber-900">
                        {day.excuse.type}
                        {#if day.excuse.note}
                          <span class="text-xs font-normal text-amber-800 block mt-0.5">{m.note_optional()}: {day.excuse.note}</span>
                        {/if}
                      </p>
                    </div>
                  {/if}

                  <!-- Timesheet Entries List -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-gray-700 uppercase tracking-wider">{m.recorded_work_intervals()}</span>
                      <span class="text-xs font-bold text-indigo-600">Total: {day.workedHours.toFixed(1)}h</span>
                    </div>

                    {#if day.timesheetEntries.length === 0}
                      <p class="text-xs text-gray-400 italic py-2">{m.groups_no_hrs_day()}.</p>
                    {:else}
                      <div class="space-y-1.5">
                        {#each day.timesheetEntries as entry}
                          <div class="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                            <div class="flex items-center gap-2">
                              <Clock size={13} class="text-indigo-500" />
                              <span class="font-bold text-gray-900">
                                {new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                –
                                {entry.endTime ? new Date(entry.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                              </span>
                              <span class="text-gray-400">({entry.durationHours}h)</span>
                            </div>

                            <button
                              type="button"
                              onclick={() => handleDeleteTimesheetEntry(entry.id)}
                              class="p-1 text-gray-400 hover:text-red-600 rounded"
                              title={m.delete()}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>

                  <!-- Quick Add Work Interval -->
                  <div class="pt-3 border-t border-gray-100 space-y-2">
                    <span class="text-xs font-bold text-gray-700 uppercase tracking-wider">{m.add_manual_work_interval()}</span>
                    <div class="flex items-center gap-2">
                      <input
                        type="time"
                        bind:value={newStartTime}
                        class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
                      />
                      <span class="text-xs text-gray-400">–</span>
                      <input
                        type="time"
                        bind:value={newEndTime}
                        class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
                      />
                      <AsyncButton
                        size="sm"
                        loading={isAddingManualEntry}
                        loadingLabel={m.saving()}
                        onclick={handleAddManualWorkEntry}
                        class="text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        <Plus size={13} class="mr-1" />
                        {m.add_time()}
                      </AsyncButton>
                    </div>
                  </div>

                  <!-- Manage / Add Excuse Section -->
                  <div class="pt-3 border-t border-gray-100 space-y-2.5">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {day.excuse ? m.update_remove_excuse() : m.add_absence_excuse()}
                      </span>
                      {#if day.excuse}
                        <span class="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {m.active_excuse()}
                        </span>
                      {/if}
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label for="excuse-type-select" class="block text-[10px] font-bold text-gray-500 uppercase mb-1">{m.excuse_type()}</label>
                        <select
                          id="excuse-type-select"
                          bind:value={excuseType}
                          class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20"
                        >
                          {#each EXCUSE_OPTIONS as opt}
                            <option value={opt.value}>{opt.label}</option>
                          {/each}
                        </select>
                      </div>

                      <div>
                        <label for="excuse-reason-input" class="block text-[10px] font-bold text-gray-500 uppercase mb-1">{m.note_optional()}</label>
                        <input
                          id="excuse-reason-input"
                          type="text"
                          bind:value={excuseNote}
                          placeholder={m.note_placeholder_doc()}
                          class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <!-- Special AZV Origin Date Box -->
                    {#if excuseType === 'AZV'}
                      <div class="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
                        <div class="flex items-center justify-between text-xs">
                          <span class="font-bold text-indigo-950 flex items-center gap-1.5">
                            <Sparkles size={13} class="text-indigo-600" />
                            {m.azv_origin_date()}
                          </span>
                          {#if day.excuse?.azvFormattedFrom}
                            <span class="text-indigo-800 font-bold bg-indigo-100/70 px-2 py-0.5 rounded-md">
                              {day.excuse.azvFormattedFrom}
                            </span>
                          {:else}
                            <span class="text-red-700 font-bold text-[11px] flex items-center gap-1">
                              <AlertTriangle size={11} />
                              {m.not_linked_yet()}
                            </span>
                          {/if}
                        </div>
                        <p class="text-[11px] text-gray-600">
                          {m.azv_link_desc()}
                        </p>
                        <button
                          type="button"
                          onclick={() => openAzvSelection(talent, day)}
                          class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1"
                        >
                          <Sparkles size={12} />
                          <span>{day.excuse?.azvFormattedFrom ? m.change_linked_azv() : m.groups_select_azv()}</span>
                        </button>
                      </div>
                    {/if}

                    <div class="flex items-center gap-2 pt-1">
                      <AsyncButton
                        size="sm"
                        loading={isSavingExcuse}
                        loadingLabel={m.saving()}
                        onclick={handleSaveExcuse}
                        class="text-xs font-bold rounded-xl bg-amber-600 text-white hover:bg-amber-700"
                      >
                        <CheckCircle2 size={13} class="mr-1" />
                        {day.excuse ? m.update_excuse() : m.set_excuse()}
                      </AsyncButton>

                      {#if day.excuse}
                        <AsyncButton
                          size="sm"
                          variant="outline"
                          loading={isSavingExcuse}
                          loadingLabel={m.saving()}
                          onclick={handleRemoveExcuse}
                          class="text-xs font-bold rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={13} class="mr-1 text-red-500" />
                          {m.remove_excuse()}
                        </AsyncButton>
                      {/if}
                    </div>
                  </div>
                </div>

                <Dialog.Footer class="pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onclick={() => (showDayDetailDialog = false)}
                  >
                    {m.close()}
                  </Button>
                </Dialog.Footer>
              {/if}
            </Dialog.Content>
          </Dialog.Root>

          <!-- AZV Selection & Management Modal -->
          <Dialog.Root bind:open={showAzvModal}>
            <Dialog.Content class="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
              {#if azvModalTalent}
                {@const allAzvs = azvModalTalent.availableAzvs || []}
                {@const openAzvs = azvModalTalent.openAzvs || allAzvs.filter(a => !a.usedOn)}

                <Dialog.Header>
                  <Dialog.Title class="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Sparkles size={20} class="text-indigo-600" />
                    {m.manage_talent_azvs({ name: azvModalTalent.displayName })}
                  </Dialog.Title>
                  <Dialog.Description class="text-xs text-gray-500">
                    {#if azvModalDay}
                      {m.absence_date()} <span class="font-bold text-gray-800">{azvModalDay.dayName}, {azvModalDay.formattedDate} ({azvModalDay.date})</span>
                    {:else}
                      {m.manage_talent_azvs_desc()}
                    {/if}
                  </Dialog.Description>
                </Dialog.Header>

                <div class="space-y-6 pt-3">
                  <!-- Section 1: Create / Add New AZV -->
                  <div class="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl space-y-3">
                    <div class="flex items-center gap-2 text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      <Plus size={14} class="text-indigo-600" />
                      <span>{m.add_new_azv()}</span>
                    </div>
                    <p class="text-xs text-indigo-800/80">{m.add_new_azv_desc()}</p>
                    <div class="flex items-center gap-2 pt-1 flex-wrap">
                      <input
                        type="date"
                        bind:value={newAzvFromDate}
                        class="px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-medium text-gray-800"
                      />
                      <AsyncButton
                        size="sm"
                        loading={isProcessingAzv}
                        loadingLabel={m.creating()}
                        onclick={handleCreateAzvDirect}
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
                        {m.open_azvs()} ({allAzvs.length})
                      </span>
                      <span class="text-indigo-600 font-bold">
                        {m.open_azvs_available({ count: openAzvs.length })}
                      </span>
                    </div>

                    {#if allAzvs.length === 0}
                      <div class="p-6 text-center bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-400">
                        {m.no_azvs_recorded()}
                      </div>
                    {:else}
                      <div class="space-y-2">
                        {#each allAzvs as azvItem (azvItem.id)}
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

                            <div class="flex items-center gap-1.5 shrink-0">
                              {#if azvModalDay && (!azvItem.usedOn || azvItem.usedOn === azvModalDay.date)}
                                <AsyncButton
                                  size="sm"
                                  loading={isProcessingAzv}
                                  loadingLabel={m.saving()}
                                  onclick={() => {
                                    selectedExistingAzvId = azvItem.id;
                                    handleLinkExistingAzv();
                                  }}
                                  class="text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
                                >
                                  <CheckCircle2 size={12} class="mr-1" />
                                  {m.use_this_azv()}
                                </AsyncButton>
                              {/if}

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
                    onclick={() => (showAzvModal = false)}
                  >
                    {m.close()}
                  </Button>
                </Dialog.Footer>
              {/if}
            </Dialog.Content>
          </Dialog.Root>
        {/if}
      {/await}
    </div>

    {#snippet failed(error: unknown)}
      <ErrorSection
        headline="Error loading group details"
        message={error instanceof Error ? error.message : "An unexpected error occurred."}
      />
    {/snippet}
  </svelte:boundary>
</div>
