<script lang="ts">
	import {
		createGoalContributionSchema,
		type GoalCampaign
	} from '@ac/validations';
	import { useFormValidationFeedback } from '@ac/ui';
	import { toast } from 'svelte-sonner';
	import * as m from '#lib/paraglide/messages.js';
	import { getContributionPlugin } from '#lib/plugins/registry.js';
	import { contributeToGoalCampaign } from '../../../routes/goals/[id]/contribute.remote.js';
	import { getPaymentProviderProposals } from '../../../routes/goals/[id]/read.remote.js';
	import {
		ShieldCheck,
		CreditCard,
		Vote,
		Users,
		Lock,
		Sparkles,
		CheckCircle2,
		ChevronDown,
		ChevronUp,
		LogIn,
		UserPlus,
		AlertCircle
	} from '@lucide/svelte';

	interface Props {
		campaign: GoalCampaign;
		currentUser: { id: string; name: string; email: string } | null;
		onContributed?: () => void;
	}

	let {
		campaign,
		currentUser = null,
		onContributed = undefined
	}: Props = $props();

	const plugin = $derived(getContributionPlugin(campaign.contributionType));
	const unitLabel = $derived(
		(campaign as any).contributionUnitLabel || campaign.unitLabel || plugin.defaultUnitLabel
	);

	function formatValue(val: number): string {
		return plugin.formatValue(Number(val || 0), campaign.currency || 'EUR', unitLabel);
	}

	const rf = $derived((contributeToGoalCampaign as any).preflight(createGoalContributionSchema));
	useFormValidationFeedback(() => rf, {
		message: () => m.please_fix_validation()
	});

	const proposalsQuery = getPaymentProviderProposals({});
	const paymentProposals = $derived(proposalsQuery.current ?? []);

	const presetAmounts = $derived<number[]>(
		(campaign.pluginConfig as any)?.presetAmounts ??
			(campaign.pluginConfig?.suggestedTiers?.map((t) => t.amount) || [10, 25, 50, 100, 250])
	);
	const rewardTiers = $derived<
		Array<{ amount: number; label: string; rewardDescription?: string }>
	>(
		(campaign.pluginConfig as any)?.rewardTiers ??
			campaign.pluginConfig?.suggestedTiers ??
			[]
	);
	const availableRoles = $derived<string[]>(
		(campaign.pluginConfig as any)?.availableRoles ?? [
			'Active Participant',
			'Workshop / Event Volunteer',
			'Logistics & Setup Support',
			'Mentor / Specialist'
		]
	);

	let customContributionValue = $state<number | null>(null);
	const contributionValue = $derived(
		customContributionValue ?? (campaign.contributionType === 'financial' ? 25 : 1)
	);
	let selectedTierLabel = $state<string>('');
	let selectedPaymentMethod = $state<'card' | 'sepa_debit' | 'instant_bank'>('card');
	const selectedPaymentProvider = $derived<'stripe' | 'mollie' | 'adyen'>(
		(campaign.pluginConfig?.paymentProvider as 'stripe' | 'mollie' | 'adyen') || 'stripe'
	);
	const financialMode = $derived<'both' | 'pledge_only' | 'transfer_only'>(
		(campaign.pluginConfig?.financialMode as 'both' | 'pledge_only' | 'transfer_only') ??
			(campaign.pluginConfig?.captureStrategy === 'immediate' ? 'transfer_only' : 'both')
	);
	let selectedFinancialType = $state<'pledge' | 'transfer'>('pledge');
	const effectiveFinancialType = $derived<'pledge' | 'transfer'>(
		financialMode === 'pledge_only'
			? 'pledge'
			: financialMode === 'transfer_only'
				? 'transfer'
				: selectedFinancialType
	);
	let commitmentRole = $state<string>('Active Participant');
	let availabilityNote = $state<string>('');
	let customVoteReason = $state<string | null>(null);
	const voteReason = $derived<string>(
		customVoteReason ??
			(campaign.pluginConfig?.voteStatement ||
				'I support this goal campaign and endorse its implementation.')
	);
	let showProviderArchitecture = $state(false);
	let isSubmitting = $state(false);

	function selectFinancialPreset(amount: number, tierLabel = '') {
		customContributionValue = amount;
		selectedTierLabel = tierLabel;
	}
</script>

<div
	id="contribute"
	class="rounded-3xl border border-indigo-200 bg-white p-6 shadow-md space-y-6"
