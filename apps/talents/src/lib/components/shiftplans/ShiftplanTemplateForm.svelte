<script lang="ts">
    import { onMount } from "svelte";
    import * as m from "$lib/paraglide/messages";
    import { EntityManager, Button, AsyncButton } from "@ac/ui";
    import {
        MapPin,
        Users,
        Calendar,
        Clock,
        ChevronRight,
        Check,
    } from "@lucide/svelte";
    import { listLocations } from "../../../routes/locations/list.remote";
    import { listTalents } from "../../../routes/talents/list.remote";
    import {
        getEntityTalents,
        associateTalent,
        dissociateTalent,
    } from "../../../routes/shiftplans/associate.remote";
    import ShiftplanTalentParticipation from "./ShiftplanTalentParticipation.svelte";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
    }: any = $props();

    const rf = $derived(remoteFunction as any);

    // Derived prop shortcuts
    const initialSchedule = $derived(initialData?.schedule);
    const initialLocationId = $derived(initialData?.locationId);

    // Schedule state: default 5 workday, 7am-7pm
    const defaultSchedule = [
        { day: "Monday", isActive: true, start: "07:00", end: "19:00" },
        { day: "Tuesday", isActive: true, start: "07:00", end: "19:00" },
        { day: "Wednesday", isActive: true, start: "07:00", end: "19:00" },
        { day: "Thursday", isActive: true, start: "07:00", end: "19:00" },
        { day: "Friday", isActive: true, start: "07:00", end: "19:00" },
        { day: "Saturday", isActive: false, start: "07:00", end: "19:00" },
        { day: "Sunday", isActive: false, start: "07:00", end: "19:00" },
    ];

    // svelte-ignore state_referenced_locally
    let schedule = $state(initialData?.schedule || [...defaultSchedule]);
    // svelte-ignore state_referenced_locally
    let selectedLocationId = $state(initialData?.locationId || "");
    let selectedLocationName = $state("");

    // EntityManager for Location (Single Selection Pattern)
    let showLocationPicker = $state(false);

    onMount(async () => {
        if (selectedLocationId) {
            const { data: locs } = await listLocations({});
            const loc = locs.find((l: any) => l.id === selectedLocationId);
            if (loc) selectedLocationName = loc.name;
        }
    });



    const scheduleJson = $derived(JSON.stringify(schedule));

    async function handleLocationSelect(loc: any) {
        selectedLocationId = loc.id;
        selectedLocationName = loc.name;
        showLocationPicker = false;
    }
</script>

