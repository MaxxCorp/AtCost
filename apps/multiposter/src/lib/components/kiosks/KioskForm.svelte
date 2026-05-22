<script lang="ts">
    import { listLocations } from "../../../routes/locations/list.remote";
    import { type Location } from "@ac/validations";

    import * as m from "$lib/paraglide/messages";
    import Button from "$lib/components/ui/button/button.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { EntityManager, LocationForm, handleDelete, translateIssue } from "@ac/ui";
    import { createLocation } from "../../../routes/locations/new/create.remote";
    import { updateLocation } from "../../../routes/locations/[id]/update.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations";
    import { deleteLocation } from "../../../routes/locations/[id]/delete.remote";
    import { MapPin } from "@lucide/svelte";
    import { onMount, untrack } from "svelte";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
 
    let {
        remoteFunction,
        validationSchema,
        initialData = null,
        isUpdating = false,
    }: {
        remoteFunction: any;
        validationSchema: any;
        initialData?: any;
        isUpdating?: boolean;
    } = $props();
 
    const type = "kiosk";
 
 

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
 


 


    // svelte-ignore state_referenced_locally
    const rf = (remoteFunction as any).preflight(validationSchema);

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (rf as any).allIssues?.() ?? [];
        if (issues.length > 0 && prevIssuesLength === 0) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = issues.length;
    });
 
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
        {...rf.enhance(async ({ submit }: any) => {
                try {
                    const result: any = await submit();
                    if (result?.error) {
                        toast.error(result.error);
                        return;
                    }
                    toast.success(
                        isUpdating ? m.kiosk_updated() : m.kiosk_created(),
                    );
                    goto("/kiosks");
                } catch (error: any) {
                    toast.error(
                        error?.message || m.something_went_wrong(),
                    );
                }
            })}
        class="space-y-6"
    >
        {#if isUpdating && initialData?.id}
            <input {...rf.fields.id.as("text", initialData.id)} class="hidden" />
        {/if}

        <div class="space-y-2">
            <label for="name" class="block text-sm font-medium text-gray-700"
                >{m.kiosk_name()}</label
            >
            <input
                {...rf.fields.name.as("text", initialData?.name ?? "")}
                placeholder={m.kiosk_name_placeholder()}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                onblur={() => rf.validate()}
            />
            {#each (rf.fields.name.issues() ?? []) as issue}
                <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
            {/each}
        </div>

        <div class="space-y-2">
            <label
                for="description"
                class="block text-sm font-medium text-gray-700"
                >{m.description()} ({m.other_label()})</label
            >
            <textarea
                {...rf.fields.description.as("text", initialData?.description ?? "")}
                rows="3"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                onblur={() => rf.validate()}
            ></textarea>
        </div>

        <div class="space-y-2">
            {#await listLocations()}

                <div class="animate-pulse h-10 bg-gray-100 rounded"></div>
            {:then locs}
                <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
                    <MapPin size={18} class="text-blue-600" />
                    {m.feature_locations_title()}
                </h3>
                {#key initialData?.id || "new"}
                    <EntityManager
                        title={m.feature_locations_title()}
                        icon={MapPin}
                        mode="embedded"
                        {type}
                        entityId={initialData?.id}
                        initialItems={locs.data.filter((l: any) =>
                            selectedLocationIds.includes(l.id),
                        )}
                        onchange={(ids: string[]) =>
                            (selectedLocationIds = ids)}
                        listItemsRemote={listLocations as any}
                        deleteItemRemote={async (ids: string[]) => {
                            return await handleDelete({
                                ids,
                                deleteFn: deleteLocation,
                                itemName: m.location(),
                            });
                        }}
                        createRemote={createLocation}
                        createSchema={createLocationSchema}
                        updateRemote={updateLocation}
                        updateSchema={updateLocationSchema}
                        getFormData={(l: Location) => l}
                        searchPredicate={(l: Location, q: string) => {
                            return (
                                l.name
                                    .toLowerCase()
                                    .includes(q.toLowerCase()) ||
                                (l.roomId
                                    ?.toLowerCase()
                                    .includes(q.toLowerCase()) ??
                                    false)
                            );
                        }}
                        loadingLabel={m.loading_item({
                            item: m.feature_locations_title(),
                        })}
                        noItemsLabel={m.no_items_associated_label({
                            item: m.feature_locations_title(),
                        })}
                        noItemsFoundLabel={m.no_items_found({
                            item: m.feature_locations_title(),
                        })}
                        searchPlaceholder={m.search_placeholder({
                            item: m.feature_locations_title(),
                        })}
                        linkItemLabel={m.link_item_label({
                            item: m.feature_locations_title(),
                        })}
                        associatedItemLabel={m.associated_item_label({
                            item: m.feature_locations_title(),
                        })}
                        quickCreateLabel={m.quick_create()}
                        closeSearchLabel={m.close_search()}
                        editLabel={m.edit()}
                        deleteLabel={m.delete()}
                        unlinkLabel={m.unlink()}
                        deleteForeverLabel={m.delete_forever({
                            item: m.location(),
                        })}
                        bulkDeleteLabel={m.delete_selected({ count: 0 })}
                        selectAllLabel={m.select_all()}
                        deselectAllLabel={m.deselect_all()}
                        confirmUnlinkLabel={m.confirm_unlink_label({
                            item: m.location(),
                        })}
                    >
                        {#snippet renderItemLabel(location: any)}
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
                        }: any)}
                            <LocationForm
                                remoteFunction={rf}
                                validationSchema={schema}
                                isUpdating={!!id}
                                initialData={formData}
                                {onSuccess}
                                {onCancel}
                                labels={{
                                    name: m.location_name(),
                                    street: m.street(),
                                    houseNumber: m.house_number(),
                                    addressSuffix: m.address_suffix(),
                                    zip: m.zip_code(),
                                    city: m.city(),
                                    state: m.state_region(),
                                    country: m.country(),
                                    roomId: m.room_id(),
                                    latitude: m.latitude(),
                                    longitude: m.longitude(),
                                    what3words: m.what3words(),
                                    inclusivitySupport: m.inclusivity_support(),
                                    isPublic: m.public(),
                                    heroImage: m.hero_image(),
                                    saveChanges: m.save_changes(),
                                    createLocation: m.create_location(),
                                    cancel: m.cancel(),
                                    saving: m.loading(),
                                    creating: m.creating(),
                                    successfullySaved: m.successfully_saved(),
                                    errorSomethingWentWrong:
                                        m.something_went_wrong(),
                                    enterLocationName: m.enter_location_name(),
                                    streetName: m.street_placeholder(),
                                    houseNumberPlaceholder:
                                        m.house_number_placeholder(),
                                    addressSuffixPlaceholder:
                                        m.address_suffix_placeholder(),
                                    zipCodePlaceholder:
                                        m.zip_code_placeholder(),
                                    cityNamePlaceholder: m.city_placeholder(),
                                    statePlaceholder: m.state_placeholder(),
                                    countryPlaceholder: m.country_placeholder(),
                                    enterRoomId: m.room_id_placeholder(),
                                    latitudePlaceholder:
                                        m.latitude_placeholder(),
                                    longitudePlaceholder:
                                        m.longitude_placeholder(),
                                    what3wordsPlaceholder:
                                        m.what3words_placeholder(),
                                    inclusivitySupportPlaceholder:
                                        m.accessibility_info(),
                                }}
                            />
                        {/snippet}
                    </EntityManager>
                {/key}
                <input
                    {...rf.fields.locationIds.as(
                        "text",
                        JSON.stringify(selectedLocationIds),
                    )}
                    class="hidden"
                />
                {#each (rf.fields.locationIds.issues() ?? []) as issue}
                    <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
                {/each}
            {:catch error}
                <div class="text-red-600 p-4 border border-red-200 rounded">
                    {error.message || m.something_went_wrong()}
                </div>
            {/await}

            <p class="text-xs text-gray-500">
                {m.linked_events_description()}
            </p>
        </div>

        <div class="space-y-4 border-t pt-6">
            <h3 class="text-lg font-medium text-gray-900">
                {m.display_configuration()}
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-2">
                    <label
                        for="uiMode"
                        class="block text-sm font-medium text-gray-700"
                        >{m.visualization()}</label
                    >
                    <select
                        {...rf.fields.uiMode.as("text", uiMode)}
                        value={uiMode}
                        onchange={(e) => {
                            uiMode = e.currentTarget.value;
                            rf.validate();
                        }}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    >
                        <option value="carousel">{m.carousel_full_screen()}</option>
                        <option value="table">{m.table_view_list()}</option>
                    </select>
                </div>

                <div class="space-y-2">
                    <label
                        for="rangeMode"
                        class="block text-sm font-medium text-gray-700"
                        >{m.time_range_mode()}</label
                    >
                    <select
                        {...rf.fields.rangeMode.as("text", rangeMode)}
                        value={rangeMode}
                        onchange={(e) => {
                            rangeMode = e.currentTarget.value as any;
                            rf.validate();
                        }}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    >
                        <option value="rolling">{m.rolling_window()}</option>
                        <option value="fixed">{m.fixed_date_range()}</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="space-y-2">
                <label
                    for="loopDuration"
                    class="block text-sm font-medium text-gray-700"
                    >{m.loop_duration_seconds()}</label
                >
                <input
                    {...rf.fields.loopDuration.as("number", initialData?.loopDuration ?? 5)}
                    min="3"
                    required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    onblur={() => rf.validate()}
                />
                <p class="text-xs text-gray-500">{m.time_per_slide()}</p>
                {#each (rf.fields.loopDuration.issues() ?? []) as issue}
                    <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
                {/each}
            </div>

            {#if rangeMode === "rolling"}
                <div class="space-y-2">
                    <label
                        for="lookAheadDays"
                        class="block text-sm font-medium text-gray-700"
                        >{m.look_ahead_days()}</label
                    >
                    <input
                        {...rf.fields.lookAheadDays.as("number", lookAheadDays)}
                        min="0"
                        required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        onblur={() => rf.validate()}
                    />
                    {#each (rf.fields.lookAheadDays.issues() ?? []) as issue}
                        <p class="mt-1 text-sm text-red-600">
                            {translateIssue(issue.message, m)}
                        </p>
                    {/each}
                </div>

                <div class="space-y-2">
                    <label
                        for="lookPastDays"
                        class="block text-sm font-medium text-gray-700"
                        >{m.look_past_days()}</label
                    >
                    <input
                        {...rf.fields.lookPastDays.as("number", lookPastDays)}
                        min="0"
                        required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        onblur={() => rf.validate()}
                    />
                    {#each (rf.fields.lookPastDays.issues() ?? []) as issue}
                        <p class="mt-1 text-sm text-red-600">
                            {translateIssue(issue.message, m)}
                        </p>
                    {/each}
                </div>
            {:else}
                <div class="space-y-3 col-span-3 border-t pt-4">
                    <span class="block text-sm font-medium text-gray-700"
                        >{m.quick_selectors()}</span
                    >
                    <div class="flex gap-2">
                        <button
                            type="button"
                            class="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-md transition-colors"
                            onclick={() => setNextWeek()}
                        >
                            {m.next_week()}
                        </button>
                        <button
                            type="button"
                            class="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-md transition-colors"
                            onclick={() => setNextMonth()}
                        >
                            {m.next_month()}
                        </button>
                    </div>
                </div>

                <div class="space-y-2">
                    <label
                        for="startDate"
                        class="block text-sm font-medium text-gray-700"
                        >{m.start_date()}</label
                    >
                    <input
                        {...rf.fields.startDate.as("datetime-local", startDate)}
                        value={startDate}
                        oninput={(e) => {
                            startDate = e.currentTarget.value;
                            rf.validate();
                        }}
                        required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                    {#each (rf.fields.startDate.issues() ?? []) as issue}
                        <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
                    {/each}
                </div>

                <div class="space-y-2">
                    <label
                        for="endDate"
                        class="block text-sm font-medium text-gray-700"
                        >{m.end_date()}</label
                    >
                    <input
                        {...rf.fields.endDate.as("datetime-local", endDate)}
                        value={endDate}
                        oninput={(e) => {
                            endDate = e.currentTarget.value;
                            rf.validate();
                        }}
                        required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    />
                    {#each (rf.fields.endDate.issues() ?? []) as issue}
                        <p class="mt-1 text-sm text-red-600">{translateIssue(issue.message, m)}</p>
                    {/each}
                </div>
            {/if}
        </div>

        <div class="pt-4 flex justify-end gap-3">
            <Button href="/kiosks" variant="outline" type="button"
                >{m.cancel()}</Button
            >
            <AsyncButton type="submit" loading={rf.pending}>
                {isUpdating ? m.save_changes() : m.create_kiosk()}
            </AsyncButton>
        </div>
    </form>
</div>
