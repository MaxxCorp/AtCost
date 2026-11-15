<script lang="ts">
	import type { GoalCampaign } from '@ac/validations';
	import { getContributionPlugin } from '#lib/plugins/registry.js';
	import GoalExecutiveCallout from './GoalExecutiveCallout.svelte';
	import {
		MapPin,
		Eye,
		Users,
		Star,
		Calendar,
		Tag as TagIcon,
		ArrowUpRight,
		ShieldCheck,
		UserCheck
	} from '@lucide/svelte';

	interface Props {
		campaign: GoalCampaign;
		featured?: boolean;
		isOperator?: boolean;
		onToggleShowcase?: (campaign: GoalCampaign) => void;
	}

	let {
		campaign,
		featured = false,
		isOperator = false,
		onToggleShowcase = undefined
	}: Props = $props();

	const plugin = $derived(getContributionPlugin(campaign.contributionType));
	const heroUrl = $derived((campaign as any).heroImageUrl || campaign.heroImage || '');
	const isCommunity = $derived(
		(campaign as any).isCommunitySupplied ?? campaign.creatorRole === 'community'
	);

	const statusBadge = $derived.by(() => {
		switch (campaign.status) {
			case 'published':
				return { label: 'Published · Live', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
			case 'pending_approval':
				return { label: 'Pending Operator Approval', classes: 'bg-amber-100 text-amber-900 border-amber-300' };
			case 'completed_successful':
				return { label: 'Completed · Goal Achieved', classes: 'bg-teal-100 text-teal-900 border-teal-300' };
			case 'completed_unsuccessful':
				return { label: 'Closed · Unsuccessful', classes: 'bg-rose-100 text-rose-800 border-rose-200' };
			case 'cancelled':
				return { label: 'Cancelled', classes: 'bg-slate-200 text-slate-700 border-slate-300' };
			default:
				return { label: 'Draft', classes: 'bg-slate-100 text-slate-700 border-slate-200' };
		}
	});

	const formattedUpdatedDate = $derived.by(() => {
		try {
			return new Date(campaign.updatedAt).toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return '';
		}
	});
</script>

<article
	class="flex flex-col overflow-hidden rounded-2xl border bg-white transition-all hover:shadow-md {featured
		? 'border-indigo-200 ring-1 ring-indigo-100 shadow-sm'
		: 'border-slate-200 shadow-2xs'}"
>
	<!-- Top Image / Status Banner -->
	<div class="relative h-44 w-full overflow-hidden bg-slate-900">
		{#if heroUrl}
			<img
				src={heroUrl}
				alt={campaign.title}
				class="h-full w-full object-cover opacity-90 transition-transform duration-500 hover:scale-105"
				loading="lazy"
			/>
		{:else}
			<div
				class="h-full w-full bg-gradient-to-br from-indigo-900 via-violet-800 to-fuchsia-900"
			></div>
		{/if}
		<div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent"></div>

		<!-- Top Overlay Badges -->
		<div class="absolute top-3 right-3 left-3 flex items-start justify-between gap-2">
			<div class="flex flex-wrap items-center gap-1.5">
				<span
					class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-2xs {plugin.badgeBgClass} {plugin.badgeTextClass}"
				>
					{plugin.shortName}
				</span>

				<span
					class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs {statusBadge.classes}"
				>
					{statusBadge.label}
				</span>
			</div>

			{#if isOperator && onToggleShowcase}
				<button
					type="button"
					onclick={() => onToggleShowcase?.(campaign)}
					title={campaign.isShowcased ? 'Remove from Operator Showcase' : 'Feature in Operator Showcase'}
					class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border backdrop-blur-xs transition-colors {campaign.isShowcased
						? 'border-amber-300 bg-amber-400 text-slate-950 shadow-sm'
						: 'border-white/30 bg-slate-900/60 text-white hover:bg-slate-900/80'}"
				>
					<Star class="h-4 w-4 {campaign.isShowcased ? 'fill-current' : ''}" />
				</button>
			{/if}
		</div>

		<!-- Bottom Image Overlay: Creator Role Badge -->
		<div class="absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2 text-xs text-white/90">
			<span class="inline-flex items-center gap-1.5 font-medium">
				{#if isCommunity}
					<UserCheck class="h-3.5 w-3.5 text-sky-300" />
					Community-Supplied Goal
				{:else}
					<ShieldCheck class="h-3.5 w-3.5 text-emerald-300" />
					Operator Initiative
				{/if}
			</span>
			{#if campaign.isShowcased}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[11px] font-extrabold text-slate-950"
				>
					<Star class="h-3 w-3 fill-current" />
					Showcased
				</span>
			{/if}
		</div>
	</div>

	<!-- Card Body -->
	<div class="flex flex-1 flex-col justify-between gap-4 p-5">
		<div class="space-y-3.5">
			<!-- Title & Subtitle -->
			<div class="space-y-1">
				<a
					href="/goals/{campaign.id}"
					class="group inline-flex items-start justify-between gap-2 text-lg font-extrabold text-slate-900 hover:text-indigo-600 transition-colors"
				>
					<span>{campaign.title}</span>
					<ArrowUpRight
						class="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-indigo-600"
					/>
				</a>
				{#if (campaign as any).subtitle}
					<p class="text-xs font-medium text-slate-500">
						{(campaign as any).subtitle}
					</p>
				{/if}
			</div>

			<!-- Executive Summary & Progress + Prominent CTA -->
			<GoalExecutiveCallout
				{campaign}
				compact={true}
				ctaHref="/goals/{campaign.id}#contribute"
			/>

			<!-- Brief Description Preview -->
			<p class="line-clamp-2 text-xs leading-relaxed text-slate-600">
				{campaign.description}
			</p>

			<!-- Tags & Locations Categorization -->
			{#if (campaign.tags && campaign.tags.length > 0) || (campaign.locations && campaign.locations.length > 0)}
				<div class="flex flex-wrap items-center gap-1.5 pt-1">
					{#each campaign.locations ?? [] as loc (loc.id)}
						<span
							class="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900"
						>
							<MapPin class="h-3 w-3 text-sky-600" />
							{loc.city ? `${loc.city} · ${loc.name}` : loc.name}
						</span>
					{/each}

					{#each campaign.tags ?? [] as tagItem (tagItem.id)}
						<span
							class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
						>
							<TagIcon class="h-3 w-3 text-indigo-500" />
							{tagItem.name}
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer: Popularity Metrics & Direct Action Link -->
		<div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
			<div class="flex flex-wrap items-center gap-3">
				<span class="inline-flex items-center gap-1 font-medium" title="Total participants / contributions">
					<Users class="h-3.5 w-3.5 text-indigo-600" />
					{campaign.contributionsCount}
				</span>
				<span class="inline-flex items-center gap-1 font-medium" title="Campaign page visits">
					<Eye class="h-3.5 w-3.5 text-slate-400" />
					{campaign.visitsCount}
				</span>
				{#if formattedUpdatedDate}
					<span class="inline-flex items-center gap-1">
						<Calendar class="h-3.5 w-3.5 text-slate-400" />
						{formattedUpdatedDate}
					</span>
				{/if}
			</div>

			<a
				href="/goals/{campaign.id}#contribute"
				class="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800"
			>
				View & Contribute
				<ArrowUpRight class="h-3.5 w-3.5" />
			</a>
		</div>
	</div>
</article>
