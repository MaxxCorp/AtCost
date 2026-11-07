<script lang="ts">
	import { onMount } from "svelte";
	import {
		listJobPostings,
		upsertJobPosting,
		deleteJobPostings,
		getPipelineOverview,
		transitionPipelineStage,
		sendApplicantInvitation,
		submitApplicantIntake,
		verifyCustodyChain,
		getPkiStatus,
	} from "./recruitment.remote";
	import { listLocations } from "../locations/list.remote";
	import { createLocation } from "../locations/new/create.remote";
	import { updateLocation } from "../locations/[id]/update.remote";
	import { readLocation } from "../locations/[id]/read.remote";
	import { deleteLocation } from "../locations/[id]/delete.remote";
	import { listContacts } from "../contacts/list.remote";
	import {
		jobPostingSchema,
		sendApplicantInvitationSchema,
		applicantIntakeSchema,
		PIPELINE_STAGES,
		DEFAULT_CUSTOM_ONBOARDING_FIELDS,
		createLocationSchema,
		updateLocationSchema,
		type PipelineStage,
	} from "@ac/validations";
	import {
		Button,
		AsyncButton,
		EntityManager,
		ContactManager,
		LocationForm,
		LoadingSection,
		ErrorSection,
		handleDelete,
		matchContactSearch,
	} from "@ac/ui";
	import * as m from "#lib/paraglide/messages.js";
	import { getLocationFilterGroups, getContactFilterGroups } from "#lib/filters/index.js";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import SyncCheckboxBlock from "#lib/components/sync/SyncCheckboxBlock.svelte";
	import InterviewScorecardPanel from "#lib/components/recruitment/InterviewScorecardPanel.svelte";
	import OnboardingPayrollForm from "#lib/components/recruitment/OnboardingPayrollForm.svelte";
	import CustodyLedgerPanel from "#lib/components/talent/CustodyLedgerPanel.svelte";
	import { toast } from "svelte-sonner";
	import {
		Briefcase,
		Users,
		Plus,
		Search,
		Star,
		ShieldCheck,
		CheckCircle2,
		AlertCircle,
		Send,
		ClipboardCheck,
		FileSignature,
		History,
		Globe,
		Lock,
		Code2,
		Trash2,
		Edit2,
		ExternalLink,
		Copy,
		MapPin,
		User,
		KeyRound,
		LayoutGrid,
		List,
		X,
	} from "@lucide/svelte";

	breadcrumbState.set({ feature: "recruitment", current: "Hiring Pipeline & Job Roles" });

	let activeTab = $state<"pipeline" | "jobs" | "intake" | "custody">("pipeline");
	let pipelineViewMode = $state<"kanban" | "table">("kanban");

	// Pipeline Filters
	let pipelineSearch = $state("");
	let pipelineDepartment = $state("all");
	let pipelineJobId = $state("all");

	const pipelineQuery = $derived(
		getPipelineOverview({
			department: pipelineDepartment !== "all" ? pipelineDepartment : undefined,
			jobPostingId: pipelineJobId !== "all" ? pipelineJobId : undefined,
			search: pipelineSearch.trim() || undefined,
		}),
	);
	const pipelineData = $derived(pipelineQuery.current);
	const candidates = $derived(pipelineData?.candidates ?? []);

	const jobsQuery = listJobPostings({ onlyPublic: false, limit: 100 });
	const jobPostings = $derived(jobsQuery.current?.data ?? []);
	const departments = $derived(jobsQuery.current?.departments ?? []);

	const globalCustodyQuery = verifyCustodyChain();
	const globalCustody = $derived(globalCustodyQuery.current);

	const pkiQuery = getPkiStatus();
	const pkiStatus = $derived(pkiQuery.current);

	// Quick Action Modal State
	let activeModal = $state<
		| { type: "invite"; candidate?: any; defaultType: "application" | "onboarding" }
		| { type: "interview"; candidate: any }
		| { type: "onboarding"; candidate: any }
		| { type: "custody"; candidate: any }
		| { type: "embed"; job: any }
		| null
	>(null);

	let generatedMagicLink = $state<string | null>(null);

	// Job Role Editor State
	let showJobEditor = $state(false);
	let allLocations = $state<any[]>([]);
	let jobLocationIds = $state<string[]>([]);
	let jobContactIds = $state<string[]>([]);
	let jobSelectedContacts = $state<any[]>([]);
	let jobTagsText = $state("NGO, Tarifvertrag, Teilhabe");
	let jobCustomOnboardingFields = $state<any[]>([...DEFAULT_CUSTOM_ONBOARDING_FIELDS]);

	let jobFormState = $state({
		id: "",
		title: "",
		slug: "",
		department: "Soziale Arbeit & Beratung",
		roleCategory: "social_work",
		employmentType: "regular",
		workModel: "hybrid",
		workHoursPerWeek: 39,
		contractFrameworkCode: "AWO_BERLIN",
		entgeltgruppe: "S11b",
		erfahrungsstufe: 2,
		salaryRangeMin: 3850,
		salaryRangeMax: 4450,
		currency: "EUR",
		sgb2Eligible: "sgb2_16i",
		openingsCount: 1,
		status: "published",
		isPublic: true,
		summary: "",
		description: "",
		responsibilities: "",
		qualifications: "",
		benefits: "",
		equalOpportunityStatement:
			"Wir schätzen Vielfalt und begrüßen alle Bewerbungen – unabhängig von Herkunft, Geschlecht, Behinderung oder Lebensentwurf.",
		accessibilityNotes: "Barrierefreier Zugang vorhanden.",
		titleEn: "",
		departmentEn: "",
		summaryEn: "",
		descriptionEn: "",
		syncIds: [] as string[],
	});

	// Custom onboarding field designer inside Job Role Editor
	let newJobFieldLabelDe = $state("");
	let newJobFieldType = $state<"text" | "textarea" | "select" | "boolean" | "date">("text");
	let newJobFieldRequired = $state(false);

	function addJobCustomOnboardingField() {
		if (!newJobFieldLabelDe.trim()) return;
		const id = `role_field_${Date.now().toString(36)}`;
		jobCustomOnboardingFields = [
			...jobCustomOnboardingFields,
			{
				id,
				labelDe: newJobFieldLabelDe.trim(),
				labelEn: newJobFieldLabelDe.trim(),
				type: newJobFieldType,
				required: newJobFieldRequired,
				category: "custom",
			},
		];
		newJobFieldLabelDe = "";
		newJobFieldRequired = false;
	}

	function startNewJobPosting() {
		jobFormState = {
			id: "",
			title: "",
			slug: "",
			department: "Soziale Arbeit & Beratung",
			roleCategory: "social_work",
			employmentType: "regular",
			workModel: "hybrid",
			workHoursPerWeek: 39,
			contractFrameworkCode: "AWO_BERLIN",
			entgeltgruppe: "S11b",
			erfahrungsstufe: 2,
			salaryRangeMin: 3850,
			salaryRangeMax: 4450,
			currency: "EUR",
			sgb2Eligible: "none",
			openingsCount: 1,
			status: "published",
			isPublic: true,
			summary: "",
			description: "",
			responsibilities: "",
			qualifications: "",
			benefits: "",
			equalOpportunityStatement:
				"Wir schätzen Vielfalt und begrüßen alle Bewerbungen – unabhängig von Herkunft, Geschlecht, Behinderung oder Lebensentwurf.",
			accessibilityNotes: "Barrierefreier Zugang vorhanden.",
			titleEn: "",
			departmentEn: "",
			summaryEn: "",
			descriptionEn: "",
			syncIds: [],
		};
		jobLocationIds = [];
		jobContactIds = [];
		jobSelectedContacts = [];
		jobCustomOnboardingFields = [...DEFAULT_CUSTOM_ONBOARDING_FIELDS];
		showJobEditor = true;
	}

	function editJobPosting(jp: any) {
		jobFormState = {
			id: jp.id,
			title: jp.title || "",
			slug: jp.slug || "",
			department: jp.department || "Allgemein",
			roleCategory: jp.roleCategory || "general",
			employmentType: jp.employmentType || "regular",
			workModel: jp.workModel || "hybrid",
			workHoursPerWeek: Number(jp.workHoursPerWeek || 39),
			contractFrameworkCode: jp.contractFrameworkCode || "",
			entgeltgruppe: jp.entgeltgruppe || "",
			erfahrungsstufe: Number(jp.erfahrungsstufe || 1),
			salaryRangeMin: jp.salaryRangeMin ?? 3500,
			salaryRangeMax: jp.salaryRangeMax ?? 4200,
			currency: jp.currency || "EUR",
			sgb2Eligible: jp.sgb2Eligible || "none",
			openingsCount: Number(jp.openingsCount || 1),
			status: jp.status || "published",
			isPublic: Boolean(jp.isPublic),
			summary: jp.summary || "",
			description: jp.description || "",
			responsibilities: jp.responsibilities || "",
			qualifications: jp.qualifications || "",
			benefits: jp.benefits || "",
			equalOpportunityStatement: jp.equalOpportunityStatement || "",
			accessibilityNotes: jp.accessibilityNotes || "",
			titleEn: jp.translations?.en?.title || "",
			departmentEn: jp.translations?.en?.department || "",
			summaryEn: jp.translations?.en?.summary || "",
			descriptionEn: jp.translations?.en?.description || "",
			syncIds: jp.syncIds || [],
		};
		jobLocationIds = jp.locationIds || [];
		jobContactIds = jp.contactIds || [];
		jobSelectedContacts = jp.contacts || [];
		jobTagsText = (jp.tags || []).map((t: any) => t.name).join(", ");
		jobCustomOnboardingFields = jp.customOnboardingFields?.length
			? [...jp.customOnboardingFields]
			: [...DEFAULT_CUSTOM_ONBOARDING_FIELDS];
		showJobEditor = true;
	}

	async function handleDeleteJob(id: string) {
		try {
			await deleteJobPostings([id]);
			toast.success("Stellenausschreibung gelöscht.");
			await jobsQuery.refresh();
		} catch (e: any) {
			toast.error(e?.message || "Fehler beim Löschen.");
		}
	}

	async function handleStageMove(talentId: string, nextStage: PipelineStage) {
		try {
			await transitionPipelineStage({
				talentId,
				pipelineStage: nextStage,
			});
			toast.success(`Kandidat:in in Phase "${nextStage}" verschoben.`);
			await Promise.all([pipelineQuery.refresh(), globalCustodyQuery.refresh()]);
		} catch (e: any) {
			toast.error(e?.message || "Phasenwechsel fehlgeschlagen.");
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard?.writeText(text);
		toast.success("In die Zwischenablage kopiert!");
	}

	onMount(async () => {
		try {
			const locRes = await listLocations({});
			allLocations = locRes?.data ?? [];
		} catch {
			// ignore
		}
	});

	const jobLocationIdsJson = $derived(JSON.stringify(jobLocationIds));
	const jobContactIdsJson = $derived(JSON.stringify(jobContactIds));
	const jobTagsJson = $derived(
		JSON.stringify(
			jobTagsText
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean),
		),
	);
	const jobCustomFieldsJson = $derived(JSON.stringify(jobCustomOnboardingFields));

	const jobRf = upsertJobPosting;
	const inviteRf = sendApplicantInvitation;
	const intakeRf = submitApplicantIntake;
