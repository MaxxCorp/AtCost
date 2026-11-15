<script lang="ts">
	import * as m from '#lib/paraglide/messages.js';
	import {
		Search,
		Plus,
		SlidersHorizontal,
		Flame,
		Clock,
		RefreshCw,
		Users,
		Eye,
		ArrowUpDown,
		Settings2,
		ShieldCheck,
		Sparkles,
		X
	} from '@lucide/svelte';
	import {
		Button,
		FilterMenu,
		ActiveFilterChips,
		LoadingSection,
		ErrorSection,
		EmptyState,
		useFormValidationFeedback,
		type FilterStateMap
	} from '@ac/ui';
	import { getGoalFilterGroups } from '#lib/filters/index.js';
	import {
		listGoalCampaigns,
		getShowcaseCampaigns,
		getCurrentSessionUser
	} from './list.remote.js';
	import {
		updateShowcaseConfig,
		toggleCampaignShowcase
	} from './showcase.remote.js';
	import {
		updateGoalShowcaseConfigSchema,
		type GoalCampaign,
		type GoalShowcaseSelectionMode
	} from '@ac/validations';
	import GoalShowcaseSection from '#lib/components/goals/GoalShowcaseSection.svelte';
	import GoalOverviewCard from '#lib/components/goals/GoalOverviewCard.svelte';
	import { toast } from 'svelte-sonner';

	const sessionQuery = getCurrentSessionUser({});
	const showcaseQuery = getShowcaseCampaigns({});

	const isOperator = $derived(sessionQuery.current?.isOperator ?? false);
	const showcaseData = $derived(showcaseQuery.current);

	// Search, Filter & Ordering state
	let search = $state('');
	let filters = $state<FilterStateMap>({});
	let sortBy = $state<
		'createdAt' | 'updatedAt' | 'popularity' | 'visitsCount' | 'contributionsCount'
	>('popularity');
	let sortOrder = $state<'desc' | 'asc'>('desc');
	let pageNum = $state(1);
	const limit = 12;

	const filterGroups = $derived(getGoalFilterGroups(m));

	const campaignsQuery = $derived(
		listGoalCampaigns({
			page: pageNum,
			limit,
			search: search.trim() || undefined,
			tagId: filters.tagId?.include,
			locationId: filters.locationId?.include,
			contributionType: filters.contributionType?.include as any,
			status: filters.status?.include as any,
			sortField: sortBy,
			sortOrder
		})
	);

	const campaigns = $derived(campaignsQuery.current?.data ?? []);
	const totalItems = $derived(campaignsQuery.current?.total ?? 0);

	// Collapsible Operator Showcase Configuration Panel
	let showShowcaseConfigPanel = $state(false);
	let cfgIsActive = $state<boolean | null>(null);
	let cfgSelectionMode = $state<GoalShowcaseSelectionMode | null>(null);
	let cfgMaxItems = $state<string | null>(null);
	let cfgTitle = $state<string | null>(null);
	let cfgSubtitle = $state<string | null>(null);

	const effectiveIsActive = $derived(
		cfgIsActive !== null ? cfgIsActive : (showcaseData?.config.isActive ?? true)
	);
	const effectiveSelectionMode = $derived(
		cfgSelectionMode !== null
			? cfgSelectionMode
			: (showcaseData?.config.selectionMode ?? 'mixed')
	);
	const effectiveMaxItems = $derived(
		cfgMaxItems !== null ? cfgMaxItems : String(showcaseData?.config.maxItems ?? 3)
	);
	const effectiveTitle = $derived(
		cfgTitle !== null
			? cfgTitle
			: (showcaseData?.config.title ?? 'Featured Goal Campaigns')
	);
	const effectiveSubtitle = $derived(
		cfgSubtitle !== null
			? cfgSubtitle
			: (showcaseData?.config.subtitle ??
				'Spotlight initiatives curated by operator choice, community momentum, and recent launches.')
	);

	const showcaseRf = updateShowcaseConfig;

	useFormValidationFeedback(() => showcaseRf, {
		message: () => m.please_fix_validation()
	});

	async function handleToggleShowcase(campaign: GoalCampaign) {
		try {
			await toggleCampaignShowcase({
				campaignId: campaign.id,
				isShowcased: !campaign.isShowcased
			});
			await Promise.all([showcaseQuery.refresh(), campaignsQuery.refresh()]);
			toast.success(
				campaign.isShowcased
					? 'Removed from operator showcase'
					: 'Pinned to operator showcase'
			);
		} catch (err: any) {
			toast.error(err?.message || 'Failed to toggle showcase status');
		}
	}

	const sortOptions: Array<{
		id: 'popularity' | 'createdAt' | 'updatedAt' | 'contributionsCount' | 'visitsCount';
		label: string;
		icon: any;
	}> = [
		{ id: 'popularity', label: 'Popularity (Visits & Participation)', icon: Flame },
		{ id: 'createdAt', label: 'Creation Recency', icon: Clock },
		{ id: 'updatedAt', label: 'Last Update', icon: RefreshCw },
		{ id: 'contributionsCount', label: 'Most Participations', icon: Users },
		{ id: 'visitsCount', label: 'Most Visited', icon: Eye }
	];