<div class="max-w-4xl mx-auto space-y-8 pb-20">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight text-gray-900">
                {isUpdating
                    ? "Edit Shiftplan Template"
                    : "New Shiftplan Template"}
            </h1>
            <p class="text-gray-500 mt-1">
                Configure recurring work hours and assigned staff.
            </p>
        </div>
    </div>

    <form
        {...remoteFunction
            .preflight(validationSchema)
            .enhance(async ({ submit }: any) => {
                const result = await submit();
                if (result?.error) {
                    toast.error(result.error.message);
                    return;
                }
                toast.success("Shiftplan template saved successfully");
                goto("/shiftplans");
            })}
        class="space-y-8"
    >
        {#if isUpdating && initialData?.id}
            <input {...rf.fields.id.as("hidden", initialData.id)} />
        {/if}
        {#if scheduleJson}
            <input {...rf.fields.schedule.as("hidden", scheduleJson)} />
        {/if}
        {#if selectedLocationId}
            <input
                {...rf.fields.locationId.as("hidden", selectedLocationId)}
            />
        {/if}

        <!-- Basic Info Section -->
        <section
            class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6"
        >
            <div class="flex items-center gap-3 border-b border-gray-50 pb-4">
                <div class="p-2 bg-purple-50 rounded-lg text-purple-600">
                    <Calendar size={20} />
                </div>
                <h2 class="text-xl font-semibold">General Information</h2>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
                <div>
                    <label
                        for="name"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >Template Name</label
                    >
                    <input
                        {...rf.fields.name.as("text")}
                        placeholder="e.g. Standard Weekday Rota"
                        class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all outline-none"
                    />
                    {#each rf.fields.name.issues() ?? [] as issue}
                        <p class="mt-1 text-xs text-red-500">{issue.message}</p>
                    {/each}
                </div>

                <div>
                    <label
                        for="location-btn"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >Workplace Location</label
                    >
                    <button
                        id="location-btn"
                        type="button"
                        onclick={() => (showLocationPicker = true)}
                        aria-label="Select workplace location"
                        class="w-full flex items-center justify-between px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors text-left"
                    >
                        <div class="flex items-center gap-2">
                            <MapPin size={16} class="text-gray-400" />
                            <span
                                class={selectedLocationName
                                    ? "text-gray-900"
                                    : "text-gray-400"}
                            >
                                {selectedLocationName || "Select a location..."}
                            </span>
                        </div>
                        <ChevronRight size={16} class="text-gray-400" />
                    </button>
                </div>
            </div>
        </section>

        <!-- Schedule Editor Section -->
        <section
            class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6"
        >
            <div class="flex items-center gap-3 border-b border-gray-50 pb-4">
                <div class="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Clock size={20} />
                </div>
                <h2 class="text-xl font-semibold">Weekly Schedule</h2>
            </div>

            <div class="divide-y divide-gray-50">
                {#each schedule as day, i}
                    <div
                        class="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                        <div class="flex items-center gap-4 min-w-[140px]">
                            <button
                                type="button"
                                onclick={() => (day.isActive = !day.isActive)}
                                aria-label="Toggle {day.day}"
                                class="relative w-11 h-6 rounded-full transition-colors focus:outline-none ring-2 ring-transparent ring-offset-2 {day.isActive
                                    ? 'bg-purple-600'
                                    : 'bg-gray-200'}"
                            >
                                <span
                                    class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform {day.isActive
                                        ? 'translate-x-5'
                                        : 'translate-x-0'} shadow-sm"
                                ></span>
                            </button>
                            <span class="font-medium text-gray-900"
                                >{day.day}</span
                            >
                        </div>

                        {#if day.isActive}
                            <div
                                class="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100"
                            >
                                <input
                                    type="time"
                                    bind:value={day.start}
                                    class="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none px-2"
                                />
                                <span class="text-gray-400 text-xs">to</span>
                                <input
                                    type="time"
                                    bind:value={day.end}
                                    class="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none px-2"
                                />
                            </div>
                        {:else}
                            <span class="text-sm text-gray-400 italic"
                                >Day off</span
                            >
                        {/if}
                    </div>
                {/each}
            </div>
        </section>

        <!-- Talent Assignment Section -->
        {#if isUpdating}
            <section class="space-y-4">
                <div class="flex items-center gap-3 px-2">
                    <div class="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                        <Users size={20} />
                    </div>
                    <h2 class="text-xl font-semibold">{m.talents()}</h2>
                </div>

                <EntityManager
                    title="Talents"
                    icon={Users}
                    mode="embedded"
                    type="shiftplan"
                    entityId={initialData.id}
                    listItemsRemote={() => listTalents()}
                    fetchAssociationsRemote={(params: any) => getEntityTalents(params)}
                    addAssociationRemote={(params: any) => associateTalent(params)}
                    removeAssociationRemote={(params: any) => dissociateTalent(params)}
                    searchPredicate={(t: any, q: string) => {
                        const searchStr =
                            `${t.contact?.displayName || ""} ${t.jobTitle || ""}`.toLowerCase();
                        return searchStr.includes(q.toLowerCase());
                    }}
                >
                    {#snippet renderItemLabel(talent)}
                        <span class="font-medium"
                            >{talent.contact?.displayName ||
                                talent.contactName ||
                                "Staff Member"}</span
                        >
                    {/snippet}

                    {#snippet renderItemBadge(talent)}
                        <span class="text-xs text-gray-500"
                            >{talent.jobTitle || "No Title"}</span
                        >
                    {/snippet}

                    {#snippet participationSnippet(talent)}
                        <ShiftplanTalentParticipation {talent} />
                    {/snippet}
                </EntityManager>
            </section>
        {:else}
            <div
                class="bg-purple-50 border border-purple-100 rounded-2xl p-6 text-center"
            >
                <p class="text-purple-700 text-sm font-medium">
                    You'll be able to assign specific talents after saving the
                    template.
                </p>
            </div>
        {/if}

        <div class="pt-6 border-t border-gray-100 flex justify-end gap-3">
            <Button variant="outline" onclick={() => goto("/shiftplans")}
                >Cancel</Button
            >
            <AsyncButton
                type="submit"
                class="bg-purple-600 hover:bg-purple-700 text-white min-w-[140px]"
            >
                {isUpdating ? "Update Changes" : "Create Template"}
            </AsyncButton>
        </div>
    </form>
</div>

<!-- Location Picker Modal -->
{#if showLocationPicker}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
        <div
            class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
        >
            <div
                class="p-6 border-b border-gray-50 flex items-center justify-between"
            >
                <h3 class="text-xl font-bold">Select Location</h3>
                <button
                    onclick={() => (showLocationPicker = false)}
                    aria-label="Close location picker"
                    class="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                    <Check size={20} class="rotate-45" />
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-4 space-y-2">
                {#await listLocations({})}
                    <div class="py-10 text-center text-gray-400">
                        Loading locations...
                    </div>
                {:then result}
                    {#each result.data as loc}
                        <button
                            type="button"
                            onclick={() => handleLocationSelect(loc)}
                            class="w-full flex items-center justify-between p-4 rounded-2xl transition-all {selectedLocationId ===
                            loc.id
                                ? 'bg-purple-50 border-purple-200 border shadow-sm'
                                : 'hover:bg-gray-50 border-transparent border'}"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="p-2 bg-purple-100 rounded-xl text-purple-600"
                                >
                                    <MapPin size={18} />
                                </div>
                                <div class="text-left">
                                    <p class="font-semibold text-gray-900">
                                        {loc.name}
                                    </p>
                                    <p class="text-xs text-gray-500">
                                        {loc.city || "No city info"}
                                    </p>
                                </div>
                            </div>
                            {#if selectedLocationId === loc.id}
                                <div
                                    class="p-1 bg-purple-600 rounded-full text-white"
                                >
                                    <Check size={14} />
                                </div>
                            {/if}
                        </button>
                    {/each}
                {/await}
            </div>
        </div>
    </div>
{/if}

<style>
    /* Premium touch-ups */
    :global(::-webkit-scrollbar) {
        width: 6px;
    }
    :global(::-webkit-scrollbar-thumb) {
        background: #e2e8f0;
        border-radius: 10px;
    }
    :global(::-webkit-scrollbar-thumb:hover) {
        background: #cbd5e1;
    }
</style>
