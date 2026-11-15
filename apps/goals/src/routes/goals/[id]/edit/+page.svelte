<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, Edit, Lock } from '@lucide/svelte';
	import { Button, LoadingSection, ErrorSection } from '@ac/ui';
	import { readGoalCampaign } from '../read.remote.js';
	import { updateGoalCampaign } from '../update.remote.js';
	import { getCurrentSessionUser } from '../../list.remote.js';
	import { updateGoalCampaignSchema } from '@ac/validations';
	import GoalForm from '#lib/components/goals/GoalForm.svelte';

	const campaignId = $derived(page.params.id as string);
	const campaignQuery = $derived(readGoalCampaign(campaignId));
	const sessionQuery = getCurrentSessionUser({});

	const campaign = $derived(campaignQuery.current);
	const currentUser = $derived(sessionQuery.current?.user ?? null);
	const isOperator = $derived(sessionQuery.current?.isOperator ?? false);
	const canEdit = $derived(
		Boolean(currentUser && (isOperator || (campaign && currentUser.id === campaign.userId)))
	);
</script>

<svelte:head>
	<title>{campaign ? `Edit ${campaign.title} | AC-Goals` : 'Edit Goal Campaign | AC-Goals'}</title>
</svelte:head>

<div class="max-w-5xl mx-auto space-y-6 pb-16">
	<div class="flex items-center justify-between">
		<a
			href="/goals/{campaignId}"
			class="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-emerald-700 transition-colors"
		>
			<ArrowLeft class="w-4 h-4" />
			Back to Campaign Page
		</a>
	</div>

	{#if (sessionQuery.loading && !sessionQuery.current) || (campaignQuery.loading && !campaign)}
		<LoadingSection message="Loading campaign for editing..." />
	{:else if !currentUser}
		<div class="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center space-y-5 shadow-sm">
			<div class="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
				<Lock class="w-7 h-7" />
			</div>
			<div class="space-y-2 max-w-xl mx-auto">
				<h1 class="text-xl font-bold text-gray-900">Authentication Required</h1>
				<p class="text-sm text-gray-600">
					Please sign in to edit this campaign.
				</p>
			</div>
			<Button href="/login?redirectTo={encodeURIComponent(page.url.pathname)}" variant="primary">
				Sign In to Edit
			</Button>
		</div>
	{:else if campaignQuery.error}
		<ErrorSection
			headline="Failed to load campaign"
			message={campaignQuery.error?.message || 'Unable to load campaign'}
			onRetry={() => void campaignQuery.refresh()}
		/>
	{:else if !campaign}
		<div class="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-4">
			<h1 class="text-xl font-bold text-gray-900">Campaign Not Found</h1>
			<Button href="/goals" variant="primary">Back to Campaigns</Button>
		</div>
	{:else if !canEdit}
		<div class="rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center space-y-5 shadow-sm">
			<div class="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
				<Lock class="w-7 h-7" />
			</div>
			<div class="space-y-2 max-w-xl mx-auto">
				<h1 class="text-xl font-bold text-gray-900">Access Denied</h1>
				<p class="text-sm text-gray-600">
					Only the campaign owner or an operator can edit this campaign.
				</p>
			</div>
			<Button href="/goals/{campaignId}" variant="outline">Back to Campaign</Button>
		</div>
	{:else}
		<div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-2">
			<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
				<Edit class="w-4 h-4" />
				Update Campaign Configuration
			</div>
			<h1 class="text-2xl sm:text-3xl font-black text-gray-900">
				Edit: {campaign.title}
			</h1>
			<p class="text-sm text-gray-600">
				Update the executive summary, primary & stretch goals, plugin configuration, tags, and locations.
			</p>
		</div>

		{#key campaign.id}
			<GoalForm
				remoteFunction={updateGoalCampaign}
				validationSchema={updateGoalCampaignSchema}
				isUpdating={true}
				initialData={campaign}
				{isOperator}
			/>
		{/key}
	{/if}
</div>
