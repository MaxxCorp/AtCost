<script lang="ts">
	import * as m from "#lib/paraglide/messages.js";
	import { listResources } from "./list.remote";
	import { deleteResource } from "./[id]/delete.remote";

	import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
	import Button from "#lib/components/ui/button/button.svelte";
	import { goto } from "$app/navigation";
	import { page as pageState } from "$app/state";
	import {
		FilterMenu,
		ActiveFilterChips,
		BulkActionToolbar,
		type FilterGroup,
		type FilterStateMap,
		initPageFromUrl,
		syncPageToUrl,
		recordActiveItem,
		activeItemAnchor,
		LoadingSection,
		ErrorSection,
	} from "@ac/ui";
	import {
		Box,
		Pencil,
		Trash2,
		Plus,
		Search,
		ChevronDown,
		ArrowLeft,
		ArrowRight,
		ChevronsLeft,
		ChevronsRight,
		Check,
		RefreshCw,
	} from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { getPreference, setPreference } from "#lib/utils/idb.js";
	import { getResourceFilterGroups } from "#lib/filters/index.js";

	let sortField = $state<"updatedAt" | "createdAt" | "name">("updatedAt");
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let filterValues = $state<FilterStateMap>({});
	let limit = $state(50);

	const page = $derived(initPageFromUrl(pageState.url));

	function setPage(newPage: number) {
		syncPageToUrl("resources", newPage, pageState.url, goto);
	}

	const filterGroups = $derived<FilterGroup[]>(getResourceFilterGroups(m));

	function savePrefs(sf: typeof sortField, so: typeof sortOrder, fv: FilterStateMap) {
		setPreference("resourcesFilters", JSON.stringify({ sortField: sf, sortOrder: so, filterValues: fv })).catch(console.error);
	}

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("resourcesFilters", null);
			if (savedPrefs) {
				const prefs = JSON.parse(savedPrefs as string);
				if (prefs.sortField) sortField = prefs.sortField;
				if (prefs.sortOrder) sortOrder = prefs.sortOrder;
				if (prefs.filterValues) filterValues = prefs.filterValues;
			}
		} catch (e) {
			console.error("Failed to load preferences", e);
		}
	});

	const filterState = $derived({
		page,
		limit,
		search: searchQuery || undefined,
		locationId: (filterValues.locationId?.include?.length || filterValues.locationId?.exclude?.length) ? filterValues.locationId : undefined,
		sortField,
		sortOrder,
	});

	let selectedIds = $state<string[]>([]);
	const resourcesQuery = $derived(listResources(filterState));
	const resourcesRes = $derived(resourcesQuery.current);
	const resourceItems = $derived(resourcesRes?.data ?? []);
	const total = $derived(resourcesRes?.total ?? 0);
	const totalPages = $derived(Math.ceil(total / limit));

	async function handleBulkDelete() {
		if (selectedIds.length === 0) return;
		const confirmMsg = m.delete_confirm?.({ item: `${selectedIds.length} ${m.resources?.() || 'resources'}` }) || `Delete ${selectedIds.length} resources?`;
		if (!window.confirm(confirmMsg)) return;
		try {
			await deleteResource(selectedIds);
			toast.success(m.delete_successful?.() || 'Deleted successfully');
			selectedIds = [];
			await resourcesQuery.refresh();
		} catch (e: any) {
			toast.error(e?.message || m.something_went_wrong?.() || 'Failed to delete');
		}
	}

	async function handleDelete(resource: any) {
		if (!window.confirm(m.delete_confirm({ item: "Resource" }))) return;
		try {
			await deleteResource([resource.id]);
			toast.success(m.delete_successful());
			await resourcesQuery.refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="resources" />

		<!-- Header -->
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
			<div>
				<h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
					{m.feature_resources_title()}
				</h1>
			</div>
			<Button href="/resources/new" class="w-full md:w-auto shadow-sm">
				<Plus class="w-4 h-4 mr-2" />
				{m.new_item({ item: "Resource" })}
			</Button>
		</div>

		<!-- Action Bar -->
		<div class="flex flex-col md:flex-row gap-3 mb-6">
			<div class="relative flex-1">
				<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					placeholder={m.search_resources()}
					bind:value={searchQuery}
					oninput={() => setPage(1)}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<FilterMenu
					groups={filterGroups}
					bind:filters={filterValues}
					buttonLabel={m.filters()}
					onchange={() => {
						savePrefs(sortField, sortOrder, filterValues);
						setPage(1);
					}}
				/>

				<div class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1">
					<select
						bind:value={sortField}
						onchange={() => {
							savePrefs(sortField, sortOrder, filterValues);
							setPage(1);
						}}
						class="text-sm bg-transparent border-none focus:ring-0 py-2 pl-2 pr-6 cursor-pointer text-gray-700 dark:text-gray-300"
					>
						<option value="updatedAt">{m.sort_last_updated()}</option>
						<option value="createdAt">{m.sort_created_date()}</option>
						<option value="name">{m.sort_name()}</option>
					</select>
					<button
						class="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
						onclick={() => {
							sortOrder = sortOrder === "desc" ? "asc" : "desc";
							savePrefs(sortField, sortOrder, filterValues);
							setPage(1);
						}}
						title={sortOrder === "desc" ? m.descending() : m.ascending()}
					>
						<ChevronDown size={14} class="transition-transform duration-200 {sortOrder === 'asc' ? 'rotate-180' : ''}" />
					</button>
				</div>
			</div>
		</div>

		<!-- Active Filter Chips -->
		<ActiveFilterChips
			groups={filterGroups}
			filters={filterValues}
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
				savePrefs(sortField, sortOrder, filterValues);
				setPage(1);
			}}
			onclearall={() => {
				const reset: FilterStateMap = {};
				for (const g of filterGroups) {
					reset[g.id] = { include: [], exclude: [] };
				}
				filterValues = reset;
				savePrefs(sortField, sortOrder, filterValues);
				setPage(1);
			}}
		/>

		<svelte:boundary>
			{#if resourcesQuery.loading && !resourcesRes}
				<div class="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
					<RefreshCw size={18} class="animate-spin text-primary-600" />
					<span>Loading...</span>
				</div>
			{:else if resourcesQuery.error}
				<div class="py-12 text-center text-red-500">
					{resourcesQuery.error instanceof Error ? resourcesQuery.error.message : "Failed to load."}
				</div>
			{:else if resourceItems.length === 0}
				<div class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
					<Box class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
					<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
						{m.no_items({ items: m.feature_resources_title() })}
					</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
						Try adjusting your search or filters.
					</p>
				</div>
			{:else}
				<div class={[resourcesQuery.loading && "opacity-60 transition-opacity"]}>
					<!-- List -->
					<div class="grid grid-cols-1 gap-5">
						{#each resourceItems as resource (resource.id)}
							<div
								id="item-{resource.id}"
								use:activeItemAnchor={{ feature: "resources", id: resource.id }}
								class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border p-5 flex flex-col transition-all {selectedIds.includes(resource.id)
									? 'border-primary-500 ring-2 ring-primary-500/20 shadow-md bg-primary-50/10 dark:bg-primary-950/20'
									: 'border-gray-100 dark:border-gray-800 hover:shadow-md'}"
							>
								<div class="flex-1 mb-5">
									<div class="flex items-start gap-3">
										<input
											type="checkbox"
											bind:group={selectedIds}
											value={resource.id}
											class="h-4.5 w-4.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 cursor-pointer mt-3.5 flex-shrink-0 transition-colors"
											title={selectedIds.includes(resource.id) ? "Deselect" : "Select"}
										/>
										<div class="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
											<Box size={24} />
										</div>
										<div class="flex-1 min-w-0">
											<a
												href={`/resources/${resource.id}`}
												class="block group mb-1"
												onclick={() => recordActiveItem("resources", resource.id)}
											>
												<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug truncate transition-colors">
													{resource.name}
												</h3>
											</a>
										</div>
									</div>
								</div>

								<div class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 w-full sm:w-auto">
									<Button
										variant="outline"
										size="sm"
										href={`/resources/${resource.id}`}
										class="flex-1 sm:flex-none"
										onclick={() => recordActiveItem("resources", resource.id)}
									>
										<Pencil class="w-4 h-4 mr-2" />
										{m.edit()}
									</Button>
									<button
										class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500 cursor-pointer"
										onclick={() => handleDelete(resource)}
									>
										<Trash2 class="w-4 h-4 mr-2" />
										{m.delete()}
									</button>
								</div>
								<div class="text-[11px] text-gray-400 dark:text-gray-500 text-right px-1 mt-2">
									{m.updated_on({
										date: new Date(resource.updatedAt).toLocaleString([], {
											year: "numeric",
											month: "2-digit",
											day: "2-digit",
											hour: "2-digit",
											minute: "2-digit",
										}),
									})}
									{#if resource.user}
										| <a
											href="/users/{resource.user.id}"
											class="hover:underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
											>{resource.user.name ||
												resource.user.email ||
												"User"}</a
										>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<!-- Pagination -->
					{#if totalPages > 1}
						<div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
							<div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
								<span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}</span>
								<div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
									<select
										bind:value={limit}
										onchange={() => setPage(1)}
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
									onclick={() => setPage(1)}
									class="h-9 w-9 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
									title="First page"
								>
									<ChevronsLeft size={16} />
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={page === 1}
									onclick={() => page > 1 && setPage(page - 1)}
									class="h-9 px-3 border-gray-200 dark:border-gray-700 shrink-0"
								>
									<ArrowLeft size={16} class="mr-1.5 hidden sm:block" />
									Previous
								</Button>
								<div class="flex items-center gap-1 px-1 sm:px-2 font-medium text-sm text-gray-700 dark:text-gray-300">
									<select
										value={page}
										onchange={(e) => setPage(Number(e.currentTarget.value))}
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
									onclick={() => page < totalPages && setPage(page + 1)}
									class="h-9 px-3 border-gray-200 dark:border-gray-700 shrink-0"
								>
									Next
									<ArrowRight size={16} class="ml-1.5 hidden sm:block" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									disabled={page === totalPages}
									onclick={() => setPage(totalPages)}
									class="h-9 w-9 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hidden sm:flex shrink-0"
									title="Last page"
								>
									<ChevronsRight size={16} />
								</Button>
							</div>
						</div>
					{/if}
				</div>
			{/if}
			{#snippet failed(error: unknown)}
				<div class="py-12 text-center text-red-500">{error instanceof Error ? error.message : "Failed to load."}</div>
			{/snippet}
		</svelte:boundary>
	</div>

	<BulkActionToolbar
		{selectedIds}
		totalCount={resourceItems.length}
		onSelectAll={() => (selectedIds = resourceItems.map((r: any) => r.id))}
		onDeselectAll={() => (selectedIds = [])}
		onDelete={handleBulkDelete}
		deleteLabel={m.delete ? m.delete() : "Delete"}
		selectAllLabel={m.select_all ? m.select_all() : `Select All (${resourceItems.length})`}
		deselectAllLabel={m.deselect_all ? m.deselect_all() : "Deselect All"}
	/>
</div>
