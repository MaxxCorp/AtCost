<script lang="ts">
	import * as m from '#lib/paraglide/messages.js';
	import {
		ShieldCheck,
		Sparkles,
		CreditCard,
		CheckCircle2,
		XCircle,
		Pin,
		PinOff,
		MapPin,
		Tag as TagIcon,
		ArrowLeft,
		AlertTriangle,
		ExternalLink,
		Lock
	} from '@lucide/svelte';
	import {
		Button,
		LoadingSection,
		ErrorSection,
		EmptyState
	} from '@ac/ui';
	import {
		listGoalCampaigns,
		getShowcaseCampaigns,
		getCurrentSessionUser,
		switchDevPersona
	} from '../list.remote.js';
	import {
		reviewCommunityGoalCampaign,
		updateShowcaseConfig,
		toggleCampaignShowcase
	} from '../showcase.remote.js';
	import { getPaymentProviderProposals } from '../[id]/read.remote.js';
	import {
		reviewGoalCampaignSchema,
		updateGoalShowcaseConfigSchema,
		computeGoalProgressSummary,
		type GoalCampaign,
		type GoalShowcaseSelectionMode
	} from '@ac/validations';
	import { getContributionPlugin } from '#lib/plugins/registry.js';
	import { dev } from '$app/env';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';

	const campaignsQuery = listGoalCampaigns({
		limit: 50,
		sortField: 'createdAt',
		sortOrder: 'desc'
	});
	const showcaseQuery = getShowcaseCampaigns({});
	const sessionQuery = getCurrentSessionUser({});
	const paymentProposalsQuery = getPaymentProviderProposals({});

	afterNavigate(({ from }) => {
		if (from) {
			void campaignsQuery.refresh();
			void showcaseQuery.refresh();
			void paymentProposalsQuery.refresh();
			void sessionQuery.refresh();
		}
	});

	const currentUser = $derived(sessionQuery.current?.user ?? null);
	const isOperator = $derived(sessionQuery.current?.isOperator ?? false);
	const allCampaigns = $derived(campaignsQuery.current?.data ?? []);
	const showcaseData = $derived(showcaseQuery.current);
	const paymentProposals = $derived(paymentProposalsQuery.current ?? []);

	let activeTab = $state<'approvals' | 'showcase' | 'payments'>('approvals');

	const pendingCommunityCampaigns = $derived(
		allCampaigns.filter(
			(c: GoalCampaign) =>
				c.status === 'pending_approval' ||
				c.approvalStatus === 'pending'
		)
	);

	const publishedCampaigns = $derived(
		allCampaigns.filter(
			(c: GoalCampaign) => c.status === 'published' || c.status === 'completed_successful'
		)
	);

	let reviewDecisionByCampaign = $state<Record<string, 'approved' | 'rejected'>>({});

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

	async function handleTogglePin(campaign: GoalCampaign) {
		try {
			await toggleCampaignShowcase({
				campaignId: campaign.id,
				isShowcased: !campaign.isShowcased
			});
			await Promise.all([campaignsQuery.refresh(), showcaseQuery.refresh()]);
			toast.success(
				campaign.isShowcased
					? `Unpinned "${campaign.title}" from showcase`
					: `Pinned "${campaign.title}" to operator showcase`
			);
		} catch (err: any) {
			toast.error(err?.message || 'Failed to update showcase pin');
		}
	}

	async function handleSwitchToOperator() {
		try {
			await switchDevPersona('operator');
			await Promise.all([
				sessionQuery.refresh(),
				campaignsQuery.refresh(),
				showcaseQuery.refresh()
			]);
			toast.success('Switched to Operator persona');
		} catch (err: any) {
			toast.error(err?.message || 'Failed to switch persona');
		}
	}
</script>

<svelte:head>
	<title>Operator Governance, Approvals & Showcase | AC-Goals</title>
</svelte:head>

