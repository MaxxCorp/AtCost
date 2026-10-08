<script lang="ts">
	import { listEvents } from "./list.remote";
	import { checkSeriesMigrationStatus } from "./series-migration.remote";
	import { listTags } from "../tags/list.remote";
	import { listLocations } from "../locations/list.remote";
	import { deleteEvents } from "./delete.remote";
	import SeriesMigrationDialog from "#lib/components/events/SeriesMigrationDialog.svelte";
	import SeriesModeSelector from "#lib/components/events/SeriesModeSelector.svelte";
	import * as m from "#lib/paraglide/messages.js";
	import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
	import Button from "#lib/components/ui/button/button.svelte";
	import {
		Pencil,
		Trash2,
		Plus,
		Clock,
		MapPin,
		ChevronDown,
		ChevronRight,
		CalendarDays,
		Calendar,
		Filter as FilterIcon,
		Search,
		ArrowLeft,
		ArrowRight,
		ChevronsLeft,
		ChevronsRight,
		X,
		RefreshCw,
		Tag as TagIcon,
	} from "@lucide/svelte";
	import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
	import { toast } from "svelte-sonner";
	import { onMount, untrack } from "svelte";
	import { SvelteDate, SvelteSet } from "svelte/reactivity";
	import { getPreference, setPreference } from "#lib/utils/idb.js";
	import { formatRecurrenceText } from "#lib/utils/format-recurrence.js";
	import { getEventRooms } from "#lib/utils/format-rooms.js";
	import {
		formatEventStatus,
		getStatusBadgeClass,
		getStatusDotClass,
	} from "#lib/utils/format-event-status.js";
	import { goto } from "$app/navigation";
	import {
		formatFriendlyEventTime,
		getEventDurationDays,
		isMultiDayEvent,
	} from "#lib/utils/format-event-date.js";

	function formatDate(dateStr: string | null | undefined) {
		if (!dateStr) return "";
		return new Date(dateStr).toLocaleDateString(undefined, {
			weekday: "short",
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}

	function formatTime(dateTimeStr: string | null | undefined) {
		if (!dateTimeStr) return "";
		return new Date(dateTimeStr).toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	function getUpcomingInstance(event: any) {
		if (!event.instances || event.instances.length === 0) return null;
		const now = Date.now();
		const upcoming = event.instances.find((inst: any) => {
			const time = inst.endDateTime
				? new Date(inst.endDateTime).getTime()
				: (inst.startDateTime ? new Date(inst.startDateTime).getTime() : 0);
			return time >= now;
		});
		return upcoming || event.instances[0] || null;
	}

	function isSeriesEvent(event: any): boolean {
		return Boolean(
			event.isSeriesInstance ||
			event.isSeries ||
			event.recurringEventId ||
			event.seriesId ||
			(event.recurrence && event.recurrence.length > 0) ||
			(event.instances && event.instances.length > 0)
		);
	}

	import {
		FilterMenu,
		ActiveFilterChips,
		type FilterGroup,
		type FilterStateMap,
		type RadioFilterGroup,
	} from "@ac/ui";

	// View Mode / Display Mode types & state
	type DisplayMode = "compacted" | "unrolled";

	interface ModeFilterSettings {
		filterValues?: FilterStateMap;
		excludePast?: boolean;
		excludeSeries?: boolean;
		onlySeries?: boolean;
		sortOrder?: "asc" | "desc";
		limit?: number;
	}

	// Filter state
	let sortField = $state<"updatedAt" | "startDateTime" | "createdAt">(
		"updatedAt",
	);
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let searchInput = $state("");
	let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
	let isInitialized = $state(false);

	function handleSearchInput(e: Event) {
		const val = (e.currentTarget as HTMLInputElement).value;
		searchInput = val;
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			searchQuery = val;
			page = 1;
		}, 300);
	}

	let filterValues = $state<FilterStateMap>({});
	let excludePast = $state(false);
	let excludeSeries = $state(false);
	let onlySeries = $state(false);
	let page = $state(1);
	let limit = $state(50);
	let showMigrationDialog = $state(false);

	let displayMode = $state<DisplayMode>("compacted");
	let displayModeOverrides = $state<Record<string, DisplayMode>>({});
	let modeSettings: Record<DisplayMode, ModeFilterSettings> = {
		compacted: {},
		unrolled: {},
	};

	function setDisplayMode(newMode: DisplayMode, isExplicit = false) {
		displayMode = newMode;
		if (isExplicit) {
			displayModeOverrides[sortField] = newMode;
		}

		// Restore settings saved for this view mode
		const saved = modeSettings[newMode];
		if (saved) {
			if (saved.filterValues) filterValues = saved.filterValues;
			if (saved.excludePast !== undefined) excludePast = saved.excludePast;
			if (saved.excludeSeries !== undefined) excludeSeries = saved.excludeSeries;
			if (saved.onlySeries !== undefined) onlySeries = saved.onlySeries;
			if (saved.sortOrder) sortOrder = saved.sortOrder;
			if (saved.limit) limit = saved.limit;
		} else if (newMode === "unrolled" && sortField === "startDateTime") {
			sortOrder = "asc";
		}
		page = 1;
	}

	function handleSortFieldChange(newSortField: "updatedAt" | "startDateTime" | "createdAt") {
		sortField = newSortField;
		const override = displayModeOverrides[newSortField];
		if (override) {
			setDisplayMode(override, false);
		} else if (newSortField === "startDateTime") {
			setDisplayMode("unrolled", false);
		} else {
			setDisplayMode("compacted", false);
		}
		page = 1;
	}

	const radioGroups = $derived<RadioFilterGroup[]>([
		{
			id: "displayMode",
			label: m.series_display(),
			value: displayMode,
			options: [
				{
					value: "compacted",
					label: m.series_compacted(),
					description: m.series_compacted_desc(),
					icon: RefreshCw,
				},
				{
					value: "unrolled",
					label: m.series_unrolled(),
					description: m.series_unrolled_desc(),
					icon: CalendarDays,
				},
			],
			onchange: (val: string) => {
				setDisplayMode(val as DisplayMode, true);
			},
		},
	]);

	import { getEventFilterGroups } from "#lib/filters/index.js";

	const filterGroups = $derived<FilterGroup[]>(getEventFilterGroups(m));

	const booleanFilters = $derived([
		{
			id: "excludePast",
			label: m.hide_past_events(),
			checked: excludePast,
			onchange: (val: boolean) => {
				excludePast = val;
				page = 1;
			},
		},
		{
			id: "excludeSeries",
			label: m.hide_series_events(),
			checked: excludeSeries,
			onchange: (val: boolean) => {
				excludeSeries = val;
				if (excludeSeries) onlySeries = false;
				page = 1;
			},
		},
		{
			id: "onlySeries",
			label: m.only_series_events(),
			checked: onlySeries,
			onchange: (val: boolean) => {
				onlySeries = val;
				if (onlySeries) excludeSeries = false;
				page = 1;
			},
		},
	]);

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("eventsFilters", null);
			if (savedPrefs) {
				const prefs = JSON.parse(savedPrefs as string);
				if (prefs.displayModeOverrides) displayModeOverrides = prefs.displayModeOverrides;
				if (prefs.modeSettings) modeSettings = prefs.modeSettings;

				const initialSort = prefs.sortField || "updatedAt";
				sortField = initialSort;

				const initialMode: DisplayMode =
					prefs.displayMode ||
					displayModeOverrides[initialSort] ||
					(initialSort === "startDateTime" ? "unrolled" : "compacted");
				displayMode = initialMode;

				const saved = modeSettings[initialMode] || {};
				if (saved.filterValues) filterValues = saved.filterValues;
				else if (prefs.filterValues) filterValues = prefs.filterValues;

				if (saved.excludePast !== undefined) excludePast = saved.excludePast;
				else if (prefs.excludePast !== undefined) excludePast = prefs.excludePast;

				if (saved.excludeSeries !== undefined) excludeSeries = saved.excludeSeries;
				else if (prefs.excludeSeries !== undefined) excludeSeries = prefs.excludeSeries;

				if (saved.onlySeries !== undefined) onlySeries = saved.onlySeries;
				else if (prefs.onlySeries !== undefined) onlySeries = prefs.onlySeries;

				if (saved.sortOrder) sortOrder = saved.sortOrder;
				else if (prefs.sortOrder) sortOrder = prefs.sortOrder;
				else if (initialSort === "startDateTime") sortOrder = "asc";

				if (saved.limit) limit = saved.limit;
				else if (prefs.limit) limit = prefs.limit;
			}
		} catch (e) {
			console.error("Failed to load preferences", e);
		} finally {
			isInitialized = true;
		}
	});

	$effect(() => {
		// Capture reactive dependencies to track
		const currentMode = displayMode;
		const currentFilterValues = filterValues;
		const currentExcludePast = excludePast;
		const currentExcludeSeries = excludeSeries;
		const currentOnlySeries = onlySeries;
		const currentSortOrder = sortOrder;
		const currentLimit = limit;
		const currentSortField = sortField;
		const currentOverrides = displayModeOverrides;

		untrack(() => {
			modeSettings[currentMode] = {
				filterValues: currentFilterValues,
				excludePast: currentExcludePast,
				excludeSeries: currentExcludeSeries,
				onlySeries: currentOnlySeries,
				sortOrder: currentSortOrder,
				limit: currentLimit,
			};

			const prefsToSave = {
				displayMode: currentMode,
				displayModeOverrides: currentOverrides,
				modeSettings,
				sortField: currentSortField,
				sortOrder: currentSortOrder,
				filterValues: currentFilterValues,
				excludePast: currentExcludePast,
				excludeSeries: currentExcludeSeries,
				onlySeries: currentOnlySeries,
				limit: currentLimit,
			};
			setPreference("eventsFilters", JSON.stringify(prefsToSave)).catch(
				console.error,
			);
		});
	});

	const filterState = $derived({
		page,
		limit,
		search: searchQuery || undefined,
		tagId: (filterValues.tagId?.include?.length || filterValues.tagId?.exclude?.length) ? filterValues.tagId : undefined,
		locationId: (filterValues.locationId?.include?.length || filterValues.locationId?.exclude?.length) ? filterValues.locationId : undefined,
		sortField,
		sortOrder,
		excludePast,
		excludeSeries: excludeSeries || undefined,
		onlySeries: onlySeries || undefined,
	});

	async function handleDelete(event: any, isSeriesMaster: boolean) {
		try {
			if (isSeriesMaster) {
				if (!window.confirm(m.delete_series_confirm())) return;
				await deleteEvents({ ids: [event.id], deleteSeries: true });
			} else {
				if (
					!window.confirm(m.delete_confirm({ item: m.event_label() }))
				)
					return;
				await deleteEvents({ ids: [event.id] });
			}
			toast.success(m.delete_successful());
			await listEvents(filterState).refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}

	function groupEvents(rawEvents: any[]) {
		return rawEvents
			.filter((e: any) => !e.recurringEventId)
			.map((master: any) => {
				const existingInstances = master.instances || [];
				const rawChildInstances = rawEvents
					.filter((e: any) => e.recurringEventId === master.id);
				const combined = [...existingInstances];
				const existingIds = new SvelteSet(combined.map((i: any) => i.id));
				for (const child of rawChildInstances) {
					if (!existingIds.has(child.id)) {
						combined.push(child);
						existingIds.add(child.id);
					}
				}
				combined.sort((a: any, b: any) => {
					const dateA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
					const dateB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
					return dateA - dateB;
				});
				return { ...master, instances: combined };
			});
	}

	function unrollEvents(rawEvents: any[], isExcludePast: boolean) {
		const grouped = groupEvents(rawEvents);
		const unrolled: any[] = [];
		const now = new SvelteDate();
		now.setHours(0, 0, 0, 0);

		for (const master of grouped) {
			const hasInstances = master.instances && master.instances.length > 0;
			if (!hasInstances) {
				unrolled.push(master);
			} else {
				for (const inst of master.instances) {
					if (isExcludePast) {
						const iStart = inst.startDateTime ? new Date(inst.startDateTime) : null;
						const iEnd = inst.endDateTime ? new Date(inst.endDateTime) : null;
						const isFuture = (iStart ? iStart >= now : false) || (iEnd ? iEnd >= now : false);
						if (!isFuture) continue;
					}
					unrolled.push({
						...master,
						...inst,
						id: inst.id,
						summary: inst.summary || master.summary,
						startDateTime: inst.startDateTime,
						endDateTime: inst.endDateTime,
						status: inst.status || master.status,
						isSeriesInstance: true,
						isSeriesMaster: false,
						recurringEventId: master.id,
						seriesMaster: master,
						instances: master.instances,
						locations: master.locations,
						resources: master.resources,
						rooms: master.rooms,
						tags: master.tags,
						user: master.user,
						updatedAt: master.updatedAt,
						createdAt: master.createdAt,
					});
				}
			}
		}

		unrolled.sort((a: any, b: any) => {
			if (sortField === "startDateTime") {
				const timeA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
				const timeB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
				return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
			} else if (sortField === "createdAt") {
				const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
			} else {
				const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
				const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
				return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
			}
		});

		return unrolled;
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="events" />

		<!-- Header -->
		<div
			class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800"
		>
			<div>
				<h1
					class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight"
				>
					{m.feature_events_title()}
				</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					{m.feature_events_description()}
				</p>
			</div>
			<Button href="/events/new" class="w-full md:w-auto shadow-sm">
				<Plus class="w-4 h-4 mr-2" />
				{m.new_item({ item: m.event_label() })}
			</Button>
		</div>

		<!-- Series Migration Banner -->
		{#await checkSeriesMigrationStatus() then migStatus}
			{#if migStatus?.hasLegacyData}
				<div
					class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl shadow-sm mb-6"
				>
					<div class="flex items-center gap-3">
						<div class="p-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-xl shrink-0">
							<RefreshCw size={20} />
						</div>
						<div>
							<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
								Upgrade Event Series Architecture
							</h3>
							<p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
								{migStatus.totalItems} legacy record(s) detected. Migrate to the high-performance calendar engine to eliminate redundant instances and optimize sync.
							</p>
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						class="bg-white dark:bg-gray-800 shadow-sm gap-2 shrink-0 self-end sm:self-center font-medium"
						onclick={() => (showMigrationDialog = true)}
					>
						<RefreshCw size={14} />
						Migrate Series
					</Button>

					{#if showMigrationDialog}
						<SeriesMigrationDialog
							bind:open={showMigrationDialog}
							statusData={migStatus}
							oncomplete={() => {
								checkSeriesMigrationStatus().refresh();
								listEvents(filterState).refresh();
							}}
							onclose={() => (showMigrationDialog = false)}
						/>
					{/if}
				</div>
			{/if}
		{/await}

		<!-- Action Bar -->
		<div class="flex flex-col md:flex-row gap-3 mb-6">
			<div class="relative flex-1">
				<Search
					size={16}
					class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
				/>
				<input
					type="text"
					placeholder={m.search_events()}
					value={searchInput}
					oninput={handleSearchInput}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<FilterMenu
					groups={filterGroups}
					booleanFilters={booleanFilters}
					radioGroups={radioGroups}
					bind:filters={filterValues}
					buttonLabel={m.filters()}
					onchange={() => (page = 1)}
				/>

				<div
					class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1"
				>
					<select
						value={sortField}
						onchange={(e) => handleSortFieldChange(e.currentTarget.value as any)}
						class="text-sm bg-transparent border-none focus:ring-0 py-2 pl-2 pr-6 cursor-pointer text-gray-700 dark:text-gray-300"
					>
						<option value="updatedAt">{m.sort_last_updated()}</option>
						<option value="startDateTime">{m.start_date()}</option>
						<option value="createdAt">{m.sort_created_date()}</option>
					</select>
					<button
						class="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
						onclick={() =>
							(sortOrder = sortOrder === "desc" ? "asc" : "desc")}
						title={sortOrder === "desc"
							? m.descending()
							: m.ascending()}
					>
						<ChevronDown
							size={14}
							class="transition-transform duration-200 {sortOrder ===
							'asc'
								? 'rotate-180'
								: ''}"
						/>
					</button>
				</div>
			</div>
		</div>

		<!-- Active Filter Chips -->
		<ActiveFilterChips
			groups={filterGroups}
			filters={filterValues}
			booleanFilters={booleanFilters}
			activeFiltersLabel={m.active_filters()}
			clearAllLabel={m.clear_all_filters()}
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
				for (const g of filterGroups) {
					reset[g.id] = { include: [], exclude: [] };
				}
				filterValues = reset;
				excludePast = false;
				excludeSeries = false;
				onlySeries = false;
				searchInput = "";
				searchQuery = "";
				page = 1;
			}}
		/>

		{#if isInitialized}
			<svelte:boundary>
				{@const eventsRes = await listEvents(filterState)}
				{@const displayedEvents = displayMode === "unrolled" ? unrollEvents(eventsRes?.data || [], excludePast) : groupEvents(eventsRes?.data || [])}
				{#if $effect.pending()}
					<div class="grid grid-cols-1 gap-5">
						<div class="p-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
							<RefreshCw class="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
						</div>
					</div>
				{/if}
				<div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
					<div class="grid grid-cols-1 gap-5">
				{#each displayedEvents as event (event.id)}
					{@const upcomingInst = getUpcomingInstance(event)}
					{@const displayDateEvent = (upcomingInst && !event.isSeriesInstance) ? {
						...event,
						startDateTime: upcomingInst.startDateTime,
						endDateTime: upcomingInst.endDateTime,
					} : event}
					<div
						class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-md transition-shadow {event.isSeriesInstance ? 'border-l-4 border-l-indigo-500 pl-4 sm:pl-5' : ''}"
					>
						<div class="flex-1 mb-5">
							<a
								href="/events/{event.id}/view"
								class="block group mb-2"
							>
								<div
									class="flex items-start justify-between gap-4"
								>
									<div
										class="flex items-center gap-2.5 flex-wrap min-w-0"
									>
										<h3
											class="text-lg font-bold group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug line-clamp-2 transition-colors {event.status === 'cancelled'
												? 'line-through text-gray-500 dark:text-gray-400'
												: 'text-gray-900 dark:text-gray-100'}"
										>
											{event.summary || m.untitled_event()}
										</h3>
										{#if isMultiDayEvent(displayDateEvent)}
											{@const durationDays = getEventDurationDays(displayDateEvent)}
											<span
												class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 shrink-0 shadow-2xs"
												title={m.multi_day_event()}
											>
												<CalendarDays class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
												<span>{m.multi_day_badge()} ({durationDays} {m.days_count({ count: durationDays })})</span>
											</span>
										{/if}
										{#if event.isSeriesInstance}
											<span
												class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 shrink-0"
											>
												<Calendar class="w-3 h-3 text-indigo-500 shrink-0" />
												<span>{m.series_occurrence()}</span>
											</span>
										{/if}
										{#if event.status}
											<span
												data-testid="event-status-{event.id}"
												class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 transition-all {getStatusBadgeClass(
													event.status,
												)}"
											>
												<span
													class="w-1.5 h-1.5 rounded-full {getStatusDotClass(
														event.status,
													)}"
												></span>
												{formatEventStatus(event.status)}
											</span>
										{/if}
									</div>
									{#if event.tags && event.tags.length > 0}
										<div
											class="flex flex-wrap gap-1 mt-1 shrink-0 justify-end max-w-[50%]"
										>
											{#each event.tags as t (t.id || t.tag?.id || t.tagName || t.name)}
												{@const tagObj = t.tag || t}
												{#if tagObj && tagObj.name}
													<span
														class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
													>
														{tagObj.name}
													</span>
												{/if}
											{/each}
										</div>
									{/if}
								</div>
							</a>

							<div
								class="flex items-center text-sm {isMultiDayEvent(displayDateEvent) ? 'text-purple-900 dark:text-purple-200 font-semibold bg-purple-50/70 dark:bg-purple-950/30 px-3 py-1.5 rounded-lg border border-purple-100 dark:border-purple-900/40 w-fit my-1' : 'text-gray-500 dark:text-gray-400'}"
							>
								{#if isMultiDayEvent(displayDateEvent)}
									<CalendarDays
										class="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400 shrink-0"
									/>
								{:else}
									<Clock
										class="w-4 h-4 mr-2 text-primary-500 shrink-0"
									/>
								{/if}
								<span class="truncate font-medium">
									{formatFriendlyEventTime(displayDateEvent, {
										all_day: m.all_day(),
										on: m.on(),
										to: m.to(),
										until: m.until(),
										days_count: (c) => m.days_count({ count: c }),
										loading: m.loading(),
									})}
								</span>
								{#if upcomingInst && !event.isSeriesInstance}
									<span
										class="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 shrink-0"
										title={m.series_occurrence()}
									>
										<Calendar class="w-3 h-3 text-blue-500 shrink-0" />
										{m.next ? m.next() : "Next"}
									</span>
								{/if}
							</div>
							{#if event.locations && event.locations.length > 0}
								<div
									class="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2"
								>
									<MapPin
										class="w-4 h-4 mr-2 text-primary-500 shrink-0"
									/>
									<span class="truncate">
										{#each event.locations as l, i (l.id || l.location?.id || i)}
											{@const locObj = l.location || l}
											{#if locObj && locObj.name}
												<a
													href="/locations/{locObj.id}"
													class="hover:underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
													>{locObj.name}</a
												>{i <
												event.locations.length - 1
													? ", "
													: ""}
											{/if}
										{/each}
									</span>
								</div>
							{/if}

							{#if getEventRooms(event).length > 0}
								<div class="flex flex-wrap items-center gap-1.5 mt-2">
									{#each getEventRooms(event) as roomName (roomName)}
										<span
											class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50"
										>
											<span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
											{roomName}
										</span>
									{/each}
								</div>
							{/if}

							{#if isSeriesEvent(event)}
								<div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
									<div class="flex items-center text-xs text-gray-500 dark:text-gray-400 min-w-0">
										<RefreshCw class="w-3.5 h-3.5 mr-1.5 text-indigo-500 shrink-0" />
										<span class="truncate">
											{event.isSeriesInstance
												? m.part_of_series({ title: event.seriesMaster?.summary || event.summary || '' })
												: (event.recurrence && event.recurrence.length > 0
													? formatRecurrenceText(event.recurrence)
													: m.series_mode_label())}
										</span>
									</div>
									<SeriesModeSelector
										event={event}
										variant="inline"
										ondelete={(inst: any) => handleDelete(inst, false)}
									/>
								</div>
							{/if}
						</div>

						<div
							class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 w-full sm:w-auto flex-wrap"
						>
							{#if isSeriesEvent(event)}
								{@const isInstance = Boolean(event.isSeriesInstance)}
								{@const masterId = event.seriesMaster?.id || event.recurringEventId || event.id}
								{@const defaultHref = isInstance ? `/events/${event.id}` : `/events/${masterId}`}
								{@const defaultLabel = isInstance ? m.edit_instance() : m.edit_series()}
								{@const otherHref = isInstance ? `/events/${masterId}` : `/events/${upcomingInst?.id || masterId}`}
								{@const otherLabel = isInstance ? m.edit_series() : m.edit_instance()}
								{@const allInstances = event.instances || event.seriesMaster?.instances || []}

								<div class="flex-1 sm:flex-none inline-flex rounded-md shadow-2xs isolate">
									<Button
										variant="outline"
										size="sm"
										href={defaultHref}
										class="flex-1 sm:flex-none rounded-r-none border-r-0 focus:z-10 flex items-center justify-center h-9 px-3 text-xs sm:text-sm font-medium"
									>
										<Pencil class="w-3.5 h-3.5 mr-1.5" />
										<span>{defaultLabel}</span>
									</Button>
									<DropdownMenu.Root>
										<DropdownMenu.Trigger>
											<Button
												variant="outline"
												size="sm"
												class="rounded-l-none px-2 focus:z-10 h-9 border-l border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
												aria-label={m.switch_series_or_instance ? m.switch_series_or_instance() : "Options"}
											>
												<ChevronDown size={14} class="opacity-70" />
											</Button>
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end" class="w-64 sm:w-72 p-1.5 z-50">
											<DropdownMenu.Item
												onclick={() => goto(otherHref)}
												class="flex items-center gap-2.5 p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
											>
												{#if isInstance}
													<RefreshCw size={15} class="text-blue-600 dark:text-blue-400 shrink-0" />
													<div class="min-w-0">
														<div class="text-xs font-medium">{otherLabel}</div>
														{#if event.seriesMaster?.summary}
															<div class="text-[11px] text-gray-500 truncate">{event.seriesMaster.summary}</div>
														{/if}
													</div>
												{:else}
													<Calendar size={15} class="text-amber-600 dark:text-amber-400 shrink-0" />
													<div class="min-w-0">
														<div class="text-xs font-medium">{otherLabel}</div>
														{#if upcomingInst?.startDateTime}
															<div class="text-[11px] text-gray-500 truncate">{formatDate(upcomingInst.startDateTime)} {formatTime(upcomingInst.startDateTime)}</div>
														{/if}
													</div>
												{/if}
											</DropdownMenu.Item>

											{#if allInstances.length > 0}
												<DropdownMenu.Separator class="my-1" />
												<DropdownMenu.Group>
													<DropdownMenu.GroupHeading class="text-[10px] font-semibold text-gray-500 px-2 py-1 uppercase tracking-wider">
														{m.all_instances_count({ count: allInstances.length })}
													</DropdownMenu.GroupHeading>
													<div class="max-h-48 overflow-y-auto space-y-0.5 pr-1">
														{#each allInstances as inst (inst.id)}
															{@const isSelected = isInstance ? inst.id === event.id : inst.id === upcomingInst?.id}
															<DropdownMenu.Item
																onclick={() => goto(`/events/${inst.id}`)}
																class="flex items-center justify-between p-1.5 text-xs rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 {isSelected ? 'bg-amber-50 dark:bg-amber-950/30 font-medium' : ''}"
															>
																<div class="flex items-center gap-2 truncate min-w-0">
																	<Calendar size={13} class="text-gray-400 shrink-0" />
																	<span class="truncate">{formatDate(inst.startDateTime)} {formatTime(inst.startDateTime)}</span>
																</div>
																{#if isSelected}
																	<span class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-medium shrink-0 ml-1">
																		{isInstance ? (m.series_occurrence ? m.series_occurrence() : "Current") : (m.next ? m.next() : "Next")}
																	</span>
																{/if}
															</DropdownMenu.Item>
														{/each}
													</div>
												</DropdownMenu.Group>
											{/if}
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</div>
							{:else}
								<Button
									variant="outline"
									size="sm"
									href="/events/{event.id}"
									class="flex-1 sm:flex-none h-9 px-3"
								>
									<Pencil class="w-4 h-4 mr-2" />
									{m.edit()}
								</Button>
							{/if}
							<button
								class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500"
								onclick={() => handleDelete(event, !event.isSeriesInstance && isSeriesEvent(event))}
							>
								<Trash2 class="w-4 h-4 mr-2" />
								{m.delete()}
							</button>
						</div>
						<div
							class="text-[11px] text-gray-400 dark:text-gray-500 text-right px-1 mt-2"
						>
							{m.updated_on({
								date: new Date(
									event.updatedAt,
								).toLocaleString([], {
									year: "numeric",
									month: "2-digit",
									day: "2-digit",
									hour: "2-digit",
									minute: "2-digit",
								}),
							})}
							{#if event.user}
								| <a
									href="/users/{event.user.id}"
									class="hover:underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
									>{event.user.name ||
										event.user.email ||
										"User"}</a
								>
							{/if}
						</div>
					</div>
				{:else}
					<div
						class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
					>
						<CalendarDays
							class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3"
						/>
						<h3
							class="text-lg font-medium text-gray-900 dark:text-gray-100"
						>
							No events found
						</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
							Try adjusting your search or filters.
						</p>
					</div>
				{/each}
				</div>

				<!-- Pagination -->
				{#if eventsRes && eventsRes.total > limit}
					{@const totalPages = Math.ceil(eventsRes.total / limit)}
					<div
						class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800"
					>
						<div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
							<span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, eventsRes.total)} of {eventsRes.total}</span>
						<div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
							<select
								bind:value={limit}
								onchange={() => (page = 1)}
								class="text-xs bg-transparent border-gray-200 dark:border-gray-700 rounded-md py-1 pl-2 pr-6 text-gray-500 cursor-pointer focus:ring-0"
							>
								<option value={10}>{m.items_per_page({ count: 10 })}</option>
								<option value={20}>{m.items_per_page({ count: 20 })}</option>
								<option value={50}>{m.items_per_page({ count: 50 })}</option>
								<option value={100}>{m.items_per_page({ count: 100 })}</option>
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
							title="First page"
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
							Previous
						</Button>
						<div
							class="flex items-center gap-1 px-1 sm:px-2 font-medium text-sm text-gray-700 dark:text-gray-300"
						>
							<select
								bind:value={page}
								class="text-sm bg-transparent border-none font-medium p-0 focus:ring-0 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 min-w-[2.5rem]"
							>
								{#each Array(totalPages) as _, i (i)}
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
							Next
							<ArrowRight size={16} class="ml-1.5 hidden sm:block" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							disabled={page === totalPages}
							onclick={() => page = totalPages}
							class="h-9 w-9 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
							title="Last page"
						>
							<ChevronsRight size={16} />
						</Button>
					</div>
				</div>
				{/if}
				</div>
				{#snippet failed(err: unknown, reset: () => void)}
					<div class="p-8 text-center bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-900">
						<p class="text-sm text-red-500">{err instanceof Error ? err.message : m.something_went_wrong()}</p>
					</div>
				{/snippet}
			</svelte:boundary>
		{:else}
			<div class="grid grid-cols-1 gap-5">
				<div class="p-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
					<RefreshCw class="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
				</div>
			</div>
		{/if}
	</div>
</div>
