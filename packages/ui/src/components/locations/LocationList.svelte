<script lang="ts">
    import { Button } from "../button/index.js";
    // @ts-ignore
    import FilterMenu from "../FilterMenu.svelte";
    // @ts-ignore
    import ActiveFilterChips from "../ActiveFilterChips.svelte";
    import type { FilterGroup, FilterStateMap } from "../EntityManager.types.js";
    import {
        MapPin,
        Pencil,
        Trash2,
        Home,
        Hash,
        Plus,
        Search,
        ChevronDown,
        ArrowLeft,
        ArrowRight,
        ChevronsLeft,
        ChevronsRight,
    } from "@lucide/svelte";
    import { toast } from "svelte-sonner";
    import { onMount } from "svelte";

    interface Props {
        listLocationsRemote: (params?: any) => any;
        deleteLocationRemote?: (ids: string[]) => Promise<any>;
        filterGroups?: FilterGroup[];
        newHref?: string;
        editHref?: (id: string) => string;
        userHref?: (id: string) => string;
        preferenceKey?: string;
        showHeader?: boolean;
        title?: string;
        m?: any;
        labels?: {
            title?: string;
            newItem?: string;
            searchLocations?: string;
            filters?: string;
            sortLastUpdated?: string;
            sortCreatedDate?: string;
            sortName?: string;
            descending?: string;
            ascending?: string;
            activeFilters?: string;
            clearAllFilters?: string;
            deleteConfirm?: string;
            deleteSuccessful?: string;
            somethingWentWrong?: string;
            room?: string;
            edit?: string;
            delete?: string;
            updatedOn?: (date: string) => string;
            noLocationsFound?: string;
            tryAdjusting?: string;
            itemsPerPage?: (count: number) => string;
            showingRange?: (start: number, end: number, total: number) => string;
            firstPage?: string;
            previous?: string;
            next?: string;
            lastPage?: string;
            loading?: string;
        };
    }

    let {
        listLocationsRemote,
        deleteLocationRemote,
        filterGroups = undefined,
        newHref = "/locations/new",
        editHref = (id: string) => `/locations/${id}`,
        userHref = (id: string) => `/users/${id}`,
        preferenceKey = "locationsFilters",
        showHeader = true,
        title = undefined,
        m = undefined,
        labels = {},
    }: Props = $props();

    const i18n = {
        get title() {
            return title ?? labels?.title ?? m?.feature_locations_title?.() ?? m?.locations?.() ?? "Locations";
        },
        get newItem() {
            return labels?.newItem ?? (m?.new_item && m?.location ? m.new_item({ item: m.location() }) : undefined) ?? (m?.new_item && m?.location_label ? m.new_item({ item: m.location_label() }) : undefined) ?? m?.create_location?.() ?? "New Location";
        },
        get searchLocations() {
            return labels?.searchLocations ?? m?.search_locations?.() ?? "Search locations...";
        },
        get filters() {
            return labels?.filters ?? m?.filters?.() ?? "Filters";
        },
        get sortLastUpdated() {
            return labels?.sortLastUpdated ?? m?.sort_last_updated?.() ?? "Last Updated";
        },
        get sortCreatedDate() {
            return labels?.sortCreatedDate ?? m?.sort_created_date?.() ?? "Created Date";
        },
        get sortName() {
            return labels?.sortName ?? m?.sort_name?.() ?? "Name";
        },
        get descending() {
            return labels?.descending ?? m?.descending?.() ?? "Descending";
        },
        get ascending() {
            return labels?.ascending ?? m?.ascending?.() ?? "Ascending";
        },
        get activeFilters() {
            return labels?.activeFilters ?? m?.active_filters?.() ?? "Active Filters:";
        },
        get clearAllFilters() {
            return labels?.clearAllFilters ?? m?.clear_all_filters?.() ?? "Clear all";
        },
        deleteConfirm(item: string) {
            return labels?.deleteConfirm ?? (m?.delete_confirm ? m.delete_confirm({ item: m?.location?.() ?? "location" }) : `Delete this location?`);
        },
        get deleteSuccessful() {
            return labels?.deleteSuccessful ?? m?.delete_successful?.() ?? m?.successfully_saved?.() ?? "Deleted successfully";
        },
        get somethingWentWrong() {
            return labels?.somethingWentWrong ?? m?.something_went_wrong?.() ?? "Something went wrong";
        },
        get room() {
            return labels?.room ?? m?.room?.() ?? "Room";
        },
        get edit() {
            return labels?.edit ?? m?.edit?.() ?? "Edit";
        },
        get delete() {
            return labels?.delete ?? m?.delete?.() ?? "Delete";
        },
        updatedOn(date: string) {
            if (labels?.updatedOn) return labels.updatedOn(date);
            if (m?.updated_on) return m.updated_on({ date });
            return `Updated on ${date}`;
        },
        get noLocationsFound() {
            return labels?.noLocationsFound ?? m?.not_found?.({ item: m?.locations?.() ?? "Locations" }) ?? "No locations found";
        },
        get tryAdjusting() {
            return labels?.tryAdjusting ?? m?.try_adjusting_filters?.() ?? "Try adjusting your search or filters.";
        },
        itemsPerPage(count: number) {
            if (labels?.itemsPerPage) return labels.itemsPerPage(count);
            if (m?.items_per_page) return m.items_per_page({ count });
            return `${count} per page`;
        },
        showingRange(start: number, end: number, total: number) {
            if (labels?.showingRange) return labels.showingRange(start, end, total);
            if (m?.showing_range) return m.showing_range({ from: start, to: end, total });
            return `Showing ${start} to ${end} of ${total}`;
        },
        get firstPage() {
            return labels?.firstPage ?? m?.first_page?.() ?? "First page";
        },
        get previous() {
            return labels?.previous ?? m?.previous?.() ?? "Previous";
        },
        get next() {
            return labels?.next ?? m?.next?.() ?? "Next";
        },
        get lastPage() {
            return labels?.lastPage ?? m?.last_page?.() ?? "Last page";
        },
        get loading() {
            return labels?.loading ?? m?.loading?.() ?? "Loading...";
        },
        get city() {
            return m?.cities ? m.cities() : "City";
        }
    };

    let sortField = $state<"updatedAt" | "createdAt" | "name">("updatedAt");
    let sortOrder = $state<"asc" | "desc">("desc");
    let searchQuery = $state("");
    let filterValues = $state<FilterStateMap>({});
    let page = $state(1);
    let limit = $state(50);

    onMount(() => {
        try {
            if (typeof window !== "undefined") {
                const savedPrefs = localStorage.getItem(preferenceKey);
                if (savedPrefs) {
                    const prefs = JSON.parse(savedPrefs);
                    if (prefs.sortField) sortField = prefs.sortField;
                    if (prefs.sortOrder) sortOrder = prefs.sortOrder;
                    if (prefs.filterValues) filterValues = prefs.filterValues;
                }
            }
        } catch (e) {
            console.error("Failed to load preferences", e);
        }
    });

    $effect(() => {
        if (typeof window !== "undefined") {
            try {
                const prefsToSave = {
                    sortField,
                    sortOrder,
                    filterValues,
                };
                localStorage.setItem(preferenceKey, JSON.stringify(prefsToSave));
            } catch (e) {
                console.error("Failed to save preferences", e);
            }
        }
    });

    const effectiveFilterGroups = $derived<FilterGroup[]>(
        filterGroups ?? [
            {
                id: "city",
                label: i18n.city,
                icon: MapPin,
                type: "select",
                searchable: true,
                optionsRemote: async () => {
                    const res = await listLocationsRemote({ limit: 1000 });
                    const items = Array.isArray(res) ? res : (res?.data ?? []);
                    const cities = [...new Set(items.map((i: any) => i.city).filter(Boolean))];
                    return cities.sort().map((city) => ({ id: String(city), value: String(city), label: String(city) }));
                },
            },
        ]
    );

    const filterState = $derived({
        page,
        limit,
        search: searchQuery || undefined,
        city: (filterValues.city?.include?.length || filterValues.city?.exclude?.length) ? filterValues.city : undefined,
        sortField,
        sortOrder,
    });

    const query = $derived(listLocationsRemote(filterState));
    const result = $derived(query.current);
    const items = $derived(result?.data ?? []);
    const total = $derived(result?.total ?? 0);
    const isLoading = $derived(query.loading);
    const queryError = $derived(query.error);

    async function handleDelete(location: any) {
        if (!window.confirm(i18n.deleteConfirm(location.name || "Location"))) return;
        try {
            if (deleteLocationRemote) {
                await deleteLocationRemote([location.id]);
            }
            toast.success(i18n.deleteSuccessful);
            if (typeof (query as any)?.refresh === 'function') {
                await (query as any).refresh();
            } else if (typeof (listLocationsRemote as any)?.refresh === 'function') {
                await (listLocationsRemote as any)(filterState).refresh();
            }
        } catch (error: any) {
            toast.error(error?.message || i18n.somethingWentWrong);
        }
    }