</script>

<svelte:head>
	<title>Explore Goal Campaigns | AC-Goals</title>
</svelte:head>

<div class="space-y-8 pb-16">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
				<Sparkles class="w-4 h-4" />
				Discovery & Participation Hub
			</div>
			<h1 class="text-3xl font-black text-gray-900 tracking-tight mt-1">
				Goal-Achieving Campaigns
			</h1>
			<p class="text-sm text-gray-600 mt-1">
				Back primary targets and unlock stretch milestones through votes, sign-ups, or financial pledges.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2.5">
			{#if isOperator}
				<Button
					variant="outline"
					onclick={() => (showShowcaseConfigPanel = !showShowcaseConfigPanel)}
					class="inline-flex items-center gap-2 text-sm"
				>
					<Settings2 class="w-4 h-4 text-emerald-600" />
					{showShowcaseConfigPanel ? 'Hide Showcase Config' : 'Configure Showcase'}
				</Button>
				<Button
					href="/goals/approvals"
					variant="secondary"
					class="inline-flex items-center gap-2 text-sm"
				>
					<ShieldCheck class="w-4 h-4" />
					Approvals & Governance
				</Button>
			{/if}
			<Button
				href="/goals/new"
				variant="primary"
				class="inline-flex items-center gap-2 font-semibold"
			>
				<Plus class="w-4 h-4" />
				Launch Campaign
			</Button>
		</div>
	</div>

	<!-- 1. Top Showcase Section + Collapsible Operator Showcase Configuration Panel -->
	{#if showShowcaseConfigPanel && isOperator}
		<div class="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm space-y-4">
			<div class="flex items-center justify-between border-b border-emerald-200/70 pb-3">
				<div>
					<h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
						<Settings2 class="w-5 h-5 text-emerald-600" />
						Operator Showcase Configuration
					</h2>
					<p class="text-xs text-gray-600">
						Toggle the top showcase section on or off, or change how featured campaigns are selected (operator choice, popularity, recency, or mixed).
					</p>
				</div>
				<button
					type="button"
					onclick={() => (showShowcaseConfigPanel = false)}
					class="rounded-lg p-1.5 text-gray-500 hover:bg-emerald-100 hover:text-gray-800"
					aria-label="Close configuration panel"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				{...showcaseRf
					.preflight(updateGoalShowcaseConfigSchema)
					.enhance(async ({ submit }) => {
						try {
							await submit();
							await showcaseQuery.refresh();
							toast.success('Showcase configuration saved');
							showShowcaseConfigPanel = false;
						} catch (err: any) {
							toast.error(err?.message || 'Failed to update showcase settings');
						}
					})}
				class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
			>
				<input
					{...showcaseRf.fields.isActive.as(
						'hidden',
						effectiveIsActive ? 'true' : 'false'
					)}
				/>
				<input
					{...showcaseRf.fields.selectionMode.as('hidden', effectiveSelectionMode)}
				/>

				<div class="space-y-1.5">
					<span class="block text-xs font-bold uppercase tracking-wider text-gray-700">
						Showcase Visibility
					</span>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => {
								cfgIsActive = true;
								void showcaseRf.validate().catch(() => {});
							}}
							class="flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition-colors {effectiveIsActive
								? 'border-emerald-600 bg-emerald-600 text-white'
								: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
						>
							Active (Shown)
						</button>
						<button
							type="button"
							onclick={() => {
								cfgIsActive = false;
								void showcaseRf.validate().catch(() => {});
							}}
							class="flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition-colors {!effectiveIsActive
								? 'border-rose-600 bg-rose-600 text-white'
								: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
						>
							Hidden (Off)
						</button>
					</div>
				</div>

				<div class="space-y-1.5">
					<span class="block text-xs font-bold uppercase tracking-wider text-gray-700">
						Selection Mode
					</span>
					<div class="grid grid-cols-2 gap-1.5">
						{#each [
							{ id: 'mixed', label: 'Mixed (Smart)' },
							{ id: 'operator_choice', label: 'Operator Choice' },
							{ id: 'popularity', label: 'Popularity' },
							{ id: 'recency', label: 'Recency' }
						] as mode (mode.id)}
							<button
								type="button"
								onclick={() => {
									cfgSelectionMode = mode.id as GoalShowcaseSelectionMode;
									void showcaseRf.validate().catch(() => {});
								}}
								class="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors {effectiveSelectionMode ===
								mode.id
									? 'border-emerald-600 bg-emerald-100 text-emerald-900'
									: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
							>
								{mode.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="space-y-1.5">
					<label
						for="showcase-max-items"
						class="block text-xs font-bold uppercase tracking-wider text-gray-700"
					>
						Max Featured Items
					</label>
					<input
						id="showcase-max-items"
						{...showcaseRf.fields.maxItems.as('text')}
						value={effectiveMaxItems}
						oninput={(e) => {
							cfgMaxItems = (e.currentTarget as HTMLInputElement).value;
							void showcaseRf.validate().catch(() => {});
						}}
						class="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
					/>
					{#each showcaseRf.fields.maxItems.issues() as issue, idx (idx)}
						<p class="text-xs text-rose-600">{issue.message}</p>
					{/each}
				</div>

				<div class="space-y-1.5">
					<label
						for="showcase-title"
						class="block text-xs font-bold uppercase tracking-wider text-gray-700"
					>
						Showcase Section Title
					</label>
					<input
						id="showcase-title"
						{...showcaseRf.fields.title.as('text')}
						value={effectiveTitle}
						oninput={(e) => {
							cfgTitle = (e.currentTarget as HTMLInputElement).value;
							void showcaseRf.validate().catch(() => {});
						}}
						class="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
					/>
					{#each showcaseRf.fields.title.issues() as issue, idx (idx)}
						<p class="text-xs text-rose-600">{issue.message}</p>
					{/each}
				</div>

				<div class="md:col-span-2 lg:col-span-3 space-y-1.5">
					<label
						for="showcase-subtitle"
						class="block text-xs font-bold uppercase tracking-wider text-gray-700"
					>
						Showcase Subtitle
					</label>
					<input
						id="showcase-subtitle"
						{...showcaseRf.fields.subtitle.as('text')}
						value={effectiveSubtitle}
						oninput={(e) => {
							cfgSubtitle = (e.currentTarget as HTMLInputElement).value;
							void showcaseRf.validate().catch(() => {});
						}}
						class="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
					/>
					{#each showcaseRf.fields.subtitle.issues() as issue, idx (idx)}
						<p class="text-xs text-rose-600">{issue.message}</p>
					{/each}
				</div>

				<div class="flex items-end justify-end">
					<Button
						type="submit"
						variant="primary"
						disabled={!!showcaseRf.pending}
						class="w-full justify-center"
					>
						{showcaseRf.pending ? 'Saving...' : 'Save Showcase Settings'}
					</Button>
				</div>
			</form>
		</div>
	{/if}

	{#if showcaseData && (showcaseData.config.isActive || isOperator)}
		<GoalShowcaseSection
			config={showcaseData.config}
			campaigns={showcaseData.campaigns}
			{isOperator}
			onOpenConfig={() => (showShowcaseConfigPanel = !showShowcaseConfigPanel)}
			onToggleShowcase={handleToggleShowcase}
		/>
	{/if}

	<!-- 2. Search, Filter & Ordering Toolbar -->
	<div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
		<div class="flex flex-col lg:flex-row lg:items-center gap-3">
			<!-- Keyword Search Input (No name attribute!) -->
			<div class="relative flex-1">
				<Search
					class="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
				/>
				<input
					type="search"
					bind:value={search}
					oninput={() => (pageNum = 1)}
					placeholder={m.search_campaigns()}
					class="w-full rounded-xl border border-gray-300 bg-gray-50/60 pl-10 pr-9 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
				/>
				{#if search}
					<button
						type="button"
						onclick={() => {
							search = '';
							pageNum = 1;
						}}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						aria-label="Clear search"
					>
						<X class="w-4 h-4" />
					</button>
				{/if}
			</div>

			<!-- FilterMenu for Tags, Locations, Contribution Plugin, Campaign Status -->
			<div class="flex flex-wrap items-center gap-2">
				<FilterMenu groups={filterGroups} bind:filters />

				<button
					type="button"
					onclick={() => (sortOrder = sortOrder === 'desc' ? 'asc' : 'desc')}
					class="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
					title="Toggle sort direction"
				>
					<ArrowUpDown class="w-3.5 h-3.5 text-emerald-600" />
					{sortOrder === 'desc' ? m.descending() : m.ascending()}
				</button>
			</div>
		</div>

		<!-- Ordering Selector Pills -->
		<div class="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
			<span class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 mr-1">
				<SlidersHorizontal class="w-3.5 h-3.5" />
				Order By:
			</span>
			{#each sortOptions as option (option.id)}
				{@const Icon = option.icon}
				<button
					type="button"
					onclick={() => {
						sortBy = option.id;
						pageNum = 1;
					}}
					class="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all {sortBy ===
					option.id
						? 'bg-emerald-600 text-white shadow-sm'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					<Icon class="w-3.5 h-3.5" />
					{option.label}
				</button>
			{/each}
		</div>

		<!-- Active Filter Chips -->
		<ActiveFilterChips groups={filterGroups} bind:filters />
	</div>

	<!-- 3. Campaign Overview Cards Grid -->
	{#if campaignsQuery.loading && !campaignsQuery.current}
		<LoadingSection message="Loading goal campaigns..." />
	{:else if campaignsQuery.error}
		<ErrorSection
			headline="Could not load goal campaigns"
			message={campaignsQuery.error?.message || 'An unexpected error occurred'}
			onRetry={() => void campaignsQuery.refresh()}
		/>
	{:else if campaigns.length === 0}
		<EmptyState
			icon={Search}
			title="No matching goal campaigns found"
			description={m.try_adjusting_filters()}
		>
			<div class="mt-4 flex flex-wrap justify-center gap-3">
				<Button
					variant="outline"
					onclick={() => {
						search = '';
						filters = {};
						sortBy = 'popularity';
						pageNum = 1;
					}}
				>
					Reset Search & Filters
				</Button>
				<Button href="/goals/new" variant="primary">
					<Plus class="w-4 h-4 mr-1.5" />
					Launch a New Campaign
				</Button>
			</div>
		</EmptyState>
	{:else}
		<div class="space-y-6">
			<div class="flex items-center justify-between text-xs text-gray-500 px-1">
				<span>
					Showing <strong class="text-gray-900">{campaigns.length}</strong> of
					<strong class="text-gray-900">{totalItems}</strong> campaigns
				</span>
				<span>
					Sorted by <strong class="text-gray-800">{sortOptions.find((o) => o.id === sortBy)?.label}</strong>
					({sortOrder === 'desc' ? 'Highest / Newest first' : 'Lowest / Oldest first'})
				</span>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each campaigns as campaign (campaign.id)}
					<GoalOverviewCard
						{campaign}
						featured={campaign.isShowcased}
						{isOperator}
						onToggleShowcase={handleToggleShowcase}
					/>
				{/each}
			</div>

			{#if totalItems > limit}
				{@const totalPages = Math.max(1, Math.ceil(totalItems / limit))}
				<div class="pt-4 flex items-center justify-center gap-3">
					<Button
						variant="outline"
						disabled={pageNum <= 1}
						onclick={() => (pageNum = Math.max(1, pageNum - 1))}
					>
						Previous
					</Button>
					<span class="text-xs font-semibold text-gray-700">
						Page {pageNum} of {totalPages}
					</span>
					<Button
						variant="outline"
						disabled={pageNum >= totalPages}
						onclick={() => (pageNum = Math.min(totalPages, pageNum + 1))}
					>
						Next
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</div>
