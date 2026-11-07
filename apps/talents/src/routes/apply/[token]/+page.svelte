<script lang="ts">
	import { page } from "$app/state";
	import { readInvitationByToken, submitApplicantIntake } from "../../recruitment/recruitment.remote";
	import { applicantIntakeSchema } from "@ac/validations";
	import { AsyncButton } from "@ac/ui";
	import { toast } from "svelte-sonner";
	import {
		MailCheck,
		ShieldCheck,
		CheckCircle2,
		Send,
		Briefcase,
		Lock,
	} from "@lucide/svelte";

	const token = $derived(page.params.token as string);
	const invQuery = $derived(readInvitationByToken(token));
	const invData = $derived(invQuery.current);

	let submittedReceipt = $state<{
		talentId: string;
		ledgerBlockHash: string;
		versionNumber: number;
	} | null>(null);

	const rf = submitApplicantIntake;
</script>

<svelte:head>
	<title>Persönliche Bewerbungseinladung · AC Talents</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-teal-950 via-slate-900 to-slate-950 py-10 px-4 text-slate-900">
	<div class="mx-auto max-w-3xl space-y-6">
		{#if invQuery.loading && !invData}
			<div class="rounded-3xl bg-white p-10 text-center text-slate-600 shadow-xl">
				Persönlicher Einladungslink wird überprüft...
			</div>
		{:else if !invData}
			<div class="rounded-3xl bg-white p-10 text-center space-y-3 shadow-xl">
				<h1 class="text-xl font-black text-rose-700">Einladungslink ungültig oder abgelaufen</h1>
				<p class="text-sm text-slate-600">
					Bitte wenden Sie sich an unser Recruiting-Team oder besuchen Sie unser öffentliches
					<a href="/careers" class="text-teal-700 underline font-bold">Karriereportal</a>.
				</p>
			</div>
		{:else if submittedReceipt || invData.invitation.status === "completed"}
			<div class="rounded-3xl border-2 border-emerald-400 bg-white p-8 shadow-2xl space-y-5">
				<div class="flex items-center gap-3">
					<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
						<CheckCircle2 class="h-6 w-6" />
					</div>
					<div>
						<span class="text-xs font-bold uppercase tracking-wider text-emerald-700">
							Chain-of-Custody Verifiziert · Version v{submittedReceipt?.versionNumber ?? 1}
						</span>
						<h1 class="text-2xl font-black text-slate-900">
							Vielen Dank für Ihre Bewerbung!
						</h1>
					</div>
				</div>

				<p class="text-sm text-slate-700 leading-relaxed">
					Ihre Bewerbungs- und Kontaktdaten wurden über Ihren persönlichen Magic-Link Ende-zu-Ende verschlüsselt entgegengenommen und direkt in unserem Recruiting-System hinterlegt.
				</p>

				{#if submittedReceipt?.ledgerBlockHash}
					<div class="rounded-2xl bg-slate-900 p-4 text-xs font-mono text-emerald-300 space-y-1">
						<div class="text-[10px] font-sans font-bold uppercase tracking-wider text-teal-400">
							Kryptografischer Blockchain-Custody-Nachweis (RFC 8785 JCS + RFC 7515 JWS)
						</div>
						<div class="break-all">{submittedReceipt.ledgerBlockHash}</div>
					</div>
				{/if}

				<div class="pt-2">
					<a
						href="/careers"
						class="inline-flex items-center rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800"
					>
						Zurück zum Karriereportal
					</a>
				</div>
			</div>
		{:else}
			<div class="rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-6">
				<div class="flex items-start gap-3 border-b border-slate-100 pb-5">
					<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-white shrink-0">
						<MailCheck class="h-6 w-6" />
					</div>
					<div class="space-y-1">
						<span class="text-xs font-bold uppercase tracking-wider text-teal-700">
							Persönliche Bewerbungseinladung · Eingeladen von {invData.invitation.invitedByName || "Recruiting Team"}
						</span>
						<h1 class="text-2xl font-black text-slate-900">
							{invData.jobPosting?.title || "Bewerbungs- & Kontaktformular"}
						</h1>
						{#if invData.jobPosting?.department}
							<p class="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
								<Briefcase class="h-3.5 w-3.5 text-teal-600" />
								Fachbereich: {invData.jobPosting.department}
							</p>
						{/if}
					</div>
				</div>

				{#if invData.invitation.personalMessage}
					<div class="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-sm text-teal-950">
						<div class="text-xs font-bold uppercase tracking-wider text-teal-800 mb-1">
							Persönliche Nachricht an Sie:
						</div>
						<p class="whitespace-pre-line">{invData.invitation.personalMessage}</p>
					</div>
				{/if}

				<form
					{...rf.preflight(applicantIntakeSchema).enhance(async ({ submit }) => {
						try {
							await submit();
							const res = rf.result as any;
							if (res?.success) {
								submittedReceipt = {
									talentId: res.talentId,
									ledgerBlockHash: res.ledgerBlockHash,
									versionNumber: res.versionNumber ?? 1,
								};
								toast.success("Bewerbungs- & Kontaktdaten sicher übermittelt!");
							}
						} catch (err: any) {
							toast.error(err?.message || "Übermittlung fehlgeschlagen.");
						}
					})}
					class="space-y-4"
				>
					<input {...rf.fields.invitationToken.as("hidden", token)} />
					<input {...rf.fields.channel.as("hidden", "magic_link")} />
					{#if invData.invitation.jobPostingId}
						<input {...rf.fields.jobPostingId.as("hidden", invData.invitation.jobPostingId)} />
					{/if}
					<input
						{...rf.fields.jobTitle.as(
							"hidden",
							invData.jobPosting?.title || "Bewerbung via Einladungslink",
						)}
					/>
					<input
						{...rf.fields.department.as(
							"hidden",
							invData.jobPosting?.department || "Allgemein",
						)}
					/>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="ml-gn" class="block text-xs font-bold text-slate-700 mb-1">Vorname *</label>
							<input
								id="ml-gn"
								{...rf.fields.givenName.as("text")}
								value={invData.invitation.givenName || ""}
								required
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
							{#each rf.fields.givenName.issues() as issue, idx (idx)}
								<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
							{/each}
						</div>

						<div>
							<label for="ml-fn" class="block text-xs font-bold text-slate-700 mb-1">Nachname *</label>
							<input
								id="ml-fn"
								{...rf.fields.familyName.as("text")}
								value={invData.invitation.familyName || ""}
								required
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
							{#each rf.fields.familyName.issues() as issue, idx (idx)}
								<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
							{/each}
						</div>

						<div>
							<label for="ml-email" class="block text-xs font-bold text-slate-700 mb-1">E-Mail *</label>
							<input
								id="ml-email"
								{...rf.fields.email.as("email")}
								value={invData.invitation.email || ""}
								required
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
							{#each rf.fields.email.issues() as issue, idx (idx)}
								<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
							{/each}
						</div>

						<div>
							<label for="ml-phone" class="block text-xs font-bold text-slate-700 mb-1">Telefonnummer</label>
							<input
								id="ml-phone"
								{...rf.fields.phone.as("tel")}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<div class="sm:col-span-2">
							<label for="ml-street" class="block text-xs font-bold text-slate-700 mb-1">Straße & Hausnummer</label>
							<input
								id="ml-street"
								{...rf.fields.street.as("text")}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="ml-city" class="block text-xs font-bold text-slate-700 mb-1">PLZ & Ort</label>
							<input
								id="ml-city"
								{...rf.fields.city.as("text")}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="ml-avail" class="block text-xs font-bold text-slate-700 mb-1">Verfügbar ab</label>
							<input
								id="ml-avail"
								{...rf.fields.availabilityDate.as("date")}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="ml-salary" class="block text-xs font-bold text-slate-700 mb-1">Gehaltsvorstellung (€/Monat)</label>
							<input
								id="ml-salary"
								{...rf.fields.salaryExpectation.as("text")}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
					</div>

					<div>
						<label for="ml-mot" class="block text-xs font-bold text-slate-700 mb-1">
							Kurzprofil, Motivation & Hinweise
						</label>
						<textarea
							id="ml-mot"
							{...rf.fields.motivationNotes.as("text")}
							rows={3}
							class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						></textarea>
					</div>

					<div class="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 flex items-center gap-2.5">
						<Lock class="h-4 w-4 text-teal-700 shrink-0" />
						<span>
							Ende-zu-Ende PKI-Verschlüsselung (RSA-OAEP-256 + AES-256-GCM) und unveränderliche Blockchain-Protokollierung Ihrer Einreichung.
						</span>
					</div>

					<AsyncButton
						type="submit"
						loading={rf.pending > 0}
						class="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3"
					>
						<Send class="h-4 w-4 mr-2" />
						Bewerbungs- & Kontaktdaten absenden
					</AsyncButton>
				</form>
			</div>
		{/if}
	</div>
</div>
