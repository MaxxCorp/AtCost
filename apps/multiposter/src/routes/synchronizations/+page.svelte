<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { list } from "./list.remote";
	import { removeBulk } from "./[id]/delete.remote";
	import { getEmailCampaigns } from "./email-campaigns.remote";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
	import {
		Calendar,
		CircleCheck,
		CircleAlert,
		ChevronDown,
		ChevronRight,
		Mail,
		Eye,
		MousePointer,
		TriangleAlert,
		CircleX,
		UserX,
		Pencil,
		Trash2,
		Plus,
		Search,
		Filter as FilterIcon,
		X,
		ArrowLeft,
		ArrowRight,
		ChevronsLeft,
		ChevronsRight
	} from "@lucide/svelte";

	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import WebhookToggleButton from "$lib/components/synchronizations/WebhookToggleButton.svelte";
	import { authClient } from "$lib/auth";
	import { hasAccess } from "$lib/authorization";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { getPreference, setPreference } from "$lib/utils/idb";

	const session = authClient.useSession();
	const user = $derived($session.data?.user);
	const isAdmin = $derived(hasAccess(user, 'synchronizations', 'admin'));

	// Type definition for the list items
	type Synchronization = Awaited<ReturnType<typeof list>>["data"][number];
	type EmailCampaign = {
		id: string;
		eventSummary: string;
		sentAt: Date;
		recipientCount: number;
		brevoCampaignId: string | null;
		events: Array<{
			recipientEmail: string;
			eventType: string;
			occurredAt: Date;
		}>;
	};

	let expandedCampaigns = $state<Set<string>>(new Set());
	let campaignsData = $state<
		Map<
			string,
			{ campaigns: EmailCampaign[]; hasMore: boolean; loading: boolean }
		>
	>(new Map());

	function formatDate(date: Date | string | null) {
		if (!date) return m.never();
		return new Date(date).toLocaleString();
	}

	function getProviderIcon(providerType: string) {
		if (providerType === "google-calendar") return Calendar;
		if (providerType === "email") return Mail;
		return Calendar;
	}

	function getProviderLabel(providerType: string) {
		if (providerType === "google-calendar") return "Google Calendar";
		if (providerType === "microsoft-calendar") return "Microsoft Calendar";
		if (providerType === "berlin-de-main-calendar")
			return "Berlin.de (" + m.main_calendar() + ")";
		if (providerType === "berlin-de-mh-calendar")
			return "Berlin.de (Marzahn-Hellersdorf)";
		if (providerType === "wp-the-events-calendar")
			return "WP The Events Calendar";
		if (providerType === "email") return "E-Mail (Brevo)";
		return providerType;
	}
	function getDirectionLabel(direction: string) {
		if (direction === "pull") return m.pull_only();
		if (direction === "push") return m.push_only();
		if (direction === "bidirectional") return m.bidirectional();
		return direction;
	}

	function getStatusColor(enabled: boolean, lastSyncAt: Date | string | null) {
		if (!enabled) return "text-gray-400";
		if (!lastSyncAt) return "text-yellow-500";
		const hoursSinceSync =
			(Date.now() - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60);
		if (hoursSinceSync > 24) return "text-orange-500";
		return "text-green-500";
	}

	function toggleCampaignsExpansion(syncConfigId: string) {
		if (expandedCampaigns.has(syncConfigId)) {
			expandedCampaigns.delete(syncConfigId);
		} else {
			expandedCampaigns.add(syncConfigId);
			// Load campaigns if not already loaded
			loadCampaigns(syncConfigId);
		}
		expandedCampaigns = new Set(expandedCampaigns);
	}

	async function loadCampaigns(syncConfigId: string, append = false) {
		const currentData = campaignsData.get(syncConfigId) || {
			campaigns: [],
			hasMore: true,
			loading: false,
		};
		if (currentData.loading) return;

		campaignsData.set(syncConfigId, { ...currentData, loading: true });
		campaignsData = new Map(campaignsData);

		try {
			const offset = append ? currentData.campaigns.length : 0;
			const newCampaigns = await getEmailCampaigns({
				configId: syncConfigId,
				limit: 10,
				offset,
			});

			const updatedCampaigns = append
				? [...currentData.campaigns, ...newCampaigns]
				: newCampaigns;
			const hasMore = newCampaigns.length === 10;

			campaignsData.set(syncConfigId, {
				campaigns: updatedCampaigns,
				hasMore,
				loading: false,
			});
		} catch (error) {
			console.error("Failed to load email campaigns:", error);
			campaignsData.set(syncConfigId, { ...currentData, loading: false });
		}

		campaignsData = new Map(campaignsData);
	}

	function getEventIcon(eventType: string) {
		switch (eventType) {
			case "delivered":
				return CircleCheck;
			case "opened":
				return Eye;
			case "click":
			case "clicked":
				return MousePointer;
			case "hardBounce":
			case "softBounce":
			case "bounced":
				return TriangleAlert;
			case "spam":
			case "complained":
				return CircleX;
			case "unsubscribed":
				return UserX;
			default:
				return Mail;
		}
	}

	function getEventColor(eventType: string) {
		switch (eventType) {
			case "delivered":
				return "text-green-600";
			case "opened":
				return "text-blue-600";
			case "click":
			case "clicked":
				return "text-purple-600";
			case "hardBounce":
			case "softBounce":
			case "bounced":
				return "text-red-600";
			case "spam":
			case "complained":
				return "text-orange-600";
			case "unsubscribed":
				return "text-gray-600";
			default:
				return "text-gray-500";
		}
	}

	function formatEventType(eventType: string) {
		switch (eventType) {
			case "delivered":
				return m.delivered();
			case "opened":
				return m.opened();
			case "click":
			case "clicked":
				return m.clicked();
			case "hardBounce":
				return m.hard_bounce();
			case "softBounce":
				return m.soft_bounce();
			case "bounced":
				return m.bounced();
			case "spam":
			case "complained":
				return m.spam_complained();
			case "unsubscribed":
				return m.unsubscribed();
			default:
				return eventType;
		}
	}

	let sortField = $state<"updatedAt" | "createdAt" | "name">("createdAt");
	let sortOrder = $state<"asc" | "desc">("desc");
	let searchQuery = $state("");
	let selectedProviders = $state<string[]>([]);
	let page = $state(1);
	let limit = $state(50);

	onMount(async () => {
		try {
			const savedPrefs = await getPreference("syncsFilters", null);
			if (savedPrefs) {
				const prefs = JSON.parse(savedPrefs as string);
				if (prefs.sortField) sortField = prefs.sortField;
				if (prefs.sortOrder) sortOrder = prefs.sortOrder;
				if (prefs.selectedProviders) selectedProviders = prefs.selectedProviders;
			}
		} catch (e) {
			console.error("Failed to load preferences", e);
		}
	});

	$effect(() => {
		const prefsToSave = {
			sortField,
			sortOrder,
			selectedProviders,
		};
		setPreference("syncsFilters", JSON.stringify(prefsToSave)).catch(
			console.error,
		);
	});

	const filterState = $derived({
		page,
		limit,
		search: searchQuery,
		providerType: selectedProviders.length > 0 ? selectedProviders : undefined,
		sortField,
		sortOrder,
	});

	const activeFiltersCount = $derived(selectedProviders.length);

	const PROVIDER_OPTIONS = [
		{ value: "google-calendar", label: "Google Calendar" },
		{ value: "microsoft-calendar", label: "Microsoft Calendar" },
		{ value: "berlin-de-main-calendar", label: "Berlin.de (Main)" },
		{ value: "berlin-de-mh-calendar", label: "Berlin.de (M-H)" },
		{ value: "wp-the-events-calendar", label: "WP The Events Calendar" },
		{ value: "email", label: "E-Mail (Brevo)" },
	];

	function toggleProvider(value: string) {
		if (selectedProviders.includes(value)) {
			selectedProviders = selectedProviders.filter((t) => t !== value);
		} else {
			selectedProviders = [...selectedProviders, value];
		}
		page = 1;
	}

	async function deleteItem(config: Synchronization) {
		if (!window.confirm(m.delete_confirm({ item: m.feature_synchronizations_title() }))) return;
		try {
			await removeBulk([config.id]);
			toast.success(m.delete_successful());
			list(filterState).refresh();
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}
</script>

<svelte:head>
	<title>{m.feature_synchronizations_title()}</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="synchronizations" />

		<!-- Header -->
		<div
			class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800"
		>
			<div>
				<h1
					class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight"
				>
					{m.feature_synchronizations_title()}
				</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					{m.feature_synchronizations_description ? m.feature_synchronizations_description() : "Manage calendar and email synchronizations"}
				</p>
			</div>
			{#if isAdmin}
				<Button href="/synchronizations/new" class="w-full md:w-auto shadow-sm">
					<Plus class="w-4 h-4 mr-2" />
					{m.new_item({ item: "Synchronization" })}
				</Button>
			{/if}
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
					placeholder={m.search_synchronizations()}
					bind:value={searchQuery}
					oninput={() => (page = 1)}
					class="pl-9 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
				/>
			</div>
			<div class="flex items-center gap-2 shrink-0">
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
						>System Filters</DropdownMenu.Label>
						<DropdownMenu.Separator class="bg-gray-50" />

						<DropdownMenu.Sub>
							<DropdownMenu.SubTrigger
								class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg"
							>
								<span>Providers</span>
								{#if selectedProviders.length > 0}
									<span
										class="ml-auto text-[10px] py-0.5 px-2 h-4 bg-primary-50 text-primary-700 rounded-full flex items-center justify-center font-bold"
										>{selectedProviders.length}</span
									>
								{/if}
							</DropdownMenu.SubTrigger>
							<DropdownMenu.SubContent
								class="w-56 p-1 max-h-[300px] overflow-y-auto rounded-xl shadow-lg border-gray-100"
							>
								{#each PROVIDER_OPTIONS as provider}
									<DropdownMenu.CheckboxItem
										checked={selectedProviders.includes(provider.value)}
										onCheckedChange={() => toggleProvider(provider.value)}
										class="rounded-lg py-2 px-3 text-sm cursor-pointer hover:bg-gray-50"
									>
										<span class="truncate block w-full">{provider.label}</span>
									</DropdownMenu.CheckboxItem>
								{/each}
							</DropdownMenu.SubContent>
						</DropdownMenu.Sub>

						{#if activeFiltersCount > 0}
							<DropdownMenu.Separator class="bg-gray-50" />
							<DropdownMenu.Item
								class="text-red-600 font-medium py-2 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-700"
								onclick={() => {
									selectedProviders = [];
									page = 1;
								}}
							>
								<X size={14} class="mr-2" />
								Clear Filters
							</DropdownMenu.Item>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				<div
					class="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1"
				>
					<select
						bind:value={sortField}
						class="text-sm bg-transparent border-none focus:ring-0 py-2 pl-2 pr-6 cursor-pointer text-gray-700 dark:text-gray-300"
					>
						<option value="createdAt">{m.sort_created_date()}</option>
						<option value="updatedAt">{m.sort_last_updated()}</option>
						<option value="name">{m.sort_name()}</option>
					</select>
					<button
						class="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
						onclick={() =>
							(sortOrder = sortOrder === "desc" ? "asc" : "desc")}
						title={sortOrder === "desc" ? m.descending() : m.ascending()}
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
			{#each (await list(filterState)).data || [] as config (config.id)}
				{@const Icon = getProviderIcon(config.providerType)}
				{@const statusColor = getStatusColor(
					config.enabled,
					config.lastSyncAt,
				)}
				<div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-md transition-shadow">
					<div class="flex-1 mb-5">
						<div class="flex items-start justify-between gap-4 mb-2">
							<div class="flex-1 min-w-0">
								<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug line-clamp-2 transition-colors">
									<a
										href={`/synchronizations/${config.id}`}
										class="hover:underline text-blue-600 flex items-center gap-2"
									>
										<Icon class="h-5 w-5 flex-shrink-0" />
										{#if config.name}
											{config.name}
										{:else}
											{getProviderLabel(config.providerType)}
										{/if}
									</a>
								</h3>
								<p class="text-sm text-gray-500 break-all mt-1">
									{config.providerId}
								</p>
							</div>
							<div class={statusColor}>
								{#if config.enabled}
									<CircleCheck class="h-5 w-5" />
								{:else}
									<CircleAlert class="h-5 w-5" />
								{/if}
							</div>
						</div>

						<div class="space-y-1 text-sm mt-4">
							<div class="flex gap-2">
								<span class="text-gray-600">{m.direction()}:</span>
								<span class="font-medium">{getDirectionLabel(config.direction)}</span>
							</div>
							<div class="flex gap-2">
								<span class="text-gray-600">{m.status()}:</span>
								<span class={`font-medium ${config.enabled ? "text-green-600" : "text-gray-400"}`}>
									{config.enabled ? m.enabled() : m.disabled()}
								</span>
							</div>
							<div class="flex gap-2">
								<span class="text-gray-600">{m.last_sync()}:</span>
								<span class="font-medium">{formatDate(config.lastSyncAt)}</span>
							</div>
						</div>

						{#if config.providerType === "email"}
							<div class="mt-4 border-t pt-4">
								<button
									class="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
									onclick={() => toggleCampaignsExpansion(config.id)}
								>
									{#if expandedCampaigns.has(config.id)}
										<ChevronDown class="h-4 w-4" />
									{:else}
										<ChevronRight class="h-4 w-4" />
									{/if}
									{m.campaigns()}
								</button>

								{#if expandedCampaigns.has(config.id)}
									{@const campaignData = campaignsData.get(config.id)}
									<div class="mt-3 space-y-3">
										{#if campaignData?.campaigns.length === 0 && !campaignData.loading}
											<p class="text-sm text-gray-500">{m.no_campaigns_sent()}</p>
										{:else}
											{#each campaignData?.campaigns || [] as campaign}
												<div class="border rounded-lg p-3 bg-gray-50">
													<div class="flex items-center justify-between mb-2">
														<h4 class="font-medium text-sm">{campaign.eventSummary}</h4>
														<span class="text-xs text-gray-500">
															{new Date(campaign.sentAt).toLocaleDateString()}
															{new Date(campaign.sentAt).toLocaleTimeString()}
														</span>
													</div>
													<div class="space-y-1">
														{#each campaign.events as event}
															{@const EventIcon = getEventIcon(event.eventType)}
															<div class="flex items-center gap-2 text-xs">
																<EventIcon class={`h-3 w-3 ${getEventColor(event.eventType)}`} />
																<span class="text-gray-600">{event.recipientEmail}</span>
																<span class={`font-medium ${getEventColor(event.eventType)}`}>
																	{formatEventType(event.eventType)}
																</span>
																<span class="text-gray-400 ml-auto">{new Date(event.occurredAt).toLocaleString()}</span>
															</div>
														{/each}
													</div>
												</div>
											{/each}

											{#if campaignData?.loading}
												<div class="text-center py-2">
													<div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
												</div>
											{:else if campaignData?.hasMore}
												<div class="text-center pt-2">
													<Button
														variant="outline"
														size="sm"
														onclick={() => loadCampaigns(config.id, true)}
													>
														{m.load_more_items({ items: m.campaigns() })}
													</Button>
												</div>
											{/if}
										{/if}
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<div class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-end items-center gap-2 w-full sm:w-auto">
						<div class="flex-1">
							<WebhookToggleButton
								configId={config.id}
								providerType={config.providerType}
								direction={config.direction}
								disabled={!isAdmin}
							/>
						</div>
						
						{#if isAdmin}
							<Button
								href={`/synchronizations/${config.id}`}
								variant="outline"
								size="sm"
								class="flex-1 sm:flex-none"
							>
								<Pencil class="w-4 h-4 mr-2" /> {m.edit()}
							</Button>
							<button
								class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500"
								onclick={() => deleteItem(config)}
							>
								<Trash2 class="w-4 h-4 mr-2" /> {m.delete()}
							</button>
						{:else}
							<Button
								href={`/synchronizations/${config.id}`}
								variant="outline"
								size="sm"
								class="flex-1 sm:flex-none"
							>
								<Eye class="w-4 h-4 mr-2" /> {m.view()}
							</Button>
						{/if}
					</div>
				</div>
			{:else}
				<div
					class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
				>
					<Calendar
						class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3"
					/>
					<h3
						class="text-lg font-medium text-gray-900 dark:text-gray-100"
					>
						{m.no_items({ items: m.feature_synchronizations_title() })}
					</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
						Try adjusting your search or filters.
					</p>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#await list(filterState) then res}
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
