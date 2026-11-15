<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		createTagSchema,
		updateTagSchema,
		createLocationSchema,
		updateLocationSchema,
		type GoalCampaign,
		type GoalContributionType,
		type GoalFinancialContributionMode,
		type Location
	} from '@ac/validations';
	import {
		TagManager,
		EntityManager,
		LocationForm,
		useFormValidationFeedback,
		Button
	} from '@ac/ui';
	import { toast } from 'svelte-sonner';
	import * as m from '#lib/paraglide/messages.js';
	import { listContributionPlugins, getContributionPlugin } from '#lib/plugins/registry.js';
	import { listTags } from '../../../routes/tags/list.remote.js';
	import { createTag } from '../../../routes/tags/new/create.remote.js';
	import { updateTag } from '../../../routes/tags/[id]/update.remote.js';
	import { readTag } from '../../../routes/tags/[id]/read.remote.js';
	import { deleteTag } from '../../../routes/tags/[id]/delete.remote.js';
	import {
		listTagCategories,
		createTagCategoryCommand,
		updateTagCategoryCommand,
		deleteTagCategoryAction
	} from '../../../routes/tags/categories.remote.js';
	import { listLocations } from '../../../routes/locations/list.remote.js';
	import { createLocation } from '../../../routes/locations/new/create.remote.js';
	import { updateLocation } from '../../../routes/locations/[id]/update.remote.js';
	import { readLocation } from '../../../routes/locations/[id]/read.remote.js';
	import { deleteLocation } from '../../../routes/locations/[id]/delete.remote.js';
	import {
		fetchEntityLocations,
		addLocationAssociation,
		removeLocationAssociation
	} from '../../../routes/locations/associate.remote.js';
	import { getLocationFilterGroups } from '#lib/filters/index.js';
	import {
		Sparkles,
		Target,
		Trophy,
		Plus,
		Trash2,
		MapPin,
		Tag as TagIcon,
		CreditCard,
		ShieldCheck,
		Save,
		Send
	} from '@lucide/svelte';

	interface StretchStageDraft {
		id?: string;
		title: string;
		description: string;
		targetAmount: number;
	}

	interface Props {
		remoteFunction: any;
		validationSchema: any;
		isUpdating?: boolean;
		initialData?: GoalCampaign | null;
		isOperator?: boolean;
	}

	let {
		remoteFunction,
		validationSchema,
		isUpdating = false,
		initialData = null,
		isOperator = false
	}: Props = $props();

	const rf = $derived((remoteFunction as any).preflight(validationSchema));
	useFormValidationFeedback(() => rf, {
		message: () => m.please_fix_validation()
	});

	const plugins = listContributionPlugins();

	// svelte-ignore state_referenced_locally
	let selectedPluginType = $state<GoalContributionType>(
		initialData?.contributionType || 'financial'
	);
	const activePlugin = $derived(getContributionPlugin(selectedPluginType));

	// svelte-ignore state_referenced_locally
	let unitLabelState = $state<string>(
		initialData?.unitLabel ||
			getContributionPlugin(initialData?.contributionType || 'financial').defaultUnitLabel
	);
	// svelte-ignore state_referenced_locally
	let currencyState = $state<string>(initialData?.currency || 'EUR');
	// svelte-ignore state_referenced_locally
	let paymentProviderState = $state<'stripe' | 'mollie' | 'adyen'>(
		(initialData?.pluginConfig?.paymentProvider as 'stripe' | 'mollie' | 'adyen') || 'stripe'
	);
	// svelte-ignore state_referenced_locally
	let financialModeState = $state<GoalFinancialContributionMode>(
		(initialData?.pluginConfig?.financialMode as GoalFinancialContributionMode) || 'both'
	);
	// svelte-ignore state_referenced_locally
	let captureStrategyState = $state<'all_or_nothing' | 'immediate'>(
		initialData?.pluginConfig?.captureStrategy || 'all_or_nothing'
	);

	// Primary Goal Stage State
	const initialPrimaryStage = $derived(
		initialData?.stages?.find((s) => s.stageType === 'primary')
	);
	// svelte-ignore state_referenced_locally
	let primaryTargetValue = $state<number>(
		Number(
			initialData?.stages?.find((s) => s.stageType === 'primary')?.targetAmount ??
				initialData?.primaryTarget ??
				getContributionPlugin(initialData?.contributionType || 'financial')
					.defaultPrimaryTarget
		)
	);
	// svelte-ignore state_referenced_locally
	let primaryGoalTitle = $state<string>(
		initialData?.stages?.find((s) => s.stageType === 'primary')?.title ||
			'Primary Goal: Core Implementation Milestone'
	);
	// svelte-ignore state_referenced_locally
	let primaryGoalDescription = $state<string>(
		initialData?.stages?.find((s) => s.stageType === 'primary')?.description ||
			'Unlocks core execution of this goal campaign.'
	);

	// Stretch Goal Stages State
	function buildInitialStretchStages(): StretchStageDraft[] {
		const existingStretches = (initialData?.stages ?? []).filter(
			(s) => s.stageType === 'stretch'
		);
		if (existingStretches.length > 0) {
			return existingStretches.map((s) => ({
				id: s.id,
				title: s.title,
				description: s.description || '',
				targetAmount: Number(s.targetAmount)
			}));
		}
		if (initialData?.id) return [];
		return [
			{
				title: 'Stretch Goal #1: Expanded Community Scope',
				description: 'Unlocks extended capacity and bonus deliverables.',
				targetAmount: Math.round(primaryTargetValue * 1.6)
			}
		];
	}

	let stretchStages = $state<StretchStageDraft[]>(buildInitialStretchStages());

	function addStretchStage() {
		const highest = Math.max(
			primaryTargetValue,
			...stretchStages.map((s) => Number(s.targetAmount) || 0)
		);
		stretchStages = [
			...stretchStages,
			{
				title: `Stretch Goal #${stretchStages.length + 1}`,
				description: '',
				targetAmount: Math.round(highest * 1.5)
			}
		];
	}

	function removeStretchStage(index: number) {
		stretchStages = stretchStages.filter((_, i) => i !== index);
	}

	const stretchGoalsJsonStr = $derived(
		JSON.stringify(
			stretchStages.map((s, idx) => ({
				id: s.id,
				stageType: 'stretch',
				sortOrder: idx + 1,
				title: s.title,
				description: s.description,
				targetAmount: Number(s.targetAmount) || 1
			}))
		)
	);

	const pluginConfigJsonStr = $derived(
		JSON.stringify({
			...activePlugin.defaultConfig,
			...(initialData?.pluginConfig ?? {}),
			paymentProvider: paymentProviderState,
			financialMode: financialModeState,
			captureStrategy:
				financialModeState === 'transfer_only'
					? 'immediate'
					: financialModeState === 'pledge_only'
						? 'all_or_nothing'
						: captureStrategyState
		})
	);

	// Tags & Locations state (managed outside <form> so internal search inputs never cause form_field_unbound)
	// svelte-ignore state_referenced_locally
	let selectedTagNames = $state<string[]>(
		initialData?.tagNames ?? (initialData?.tags ?? []).map((t) => t.name)
	);
	// svelte-ignore state_referenced_locally
	let selectedLocationIds = $state<string[]>(
		initialData?.locationIds ?? (initialData?.locations ?? []).map((l) => l.id)
	);

	const tagsCsvStr = $derived(selectedTagNames.join(', '));
	const locationIdsJsonStr = $derived(JSON.stringify(selectedLocationIds));

	// Operator showcase toggle & submission intent
	// svelte-ignore state_referenced_locally
	let isShowcasedState = $state<boolean>(initialData?.isShowcased ?? false);
	let submitActionState = $state<'draft' | 'publish'>('publish');
	let isSubmitting = $state(false);

	const tagCategoriesQuery = $derived(listTagCategories({ limit: 100 }));
	const availableTagCategories = $derived(tagCategoriesQuery.current?.data ?? []);

	function handleSelectPlugin(pluginId: GoalContributionType) {
		selectedPluginType = pluginId;
		const manifest = getContributionPlugin(pluginId);
		unitLabelState = manifest.defaultUnitLabel;
		if (!isUpdating) {
			primaryTargetValue = manifest.defaultPrimaryTarget;
		}
	}