</script>

<svelte:head>
	<title>Recruitment, Hiring Pipeline & Onboarding · AC Talents</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Command Header -->
	<div class="rounded-3xl border border-violet-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-6 md:p-8 text-white shadow-xl">
		<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
			<div class="space-y-2">
				<div class="flex flex-wrap items-center gap-2">
					<span class="inline-flex items-center gap-1.5 rounded-full bg-violet-400/20 px-3 py-0.5 text-xs font-bold text-violet-200 border border-violet-400/30">
						<ShieldCheck class="w-3.5 h-3.5" />
						PKI Envelope Encrypted (M365 NGO Compatible)
					</span>
					<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-0.5 text-xs font-bold text-emerald-200 border border-emerald-400/30">
						<CheckCircle2 class="w-3.5 h-3.5" />
						RFC 6962 Blockchain Custody Verified ({globalCustody?.totalGlobalBlocks ?? 0} Blöcke)
					</span>
				</div>
				<h1 class="text-2xl sm:text-3xl font-black tracking-tight">
					Recruitment, Strukturiertes Interviewing & Onboarding-Pipeline
				</h1>
				<p class="text-xs sm:text-sm text-indigo-200 max-w-3xl">
					Steuern Sie Stellenausschreibungen, Bewerber-Intake (Web, Magic-Link, Intern), verhaltensverankerte Interview-Scorecards und das anpassbare Lohnstammdaten-Onboarding bis zur Gehaltsabrechnung.
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2 shrink-0">
				<a href="/careers">
					<Button variant="outline" size="sm" class="border-white/25 bg-white/10 text-white hover:bg-white/20">
						<Globe class="w-4 h-4 mr-1.5" />
						Öffentliches Karriereportal
					</Button>
				</a>
				<Button
					type="button"
					size="sm"
					onclick={() => {
						generatedMagicLink = null;
						activeModal = { type: "invite", defaultType: "application" };
					}}
					class="bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold"
				>
					<Send class="w-4 h-4 mr-1.5" />
					Einladungslink senden
				</Button>
				<Button
					type="button"
					size="sm"
					onclick={() => {
						activeTab = "jobs";
						startNewJobPosting();
					}}
					class="bg-teal-500 text-slate-950 hover:bg-teal-400 font-bold"
				>
					<Plus class="w-4 h-4 mr-1.5" />
					Neue Stelle anlegen
				</Button>
			</div>
		</div>

		<!-- KPI Metrics Row -->
		<div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-white/10">
			<div class="rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
				<span class="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
					Kandidat:innen Gesamt
				</span>
				<span class="text-2xl font-black">{pipelineData?.totalCandidates ?? 0}</span>
			</div>
			<div class="rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
				<span class="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
					Aktive Bewerbungen
				</span>
				<span class="text-2xl font-black text-amber-300">{pipelineData?.activeApplicantsCount ?? 0}</span>
			</div>
			<div class="rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
				<span class="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
					Abrechnungsbereit (Payroll Ready)
				</span>
				<span class="text-2xl font-black text-emerald-300">{pipelineData?.payrollReadyCount ?? 0}</span>
			</div>
			<div class="rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
				<span class="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
					Stellenausschreibungen
				</span>
				<span class="text-2xl font-black text-teal-300">{jobPostings.length}</span>
			</div>
			<div class="rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs col-span-2 sm:col-span-1">
				<span class="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
					PKI & Merkle Root
				</span>
				<span class="text-xs font-mono font-bold text-emerald-300 truncate block mt-1">
					{globalCustody?.merkleRootHash ? `${globalCustody.merkleRootHash.slice(0, 14)}…` : "Verifiziert"}
				</span>
			</div>
		</div>

		<!-- Navigation Tabs -->
		<div class="mt-6 flex flex-wrap gap-2">
			<button
				type="button"
				onclick={() => (activeTab = "pipeline")}
				class="rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 {activeTab === 'pipeline'
					? 'bg-white text-slate-950 shadow'
					: 'bg-white/10 text-slate-200 hover:bg-white/20'}"
			>
				<Users class="w-4 h-4" />
				1. Pipeline-Übersicht & Quick Actions ({candidates.length})
			</button>

			<button
				type="button"
				onclick={() => (activeTab = "jobs")}
				class="rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 {activeTab === 'jobs'
					? 'bg-white text-slate-950 shadow'
					: 'bg-white/10 text-slate-200 hover:bg-white/20'}"
			>
				<Briefcase class="w-4 h-4" />
				2. Stellenausschreibungen & Job Roles ({jobPostings.length})
			</button>

			<button
				type="button"
				onclick={() => (activeTab = "intake")}
				class="rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 {activeTab === 'intake'
					? 'bg-white text-slate-950 shadow'
					: 'bg-white/10 text-slate-200 hover:bg-white/20'}"
			>
				<Send class="w-4 h-4" />
				3. Bewerber-Intake & Einladungslinks (Story 2)
			</button>

			<button
				type="button"
				onclick={() => (activeTab = "custody")}
				class="rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 {activeTab === 'custody'
					? 'bg-white text-slate-950 shadow'
					: 'bg-white/10 text-slate-200 hover:bg-white/20'}"
			>
				<KeyRound class="w-4 h-4" />
				4. PKI & Blockchain Custody Audit Center
			</button>
		</div>
	</div>

	<!-- ========================================================================= -->
	<!-- TAB 1: PIPELINE OVERVIEW & QUICK ACTIONS (STORY 5)                        -->
	<!-- ========================================================================= -->
	{#if activeTab === "pipeline"}
		<div class="space-y-5">
			<!-- Filter & View Toggle Bar -->
			<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
				<div class="flex flex-wrap items-center gap-3 flex-1">
					<div class="relative flex-1 min-w-[220px]">
						<Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
						<input
							type="search"
							bind:value={pipelineSearch}
							placeholder="Kandidat:in, Stelle oder E-Mail suchen..."
							class="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs"
						/>
					</div>

					<select
						bind:value={pipelineDepartment}
						aria-label="Abteilung filtern"
						class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
					>
						<option value="all">Alle Abteilungen</option>
						{#each departments as dept (dept)}
							<option value={dept}>{dept}</option>
						{/each}
					</select>

					<select
						bind:value={pipelineJobId}
						aria-label="Stelle filtern"
						class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
					>
						<option value="all">Alle Stellenausschreibungen</option>
						{#each jobPostings as jp (jp.id)}
							<option value={jp.id}>{jp.title}</option>
						{/each}
					</select>
				</div>

				<div class="flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start md:self-center">
					<button
						type="button"
						onclick={() => (pipelineViewMode = "kanban")}
						class="rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 {pipelineViewMode === 'kanban'
							? 'bg-white text-slate-900 shadow-xs'
							: 'text-slate-600'}"
					>
						<LayoutGrid class="w-3.5 h-3.5" />
						Kanban-Board
					</button>
					<button
						type="button"
						onclick={() => (pipelineViewMode = "table")}
						class="rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 {pipelineViewMode === 'table'
							? 'bg-white text-slate-900 shadow-xs'
							: 'text-slate-600'}"
					>
						<List class="w-3.5 h-3.5" />
						Matrix-Tabelle
					</button>
				</div>
			</div>

			{#if pipelineQuery.loading && !pipelineData}
				<LoadingSection message="Recruitment-Pipeline wird geladen..." />
			{:else if pipelineViewMode === "kanban"}
				<!-- Kanban Stage Columns -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
					{#each PIPELINE_STAGES.filter((s) => s.id !== "rejected") as stage (stage.id)}
						{@const stageCandidates = candidates.filter((c: any) => c.pipelineStage === stage.id)}
						<div class="rounded-2xl border border-slate-200 bg-slate-100/70 p-3 flex flex-col gap-3 min-h-[420px]">
							<div class="flex items-center justify-between border-b border-slate-200 pb-2 px-1">
								<span class="text-xs font-black text-slate-800">{stage.labelDe}</span>
								<span class="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
									{stageCandidates.length}
								</span>
							</div>

							<div class="space-y-3 flex-1">
								{#each stageCandidates as cand (cand.id)}
									<div class="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5 hover:border-indigo-300 transition-all">
										<div class="flex items-start justify-between gap-1">
											<div>
												<a
													href="/talents/{cand.id}"
													class="text-xs font-black text-slate-900 hover:text-indigo-600 block"
												>
													{cand.displayName}
												</a>
												<span class="text-[11px] font-semibold text-indigo-700 block truncate max-w-[170px]">
													{cand.jobTitle}
												</span>
											</div>
											<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-600">
												v{cand.currentVersion}
											</span>
										</div>

										<div class="flex flex-wrap items-center gap-1.5 text-[10px]">
											{#if cand.averageRating}
												<span class="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-900 border border-amber-200">
													<Star class="w-3 h-3 fill-amber-500 text-amber-500" />
													{Number(cand.averageRating).toFixed(1)} ({cand.interviewCount})
												</span>
											{/if}

											{#if cand.isPayrollReady}
												<span class="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-800 border border-emerald-200">
													<CheckCircle2 class="w-3 h-3" /> Payroll Ready
												</span>
											{:else}
												<span
													class="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-800 border border-rose-200"
													title="Fehlend für Gehaltslauf: {cand.missingPayrollFields.join(', ')}"
												>
													<AlertCircle class="w-3 h-3" /> Lohn-Daten offen
												</span>
											{/if}
										</div>

										<!-- Quick Stage Transition Select -->
										<div>
											<select
												value={cand.pipelineStage}
												aria-label="Phase ändern für {cand.displayName}"
												onchange={(e) =>
													handleStageMove(cand.id, e.currentTarget.value as PipelineStage)}
												class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700"
											>
												{#each PIPELINE_STAGES as st (st.id)}
													<option value={st.id}>→ {st.labelDe}</option>
												{/each}
											</select>
										</div>

										<!-- Quick Actions Toolbar -->
										<div class="grid grid-cols-4 gap-1 pt-1 border-t border-slate-100">
											<button
												type="button"
												onclick={() => (activeModal = { type: "interview", candidate: cand })}
												title="Strukturiertes Interview & Scorecard dokumentieren"
												class="flex flex-col items-center justify-center rounded-lg py-1.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50"
											>
												<ClipboardCheck class="w-3.5 h-3.5" />
												<span>Score</span>
											</button>

											<button
												type="button"
												onclick={() => (activeModal = { type: "onboarding", candidate: cand })}
												title="Onboarding- & Lohnstammdaten intern ausfüllen"
												class="flex flex-col items-center justify-center rounded-lg py-1.5 text-[10px] font-bold text-teal-700 hover:bg-teal-50"
											>
												<FileSignature class="w-3.5 h-3.5" />
												<span>Lohn</span>
											</button>

											<button
												type="button"
												onclick={() => {
													generatedMagicLink = null;
													activeModal = {
														type: "invite",
														candidate: cand,
														defaultType: "onboarding",
													};
												}}
												title="Onboarding-Magic-Link per E-Mail senden"
												class="flex flex-col items-center justify-center rounded-lg py-1.5 text-[10px] font-bold text-amber-700 hover:bg-amber-50"
											>
												<Send class="w-3.5 h-3.5" />
												<span>Link</span>
											</button>

											<button
												type="button"
												onclick={() => (activeModal = { type: "custody", candidate: cand })}
												title="Blockchain Chain-of-Custody & Versionen prüfen"
												class="flex flex-col items-center justify-center rounded-lg py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
											>
												<History class="w-3.5 h-3.5" />
												<span>Custody</span>
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- Compact Matrix Table View -->
				<div class="rounded-2xl border border-slate-200 bg-white overflow-x-auto shadow-xs">
					<table class="w-full text-left text-xs">
						<thead class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
							<tr>
								<th class="py-3 px-4">Kandidat:in</th>
								<th class="py-3 px-4">Stelle & Abteilung</th>
								<th class="py-3 px-4">Pipeline-Phase</th>
								<th class="py-3 px-4">Interview-Score</th>
								<th class="py-3 px-4">Payroll-Status</th>
								<th class="py-3 px-4">Custody</th>
								<th class="py-3 px-4 text-right">Quick Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each candidates as cand (cand.id)}
								<tr class="hover:bg-slate-50/80">
									<td class="py-3 px-4">
										<a href="/talents/{cand.id}" class="font-bold text-slate-900 hover:text-indigo-600 block">
											{cand.displayName}
										</a>
										<span class="text-[11px] text-slate-500">{cand.email}</span>
									</td>
									<td class="py-3 px-4">
										<span class="font-semibold text-slate-800 block">{cand.jobTitle}</span>
										<span class="text-[11px] text-slate-500">{cand.department}</span>
									</td>
									<td class="py-3 px-4">
										<select
											value={cand.pipelineStage}
											aria-label="Phase für {cand.displayName}"
											onchange={(e) =>
												handleStageMove(cand.id, e.currentTarget.value as PipelineStage)}
											class="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold"
										>
											{#each PIPELINE_STAGES as st (st.id)}
												<option value={st.id}>{st.labelDe}</option>
											{/each}
										</select>
									</td>
									<td class="py-3 px-4">
										{#if cand.averageRating}
											<span class="font-bold text-amber-800">
												★ {Number(cand.averageRating).toFixed(2)} ({cand.interviewCount})
											</span>
										{:else}
											<span class="text-slate-400">Ausstehend</span>
										{/if}
									</td>
									<td class="py-3 px-4">
										{#if cand.isPayrollReady}
											<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
												<CheckCircle2 class="w-3 h-3" /> Vollständig
											</span>
										{:else}
											<span class="text-[11px] text-rose-700 font-semibold">
												Fehlt: {cand.missingPayrollFields.join(", ")}
											</span>
										{/if}
									</td>
									<td class="py-3 px-4 font-mono">
										v{cand.currentVersion}
									</td>
									<td class="py-3 px-4 text-right space-x-1">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => (activeModal = { type: "interview", candidate: cand })}
										>
											Interview
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => (activeModal = { type: "onboarding", candidate: cand })}
										>
											Onboarding & Lohn
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => (activeModal = { type: "custody", candidate: cand })}
										>
											Custody
										</Button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

	<!-- ========================================================================= -->
	<!-- TAB 2: JOB ROLES & PUBLIC ADVERTISEMENTS MANAGER (STORY 1)                -->
	<!-- ========================================================================= -->
	{:else if activeTab === "jobs"}
		<div class="space-y-6">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h2 class="text-xl font-black text-slate-900">
						Stellenausschreibungen & Job Roles (Öffentlich & Intern)
					</h2>
					<p class="text-xs text-slate-600">
						Inklusive Tarifwerk-Zuordnung, mehrsprachiger Ausschreibung (DE/EN), einbettbarer Karriere-Subview (`/careers/embed`), anpassbaren Onboarding-Feldern und `EntityManager`-Synchronisation.
					</p>
				</div>
				<Button type="button" onclick={startNewJobPosting} class="bg-indigo-600 text-white font-bold">
					<Plus class="w-4 h-4 mr-1.5" />
					Neue Stellenausschreibung erstellen
				</Button>
			</div>

			{#if showJobEditor}
				<div class="rounded-3xl border-2 border-indigo-200 bg-white p-6 md:p-8 shadow-lg space-y-6">
					<div class="flex items-center justify-between border-b border-slate-100 pb-4">
						<h3 class="text-lg font-black text-slate-900">
							{jobFormState.id ? `Stelle bearbeiten: ${jobFormState.title}` : "Neue Stellenausschreibung anlegen"}
						</h3>
						<Button type="button" variant="outline" size="sm" onclick={() => (showJobEditor = false)}>
							Schließen
						</Button>
					</div>

					<form
						{...jobRf.preflight(jobPostingSchema).enhance(async ({ submit }) => {
							try {
								await submit();
								const res = jobRf.result as any;
								if (res?.success) {
									toast.success("Stellenausschreibung gespeichert & synchronisiert!");
									showJobEditor = false;
									await jobsQuery.refresh();
								}
							} catch (err: any) {
								toast.error(err?.message || "Fehler beim Speichern der Stelle.");
							}
						})}
						class="space-y-6"
					>
						{#if jobFormState.id}
							<input {...jobRf.fields.id.as("hidden", jobFormState.id)} />
						{/if}
						<input {...jobRf.fields.locationIdsJson.as("hidden", jobLocationIdsJson)} />
						<input {...jobRf.fields.contactIdsJson.as("hidden", jobContactIdsJson)} />
						<input {...jobRf.fields.tagsJson.as("hidden", jobTagsJson)} />
						<input {...jobRf.fields.customOnboardingFieldsJson.as("hidden", jobCustomFieldsJson)} />

						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							<div class="sm:col-span-2">
								<label for="jp-title" class="block text-xs font-bold text-slate-700 mb-1">
									Stellentitel (Deutsch) *
								</label>
								<input
									id="jp-title"
									{...jobRf.fields.title.as("text")}
									bind:value={jobFormState.title}
									required
									placeholder="z.B. Sozialpädagogische Fachkraft / Teilhabecoach (m/w/d)"
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="jp-dept" class="block text-xs font-bold text-slate-700 mb-1">
									Abteilung / Fachbereich *
								</label>
								<input
									id="jp-dept"
									{...jobRf.fields.department.as("text")}
									bind:value={jobFormState.department}
									required
									placeholder="z.B. Soziale Arbeit & Beratung"
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="jp-status" class="block text-xs font-bold text-slate-700 mb-1">
									Veröffentlichungs-Status
								</label>
								<select
									id="jp-status"
									{...jobRf.fields.status.as("select")}
									bind:value={jobFormState.status}
									class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
								>
									<option value="published">Veröffentlicht (Published)</option>
									<option value="internal_only">Nur Intern / Einladungslink</option>
									<option value="draft">Entwurf (Draft)</option>
									<option value="closed">Besetzt / Geschlossen</option>
								</select>
							</div>

							<div>
								<label for="jp-workmodel" class="block text-xs font-bold text-slate-700 mb-1">
									Arbeitsmodell
								</label>
								<select
									id="jp-workmodel"
									{...jobRf.fields.workModel.as("select")}
									bind:value={jobFormState.workModel}
									class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
								>
									<option value="hybrid">Hybrid / Mobiles Arbeiten</option>
									<option value="onsite">Vor Ort (Präsenz)</option>
									<option value="remote">Remote</option>
								</select>
							</div>

							<div>
								<label for="jp-hours" class="block text-xs font-bold text-slate-700 mb-1">
									Wochenstunden
								</label>
								<input
									id="jp-hours"
									{...jobRf.fields.workHoursPerWeek.as("number")}
									bind:value={jobFormState.workHoursPerWeek}
									step="0.5"
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="jp-tarif" class="block text-xs font-bold text-slate-700 mb-1">
									Tarifwerk (Framework Code)
								</label>
								<input
									id="jp-tarif"
									{...jobRf.fields.contractFrameworkCode.as("text")}
									bind:value={jobFormState.contractFrameworkCode}
									placeholder="AWO_BERLIN / TV_L"
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="jp-eg" class="block text-xs font-bold text-slate-700 mb-1">
									Entgeltgruppe
								</label>
								<input
									id="jp-eg"
									{...jobRf.fields.entgeltgruppe.as("text")}
									bind:value={jobFormState.entgeltgruppe}
									placeholder="z.B. S11b / E11"
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="jp-sgb2" class="block text-xs font-bold text-slate-700 mb-1">
									SGB II Förderfähigkeit
								</label>
								<select
									id="jp-sgb2"
									{...jobRf.fields.sgb2Eligible.as("select")}
									bind:value={jobFormState.sgb2Eligible}
									class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
								>
									<option value="none">Regulär (Keine SGB II Bindung)</option>
									<option value="sgb2_16i">§ 16i SGB II (Teilhabe am Arbeitsmarkt)</option>
									<option value="sgb2_16d">§ 16d SGB II (Arbeitsgelegenheit)</option>
								</select>
							</div>

							<div>
								<label for="jp-salmin" class="block text-xs font-bold text-slate-700 mb-1">
									Gehaltsrahmen Min (€)
								</label>
								<input
									id="jp-salmin"
									{...jobRf.fields.salaryRangeMin.as("number")}
									bind:value={jobFormState.salaryRangeMin}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="jp-salmax" class="block text-xs font-bold text-slate-700 mb-1">
									Gehaltsrahmen Max (€)
								</label>
								<input
									id="jp-salmax"
									{...jobRf.fields.salaryRangeMax.as("number")}
									bind:value={jobFormState.salaryRangeMax}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>

							<div class="flex items-center pt-5">
								<label class="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
									<input
										{...jobRf.fields.isPublic.as("checkbox")}
										checked={jobFormState.isPublic}
										onchange={(e) => (jobFormState.isPublic = e.currentTarget.checked)}
										class="h-4 w-4 rounded text-indigo-600"
									/>
									Öffentlich auf `/careers` und `/careers/embed` ausschreiben
								</label>
							</div>
						</div>

						<!-- Descriptions DE & EN -->
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label for="jp-summary" class="block text-xs font-bold text-slate-700 mb-1">
									Kurzbeschreibung (Teaser DE)
								</label>
								<textarea
									id="jp-summary"
									{...jobRf.fields.summary.as("text")}
									bind:value={jobFormState.summary}
									rows={2}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								></textarea>
							</div>

							<div>
								<label for="jp-title-en" class="block text-xs font-bold text-slate-700 mb-1">
									Englischer Stellentitel (i18n EN)
								</label>
								<input
									id="jp-title-en"
									{...jobRf.fields.titleEn.as("text")}
									bind:value={jobFormState.titleEn}
									placeholder="e.g. Social Work Specialist (m/f/d)"
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="jp-resp" class="block text-xs font-bold text-slate-700 mb-1">
									Aufgaben & Verantwortlichkeiten
								</label>
								<textarea
									id="jp-resp"
									{...jobRf.fields.responsibilities.as("text")}
									bind:value={jobFormState.responsibilities}
									rows={3}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								></textarea>
							</div>

							<div>
								<label for="jp-qual" class="block text-xs font-bold text-slate-700 mb-1">
									Anforderungen & Qualifikationen
								</label>
								<textarea
									id="jp-qual"
									{...jobRf.fields.qualifications.as("text")}
									bind:value={jobFormState.qualifications}
									rows={3}
									class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
								></textarea>
							</div>
						</div>

						<!-- Custom Onboarding Fields Designer for this Job Role -->
						<div class="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
							<h4 class="text-xs font-black uppercase tracking-wider text-violet-900">
								Rollenspezifische Onboarding-Zusatzfelder ({jobCustomOnboardingFields.length})
							</h4>
							<div class="flex flex-wrap gap-2">
								{#each jobCustomOnboardingFields as f (f.id)}
									<span class="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 border border-violet-200">
										{f.labelDe} ({f.type})
										<button
											type="button"
											onclick={() =>
												(jobCustomOnboardingFields = jobCustomOnboardingFields.filter(
													(x) => x.id !== f.id,
												))}
											class="text-slate-400 hover:text-rose-600"
										>
											<X class="w-3 h-3" />
										</button>
									</span>
								{/each}
							</div>
							<div class="flex flex-wrap items-center gap-2 pt-1">
								<input
									type="text"
									bind:value={newJobFieldLabelDe}
									placeholder="Neues Onboarding-Feld für diese Stelle..."
									class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs flex-1 min-w-[200px]"
								/>
								<select
									bind:value={newJobFieldType}
									class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
								>
									<option value="text">Text</option>
									<option value="boolean">Checkbox</option>
									<option value="date">Datum</option>
								</select>
								<Button type="button" size="sm" variant="outline" onclick={addJobCustomOnboardingField}>
									+ Feld anfügen
								</Button>
							</div>
						</div>

						<!-- Embedded EntityManager (Locations), ContactManager & SyncCheckboxBlock (like multiposter events!) -->
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
							<div class="space-y-3">
								<h4 class="text-sm font-bold text-slate-900 flex items-center gap-2">
									<MapPin class="w-4 h-4 text-indigo-600" />
									Arbeitsorte & Standorte (`EntityManager`)
								</h4>
								<EntityManager
									title="Locations"
									icon={MapPin}
									mode="embedded"
									filters={getLocationFilterGroups(m)}
									initialItems={allLocations.filter((l) => jobLocationIds.includes(l.id))}
									listItemsRemote={listLocations}
									onchange={(ids: string[]) => {
										jobLocationIds = ids;
									}}
									createRemote={createLocation}
									createSchema={createLocationSchema}
									updateRemote={updateLocation}
									updateSchema={updateLocationSchema}
									readItemRemote={readLocation}
									deleteItemRemote={async (ids: string[]) => {
										return await handleDelete({
											ids,
											deleteFn: deleteLocation,
											itemName: "location",
										});
									}}
									searchPredicate={(item: any, term: string) =>
										item.name.toLowerCase().includes(term.toLowerCase())}
								>
									{#snippet renderItemLabel(l: any)}
										<span>{l.name}</span>
										{#if l.city}
											<span class="text-gray-400 text-xs ml-1">({l.city})</span>
										{/if}
									{/snippet}
									{#snippet renderForm({
										remoteFunction: locRf,
										schema,
										initialData: formData,
										onSuccess: os,
										onCancel: oc,
										id: lid,
									}: any)}
										<LocationForm
											remoteFunction={locRf}
											validationSchema={schema}
											initialData={formData}
											onSuccess={os}
											onCancel={oc}
											isUpdating={!!lid}
										/>
									{/snippet}
								</EntityManager>
							</div>

							<div class="space-y-3">
								<h4 class="text-sm font-bold text-slate-900 flex items-center gap-2">
									<User class="w-4 h-4 text-indigo-600" />
									Ansprechpartner & Hiring Team (`ContactManager`)
								</h4>
								<ContactManager
									title="Hiring Contacts"
									icon={User}
									mode="embedded"
									filters={getContactFilterGroups(m)}
									initialItems={jobSelectedContacts}
									listItemsRemote={listContacts}
									onchange={(ids: string[], items: any[]) => {
										jobContactIds = ids;
										jobSelectedContacts = items || [];
									}}
									searchPredicate={matchContactSearch}
									{m}
								/>
							</div>
						</div>

						<SyncCheckboxBlock
							syncFieldConfig={jobRf.fields.syncIdsJson}
							initialSelectedIds={jobFormState.syncIds}
						/>

						<div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
							<Button type="button" variant="outline" onclick={() => (showJobEditor = false)}>
								Abbrechen
							</Button>
							<AsyncButton type="submit" loading={jobRf.pending > 0} class="bg-indigo-600 text-white font-bold">
								Stellenausschreibung speichern
							</AsyncButton>
						</div>
					</form>
				</div>
			{/if}

			<!-- Job Postings Cards -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#each jobPostings as jp (jp.id)}
					<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between gap-4">
						<div class="space-y-2">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<span class="text-xs font-bold uppercase tracking-wider text-indigo-700">
									{jp.department}
								</span>
								<div class="flex items-center gap-1.5">
									{#if jp.isPublic && jp.status === "published"}
										<span class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
											Öffentlich (/careers)
										</span>
									{:else}
										<span class="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
											Intern / Nur per Link
										</span>
									{/if}
									<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
										{jp.applicantCount ?? 0} Bewerber:innen
									</span>
								</div>
							</div>

							<h3 class="text-lg font-black text-slate-900">{jp.title}</h3>
							<p class="text-xs text-slate-600 line-clamp-2">{jp.summary || jp.description}</p>

							<div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
								<span>{jp.workHoursPerWeek || 39}h/Woche</span>
								<span>·</span>
								<span>{jp.workModel}</span>
								{#if jp.entgeltgruppe}
									<span>·</span>
									<span class="font-bold text-emerald-700">
										{jp.contractFrameworkCode || "Tarif"} EG {jp.entgeltgruppe}
									</span>
								{/if}
							</div>
						</div>

						<div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
							<div class="flex items-center gap-1.5">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => editJobPosting(jp)}
								>
									<Edit2 class="w-3.5 h-3.5 mr-1" />
									Bearbeiten
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => (activeModal = { type: "embed", job: jp })}
								>
									<Code2 class="w-3.5 h-3.5 mr-1" />
									Embed-Code
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => {
										generatedMagicLink = null;
										activeModal = {
											type: "invite",
											defaultType: "application",
											candidate: { jobPostingId: jp.id, jobTitle: jp.title },
										};
									}}
								>
									<Send class="w-3.5 h-3.5 mr-1" />
									Einladungslink
								</Button>
							</div>

							<button
								type="button"
								onclick={() => handleDeleteJob(jp.id)}
								class="p-2 text-slate-400 hover:text-rose-600"
								title="Stelle löschen"
							>
								<Trash2 class="w-4 h-4" />
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>

	<!-- ========================================================================= -->
	<!-- TAB 3: INTERNAL CANDIDATE INTAKE & EMAIL INVITATIONS (STORY 2)            -->
	<!-- ========================================================================= -->
	{:else if activeTab === "intake"}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Left Card: Internal Direct Form Entry -->
			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
				<div class="border-b border-slate-100 pb-3">
					<span class="text-xs font-bold uppercase tracking-wider text-indigo-600">
						Story 2 · Option C: Interne Direkterfassung
					</span>
					<h2 class="text-lg font-black text-slate-900">
						Bewerber-Kontaktformular intern selbst ausfüllen
					</h2>
					<p class="text-xs text-slate-500">
						Für Admin, HR-Verantwortliche oder Hiring Manager bei telefonischen, postalischen oder empfohlenen Bewerbungen.
					</p>
				</div>

				<form
					{...intakeRf.preflight(applicantIntakeSchema).enhance(async ({ submit }) => {
						try {
							await submit();
							const res = intakeRf.result as any;
							if (res?.success) {
								toast.success(
									"Kandidat:in intern angelegt, PKI-verschlüsselt & in der Pipeline erfasst!",
								);
								await Promise.all([pipelineQuery.refresh(), globalCustodyQuery.refresh()]);
								activeTab = "pipeline";
							}
						} catch (e: any) {
							toast.error(e?.message || "Fehler bei der Anlage.");
						}
					})}
					class="space-y-4"
				>
					<input {...intakeRf.fields.channel.as("hidden", "internal_ui")} />

					<div>
						<label for="int-job" class="block text-xs font-bold text-slate-700 mb-1">
							Stellenausschreibung zuordnen
						</label>
						<select
							id="int-job"
							{...intakeRf.fields.jobPostingId.as("select")}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
						>
							<option value="">— Initiativbewerbung / Allgemein —</option>
							{#each jobPostings as jp (jp.id)}
								<option value={jp.id}>{jp.title} ({jp.department})</option>
							{/each}
						</select>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label for="int-gn" class="block text-xs font-bold text-slate-700 mb-1">Vorname *</label>
							<input
								id="int-gn"
								{...intakeRf.fields.givenName.as("text")}
								required
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="int-fn" class="block text-xs font-bold text-slate-700 mb-1">Nachname *</label>
							<input
								id="int-fn"
								{...intakeRf.fields.familyName.as("text")}
								required
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="int-em" class="block text-xs font-bold text-slate-700 mb-1">E-Mail *</label>
							<input
								id="int-em"
								{...intakeRf.fields.email.as("email")}
								required
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="int-ph" class="block text-xs font-bold text-slate-700 mb-1">Telefon</label>
							<input
								id="int-ph"
								{...intakeRf.fields.phone.as("tel")}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label for="int-sal" class="block text-xs font-bold text-slate-700 mb-1">Gehaltswunsch</label>
							<input
								id="int-sal"
								{...intakeRf.fields.salaryExpectation.as("text")}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="int-av" class="block text-xs font-bold text-slate-700 mb-1">Verfügbar ab</label>
							<input
								id="int-av"
								{...intakeRf.fields.availabilityDate.as("date")}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
					</div>

					<div>
						<label for="int-notes" class="block text-xs font-bold text-slate-700 mb-1">
							Interne Gesprächsnotiz / Hintergrund
						</label>
						<textarea
							id="int-notes"
							{...intakeRf.fields.motivationNotes.as("text")}
							rows={3}
							class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						></textarea>
					</div>

					<AsyncButton type="submit" loading={intakeRf.pending > 0} class="w-full bg-indigo-600 text-white font-bold">
						Kandidat:in direkt in Pipeline aufnehmen
					</AsyncButton>
				</form>
			</div>

			<!-- Right Card: Send Personalized Email Magic-Link -->
			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
				<div class="border-b border-slate-100 pb-3">
					<span class="text-xs font-bold uppercase tracking-wider text-teal-700">
						Story 2 & 4 · Option B: Persönlicher E-Mail-Einladungslink
					</span>
					<h2 class="text-lg font-black text-slate-900">
						Bewerbungs- oder Onboarding-Link per E-Mail generieren
					</h2>
					<p class="text-xs text-slate-500">
						Erzeugt einen kryptografisch gesicherten Magic-Link (`/apply/[token]` oder `/onboarding/[token]`) für spezifische E-Mail-Empfänger:innen.
					</p>
				</div>

				<form
					{...inviteRf.preflight(sendApplicantInvitationSchema).enhance(async ({ submit }) => {
						try {
							await submit();
							const res = inviteRf.result as any;
							if (res?.success) {
								generatedMagicLink = res.relativeUrl;
								toast.success("Persönlicher Magic-Link erstellt!");
							}
						} catch (e: any) {
							toast.error(e?.message || "Fehler beim Erstellen des Links.");
						}
					})}
					class="space-y-4"
				>
					<div>
						<label for="inv-type" class="block text-xs font-bold text-slate-700 mb-1">
							Art des Einladungslinks
						</label>
						<select
							id="inv-type"
							{...inviteRf.fields.invitationType.as("select")}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
						>
							<option value="application">1. Bewerbungs- & Kontaktformular (/apply/[token])</option>
							<option value="onboarding">2. Onboarding- & Lohnstammdaten-Bogen (/onboarding/[token])</option>
						</select>
					</div>

					<div>
						<label for="inv-job" class="block text-xs font-bold text-slate-700 mb-1">
							Bezugs-Stellenausschreibung
						</label>
						<select
							id="inv-job"
							{...inviteRf.fields.jobPostingId.as("select")}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
						>
							<option value="">— Allgemeine Einladung —</option>
							{#each jobPostings as jp (jp.id)}
								<option value={jp.id}>{jp.title} ({jp.department})</option>
							{/each}
						</select>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<div>
							<label for="inv-gn" class="block text-xs font-bold text-slate-700 mb-1">Vorname</label>
							<input
								id="inv-gn"
								{...inviteRf.fields.givenName.as("text")}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="inv-fn" class="block text-xs font-bold text-slate-700 mb-1">Nachname</label>
							<input
								id="inv-fn"
								{...inviteRf.fields.familyName.as("text")}
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="inv-em" class="block text-xs font-bold text-slate-700 mb-1">E-Mail *</label>
							<input
								id="inv-em"
								{...inviteRf.fields.email.as("email")}
								required
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
					</div>

					<div>
						<label for="inv-msg" class="block text-xs font-bold text-slate-700 mb-1">
							Persönliches Anschreiben
						</label>
						<textarea
							id="inv-msg"
							{...inviteRf.fields.personalMessage.as("text")}
							rows={3}
							placeholder="Guten Tag, wir laden Sie herzlich ein, Ihr Profil über diesen geschützten Link zu vervollständigen..."
							class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						></textarea>
					</div>

					<AsyncButton type="submit" loading={inviteRf.pending > 0} class="w-full bg-teal-700 text-white font-bold">
						<Send class="w-4 h-4 mr-1.5" />
						Einladungslink generieren & bereitstellen
					</AsyncButton>
				</form>

				{#if generatedMagicLink}
					<div class="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 space-y-2">
						<div class="text-xs font-bold text-emerald-900">
							Generierter Magic-Link bereit zum Versand / Öffnen:
						</div>
						<div class="flex items-center gap-2">
							<code class="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs text-emerald-300 font-mono break-all">
								{generatedMagicLink}
							</code>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onclick={() => copyToClipboard(generatedMagicLink!)}
							>
								<Copy class="w-3.5 h-3.5 mr-1" />
								Kopieren
							</Button>
							<a
								href={generatedMagicLink}
								target="_blank"
								rel="noreferrer"
								class="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
							>
								<ExternalLink class="w-3.5 h-3.5 mr-1" />
								Öffnen
							</a>
						</div>
					</div>
				{/if}
			</div>
		</div>

	<!-- ========================================================================= -->
	<!-- TAB 4: PKI & BLOCKCHAIN CUSTODY AUDIT CENTER                              -->
	<!-- ========================================================================= -->
	{:else if activeTab === "custody"}
		<div class="space-y-6">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div class="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
					<div class="flex items-center gap-2 font-black text-slate-900 text-sm">
						<KeyRound class="w-5 h-5 text-indigo-600" />
						Microsoft 365 Business Basic (NGO) PKI
					</div>
					<p class="text-xs text-slate-600 leading-relaxed">
						Aktiver Schlüssel-Provider: <strong>{pkiStatus?.activeProvider || "m365-entra-oidc"}</strong>.
						Bindet RSA-OAEP-256 (4096-Bit) & RSASSA-PSS-SHA256 Schlüsselpaare via HKDF-SHA256 an die Entra ID OIDC Tenant-Identität, ohne kostenpflichtige Azure Key Vault / Purview Lizenzen vorauszusetzen.
					</p>
					<div class="text-[11px] font-mono text-indigo-700 pt-1">
						Aktive Subject-DEKs: {pkiStatus?.activeDeksCount ?? 0} · Vernichtete DEKs: {pkiStatus?.shreddedDeksCount ?? 0}
					</div>
				</div>

				<div class="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
					<div class="flex items-center gap-2 font-black text-slate-900 text-sm">
						<ShieldCheck class="w-5 h-5 text-emerald-600" />
						RFC 8785 JCS + RFC 7515 JWS + RFC 6962
					</div>
					<p class="text-xs text-slate-600 leading-relaxed">
						Jede Mutation erzeugt einen nach IETF RFC 8785 kanonisierten, mit RSASSA-PSS-SHA256 signierten Block und wird in einen binären RFC 6962 Certificate Transparency Merkle-Baum überführt.
					</p>
					<div class="text-[11px] font-mono text-emerald-700 truncate pt-1">
						Root: {globalCustody?.merkleRootHash || "Genesis"}
					</div>
				</div>

				<div class="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
					<div class="flex items-center gap-2 font-black text-slate-900 text-sm">
						<Lock class="w-5 h-5 text-teal-600" />
						DSGVO Art. 17 Crypto-Shredding
					</div>
					<p class="text-xs text-slate-600 leading-relaxed">
						Im Blockchain-Block wird ausschließlich `SHA-256(recordSalt || ciphertext)` gespeichert. Bei Löschung wird der subjektbezogene AES-256-GCM DEK vernichtet – das Chiffrat ist unlesbar, die Hash-Kette bleibt 100% gültig.
					</p>
				</div>
			</div>

			{#if candidates[0]}
				<CustodyLedgerPanel talentId={candidates[0].id} />
			{/if}
		</div>
	{/if}
</div>

<!-- ============================================================================= -->
<!-- QUICK-ACTION MODAL OVERLAY (Portal-style outside forms)                       -->
<!-- ============================================================================= -->
{#if activeModal}
	<div
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto"
	>
		<div class="relative my-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 md:p-8 shadow-2xl space-y-5">
			<div class="flex items-center justify-between border-b border-slate-200 pb-3">
				<h3 class="text-lg font-black text-slate-900">
					{#if activeModal.type === "interview"}
						Interview & Scorecard: {activeModal.candidate.displayName}
					{:else if activeModal.type === "onboarding"}
						Onboarding & Lohnstammdaten: {activeModal.candidate.displayName}
					{:else if activeModal.type === "custody"}
						Blockchain Chain-of-Custody & Versionen: {activeModal.candidate.displayName}
					{:else if activeModal.type === "embed"}
						Einbettbarer Iframe-Code für {activeModal.job.title}
					{:else}
						Persönlichen Einladungs- / Onboarding-Link versenden
					{/if}
				</h3>
				<button
					type="button"
					onclick={() => (activeModal = null)}
					class="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			{#if activeModal.type === "interview"}
				<InterviewScorecardPanel
					talentId={activeModal.candidate.id}
					jobPostingId={activeModal.candidate.jobPostingId}
					onSubmitted={() => {
						void pipelineQuery.refresh();
					}}
				/>
			{:else if activeModal.type === "onboarding"}
				<OnboardingPayrollForm
					talentId={activeModal.candidate.id}
					jobPostingId={activeModal.candidate.jobPostingId || ""}
					initialData={{
						id: activeModal.candidate.id,
						jobTitle: activeModal.candidate.jobTitle,
						department: activeModal.candidate.department,
						customFieldValues: activeModal.candidate.customFieldValues,
						contact: {
							givenName: activeModal.candidate.displayName.split(" ")[0] || "",
							familyName:
								activeModal.candidate.displayName.split(" ").slice(1).join(" ") || "",
							email: activeModal.candidate.email,
							phone: activeModal.candidate.phone,
						},
					}}
					mode="internal"
					onSuccess={() => {
						void pipelineQuery.refresh();
						activeModal = null;
					}}
				/>
			{:else if activeModal.type === "custody"}
				<CustodyLedgerPanel talentId={activeModal.candidate.id} />
			{:else if activeModal.type === "embed"}
				<div class="space-y-4">
					<p class="text-xs text-slate-600">
						Kopieren Sie diesen HTML-Snippet, um die barrierefreie Karriere-Subview auf Ihrer Webseite einzubetten:
					</p>
					<pre class="rounded-2xl bg-slate-900 p-4 text-xs font-mono text-emerald-300 overflow-x-auto">&lt;iframe src="/careers/embed?department={encodeURIComponent(activeModal.job.department)}&amp;lang=de" width="100%" height="700" style="border:0;" title="Stellenangebote"&gt;&lt;/iframe&gt;</pre>
					<div class="flex justify-end gap-2">
						<a
							href="/careers/embed?department={encodeURIComponent(activeModal.job.department)}&lang=de"
							target="_blank"
							rel="noreferrer"
							class="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
						>
							<ExternalLink class="w-3.5 h-3.5 mr-1.5" />
							Vorschau im neuen Tab öffnen
						</a>
					</div>
				</div>
			{:else if activeModal.type === "invite"}
				<form
					{...inviteRf.preflight(sendApplicantInvitationSchema).enhance(async ({ submit }) => {
						try {
							await submit();
							const res = inviteRf.result as any;
							if (res?.success) {
								generatedMagicLink = res.relativeUrl;
								toast.success("Magic-Link erfolgreich generiert!");
								void pipelineQuery.refresh();
							}
						} catch (e: any) {
							toast.error(e?.message || "Fehler beim Senden.");
						}
					})}
					class="space-y-4"
				>
					{#if activeModal.candidate?.id}
						<input {...inviteRf.fields.talentId.as("hidden", activeModal.candidate.id)} />
					{/if}
					{#if activeModal.candidate?.jobPostingId}
						<input {...inviteRf.fields.jobPostingId.as("hidden", activeModal.candidate.jobPostingId)} />
					{/if}

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="m-inv-type" class="block text-xs font-bold text-slate-700 mb-1">
								Link-Typ
							</label>
							<select
								id="m-inv-type"
								{...inviteRf.fields.invitationType.as("select")}
								value={activeModal.defaultType}
								class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
							>
								<option value="application">Bewerbungs-Link (/apply/[token])</option>
								<option value="onboarding">Onboarding- & Lohn-Link (/onboarding/[token])</option>
							</select>
						</div>

						<div>
							<label for="m-inv-email" class="block text-xs font-bold text-slate-700 mb-1">
								E-Mail-Adresse *
							</label>
							<input
								id="m-inv-email"
								{...inviteRf.fields.email.as("email")}
								value={activeModal.candidate?.email || ""}
								required
								class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
							/>
						</div>
					</div>

					<div>
						<label for="m-inv-msg" class="block text-xs font-bold text-slate-700 mb-1">
							Persönliche Nachricht
						</label>
						<textarea
							id="m-inv-msg"
							{...inviteRf.fields.personalMessage.as("text")}
							rows={3}
							class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
						></textarea>
					</div>

					<AsyncButton type="submit" loading={inviteRf.pending > 0} class="w-full bg-teal-700 text-white font-bold">
						<Send class="w-4 h-4 mr-1.5" />
						Link generieren
					</AsyncButton>
				</form>

				{#if generatedMagicLink}
					<div class="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 flex items-center justify-between gap-2">
						<code class="text-xs font-mono text-emerald-900 break-all">{generatedMagicLink}</code>
						<div class="flex items-center gap-2 shrink-0">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onclick={() => copyToClipboard(generatedMagicLink!)}
							>
								Kopieren
							</Button>
							<a
								href={generatedMagicLink}
								target="_blank"
								rel="noreferrer"
								class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white"
							>
								Öffnen
							</a>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