<div class="space-y-8 pb-16">
	<!-- Top Navigation & Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="space-y-1">
			<a
				href="/goals"
				class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-emerald-700"
			>
				<ArrowLeft class="w-3.5 h-3.5" />
				Back to Campaign Discovery
			</a>
			<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 pt-1">
				<ShieldCheck class="w-4 h-4" />
				Operator Governance Hub
			</div>
			<h1 class="text-3xl font-black text-gray-900 tracking-tight">
				Community Approvals, Showcase & Payment Architecture
			</h1>
		</div>
	</div>

	{#if sessionQuery.loading && !sessionQuery.current}
		<LoadingSection message="Verifying operator privileges..." />
	{:else if !currentUser || !isOperator}
		<div class="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center space-y-5 shadow-sm">
			<div class="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
				<Lock class="w-7 h-7" />
			</div>
			<div class="space-y-2 max-w-xl mx-auto">
				<h2 class="text-xl font-bold text-gray-900">
					{!currentUser ? 'Authentication Required' : 'Operator or Admin Privileges Required'}
				</h2>
				<p class="text-sm text-gray-600 leading-relaxed">
					{!currentUser
						? 'Please sign in with an Operator or Administrator account to review pending campaigns and manage showcase settings.'
						: 'Only platform operators and administrators can access the Approval Queue, Showcase Settings, and Payment Governance.'}
				</p>
			</div>
			<div class="flex flex-wrap items-center justify-center gap-3 pt-1">
				{#if !currentUser}
					<Button
						href="/login?redirectTo={encodeURIComponent(page.url.pathname)}"
						variant="primary"
					>
						Sign In as Operator
					</Button>
				{:else}
					<Button href="/goals" variant="outline">
						Back to Campaigns
					</Button>
				{/if}
				{#if dev}
					<Button variant="secondary" onclick={handleSwitchToOperator}>
						Switch to Operator (Dev)
					</Button>
				{/if}
			</div>
		</div>
	{:else}
	<!-- Governance Tabs Navigation -->
	<div class="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
		<button
			type="button"
			onclick={() => (activeTab = 'approvals')}
			class="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all {activeTab ===
			'approvals'
				? 'bg-emerald-600 text-white shadow-sm'
				: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}"
		>
			<ShieldCheck class="w-4 h-4" />
			Community Approval Queue
			<span
				class="ml-1 rounded-full px-2 py-0.5 text-xs font-extrabold {activeTab === 'approvals'
					? 'bg-white/20 text-white'
					: 'bg-amber-100 text-amber-800'}"
			>
				{pendingCommunityCampaigns.length}
			</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'showcase')}
			class="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all {activeTab ===
			'showcase'
				? 'bg-emerald-600 text-white shadow-sm'
				: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}"
		>
			<Sparkles class="w-4 h-4" />
			Showcase Configuration & Pinning
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'payments')}
			class="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all {activeTab ===
			'payments'
				? 'bg-emerald-600 text-white shadow-sm'
				: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}"
		>
			<CreditCard class="w-4 h-4" />
			External Payment Provider Proposal
		</button>
	</div>

	<!-- TAB 1: Community Approval Queue -->
	{#if activeTab === 'approvals'}
		<div class="space-y-8">
			{#if campaignsQuery.loading && !campaignsQuery.current}
				<LoadingSection message="Loading community approval queue..." />
			{:else if campaignsQuery.error}
				<ErrorSection
					headline="Failed to load approval queue"
					message={campaignsQuery.error?.message || 'Unable to load campaigns'}
					onRetry={() => void campaignsQuery.refresh()}
				/>
			{:else if pendingCommunityCampaigns.length === 0}
				<EmptyState
					icon={CheckCircle2}
					title="All Community-Supplied Campaigns Reviewed!"
					description="There are currently no community goal campaigns waiting for operator approval."
				/>
			{:else}
				<div class="space-y-6">
					{#each pendingCommunityCampaigns as campaign (campaign.id)}
						{@const reviewRf = reviewCommunityGoalCampaign.for(campaign.id)}
						{@const progress = computeGoalProgressSummary(campaign)}
						{@const plugin = getContributionPlugin(campaign.contributionType)}
						{@const currentDecision = reviewDecisionByCampaign[campaign.id] ?? 'approved'}

						<div class="rounded-2xl border-2 border-amber-300 bg-white p-6 shadow-sm space-y-5">
							<div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b border-gray-100 pb-4">
								<div class="space-y-2">
									<div class="flex flex-wrap items-center gap-2">
										<span class="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-xs font-bold text-amber-900">
											<AlertTriangle class="w-3.5 h-3.5" />
											Pending Operator Approval
										</span>
										<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold {plugin.badgeBgClass} {plugin.badgeTextClass}">
											Plugin: {plugin.shortName}
										</span>
										<span class="text-xs text-gray-500">
											Submitted by <strong class="text-gray-800">{campaign.creatorName || 'Community Member'}</strong>
										</span>
									</div>

									<h2 class="text-xl font-bold text-gray-900">
										<a href="/goals/{campaign.id}" class="hover:text-emerald-700 hover:underline">
											{campaign.title}
										</a>
									</h2>

									<p class="text-sm font-medium text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-200">
										<strong class="text-gray-900">Executive Summary:</strong>
										{campaign.executiveSummary}
									</p>
								</div>

								<a
									href="/goals/{campaign.id}"
									class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shrink-0"
								>
									Inspect Full Campaign
									<ExternalLink class="w-3.5 h-3.5" />
								</a>
							</div>

							<!-- Primary & Stretch Goals Preview -->
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-1">
									<span class="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
										Primary Goal Target
									</span>
									<p class="text-sm font-bold text-gray-900">
										{progress.primaryStage.title} —
										{plugin.formatValue(
											progress.primaryStage.targetAmount,
											campaign.currency,
											campaign.unitLabel
										)}
									</p>
									{#if progress.primaryStage.description}
										<p class="text-xs text-gray-600">{progress.primaryStage.description}</p>
									{/if}
								</div>

								<div class="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-1.5">
									<span class="text-[11px] font-bold uppercase tracking-wider text-teal-800">
										Stretch Goals ({progress.stretchStages.length})
									</span>
									{#if progress.stretchStages.length === 0}
										<p class="text-xs text-gray-500">No stretch goals configured.</p>
									{:else}
										<ul class="space-y-1 text-xs text-gray-700">
											{#each progress.stretchStages as st (st.sortOrder)}
												<li class="flex items-center justify-between gap-2">
													<span class="font-semibold truncate">{st.title}</span>
													<span class="font-bold text-teal-800 shrink-0">
														{plugin.formatValue(st.targetAmount, campaign.currency, campaign.unitLabel)}
													</span>
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							</div>

							<!-- Tags & Locations -->
							<div class="flex flex-wrap items-center gap-2 text-xs">
								{#each campaign.tags ?? [] as tagItem (tagItem.id)}
									<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
										<TagIcon class="w-3 h-3 text-gray-500" />
										{tagItem.name}
									</span>
								{/each}
								{#each campaign.locations ?? [] as loc (loc.id)}
									<span class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
										<MapPin class="w-3 h-3 text-blue-500" />
										{loc.name}{loc.city ? ` (${loc.city})` : ''}
									</span>
								{/each}
							</div>

							<!-- Operator Decision Form (No raw name attributes!) -->
							<form
								{...reviewRf
									.preflight(reviewGoalCampaignSchema)
									.enhance(async ({ submit }) => {
										try {
											await submit();
											await Promise.all([
												campaignsQuery.refresh(),
												showcaseQuery.refresh()
											]);
											toast.success(
												currentDecision === 'approved'
													? `Approved & published "${campaign.title}"`
													: `Returned "${campaign.title}" to draft with review notes`
											);
										} catch (err: any) {
											toast.error(err?.message || 'Failed to submit review decision');
										}
									})}
								class="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 border-t border-gray-100 pt-4"
							>
								{#if campaign.id}
									<input {...reviewRf.fields.campaignId.as('hidden', campaign.id)} />
								{/if}
								{#if currentDecision}
									<input {...reviewRf.fields.decision.as('hidden', currentDecision)} />
								{/if}

								<div class="flex-1 space-y-1">
									<label
										for="approval-notes-{campaign.id}"
										class="block text-xs font-bold text-gray-700"
									>
										Operator Review Notes (Optional)
									</label>
									<input
										id="approval-notes-{campaign.id}"
										{...reviewRf.fields.approvalNotes.as('text')}
										placeholder="Add feedback or verification notes for the campaign owner..."
										class="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900"
									/>
								</div>

								<div class="flex items-center gap-2 shrink-0">
									<button
										type="submit"
										disabled={!isOperator}
										onclick={() => (reviewDecisionByCampaign[campaign.id] = 'rejected')}
										class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
									>
										<XCircle class="w-4 h-4" />
										Reject to Draft
									</button>
									<button
										type="submit"
										disabled={!isOperator}
										onclick={() => (reviewDecisionByCampaign[campaign.id] = 'approved')}
										class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
									>
										<CheckCircle2 class="w-4 h-4" />
										Approve & Publish
									</button>
								</div>
							</form>
						</div>
					{/each}
				</div>
			{/if}
		</div>

	<!-- TAB 2: Showcase Configuration & Pinning -->
	{:else if activeTab === 'showcase'}
		<div class="space-y-8">
			<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
				<div>
					<h2 class="text-lg font-bold text-gray-900">
						Top Showcase Configuration
					</h2>
					<p class="text-xs text-gray-600">
						Configure whether the top Showcase section is active and how campaigns are selected (Operator Choice, Popularity, Recency, or Mixed).
					</p>
				</div>

				<form
					{...showcaseRf
						.preflight(updateGoalShowcaseConfigSchema)
						.enhance(async ({ submit }) => {
							try {
								await submit();
								await showcaseQuery.refresh();
								toast.success('Showcase configuration updated');
							} catch (err: any) {
								toast.error(err?.message || 'Failed to update showcase settings');
							}
						})}
					class="grid grid-cols-1 md:grid-cols-2 gap-4"
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
							Showcase Section Status
						</span>
						<div class="flex gap-2">
							<button
								type="button"
								onclick={() => (cfgIsActive = true)}
								class="flex-1 rounded-xl border px-3 py-2 text-xs font-bold {effectiveIsActive
									? 'border-emerald-600 bg-emerald-600 text-white'
									: 'border-gray-300 bg-white text-gray-700'}"
							>
								Active (Visible on /goals)
							</button>
							<button
								type="button"
								onclick={() => (cfgIsActive = false)}
								class="flex-1 rounded-xl border px-3 py-2 text-xs font-bold {!effectiveIsActive
									? 'border-rose-600 bg-rose-600 text-white'
									: 'border-gray-300 bg-white text-gray-700'}"
							>
								Inactive (Hidden)
							</button>
						</div>
					</div>

					<div class="space-y-1.5">
						<span class="block text-xs font-bold uppercase tracking-wider text-gray-700">
							Selection Strategy
						</span>
						<div class="grid grid-cols-2 gap-2">
							{#each [
								{ id: 'mixed', label: 'Mixed (Operator + Popularity + Recency)' },
								{ id: 'operator_choice', label: 'Operator Choice Only' },
								{ id: 'popularity', label: 'Popularity (Visits & Participation)' },
								{ id: 'recency', label: 'Creation Recency' }
							] as mode (mode.id)}
								<button
									type="button"
									onclick={() => (cfgSelectionMode = mode.id as GoalShowcaseSelectionMode)}
									class="rounded-xl border px-3 py-2 text-left text-xs font-semibold {effectiveSelectionMode ===
									mode.id
										? 'border-emerald-600 bg-emerald-50 text-emerald-950'
										: 'border-gray-200 bg-white text-gray-700'}"
								>
									{mode.label}
								</button>
							{/each}
						</div>
					</div>

					<div class="space-y-1.5">
						<label for="gov-showcase-title" class="block text-xs font-bold text-gray-700">
							Showcase Headline
						</label>
						<input
							id="gov-showcase-title"
							{...showcaseRf.fields.title.as('text')}
							value={effectiveTitle}
							oninput={(e) => (cfgTitle = (e.currentTarget as HTMLInputElement).value)}
							class="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
						/>
					</div>

					<div class="space-y-1.5">
						<label for="gov-showcase-max" class="block text-xs font-bold text-gray-700">
							Max Featured Campaigns
						</label>
						<input
							id="gov-showcase-max"
							{...showcaseRf.fields.maxItems.as('text')}
							value={effectiveMaxItems}
							oninput={(e) => (cfgMaxItems = (e.currentTarget as HTMLInputElement).value)}
							class="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
						/>
					</div>

					<div class="md:col-span-2 space-y-1.5">
						<label for="gov-showcase-sub" class="block text-xs font-bold text-gray-700">
							Showcase Subtitle
						</label>
						<input
							id="gov-showcase-sub"
							{...showcaseRf.fields.subtitle.as('text')}
							value={effectiveSubtitle}
							oninput={(e) => (cfgSubtitle = (e.currentTarget as HTMLInputElement).value)}
							class="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
						/>
					</div>

					<div class="md:col-span-2 flex justify-end">
						<Button type="submit" variant="primary" disabled={!isOperator}>
							Save Showcase Configuration
						</Button>
					</div>
				</form>
			</div>

			<!-- Operator Pinning List -->
			<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
				<h3 class="text-base font-bold text-gray-900">
					Pin / Unpin Campaigns for Operator Choice Showcase
				</h3>
				<div class="divide-y divide-gray-100">
					{#each publishedCampaigns as camp (camp.id)}
						<div class="py-3 flex items-center justify-between gap-4">
							<div>
								<a href="/goals/{camp.id}" class="font-bold text-sm text-gray-900 hover:text-emerald-700">
									{camp.title}
								</a>
								<p class="text-xs text-gray-500 line-clamp-1">{camp.executiveSummary}</p>
							</div>
							<button
								type="button"
								disabled={!isOperator}
								onclick={() => void handleTogglePin(camp)}
								class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-colors {camp.isShowcased
									? 'border-amber-300 bg-amber-100 text-amber-900'
									: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
							>
								{#if camp.isShowcased}
									<PinOff class="w-3.5 h-3.5" />
									Pinned (Click to Unpin)
								{:else}
									<Pin class="w-3.5 h-3.5" />
									Pin to Showcase
								{/if}
							</button>
						</div>
					{/each}
				</div>
			</div>
		</div>

	<!-- TAB 3: External Payment Provider Proposal -->
	{:else if activeTab === 'payments'}
		<div class="space-y-6">
			<div class="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/50 p-6 shadow-sm space-y-3">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-extrabold text-white uppercase">
					<CreditCard class="w-3.5 h-3.5" />
					External Payment Management Provider Proposal
				</span>
				<h2 class="text-2xl font-black text-gray-900">
					Recommended Architecture: Stripe Connect + Checkout / PaymentIntents
				</h2>
				<p class="text-sm text-gray-700 leading-relaxed max-w-4xl">
					For financial goal campaigns (Kickstarter-style primary & stretch goals), we propose <strong>Stripe Connect + Checkout / PaymentIntents</strong> as the primary external payment management provider, with <strong>Mollie Connect</strong> (EU/DE regional) and <strong>Adyen for Platforms</strong> (enterprise high-volume) supported through the same provider adapter in <code>src/lib/server/payments/provider.ts</code>.
				</p>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{#each paymentProposals as p (p.id)}
					<div
						class="flex flex-col justify-between rounded-2xl border p-6 shadow-sm {p.recommended
							? 'border-2 border-emerald-500 bg-white ring-2 ring-emerald-500/10'
							: 'border-gray-200 bg-white'}"
					>
						<div class="space-y-4">
							<div class="flex items-start justify-between gap-2">
								<div>
									<h3 class="text-lg font-black text-gray-900">{p.name}</h3>
								</div>
								{#if p.recommended}
									<span class="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-extrabold text-emerald-900">
										Recommended
									</span>
								{/if}
							</div>

							<p class="text-xs text-gray-700 leading-relaxed">{p.summary}</p>

							<div class="rounded-xl bg-gray-50 p-3 border border-gray-200 space-y-1">
								<span class="text-[11px] font-bold uppercase tracking-wider text-gray-700">
									Escrow & Stretch Goal Support
								</span>
								<p class="text-xs text-gray-600 leading-relaxed">
									{p.escrowAndCrowdfundingSupport}
								</p>
							</div>

							<div class="space-y-1.5">
								<span class="text-[11px] font-bold uppercase tracking-wider text-gray-700">
									Integration & Settlement Flow
								</span>
								<ul class="space-y-1 text-xs text-gray-600 list-disc pl-4">
									{#each p.integrationFlow as bullet (bullet)}
										<li>{bullet}</li>
									{/each}
								</ul>
							</div>
						</div>

						<div class="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
							<div><strong>Fee Structure:</strong> {p.feeStructure}</div>
							<div><strong>Methods:</strong> {p.euPaymentMethods.join(', ')}</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
	{/if}
</div>
