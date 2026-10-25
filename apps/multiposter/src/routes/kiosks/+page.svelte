<script lang="ts">
	import { listKiosks } from "./list.remote";
	import { deleteKiosk } from "./[id]/delete.remote";
	import * as m from "#lib/paraglide/messages.js";
	import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
	import Button from "#lib/components/ui/button/button.svelte";
	import {
		Monitor,
		Pencil,
		Trash2,
		Plus,
		Search,
		ChevronDown,
		ArrowLeft,
		ArrowRight,
		Check,
		RefreshCw,
		MapPin,
	} from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { getPreference, setPreference } from "#lib/utils/idb.js";
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
	} from "@ac/ui";
	import { getKioskFilterGroups } from "#lib/filters/index.js";

	// Filter state
	let sortField = $state<"updatedAt" | "createdAt" | "name">("updatedAt");
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let filterValues = $state<FilterStateMap>({});
	let limit = $state(50);

	const page = $derived(initPageFromUrl(pageState.url));

	function setPage(newPage: number) {
		syncPageToUrl("kiosks", newPage, pageState.url, goto);
	}

	const filterGroups = $derived<FilterGroup[]>(getKioskFilterGroups(m));

	function savePrefs(sf: typeof sortField, so: typeof sortOrder, fv: FilterStateMap) {
		setPreference("kiosksFilters", JSON.stringify({ sortField: sf, sortOrder: so, filterValues: fv })).catch(console.error);
	}

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("kiosksFilters", null);
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
		locationId:
			(filterValues.locationId?.include?.length || filterValues.locationId?.exclude?.length) ? filterValues.locationId : undefined,
		sortField,
		sortOrder,
	});

	let selectedIds = $state<string[]>([]);
	const query = $derived(listKiosks(filterState));
	const res = $derived(query.current);
	const kioskItems = $derived(res?.data ?? []);
	const total = $derived(res?.total ?? 0);
	const totalPages = $derived(Math.ceil(total / limit));

	async function handleBulkDelete() {
		if (selectedIds.length === 0) return;
		const confirmMsg = m.delete_confirm?.({ item: `${selectedIds.length} ${m.feature_kiosks_title?.() || 'kiosks'}` }) || `Delete ${selectedIds.length} kiosks?`;
		if (!window.confirm(confirmMsg)) return;
		try {
			await deleteKiosk(selectedIds);
			toast.success(m.delete_successful?.() || 'Deleted successfully');
			selectedIds = [];
			await query.refresh();
		} catch (e: any) {
			toast.error(e?.message || m.something_went_wrong?.() || 'Failed to delete');
		}
	}

	async function handleDelete(kiosk: any) {
		if (
			!window.confirm(
				m.delete_confirm({ item: kiosk.name }),
			)
		)
			return;
		try {
			await deleteKiosk([kiosk.id]);
			toast.success(m.delete_successful());
			await query.refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}
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
					{m.feature_kiosks_title()}
				</h1>
			</div>
			<Button href="/kiosks/new" class="w-full md:w-auto shadow-sm">
				<Plus class="w-4 h-4 mr-2" />
				{m.new_kiosk()}
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
					placeholder={m.search_kiosks()}
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

				<div
					class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1"
				>
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
			{#if query.loading && !res}
				<div class="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
					<RefreshCw size={18} class="animate-spin text-primary-600" />
					<span>{m.loading()}</span>
				</div>
			{:else if query.error}
				<div class="py-12 text-center text-red-500">
					{query.error instanceof Error ? query.error.message : m.load_error()}
				</div>
			{:else if kioskItems.length === 0}
				<div class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
					<Monitor class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
					<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
						{m.no_items({ items: m.feature_kiosks_title() })}
					</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
						Try adjusting your search or filters.
					</p>
				</div>
			{:else}
				<div class={[query.loading && "opacity-60 transition-opacity"]}>
					<div class="grid grid-cols-1 gap-5">
						{#each kioskItems as kiosk (kiosk.id)}
							<div
								id="item-{kiosk.id}"
								use:activeItemAnchor={{ feature: "kiosks", id: kiosk.id }}
								class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border p-5 flex flex-col transition-all {selectedIds.includes(kiosk.id)
									? 'border-primary-500 ring-2 ring-primary-500/20 shadow-md bg-primary-50/10 dark:bg-primary-950/20'
									: 'border-gray-100 dark:border-gray-800 hover:shadow-md'}"
							>
								<div class="flex-1 mb-5 flex items-start gap-3">
									<input
										type="checkbox"
										bind:group={selectedIds}
										value={kiosk.id}
										class="h-4.5 w-4.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 cursor-pointer mt-1 flex-shrink-0 transition-colors"
										title={selectedIds.includes(kiosk.id) ? "Deselect" : "Select"}
									/>
									<div class="flex-1 min-w-0">
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
												{#if kiosk.uiMode === "folded_flyer" || kiosk.uiMode === "folded_flyer_ci"}
													<span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
														{kiosk.uiMode === "folded_flyer_ci" ? "Flyer (CI)" : m.folded_flyer_badge()}
													</span>
												{:else if kiosk.uiMode === "flat_list"}
													<span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
														Flat List
													</span>
												{:else if kiosk.uiMode === "poster" || kiosk.uiMode === "poster_ci"}
													<span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
														{kiosk.uiMode === "poster_ci" ? "Poster (CI)" : m.poster_badge()}
													</span>
												{/if}
											</h3>
										</div>
									</a>

									{#if kiosk.description}
										<p
											class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3"
										>
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
								</div>
							</div>

							<div
								class="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 w-full sm:w-auto"
							>
								<Button
									variant="outline"
									size="sm"
									href="/kiosks/{kiosk.id}/view"
									target="_blank"
									class="flex-1 sm:flex-none"
								>
									{m.view()}
								</Button>
								<Button
									variant="outline"
									size="sm"
									href="/kiosks/{kiosk.id}"
									class="flex-1 sm:flex-none"
									onclick={() => recordActiveItem("kiosks", kiosk.id)}
								>
									<Pencil class="w-4 h-4 mr-2" />
									{m.edit()}
								</Button>
								<button
									class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500 cursor-pointer"
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
					{/each}
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div
						class="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800"
					>
						<div class="text-sm text-gray-500 dark:text-gray-400">
							{m.showing_range({
								from: (page - 1) * limit + 1,
								to: Math.min(page * limit, total),
								total: total
							})}
						</div>
						<div class="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={page === 1}
								onclick={() => page > 1 && setPage(page - 1)}
								class="h-9 px-3 border-gray-200 dark:border-gray-700"
							>
								<ArrowLeft size={16} class="mr-1.5" />
								{m.previous()}
							</Button>
							<div
								class="flex items-center gap-1 px-2 font-medium text-sm text-gray-700 dark:text-gray-300"
							>
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
								class="h-9 px-3 border-gray-200 dark:border-gray-700"
							>
								{m.next()}
								<ArrowRight size={16} class="ml-1.5" />
							</Button>
						</div>
					</div>
				{/if}
			</div>
			{/if}

			{#snippet failed(error: unknown)}
				<div class="py-12 text-center text-red-500">{error instanceof Error ? error.message : m.load_error()}</div>
			{/snippet}
		</svelte:boundary>
	</div>

	<BulkActionToolbar
		{selectedIds}
		totalCount={kioskItems.length}
		onSelectAll={() => (selectedIds = kioskItems.map((k: any) => k.id))}
		onDeselectAll={() => (selectedIds = [])}
		onDelete={handleBulkDelete}
		deleteLabel={m.delete ? m.delete() : "Delete"}
		selectAllLabel={m.select_all ? m.select_all() : `Select All (${kioskItems.length})`}
		deselectAllLabel={m.deselect_all ? m.deselect_all() : "Deselect All"}
	/>
</div>
