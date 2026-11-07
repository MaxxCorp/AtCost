<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { browser } from "$app/env";
	import { listJobPostings, submitApplicantIntake } from "../../recruitment/recruitment.remote";
	import { applicantIntakeSchema } from "@ac/validations";
	import { Button, AsyncButton } from "@ac/ui";
	import { toast } from "svelte-sonner";
	import {
		Briefcase,
		Clock,
		Globe,
		Euro,
		CheckCircle2,
		Send,
		ShieldCheck,
		Search,
	} from "@lucide/svelte";

	const theme = $derived(page.url.searchParams.get("theme") === "dark" ? "dark" : "light");

	let langOverride = $state<"de" | "en" | null>(null);
	const lang = $derived(
		langOverride ?? (page.url.searchParams.get("lang") === "en" ? "en" : "de"),
	);
	let searchQuery = $state("");
	let deptOverride = $state<string | null>(null);
	const selectedDepartment = $derived(
		deptOverride ?? (page.url.searchParams.get("department") || "all"),
	);
	let activeJobId = $state<string | null>(null);
	let receiptHash = $state<string | null>(null);

	const jobsQuery = listJobPostings({ onlyPublic: true, limit: 50 });
	const jobs = $derived(jobsQuery.current?.data ?? []);
	const departments = $derived(jobsQuery.current?.departments ?? []);

	const filteredJobs = $derived.by(() => {
		return jobs.filter((jp: any) => {
			if (selectedDepartment !== "all" && jp.department !== selectedDepartment) return false;
			if (searchQuery.trim()) {
				const q = searchQuery.trim().toLowerCase();
				const hay = `${jp.title} ${jp.department} ${jp.summary || ""} ${jp.translations?.en?.title || ""}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	});

	const groupedJobs = $derived.by(() => {
		const groups: Record<string, any[]> = {};
		for (const jp of filteredJobs) {
			const dept = jp.department || "Allgemein";
			if (!groups[dept]) groups[dept] = [];
			groups[dept].push(jp);
		}
		return Object.entries(groups);
	});

	const rf = submitApplicantIntake;

	onMount(() => {
		if (!browser) return;
		const postHeight = () => {
			try {
				window.parent?.postMessage(
					{
						type: "ac-careers-embed-resize",
						height: document.body.scrollHeight,
					},
					"*",
				);
			} catch {
				// ignore cross-origin restrictions
			}
		};
		postHeight();
		const observer = new ResizeObserver(postHeight);
		observer.observe(document.body);
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>AC Talents · Careers Embed</title>
</svelte:head>

<div class="p-4 sm:p-6 {theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'} space-y-5">
	<!-- Compact Header & Filter -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
		<div class="flex items-center gap-2.5">
			<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white">
				<Briefcase class="h-5 w-5" />
			</div>
			<div>
				<h1 class="text-base font-extrabold">
					{lang === "de" ? "Offene Stellenangebote" : "Open Positions"}
				</h1>
				<p class="text-xs text-slate-500">
					{lang === "de" ? "Direktbewerbung · PKI-verschlüsselt · Barrierefrei" : "Direct Application · PKI-Encrypted · Accessible"}
				</p>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<div class="relative">
				<Search class="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
				<input
					type="search"
					bind:value={searchQuery}
					placeholder={lang === "de" ? "Stelle suchen..." : "Search roles..."}
					aria-label={lang === "de" ? "Stelle suchen" : "Search roles"}
					class="rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs bg-white text-slate-900"
				/>
			</div>

			<select
				value={selectedDepartment}
				onchange={(e) => (deptOverride = e.currentTarget.value)}
				aria-label={lang === "de" ? "Fachbereich" : "Department"}
				class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white text-slate-900"
			>
				<option value="all">{lang === "de" ? "Alle Bereiche" : "All Departments"}</option>
				{#each departments as dept (dept)}
					<option value={dept}>{dept}</option>
				{/each}
			</select>

			<button
				type="button"
				onclick={() => (langOverride = lang === "de" ? "en" : "de")}
				class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold"
			>
				{lang === "de" ? "EN" : "DE"}
			</button>
		</div>
	</div>

	{#if receiptHash}
		<div class="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 space-y-2">
			<div class="flex items-center gap-2 font-bold text-sm">
				<CheckCircle2 class="h-4 w-4 text-emerald-600" />
				{lang === "de" ? "Bewerbung erfolgreich übermittelt!" : "Application submitted!"}
			</div>
			<p class="text-xs font-mono break-all">Chain-of-Custody Block Hash: {receiptHash}</p>
			<Button type="button" size="sm" variant="outline" onclick={() => (receiptHash = null)}>
				{lang === "de" ? "Zurück zur Übersicht" : "Back to listings"}
			</Button>
		</div>
	{/if}

	{#if jobsQuery.loading && !jobsQuery.current}
		<div class="py-8 text-center text-xs text-slate-500">
			{lang === "de" ? "Stellen werden geladen..." : "Loading roles..."}
		</div>
	{:else}
		<div class="space-y-5">
			{#each groupedJobs as [dept, deptJobs] (dept)}
				<div class="space-y-2.5">
					<h2 class="text-xs font-black uppercase tracking-wider text-teal-700">{dept}</h2>
					{#each deptJobs as job (job.id)}
						<div class="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/40">
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
								<div>
									<h3 class="text-sm font-bold">
										{lang === "en" && job.translations?.en?.title ? job.translations.en.title : job.title}
									</h3>
									<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
										<span class="inline-flex items-center gap-1">
											<Clock class="h-3 w-3" /> {job.workHoursPerWeek || 39}h
										</span>
										<span class="inline-flex items-center gap-1">
											<Globe class="h-3 w-3" /> {job.workModel}
										</span>
										{#if job.entgeltgruppe}
											<span class="inline-flex items-center gap-1 font-semibold text-emerald-700">
												<Euro class="h-3 w-3" /> EG {job.entgeltgruppe}
											</span>
										{/if}
									</div>
								</div>

								<Button
									type="button"
									size="sm"
									onclick={() => (activeJobId = activeJobId === job.id ? null : job.id)}
									class="bg-teal-700 hover:bg-teal-800 text-white text-xs"
								>
									{activeJobId === job.id
										? lang === "de"
											? "Schließen"
											: "Close"
										: lang === "de"
											? "Direkt bewerben"
											: "Apply Now"}
								</Button>
							</div>

							{#if activeJobId === job.id}
								<form
									{...rf.preflight(applicantIntakeSchema).enhance(async ({ submit }) => {
										try {
											await submit();
											const res = rf.result as any;
											if (res?.success) {
												receiptHash = res.ledgerBlockHash;
												activeJobId = null;
												toast.success(lang === "de" ? "Bewerbung gesendet!" : "Application sent!");
											}
										} catch (e: any) {
											toast.error(e?.message || "Error");
										}
									})}
									class="mt-3 border-t border-slate-200 pt-3 space-y-3"
								>
									<input {...rf.fields.channel.as("hidden", "public_portal")} />
									<input {...rf.fields.jobPostingId.as("hidden", job.id)} />
									<input {...rf.fields.jobTitle.as("hidden", job.title)} />
									<input {...rf.fields.department.as("hidden", job.department)} />

									<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
										<div>
											<label for="embed-gn-{job.id}" class="block text-[11px] font-bold mb-0.5">
												{lang === "de" ? "Vorname *" : "First Name *"}
											</label>
											<input
												id="embed-gn-{job.id}"
												{...rf.fields.givenName.as("text")}
												required
												class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white text-slate-900"
											/>
										</div>
										<div>
											<label for="embed-fn-{job.id}" class="block text-[11px] font-bold mb-0.5">
												{lang === "de" ? "Nachname *" : "Last Name *"}
											</label>
											<input
												id="embed-fn-{job.id}"
												{...rf.fields.familyName.as("text")}
												required
												class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white text-slate-900"
											/>
										</div>
									</div>

									<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
										<div>
											<label for="embed-em-{job.id}" class="block text-[11px] font-bold mb-0.5">
												E-Mail *
											</label>
											<input
												id="embed-em-{job.id}"
												{...rf.fields.email.as("email")}
												required
												class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white text-slate-900"
											/>
										</div>
										<div>
											<label for="embed-ph-{job.id}" class="block text-[11px] font-bold mb-0.5">
												{lang === "de" ? "Telefon" : "Phone"}
											</label>
											<input
												id="embed-ph-{job.id}"
												{...rf.fields.phone.as("tel")}
												class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white text-slate-900"
											/>
										</div>
									</div>

									<div>
										<label for="embed-mot-{job.id}" class="block text-[11px] font-bold mb-0.5">
											{lang === "de" ? "Kurznachricht / Motivation" : "Short Note / Motivation"}
										</label>
										<textarea
											id="embed-mot-{job.id}"
											{...rf.fields.motivationNotes.as("text")}
											rows={2}
											class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white text-slate-900"
										></textarea>
									</div>

									<div class="flex items-center justify-between gap-2">
										<span class="inline-flex items-center gap-1 text-[10px] text-slate-500">
											<ShieldCheck class="h-3.5 w-3.5 text-teal-600" />
											RSA-OAEP-256 + AES-256-GCM
										</span>
										<AsyncButton
											type="submit"
											size="sm"
											loading={rf.pending > 0}
											class="bg-teal-700 hover:bg-teal-800 text-white text-xs"
										>
											<Send class="h-3.5 w-3.5 mr-1" />
											{lang === "de" ? "Absenden" : "Submit"}
										</AsyncButton>
									</div>
								</form>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>
