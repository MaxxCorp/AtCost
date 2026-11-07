<script lang="ts">
    import { listSchedulingGroups, reorderSchedulingGroups } from "../../../routes/shiftplans/shifts.remote";
    import SchedulingGroupModal from "./SchedulingGroupModal.svelte";
    import type { SchedulingGroupDetail } from "@ac/validations";
    import { Button, AsyncButton } from "@ac/ui";
    import {
        Layers,
        Plus,
        Search,
        MapPin,
        Pencil,
        Trash2,
        ChevronUp,
        ChevronDown,
        Clock,
        Globe,
        Tag,
        Sparkles
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";

    interface Props {
        locations?: Array<{ id: string; name: string }>;
    }

    let { locations = [] }: Props = $props();

    let searchQuery = $state("");
    let selectedLocationId = $state<string>("");
    let showGroupModal = $state(false);
    let selectedGroupForEdit = $state<SchedulingGroupDetail | null>(null);
    let isReordering = $state(false);

    // Reactive parameter for remote function
    const groupsFilter = $derived({
        locationId: selectedLocationId || undefined,
    });

    const groupsQuery = $derived(listSchedulingGroups(groupsFilter));
    const allGroups = $derived(groupsQuery.current ?? []);

    // Filter groups by search query
    const filteredGroups = $derived.by(() => {
        let list = allGroups;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(
                (g) =>
                    g.name.toLowerCase().includes(q) ||
                    (g.code && g.code.toLowerCase().includes(q))
            );
        }
        return list;
    });

    function openCreateModal() {
        selectedGroupForEdit = null;
        showGroupModal = true;
    }

    function openEditModal(grp: SchedulingGroupDetail) {
        selectedGroupForEdit = grp;
        showGroupModal = true;
    }

    async function moveGroup(index: number, direction: "up" | "down") {
        if (isReordering) return;
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= filteredGroups.length) return;

        isReordering = true;
        try {
            const currentItem = filteredGroups[index];
            const targetItem = filteredGroups[targetIndex];

            // Swap order numbers
            const newOrderCurrent = targetItem.order;
            const newOrderTarget = currentItem.order === targetItem.order
                ? (direction === "up" ? targetItem.order + 1 : targetItem.order - 1)
                : currentItem.order;

            await reorderSchedulingGroups({
                groups: [
                    { id: currentItem.id, order: newOrderCurrent },
                    { id: targetItem.id, order: newOrderTarget },
                ],
            });

            void groupsQuery.refresh();
            toast.success("Groups reordered");
        } catch (error: any) {
            toast.error(error?.message || "Failed to reorder groups");
        } finally {
            isReordering = false;
        }
    }

    const groupColorStyles: Record<string, { bg: string; dot: string; border: string; text: string }> = {
        purple: { bg: "bg-purple-50", dot: "bg-purple-500", border: "border-purple-200", text: "text-purple-700" },
        blue: { bg: "bg-blue-50", dot: "bg-blue-500", border: "border-blue-200", text: "text-blue-700" },
        green: { bg: "bg-emerald-50", dot: "bg-emerald-500", border: "border-emerald-200", text: "text-emerald-700" },
        yellow: { bg: "bg-amber-50", dot: "bg-amber-500", border: "border-amber-200", text: "text-amber-700" },
        pink: { bg: "bg-pink-50", dot: "bg-pink-500", border: "border-pink-200", text: "text-pink-700" },
        darkBlue: { bg: "bg-indigo-50", dot: "bg-indigo-600", border: "border-indigo-200", text: "text-indigo-700" },
        darkGreen: { bg: "bg-teal-50", dot: "bg-teal-600", border: "border-teal-200", text: "text-teal-700" },
        darkPurple: { bg: "bg-fuchsia-50", dot: "bg-fuchsia-600", border: "border-fuchsia-200", text: "text-fuchsia-700" },
        darkYellow: { bg: "bg-orange-50", dot: "bg-orange-500", border: "border-orange-200", text: "text-orange-700" },
        gray: { bg: "bg-slate-100", dot: "bg-slate-500", border: "border-slate-200", text: "text-slate-700" },
    };
</script>

