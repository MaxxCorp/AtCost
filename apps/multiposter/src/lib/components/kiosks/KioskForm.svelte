<script lang="ts">
    import { listLocations } from "../../../routes/locations/list.remote";
    import type { Location } from "../../../routes/locations/list.remote";
    import Button from "$lib/components/ui/button/button.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import EntityManager from "$lib/components/ui/EntityManager.svelte";
    import LocationForm from "$lib/components/locations/LocationForm.svelte";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "$lib/validations/locations";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import { MapPin } from "@lucide/svelte";
    import { onMount, untrack } from "svelte";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import type { createKiosk } from "../../../routes/kiosks/new/create.remote";
    import type { updateKiosk } from "../../../routes/kiosks/[id]/update.remote";
 
    let {
        remoteFunction,
        validationSchema,
        initialData = null,
        isUpdating = false,
    }: {
        remoteFunction: typeof createKiosk | typeof updateKiosk;
        validationSchema: any;
        initialData?: any;
        isUpdating?: boolean;
    } = $props();
 
    const type = "kiosk";
 
    let locations = $state<Location[]>([]);
    let loaded = $state(false);
    let selectedLocationIds = $state<string[]>(
        untrack(() => initialData?.locationIds || (initialData?.locationId ? [initialData.locationId] : []))
    );
    let lookAheadDays = $state(
        untrack(() => initialData?.lookAhead ? Math.round(initialData.lookAhead / 86400) : 28)
    );
    let lookPastDays = $state(
        untrack(() => initialData?.lookPast ? Math.round(initialData.lookPast / 86400) : 0)
    );
    let uiMode = $state(untrack(() => initialData?.uiMode || "carousel"));
    let rangeMode = $state(untrack(() => initialData?.rangeMode || "rolling"));
    let startDate = $state(
        untrack(() => initialData?.startDate
            ? new Date(initialData.startDate).toISOString().slice(0, 16)
            : "")
    );
    let endDate = $state(
        untrack(() => initialData?.endDate
            ? new Date(initialData.endDate).toISOString().slice(0, 16)
            : "")
    );

    $effect(() => {
        // Update state if initialData changes (e.g. from null to loaded)
        if (!initialData) return;
        
        selectedLocationIds = initialData.locationIds || (initialData?.locationId ? [initialData.locationId] : []);
        lookAheadDays = initialData.lookAhead ? Math.round(initialData.lookAhead / 86400) : 28;
        lookPastDays = initialData.lookPast ? Math.round(initialData.lookPast / 86400) : 0;
        uiMode = initialData.uiMode || "carousel";
        rangeMode = initialData.rangeMode || "rolling";
        startDate = initialData.startDate ? new Date(initialData.startDate).toISOString().slice(0, 16) : "";
        endDate = initialData.endDate ? new Date(initialData.endDate).toISOString().slice(0, 16) : "";
    });

    onMount(async () => {
        try {
            locations = await listLocations();
            loaded = true;
        } catch (e) {
            console.error("Failed to load locations", e);
            toast.error("Failed to load locations");
        }
    });

    // Helper to access form field helpers from the remote function
    function getField(name: string) {
        if (!(remoteFunction as any).fields) return {};
        const parts = name.split(".");
        let current = (remoteFunction as any).fields;
        for (const part of parts) {
            if (!current) return {};
            current = current[part];
        }
        return current || {};
    }

    function formatForInput(date: Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    function setQuickRange(days: number) {
        const now = new Date();
        const start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
        );
        const end = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + days,
            23,
            59,
        );

        startDate = formatForInput(start);
        endDate = formatForInput(end);
    }

    function setNextWeek() {
        const now = new Date();
        const day = now.getDay();
        // Distance to next Monday (1-7 days away)
        const diff = (8 - (day === 0 ? 7 : day)) % 7 || 7;
        const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 0, 0);
        const nextSunday = new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + 6, 23, 59);
        
        startDate = formatForInput(nextMonday);
        endDate = formatForInput(nextSunday);
    }

    function setNextMonth() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59); 
        
        startDate = formatForInput(start);
        endDate = formatForInput(end);
    }
</script>

