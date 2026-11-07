<script lang="ts">
	import { listJobPostings, submitApplicantIntake } from "../recruitment/recruitment.remote";
	import { applicantIntakeSchema } from "@ac/validations";
	import { Button, AsyncButton } from "@ac/ui";
	import { toast } from "svelte-sonner";
	import {
		Briefcase,
		Clock,
		Building2,
		Search,
		Globe,
		ShieldCheck,
		HeartHandshake,
		Accessibility,
		CheckCircle2,
		Sparkles,
		Send,
		Code2,
		ExternalLink,
		FileText,
		Euro,
		X,
	} from "@lucide/svelte";

	let lang = $state<"de" | "en">("de");
	let searchQuery = $state("");
	let selectedDepartment = $state("all");
	let selectedWorkModel = $state("all");
	let selectedSgb2 = $state("all");
	let showEmbedPreview = $state(false);

	let selectedJobId = $state<string | null>(null);
	let showOpenApplication = $state(false);
	let sgb2InterestState = $state<"none" | "sgb2_16d" | "sgb2_16i">("none");

	let submissionReceipt = $state<{
		talentId: string;
		ledgerBlockHash: string;
		versionNumber: number;
		jobTitle: string;
	} | null>(null);

	const jobsQuery = listJobPostings({ onlyPublic: true, limit: 100 });
	const allJobs = $derived(jobsQuery.current?.data ?? []);
	const departments = $derived(jobsQuery.current?.departments ?? []);

	const filteredJobs = $derived.by(() => {
		return allJobs.filter((job: any) => {
			if (selectedDepartment !== "all" && job.department !== selectedDepartment) return false;
			if (selectedWorkModel !== "all" && job.workModel !== selectedWorkModel) return false;
			if (selectedSgb2 === "sgb2" && (!job.sgb2Eligible || job.sgb2Eligible === "none")) return false;
			if (searchQuery.trim()) {
				const q = searchQuery.trim().toLowerCase();
				const hay = [
					job.title,
					job.department,
					job.summary,
					job.description,
					job.contractFrameworkCode,
					job.entgeltgruppe,
					job.translations?.en?.title,
					job.translations?.en?.department,
					job.translations?.en?.summary,
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	});

	const groupedByDepartment = $derived.by(() => {
		const groups: Record<string, any[]> = {};
		for (const job of filteredJobs) {
			const dept =
				lang === "en" && job.translations?.en?.department
					? job.translations.en.department
					: job.department || "Allgemein";
			if (!groups[dept]) groups[dept] = [];
			groups[dept].push(job);
		}
		return Object.entries(groups);
	});

	const selectedJob = $derived(
		selectedJobId ? allJobs.find((j: any) => j.id === selectedJobId) ?? null : null,
	);

	const rf = submitApplicantIntake;

	function getTitle(job: any) {
		return lang === "en" && job?.translations?.en?.title ? job.translations.en.title : job?.title;
	}
	function getSummary(job: any) {
		return lang === "en" && job?.translations?.en?.summary ? job.translations.en.summary : job?.summary;
	}
	function getDescription(job: any) {
		return lang === "en" && job?.translations?.en?.description
			? job.translations.en.description
			: job?.description;
	}
	function getResponsibilities(job: any) {
		return lang === "en" && job?.translations?.en?.responsibilities
			? job.translations.en.responsibilities
			: job?.responsibilities;
	}
	function getQualifications(job: any) {
		return lang === "en" && job?.translations?.en?.qualifications
			? job.translations.en.qualifications
			: job?.qualifications;
	}
	function getBenefits(job: any) {
		return lang === "en" && job?.translations?.en?.benefits
			? job.translations.en.benefits
			: job?.benefits;
	}

	function selectJobForApplication(job: any) {
		selectedJobId = job.id;
		showOpenApplication = false;
		submissionReceipt = null;
		sgb2InterestState =
			job.sgb2Eligible === "sgb2_16i" || job.sgb2Eligible === "sgb2_16d"
				? job.sgb2Eligible
				: "none";
	}

	function startOpenApplication() {
		selectedJobId = null;
		showOpenApplication = true;
		submissionReceipt = null;
		sgb2InterestState = "none";
	}
</script>

<svelte:head>
	<title>{lang === "de" ? "Karriereportal & Stellenangebote · AC Talents" : "Careers Portal & Open Roles · AC Talents"}</title>
</svelte:head>

<a
	href="#careers-main-content"
	class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-teal-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg"
>
	{lang === "de" ? "Direkt zum Hauptinhalt springen" : "Skip to main content"}
</a>

<div class="space-y-8 pb-12">
	<!-- Accessible Hero & Language Switcher -->
	<header class="relative overflow-hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-950 via-teal-900 to-slate-900 p-6 md:p-10 text-white shadow-xl">
		<div class="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
			<div class="max-w-3xl space-y-3">
				<div class="flex flex-wrap items-center gap-2">
					<span class="inline-flex items-center gap-1.5 rounded-full bg-teal-400/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-200 border border-teal-400/30">
						<HeartHandshake class="h-3.5 w-3.5" />
						{lang === "de" ? "Gemeinnützig · Tarifgebunden · Inklusiv" : "Non-Profit · Collective Pay Scale · Inclusive"}
					</span>
					<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-200 border border-emerald-400/30">
						<Accessibility class="h-3.5 w-3.5" />
						WCAG 2.1 AA / BITV 2.0
					</span>
					<span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-400/20 px-3 py-1 text-xs font-semibold text-indigo-200 border border-indigo-400/30">
						<ShieldCheck class="h-3.5 w-3.5" />
						PKI & Blockchain Chain-of-Custody
					</span>
				</div>
				<h1 class="text-3xl md:text-4xl font-black tracking-tight">
					{lang === "de"
						? "Gestalten Sie soziale Teilhabe & digitale Zukunft mit uns"
						: "Shape Social Inclusion & Digital Innovation With Us"}
				</h1>
				<p class="text-sm md:text-base text-teal-100/90 leading-relaxed">
					{lang === "de"
						? "Transparente Vergütung nach Tarifwerk (AWO / TV-L), familienfreundliche Arbeitsmodelle, § 16i/16d SGB II Förderung und Ende-zu-Ende-verschlüsselte Bewerbungsprozesse."
						: "Transparent collective pay scales (AWO / TV-L), flexible hybrid work models, § 16i/16d SGB II inclusion support, and end-to-end encrypted application processing."}
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-3 self-start lg:self-center">
				<div
					role="group"
					aria-label={lang === "de" ? "Sprachauswahl" : "Language selector"}
					class="inline-flex rounded-xl bg-white/10 p-1 backdrop-blur-sm border border-white/15"
				>
					<button
						type="button"
						onclick={() => (lang = "de")}
						aria-pressed={lang === "de"}
						class="rounded-lg px-3 py-1.5 text-xs font-bold transition-colors {lang === 'de'
							? 'bg-white text-teal-950 shadow'
							: 'text-teal-100 hover:text-white'}"
					>
						DE · Deutsch
					</button>
					<button
						type="button"
						onclick={() => (lang = "en")}
						aria-pressed={lang === "en"}
						class="rounded-lg px-3 py-1.5 text-xs font-bold transition-colors {lang === 'en'
							? 'bg-white text-teal-950 shadow'
							: 'text-teal-100 hover:text-white'}"
					>
						EN · English
					</button>
				</div>

				<Button
					type="button"
					variant="secondary"
					onclick={startOpenApplication}
					class="bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold"
				>
					<Sparkles class="h-4 w-4 mr-1.5" />
					{lang === "de" ? "Initiativbewerbung" : "Open Application"}
				</Button>

				<Button
					type="button"
					variant="outline"
					onclick={() => (showEmbedPreview = !showEmbedPreview)}
					class="border-white/30 bg-white/10 text-white hover:bg-white/20"
				>
					<Code2 class="h-4 w-4 mr-1.5" />
					{lang === "de" ? "Iframe / Embed" : "Embed Subview"}
				</Button>
			</div>
		</div>
	</header>

	<!-- Collapsible Embed & Iframe Preview Bar -->
	{#if showEmbedPreview}
		<section
			aria-label="Embed Preview"
			class="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 space-y-3"
		>
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
				<div>
					<h2 class="text-sm font-bold text-indigo-950 flex items-center gap-2">
						<Code2 class="h-4 w-4 text-indigo-600" />
						{lang === "de"
							? "Einbettbare Karriere-Ansicht für externe Träger-Webseiten (/careers/embed)"
							: "Embeddable Careers Subview for External Websites (/careers/embed)"}
					</h2>
					<p class="text-xs text-indigo-800">
						{lang === "de"
							? "Binden Sie Stellenangebote nahtlos per Iframe auf Ihrer Vereins- oder Träger-Webseite ein (inkl. automatischer Höhenanpassung via postMessage)."
							: "Embed job listings seamlessly on external websites with automatic postMessage height resizing."}
					</p>
				</div>
				<a
					href="/careers/embed?lang={lang}"
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
				>
					<ExternalLink class="h-3.5 w-3.5" />
					{lang === "de" ? "Chromeless Subview öffnen" : "Open Chromeless Subview"}
				</a>
			</div>
			<pre class="overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-emerald-300 font-mono">&lt;iframe src="/careers/embed?lang={lang}&amp;department=all" width="100%" height="700" style="border:0;" title="Karriereportal"&gt;&lt;/iframe&gt;</pre>
		</section>
	{/if}

	<!-- Search & Filter Bar -->
	<section
		role="search"
		aria-label={lang === "de" ? "Stellenangebote filtern" : "Filter job postings"}
		class="rounded-2xl border bg-white p-5 shadow-sm space-y-4"
	>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
			<div class="md:col-span-2">
				<label for="careers-search-input" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
					{lang === "de" ? "Stichwortsuche (Beruf, Tarif, Ort)" : "Keyword Search (Role, Pay Scale, City)"}
				</label>
				<div class="relative">
					<Search class="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
					<input
						id="careers-search-input"
						type="search"
						bind:value={searchQuery}
						placeholder={lang === "de"
							? "z.B. Sozialpädagogik, IT, S11b, E11, § 16i..."
							: "e.g. Social Work, IT, S11b, E11, § 16i..."}
						class="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
					/>
				</div>
			</div>

			<div>
				<label for="careers-workmodel-select" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
					{lang === "de" ? "Arbeitsmodell" : "Work Model"}
				</label>
				<select
					id="careers-workmodel-select"
					bind:value={selectedWorkModel}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
				>
					<option value="all">{lang === "de" ? "Alle Arbeitsmodelle" : "All Work Models"}</option>
					<option value="hybrid">{lang === "de" ? "Hybrid / Mobil" : "Hybrid / Flexible"}</option>
					<option value="onsite">{lang === "de" ? "Vor Ort (Präsenz)" : "On-site"}</option>
					<option value="remote">{lang === "de" ? "100% Remote" : "100% Remote"}</option>
				</select>
			</div>

			<div>
				<label for="careers-sgb2-select" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
					{lang === "de" ? "SGB II Teilhabeförderung" : "SGB II Inclusion Funding"}
				</label>
				<select
					id="careers-sgb2-select"
					bind:value={selectedSgb2}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
				>
					<option value="all">{lang === "de" ? "Alle Stellen" : "All Roles"}</option>
					<option value="sgb2">{lang === "de" ? "Förderfähig nach § 16i / § 16d SGB II" : "Eligible for § 16i / § 16d SGB II"}</option>
				</select>
			</div>
		</div>

		<!-- Department Pills -->
		<div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
			<span class="text-xs font-semibold text-slate-500 mr-1">
				{lang === "de" ? "Fachbereich:" : "Department:"}
			</span>
			<button
				type="button"
				onclick={() => (selectedDepartment = "all")}
				aria-pressed={selectedDepartment === "all"}
				class="rounded-full px-3.5 py-1 text-xs font-bold transition-colors {selectedDepartment === 'all'
					? 'bg-teal-700 text-white'
					: 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
			>
				{lang === "de" ? "Alle Bereiche" : "All Departments"} ({allJobs.length})
			</button>
			{#each departments as dept (dept)}
				<button
					type="button"
					onclick={() => (selectedDepartment = dept)}
					aria-pressed={selectedDepartment === dept}
					class="rounded-full px-3.5 py-1 text-xs font-bold transition-colors {selectedDepartment === dept
						? 'bg-teal-700 text-white'
						: 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
				>
					{dept}
				</button>
			{/each}
		</div>
	</section>

	<!-- Live Status & Main Grid -->
	<main id="careers-main-content" class="grid grid-cols-1 gap-8 lg:grid-cols-12">
		<!-- Left Column: Department-Grouped Job Listings -->
		<div class="lg:col-span-7 space-y-6" aria-live="polite">
			{#if jobsQuery.loading && !jobsQuery.current}
				<div class="rounded-2xl border bg-white p-10 text-center text-slate-500">
					{lang === "de" ? "Stellenangebote werden geladen..." : "Loading open positions..."}
				</div>
			{:else if jobsQuery.error}
				<div class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 text-sm">
					{jobsQuery.error.message}
				</div>
			{:else if groupedByDepartment.length === 0}
				<div class="rounded-2xl border bg-white p-10 text-center space-y-3">
					<p class="text-base font-bold text-slate-800">
						{lang === "de"
							? "Keine passenden Stellen für Ihre aktuelle Filterauswahl gefunden."
							: "No matching roles found for your current filter selection."}
					</p>
					<Button
						type="button"
						variant="outline"
						onclick={() => {
							searchQuery = "";
							selectedDepartment = "all";
							selectedWorkModel = "all";
							selectedSgb2 = "all";
						}}
					>
						{lang === "de" ? "Filter zurücksetzen" : "Reset filters"}
					</Button>
				</div>
			{:else}
				{#each groupedByDepartment as [deptName, deptJobs] (deptName)}
					<section aria-label={deptName} class="space-y-3">
						<div class="flex items-center justify-between border-b border-slate-200 pb-2">
							<h2 class="text-lg font-extrabold text-slate-900 flex items-center gap-2">
								<Building2 class="h-5 w-5 text-teal-700" />
								{deptName}
							</h2>
							<span class="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800 border border-teal-200">
								{deptJobs.length} {lang === "de" ? "Stelle(n)" : "Role(s)"}
							</span>
						</div>

						<div class="space-y-3">
							{#each deptJobs as job (job.id)}
								{@const isSelected = selectedJobId === job.id}
								<article
									class="rounded-2xl border p-5 transition-all bg-white hover:shadow-md {isSelected
										? 'border-teal-600 ring-2 ring-teal-500/20 bg-teal-50/20'
										: 'border-slate-200'}"
								>
									<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
										<div class="space-y-1.5">
											<div class="flex flex-wrap items-center gap-2">
												<span class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
													<Clock class="h-3 w-3" />
													{job.workHoursPerWeek || 39}h / {lang === "de" ? "Woche" : "wk"}
												</span>
												<span class="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
													<Globe class="h-3 w-3" />
													{job.workModel === "hybrid"
														? "Hybrid"
														: job.workModel === "remote"
															? "Remote"
															: lang === "de"
																? "Vor Ort"
																: "On-site"}
												</span>
												{#if job.entgeltgruppe || job.contractFrameworkCode}
													<span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
														<Euro class="h-3 w-3" />
														{job.contractFrameworkCode || "Tarif"} · EG {job.entgeltgruppe || "E9"}
														{#if job.salaryRangeMin && job.salaryRangeMax}
															({job.salaryRangeMin}–{job.salaryRangeMax} €)
														{/if}
													</span>
												{/if}
												{#if job.sgb2Eligible && job.sgb2Eligible !== "none"}
													<span class="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-200">
														{job.sgb2Eligible === "sgb2_16i" ? "§ 16i SGB II Teilhabe" : "§ 16d SGB II"}
													</span>
												{/if}
											</div>

											<h3 class="text-lg font-bold text-slate-900">
												{getTitle(job)}
											</h3>
											<p class="text-sm text-slate-600 line-clamp-2">
												{getSummary(job) || getDescription(job)}
											</p>
										</div>

										<Button
											type="button"
											onclick={() => selectJobForApplication(job)}
											class="shrink-0 bg-teal-700 hover:bg-teal-800 text-white"
										>
											{lang === "de" ? "Details & Bewerben" : "Details & Apply"}
										</Button>
									</div>

									{#if job.accessibilityNotes}
										<div class="mt-3 flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100 pt-2.5">
											<Accessibility class="h-3.5 w-3.5 text-teal-600 shrink-0" />
											<span>{job.accessibilityNotes}</span>
										</div>
									{/if}
								</article>
							{/each}
						</div>
					</section>
				{/each}
			{/if}
		</div>

		<!-- Right Column: Job Detail + Accessible Application Intake Form -->
		<div class="lg:col-span-5">
			<div class="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg space-y-6">
				{#if submissionReceipt}
					<div
						role="status"
						aria-live="polite"
						class="rounded-2xl border-2 border-emerald-300 bg-emerald-50/80 p-6 space-y-4"
					>
						<div class="flex items-center gap-3">
							<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
								<CheckCircle2 class="h-6 w-6" />
							</div>
							<div>
								<h2 class="text-lg font-black text-emerald-950">
									{lang === "de" ? "Bewerbung sicher eingegangen!" : "Application Securely Received!"}
								</h2>
								<p class="text-xs text-emerald-800">
									{submissionReceipt.jobTitle} · Version v{submissionReceipt.versionNumber}
								</p>
							</div>
						</div>

						<p class="text-sm text-emerald-900 leading-relaxed">
							{lang === "de"
								? "Ihre Bewerbungs- und Kontaktdaten wurden Ende-zu-Ende (RSA-OAEP-256 + AES-256-GCM) verschlüsselt und im unveränderlichen Chain-of-Custody-Ledger protokolliert."
								: "Your application and contact details have been encrypted end-to-end (RSA-OAEP-256 + AES-256-GCM) and recorded in the tamper-evident Chain-of-Custody ledger."}
						</p>

						<div class="rounded-xl bg-slate-900 p-3.5 text-xs text-slate-200 space-y-1 font-mono">
							<div class="text-[10px] uppercase tracking-wider text-teal-400 font-sans font-bold">
								{lang === "de" ? "Kryptografischer Empfangsnachweis (Block-Hash)" : "Cryptographic Receipt (Block Hash)"}
							</div>
							<div class="break-all text-emerald-300">{submissionReceipt.ledgerBlockHash}</div>
						</div>

						<Button
							type="button"
							variant="outline"
							onclick={() => (submissionReceipt = null)}
							class="w-full"
						>
							{lang === "de" ? "Weitere Stelle ansehen" : "Browse More Roles"}
						</Button>
					</div>
				{:else if selectedJob || showOpenApplication}
					{#if selectedJob}
						<div class="space-y-3 border-b border-slate-200 pb-4">
							<div class="flex items-start justify-between gap-2">
								<div>
									<span class="text-xs font-bold uppercase tracking-wider text-teal-700">
										{selectedJob.department}
									</span>
									<h2 class="text-xl font-black text-slate-900">{getTitle(selectedJob)}</h2>
								</div>
								<button
									type="button"
									onclick={() => (selectedJobId = null)}
									aria-label={lang === "de" ? "Schließen" : "Close"}
									class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
								>
									<X class="h-4 w-4" />
								</button>
							</div>

							<p class="text-sm text-slate-700 leading-relaxed">
								{getDescription(selectedJob) || getSummary(selectedJob)}
							</p>

							{#if getResponsibilities(selectedJob)}
								<div class="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
									<div class="font-bold text-slate-900">
										{lang === "de" ? "Aufgaben & Wirkung:" : "Responsibilities:"}
									</div>
									<p class="whitespace-pre-line">{getResponsibilities(selectedJob)}</p>
								</div>
							{/if}

							{#if getQualifications(selectedJob)}
								<div class="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
									<div class="font-bold text-slate-900">
										{lang === "de" ? "Ihr Profil:" : "Qualifications:"}
									</div>
									<p class="whitespace-pre-line">{getQualifications(selectedJob)}</p>
								</div>
							{/if}

							{#if getBenefits(selectedJob)}
								<div class="rounded-xl bg-teal-50/60 p-3 text-xs text-teal-950 space-y-1">
									<div class="font-bold">
										{lang === "de" ? "Unser Angebot:" : "Benefits:"}
									</div>
									<p class="whitespace-pre-line">{getBenefits(selectedJob)}</p>
								</div>
							{/if}
						</div>
					{:else}
						<div class="border-b border-slate-200 pb-3">
							<span class="text-xs font-bold uppercase tracking-wider text-amber-700">
								{lang === "de" ? "Initiativbewerbung" : "Open Application"}
							</span>
							<h2 class="text-xl font-black text-slate-900">
								{lang === "de"
									? "Bewerben Sie sich initiativ bei uns"
									: "Submit an Open Application"}
							</h2>
						</div>
					{/if}

					<!-- Application Form using Strict SvelteKit Remote Form Fields API -->
					<form
						{...rf.preflight(applicantIntakeSchema).enhance(async ({ submit }) => {
							try {
								await submit();
								const res = rf.result as any;
								if (res?.success) {
									submissionReceipt = {
										talentId: res.talentId,
										ledgerBlockHash: res.ledgerBlockHash,
										versionNumber: res.versionNumber ?? 1,
										jobTitle: selectedJob ? getTitle(selectedJob) : "Initiativbewerbung",
									};
									toast.success(
										lang === "de"
											? "Bewerbung erfolgreich & verschlüsselt übermittelt!"
											: "Application encrypted and submitted!",
									);
								}
							} catch (err: any) {
								toast.error(err?.message || "Submission failed");
							}
						})}
						class="space-y-4"
					>
						<input {...rf.fields.channel.as("hidden", "public_portal")} />
						{#if selectedJob?.id}
							<input {...rf.fields.jobPostingId.as("hidden", selectedJob.id)} />
						{/if}
						<input
							{...rf.fields.jobTitle.as(
								"hidden",
								selectedJob?.title || "Initiativbewerbung",
							)}
						/>
						<input
							{...rf.fields.department.as(
								"hidden",
								selectedJob?.department || "Allgemein",
							)}
						/>
						<input {...rf.fields.sgb2Interest.as("hidden", sgb2InterestState)} />

						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div>
								<label for="apply-given-name" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "Vorname *" : "First Name *"}
								</label>
								<input
									id="apply-given-name"
									{...rf.fields.givenName.as("text")}
									required
									onblur={() => void rf.validate().catch(() => {})}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
								{#each rf.fields.givenName.issues() as issue, idx (idx)}
									<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
								{/each}
							</div>

							<div>
								<label for="apply-family-name" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "Nachname *" : "Last Name *"}
								</label>
								<input
									id="apply-family-name"
									{...rf.fields.familyName.as("text")}
									required
									onblur={() => void rf.validate().catch(() => {})}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
								{#each rf.fields.familyName.issues() as issue, idx (idx)}
									<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
								{/each}
							</div>
						</div>

						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div>
								<label for="apply-email" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "E-Mail-Adresse *" : "Email Address *"}
								</label>
								<input
									id="apply-email"
									{...rf.fields.email.as("email")}
									required
									onblur={() => void rf.validate().catch(() => {})}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
								{#each rf.fields.email.issues() as issue, idx (idx)}
									<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
								{/each}
							</div>

							<div>
								<label for="apply-phone" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "Telefonnummer" : "Phone Number"}
								</label>
								<input
									id="apply-phone"
									{...rf.fields.phone.as("tel")}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>
						</div>

						<div class="grid grid-cols-3 gap-2">
							<div class="col-span-2">
								<label for="apply-street" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "Straße" : "Street"}
								</label>
								<input
									id="apply-street"
									{...rf.fields.street.as("text")}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>
							<div>
								<label for="apply-house" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "Hausnr." : "No."}
								</label>
								<input
									id="apply-house"
									{...rf.fields.houseNumber.as("text")}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>
						</div>

						<div class="grid grid-cols-3 gap-2">
							<div>
								<label for="apply-zip" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "PLZ" : "ZIP"}
								</label>
								<input
									id="apply-zip"
									{...rf.fields.zip.as("text")}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>
							<div class="col-span-2">
								<label for="apply-city" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "Wohnort" : "City"}
								</label>
								<input
									id="apply-city"
									{...rf.fields.city.as("text")}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>
						</div>

						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div>
								<label for="apply-avail" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "Verfügbar ab" : "Available From"}
								</label>
								<input
									id="apply-avail"
									{...rf.fields.availabilityDate.as("date")}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>
							<div>
								<label for="apply-salary" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "Gehaltswunsch (€/Monat)" : "Salary Expectation (€)"}
								</label>
								<input
									id="apply-salary"
									{...rf.fields.salaryExpectation.as("text")}
									placeholder="z.B. 3.900 € / Tarif"
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>
						</div>

						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div>
								<label for="apply-resume" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "Lebenslauf / CV-Link (URL)" : "Resume / CV Link"}
								</label>
								<input
									id="apply-resume"
									{...rf.fields.resumeUrl.as("url")}
									placeholder="https://..."
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>
							<div>
								<label for="apply-portfolio" class="block text-xs font-bold text-slate-700 mb-1">
									{lang === "de" ? "Portfolio / LinkedIn" : "Portfolio / LinkedIn"}
								</label>
								<input
									id="apply-portfolio"
									{...rf.fields.portfolioUrl.as("url")}
									placeholder="https://..."
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>
						</div>

						<div>
							<label for="apply-sgb2-ui" class="block text-xs font-bold text-slate-700 mb-1">
								{lang === "de" ? "SGB II Förderberechtigung (optional)" : "SGB II Inclusion Eligibility (optional)"}
							</label>
							<select
								id="apply-sgb2-ui"
								bind:value={sgb2InterestState}
								class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
							>
								<option value="none">{lang === "de" ? "Keine / Reguläre Beschäftigung" : "None / Regular Employment"}</option>
								<option value="sgb2_16i">{lang === "de" ? "§ 16i SGB II (Teilhabe am Arbeitsmarkt)" : "§ 16i SGB II Participation Program"}</option>
								<option value="sgb2_16d">{lang === "de" ? "§ 16d SGB II (Arbeitsgelegenheit)" : "§ 16d SGB II Community Opportunity"}</option>
							</select>
						</div>

						<div>
							<label for="apply-motivation" class="block text-xs font-bold text-slate-700 mb-1">
								{lang === "de" ? "Kurzprofil & Motivation" : "Short Motivation & Summary"}
							</label>
							<textarea
								id="apply-motivation"
								{...rf.fields.motivationNotes.as("text")}
								rows={3}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							></textarea>
						</div>

						<div>
							<label for="apply-access" class="block text-xs font-bold text-slate-700 mb-1">
								{lang === "de"
									? "Barrierefreiheit & gewünschte Vorkehrungen im Gespräch (optional)"
									: "Accessibility Accommodations for Interview (optional)"}
							</label>
							<input
								id="apply-access"
								{...rf.fields.accessibilityAccommodations.as("text")}
								placeholder={lang === "de" ? "z.B. Gebärdensprachdolmetschung, barrierefreier Raum..." : "e.g. Sign language interpreter, step-free room..."}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>

						<div class="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 flex items-start gap-2">
							<ShieldCheck class="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
							<span>
								{lang === "de"
									? "DSGVO & PKI-Schutz: Ihre Angaben werden mit einem eigenen datensubjektbezogenen Schlüssel (AES-256-GCM / RSA-OAEP-256) verschlüsselt. Sie können jederzeit über das DSGVO-Self-Service-Portal Auskunft oder Crypto-Shredding anfordern."
									: "GDPR & PKI Protection: Your data is encrypted with a per-subject DEK (AES-256-GCM / RSA-OAEP-256) and logged in our tamper-proof custody ledger."}
							</span>
						</div>

						<AsyncButton
							type="submit"
							loading={rf.pending > 0}
							class="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5"
						>
							<Send class="h-4 w-4 mr-2" />
							{lang === "de" ? "Bewerbung verschlüsselt absenden" : "Submit Encrypted Application"}
						</AsyncButton>
					</form>
				{:else}
					<div class="py-8 text-center space-y-4">
						<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
							<Briefcase class="h-6 w-6" />
						</div>
						<div class="space-y-1">
							<h2 class="text-base font-bold text-slate-900">
								{lang === "de"
									? "Wählen Sie eine Stelle aus oder starten Sie eine Initiativbewerbung"
									: "Select a Position or Start an Open Application"}
							</h2>
							<p class="text-xs text-slate-500 max-w-sm mx-auto">
								{lang === "de"
									? "Klicken Sie links auf „Details & Bewerben“, um Aufgaben, Tarifgruppe und das barrierefreie Direkt-Bewerbungsformular zu öffnen."
									: "Click 'Details & Apply' on any job card to view full role details and submit your application."}
							</p>
						</div>
						<Button type="button" variant="outline" onclick={startOpenApplication}>
							<FileText class="h-4 w-4 mr-1.5" />
							{lang === "de" ? "Initiativbewerbung starten" : "Start Open Application"}
						</Button>
					</div>
				{/if}
			</div>
		</div>
	</main>
</div>
