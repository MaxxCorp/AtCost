<script lang="ts">
	import {
		ArrowLeft,
		Sparkles,
		ShieldCheck,
		UserCheck,
		Lock
	} from '@lucide/svelte';
	import { Button, LoadingSection } from '@ac/ui';
	import {
		getCurrentSessionUser,
		switchDevPersona
	} from '../list.remote.js';
	import { createGoalCampaign } from './create.remote.js';
	import { createGoalCampaignSchema } from '@ac/validations';
	import GoalForm from '#lib/components/goals/GoalForm.svelte';
	import { dev } from '$app/env';
	import { toast } from 'svelte-sonner';

	const sessionQuery = getCurrentSessionUser({});

	const currentUser = $derived(sessionQuery.current?.user ?? null);
	const isOperator = $derived(sessionQuery.current?.isOperator ?? false);

	async function handlePersonaSwitch(persona: 'operator' | 'community') {
		try {
			await switchDevPersona(persona);
			await sessionQuery.refresh();
			toast.success(`Switched session to ${persona} account`);
		} catch (err: any) {
			toast.error(err?.message || 'Failed to switch persona');
		}
	}
</script>

<svelte:head>
	<title>Launch a Goal Campaign | AC-Goals</title>
</svelte:head>

<div class="max-w-5xl mx-auto space-y-6 pb-16">
	<div class="flex items-center justify-between">
		<a
			href="/goals"
			class="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-emerald-700 transition-colors"
		>
			<ArrowLeft class="w-4 h-4" />
			Back to All Campaigns
		</a>

		{#if currentUser}
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold {isOperator
					? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
					: 'bg-amber-100 text-amber-800 border border-amber-300'}"
			>
				{#if isOperator}
					<ShieldCheck class="w-3.5 h-3.5" />
					Operator Mode (Direct Publish Enabled)
				{:else}
					<UserCheck class="w-3.5 h-3.5" />
					Community Member (Submits for Operator Approval)
				{/if}
			</span>
		{/if}
	</div>

	<div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-2">
		<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
			<Sparkles class="w-4 h-4" />
			Create Goal-Achieving Campaign
		</div>
		<h1 class="text-2xl sm:text-3xl font-black text-gray-900">
			Launch a New Goal Campaign
		</h1>
		<p class="text-sm text-gray-600 max-w-3xl">
			Define your executive summary, primary target, optional stretch goals, and choose a contribution plugin (Community Votes, Participant Sign-ups, or Financial Crowdfunding).
		</p>
	</div>

	{#if sessionQuery.loading && !sessionQuery.current}
		<LoadingSection message="Checking session status..." />
	{:else if !currentUser}
		<!-- Friendly Prompt to Register or Sign In when Guest -->
		<div class="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center space-y-5 shadow-sm">
			<div
				class="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"
			>
				<Lock class="w-7 h-7" />
			</div>
			<div class="space-y-2 max-w-xl mx-auto">
				<h2 class="text-xl font-bold text-gray-900">
					Registration Required to Launch or Contribute to Campaigns
				</h2>
				<p class="text-sm text-gray-600 leading-relaxed">
					Only registered community members and internal operators can create goal campaigns or contribute. Community-supplied campaigns are reviewed by operators before going live.
				</p>
			</div>

			<div class="flex flex-wrap items-center justify-center gap-3 pt-2">
				<Button
					href="/login?redirectTo=%2Fgoals%2Fnew"
					variant="primary"
					class="inline-flex items-center gap-2"
				>
					<UserCheck class="w-4 h-4" />
					Sign In
				</Button>
				<Button
					href="/signup?redirectTo=%2Fgoals%2Fnew"
					variant="outline"
					class="inline-flex items-center gap-2"
				>
					Create Account
				</Button>
			</div>

			{#if dev}
				<div class="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-amber-200/70">
					<Button
						variant="ghost"
						onclick={() => void handlePersonaSwitch('community')}
						class="inline-flex items-center gap-2 text-xs"
					>
						<UserCheck class="w-3.5 h-3.5" />
						Dev: Community Member
					</Button>
					<Button
						variant="ghost"
						onclick={() => void handlePersonaSwitch('operator')}
						class="inline-flex items-center gap-2 text-xs"
					>
						<ShieldCheck class="w-3.5 h-3.5" />
						Dev: Internal Operator
					</Button>
				</div>
			{/if}
		</div>
	{:else}
		<GoalForm
			remoteFunction={createGoalCampaign}
			validationSchema={createGoalCampaignSchema}
			isUpdating={false}
			{isOperator}
		/>
	{/if}
</div>
