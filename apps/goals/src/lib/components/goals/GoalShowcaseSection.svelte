<script lang="ts">
	import type { GoalCampaign, GoalShowcaseConfig } from '@ac/validations';
	import GoalOverviewCard from './GoalOverviewCard.svelte';
	import { Sparkles, Settings2, Flame, Clock, Star, Layers } from '@lucide/svelte';

	interface Props {
		config: GoalShowcaseConfig;
		campaigns: GoalCampaign[];
		isOperator?: boolean;
		onOpenConfig?: () => void;
		onToggleShowcase?: (campaign: GoalCampaign) => void;
	}

	let {
		config,
		campaigns = [],
		isOperator = false,
		onOpenConfig = undefined,
		onToggleShowcase = undefined
	}: Props = $props();

	const modeBadge = $derived.by(() => {
		switch (config.selectionMode) {
			case 'operator_choice':
				return { label: 'Operator Choice', icon: Star };
			case 'popularity':
				return { label: 'Popularity (Visits & Backing)', icon: Flame };
			case 'recency':
				return { label: 'Recent Launches', icon: Clock };
			default:
				return { label: 'Mixed: Operator + Popularity + Recency', icon: Layers };
		}
	});
</script>

{#if config.isActive && campaigns.length > 0}
	<section
		class="rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/60 p-6 sm:p-8 shadow-xs space-y-6"
	>
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div class="space-y-1.5">
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-extrabold tracking-wide text-white uppercase shadow-2xs"
					>
						<Sparkles class="h-3.5 w-3.5" />
						Featured Showcase
					</span>

					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-900"
					>
						{#if modeBadge.icon}
							{@const ModeIcon = modeBadge.icon}
							<ModeIcon class="h-3.5 w-3.5 text-indigo-600" />
						{/if}
						{modeBadge.label}
					</span>
				</div>

				<h2 class="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
					{config.title || 'Featured Goal Campaigns'}
				</h2>
				{#if config.subtitle}
					<p class="max-w-3xl text-sm sm:text-base text-slate-600">
						{config.subtitle}
					</p>
				{/if}
			</div>

			{#if isOperator && onOpenConfig}
				<button
					type="button"
					onclick={onOpenConfig}
					class="inline-flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-indigo-950 shadow-2xs transition-colors hover:bg-indigo-50"
				>
					<Settings2 class="h-4 w-4 text-indigo-600" />
					Configure Showcase
				</button>
			{/if}
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			{#each campaigns as campaign (campaign.id)}
				<GoalOverviewCard
					{campaign}
					featured={true}
					{isOperator}
					{onToggleShowcase}
				/>
			{/each}
		</div>
	</section>
{:else if isOperator}
	<div
		class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-3.5 text-xs text-slate-600"
	>
		<div class="flex items-center gap-2">
			<Sparkles class="h-4 w-4 text-slate-400" />
			<span>
				{#if !config.isActive}
					<strong>Featured Showcase is currently hidden</strong> by operator configuration.
				{:else}
					<strong>Featured Showcase is active</strong>, but no published campaigns match the current showcase criteria yet.
				{/if}
			</span>
		</div>
		{#if onOpenConfig}
			<button
				type="button"
				onclick={onOpenConfig}
				class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-800 hover:bg-slate-100"
			>
				<Settings2 class="h-3.5 w-3.5" />
				Configure Showcase
			</button>
		{/if}
	</div>
{/if}
