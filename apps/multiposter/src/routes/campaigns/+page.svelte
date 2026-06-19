<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { listCampaigns } from "./list.remote";
	import { deleteCampaigns } from "./[id]/delete.remote";

	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import {
		Megaphone,
		Pencil,
		Trash2,
		Plus,
		Search,
		ChevronDown,
		ChevronRight,
		ArrowLeft,
		ArrowRight,
		ChevronsLeft,
		ChevronsRight
	} from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { getPreference, setPreference } from "$lib/utils/idb";

	let sortField = $state<"updatedAt" | "createdAt" | "name">("updatedAt");
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let page = $state(1);
	let limit = $state(50);

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
		}
	});

	$effect(() => {
		const prefsToSave = {
			sortField,
			sortOrder,
		};
		setPreference("campaignsFilters", JSON.stringify(prefsToSave)).catch(console.error);
	});

	const filterState = $derived({
		page,
		limit,
		search: searchQuery,
		sortField,
		sortOrder,
	});

	async function handleDelete(campaign: any) {
		if (!window.confirm(m.delete_confirm({ item: "Campaign" }))) return;
		try {
			await deleteCampaigns([campaign.id]);
			toast.success(m.delete_successful());
			listCampaigns(filterState).refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}

	const query = $derived(listCampaigns(filterState));
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
					placeholder="Search campaigns..."
					bind:value={searchQuery}
					oninput={() => (page = 1)}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<div class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1">
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
						onclick={() => (sortOrder = sortOrder === "desc" ? "asc" : "desc")}
						title={sortOrder === "desc" ? "Descending" : "Ascending"}
					>
						<ChevronDown size={14} class="transition-transform duration-200 {sortOrder === 'asc' ? 'rotate-180' : ''}" />
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
				{#each query.current?.data || [] as campaign (campaign.id)}
				<div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-md transition-shadow">
					<div class="flex-1 mb-5">
						<div class="flex items-start gap-4">
							<div class="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
								<Megaphone size={24} />
							</div>
							<div class="flex-1 min-w-0">
								<a href={`/campaigns/${campaign.id}`} class="block group mb-1">
									<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug truncate transition-colors">
										{campaign.name}
									</h3>
								</a>
							</div>
						</div>
					</div>

					<div class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 w-full sm:w-auto">
						<Button variant="outline" size="sm" href={`/campaigns/${campaign.id}`} class="flex-1 sm:flex-none">
							<Pencil class="w-4 h-4 mr-2" />
							{m.edit()}
						</Button>
						<button
							class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500"
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
			{:else}
				<div class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
					<Megaphone class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
					<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
						{m.no_items({ items: m.feature_campaigns_title() })}
					</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
						Try adjusting your search or filters.
					</p>
				</div>
				{/each}
			{/if}
		</div>

		<!-- Pagination -->
		{#if query.current && query.current.total > limit}
				{@const totalPages = Math.ceil(query.current.total / limit)}
				<div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
					<div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
						<span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, query.current.total)} of {query.current.total}</span>
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
</div>
