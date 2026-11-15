<script lang="ts">
	import * as m from '#lib/paraglide/messages.js';
	import {
		Target,
		Plus,
		ShieldCheck,
		MapPin,
		Tags,
		ArrowRight,
		Sparkles,
		Flame,
		Users,
		CheckCircle2
	} from '@lucide/svelte';
	import { Button, LoadingSection, ErrorSection } from '@ac/ui';
	import {
		getShowcaseCampaigns,
		getCurrentSessionUser
	} from './goals/list.remote.js';
	import { toggleCampaignShowcase } from './goals/showcase.remote.js';
	import GoalShowcaseSection from '#lib/components/goals/GoalShowcaseSection.svelte';
	import type { GoalCampaign } from '@ac/validations';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	const showcaseQuery = getShowcaseCampaigns({});
	const sessionQuery = getCurrentSessionUser({});

	const isOperator = $derived(sessionQuery.current?.isOperator ?? false);
	const currentUser = $derived(sessionQuery.current?.user ?? null);
	const showcaseData = $derived(showcaseQuery.current);

	async function handleToggleShowcase(campaign: GoalCampaign) {
		try {
			await toggleCampaignShowcase({
				campaignId: campaign.id,
				isShowcased: !campaign.isShowcased
			});
			await showcaseQuery.refresh();
			toast.success(
				campaign.isShowcased
					? 'Removed campaign from operator showcase'
					: 'Pinned campaign to operator showcase'
			);
		} catch (err: any) {
			toast.error(err?.message || 'Failed to update showcase status');
		}
	}
</script>

<svelte:head>
	<title>AC-Goals | Community & Operator Goal Campaigns</title>
</svelte:head>

