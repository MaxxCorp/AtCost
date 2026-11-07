<script lang="ts">
	import { page } from "$app/state";
	import { readInvitationByToken } from "../../recruitment/recruitment.remote";
	import OnboardingPayrollForm from "#lib/components/recruitment/OnboardingPayrollForm.svelte";
	import {
		ShieldCheck,
		CheckCircle2,
		Sparkles,
		Briefcase,
	} from "@lucide/svelte";

	const token = $derived(page.params.token as string);
	const invQuery = $derived(readInvitationByToken(token));
	const invData = $derived(invQuery.current);

	let completedResult = $state<any>(null);
</script>

<svelte:head>
	<title>Onboarding & Lohnstammdaten-Vervollständigung · AC Talents</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 py-10 px-4">
	<div class="mx-auto max-w-4xl space-y-6">
		{#if invQuery.loading && !invData}
			<div class="rounded-3xl bg-white p-10 text-center text-slate-600 shadow-xl">
				Onboarding-Einladungslink wird überprüft...
			</div>
		{:else if !invData}
			<div class="rounded-3xl bg-white p-10 text-center space-y-3 shadow-xl">
				<h1 class="text-xl font-black text-rose-700">Onboarding-Link ungültig oder abgelaufen</h1>
				<p class="text-sm text-slate-600">
					Bitte wenden Sie sich an Ihre Personalabteilung (HR), um einen neuen Onboarding-Magic-Link anzufordern.
				</p>
			</div>
		{:else if completedResult || invData.invitation.status === "completed"}
			<div class="rounded-3xl border-2 border-emerald-400 bg-white p-8 shadow-2xl space-y-5">
				<div class="flex items-center gap-3">
					<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
						<CheckCircle2 class="h-6 w-6" />
					</div>
					<div>
						<span class="text-xs font-bold uppercase tracking-wider text-emerald-700">
							Onboarding & Lohnstammdaten vollständig · Version v{completedResult?.versionNumber ?? 2}
						</span>
						<h1 class="text-2xl font-black text-slate-900">
							Herzlich willkommen im Team!
						</h1>
					</div>
				</div>

				<p class="text-sm text-slate-700 leading-relaxed">
					Ihre gesetzlichen Lohnsteuer- und Sozialversicherungsmerkmale (ELStAM, DEÜV, Krankenkasse, IBAN) sowie Ihre individuellen Onboarding-Zusatzfelder wurden PKI-verschlüsselt (AES-256-GCM / RSA-OAEP-256) gespeichert und in der Blockchain-Custody-Kette signiert.
				</p>

				{#if completedResult?.ledgerBlockHash}
					<div class="rounded-2xl bg-slate-900 p-4 text-xs font-mono text-emerald-300 space-y-1">
						<div class="text-[10px] font-sans font-bold uppercase tracking-wider text-teal-400">
							Signierter Chain-of-Custody Block-Hash
						</div>
						<div class="break-all">{completedResult.ledgerBlockHash}</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-6">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
					<div class="flex items-start gap-3">
						<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shrink-0">
							<Sparkles class="h-6 w-6" />
						</div>
						<div>
							<span class="text-xs font-bold uppercase tracking-wider text-indigo-600">
								Herzlichen Glückwunsch zur Auswahl! · Eingeladen von {invData.invitation.invitedByName || "HR Team"}
							</span>
							<h1 class="text-2xl font-black text-slate-900">
								Onboarding & Personalfragebogen vervollständigen
							</h1>
							{#if invData.jobPosting?.title || invData.talent?.jobTitle}
								<p class="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
									<Briefcase class="h-3.5 w-3.5 text-indigo-600" />
									Position: {invData.jobPosting?.title || invData.talent?.jobTitle}
								</p>
							{/if}
						</div>
					</div>

					<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
						<ShieldCheck class="h-4 w-4 text-emerald-600" />
						PKI Envelope Encrypted
					</span>
				</div>

				{#if invData.invitation.personalMessage}
					<div class="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-950">
						<div class="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-1">
							Nachricht Ihrer Personalabteilung:
						</div>
						<p class="whitespace-pre-line">{invData.invitation.personalMessage}</p>
					</div>
				{/if}

				<OnboardingPayrollForm
					talentId={invData.invitation.talentId || invData.talent?.id || ""}
					invitationToken={token}
					jobPostingId={invData.invitation.jobPostingId || ""}
					initialData={invData.talent || { contact: invData.invitation.prefillData }}
					customFieldDefinitions={invData.invitation.customFieldsConfig || invData.jobPosting?.customOnboardingFields || []}
					mode="magic_link"
					onSuccess={(res: any) => {
						completedResult = res;
					}}
				/>
			</div>
		{/if}
	</div>
</div>
