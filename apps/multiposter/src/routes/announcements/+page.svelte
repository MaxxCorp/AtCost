<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { listAnnouncements } from "./list.remote";
	import { listLocations } from "../locations/list.remote";
	import { deleteAnnouncements } from "./[id]/delete.remote";

	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import { Button } from "@ac/ui/components/button";
	import { LoadingSection, ErrorSection, EmptyState } from "@ac/ui";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import {
		Megaphone,
		Pencil,
		Trash2,
		Eye,
		Calendar,
		Earth,
		Plus,
		Search,
		Filter as FilterIcon,
		ChevronDown,
		ChevronRight,
		ArrowLeft,
		ArrowRight,
		ChevronsLeft,
		ChevronsRight,
		X
	} from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { getPreference, setPreference } from "$lib/utils/idb";

	let sortField = $state<"updatedAt" | "createdAt" | "title">("updatedAt");
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let page = $state(1);
	let limit = $state(50);
	let selectedLocationId = $state<string | null>(null);

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("announcementsFilters", null);
			if (savedPrefs) {
				const prefs = JSON.parse(savedPrefs as string);
				if (prefs.sortField) sortField = prefs.sortField;
				if (prefs.sortOrder) sortOrder = prefs.sortOrder;
				if (prefs.locationId) selectedLocationId = prefs.locationId;
			}
		} catch (e) {
			console.error("Failed to load preferences", e);
		}
	});

	$effect(() => {
		const prefsToSave = {
			sortField,
			sortOrder,
			locationId: selectedLocationId,
		};
		setPreference("announcementsFilters", JSON.stringify(prefsToSave)).catch(console.error);
	});

	const filterState = $derived({
		page,
		limit,
		search: searchQuery,
		locationId: selectedLocationId || undefined,
		sortField,
		sortOrder,
	});

	const activeFiltersCount = $derived(selectedLocationId ? 1 : 0);

	const allLocationsQuery = listLocations({ limit: 1000, sortField: 'name', sortOrder: 'asc' });

	async function handleDelete(announcement: any) {
		if (!window.confirm(m.delete_confirm({ item: "Announcement" }))) return;
		try {
			await deleteAnnouncements([announcement.id]);
			toast.success(m.delete_successful());
			listAnnouncements(filterState).refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}

</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="announcements" />

		<!-- Header -->
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
			<div>
				<h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
					{m.announcements()}
				</h1>
			</div>
			<Button href="/announcements/new" class="w-full md:w-auto shadow-sm">
				<Plus class="w-4 h-4 mr-2" />
				{m.new_item({ item: "Announcement" })}
			</Button>
		</div>

		<!-- Action Bar -->
		<div class="flex flex-col md:flex-row gap-3 mb-6">
			<div class="relative flex-1">
				<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					placeholder={m.search_announcements()}
					bind:value={searchQuery}
					oninput={() => (page = 1)}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button variant="outline" class="relative border-gray-200 rounded-xl hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
							<FilterIcon size={16} class="mr-2" />
							Filters
							{#if activeFiltersCount > 0}
								<span class="absolute -top-2 -right-2 bg-primary-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm">
									{activeFiltersCount}
								</span>
							{/if}
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-64 p-2 rounded-xl">
						<div class="px-2 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
							Location
						</div>
						<div class="max-h-48 overflow-y-auto p-1 space-y-0.5">
							<button
								class="w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors {selectedLocationId === null ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}"
								onclick={() => { selectedLocationId = null; page = 1; }}
							>
								All Locations
							</button>
							{#await allLocationsQuery then locations}
								{#each locations.data as loc}
									<button
										class="w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors {selectedLocationId === loc.id ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}"
										onclick={() => { selectedLocationId = loc.id; page = 1; }}
									>
										{loc.name}
									</button>
								{/each}
							{/await}
						</div>
						
						{#if activeFiltersCount > 0}
							<div class="p-1 mt-2 border-t border-gray-100 dark:border-gray-800">
								<button
									class="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
									onclick={() => { selectedLocationId = null; page = 1; }}
								>
									<X size={14} /> Clear all
								</button>
							</div>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				<div class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1">
					<select
						bind:value={sortField}
						class="text-sm bg-transparent border-none focus:ring-0 py-2 pl-2 pr-6 cursor-pointer text-gray-700 dark:text-gray-300"
					>
						<option value="updatedAt">{m.sort_last_updated()}</option>
						<option value="createdAt">{m.sort_created_date()}</option>
						<option value="title">Title</option>
					</select>
					<button
						class="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
						onclick={() => (sortOrder = sortOrder === "desc" ? "asc" : "desc")}
						title={sortOrder === "desc" ? m.descending() : m.ascending()}
					>
						<ChevronDown size={14} class="transition-transform duration-200 {sortOrder === 'asc' ? 'rotate-180' : ''}" />
					</button>
				</div>
			</div>
		</div>

		<!-- List -->
		<div class="relative min-h-[200px]">
			<svelte:boundary>
				{#if $effect.pending()}
					<div class="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-[1px] rounded-xl">
						<LoadingSection />
					</div>
				{/if}

				<div class={["transition-opacity duration-200", $effect.pending() && "opacity-50 pointer-events-none"]}>
					<div class="grid grid-cols-1 gap-5">
						{#each (await listAnnouncements(filterState)).data || [] as announcement (announcement.id)}
						<div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-md transition-shadow">
							<div class="flex-1 mb-5">
								<div class="flex items-start gap-4">
									<div class="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
										<Megaphone size={24} />
									</div>
									<div class="flex-1 min-w-0">
										<a href={`/announcements/${announcement.id}/view`} class="block group mb-2">
											<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 leading-snug truncate transition-colors">
												{announcement.title}
											</h3>
										</a>
										
										<div class="flex flex-col gap-1 mt-1">
											{#if announcement.isPublic}
												<div class="flex items-center gap-2">
													<Earth size={14} class="text-green-500" />
													<span class="text-xs text-green-600 font-medium">{m.public()}</span>
												</div>
											{:else}
												<div class="flex items-center gap-2">
													<span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{m.draft()}</span>
												</div>
											{/if}
										</div>
									</div>
								</div>
							</div>

							<div class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 w-full sm:w-auto">
								<Button variant="outline" size="sm" href={`/announcements/${announcement.id}/view`} class="flex-1 sm:flex-none">
									<Eye class="w-4 h-4 mr-2" />
									{m.view()}
								</Button>
								<Button variant="outline" size="sm" href={`/announcements/${announcement.id}`} class="flex-1 sm:flex-none">
									<Pencil class="w-4 h-4 mr-2" />
									{m.edit()}
								</Button>
								<button
									class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500"
									onclick={() => handleDelete(announcement)}
								>
									<Trash2 class="w-4 h-4 mr-2" />
									{m.delete()}
								</button>
							</div>
							<div class="text-[11px] text-gray-400 dark:text-gray-500 text-right px-1 mt-2">
								{m.updated_on({
									date: new Date(announcement.updatedAt).toLocaleString([], {
										year: "numeric",
										month: "2-digit",
										day: "2-digit",
										hour: "2-digit",
										minute: "2-digit",
									}),
								})}
								{#if announcement.user}
									| <a
										href="/users/{announcement.user.id}"
										class="hover:underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
									>{announcement.user.name || announcement.user.email || "User"}</a>
								{/if}
							</div>
						</div>
						{:else}
							<div class="col-span-full">
								<EmptyState 
									icon={Megaphone}
									title="No announcements found"
									description="Get started by creating a new announcement"
									actionLabel="Create Announcement"
									actionHref="/announcements/new"
								/>
							</div>
						{/each}
					</div>

					<!-- Pagination -->
					{#if ((await listAnnouncements(filterState)).total || 0) > limit}
						{@const totalCount = ((await listAnnouncements(filterState)).total || 0)}
						{@const totalPages = Math.ceil(totalCount / limit)}
						<div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
							<div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
								<span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount}</span>
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

				{#snippet pending()}
					<LoadingSection />
				{/snippet}

				{#snippet failed(error, reset)}
					<ErrorSection {error} onRetry={reset} />
				{/snippet}
			</svelte:boundary>
		</div>
	</div>
</div>