<div class="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-6">
    <!-- Header with Action -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h2 class="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
                <Layers class="text-purple-600" size={22} />
                <span>Scheduling Groups</span>
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">
                Organize team members and shift rosters into functional groups (compatible with MS Teams Shifts).
            </p>
        </div>

        <Button onclick={openCreateModal} class="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs shrink-0">
            <Plus size={15} class="mr-1.5" />
            Add Scheduling Group
        </Button>
    </div>

    <!-- Filter & Search Bar -->
    <div class="flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
            <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                type="text"
                placeholder="Search groups by name or code..."
                bind:value={searchQuery}
                class="pl-9 w-full px-3 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
            />
        </div>

        <div class="flex items-center gap-2 shrink-0">
            <MapPin size={15} class="text-purple-500 shrink-0" />
            <select
                bind:value={selectedLocationId}
                class="w-full sm:w-52 px-3 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
            >
                <option value="">All Venues & Global</option>
                {#each locations as loc (loc.id)}
                    <option value={loc.id}>{loc.name}</option>
                {/each}
            </select>
        </div>
    </div>

    <!-- Groups Content List -->
    {#if groupsQuery.loading && !groupsQuery.current}
        <div class="py-16 text-center text-gray-400 font-medium">Loading scheduling groups...</div>
    {:else if groupsQuery.error}
        <div class="py-16 text-center text-red-500 font-medium">
            Failed to load scheduling groups: {groupsQuery.error.message}
        </div>
    {:else if filteredGroups.length === 0}
        <div class="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl p-8">
            <div class="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
                <Layers size={24} />
            </div>
            {#if searchQuery || selectedLocationId}
                <p class="text-sm font-bold text-gray-700">No scheduling groups match your filters</p>
                <p class="text-xs text-gray-400 mt-1">Try clearing the search query or venue filter.</p>
                <button
                    type="button"
                    onclick={() => { searchQuery = ""; selectedLocationId = ""; }}
                    class="mt-3 text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer"
                >
                    Clear Filters
                </button>
            {:else}
                <p class="text-sm font-bold text-gray-700">No scheduling groups yet</p>
                <p class="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Create groups like Front of House, Kitchen, Bar, or Supervisors to organize rosters and shift assignments.
                </p>
                <Button onclick={openCreateModal} class="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs">
                    <Plus size={14} class="mr-1.5" />
                    Create First Group
                </Button>
            {/if}
        </div>
    {:else}
        <div class="space-y-3">
            {#each filteredGroups as grp, index (grp.id)}
                {@const colorStyle = groupColorStyles[grp.color] ?? groupColorStyles.purple}
                <div class="p-4 rounded-2xl bg-white border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <!-- Left: Reorder arrows & Group info -->
                    <div class="flex items-center gap-3.5 min-w-0">
                        <!-- Order arrows -->
                        <div class="flex flex-col gap-0.5 shrink-0">
                            <button
                                type="button"
                                onclick={() => void moveGroup(index, "up")}
                                disabled={index === 0 || isReordering}
                                title="Move up in schedule"
                                class="p-1 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                                <ChevronUp size={14} />
                            </button>
                            <button
                                type="button"
                                onclick={() => void moveGroup(index, "down")}
                                disabled={index === filteredGroups.length - 1 || isReordering}
                                title="Move down in schedule"
                                class="p-1 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                                <ChevronDown size={14} />
                            </button>
                        </div>

                        <!-- Color indicator pill -->
                        <div class="w-3.5 h-10 rounded-full shrink-0 {colorStyle.dot}"></div>

                        <!-- Details -->
                        <div class="min-w-0 space-y-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h3 class="text-sm font-black text-gray-900 tracking-tight truncate">
                                    {grp.name}
                                </h3>
                                {#if grp.code}
                                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                                        {grp.code}
                                    </span>
                                {/if}
                            </div>

                            <div class="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                                <!-- Location badge -->
                                <span class="flex items-center gap-1">
                                    {#if grp.locationName}
                                        <MapPin size={12} class="text-purple-500" />
                                        <span>{grp.locationName}</span>
                                    {:else}
                                        <Globe size={12} class="text-emerald-500" />
                                        <span>All Locations (Global)</span>
                                    {/if}
                                </span>

                                <span class="text-gray-300">•</span>

                                <!-- Shift count badge -->
                                <span class="flex items-center gap-1 font-semibold text-purple-700">
                                    <Clock size={12} class="text-purple-400" />
                                    <span>{grp.shiftCount ?? 0} shifts scheduled</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Actions -->
                    <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => openEditModal(grp)}
                            class="text-xs font-bold text-gray-700 hover:text-purple-700 hover:border-purple-200 rounded-xl px-3 py-1.5"
                        >
                            <Pencil size={13} class="mr-1.5" />
                            Edit
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onclick={() => openEditModal(grp)}
                            title="Delete group"
                            class="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl px-2.5 py-1.5"
                        >
                            <Trash2 size={14} />
                        </Button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<!-- Modal instance for Create / Edit / Delete -->
{#if showGroupModal}
    {#key selectedGroupForEdit?.id ?? 'modal-new'}
        <SchedulingGroupModal
            bind:isOpen={showGroupModal}
            group={selectedGroupForEdit}
            {locations}
            onclose={() => showGroupModal = false}
            onSuccess={() => {
                void groupsQuery.refresh();
            }}
        />
    {/key}
{/if}