>
	<!-- Header -->
	<div class="space-y-1.5 border-b border-slate-100 pb-4">
		<div class="flex items-center justify-between gap-2">
			<span
				class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold {plugin.badgeBgClass} {plugin.badgeTextClass}"
			>
				{plugin.name}
			</span>
			<span class="text-xs font-semibold text-slate-500">
				Registered Participation
			</span>
		</div>
		<h3 class="text-xl font-black text-slate-900">
			{(campaign as any).ctaHeadline || `Contribute to "${campaign.title}"`}
		</h3>
		<p class="text-xs leading-relaxed text-slate-600">
			{plugin.description}
		</p>
	</div>

	{#if !currentUser}
		<!-- Guest Callout: Registration / Sign-In Required -->
		<div
			class="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 space-y-4"
		>
			<div class="flex items-start gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"
				>
					<Lock class="h-5 w-5" />
				</div>
				<div class="space-y-1">
					<h4 class="text-sm font-extrabold text-slate-900">
						Register or Sign In to Participate
					</h4>
					<p class="text-xs leading-relaxed text-slate-600">
						External visitors and internal operators must be registered to cast verified votes, sign up for participation slots, or pledge financial backing.
					</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2.5">
				<a
					href="/signup"
					class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-indigo-500"
				>
					<UserPlus class="h-4 w-4" />
					Register Free Account
				</a>
				<a
					href="/login"
					class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
				>
					<LogIn class="h-4 w-4" />
					Sign In
				</a>
			</div>
		</div>
	{:else if campaign.status !== 'published'}
		<!-- Non-Published Notice -->
		<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1.5">
			<div class="flex items-center gap-2 font-bold">
				<AlertCircle class="h-4 w-4 text-amber-600" />
				Campaign Currently Not Accepting New Contributions
			</div>
			<p>
				This campaign is currently in <strong>{campaign.status.replace(/_/g, ' ')}</strong> status. Only published campaigns accept live contributions.
			</p>
		</div>
	{:else}
		<!-- Active Contribution Remote Form -->
		<form
			{...rf.enhance(async ({ submit }: { submit: () => Promise<any> }) => {
				isSubmitting = true;
				try {
					const res = await submit();
					if (res && res.success !== false) {
						toast.success('Thank you! Your contribution has been recorded.');
						onContributed?.();
					}
				} catch (err: any) {
					toast.error(err?.message || m.something_went_wrong());
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-5"
		>
			<!-- Bound Hidden Fields (No handwritten name attributes anywhere!) -->
			{#if campaign.id}
				<input {...rf.fields.campaignId.as('hidden', campaign.id)} />
			{/if}
			{#if campaign.contributionType}
				<input {...rf.fields.pluginType.as('hidden', campaign.contributionType)} />
			{/if}
			{#if String(contributionValue)}
				<input {...rf.fields.amount.as('hidden', String(contributionValue))} />
			{/if}
			{#if selectedPaymentProvider}
				<input {...rf.fields.paymentProvider.as('hidden', selectedPaymentProvider)} />
			{/if}
			{#if effectiveFinancialType && rf.fields.financialType}
				<input {...rf.fields.financialType.as('hidden', effectiveFinancialType)} />
			{/if}
			{#if selectedTierLabel}
				<input {...rf.fields.selectedTierLabel.as('hidden', selectedTierLabel)} />
			{/if}
			{#if commitmentRole}
				<input {...rf.fields.commitmentRole.as('hidden', commitmentRole)} />
			{/if}
			{#if availabilityNote}
				<input {...rf.fields.availabilityNote.as('hidden', availabilityNote)} />
			{/if}

			<!-- PLUGIN 1: FINANCIAL CROWDFUNDING -->
			{#if campaign.contributionType === 'financial'}
				<div class="space-y-4">
					<!-- Financial Contribution Type: Pledge vs. Actual Transfer -->
					{#if financialMode === 'both'}
						<div class="space-y-2">
							<span class="block text-xs font-bold tracking-wide text-slate-700 uppercase">
								Choose Contribution Type: Pledge vs. Actual Transfer
							</span>
							<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
								<button
									type="button"
									onclick={() => (selectedFinancialType = 'pledge')}
									class="cursor-pointer rounded-xl border p-3 text-left transition-all {effectiveFinancialType === 'pledge'
										? 'border-indigo-600 bg-indigo-50/80 ring-1 ring-indigo-500'
										: 'border-slate-200 bg-white hover:border-indigo-200'}"
								>
									<div class="flex items-center justify-between gap-2">
										<span class="text-xs font-extrabold text-slate-900">
											Financial Pledge
										</span>
										<span class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-800">
											Authorized Hold
										</span>
									</div>
									<p class="mt-1 text-[11px] leading-relaxed text-slate-600">
										Conditional commitment held until goal completion. Automatically cancelled with zero charge if the campaign is cancelled or unsuccessful.
									</p>
								</button>

								<button
									type="button"
									onclick={() => (selectedFinancialType = 'transfer')}
									class="cursor-pointer rounded-xl border p-3 text-left transition-all {effectiveFinancialType === 'transfer'
										? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-500'
										: 'border-slate-200 bg-white hover:border-emerald-200'}"
								>
									<div class="flex items-center justify-between gap-2">
										<span class="text-xs font-extrabold text-slate-900">
											Actual Transfer
										</span>
										<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900">
											Immediate Escrow
										</span>
									</div>
									<p class="mt-1 text-[11px] leading-relaxed text-slate-600">
										Immediate payment transfer into campaign escrow. Automatically refunded in full if the campaign is cancelled or unsuccessful.
									</p>
								</button>
							</div>
						</div>
					{:else if financialMode === 'pledge_only'}
						<div class="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-950 space-y-1">
							<div class="flex items-center justify-between gap-2">
								<span class="font-extrabold">Mode: Financial Pledges Only</span>
								<span class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-800">
									Zero-Charge Cancellation Guarantee
								</span>
							</div>
							<p class="text-[11px] text-indigo-900/90">
								This campaign collects conditional financial pledges. Your pledge is only captured when the goal succeeds and is automatically cancelled if the campaign is cancelled or unsuccessful.
							</p>
						</div>
					{:else}
						<div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 space-y-1">
							<div class="flex items-center justify-between gap-2">
								<span class="font-extrabold">Mode: Actual Transfers Only</span>
								<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900">
									Automatic Refund Guarantee
								</span>
							</div>
							<p class="text-[11px] text-emerald-900/90">
								This campaign collects immediate financial transfers into escrow. Your transfer is automatically refunded in full if the campaign is cancelled or completed unsuccessfully.
							</p>
						</div>
					{/if}

					<div class="space-y-2">
						<span class="block text-xs font-bold tracking-wide text-slate-700 uppercase">
							Select {effectiveFinancialType === 'transfer' ? 'Transfer' : 'Pledge'} Amount ({campaign.currency || 'EUR'})
						</span>
						<div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
							{#each presetAmounts as preset (preset)}
								<button
									type="button"
									onclick={() => selectFinancialPreset(preset)}
									class="cursor-pointer rounded-xl border px-3 py-2 text-xs font-extrabold transition-all {contributionValue === preset && !selectedTierLabel
										? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
										: 'border-slate-200 bg-slate-50 text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/50'}"
								>
									{formatValue(preset)}
								</button>
							{/each}
						</div>
					</div>

					<!-- UI-only custom amount input (NO name attribute!) -->
					<div class="space-y-1.5">
						<label for="goal-custom-amount-input" class="block text-xs font-semibold text-slate-700">
							Or enter custom pledge amount ({campaign.currency || 'EUR'})
						</label>
						<input
							id="goal-custom-amount-input"
							type="number"
							min={campaign.pluginConfig?.minContribution ?? 1}
							step="1"
							value={contributionValue}
							oninput={(e) => {
								customContributionValue = Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1);
								selectedTierLabel = '';
							}}
							class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
						/>
					</div>

					<!-- Optional Reward Tiers -->
					{#if rewardTiers.length > 0}
						<div class="space-y-2">
							<span class="block text-xs font-bold tracking-wide text-slate-700 uppercase">
								Reward & Recognition Tiers
							</span>
							<div class="space-y-2">
								{#each rewardTiers as tier (tier.label + tier.amount)}
									{@const isSelected = selectedTierLabel === tier.label && contributionValue === tier.amount}
									<button
										type="button"
										onclick={() => selectFinancialPreset(tier.amount, tier.label)}
										class="w-full cursor-pointer rounded-xl border p-3 text-left transition-all {isSelected
											? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-500'
											: 'border-slate-200 bg-white hover:border-emerald-200'}"
									>
										<div class="flex items-center justify-between gap-2">
											<span class="text-xs font-extrabold text-slate-900">
												{tier.label}
											</span>
											<span class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-900">
												{formatValue(tier.amount)}
											</span>
										</div>
										{#if tier.rewardDescription}
											<p class="mt-1 text-xs text-slate-600">
												{tier.rewardDescription}
											</p>
										{/if}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Payment Method Selector (UI-only buttons) -->
					<div class="space-y-2">
						<span class="block text-xs font-bold tracking-wide text-slate-700 uppercase">
							Payment Method
						</span>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
							{#each [
								{ id: 'card', label: 'Card / Apple Pay / Google Pay' },
								{ id: 'sepa_debit', label: 'SEPA Direct Debit' },
								{ id: 'instant_bank', label: 'Instant Bank Transfer' }
							] as pm (pm.id)}
								<button
									type="button"
									onclick={() => (selectedPaymentMethod = pm.id as any)}
									class="cursor-pointer rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all {selectedPaymentMethod === pm.id
										? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-500'
										: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
								>
									<CreditCard class="mb-1 h-3.5 w-3.5 text-indigo-600" />
									<div class="truncate">{pm.label}</div>
								</button>
							{/each}
						</div>
					</div>

					<!-- External Payment Management Provider Badge & Collapsible Architecture Proposal -->
					<div class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2.5">
						<div class="flex items-start justify-between gap-2">
							<div class="flex items-start gap-2">
								<ShieldCheck class="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
								<div class="text-xs text-emerald-950">
									<span class="font-bold">
										External Payment Provider: Stripe Connect + Checkout/PaymentIntents
									</span>
									<p class="text-[11px] text-emerald-800 mt-0.5">
										{#if campaign.pluginConfig?.captureStrategy === 'immediate'}
											Immediate settlement into dedicated campaign sub-ledger.
										{:else}
											All-or-Nothing Escrow: Pledges are authorized & held until the Primary Goal is unlocked.
										{/if}
									</p>
								</div>
							</div>
							<button
								type="button"
								onclick={() => (showProviderArchitecture = !showProviderArchitecture)}
								class="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100"
							>
								Provider Spec
								{#if showProviderArchitecture}
									<ChevronUp class="h-3.5 w-3.5" />
								{:else}
									<ChevronDown class="h-3.5 w-3.5" />
								{/if}
							</button>
						</div>

						{#if showProviderArchitecture}
							<div class="space-y-2.5 border-t border-emerald-200/80 pt-2.5 text-xs text-slate-700">
								<p class="font-semibold text-slate-900">
									Proposed Payment Providers for Financial Goal Campaigns:
								</p>
								{#if proposalsQuery.loading && !proposalsQuery.current}
									<p class="text-xs text-slate-500">Loading provider architecture...</p>
								{:else}
									{#each paymentProposals as provider (provider.id)}
										<div
											class="rounded-xl border p-2.5 {provider.recommended
												? 'border-indigo-300 bg-white'
												: 'border-slate-200 bg-white/80'}"
										>
											<div class="flex items-center justify-between gap-2">
												<span class="font-bold text-slate-900">{provider.name}</span>
												{#if provider.recommended}
													<span class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-800">
														Recommended Primary
													</span>
												{/if}
											</div>
											<p class="mt-1 text-[11px] text-slate-600">{provider.summary}</p>
											<p class="mt-1 text-[11px] font-medium text-emerald-800">
												<strong>Escrow / Split Flow:</strong> {provider.escrowAndCrowdfundingSupport}
											</p>
										</div>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
				</div>

			<!-- PLUGIN 2: COMMUNITY PETITION VOTE -->
			{:else if campaign.contributionType === 'vote'}
				<div class="space-y-3">
					<div
						class="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
					>
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"
							>
								<Vote class="h-5 w-5" />
							</div>
							<div>
								<div class="text-sm font-extrabold text-slate-900">
									+1 Official Community Endorsement Vote
								</div>
								<div class="text-xs text-slate-600">
									Signed as <strong>{currentUser.name || currentUser.email}</strong>
								</div>
							</div>
						</div>
						<CheckCircle2 class="h-5 w-5 text-amber-600" />
					</div>

					<div class="space-y-1.5">
						<span class="block text-xs font-bold tracking-wide text-slate-700 uppercase">
							Endorsement Statement
						</span>
						<div class="grid grid-cols-1 gap-1.5">
							{#each [
								campaign.pluginConfig?.voteStatement ||
									'I support this goal campaign and endorse its implementation.',
								'This initiative directly benefits our local neighborhood and community hub.',
								'Count my signature toward unlocking both the Primary and Stretch Goals!'
							] as statement (statement)}
								<button
									type="button"
									onclick={() => (customVoteReason = statement)}
									class="cursor-pointer rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all {voteReason === statement
										? 'border-amber-500 bg-amber-50 text-amber-950 font-bold'
										: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
								>
									“{statement}”
								</button>
							{/each}
						</div>
					</div>
				</div>

			<!-- PLUGIN 3: PARTICIPANT / VOLUNTEER SIGN-UP -->
			{:else if campaign.contributionType === 'signup'}
				<div class="space-y-4">
					<div class="space-y-1.5">
						<span class="block text-xs font-bold tracking-wide text-slate-700 uppercase">
							Party Size / Participant Pledge Units (1–10)
						</span>
						<div class="flex flex-wrap items-center gap-1.5">
							{#each [1, 2, 3, 4, 5] as count (count)}
								<button
									type="button"
									onclick={() => (customContributionValue = count)}
									class="cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-extrabold transition-all {contributionValue === count
										? 'border-teal-600 bg-teal-600 text-white'
										: 'border-slate-200 bg-slate-50 text-slate-800 hover:border-teal-300'}"
								>
									+{count} {count === 1 ? 'Participant' : 'Participants'}
								</button>
							{/each}
							<input
								type="number"
								min="1"
								max="10"
								value={contributionValue}
								oninput={(e) => {
									customContributionValue = Math.max(1, Math.min(10, Number((e.currentTarget as HTMLInputElement).value) || 1));
								}}
								aria-label="Custom participant count"
								class="w-20 rounded-xl border border-slate-300 px-2.5 py-1.5 text-center text-xs font-bold text-slate-900"
							/>
						</div>
					</div>

					<div class="space-y-1.5">
						<span class="block text-xs font-bold tracking-wide text-slate-700 uppercase">
							Preferred Participation Role
						</span>
						<div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
							{#each availableRoles as role (role)}
								<button
									type="button"
									onclick={() => (commitmentRole = role)}
									class="cursor-pointer rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all {commitmentRole === role
										? 'border-teal-600 bg-teal-50 text-teal-950 ring-1 ring-teal-500'
										: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
								>
									<Users class="mr-1 inline h-3.5 w-3.5 text-teal-600" />
									{role}
								</button>
							{/each}
						</div>
					</div>

					<div class="space-y-1.5">
						<label for="signup-availability-note" class="block text-xs font-semibold text-slate-700">
							Availability / Skills Note (Optional)
						</label>
						<input
							id="signup-availability-note"
							type="text"
							bind:value={availabilityNote}
							placeholder="e.g. Weekends, Saturday afternoons, electronics repair..."
							class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
						/>
					</div>
				</div>
			{/if}

			<!-- Public Comment (Bound via rf.fields.comment.as('text')) -->
			<div class="space-y-1.5">
				<label for="contribution-comment" class="block text-xs font-semibold text-slate-700">
					Public Comment / Note of Support (Optional)
				</label>
				<textarea
					id="contribution-comment"
					rows="2"
					placeholder="Share why you are backing this goal campaign..."
					{...rf.fields.comment.as('text')}
					class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
				></textarea>
				{#each rf.fields.comment?.issues() ?? [] as issue (issue.message)}
					<p class="text-xs font-medium text-rose-600">{issue.message}</p>
				{/each}
			</div>

			<!-- Anonymous Checkbox (Bound via rf.fields.isAnonymous.as('checkbox')) -->
			<label class="flex cursor-pointer items-center gap-2.5 text-xs text-slate-700">
				<input
					{...rf.fields.isAnonymous.as('checkbox')}
					class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
				/>
				<span>Display my contribution as <strong>Anonymous Supporter</strong> on the public feed</span>
			</label>

			<!-- Encrypted Contact Segregation & GDPR Notice -->
			<div class="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-600">
				<span class="font-bold text-slate-800">Encrypted Contact Segregation (GDPR Art. 25 &amp; 17):</span>
				Your personal contact details are stored separately in an AES-256-GCM PKI envelope and never exposed as plaintext in campaign records. See
				<a href="/GDPR" class="font-semibold text-indigo-600 hover:underline">Data Privacy</a>,
				<a href="/gdpr-self-service" class="font-semibold text-indigo-600 hover:underline">GDPR Self-Service</a>, and
				<a href="/imprint" class="font-semibold text-indigo-600 hover:underline">Imprint</a>.
			</div>

			<!-- Submit Button -->
			<button
				type="submit"
				disabled={isSubmitting}
				class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-md transition-all hover:from-indigo-500 hover:to-fuchsia-500 disabled:opacity-50"
			>
				<Sparkles class="h-4 w-4" />
				{#if isSubmitting}
					Processing Contribution...
				{:else if campaign.contributionType === 'financial'}
					{effectiveFinancialType === 'transfer'
						? 'Execute Actual Transfer'
						: 'Submit Financial Pledge'} ({formatValue(contributionValue)})
				{:else}
					{(campaign as any).ctaButtonLabel || plugin.ctaVerb} ({formatValue(contributionValue)})
				{/if}
			</button>
		</form>
	{/if}
</div>
