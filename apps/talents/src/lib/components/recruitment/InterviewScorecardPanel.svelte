<script lang="ts">
	import {
		listTalentInterviews,
		submitInterviewScorecard,
	} from "../../../routes/recruitment/recruitment.remote";
	import {
		submitInterviewScorecardSchema,
		DEFAULT_INTERVIEW_COMPETENCIES,
		PIPELINE_STAGES,
	} from "@ac/validations";
	import { AsyncButton } from "@ac/ui";
	import { toast } from "svelte-sonner";
	import {
		Star,
		ClipboardCheck,
		CheckCircle2,
		ShieldCheck,
		UserCheck,
		MessageSquareQuote,
		Award,
	} from "@lucide/svelte";

	let {
		talentId,
		jobPostingId = null,
		customCompetencies = [],
		onSubmitted,
	}: {
		talentId: string;
		jobPostingId?: string | null;
		customCompetencies?: any[];
		onSubmitted?: () => void;
	} = $props();

	const interviewsQuery = $derived(listTalentInterviews(talentId));
	const evaluations = $derived(interviewsQuery.current ?? []);

	const rf = submitInterviewScorecard;

	const initialTemplate = $derived(
		customCompetencies?.length ? customCompetencies : DEFAULT_INTERVIEW_COMPETENCIES,
	);

	// svelte-ignore state_referenced_locally
	let rubricItems = $state(
		(customCompetencies?.length ? customCompetencies : DEFAULT_INTERVIEW_COMPETENCIES).map(
			(c: any) => ({
				competencyId: c.id || c.competencyId,
				competency: c.competency,
				category: c.category || "core",
				weight: Number(c.weight || 20),
				anchor1: c.anchor1 || "Nicht erfüllt",
				anchor3: c.anchor3 || "Solide erfüllt",
				anchor5: c.anchor5 || "Herausragend erfüllt",
				score: 4,
				evidenceNotes: "",
			}),
		),
	);

	const weightedAverage = $derived.by(() => {
		let totalW = 0;
		let sum = 0;
		for (const item of rubricItems) {
			const w = Number(item.weight || 20);
			totalW += w;
			sum += w * Number(item.score || 3);
		}
		return totalW > 0 ? Math.round((sum / totalW) * 100) / 100 : 4.0;
	});

	const competencyScoresJson = $derived(
		JSON.stringify(
			rubricItems.map((item) => ({
				competencyId: item.competencyId,
				competency: item.competency,
				category: item.category,
				weight: item.weight,
				score: item.score,
				evidenceNotes: item.evidenceNotes,
			})),
		),
	);

	function recommendationBadge(rec: string) {
		switch (rec) {
			case "strong_hire":
				return { label: "Strong Hire (Unbedingt einstellen)", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" };
			case "hire":
				return { label: "Hire (Einstellen)", cls: "bg-teal-100 text-teal-900 border-teal-300" };
			case "lean_hire":
				return { label: "Lean Hire (Tendenz positiv)", cls: "bg-blue-100 text-blue-900 border-blue-300" };
			case "lean_no_hire":
				return { label: "Lean No Hire (Tendenz kritisch)", cls: "bg-amber-100 text-amber-900 border-amber-300" };
			default:
				return { label: "No Hire (Ablehnung)", cls: "bg-rose-100 text-rose-900 border-rose-300" };
		}
	}
</script>

<div class="space-y-8">
	<!-- 1. Structured Competency Interview Scorecard Form -->
	<div class="rounded-2xl border border-indigo-100 bg-white p-6 shadow-xs space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
			<div class="flex items-center gap-2.5">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
					<ClipboardCheck class="w-5 h-5" />
				</div>
				<div>
					<h3 class="text-lg font-black text-slate-900">
						Strukturierte Interview-Scorecard & Rubrik-Bewertung (Story 3)
					</h3>
					<p class="text-xs text-slate-500">
						Verhaltensverankerte 1–5 Bewertungsskala (BARS) zur objektiven, verzerrungsfreien Kandidatenbeurteilung.
					</p>
				</div>
			</div>

			<div class="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 border border-indigo-200">
				<Star class="w-5 h-5 text-amber-500 fill-amber-500" />
				<div>
					<span class="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
						Gewichteter Gesamtscore
					</span>
					<span class="text-lg font-black text-indigo-950">
						{weightedAverage.toFixed(2)} / 5.00
					</span>
				</div>
			</div>
		</div>

		<form
			{...rf.preflight(submitInterviewScorecardSchema).enhance(async ({ submit }) => {
				try {
					await submit();
					const res = rf.result as any;
					if (res?.success) {
						toast.success(
							`Interview-Scorecard (${res.overallScore.toFixed(2)} / 5.00) gespeichert & in der Blockchain-Custody-Kette verankert!`,
						);
						await interviewsQuery.refresh();
						if (onSubmitted) onSubmitted();
					}
				} catch (err: any) {
					toast.error(err?.message || "Fehler beim Speichern der Scorecard.");
				}
			})}
			class="space-y-6"
		>
			<input {...rf.fields.talentId.as("hidden", talentId)} />
			{#if jobPostingId}
				<input {...rf.fields.jobPostingId.as("hidden", jobPostingId)} />
			{/if}
			<input {...rf.fields.competencyScoresJson.as("hidden", competencyScoresJson)} />

			<!-- Interview Meta Grid -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				<div>
					<label for="sc-stage" class="block text-xs font-bold text-slate-700 mb-1">
						Interview-Phase
					</label>
					<select
						id="sc-stage"
						{...rf.fields.stage.as("select")}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
					>
						<option value="screening">1. Erstgespräch / Screening</option>
						<option value="competency_interview">2. Fach- & Kompetenzinterview</option>
						<option value="panel_trial">3. Team-Gespräch / Hospitation</option>
						<option value="final_decision">4. Finales Entscheidungsgespräch</option>
					</select>
				</div>

				<div>
					<label for="sc-type" class="block text-xs font-bold text-slate-700 mb-1">
						Gesprächsformat
					</label>
					<select
						id="sc-type"
						{...rf.fields.interviewType.as("select")}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
					>
						<option value="video">Video-Interview (Teams / Meet)</option>
						<option value="in_person">Vor-Ort-Gespräch</option>
						<option value="work_sample">Arbeitsprobe / Hospitation</option>
						<option value="phone">Telefon-Screening</option>
					</select>
				</div>

				<div>
					<label for="sc-interviewer" class="block text-xs font-bold text-slate-700 mb-1">
						Interviewer:in Name *
					</label>
					<input
						id="sc-interviewer"
						{...rf.fields.interviewerName.as("text")}
						required
						placeholder="z.B. Dr. Hannah Weber (HR / Bereichsleitung)"
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					/>
					{#each rf.fields.interviewerName.issues() as issue, idx (idx)}
						<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
					{/each}
				</div>

				<div>
					<label for="sc-role" class="block text-xs font-bold text-slate-700 mb-1">
						Funktion im Auswahlgremium
					</label>
					<input
						id="sc-role"
						{...rf.fields.interviewerRole.as("text")}
						placeholder="z.B. Fachbereichsleitung / HR Responsible"
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					/>
				</div>

				<div>
					<label for="sc-rec" class="block text-xs font-bold text-slate-700 mb-1">
						Gesamtempfehlung *
					</label>
					<select
						id="sc-rec"
						{...rf.fields.recommendation.as("select")}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
					>
						<option value="strong_hire">Strong Hire (Unbedingt einstellen)</option>
						<option value="hire">Hire (Einstellen)</option>
						<option value="lean_hire">Lean Hire (Tendenz positiv)</option>
						<option value="lean_no_hire">Lean No Hire (Tendenz kritisch)</option>
						<option value="no_hire">No Hire (Ablehnung)</option>
					</select>
				</div>

				<div>
					<label for="sc-advance" class="block text-xs font-bold text-slate-700 mb-1">
						Kandidat:in in Pipeline-Phase überführen
					</label>
					<select
						id="sc-advance"
						{...rf.fields.advancePipelineStage.as("select")}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
					>
						{#each PIPELINE_STAGES as st (st.id)}
							<option value={st.id}>{st.labelDe} ({st.labelEn})</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- 1–5 Anchored Competency Rubric Cards -->
			<div class="space-y-4">
				<h4 class="text-sm font-extrabold uppercase tracking-wider text-slate-700">
					Verhaltensverankerte Kompetenz-Rubriken (1 = Nicht erfüllt · 3 = Solide · 5 = Exzellent)
				</h4>

				<div class="space-y-3">
					{#each rubricItems as item, idx (item.competencyId)}
						<div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
								<div>
									<div class="flex items-center gap-2">
										<span class="text-sm font-bold text-slate-900">
											{idx + 1}. {item.competency}
										</span>
										<span class="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
											Gewichtung: {item.weight}%
										</span>
									</div>
								</div>

								<!-- 1–5 Rating Buttons (No name attribute!) -->
								<div class="flex items-center gap-1.5" role="group" aria-label={item.competency}>
									{#each [1, 2, 3, 4, 5] as rating (rating)}
										<button
											type="button"
											onclick={() => (rubricItems[idx].score = rating)}
											aria-pressed={item.score === rating}
											class="h-9 w-9 rounded-xl font-black text-xs transition-all border {item.score === rating
												? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105'
												: 'bg-white text-slate-700 border-slate-300 hover:bg-indigo-50'}"
										>
											{rating}★
										</button>
									{/each}
								</div>
							</div>

							<!-- Behavioral Anchors Reference -->
							<div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
								<div class="rounded-lg bg-rose-50/70 border border-rose-100 p-2 text-rose-900">
									<strong class="block text-[10px] uppercase">1★ Anker (Defizit):</strong>
									{item.anchor1}
								</div>
								<div class="rounded-lg bg-blue-50/70 border border-blue-100 p-2 text-blue-900">
									<strong class="block text-[10px] uppercase">3★ Anker (Anforderung erfüllt):</strong>
									{item.anchor3}
								</div>
								<div class="rounded-lg bg-emerald-50/70 border border-emerald-100 p-2 text-emerald-900">
									<strong class="block text-[10px] uppercase">5★ Anker (Exzellenz):</strong>
									{item.anchor5}
								</div>
							</div>

							<!-- Evidence note per competency (No name attribute; serialized via competencyScoresJson) -->
							<div>
								<input
									type="text"
									bind:value={rubricItems[idx].evidenceNotes}
									placeholder="Konkrete Beobachtung / Beispiel aus dem Gespräch zu dieser Kompetenz..."
									aria-label="Beobachtung zu {item.competency}"
									class="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
								/>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Structured Summary & Calibration Notes -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="sc-strengths" class="block text-xs font-bold text-slate-700 mb-1">
						Beobachtete Kernstärken & Evidenz *
					</label>
					<textarea
						id="sc-strengths"
						{...rf.fields.strengths.as("text")}
						required
						rows={3}
						placeholder="Welche konkreten Antworten oder Arbeitsproben belegen die Eignung?"
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					></textarea>
					{#each rf.fields.strengths.issues() as issue, idx (idx)}
						<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
					{/each}
				</div>

				<div>
					<label for="sc-concerns" class="block text-xs font-bold text-slate-700 mb-1">
						Offene Fragen / Entwicklungsfelder / Einarbeitungsfokus
					</label>
					<textarea
						id="sc-concerns"
						{...rf.fields.concerns.as("text")}
						rows={3}
						placeholder="Gibt es Punkte, die im Onboarding oder in einer Zweitrunde vertieft werden sollten?"
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					></textarea>
				</div>
			</div>

			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
				<span class="inline-flex items-center gap-1.5 text-xs text-slate-500">
					<ShieldCheck class="w-4 h-4 text-emerald-600" />
					Wird als kryptografisch signierter Block in der Bewerber-Custody-Kette protokolliert.
				</span>
				<AsyncButton
					type="submit"
					loading={rf.pending > 0}
					class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
				>
					<Award class="w-4 h-4 mr-1.5" />
					Scorecard verbindlich einreichen ({weightedAverage.toFixed(2)} ★)
				</AsyncButton>
			</div>
		</form>
	</div>

	<!-- 2. Submitted Interview Scorecards Matrix -->
	<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b border-slate-100 pb-3">
			<div class="flex items-center gap-2">
				<MessageSquareQuote class="w-5 h-5 text-indigo-600" />
				<h4 class="text-base font-bold text-slate-900">
					Dokumentierte Interview-Scorecards & Gremien-Kalibrierung ({evaluations.length})
				</h4>
			</div>
		</div>

		{#if evaluations.length === 0}
			<p class="text-sm text-slate-500 italic py-4">
				Noch keine Interview-Scorecards für diese Person eingereicht.
			</p>
		{:else}
			<div class="space-y-4">
				{#each evaluations as ev (ev.id)}
					{@const badge = recommendationBadge(ev.recommendation)}
					<div class="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
							<div class="flex flex-wrap items-center gap-2">
								<span class="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-950 border border-amber-300">
									<Star class="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
									{Number(ev.overallScore).toFixed(2)} / 5.00
								</span>
								<span class="rounded-lg border px-2.5 py-1 text-xs font-bold {badge.cls}">
									{badge.label}
								</span>
								<span class="text-xs font-semibold text-slate-700">
									Phase: {ev.stage} ({ev.interviewType})
								</span>
							</div>

							<div class="text-xs text-slate-500 flex items-center gap-1.5">
								<UserCheck class="w-3.5 h-3.5 text-indigo-600" />
								<strong>{ev.interviewerName}</strong>
								{#if ev.interviewerRole}({ev.interviewerRole}){/if}
								· {new Date(ev.conductedAt).toLocaleDateString("de-DE")}
							</div>
						</div>

						{#if ev.competencyScores?.length > 0}
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
								{#each ev.competencyScores as cs (cs.competencyId)}
									<div class="rounded-lg bg-white border border-slate-200 p-2.5 text-xs">
										<div class="flex items-center justify-between font-bold text-slate-800">
											<span class="truncate">{cs.competency}</span>
											<span class="text-indigo-700 shrink-0">{cs.score} / 5 ★</span>
										</div>
										{#if cs.evidenceNotes}
											<p class="text-[11px] text-slate-500 mt-1">{cs.evidenceNotes}</p>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
							{#if ev.strengths}
								<div class="rounded-lg bg-emerald-50/70 border border-emerald-100 p-2.5 text-emerald-950">
									<strong class="block text-[10px] uppercase text-emerald-700">Stärken & Evidenz:</strong>
									{ev.strengths}
								</div>
							{/if}
							{#if ev.concerns}
								<div class="rounded-lg bg-amber-50/70 border border-amber-100 p-2.5 text-amber-950">
									<strong class="block text-[10px] uppercase text-amber-700">Offene Punkte / Onboarding-Fokus:</strong>
									{ev.concerns}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

