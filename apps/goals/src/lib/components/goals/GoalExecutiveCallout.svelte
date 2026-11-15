<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		computeGoalProgressSummary,
		type GoalCampaign,
		type GoalProgressSummary
	} from '@ac/validations';
	import { getContributionPlugin } from '#lib/plugins/registry.js';
	import {
		Sparkles,
		Target,
		CheckCircle2,
		ArrowRight,
		Trophy,
		Flame
	} from '@lucide/svelte';

	interface Props {
		campaign: GoalCampaign;
		compact?: boolean;
		onContributeClick?: () => void;
		ctaHref?: string;
	}

	let {
		campaign,
		compact = false,
		onContributeClick = undefined,
		ctaHref = undefined
	}: Props = $props();

	const plugin = $derived(getContributionPlugin(campaign.contributionType));
	const unitLabel = $derived(
		(campaign as any).contributionUnitLabel || campaign.unitLabel || plugin.defaultUnitLabel
	);

	function formatValue(val: number): string {
		return plugin.formatValue(Number(val || 0), campaign.currency || 'EUR', unitLabel);
	}

	const summary = $derived.by<GoalProgressSummary>(() => {
		if ((campaign as any).progress && (campaign as any).progress.primaryStage) {
			return (campaign as any).progress as GoalProgressSummary;
		}
		return computeGoalProgressSummary({
			primaryTarget: Number(campaign.primaryTarget || (campaign as any).progress?.primaryTarget || 100),
			currentAmount: Number(
				campaign.currentAmount ?? (campaign as any).currentTotal ?? (campaign as any).progress?.currentTotal ?? 0
			),
			title: campaign.title,
			stages: campaign.stages
		});
	});

	const currentAmount = $derived(
		Number(campaign.currentAmount ?? (campaign as any).currentTotal ?? 0)
	);
	const primaryPercent = $derived(
		Number((campaign as any).progress?.primaryPercent ?? summary.primaryProgressPercent ?? 0)
	);
	const overallPercent = $derived(
		Number((campaign as any).progress?.overallPercent ?? summary.overallProgressPercent ?? 0)
	);
	const nextStage = $derived(summary.nextStage);
	const remainingToNext = $derived(
		Number(
			(campaign as any).progress?.remainingToNextStage ??
				summary.nextStage?.remainingAmount ??
				0
		)
	);
	const formattedCurrent = $derived(formatValue(currentAmount));
	const formattedPrimaryTarget = $derived(formatValue(summary.primaryStage.targetAmount));
	const formattedRemaining = $derived(formatValue(remainingToNext));

	const effectiveHref = $derived(ctaHref || `/goals/${campaign.id}#contribute`);

	function handleCtaAction() {
		if (onContributeClick) {
			onContributeClick();
			return;
		}
		void goto(effectiveHref);
	}
</script>

<div
	class="rounded-2xl border border-indigo-100 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 shadow-xs {compact
		? 'p-4 space-y-3.5'
		: 'p-6 space-y-5'}"
