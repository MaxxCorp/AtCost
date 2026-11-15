<script lang="ts">
	import * as m from '#lib/paraglide/messages.js';
	import { page } from '$app/state';
	import {
		ArrowLeft,
		Edit,
		Pin,
		PinOff,
		CheckCircle2,
		XCircle,
		Clock,
		Eye,
		Users,
		MapPin,
		Tag as TagIcon,
		Sparkles,
		Flag,
		Trophy,
		MessageSquarePlus,
		Milestone,
		ShieldCheck,
		AlertTriangle,
		Calendar
	} from '@lucide/svelte';
	import {
		Button,
		LoadingSection,
		ErrorSection,
		useFormValidationFeedback
	} from '@ac/ui';
	import { readGoalCampaign } from './read.remote.js';
	import { postGoalUpdate } from './updates.remote.js';
	import { getCurrentSessionUser } from '../list.remote.js';
	import {
		toggleCampaignShowcase,
		reviewCommunityGoalCampaign,
		updateGoalLifecycleStatus
	} from '../showcase.remote.js';
	import {
		createGoalUpdateSchema,
		reviewGoalCampaignSchema,
		computeGoalProgressSummary,
		type GoalCampaignStatus
	} from '@ac/validations';
	import { getContributionPlugin } from '#lib/plugins/registry.js';
	import GoalExecutiveCallout from '#lib/components/goals/GoalExecutiveCallout.svelte';
	import ContributionPluginWidget from '#lib/components/goals/ContributionPluginWidget.svelte';
	import { toast } from 'svelte-sonner';

	const campaignId = $derived(page.params.id as string);
	const campaignQuery = $derived(readGoalCampaign(campaignId));
	const sessionQuery = getCurrentSessionUser({});

	const campaign = $derived(campaignQuery.current);
	const currentUser = $derived(sessionQuery.current?.user ?? null);
	const isOperator = $derived(sessionQuery.current?.isOperator ?? false);

	const isOwner = $derived(
		Boolean(
			currentUser &&
				campaign &&
				(currentUser.id === campaign.userId ||
					currentUser.id === (campaign as any).creatorId)
		)
	);
	const canManage = $derived(isOperator || isOwner);

	const progress = $derived(
		campaign ? computeGoalProgressSummary(campaign) : null
	);
	const plugin = $derived(
		campaign ? getContributionPlugin(campaign.contributionType) : null
	);

	const financialBreakdown = $derived.by(() => {
		if (!campaign || campaign.contributionType !== 'financial') return null;
		const list = campaign.contributions ?? [];
		let activePledgesCount = 0;
		let activePledgesAmount = 0;
		let activeTransfersCount = 0;
		let activeTransfersAmount = 0;
		let cancelledPledgesCount = 0;
		let cancelledPledgesAmount = 0;
		let refundedTransfersCount = 0;
		let refundedTransfersAmount = 0;

		for (const c of list) {
			const amt = Number(c.amount || 0);
			const meta = (c.metadata ?? {}) as Record<string, any>;
			const isTransfer =
				meta.financialType === 'transfer' ||
				c.paymentStatus === 'transferred' ||
				c.paymentStatus === 'refunded';

			if (c.paymentStatus === 'cancelled') {
				cancelledPledgesCount += 1;
				cancelledPledgesAmount += amt;
			} else if (c.paymentStatus === 'refunded') {
				refundedTransfersCount += 1;
				refundedTransfersAmount += amt;
			} else if (isTransfer) {
				activeTransfersCount += 1;
				activeTransfersAmount += amt;
			} else {
				activePledgesCount += 1;
				activePledgesAmount += amt;
			}
		}

		return {
			activePledgesCount,
			activePledgesAmount,
			activeTransfersCount,
			activeTransfersAmount,
			cancelledPledgesCount,
			cancelledPledgesAmount,
			refundedTransfersCount,
			refundedTransfersAmount
		};
	});

	// Inline Operator Review Form state
	const reviewRf = reviewCommunityGoalCampaign;
	let inlineReviewDecision = $state<'approved' | 'rejected'>('approved');
	let inlineReviewNotes = $state('');

	// Post Campaign Update Form state
	const updateRf = postGoalUpdate;
	let updateTitle = $state('');
	let updateContent = $state('');
	let updateIsMilestone = $state(false);

	useFormValidationFeedback(() => updateRf, {
		message: () => m.please_fix_validation()
	});

	function scrollToContribute() {
		const el = document.getElementById('contribute');
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	async function handleToggleShowcase() {
		if (!campaign) return;
		try {
			await toggleCampaignShowcase({
				campaignId: campaign.id,
				isShowcased: !campaign.isShowcased
			});
			await campaignQuery.refresh();
			toast.success(
				campaign.isShowcased
					? 'Removed from operator showcase'
					: 'Pinned to operator showcase'
			);
		} catch (err: any) {
			toast.error(err?.message || 'Failed to update showcase pin');
		}
	}

	async function handleStatusTransition(nextStatus: GoalCampaignStatus) {
		if (!campaign) return;
		try {
			const res = await updateGoalLifecycleStatus({
				campaignId: campaign.id,
				status: nextStatus
			});
			await campaignQuery.refresh();
			const s = res?.settlementSummary;
			if (
				s &&
				(s.cancelledPledgesCount > 0 || s.refundedTransfersCount > 0)
			) {
				toast.success(
					`Status updated to ${nextStatus.replace(/_/g, ' ')}: ${s.cancelledPledgesCount} pledge(s) cancelled & ${s.refundedTransfersCount} transfer(s) refunded.`
				);
			} else if (s && s.capturedPledgesCount > 0) {
				toast.success(
					`Campaign completed! ${s.capturedPledgesCount} pledge(s) captured and settled.`
				);
			} else {
				toast.success(`Campaign status updated to ${nextStatus.replace(/_/g, ' ')}`);
			}
		} catch (err: any) {
			toast.error(err?.message || 'Failed to update campaign status');
		}
	}

	const statusBadgeConfig: Record<
		string,
		{ label: string; classes: string }
	> = {
		published: {
			label: 'Active & Published',
			classes: 'bg-emerald-100 text-emerald-800 border-emerald-300'
		},
		pending_approval: {
			label: 'Pending Operator Approval',
			classes: 'bg-amber-100 text-amber-800 border-amber-300'
		},
		draft: {
			label: 'Draft',
			classes: 'bg-gray-100 text-gray-800 border-gray-300'
		},
		completed_successful: {
			label: 'Completed Successfully',
			classes: 'bg-teal-100 text-teal-900 border-teal-300'
		},
		completed_unsuccessful: {
			label: 'Completed (Target Unreached)',
			classes: 'bg-orange-100 text-orange-900 border-orange-300'
		},
		cancelled: {
			label: 'Cancelled',
			classes: 'bg-rose-100 text-rose-800 border-rose-300'
		}
	};
</script>

<svelte:head>
	<title>{campaign ? `${campaign.title} | AC-Goals` : 'Goal Campaign | AC-Goals'}</title>
</svelte:head>

{#if campaignQuery.loading && !campaign}
	<LoadingSection message="Loading goal campaign details..." />
{:else if campaignQuery.error}
	<ErrorSection
		headline="Failed to load goal campaign"
		message={campaignQuery.error?.message || 'Could not load this campaign'}
		onRetry={() => void campaignQuery.refresh()}
	/>
{:else if !campaign}
	<div class="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-4">
		<h1 class="text-2xl font-bold text-gray-900">Campaign Not Found</h1>
		<p class="text-sm text-gray-600">
			The goal campaign you are looking for does not exist or has been removed.
		</p>
		<Button href="/goals" variant="primary">Back to All Campaigns</Button>
	</div>
{:else}
	{@const badge = statusBadgeConfig[campaign.status] ?? statusBadgeConfig.published}
	<div class="space-y-8 pb-20">
		<!-- Top Bar: Navigation, Badges, Popularity Metrics & Owner/Operator Actions -->
		<div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<a
					href="/goals"
					class="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-emerald-700"
				>
					<ArrowLeft class="w-4 h-4" />
					All Goal Campaigns
				</a>

				<div class="flex flex-wrap items-center gap-3 text-xs text-gray-600">
					<span class="inline-flex items-center gap-1 font-semibold bg-gray-100 px-2.5 py-1 rounded-full">
						<Eye class="w-3.5 h-3.5 text-gray-500" />
						{campaign.visitsCount.toLocaleString()} visits
					</span>
					<span class="inline-flex items-center gap-1 font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full">
						<Users class="w-3.5 h-3.5 text-emerald-600" />
						{campaign.contributionsCount.toLocaleString()} contributions
					</span>
				</div>
			</div>

			<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-2 border-t border-gray-100">
				<!-- Status, Provenance, Tags & Locations Badges -->
				<div class="flex flex-wrap items-center gap-2">
					<span class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold {badge.classes}">
						{badge.label}
					</span>

					{#if campaign.creatorRole === 'community' || (campaign as any).isCommunitySupplied}
						<span class="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-800">
							Community-Supplied
							{#if campaign.approvalStatus === 'approved'}
								• Operator Approved
							{/if}
						</span>
					{:else}
						<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
							<ShieldCheck class="w-3.5 h-3.5" />
							Operator Campaign
						</span>
					{/if}

					{#each campaign.tags ?? [] as tagItem (tagItem.id)}
						<a
							href="/goals"
							class="inline-flex items-center gap-1 rounded-full bg-gray-100 hover:bg-emerald-100 hover:text-emerald-800 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors"
						>
							<TagIcon class="w-3 h-3" />
							{tagItem.name}
						</a>
					{/each}

					{#each campaign.locations ?? [] as loc (loc.id)}
						<span class="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-800">
							<MapPin class="w-3 h-3" />
							{loc.name}{loc.city ? ` (${loc.city})` : ''}
						</span>
					{/each}
				</div>

				<!-- Owner / Operator Action Controls -->
				{#if canManage}
					<div class="flex flex-wrap items-center gap-2">
						<Button
							href="/goals/{campaign.id}/edit"
							variant="outline"
							class="inline-flex items-center gap-1.5 text-xs"
						>
							<Edit class="w-3.5 h-3.5" />
							Edit Campaign
						</Button>

						{#if isOperator}
							<Button
								variant="outline"
								onclick={handleToggleShowcase}
								class="inline-flex items-center gap-1.5 text-xs"
							>
								{#if campaign.isShowcased}
									<PinOff class="w-3.5 h-3.5 text-rose-600" />
									Unpin Showcase
								{:else}
									<Pin class="w-3.5 h-3.5 text-emerald-600" />
									Pin to Showcase
								{/if}
							</Button>
						{/if}

						<!-- Lifecycle Status Transitions -->
						{#if campaign.status !== 'published'}
							<Button
								variant="primary"
								onclick={() => void handleStatusTransition('published')}
								class="text-xs px-3 py-1.5"
							>
								Publish
							</Button>
						{/if}
						{#if campaign.status === 'published'}
							<Button
								variant="secondary"
								onclick={() => void handleStatusTransition('completed_successful')}
								class="text-xs px-3 py-1.5"
							>
								Mark Completed (Success)
							</Button>
							<Button
								variant="outline"
								onclick={() => void handleStatusTransition('completed_unsuccessful')}
								class="text-xs px-3 py-1.5"
							>
								Mark Unsuccessful
							</Button>
							<Button
								variant="ghost"
								onclick={() => void handleStatusTransition('cancelled')}
								class="text-xs text-rose-600 hover:bg-rose-50 px-3 py-1.5"
							>
								Cancel
							</Button>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Inline Operator Approval Banner when Pending -->
		{#if (campaign.approvalStatus === 'pending' || campaign.status === 'pending_approval') && isOperator}
			<div class="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm space-y-4">
				<div class="flex items-start gap-3">
					<AlertTriangle class="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
					<div>
						<h2 class="text-base font-bold text-amber-950">
							This Community-Supplied Campaign Is Awaiting Operator Approval
						</h2>
						<p class="text-xs text-amber-800">
							Review the executive summary, primary & stretch goals, and approve to publish immediately or reject back to draft.
						</p>
					</div>
				</div>

				<form
					{...reviewRf
						.preflight(reviewGoalCampaignSchema)
						.enhance(async ({ submit }) => {
							try {
								await submit();
								await campaignQuery.refresh();
								toast.success(
									inlineReviewDecision === 'approved'
										? 'Campaign approved and published!'
										: 'Campaign rejected to draft'
								);
							} catch (err: any) {
								toast.error(err?.message || 'Review action failed');
							}
						})}
					class="flex flex-col sm:flex-row sm:items-end gap-3"
				>
					{#if campaign.id}
						<input {...reviewRf.fields.campaignId.as('hidden', campaign.id)} />
					{/if}
					<input {...reviewRf.fields.decision.as('hidden', inlineReviewDecision)} />

					<div class="flex-1 space-y-1">
						<label
							for="inline-approval-notes"
							class="block text-xs font-bold uppercase tracking-wider text-amber-900"
						>
							Approval / Verification Notes
						</label>
						<input
							id="inline-approval-notes"
							{...reviewRf.fields.approvalNotes.as('text')}
							value={inlineReviewNotes}
							oninput={(e) => {
								inlineReviewNotes = (e.currentTarget as HTMLInputElement).value;
								void reviewRf.validate().catch(() => {});
							}}
							placeholder="Optional operator notes..."
							class="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-sm"
						/>
					</div>

					<div class="flex items-center gap-2">
						<Button
							type="submit"
							variant="primary"
							onclick={() => (inlineReviewDecision = 'approved')}
							class="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
						>
							<CheckCircle2 class="w-4 h-4" />
							Approve & Publish
						</Button>
						<Button
							type="submit"
							variant="destructive"
							onclick={() => (inlineReviewDecision = 'rejected')}
							class="inline-flex items-center gap-1.5"
						>
							<XCircle class="w-4 h-4" />
							Reject
						</Button>
					</div>
				</form>
			</div>
		{/if}

		<!-- Executive Summary & Prominent Call-to-Action Callout Up Top -->
		<GoalExecutiveCallout
			{campaign}
			compact={false}
			onContributeClick={scrollToContribute}
		/>

		<!-- Two-Column Main Layout -->
		<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
			<!-- Left Column (2/3 width = 8 cols) -->
			<div class="lg:col-span-8 space-y-8">
				<!-- Primary & Stretch Goals Stage Roadmap -->
				{#if progress && plugin}
					<section class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
						<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
							<div>
								<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
									<Flag class="w-4 h-4" />
									Multi-Stage Milestone Roadmap
								</div>
								<h2 class="text-2xl font-black text-gray-900 mt-0.5">
									Primary Goal & Stretch Goals
								</h2>
							</div>
							<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1 text-xs font-bold text-emerald-800">
								<Trophy class="w-3.5 h-3.5 text-emerald-600" />
								{progress.reachedStagesCount} of {progress.allStages.length} Stages Unlocked
							</span>
						</div>

						<div class="space-y-4">
							{#each progress.allStages as stage (stage.sortOrder)}
								{@const currentVal = Number(campaign.currentAmount ?? 0)}
								{@const stagePct = Math.min(
									100,
									Math.round((currentVal / Math.max(1, stage.targetAmount)) * 100)
								)}
								{@const remaining = Math.max(
									0,
									Number((stage.targetAmount - currentVal).toFixed(2))
								)}

								<div
									class="rounded-2xl border-2 p-5 transition-all {stage.isReached
										? 'border-emerald-400 bg-emerald-50/40'
										: stage.stageType === 'primary'
											? 'border-emerald-200 bg-white'
											: 'border-teal-200 bg-teal-50/20'}"
								>
									<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
										<div class="flex items-center gap-2.5">
											<span
												class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider {stage.stageType ===
												'primary'
													? 'bg-emerald-600 text-white'
													: 'bg-teal-700 text-white'}"
											>
												{stage.stageType === 'primary'
													? 'Primary Goal'
													: `Stretch Goal #${stage.sortOrder}`}
											</span>

											{#if stage.isReached}
												<span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
													<CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
													Unlocked!
												</span>
											{/if}
										</div>

										<div class="text-sm font-black text-gray-900">
											Target: {plugin.formatValue(
												stage.targetAmount,
												campaign.currency,
												campaign.unitLabel
											)}
										</div>
									</div>

									<h3 class="text-lg font-bold text-gray-900 mt-2">
										{stage.title}
									</h3>

									{#if stage.description}
										<p class="text-sm text-gray-600 mt-1 leading-relaxed">
											{stage.description}
										</p>
									{/if}

									<!-- Progress bar -->
									<div class="mt-4 space-y-1.5">
										<div class="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
											<div
												class="h-full rounded-full transition-all duration-500 {stage.isReached
													? 'bg-emerald-500'
													: 'bg-gradient-to-r from-emerald-500 to-teal-500'}"
												style="width: {stagePct}%"
											></div>
										</div>

										<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
											<span class="font-bold text-gray-700">
												{stagePct}% complete ({plugin.formatValue(
													currentVal,
													campaign.currency,
													campaign.unitLabel
												)})
											</span>

											{#if stage.isReached}
												<span class="font-bold text-emerald-700">
													Milestone achieved!
												</span>
											{:else}
												<button
													type="button"
													onclick={scrollToContribute}
													class="font-bold text-emerald-700 hover:text-emerald-900 underline"
												>
													Just {plugin.formatValue(
														remaining,
														campaign.currency,
														campaign.unitLabel
													)} more to unlock this stage — Contribute now →
												</button>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<!-- About This Campaign & Associated Locations -->
				<section class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
					<div>
						<h2 class="text-2xl font-black text-gray-900">About This Campaign</h2>
						<div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
							<span>
								Launched by <strong class="text-gray-800">{campaign.creatorName || 'Campaign Organizer'}</strong>
							</span>
							{#if campaign.endDate}
								<span class="inline-flex items-center gap-1">
									<Calendar class="w-3.5 h-3.5" />
									Deadline: {new Date(campaign.endDate).toLocaleDateString()}
								</span>
							{/if}
						</div>
					</div>

					<div class="prose prose-slate max-w-none text-gray-700 whitespace-pre-line leading-relaxed text-sm sm:text-base">
						{campaign.description}
					</div>

					{#if (campaign.locations ?? []).length > 0}
						<div class="pt-4 border-t border-gray-100 space-y-3">
							<h3 class="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
								<MapPin class="w-4 h-4 text-blue-600" />
								Associated Locations
							</h3>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								{#each campaign.locations ?? [] as loc (loc.id)}
									<a
										href="/locations/{loc.id}"
										class="rounded-xl border border-gray-200 p-3.5 hover:border-blue-400 hover:bg-blue-50/30 transition-all block"
									>
										<div class="font-bold text-sm text-gray-900">{loc.name}</div>
										<div class="text-xs text-gray-600 mt-0.5">
											{[loc.street, loc.houseNumber, loc.zip, loc.city, loc.country]
												.filter(Boolean)
												.join(' ')}
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/if}
				</section>

				<!-- Campaign Updates Timeline & Post Update Form -->
				<section class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-2xl font-black text-gray-900 flex items-center gap-2">
								<Milestone class="w-6 h-6 text-emerald-600" />
								{m.campaign_updates()}
							</h2>
							<p class="text-xs text-gray-600">
								Progress reports and milestone announcements from the campaign team.
							</p>
						</div>
						<span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
							{(campaign.updates ?? []).length} updates
						</span>
					</div>

					<!-- Owner/Operator Post Campaign Update Form (NO raw name attributes!) -->
					{#if canManage}
						<form
							{...updateRf
								.preflight(createGoalUpdateSchema)
								.enhance(async ({ submit }) => {
									try {
										await submit();
										updateTitle = '';
										updateContent = '';
										updateIsMilestone = false;
										await campaignQuery.refresh();
										toast.success('Campaign update published!');
									} catch (err: any) {
										toast.error(err?.message || 'Failed to post update');
									}
								})}
							class="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4"
						>
							<h3 class="text-sm font-bold text-gray-900 flex items-center gap-1.5">
								<MessageSquarePlus class="w-4 h-4 text-emerald-600" />
								{m.post_update()}
							</h3>

							{#if campaign.id}
								<input {...updateRf.fields.campaignId.as('hidden', campaign.id)} />
							{/if}
							<input
								{...updateRf.fields.isMilestone.as(
									'hidden',
									updateIsMilestone ? 'true' : 'false'
								)}
							/>

							<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
								<div class="sm:col-span-2 space-y-1">
									<label
										for="update-title-input"
										class="block text-xs font-bold uppercase tracking-wider text-gray-700"
									>
										Announcement Headline
									</label>
									<input
										id="update-title-input"
										{...updateRf.fields.title.as('text')}
										value={updateTitle}
										oninput={(e) => {
											updateTitle = (e.currentTarget as HTMLInputElement).value;
											void updateRf.validate().catch(() => {});
										}}
										placeholder="e.g., Primary Goal Unlocked! Stretch Goal #1 Now Open"
										class="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm"
									/>
									{#each updateRf.fields.title.issues() as issue, idx (idx)}
										<p class="text-xs text-rose-600">{issue.message}</p>
									{/each}
								</div>

								<div class="space-y-1">
									<span class="block text-xs font-bold uppercase tracking-wider text-gray-700">
										Update Type
									</span>
									<button
										type="button"
										onclick={() => {
											updateIsMilestone = !updateIsMilestone;
											void updateRf.validate().catch(() => {});
										}}
										class="w-full rounded-xl border px-3 py-2 text-xs font-bold transition-colors {updateIsMilestone
											? 'border-amber-500 bg-amber-100 text-amber-900'
											: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
									>
										{updateIsMilestone ? '★ Milestone Unlocked' : 'Standard Progress Update'}
									</button>
								</div>
							</div>

							<div class="space-y-1">
								<label
									for="update-content-input"
									class="block text-xs font-bold uppercase tracking-wider text-gray-700"
								>
									Update Details
								</label>
								<textarea
									id="update-content-input"
									{...updateRf.fields.content.as('text')}
									rows={3}
									value={updateContent}
									oninput={(e) => {
										updateContent = (e.currentTarget as HTMLTextAreaElement).value;
										void updateRf.validate().catch(() => {});
									}}
									placeholder="Share progress, next steps, or stretch goal unlocks with your supporters..."
									class="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm"
								></textarea>
								{#each updateRf.fields.content.issues() as issue, idx (idx)}
									<p class="text-xs text-rose-600">{issue.message}</p>
								{/each}
							</div>

							<div class="flex justify-end">
								<Button
									type="submit"
									variant="primary"
									disabled={!!updateRf.pending}
								>
									{updateRf.pending ? 'Publishing...' : 'Publish Campaign Update'}
								</Button>
							</div>
						</form>
					{/if}

					{#if (campaign.updates ?? []).length === 0}
						<p class="text-sm text-gray-500 italic py-4">
							No updates posted for this campaign yet.
						</p>
					{:else}
						<div class="space-y-4">
							{#each campaign.updates ?? [] as upd (upd.id)}
								<div
									class="rounded-2xl border p-5 space-y-2 {upd.isMilestone
										? 'border-amber-300 bg-amber-50/40'
										: 'border-gray-200 bg-gray-50/50'}"
								>
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div class="flex items-center gap-2">
											{#if upd.isMilestone}
												<span class="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-amber-950">
													<Sparkles class="w-3 h-3" />
													Milestone
												</span>
											{/if}
											<h3 class="font-bold text-gray-900">{upd.title}</h3>
										</div>
										<span class="text-xs text-gray-500">
											{new Date(upd.createdAt).toLocaleDateString()}
										</span>
									</div>
									<p class="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
										{upd.content}
									</p>
								</div>
							{/each}
						</div>
					{/if}
				</section>

				{#if campaign.contributionType === 'financial' && financialBreakdown && plugin}
					<section class="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 via-white to-indigo-50/40 p-6 shadow-sm space-y-4">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div>
								<span class="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
									Financial Escrow & Settlement Breakdown
								</span>
								<h2 class="text-lg font-black text-gray-900">
									Pledges vs. Actual Transfers
								</h2>
							</div>
							<span class="rounded-full bg-white border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-900">
								Mode: {(campaign.pluginConfig?.financialMode || 'both').replace(/_/g, ' ')}
							</span>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div class="rounded-xl border border-indigo-200 bg-white p-4 space-y-1">
								<div class="flex items-center justify-between text-xs font-bold text-indigo-900">
									<span>Financial Pledges (Authorized)</span>
									<span>{financialBreakdown.activePledgesCount}</span>
								</div>
								<div class="text-xl font-black text-gray-900">
									{plugin.formatValue(financialBreakdown.activePledgesAmount, campaign.currency, campaign.unitLabel)}
								</div>
								<p class="text-[11px] text-gray-500">
									Cancelled automatically with zero charge if campaign is cancelled or unsuccessful.
								</p>
							</div>

							<div class="rounded-xl border border-emerald-200 bg-white p-4 space-y-1">
								<div class="flex items-center justify-between text-xs font-bold text-emerald-900">
									<span>Actual Transfers (Escrow)</span>
									<span>{financialBreakdown.activeTransfersCount}</span>
								</div>
								<div class="text-xl font-black text-gray-900">
									{plugin.formatValue(financialBreakdown.activeTransfersAmount, campaign.currency, campaign.unitLabel)}
								</div>
								<p class="text-[11px] text-gray-500">
									Refunded automatically in full if campaign is cancelled or unsuccessful.
								</p>
							</div>
						</div>

						{#if financialBreakdown.cancelledPledgesCount > 0 || financialBreakdown.refundedTransfersCount > 0}
							<div class="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-950 flex flex-wrap items-center justify-between gap-3">
								<div>
									<strong>Automated Reversal Executed:</strong> All active pledges were cancelled and all actual transfers were refunded upon campaign closure.
								</div>
								<div class="flex flex-wrap items-center gap-2 font-bold">
									<span class="rounded-lg bg-white border border-rose-200 px-2.5 py-1">
										{financialBreakdown.cancelledPledgesCount} Pledges Cancelled ({plugin.formatValue(financialBreakdown.cancelledPledgesAmount, campaign.currency, campaign.unitLabel)})
									</span>
									<span class="rounded-lg bg-white border border-rose-200 px-2.5 py-1">
										{financialBreakdown.refundedTransfersCount} Transfers Refunded ({plugin.formatValue(financialBreakdown.refundedTransfersAmount, campaign.currency, campaign.unitLabel)})
									</span>
								</div>
							</div>
						{/if}
					</section>
				{/if}

				<!-- Recent Contributions & Voices -->
				<section class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-2xl font-black text-gray-900">
								Recent Contributions & Supporter Voices
							</h2>
							<p class="text-xs text-gray-600">
								Verified community members and operators backing this campaign.
							</p>
						</div>
						<span class="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
							{campaign.contributionsCount} total
						</span>
					</div>

					{#if (campaign.contributions ?? []).length === 0}
						<div class="rounded-xl border border-dashed border-gray-300 p-8 text-center space-y-2">
							<p class="text-sm font-semibold text-gray-700">
								Be the first to contribute to this goal campaign!
							</p>
							<Button variant="primary" onclick={scrollToContribute}>
								Contribute Now
							</Button>
						</div>
					{:else}
						<div class="divide-y divide-gray-100">
							{#each campaign.contributions ?? [] as contrib (contrib.id)}
								{@const cPlugin = getContributionPlugin(contrib.pluginType)}
								<div class="py-4 flex items-start justify-between gap-4">
									<div class="space-y-1">
										<div class="flex flex-wrap items-center gap-2">
											<span class="font-bold text-sm text-gray-900">
												{contrib.isAnonymous
													? 'Anonymous Supporter'
													: contrib.contributorName || 'Registered Supporter'}
											</span>
											<span class="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold {cPlugin.badgeBgClass} {cPlugin.badgeTextClass}">
												+{cPlugin.formatValue(
													Number(contrib.amount ?? 1),
													contrib.currency || campaign.currency,
													campaign.unitLabel
												)}
											</span>
											{#if contrib.pluginType === 'financial'}
												{@const meta = (contrib.metadata ?? {}) as Record<string, any>}
												{@const isTransfer =
													meta.financialType === 'transfer' ||
													contrib.paymentStatus === 'transferred' ||
													contrib.paymentStatus === 'refunded'}
												<span
													class="rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase {isTransfer
														? 'border-emerald-200 bg-emerald-50 text-emerald-800'
														: 'border-indigo-200 bg-indigo-50 text-indigo-800'}"
												>
													{isTransfer ? 'Actual Transfer' : 'Financial Pledge'}
												</span>
											{/if}
											{#if contrib.paymentStatus && contrib.paymentStatus !== 'not_applicable'}
												{@const meta = (contrib.metadata ?? {}) as Record<string, any>}
												<span
													class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase {contrib.paymentStatus === 'cancelled' || contrib.paymentStatus === 'refunded'
														? 'bg-rose-100 text-rose-800 border border-rose-200'
														: 'bg-gray-100 text-gray-600'}"
												>
													{contrib.paymentProvider || 'stripe'} •
													{contrib.paymentStatus === 'cancelled'
														? 'Pledge Cancelled'
														: contrib.paymentStatus === 'refunded'
															? 'Transfer Refunded'
															: contrib.paymentStatus}
													{#if meta.reversalOrSettlementReference}
														({meta.reversalOrSettlementReference})
													{/if}
												</span>
											{/if}
										</div>
										{#if contrib.comment}
											<p class="text-sm text-gray-700 bg-gray-50 rounded-xl px-3.5 py-2 border border-gray-100">
												"{contrib.comment}"
											</p>
										{/if}
									</div>
									<span class="text-xs text-gray-400 shrink-0">
										<Clock class="w-3 h-3 inline mr-1" />
										{new Date(contrib.createdAt).toLocaleDateString()}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			</div>

			<!-- Right Column (1/3 width = 4 cols, sticky #contribute anchor) -->
			<div class="lg:col-span-4 lg:sticky lg:top-6 scroll-mt-8">
				<ContributionPluginWidget
					{campaign}
					{currentUser}
					onContributed={() => void campaignQuery.refresh()}
				/>
			</div>
		</div>
	</div>
{/if}