<div class="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow">
    <form
        {...remoteFunction
            .preflight(validationSchema)
            .enhance(async ({ submit }: any) => {
                try {
                    const result: any = await submit();
                    if (result?.error) {
                        toast.error(result.error);
                        return;
                    }
                    toast.success(
                        isUpdating ? "Kiosk updated!" : "Kiosk created!",
                    );
                    goto("/kiosks");
                } catch (error: any) {
                    toast.error(
                        error?.message || "An unexpected error occurred",
                    );
                }
            })}
        class="space-y-6"
    >
        {#if isUpdating && initialData}
            <input {...getField("id").as("hidden", initialData.id)} />
        {/if}

        <div class="space-y-2">
            <label for="name" class="block text-sm font-medium text-gray-700"
                >Kiosk Name</label
            >
            <input
                {...getField("name").as("text")}
                value={getField("name").value() ?? initialData?.name ?? ""}
                placeholder="e.g. Main Lobby Screen"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                onblur={() => remoteFunction.validate()}
            />
            {#each getField("name").issues() ?? [] as issue}
                <p class="mt-1 text-sm text-red-600">{issue.message}</p>
            {/each}
        </div>

        <div class="space-y-2">
            <label
                for="description"
                class="block text-sm font-medium text-gray-700"
                >Description (Optional)</label
            >
            <textarea
                {...getField("description").as("text")}
                rows="3"
                value={getField("description").value() ??
                    initialData?.description ??
                    ""}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                onblur={() => remoteFunction.validate()}
            ></textarea>
        </div>

        <div class="space-y-2">
            {#if !loaded}
                <div class="animate-pulse h-10 bg-gray-100 rounded"></div>
            {:else}
                <EntityManager
                    title="Locations"
                    icon={MapPin}
                    {type}
                    entityId={initialData?.id}
                    initialItems={locations.filter((l: any) =>
                        selectedLocationIds.includes(l.id),
                    )}
                    onchange={(ids: string[]) => (selectedLocationIds = ids)}
                    embedded={true}
                    listItemsRemote={listLocations as any}
                    deleteItemRemote={async (id: string) => {
                        return await handleDelete({
                            ids: [id],
                            deleteFn: deleteLocation,
                            itemName: "location",
                        });
                    }}
                    createRemote={createLocation}
                    createSchema={createLocationSchema}
                    updateRemote={updateLocation}
                    updateSchema={updateLocationSchema}
                    getFormData={(l: Location) => l}
                    searchPredicate={(l: Location, q: string) => {
                        return (
                            l.name.toLowerCase().includes(q.toLowerCase()) ||
                            (l.roomId
                                ?.toLowerCase()
                                .includes(q.toLowerCase()) ??
                                false)
                        );
                    }}
                >
                    {#snippet renderItemLabel(location)}
                        {location.name}
                        {location.roomId ? `(${location.roomId})` : ""}
                    {/snippet}
                    {#snippet renderForm({
                        remoteFunction: rf,
                        schema,
                        id,
                        initialData: formData,
                        onSuccess,
                        onCancel,
                    })}
                        <LocationForm
                            remoteFunction={rf}
                            validationSchema={schema}
                            isUpdating={!!id}
                            initialData={formData}
                            {onSuccess}
                            {onCancel}
                        />
                    {/snippet}
                </EntityManager>
                <!-- Hidden input for submission -->
                <input
                    {...getField("locationIds").as(
                        "hidden",
                        JSON.stringify(selectedLocationIds),
                    )}
                />
                {#each getField("locationIds").issues() ?? [] as issue}
                    <p class="mt-1 text-sm text-red-600">{issue.message}</p>
                {/each}
            {/if}
            <p class="text-xs text-gray-500">
                Events linked to this location will be displayed.
            </p>
        </div>

        <div class="space-y-4 border-t pt-6">
            <h3 class="text-lg font-medium text-gray-900">
                Display Configuration
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-2">
                    <label
                        for="uiMode"
                        class="block text-sm font-medium text-gray-700"
                        >Visualization</label
                    >
                    <select
                        {...getField("uiMode").as("text")}
                        bind:value={uiMode}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    >
                        <option value="carousel">Carousel (Full Screen)</option>
                        <option value="table">Table View (List)</option>
                    </select>
                </div>

                <div class="space-y-2">
                    <label
                        for="rangeMode"
                        class="block text-sm font-medium text-gray-700"
                        >Time Range Mode</label
                    >
                    <select
                        {...getField("rangeMode").as("text")}
                        bind:value={rangeMode}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    >
                        <option value="rolling">Rolling Window</option>
                        <option value="fixed">Fixed Date Range</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="space-y-2">
                <label
                    for="loopDuration"
                    class="block text-sm font-medium text-gray-700"
                    >Loop Duration (s)</label
                >
                <input
                    {...getField("loopDuration").as("number")}
                    value={getField("loopDuration").value() ??
                        initialData?.loopDuration ??
                        5}
                    min="3"
                    required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                />
                <p class="text-xs text-gray-500">Time per slide/page.</p>
                {#each getField("loopDuration").issues() ?? [] as issue}
                    <p class="mt-1 text-sm text-red-600">{issue.message}</p>
                {/each}
            </div>

            {#if rangeMode === "rolling"}
                <div class="space-y-2">
                    <label
                        for="lookAheadDays"
                        class="block text-sm font-medium text-gray-700"
                        >Look Ahead (Days)</label
                    >
                    <input
                        {...getField("lookAheadDays").as("number")}
                        value={getField("lookAheadDays").value() ??
                            lookAheadDays}
                        min="0"
                        required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                    {#each getField("lookAheadDays").issues() ?? [] as issue}
                        <p class="mt-1 text-sm text-red-600">
                            {issue.message}
                        </p>
                    {/each}
                </div>

                <div class="space-y-2">
                    <label
                        for="lookPastDays"
                        class="block text-sm font-medium text-gray-700"
                        >Look Past (Days)</label
                    >
                    <input
                        {...getField("lookPastDays").as("number")}
                        value={getField("lookPastDays").value() ?? lookPastDays}
                        min="0"
                        required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                    {#each getField("lookPastDays").issues() ?? [] as issue}
                        <p class="mt-1 text-sm text-red-600">
                            {issue.message}
                        </p>
                    {/each}
                </div>
            {:else}
                <div class="space-y-3 col-span-3 border-t pt-4">
                    <span class="block text-sm font-medium text-gray-700"
                        >Quick Selectors</span
                    >
                    <div class="flex gap-2">
                        <button
                            type="button"
                            class="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-md transition-colors"
                            onclick={() => setNextWeek()}
                        >
                            Next Week
                        </button>
                        <button
                            type="button"
                            class="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-md transition-colors"
                            onclick={() => setNextMonth()}
                        >
                            Next Month
                        </button>
                        <button
                            type="button"
                            class="text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-md transition-colors"
                            onclick={() => {
                                const now = new Date();
                                const start = new Date(
                                    now.getFullYear(),
                                    now.getMonth(),
                                    now.getDate(),
                                    0,
                                    0,
                                );
                                startDate = formatForInput(start);
                            }}
                        >
                            Reset Start Time (00:00)
                        </button>
                        <button
                            type="button"
                            class="text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-md transition-colors"
                            onclick={() => {
                                const val = endDate ? new Date(endDate) : new Date();
                                const end = new Date(
                                    val.getFullYear(),
                                    val.getMonth(),
                                    val.getDate(),
                                    23,
                                    59,
                                );
                                endDate = formatForInput(end);
                            }}
                        >
                            Reset End Time (23:59)
                        </button>
                    </div>
                </div>

                <div class="space-y-2">
                    <label
                        for="startDate"
                        class="block text-sm font-medium text-gray-700"
                        >Start Date</label
                    >
                    <input
                        {...getField("startDate").as("datetime-local")}
                        bind:value={startDate}
                        required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                </div>

                <div class="space-y-2">
                    <label
                        for="endDate"
                        class="block text-sm font-medium text-gray-700"
                        >End Date</label
                    >
                    <input
                        {...getField("endDate").as("datetime-local")}
                        bind:value={endDate}
                        required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                </div>
            {/if}
        </div>

        <div class="pt-4 flex justify-end gap-3">
            <Button href="/kiosks" variant="outline" type="button"
                >Cancel</Button
            >
            <AsyncButton type="submit" loading={remoteFunction.pending}>
                {isUpdating ? "Save Changes" : "Create Kiosk"}
            </AsyncButton>
        </div>
    </form>
</div>
