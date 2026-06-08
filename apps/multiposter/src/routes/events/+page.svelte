<script lang="ts">
	import { listEvents } from "./list.remote";
	import { listTags } from "../tags/list.remote";
	import { listLocations } from "../locations/list.remote";
	import { deleteEvents } from "./delete.remote";
	import * as m from "$lib/paraglide/messages.js";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import {
		Pencil,
		Trash2,
		Plus,
		Clock,
		MapPin,
		ChevronDown,
		ChevronRight,
		CalendarDays,
		Filter as FilterIcon,
		Search,
		ArrowLeft,
		ArrowRight,
		ChevronsLeft,
		ChevronsRight,
		X,
		RefreshCw,
	} from "@lucide/svelte";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { getPreference, setPreference } from "$lib/utils/idb";
	import { formatRecurrenceText } from "$lib/utils/format-recurrence";

	// Simple date formatter function
	function formatEventTime(event: any): string {
		if (!event.startDateTime) return m.loading();
		const start = new Date(event.startDateTime);
		const startDateStr = start.toLocaleDateString();
		if (event.isAllDay) {
			if (event.endDateTime) {
				const endDateStr = new Date(
					event.endDateTime,
				).toLocaleDateString();
				if (startDateStr !== endDateStr)
					return `${m.all_day()}: ${startDateStr} - ${endDateStr}`;
			}
			return `${m.all_day()} ${m.on()} ${startDateStr}`;
		}
		const startTime = start.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
		if (event.endDateTime) {
			const end = new Date(event.endDateTime);
			const endTime = end.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
			return `${startDateStr}, ${startTime} - ${endTime}`;
		}
		return `${startDateStr}, ${startTime}`;
	}

	let expandedSeries = $state<Record<string, boolean>>({});

	// Filter state
	let sortField = $state<"updatedAt" | "startDateTime" | "createdAt">(
		"updatedAt",
	);
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let selectedTags = $state<string[]>([]);
	let selectedLocations = $state<string[]>([]);
	let page = $state(1);
	let limit = $state(50);

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("eventsFilters", null);
			if (savedPrefs) {
				const prefs = JSON.parse(savedPrefs as string);
				if (prefs.sortField) sortField = prefs.sortField;
				if (prefs.sortOrder) sortOrder = prefs.sortOrder;
				if (prefs.selectedTags) selectedTags = prefs.selectedTags;
				if (prefs.selectedLocations)
					selectedLocations = prefs.selectedLocations;
			}
		} catch (e) {
			console.error("Failed to load preferences", e);
		}
	});

	$effect(() => {
		const prefsToSave = {
			sortField,
			sortOrder,
			selectedTags,
			selectedLocations,
		};
		setPreference("eventsFilters", JSON.stringify(prefsToSave)).catch(
			console.error,
		);
	});

	const filterState = $derived({
		page,
		limit,
		search: searchQuery,
		tagId: selectedTags.length > 0 ? selectedTags : undefined,
		locationId:
			selectedLocations.length > 0 ? selectedLocations : undefined,
		sortField,
		sortOrder,
	});

	const tagsQuery = listTags({ limit: 100 });
	const locationsQuery = listLocations({ limit: 100 });

	const tags = $derived(tagsQuery.current || []);
	const locations = $derived(locationsQuery.current?.data || []);

	function toggleSeries(id: string) {
		expandedSeries[id] = !expandedSeries[id];
	}

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
			listEvents(filterState).refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}

	function toggleTag(id: string) {
		if (selectedTags.includes(id)) {
			selectedTags = selectedTags.filter((t) => t !== id);
		} else {
			selectedTags = [...selectedTags, id];
		}
		page = 1;
	}

	function toggleLocation(id: string) {
		if (selectedLocations.includes(id)) {
			selectedLocations = selectedLocations.filter((l) => l !== id);
		} else {
			selectedLocations = [...selectedLocations, id];
		}
		page = 1;
	}

	function groupEvents(rawEvents: any[]) {
		return rawEvents
			.filter((e: any) => !e.recurringEventId)
			.map((master: any) => {
				const instances = rawEvents.filter(
					(e: any) => e.recurringEventId === master.id,
				);
				return { ...master, instances };
			});
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

		<!-- Action Bar -->
		<div class="flex flex-col md:flex-row gap-3 mb-6">
			<div class="relative flex-1">
				<Search
					size={16}
					class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
				/>
				<input
					type="text"
					placeholder="Search events..."
					bind:value={searchQuery}
					oninput={() => (page = 1)}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				{#if tags.length > 0 || locations.length > 0}
					{@const activeFiltersCount =
						selectedTags.length + selectedLocations.length}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button
								variant="outline"
								class="relative border-gray-200 rounded-xl hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
							>
								<FilterIcon size={16} class="mr-2" />
								Filters
								{#if activeFiltersCount > 0}
									<span
										class="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-sm"
									>
										{activeFiltersCount}
									</span>
								{/if}
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							align="end"
							class="min-w-[200px] rounded-2xl shadow-xl border-gray-100 p-1"
						>
							<DropdownMenu.Label
								class="text-xs font-bold uppercase tracking-wider text-gray-400 px-3 py-2"
								>System Filters</DropdownMenu.Label
							>
							<DropdownMenu.Separator class="bg-gray-50" />

							{#if tags.length > 0}
								<DropdownMenu.Sub>
									<DropdownMenu.SubTrigger
										class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg"
									>
										<span>Tags</span>
										{#if selectedTags.length > 0}
											<span
												class="ml-auto text-[10px] py-0.5 px-2 h-4 bg-primary-50 text-primary-700 rounded-full flex items-center justify-center font-bold"
												>{selectedTags.length}</span
											>
										{/if}
									</DropdownMenu.SubTrigger>
									<DropdownMenu.SubContent
										class="w-56 p-1 max-h-[300px] overflow-y-auto rounded-xl shadow-lg border-gray-100"
									>
										{#each tags as tag}
											<DropdownMenu.CheckboxItem
												checked={selectedTags.includes(
													tag.id,
												)}
												onCheckedChange={() =>
													toggleTag(tag.id)}
												class="rounded-lg py-2 px-3 text-sm cursor-pointer hover:bg-gray-50"
											>
												<span
													class="truncate block w-full"
													>{tag.name}</span
												>
											</DropdownMenu.CheckboxItem>
										{/each}
									</DropdownMenu.SubContent>
								</DropdownMenu.Sub>
							{/if}

							{#if locations.length > 0}
								<DropdownMenu.Sub>
									<DropdownMenu.SubTrigger
										class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg"
									>
										<span>Locations</span>
										{#if selectedLocations.length > 0}
											<span
												class="ml-auto text-[10px] py-0.5 px-2 h-4 bg-primary-50 text-primary-700 rounded-full flex items-center justify-center font-bold"
												>{selectedLocations.length}</span
											>
										{/if}
									</DropdownMenu.SubTrigger>
									<DropdownMenu.SubContent
										class="w-56 p-1 max-h-[300px] overflow-y-auto rounded-xl shadow-lg border-gray-100"
									>
										{#each locations as location}
											<DropdownMenu.CheckboxItem
												checked={selectedLocations.includes(
													location.id,
												)}
												onCheckedChange={() =>
													toggleLocation(location.id)}
												class="rounded-lg py-2 px-3 text-sm cursor-pointer hover:bg-gray-50"
											>
												<span
													class="truncate block w-full"
													>{location.name}</span
												>
											</DropdownMenu.CheckboxItem>
										{/each}
									</DropdownMenu.SubContent>
								</DropdownMenu.Sub>
							{/if}

							{#if activeFiltersCount > 0}
								<DropdownMenu.Separator class="bg-gray-50" />
								<DropdownMenu.Item
									class="text-red-600 font-medium py-2 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-700"
									onclick={() => {
										selectedTags = [];
										selectedLocations = [];
										page = 1;
									}}
								>
									<X size={14} class="mr-2" />
									Clear Filters
								</DropdownMenu.Item>
							{/if}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{/if}

				<div
					class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1"
				>
					<select
						bind:value={sortField}
						class="text-sm bg-transparent border-none focus:ring-0 py-2 pl-2 pr-6 cursor-pointer text-gray-700 dark:text-gray-300"
					>
						<option value="updatedAt">Last Updated</option>
						<option value="startDateTime">Start Date</option>
						<option value="createdAt">Created Date</option>
					</select>
					<button
						class="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
						onclick={() =>
							(sortOrder = sortOrder === "desc" ? "asc" : "desc")}
						title={sortOrder === "desc"
							? "Descending"
							: "Ascending"}
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

		<!-- List using exactly the requested reactive pattern -->
		<div class="grid grid-cols-1 gap-5">
			{#each groupEvents((await listEvents(filterState)).data || []) as event (event.id)}
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-md transition-shadow"
				>
					<div class="flex-1 mb-5">
						<a
							href="/events/{event.id}/view"
							class="block group mb-2"
						>
							<div
								class="flex items-start justify-between gap-4"
							>
								<h3
									class="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug line-clamp-2 transition-colors"
								>
									{event.summary || m.untitled_event()}
								</h3>
								{#if event.tags && event.tags.length > 0}
									<div
										class="flex flex-wrap gap-1 mt-1 shrink-0 justify-end max-w-[50%]"
									>
										{#each event.tags as t (t.tag?.id || t.tagName)}
											{#if t.tag}
												<span
													class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
												>
													{t.tag.name}
												</span>
											{/if}
										{/each}
									</div>
								{/if}
							</div>
						</a>

						<div
							class="flex items-center text-sm text-gray-500 dark:text-gray-400"
						>
							<Clock
								class="w-4 h-4 mr-2 text-primary-500 shrink-0"
							/>
							<span class="truncate font-medium"
								>{formatEventTime(event)}</span
							>
						</div>
						{#if event.locations && event.locations.length > 0}
							<div
								class="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2"
							>
								<MapPin
									class="w-4 h-4 mr-2 text-primary-500 shrink-0"
								/>
								<span class="truncate">
									{#each event.locations as l, i (l.location?.id || i)}
										{#if l.location}
											<a
												href="/locations/{l.location
													.id}"
												class="hover:underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
												>{l.location.name}</a
											>{i <
											event.locations.length - 1
												? ", "
												: ""}
										{/if}
									{/each}
								</span>
							</div>
						{/if}

						{#if event.recurrence && event.recurrence.length > 0}
							<div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2">
								<RefreshCw class="w-4 h-4 mr-2 text-primary-500 shrink-0" />
								<span class="truncate">{formatRecurrenceText(event.recurrence)}</span>
							</div>
						{/if}

						{#if event.instances && event.instances.length > 0}
							<div class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
								<button
									class="inline-flex items-center text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
									onclick={() => toggleSeries(event.id)}
								>
									<CalendarDays class="w-4 h-4 mr-2 text-primary-500" />
									{event.instances.length} {m.instances()}
									{#if expandedSeries[event.id]}
										<ChevronDown class="w-4 h-4 ml-1" />
									{:else}
										<ChevronRight class="w-4 h-4 ml-1" />
									{/if}
								</button>
							</div>

							<!-- Instances List -->
							{#if expandedSeries[event.id]}
								<div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 rounded-lg p-4 space-y-3">
									<h4
									class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
								>
									{m.instances()}
								</h4>
								{#each event.instances as instance (instance.id)}
									<div
										class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-gray-900 p-3 rounded-md border border-gray-200 dark:border-gray-700"
									>
										<div
											class="flex items-center text-sm text-gray-600 dark:text-gray-300"
										>
											<Clock
												class="w-3.5 h-3.5 mr-2 text-primary-400 shrink-0"
											/>
											<span
												>{formatEventTime(
													instance,
												)}</span
											>
										</div>
										<div
											class="flex gap-2 w-full sm:w-auto"
										>
											<Button
												variant="outline"
												size="sm"
												href="/events/{instance.id}"
												class="flex-1 sm:flex-none h-8 px-2 text-xs"
											>
												<Pencil
													class="w-3.5 h-3.5 mr-1"
												/>
												{m.edit()}
											</Button>
											<button
												class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-8 px-2 text-red-500"
												onclick={() =>
													handleDelete(
														instance,
														false,
													)}
											>
												<Trash2
													class="w-3.5 h-3.5 mr-1"
												/>
												{m.delete()}
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
						{/if}
					</div>

					<div
						class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 w-full sm:w-auto"
					>
						<Button
							variant="outline"
							size="sm"
							href="/events/{event.id}"
							class="flex-1 sm:flex-none"
						>
							<Pencil class="w-4 h-4 mr-2" />
							{m.edit()}
						</Button>
						<button
							class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500"
							onclick={() => handleDelete(event, event.instances && event.instances.length > 0)}
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
		{#await listEvents(filterState) then res}
			{#if res && res.total > limit}
				{@const totalPages = Math.ceil(res.total / limit)}
				<div
					class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800"
				>
					<div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
						<span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, res.total)} of {res.total}</span>
						<div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
							<select
								bind:value={limit}
								onchange={() => (page = 1)}
								class="text-xs bg-transparent border-gray-200 dark:border-gray-700 rounded-md py-1 pl-2 pr-6 text-gray-500 cursor-pointer focus:ring-0"
							>
								<option value={10}>10 per page</option>
								<option value={20}>20 per page</option>
								<option value={50}>50 per page</option>
								<option value={100}>100 per page</option>
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
		{/await}
	</div>
</div>