>
	<!-- Executive Summary Header -->
	<div class="space-y-2">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-indigo-100/80 px-2.5 py-0.5 text-xs font-bold tracking-wide text-indigo-900 uppercase"
			>
				<Sparkles class="h-3.5 w-3.5 text-indigo-600" />
				Executive Summary
			</span>

			<div class="flex flex-wrap items-center gap-1.5">
				{#if summary.primaryStage.isReached}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
					>
						<CheckCircle2 class="h-3.5 w-3.5 text-emerald-600" />
						Primary Goal Unlocked
					</span>
				{:else}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
					>
						<Target class="h-3.5 w-3.5 text-amber-600" />
						Primary Goal: {primaryPercent}%
					</span>
				{/if}

				{#if summary.stretchStages.length > 0}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800"
					>
						<Trophy class="h-3.5 w-3.5 text-violet-600" />
						{summary.stretchStages.filter((s) => s.isReached).length}/{summary.stretchStages.length} Stretch
						{summary.stretchStages.length === 1 ? 'Goal' : 'Goals'}
					</span>
				{/if}
			</div>
		</div>

		<p class="text-slate-800 font-medium leading-relaxed {compact ? 'text-sm line-clamp-3' : 'text-base'}">
			{campaign.executiveSummary}
		</p>
	</div>

	<!-- Multi-Stage Progress Bar (Primary + Stretch Goals) -->
	<div class="space-y-2.5">
		<div class="flex flex-wrap items-baseline justify-between gap-2 text-xs sm:text-sm">
			<div class="flex items-baseline gap-1.5">
				<span class="font-extrabold text-slate-900 {compact ? 'text-base' : 'text-xl'}">
					{formattedCurrent}
				</span>
				<span class="text-slate-500">
					of {formattedPrimaryTarget} primary goal
				</span>
			</div>
			<span class="font-bold text-indigo-700">
				{primaryPercent}% Primary
				{#if summary.stretchStages.length > 0}
					· {overallPercent}% Total Stages
				{/if}
			</span>
		</div>

		<!-- Track with stage markers -->
		<div class="relative h-3.5 w-full overflow-hidden rounded-full bg-slate-200/90 p-0.5">
			<div
				class="h-full rounded-full transition-all duration-500 {summary.allStagesReached
					? 'bg-gradient-to-r from-emerald-500 to-teal-500'
					: 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600'}"
				style={`width: ${Math.max(4, Math.min(100, summary.stretchStages.length > 0 ? overallPercent : primaryPercent))}%`}
			></div>

			{#if summary.stretchStages.length > 0 && summary.overallMaxTarget > 0}
				{#each summary.allStages as stage (stage.title + stage.targetAmount)}
					{@const markerPos = Math.min(98, Math.max(5, Math.round((stage.targetAmount / summary.overallMaxTarget) * 100)))}
					<div
						class="absolute top-0 bottom-0 w-1 {stage.isReached ? 'bg-emerald-300' : 'bg-white/90'}"
						style={`left: ${markerPos}%`}
						title={`${stage.title}: ${formatValue(stage.targetAmount)}`}
					></div>
				{/each}
			{/if}
		</div>

		<!-- Stage Milestone Pills -->
		{#if !compact || summary.stretchStages.length > 0}
			<div class="grid grid-cols-1 gap-1.5 {compact ? ' sm:grid-cols-2' : 'sm:grid-cols-3'}">
				{#each summary.allStages as stage, idx (stage.title + idx)}
					{@const isNext = nextStage && nextStage.title === stage.title && nextStage.targetAmount === stage.targetAmount}
					<div
						class="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs {stage.isReached
							? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
							: isNext
								? 'border-indigo-300 bg-indigo-50/90 text-indigo-950 ring-1 ring-indigo-300'
								: 'border-slate-200 bg-white/80 text-slate-600'}"
					>
						<div class="flex items-center gap-1.5 min-w-0">
							{#if stage.isReached}
								<CheckCircle2 class="h-3.5 w-3.5 shrink-0 text-emerald-600" />
							{:else if isNext}
								<Flame class="h-3.5 w-3.5 shrink-0 text-indigo-600" />
							{:else}
								<Target class="h-3.5 w-3.5 shrink-0 text-slate-400" />
							{/if}
							<span class="truncate font-semibold" title={stage.title}>
								{stage.stageType === 'primary' ? 'Primary' : `Stretch #${stage.sortOrder}`}: {stage.title}
							</span>
						</div>
						<span class="shrink-0 font-bold">
							{formatValue(stage.targetAmount)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Visually Distinctive Prominent Call-To-Action Banner -->
	<button
		type="button"
		onclick={handleCtaAction}
		class="group w-full cursor-pointer rounded-xl p-3.5 text-left text-white shadow-md transition-all hover:shadow-lg active:scale-[0.99] {summary.allStagesReached
			? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500'
			: 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500'}"
	>
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<div class="flex items-start sm:items-center gap-2.5">
				<span
					class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur-xs"
				>
					{#if summary.allStagesReached}
						<Trophy class="h-4 w-4" />
					{:else}
						<Flame class="h-4 w-4" />
					{/if}
				</span>
				<div class="space-y-0.5">
					{#if remainingToNext > 0 && nextStage}
						<p class="font-bold leading-snug {compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}">
							Just <span class="underline decoration-white/80 underline-offset-2">{formattedRemaining}</span>
							more to reach the
							{nextStage.stageType === 'primary'
								? 'Primary Goal'
								: `Stretch Goal #${summary.allStages.findIndex((s) => s.title === nextStage.title && s.targetAmount === nextStage.targetAmount)}`}
							: “{nextStage.title}” — Click here to contribute!
						</p>
					{:else}
						<p class="font-bold leading-snug {compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}">
							All Primary & Stretch Goals Unlocked ({primaryPercent}% funded) — Click here to add your contribution!
						</p>
					{/if}
				</div>
			</div>

			<span
				class="inline-flex shrink-0 items-center justify-center gap-1.5 self-end sm:self-center rounded-lg bg-white px-3.5 py-1.5 text-xs font-extrabold text-indigo-950 shadow-xs transition-transform group-hover:translate-x-0.5"
			>
				{(campaign as any).ctaButtonLabel || plugin.ctaVerb}
				<ArrowRight class="h-3.5 w-3.5" />
			</span>
		</div>
	</button>
</div>