</script>

<div class="space-y-8">
	<!-- Embedded Categorization & Locations Card (Placed outside <form> to keep internal search inputs isolated) -->
	<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
		<div>
			<h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
				<TagIcon class="w-5 h-5 text-indigo-600" />
				Tag Categorization & Associated Locations
			</h2>
			<p class="text-xs text-gray-600 mt-1">
				Associate tags and physical locations with this goal campaign (reusing the shared TagManager and Location EntityManager patterns) so users can filter and discover it.
			</p>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- TagManager -->
			<div class="space-y-2">
				<h3 class="text-sm font-bold text-gray-800 flex items-center gap-1.5">
					<TagIcon class="w-4 h-4 text-indigo-600" />
					Campaign Tags
				</h3>
				{#key initialData?.id || 'new-tags'}
					<TagManager
						title="Campaign Tags"
						icon={TagIcon}
						mode="embedded"
						preferenceKey="em_filters_goal_tags"
						initialItems={initialData?.tags || []}
						listItemsRemote={listTags}
						onchange={(_ids: any, items: any[]) => {
							selectedTagNames = (items || []).map((i: any) => String(i.name));
						}}
						createRemote={createTag}
						createSchema={createTagSchema}
						updateRemote={updateTag}
						updateSchema={updateTagSchema}
						readItemRemote={readTag}
						deleteItemRemote={deleteTag}
						categories={availableTagCategories}
						categoriesRemote={listTagCategories}
						createCategoryRemote={createTagCategoryCommand}
						updateCategoryRemote={updateTagCategoryCommand}
						deleteCategoryRemote={deleteTagCategoryAction}
						onCategoryCreated={() => {
							void tagCategoriesQuery.refresh();
						}}
						onCategoryUpdated={() => {
							void tagCategoriesQuery.refresh();
						}}
						onCategoryDeleted={() => {
							void tagCategoriesQuery.refresh();
						}}
						{m}
					/>
				{/key}
			</div>

			<!-- Location EntityManager -->
			<div class="space-y-2">
				<h3 class="text-sm font-bold text-gray-800 flex items-center gap-1.5">
					<MapPin class="w-4 h-4 text-blue-600" />
					Associated Locations
				</h3>
				{#key initialData?.id || 'new-locations'}
					<EntityManager
						{m}
						title={m.feature_locations_title()}
						icon={MapPin}
						mode="embedded"
						type="goal"
						entityId={initialData?.id}
						initialItems={initialData?.locations || []}
						filters={getLocationFilterGroups(m)}
						listItemsRemote={listLocations as any}
						fetchAssociationsRemote={fetchEntityLocations as any}
						addAssociationRemote={async (p: any) =>
							addLocationAssociation({
								...p,
								locationId: p.itemId
							} as any)}
						removeAssociationRemote={async (p: any) =>
							removeLocationAssociation({
								...p,
								locationId: p.itemId
							} as any)}
						onchange={(ids: string[]) => {
							selectedLocationIds = ids;
						}}
						deleteItemRemote={deleteLocation}
						createRemote={createLocation}
						createSchema={createLocationSchema}
						updateRemote={updateLocation}
						updateSchema={updateLocationSchema}
						readItemRemote={readLocation}
						searchPredicate={(l: Location, q: string) =>
							l.name.toLowerCase().includes(q.toLowerCase()) ||
							(l.city?.toLowerCase().includes(q.toLowerCase()) ?? false)}
					>
						{#snippet renderItemLabel(locationItem: any)}
							{locationItem.name}
							{locationItem.city ? `(${locationItem.city})` : ''}
						{/snippet}

						{#snippet renderForm({
							remoteFunction: rfLoc,
							schema: locSchema,
							id: locId,
							initialData: locFormData = null,
							onSuccess: locSuccess,
							onCancel: locCancel
						}: any)}
							<LocationForm
								remoteFunction={rfLoc}
								validationSchema={locSchema}
								isUpdating={!!locId}
								initialData={locFormData}
								onSuccess={locSuccess}
								onCancel={locCancel}
							/>
						{/snippet}
					</EntityManager>
				{/key}
			</div>
		</div>
	</div>

	<!-- Main Campaign Remote Form -->
	<form
		{...rf.enhance(async ({ submit }: { submit: () => Promise<any> }) => {
			isSubmitting = true;
			try {
				const res = await submit();
				if (res && res.success !== false) {
					const targetId = res?.id || initialData?.id;
					if (!isOperator && submitActionState === 'publish') {
						toast.success('Campaign submitted for operator approval!');
					} else if (submitActionState === 'draft') {
						toast.success('Campaign saved as draft.');
					} else {
						toast.success(
							isUpdating ? 'Campaign updated successfully!' : 'Campaign published!'
						);
					}
					if (targetId) {
						await goto(`/goals/${targetId}`);
					} else {
						await goto('/goals');
					}
				}
			} catch (err: any) {
				toast.error(err?.message || m.something_went_wrong());
			} finally {
				isSubmitting = false;
			}
		})}
		class="space-y-8"
	>
		<!-- Bound Hidden Fields (NO raw name attributes anywhere!) -->
		{#if isUpdating && initialData?.id && rf.fields.id}
			<input {...rf.fields.id.as('hidden', initialData.id)} />
		{/if}
		{#if selectedPluginType}
			<input {...rf.fields.contributionType.as('hidden', selectedPluginType)} />
		{/if}
		{#if String(primaryTargetValue)}
			<input {...rf.fields.primaryTarget.as('hidden', String(primaryTargetValue))} />
		{/if}
		{#if primaryGoalTitle}
			<input {...rf.fields.primaryGoalTitle.as('hidden', primaryGoalTitle)} />
		{/if}
		{#if primaryGoalDescription !== undefined}
			<input {...rf.fields.primaryGoalDescription.as('hidden', primaryGoalDescription)} />
		{/if}
		{#if currencyState}
			<input {...rf.fields.currency.as('hidden', currencyState)} />
		{/if}
		{#if unitLabelState}
			<input {...rf.fields.unitLabel.as('hidden', unitLabelState)} />
		{/if}
		{#if stretchGoalsJsonStr}
			<input {...rf.fields.stretchGoalsJson.as('hidden', stretchGoalsJsonStr)} />
		{/if}
		{#if pluginConfigJsonStr}
			<input {...rf.fields.pluginConfigJson.as('hidden', pluginConfigJsonStr)} />
		{/if}
		{#if tagsCsvStr !== undefined}
			<input {...rf.fields.tags.as('hidden', tagsCsvStr)} />
		{/if}
		{#if locationIdsJsonStr}
			<input {...rf.fields.locationIds.as('hidden', locationIdsJsonStr)} />
		{/if}
		{#if rf.fields.isShowcased}
			<input
				{...rf.fields.isShowcased.as('hidden', isShowcasedState ? 'true' : 'false')}
			/>
		{/if}
		{#if !isUpdating && rf.fields.submitAction}
			<input {...rf.fields.submitAction.as('hidden', submitActionState)} />
		{/if}

		<!-- Section 1: Core Identity & Executive Summary -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
			<h2 class="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
				<Sparkles class="w-5 h-5 text-emerald-600" />
				1. Campaign Identity & Executive Summary
			</h2>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="md:col-span-2 space-y-1.5">
					<label for="goal-title" class="block text-sm font-bold text-gray-800">
						Campaign Title <span class="text-rose-500">*</span>
					</label>
					<input
						id="goal-title"
						{...rf.fields.title.as('text', initialData?.title ?? '')}
						placeholder="e.g. Community Solar Microgrid & Open Charging Station"
						onblur={() => void rf.validate().catch(() => {})}
						class="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
					/>
					{#each rf.fields.title.issues() ?? [] as issue (issue.message)}
						<p class="text-xs font-medium text-rose-600">{issue.message}</p>
					{/each}
				</div>

				<div class="space-y-1.5">
					<label for="goal-creator-name" class="block text-sm font-bold text-gray-800">
						Organizer / Initiative Name
					</label>
					<input
						id="goal-creator-name"
						{...rf.fields.creatorName.as('text', initialData?.creatorName ?? '')}
						placeholder="e.g. Neighborhood Mobility Initiative"
						class="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="goal-hero-image" class="block text-sm font-bold text-gray-800">
						Hero Image URL
					</label>
					<input
						id="goal-hero-image"
						{...rf.fields.heroImage.as('text', initialData?.heroImage ?? '')}
						placeholder="https://images.unsplash.com/..."
						class="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
					/>
				</div>

				<div class="md:col-span-2 space-y-1.5">
					<label
						for="goal-executive-summary"
						class="block text-sm font-bold text-gray-800"
					>
						Executive Summary (Displayed prominently on Showcase, Cards & Campaign Header)
						<span class="text-rose-500">*</span>
					</label>
					<textarea
						id="goal-executive-summary"
						rows="3"
						{...rf.fields.executiveSummary.as(
							'text',
							initialData?.executiveSummary ?? ''
						)}
						placeholder="Concise 1-2 sentence executive pitch explaining what this goal achieves and why every contribution counts..."
						onblur={() => void rf.validate().catch(() => {})}
						class="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
					></textarea>
					{#each rf.fields.executiveSummary.issues() ?? [] as issue (issue.message)}
						<p class="text-xs font-medium text-rose-600">{issue.message}</p>
					{/each}
				</div>

				<div class="md:col-span-2 space-y-1.5">
					<label for="goal-description" class="block text-sm font-bold text-gray-800">
						Full Campaign Story & Implementation Plan <span class="text-rose-500">*</span>
					</label>
					<textarea
						id="goal-description"
						rows="5"
						{...rf.fields.description.as('text', initialData?.description ?? '')}
						placeholder="Provide full background context, budget breakdown, or petition demands..."
						onblur={() => void rf.validate().catch(() => {})}
						class="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
					></textarea>
					{#each rf.fields.description.issues() ?? [] as issue (issue.message)}
						<p class="text-xs font-medium text-rose-600">{issue.message}</p>
					{/each}
				</div>

				<div class="space-y-1.5">
					<label for="goal-start-date" class="block text-sm font-bold text-gray-800">
						Start Date
					</label>
					<input
						id="goal-start-date"
						{...rf.fields.startDate.as(
							'date',
							initialData?.startDate ? initialData.startDate.slice(0, 10) : ''
						)}
						class="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="goal-end-date" class="block text-sm font-bold text-gray-800">
						Target Deadline / End Date
					</label>
					<input
						id="goal-end-date"
						{...rf.fields.endDate.as(
							'date',
							initialData?.endDate ? initialData.endDate.slice(0, 10) : ''
						)}
						class="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900"
					/>
				</div>
			</div>
		</div>

		<!-- Section 2: Contribution Plugin Selection -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
			<h2 class="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
				<CreditCard class="w-5 h-5 text-indigo-600" />
				2. Modular Contribution Plugin
			</h2>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				{#each plugins as p (p.id)}
					<button
						type="button"
						onclick={() => handleSelectPlugin(p.id)}
						class="cursor-pointer rounded-2xl border p-4 text-left transition-all {selectedPluginType ===
						p.id
							? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/30 shadow-xs'
							: 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}"
					>
						<div class="flex items-center justify-between gap-2 mb-2">
							<span
								class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold {p.badgeBgClass} {p.badgeTextClass}"
							>
								{p.shortName}
							</span>
							{#if selectedPluginType === p.id}
								<span class="text-xs font-extrabold text-indigo-700">Selected</span>
							{/if}
						</div>
						<p class="text-sm font-bold text-gray-900">{p.name}</p>
						<p class="text-xs text-gray-600 mt-1 leading-relaxed">{p.tagline}</p>
					</button>
				{/each}
			</div>

			{#if selectedPluginType === 'financial'}
				<div class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-4">
					<!-- Financial Contribution Mode Selector: Pledges vs. Actual Transfers -->
					<div class="space-y-2">
						<span class="block text-xs font-bold uppercase tracking-wider text-emerald-900">
							Financial Contribution Mode (Pledges vs. Actual Transfers)
						</span>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
							{#each [
								{
									id: 'both',
									title: 'Request Both Pledges & Transfers',
									desc: 'Supporters can choose between a conditional Financial Pledge or an immediate Actual Transfer.'
								},
								{
									id: 'pledge_only',
									title: 'Request Financial Pledges Only',
									desc: 'Authorized commitments held until goal completion; automatically cancelled with zero charge if cancelled or unsuccessful.'
								},
								{
									id: 'transfer_only',
									title: 'Request Actual Transfers Only',
									desc: 'Immediate funds transfer into escrow; automatically refunded if campaign is cancelled or unsuccessful.'
								}
							] as modeOpt (modeOpt.id)}
								<button
									type="button"
									onclick={() => {
										financialModeState = modeOpt.id as GoalFinancialContributionMode;
										if (modeOpt.id === 'transfer_only') captureStrategyState = 'immediate';
										if (modeOpt.id === 'pledge_only') captureStrategyState = 'all_or_nothing';
									}}
									class="cursor-pointer rounded-xl border p-3 text-left transition-all {financialModeState ===
									modeOpt.id
										? 'border-emerald-600 bg-white ring-2 ring-emerald-500/30 shadow-2xs'
										: 'border-emerald-200/80 bg-white/70 hover:bg-white'}"
								>
									<div class="flex items-center justify-between gap-2">
										<span class="text-xs font-extrabold text-gray-900">{modeOpt.title}</span>
										{#if financialModeState === modeOpt.id}
											<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
												Active
											</span>
										{/if}
									</div>
									<p class="mt-1 text-[11px] leading-relaxed text-gray-600">{modeOpt.desc}</p>
								</button>
							{/each}
						</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-emerald-200/60">
						<div class="space-y-1">
							<span class="block text-xs font-bold uppercase tracking-wider text-emerald-900">
								Payment Provider
							</span>
							<div class="flex gap-1.5">
								{#each [
									{ id: 'stripe', label: 'Stripe Connect' },
									{ id: 'mollie', label: 'Mollie' },
									{ id: 'adyen', label: 'Adyen' }
								] as prov (prov.id)}
									<button
										type="button"
										onclick={() => (paymentProviderState = prov.id as any)}
										class="flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors {paymentProviderState ===
										prov.id
											? 'border-emerald-600 bg-emerald-600 text-white'
											: 'border-gray-300 bg-white text-gray-700'}"
									>
										{prov.label}
									</button>
								{/each}
							</div>
						</div>

						<div class="space-y-1">
							<span class="block text-xs font-bold uppercase tracking-wider text-emerald-900">
								Default Settlement Strategy
							</span>
							<div class="flex gap-1.5">
								<button
									type="button"
									onclick={() => (captureStrategyState = 'all_or_nothing')}
									class="flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold {captureStrategyState ===
									'all_or_nothing'
										? 'border-emerald-600 bg-emerald-600 text-white'
										: 'border-gray-300 bg-white text-gray-700'}"
								>
									All-or-Nothing Escrow
								</button>
								<button
									type="button"
									onclick={() => (captureStrategyState = 'immediate')}
									class="flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold {captureStrategyState ===
									'immediate'
										? 'border-emerald-600 bg-emerald-600 text-white'
										: 'border-gray-300 bg-white text-gray-700'}"
								>
									Immediate Capture
								</button>
							</div>
						</div>

						<div class="space-y-1">
							<label for="goal-currency-input" class="block text-xs font-bold uppercase tracking-wider text-emerald-900">
								Currency
							</label>
							<input
								id="goal-currency-input"
								type="text"
								bind:value={currencyState}
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase"
							/>
						</div>
					</div>
				</div>
			{:else}
				<div class="max-w-xs space-y-1">
					<label for="goal-unit-label-input" class="block text-xs font-bold text-gray-700">
						Contribution Unit Label (e.g. votes, signatures, participants)
					</label>
					<input
						id="goal-unit-label-input"
						type="text"
						bind:value={unitLabelState}
						class="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
					/>
				</div>
			{/if}
		</div>

		<!-- Section 3: Primary Goal & Stretch Goals Roadmap Builder -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
				<div>
					<h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
						<Target class="w-5 h-5 text-emerald-600" />
						3. Primary Goal & Stretch Goals Stages
					</h2>
					<p class="text-xs text-gray-600">
						Configure the Primary Goal threshold and optional Stretch Goals that unlock as contributions grow.
					</p>
				</div>

				<Button
					type="button"
					variant="outline"
					onclick={addStretchStage}
					class="inline-flex items-center gap-1.5 text-xs font-bold"
				>
					<Plus class="w-4 h-4 text-violet-600" />
					Add Stretch Goal Stage
				</Button>
			</div>

			<!-- Primary Goal Card (UI-only inputs bound to reactive state, synced via hidden fields above) -->
			<div class="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
				<div class="flex items-center justify-between">
					<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-extrabold text-white uppercase">
						<Target class="w-3.5 h-3.5" />
						Primary Goal (Stage 1)
					</span>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div class="md:col-span-2 space-y-1">
						<label for="primary-stage-title" class="block text-xs font-bold text-gray-800">
							Primary Goal Title
						</label>
						<input
							id="primary-stage-title"
							type="text"
							bind:value={primaryGoalTitle}
							placeholder="e.g. Primary Goal: 45 kWp Rooftop Solar Array"
							class="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-900"
						/>
					</div>

					<div class="space-y-1">
						<label for="primary-stage-target" class="block text-xs font-bold text-gray-800">
							Target Threshold ({selectedPluginType === 'financial' ? currencyState : unitLabelState})
						</label>
						<input
							id="primary-stage-target"
							type="number"
							min="1"
							bind:value={primaryTargetValue}
							class="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-extrabold text-emerald-900"
						/>
					</div>

					<div class="md:col-span-3 space-y-1">
						<label for="primary-stage-desc" class="block text-xs font-bold text-gray-800">
							What Unlocks When Primary Goal Is Reached
						</label>
						<input
							id="primary-stage-desc"
							type="text"
							bind:value={primaryGoalDescription}
							placeholder="Describe the core deliverable guaranteed once this primary threshold is met..."
							class="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-800"
						/>
					</div>
				</div>
			</div>

			<!-- Stretch Goals List -->
			{#if stretchStages.length > 0}
				<div class="space-y-4">
					{#each stretchStages as st, idx (idx)}
						<div class="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 space-y-4">
							<div class="flex items-center justify-between">
								<span class="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-0.5 text-xs font-extrabold text-white uppercase">
									<Trophy class="w-3.5 h-3.5" />
									Stretch Goal #{idx + 1}
								</span>

								<button
									type="button"
									onclick={() => removeStretchStage(idx)}
									class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
								>
									<Trash2 class="w-3.5 h-3.5" />
									Remove
								</button>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div class="md:col-span-2 space-y-1">
									<label
										for="stretch-title-{idx}"
										class="block text-xs font-bold text-gray-800"
									>
										Stretch Goal Title
									</label>
									<input
										id="stretch-title-{idx}"
										type="text"
										bind:value={st.title}
										placeholder="e.g. Stretch Goal #1: 30 kWh Evening Battery Storage"
										class="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-900"
									/>
								</div>

								<div class="space-y-1">
									<label
										for="stretch-target-{idx}"
										class="block text-xs font-bold text-gray-800"
									>
										Cumulative Target ({selectedPluginType === 'financial' ? currencyState : unitLabelState})
									</label>
									<input
										id="stretch-target-{idx}"
										type="number"
										min="1"
										bind:value={st.targetAmount}
										class="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-extrabold text-violet-900"
									/>
								</div>

								<div class="md:col-span-3 space-y-1">
									<label
										for="stretch-desc-{idx}"
										class="block text-xs font-bold text-gray-800"
									>
										Bonus Deliverable / Stretch Unlock Description
									</label>
									<input
										id="stretch-desc-{idx}"
										type="text"
										bind:value={st.description}
										placeholder="Explain the extra impact unlocked when participants push past the primary goal..."
										class="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-800"
									/>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Operator Showcase Controls (if operator) & Submission Footer -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
			{#if isOperator}
				<div class="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
					<div class="flex items-center gap-3">
						<ShieldCheck class="w-5 h-5 text-indigo-600 shrink-0" />
						<div>
							<p class="text-sm font-bold text-gray-900">
								Feature in Top Operator Showcase
							</p>
							<p class="text-xs text-gray-600">
								Pin this campaign to the top Showcase section when Operator Choice or Mixed mode is active.
							</p>
						</div>
					</div>
					<button
						type="button"
						onclick={() => (isShowcasedState = !isShowcasedState)}
						class="rounded-xl px-4 py-2 text-xs font-extrabold transition-colors {isShowcasedState
							? 'bg-indigo-600 text-white'
							: 'border border-gray-300 bg-white text-gray-700'}"
					>
						{isShowcasedState ? 'Pinned to Showcase ★' : 'Not Showcased'}
					</button>
				</div>
			{:else}
				<div class="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
					<strong>Community Approval Workflow:</strong> Community-supplied goals are reviewed by internal operators before going live in public discovery. You can save as a draft or submit directly for operator approval.
				</div>
			{/if}

			<div class="flex flex-wrap items-center justify-end gap-3 pt-2">
				<a
					href={initialData?.id ? `/goals/${initialData.id}` : '/goals'}
					class="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</a>

				<button
					type="submit"
					disabled={isSubmitting}
					onclick={() => (submitActionState = 'draft')}
					class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
				>
					<Save class="w-4 h-4" />
					Save as Draft
				</button>

				<button
					type="submit"
					disabled={isSubmitting}
					onclick={() => (submitActionState = 'publish')}
					class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-extrabold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
				>
					<Send class="w-4 h-4" />
					{#if isUpdating}
						Save & Update Campaign
					{:else if isOperator}
						Publish Campaign Immediately
					{:else}
						Submit for Operator Approval
					{/if}
				</button>
			</div>
		</div>
	</form>
</div>