<div class="space-y-12 pb-16">
	<!-- Executive Hero Header -->
	<section
		class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white shadow-2xl border border-emerald-800/40"
	>
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.22),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.18),transparent_50%)] pointer-events-none"
		></div>

		<div class="relative z-10 px-6 py-12 sm:px-12 sm:py-16 lg:py-20">
			<div class="max-w-4xl space-y-6">
				<div class="flex flex-wrap items-center gap-2.5">
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200"
					>
						<Sparkles class="w-3.5 h-3.5 text-emerald-300" />
						Kickstarter + Change.org Hybrid Platform
					</span>
					{#if currentUser}
						<span
							class="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-medium text-emerald-100"
						>
							<CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
							Signed in as {currentUser.name || currentUser.email}
							({isOperator ? 'Operator' : 'Community Member'})
						</span>
					{/if}
				</div>

				<h1 class="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]">
					Mobilize Support. Unlock Stretch Goals. Deliver Real Impact.
				</h1>

				<p class="text-lg sm:text-xl text-emerald-100/90 max-w-3xl leading-relaxed">
					Launch and back multi-stage goal campaigns powered by modular contribution plugins:
					<strong class="text-white font-semibold">Financial Crowdfunding</strong>,
					<strong class="text-white font-semibold">Civic Votes & Petitions</strong>, and
					<strong class="text-white font-semibold">Participant & Volunteer Sign-ups</strong>.
				</p>

				<div class="flex flex-wrap items-center gap-4 pt-2">
					<Button
						href="/goals"
						variant="primary"
						class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg shadow-emerald-950/50 inline-flex items-center gap-2 text-base"
					>
						<Flame class="w-5 h-5" />
						Explore All Campaigns
						<ArrowRight class="w-4 h-4" />
					</Button>

					<Button
						href="/goals/new"
						variant="secondary"
						class="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold px-6 py-3 rounded-xl inline-flex items-center gap-2 text-base"
					>
						<Plus class="w-5 h-5" />
						Launch a Goal Campaign
					</Button>

					{#if isOperator}
						<Button
							href="/goals/approvals"
							variant="ghost"
							class="text-emerald-200 hover:text-white hover:bg-white/10 font-medium px-4 py-3 rounded-xl inline-flex items-center gap-2 text-sm"
						>
							<ShieldCheck class="w-4 h-4" />
							Operator Governance & Approvals
						</Button>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<!-- Top Showcase Section (when active or for operators) -->
	{#if showcaseQuery.loading && !showcaseData}
		<LoadingSection message="Loading featured goal showcase..." />
	{:else if showcaseQuery.error}
		<ErrorSection
			headline="Failed to load showcase"
			message={showcaseQuery.error?.message || 'Unable to load showcase campaigns'}
			onRetry={() => void showcaseQuery.refresh()}
		/>
	{:else if showcaseData && (showcaseData.config.isActive || isOperator) && showcaseData.campaigns.length > 0}
		<section class="space-y-4">
			<GoalShowcaseSection
				config={showcaseData.config}
				campaigns={showcaseData.campaigns}
				{isOperator}
				onOpenConfig={() => void goto('/goals/approvals')}
				onToggleShowcase={handleToggleShowcase}
			/>
			<div class="flex justify-end">
				<Button
					href="/goals"
					variant="outline"
					class="inline-flex items-center gap-2 font-semibold"
				>
					Explore All Goal Campaigns
					<ArrowRight class="w-4 h-4" />
				</Button>
			</div>
		</section>
	{/if}

	<!-- Quick Feature Navigation Cards -->
	<section class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-bold text-gray-900">Platform Modules & Governance</h2>
				<p class="text-sm text-gray-600">
					Navigate across goal discovery, campaign creation, operator approvals, locations, and categorization tags.
				</p>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			<a
				href="/goals"
				class="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-emerald-400"
			>
				<div class="space-y-3">
					<div
						class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors"
					>
						<Target class="h-6 w-6" />
					</div>
					<h3 class="text-lg font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
						{m.feature_goals_title()}
					</h3>
					<p class="text-sm text-gray-600 leading-relaxed">
						{m.feature_goals_description()}
					</p>
				</div>
				<div class="mt-6 flex items-center text-sm font-semibold text-emerald-600">
					Browse & Contribute
					<ArrowRight class="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
				</div>
			</a>

			<a
				href="/goals/new"
				class="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-teal-400"
			>
				<div class="space-y-3">
					<div
						class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors"
					>
						<Plus class="h-6 w-6" />
					</div>
					<h3 class="text-lg font-bold text-gray-900 group-hover:text-teal-700 transition-colors">
						Launch a Campaign
					</h3>
					<p class="text-sm text-gray-600 leading-relaxed">
						Create an operator campaign or submit a community-supplied goal with primary and stretch stages.
					</p>
				</div>
				<div class="mt-6 flex items-center text-sm font-semibold text-teal-600">
					Start New Campaign
					<ArrowRight class="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
				</div>
			</a>

			{#if isOperator}
				<a
					href="/goals/approvals"
					class="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-amber-400"
				>
					<div class="space-y-3">
						<div
							class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors"
						>
							<ShieldCheck class="h-6 w-6" />
						</div>
						<h3 class="text-lg font-bold text-gray-900 group-hover:text-amber-700 transition-colors">
							{m.feature_approvals_title()}
						</h3>
						<p class="text-sm text-gray-600 leading-relaxed">
							{m.feature_approvals_description()} Includes external payment provider architecture.
						</p>
					</div>
					<div class="mt-6 flex items-center text-sm font-semibold text-amber-600">
						Open Governance Hub
						<ArrowRight class="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
					</div>
				</a>

				<a
					href="/locations"
					class="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-blue-400"
				>
					<div class="space-y-3">
						<div
							class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"
						>
							<MapPin class="h-6 w-6" />
						</div>
						<h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
							{m.feature_locations_title()}
						</h3>
						<p class="text-sm text-gray-600 leading-relaxed">
							Manage physical hubs, neighborhoods, and rooms associated with goal campaigns.
						</p>
					</div>
					<div class="mt-6 flex items-center text-sm font-semibold text-blue-600">
						Manage Locations
						<ArrowRight class="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
					</div>
				</a>

				<a
					href="/tags"
					class="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-purple-400"
				>
					<div class="space-y-3">
						<div
							class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors"
						>
							<Tags class="h-6 w-6" />
						</div>
						<h3 class="text-lg font-bold text-gray-900 group-hover:text-purple-700 transition-colors">
							{m.feature_tags_title()}
						</h3>
						<p class="text-sm text-gray-600 leading-relaxed">
							Organize campaigns with categorized tags for fast filtering and topic discovery.
						</p>
					</div>
					<div class="mt-6 flex items-center text-sm font-semibold text-purple-600">
						Explore Tags
						<ArrowRight class="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
					</div>
				</a>
			{/if}

			<div
				class="flex flex-col justify-between rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-teal-50/50 p-6"
			>
				<div class="space-y-3">
					<div
						class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white"
					>
						<Users class="h-6 w-6" />
					</div>
					<h3 class="text-lg font-bold text-gray-900">
						Encrypted Contact Segregation & GDPR
					</h3>
					<p class="text-sm text-gray-600 leading-relaxed">
						Participant PII is segregated in AES-256-GCM PKI envelopes with HMAC blind indexes, GDPR Art. 17 self-service crypto-shredding, Data Privacy, and Imprint disclosures.
					</p>
				</div>
				<div class="mt-6 flex flex-wrap gap-2">
					<Button href="/gdpr-self-service" variant="primary" class="flex-1 justify-center text-xs">
						GDPR Self-Service
					</Button>
					<Button href="/GDPR" variant="outline" class="flex-1 justify-center text-xs">
						Data Privacy
					</Button>
					<Button href="/imprint" variant="outline" class="flex-1 justify-center text-xs">
						Imprint
					</Button>
				</div>
			</div>
		</div>
	</section>
</div>
