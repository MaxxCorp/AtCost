<script lang="ts">
	import { listKiosks } from "./list.remote";
	import { listLocations } from "../locations/list.remote";
	import { deleteKiosk } from "./[id]/delete.remote";
	import * as m from "$lib/paraglide/messages.js";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import {
		Pencil,
		Trash2,
		Plus,
		MapPin,
		Monitor,
		ChevronDown,
		Filter as FilterIcon,
		Search,
		ArrowLeft,
		ArrowRight,
		X,
		Clock,
	} from "@lucide/svelte";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { getPreference, setPreference } from "$lib/utils/idb";

	// Filter state
	let sortField = $state<"updatedAt" | "createdAt" | "name">("updatedAt");
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let selectedLocations = $state<string[]>([]);
	let page = $state(1);
	let limit = $state(50);

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("kiosksFilters", null);
			if (savedPrefs) {
				const prefs = JSON.parse(savedPrefs as string);
				if (prefs.sortField) sortField = prefs.sortField;
				if (prefs.sortOrder) sortOrder = prefs.sortOrder;
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
			selectedLocations,
		};
		setPreference("kiosksFilters", JSON.stringify(prefsToSave)).catch(
			console.error,
		);
	});

	const filterState = $derived({
		page,
		limit,
		search: searchQuery,
		locationId:
			selectedLocations.length > 0 ? selectedLocations : undefined,
		sortField,
		sortOrder,
	});

	const locationsQuery = listLocations({ limit: 100 });

	const locations = $derived(locationsQuery.current?.data || []);

	async function handleDelete(kiosk: any) {
		try {
			if (!window.confirm(m.delete_confirm({ item: m.kiosks() }))) return;
			await deleteKiosk([kiosk.id]);
			toast.success(m.delete_successful());
			listKiosks(filterState).refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}

	function toggleLocation(id: string) {
		if (selectedLocations.includes(id)) {
			selectedLocations = selectedLocations.filter((l) => l !== id);
		} else {
			selectedLocations = [...selectedLocations, id];
		}
		page = 1;
	}
	let query = $derived(listKiosks(filterState));
	let res = $derived(query.current);
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="kiosks" />

		<!-- Header -->
		<div
			class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800"
		>
			<div>
				<h1
					class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight"
				>
					{m.kiosks()}
				</h1>
			</div>
			<Button href="/kiosks/new" class="w-full md:w-auto shadow-sm">
				<Plus class="w-4 h-4 mr-2" />
				{m.create_item({ item: "Kiosk" })}
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
					placeholder="Search kiosks..."
					bind:value={searchQuery}
					oninput={() => (page = 1)}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				{#if locations.length > 0}
					{@const activeFiltersCount = selectedLocations.length}
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

							{#if activeFiltersCount > 0}
								<DropdownMenu.Separator class="bg-gray-50" />
								<DropdownMenu.Item
									class="text-red-600 font-medium py-2 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-700"
									onclick={() => {
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
						<option value="createdAt">Created Date</option>
						<option value="name">Name</option>
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

		<!-- List -->
		<div class="grid grid-cols-1 gap-5">

			{#if query.loading && !query.current}
				<div class="col-span-full py-12 text-center text-gray-500">Loading...</div>
			{:else if query.error}
				<div class="col-span-full py-12 text-center text-red-500">{query.error.message}</div>
			{:else}
				{#each query.current?.data || [] as kiosk (kiosk.id)}
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-md transition-shadow"
				>
					<div class="flex-1 mb-5">
						<a
							href="/kiosks/{kiosk.id}/view"
							target="_blank"
							class="block group mb-2"
						>
							<div
								class="flex items-start justify-between gap-4"
							>
								<h3
									class="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug line-clamp-2 transition-colors flex items-center gap-2"
								>
									<Monitor class="w-5 h-5 text-gray-400" />
									{kiosk.name}
								</h3>
							</div>
						</a>

						{#if kiosk.description}
							<p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
								{kiosk.description}
							</p>
						{/if}

						{#if kiosk.locations && kiosk.locations.length > 0}
							<div
								class="flex items-center flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400 mt-2 mb-3"
							>
								{#each kiosk.locations as l, i (l.id || i)}
									<div class="flex items-center bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-700">
										<MapPin
											class="w-3.5 h-3.5 mr-1.5 text-primary-500 shrink-0"
										/>
										<span class="truncate font-medium">{l.name}</span>
									</div>
								{/each}
							</div>
						{/if}

						<div class="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm bg-gray-50/50 dark:bg-gray-800/30 p-3 rounded-lg border border-gray-100/50 dark:border-gray-700/50">
							<div class="flex items-center">
								<Clock class="w-3.5 h-3.5 mr-1.5 text-gray-400" />
								<span class="text-gray-500 dark:text-gray-400 mr-1.5">{m.loop_label()}:</span>
								<span class="font-medium text-gray-900 dark:text-gray-200">{kiosk.loopDuration}s</span>
							</div>
							<div class="flex items-center">
								<span class="text-gray-500 dark:text-gray-400 mr-1.5">{m.look_ahead_label()}:</span>
								<span class="font-medium text-gray-900 dark:text-gray-200">{m.days_count({ count: Math.round(kiosk.lookAhead / 86400) })}</span>
							</div>
							<div class="flex items-center">
								<span class="text-gray-500 dark:text-gray-400 mr-1.5">{m.look_past_label()}:</span>
								<span class="font-medium text-gray-900 dark:text-gray-200">{m.days_count({ count: Math.round(kiosk.lookPast / 86400) })}</span>
							</div>
						</div>
					</div>

					<div
						class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 w-full sm:w-auto"
					>
						<Button
							variant="outline"
							size="sm"
							href="/kiosks/{kiosk.id}"
							class="flex-1 sm:flex-none"
						>
							<Pencil class="w-4 h-4 mr-2" />
							{m.edit()}
						</Button>
						<button
							class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500"
							onclick={() => handleDelete(kiosk)}
						>
							<Trash2 class="w-4 h-4 mr-2" />
							{m.delete()}
						</button>
					</div>
					
					<div class="text-[11px] text-gray-400 dark:text-gray-500 text-right px-1 mt-2">
						{m.updated_on({
							date: new Date(kiosk.updatedAt).toLocaleString([], {
								year: "numeric",
								month: "2-digit",
								day: "2-digit",
								hour: "2-digit",
								minute: "2-digit",
							}),
						})}
						{#if kiosk.user}
							| <a
								href="/users/{kiosk.user.id}"
								class="hover:underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
								>{kiosk.user.name ||
									kiosk.user.email ||
									"User"}</a
							>
						{/if}
					</div>
				</div>
			{:else}
				<div class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
					<Monitor class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
					<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">{m.no_kiosks()}</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Try adjusting your search or filters.</p>
				</div>
				{/each}
			{/if}
		</div>

		<!-- Pagination -->

		{#if query.current && query.current.total > limit}
				{@const totalPages = Math.ceil(query.current.total / limit)}
				<div
					class="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800"
				>
					<div class="text-sm text-gray-500 dark:text-gray-400">
						Showing {(page - 1) * limit + 1} to {Math.min(
							page * limit,
							query.current.total,
						)} of {query.current.total}
					</div>
					<div class="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={page === 1}
							onclick={() => page > 1 && page--}
							class="h-9 px-3 border-gray-200 dark:border-gray-700"
						>
							<ArrowLeft size={16} class="mr-1.5" />
							Previous
						</Button>
						<div
							class="flex items-center gap-1 px-2 font-medium text-sm text-gray-700 dark:text-gray-300"
						>
							{page} / {totalPages}
						</div>
						<Button
							variant="outline"
							size="sm"
							disabled={page === totalPages}
							onclick={() => page < totalPages && page++}
							class="h-9 px-3 border-gray-200 dark:border-gray-700"
						>
							Next
							<ArrowRight size={16} class="ml-1.5" />
						</Button>
					</div>
				</div>
			{/if}
	</div>
</div>


