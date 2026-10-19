<script lang="ts">
	import * as m from "#lib/paraglide/messages.js";
	import { listCampaigns } from "./list.remote";
	import { deleteCampaigns } from "./[id]/delete.remote";

	import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
	import Button from "#lib/components/ui/button/button.svelte";
	import { goto } from "$app/navigation";
	import { page as pageState } from "$app/state";
	import {
		initPageFromUrl,
		syncPageToUrl,
		recordActiveItem,
		activeItemAnchor,
		BulkActionToolbar,
	} from "@ac/ui";
	import {
		Megaphone,
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
	import { onMount, untrack } from "svelte";
	import { getPreference, setPreference } from "#lib/utils/idb.js";

	let sortField = $state<"updatedAt" | "createdAt" | "name">("updatedAt");
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let isInitialized = $state(false);
	const page = $derived(initPageFromUrl(pageState.url));
	let limit = $state(50);

	function setPage(newPage: number) {
		syncPageToUrl("campaigns", newPage, pageState.url, goto);
	}

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("campaignsFilters", null);
			if (savedPrefs) {
				const prefs = JSON.parse(savedPrefs as string);
				if (prefs.sortField) sortField = prefs.sortField;
				if (prefs.sortOrder) sortOrder = prefs.sortOrder;
			}
		} catch (e) {
			console.error("Failed to load preferences", e);
		} finally {
			isInitialized = true;
		}
	});

	function saveSortPrefs(sf: typeof sortField, so: typeof sortOrder) {
		setPreference("campaignsFilters", JSON.stringify({ sortField: sf, sortOrder: so })).catch(console.error);
	}

	const filterState = $derived({
		page,
		limit,
		search: searchQuery || undefined,
		sortField,
		sortOrder,
	});

	let selectedIds = $state<string[]>([]);
	const campaignsQuery = $derived(listCampaigns(filterState));
	const campaignsRes = $derived(campaignsQuery.current);
	const campaignItems = $derived(campaignsRes?.data ?? []);
	const total = $derived(campaignsRes?.total ?? 0);
	const totalPages = $derived(Math.ceil(total / limit));

	async function handleBulkDelete() {
		if (selectedIds.length === 0) return;
		const confirmMsg = m.delete_confirm?.({ item: `${selectedIds.length} ${m.feature_campaigns_title?.() || 'campaigns'}` }) || `Delete ${selectedIds.length} campaigns?`;
		if (!window.confirm(confirmMsg)) return;
		try {
			await deleteCampaigns(selectedIds);
			toast.success(m.delete_successful?.() || 'Deleted successfully');
			selectedIds = [];
			await campaignsQuery.refresh();
		} catch (e: any) {
			toast.error(e?.message || m.something_went_wrong?.() || 'Failed to delete');
		}
	}

	async function handleDelete(campaign: any) {
		if (!window.confirm(m.delete_confirm({ item: "Campaign" }))) return;
		try {
			await deleteCampaigns([campaign.id]);
			toast.success(m.delete_successful());
			await campaignsQuery.refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="campaigns" />

		<!-- Header -->
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
			<div>
				<h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
					{m.feature_campaigns_title()}
				</h1>
			</div>
			<Button href="/campaigns/new" class="w-full md:w-auto shadow-sm">
				<Plus class="w-4 h-4 mr-2" />
				{m.new_item({ item: "Campaign" })}
			</Button>
		</div>

		<!-- Action Bar -->
		<div class="flex flex-col md:flex-row gap-3 mb-6">
			<div class="relative flex-1">
				<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					placeholder={m.search_campaigns()}
					bind:value={searchQuery}
					oninput={() => setPage(1)}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<div class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1">
					<select
						bind:value={sortField}
						onchange={() => {
							saveSortPrefs(sortField, sortOrder);
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
							saveSortPrefs(sortField, sortOrder);
							setPage(1);
						}}
						title={sortOrder === "desc" ? m.descending() : m.ascending()}
					>
						<ChevronDown size={14} class="transition-transform duration-200 {sortOrder === 'asc' ? 'rotate-180' : ''}" />
					</button>
				</div>
			</div>
		</div>

		<svelte:boundary>
			{#if campaignsQuery.loading && !campaignsRes}
				<div class="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
					<RefreshCw size={18} class="animate-spin text-primary-600" />
					<span>Loading...</span>
				</div>
			{:else if campaignsQuery.error}
				<div class="py-12 text-center text-red-500">
					{campaignsQuery.error instanceof Error ? campaignsQuery.error.message : "Failed to load."}
				</div>
			{:else if campaignItems.length === 0}
				<div class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
					<Megaphone class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
					<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
						{m.no_items({ items: m.feature_campaigns_title() })}
					</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
						Try adjusting your search or filters.
					</p>
				</div>
			{:else}
				<div class={[campaignsQuery.loading && "opacity-60 transition-opacity"]}>
					<!-- List -->
					<div class="grid grid-cols-1 gap-5">
						{#each campaignItems as campaign (campaign.id)}
							<div
								id="item-{campaign.id}"
								use:activeItemAnchor={{ feature: "campaigns", id: campaign.id }}
								class="bg-white dark:bg-gray-900 rounded-xl border p-5 flex flex-col transition-all {selectedIds.includes(campaign.id)
									? 'border-primary-500 ring-2 ring-primary-500/20 shadow-md bg-primary-50/10 dark:bg-primary-950/20'
									: 'border-gray-100 dark:border-gray-800 hover:shadow-md'}"
							>
								<div class="flex-1 mb-5">
									<div class="flex items-start gap-3">
										<input
											type="checkbox"
											bind:group={selectedIds}
											value={campaign.id}
											class="h-4.5 w-4.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 cursor-pointer shrink-0 transition-colors mt-3.5"
											title={selectedIds.includes(campaign.id) ? "Deselect" : "Select"}
										/>
										<div class="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
											<Megaphone size={24} />
										</div>
										<div class="flex-1 min-w-0">
											<a
												href={`/campaigns/${campaign.id}`}
												class="block group mb-1"
												onclick={() => recordActiveItem("campaigns", campaign.id)}
											>
												<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug truncate transition-colors">
													{campaign.name}
												</h3>
											</a>
										</div>
									</div>
								</div>

								<div class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 w-full sm:w-auto">
									<Button
										variant="outline"
										size="sm"
										href={`/campaigns/${campaign.id}`}
										class="flex-1 sm:flex-none"
										onclick={() => recordActiveItem("campaigns", campaign.id)}
									>
										<Pencil class="w-4 h-4 mr-2" />
										{m.edit()}
									</Button>
									<button
										class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500 cursor-pointer"
										onclick={() => handleDelete(campaign)}
									>
										<Trash2 class="w-4 h-4 mr-2" />
										{m.delete()}
									</button>
								</div>
								<div class="text-[11px] text-gray-400 dark:text-gray-500 text-right px-1 mt-2">
									{m.updated_on({
										date: new Date(campaign.updatedAt).toLocaleString([], {
											year: "numeric",
											month: "2-digit",
											day: "2-digit",
											hour: "2-digit",
											minute: "2-digit",
										}),
									})}
									{#if campaign.user}
										| <a
											href="/users/{campaign.user.id}"
											class="hover:underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
											>{campaign.user.name ||
												campaign.user.email ||
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
		totalCount={campaignItems.length}
		onSelectAll={() => {
			selectedIds = campaignItems.map((c: any) => c.id);
		}}
		onDeselectAll={() => (selectedIds = [])}
		onDelete={handleBulkDelete}
		deleteLabel={m.delete ? m.delete() : "Delete"}
		selectAllLabel={m.select_all ? m.select_all() : `Select All (${campaignItems.length})`}
		deselectAllLabel={m.deselect_all ? m.deselect_all() : "Deselect All"}
	/>
</div>