</script>

{#if showHeader}
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div>
            <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                {i18n.title}
            </h1>
        </div>
        <Button href={newHref} class="w-full md:w-auto shadow-sm">
            <Plus class="w-4 h-4 mr-2" />
            {i18n.newItem}
        </Button>
    </div>
{/if}

<!-- Action Bar -->
<div class="flex flex-col md:flex-row gap-3 mb-6">
    <div class="relative flex-1">
        <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
            type="text"
            placeholder={i18n.searchLocations}
            bind:value={searchQuery}
            oninput={() => (page = 1)}
            class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
        />
    </div>
    <div class="flex items-center gap-2 shrink-0">
        {#if effectiveFilterGroups.length > 0}
            <FilterMenu
                groups={effectiveFilterGroups}
                bind:filters={filterValues}
                buttonLabel={i18n.filters}
                onchange={() => (page = 1)}
            />
        {/if}

        <div class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1">
            <select
                bind:value={sortField}
                onchange={() => (page = 1)}
                class="text-sm bg-transparent border-none focus:ring-0 py-2 pl-2 pr-6 cursor-pointer text-gray-700 dark:text-gray-300"
            >
                <option value="updatedAt">{i18n.sortLastUpdated}</option>
                <option value="createdAt">{i18n.sortCreatedDate}</option>
                <option value="name">{i18n.sortName}</option>
            </select>
            <button
                type="button"
                class="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onclick={() => (sortOrder = sortOrder === "desc" ? "asc" : "desc")}
                title={sortOrder === "desc" ? i18n.descending : i18n.ascending}
            >
                <ChevronDown size={14} class="transition-transform duration-200 {sortOrder === 'asc' ? 'rotate-180' : ''}" />
            </button>
        </div>
    </div>
</div>

<!-- Active Filter Chips -->
{#if effectiveFilterGroups.length > 0}
    <ActiveFilterChips
        groups={effectiveFilterGroups}
        filters={filterValues}
        activeFiltersLabel={i18n.activeFilters}
        clearAllLabel={i18n.clearAllFilters}
        onremove={(groupId: string, optId: string, type: "include" | "exclude") => {
            const current = filterValues[groupId] || { include: [], exclude: [] };
            filterValues = {
                ...filterValues,
                [groupId]: {
                    include: type === "include" ? current.include.filter((id) => id !== optId) : current.include,
                    exclude: type === "exclude" ? current.exclude.filter((id) => id !== optId) : current.exclude,
                },
            };
            page = 1;
        }}
        onclearall={() => {
            const reset: FilterStateMap = {};
            for (const g of effectiveFilterGroups) {
                reset[g.id] = { include: [], exclude: [] };
            }
            filterValues = reset;
            page = 1;
        }}
    />
{/if}

<svelte:boundary>
    {#if isLoading && !result}
        <div class="py-12 text-center text-gray-500">{i18n.loading}</div>
    {:else if queryError}
        <div class="py-12 text-center text-red-500">{queryError instanceof Error ? queryError.message : i18n.somethingWentWrong}</div>
    {:else}
        <div class={[isLoading && "opacity-50 pointer-events-none transition-opacity duration-200"]}>
            <!-- List -->
            <div class="grid grid-cols-1 gap-5">
                {#each items as location (location.id)}
                    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-md transition-shadow">
                        <div class="flex-1 mb-5">
                            <div class="flex items-start gap-4">
                                <div class="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
                                    <MapPin size={24} />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <a href={editHref(location.id)} class="block group mb-1">
                                        <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug truncate transition-colors">
                                            {location.name}
                                        </h3>
                                    </a>
                                    {#if location.roomId}
                                        <p class="text-sm text-gray-500 flex items-center gap-1 mb-2">
                                            <Hash size={14} />
                                            {i18n.room}: {location.roomId}
                                        </p>
                                    {/if}
                                    
                                    <div class="flex items-start gap-2 mt-3 text-gray-600 dark:text-gray-400">
                                        <Home size={16} class="mt-0.5 opacity-70 shrink-0" />
                                        <div class="flex flex-col text-sm">
                                            {#if location.street || location.houseNumber}
                                                <span>{location.street || ""} {location.houseNumber || ""}</span>
                                            {/if}
                                            {#if location.zip || location.city}
                                                <span>{location.zip || ""} {location.city || ""}</span>
                                            {/if}
                                            {#if location.state || location.country}
                                                <span class="text-gray-400 dark:text-gray-500">
                                                    {location.state || ""}{location.state && location.country ? ", " : ""}{location.country || ""}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 w-full sm:w-auto">
                            <Button variant="outline" size="sm" href={editHref(location.id)} class="flex-1 sm:flex-none">
                                <Pencil class="w-4 h-4 mr-2" />
                                {i18n.edit}
                            </Button>
                            <button
                                type="button"
                                class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500 cursor-pointer"
                                onclick={() => handleDelete(location)}
                            >
                                <Trash2 class="w-4 h-4 mr-2" />
                                {i18n.delete}
                            </button>
                        </div>
                        <div class="text-[11px] text-gray-400 dark:text-gray-500 text-right px-1 mt-2">
                            {i18n.updatedOn(new Date(location.updatedAt).toLocaleString([], {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                            }))}
                            {#if location.user}
                                | <a
                                    href={userHref(location.user.id)}
                                    class="hover:underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                                >{location.user.name ||
                                    location.user.email ||
                                    "User"}</a>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                        <MapPin class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {i18n.noLocationsFound}
                        </h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {i18n.tryAdjusting}
                        </p>
                    </div>
                {/each}
            </div>

            <!-- Pagination -->
            {#if total > limit}
                {@const totalPages = Math.ceil(total / limit)}
                <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span>{i18n.showingRange((page - 1) * limit + 1, Math.min(page * limit, total), total)}</span>
                        <div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                            <select
                                bind:value={limit}
                                onchange={() => (page = 1)}
                                class="text-xs bg-transparent border-gray-200 dark:border-gray-700 rounded-md py-1 pl-2 pr-6 text-gray-500 cursor-pointer focus:ring-0"
                            >
                                <option value={10}>{i18n.itemsPerPage(10)}</option>
                                <option value={20}>{i18n.itemsPerPage(20)}</option>
                                <option value={50}>{i18n.itemsPerPage(50)}</option>
                                <option value={100}>{i18n.itemsPerPage(100)}</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex items-center gap-1 sm:gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={page === 1}
                            onclick={() => page = 1}
                            class="h-9 w-9 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
                            title={i18n.firstPage}
                        >
                            <ChevronsLeft size={16} />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
                            onclick={() => page > 1 && page--}
                            class="h-9 px-3 border-gray-200 dark:border-gray-700 shrink-0"
                        >
                            <ArrowLeft size={16} class="mr-1.5 hidden sm:block" />
                            {i18n.previous}
                        </Button>
                        <div class="flex items-center gap-1 px-1 sm:px-2 font-medium text-sm text-gray-700 dark:text-gray-300">
                            <select
                                bind:value={page}
                                class="text-sm bg-transparent border-none font-medium p-0 focus:ring-0 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 min-w-[2.5rem]"
                            >
                                {#each Array(totalPages) as _, i}
                                    <option value={i + 1}>{i + 1}</option>
                                {/each}
                            </select>
                            <span class="text-gray-400">/ {totalPages}</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === totalPages}
                            onclick={() => page < totalPages && page++}
                            class="h-9 px-3 border-gray-200 dark:border-gray-700 shrink-0"
                        >
                            {i18n.next}
                            <ArrowRight size={16} class="ml-1.5 hidden sm:block" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={page === totalPages}
                            onclick={() => page = totalPages}
                            class="h-9 w-9 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
                            title={i18n.lastPage}
                        >
                            <ChevronsRight size={16} />
                        </Button>
                    </div>
                </div>
            {/if}
        </div>
    {/if}
    {#snippet failed(error: unknown)}
        <div class="py-12 text-center text-red-500">{error instanceof Error ? error.message : i18n.somethingWentWrong}</div>
    {/snippet}
</svelte:boundary>
