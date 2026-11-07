<script lang="ts">
	import { submitOnboardingAndPayroll } from "../../../routes/recruitment/recruitment.remote";
	import {
		onboardingPayrollSubmissionSchema,
		DEFAULT_CUSTOM_ONBOARDING_FIELDS,
	} from "@ac/validations";
	import { Button, AsyncButton } from "@ac/ui";
	import { toast } from "svelte-sonner";
	import {
		UserCheck,
		Scale,
		HeartPulse,
		Landmark,
		Sliders,
		FileSignature,
		ShieldCheck,
		Plus,
		Trash2,
		CheckCircle2,
	} from "@lucide/svelte";

	let {
		talentId = "",
		invitationToken = "",
		jobPostingId = "",
		initialData = {},
		customFieldDefinitions = [],
		mode = "internal",
		onSuccess,
	}: {
		talentId?: string;
		invitationToken?: string;
		jobPostingId?: string;
		initialData?: any;
		customFieldDefinitions?: any[];
		mode?: "internal" | "magic_link" | "self_service";
		onSuccess?: (res: any) => void;
	} = $props();

	const rf = submitOnboardingAndPayroll;

	const d = (val: any, fallback: any) =>
		val !== undefined && val !== null && val !== "" ? val : fallback;

	const initialContact = $derived(initialData?.contact || {});
	const initialAddress = $derived(
		initialContact?.address || initialContact?.addresses?.[0] || {},
	);
	const initialPayroll = $derived(initialData?.payrollProfile || {});

	// svelte-ignore state_referenced_locally
	let formState = $state({
		givenName: d(initialContact?.givenName, ""),
		familyName: d(initialContact?.familyName, ""),
		birthday: d(
			initialContact?.birthday ? String(initialContact.birthday).slice(0, 10) : "",
			"1990-01-01",
		),
		gender: d(initialContact?.gender, ""),
		phone: d(
			initialContact?.phone || initialContact?.phones?.[0]?.value,
			"",
		),
		street: d(initialAddress?.street, ""),
		houseNumber: d(initialAddress?.houseNumber, ""),
		zip: d(initialAddress?.zip, ""),
		city: d(initialAddress?.city, "Berlin"),
		country: d(initialAddress?.country, "DE"),
		taxId: d(initialPayroll?.taxId, ""),
		taxClass: d(initialPayroll?.taxClass, "1"),
		childCount: d(initialPayroll?.childCount, 0),
		hasChildren: Boolean(initialPayroll?.hasChildren),
		churchTax: d(initialPayroll?.churchTax, "none"),
		state: d(initialPayroll?.state, "BE"),
		socialSecurityNumber: d(initialPayroll?.socialSecurityNumber, ""),
		healthInsuranceName: d(
			initialPayroll?.healthInsuranceName,
			"Techniker Krankenkasse (TK)",
		),
		healthInsuranceType: d(initialPayroll?.healthInsuranceType, "statutory"),
		healthInsuranceAdditionalContributionPercent: d(
			initialPayroll?.healthInsuranceAdditionalContributionPercent,
			2.5,
		),
		pensionInsuranceExempt: Boolean(initialPayroll?.pensionInsuranceExempt),
		unemploymentInsuranceExempt: Boolean(initialPayroll?.unemploymentInsuranceExempt),
		employmentType: d(initialPayroll?.employmentType, "regular"),
		fundingProgram: d(initialPayroll?.fundingProgram, "none"),
		fundingSubsidyPercentage: d(initialPayroll?.fundingSubsidyPercentage, 100),
		jobcenterName: d(initialPayroll?.jobcenterName, ""),
		jobcenterReference: d(initialPayroll?.jobcenterReference, ""),
		deuevPersonengruppe: d(initialPayroll?.deuevPersonengruppe, "101"),
		deuevBeitragsgruppe: d(initialPayroll?.deuevBeitragsgruppe, "1111"),
		iban: d(initialPayroll?.iban, ""),
		bic: d(initialPayroll?.bic, ""),
		bankName: d(initialPayroll?.bankName, ""),
		autoCreateContract: mode === "internal",
		contractStartDate: new Date().toISOString().slice(0, 10),
		contractWorkHoursPerWeek: 39,
		contractWageType: "monthly",
		contractWageAmount: 3850,
		contractEntgeltgruppe: "S11b",
		contractErfahrungsstufe: 2,
		markAsHiredAndActive: mode === "internal",
	});

	// Customizable Additional Onboarding Fields
	// svelte-ignore state_referenced_locally
	let activeCustomFields = $state<any[]>(
		(customFieldDefinitions?.length
			? customFieldDefinitions
			: DEFAULT_CUSTOM_ONBOARDING_FIELDS
		).map((f: any) => ({ ...f })),
	);

	// svelte-ignore state_referenced_locally
	let customResponses = $state<Record<string, any>>({
		...(initialData?.customFieldValues || {}),
	});

	// Custom Field Builder State (for internal Admin / HR / Hiring Manager)
	let showFieldBuilder = $state(false);
	let newFieldLabelDe = $state("");
	let newFieldLabelEn = $state("");
	let newFieldType = $state<"text" | "textarea" | "select" | "boolean" | "date">("text");
	let newFieldCategory = $state<"compliance" | "equipment" | "emergency" | "payroll" | "custom">("custom");
	let newFieldOptionsText = $state("");
	let newFieldRequired = $state(false);

	function addCustomField() {
		if (!newFieldLabelDe.trim()) {
			toast.error("Bitte geben Sie eine Bezeichnung für das Zusatzfeld ein.");
			return;
		}
		const id = `custom_${newFieldLabelDe
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36)}`;
		const options =
			newFieldType === "select"
				? newFieldOptionsText
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean)
				: undefined;

		activeCustomFields = [
			...activeCustomFields,
			{
				id,
				labelDe: newFieldLabelDe.trim(),
				labelEn: newFieldLabelEn.trim() || newFieldLabelDe.trim(),
				type: newFieldType,
				required: newFieldRequired,
				options,
				category: newFieldCategory,
			},
		];
		newFieldLabelDe = "";
		newFieldLabelEn = "";
		newFieldOptionsText = "";
		newFieldRequired = false;
		toast.success("Zusatzfeld zum Onboarding-Bogen hinzugefügt.");
	}

	function removeCustomField(id: string) {
		activeCustomFields = activeCustomFields.filter((f) => f.id !== id);
	}

	const customFieldDefinitionsJson = $derived(JSON.stringify(activeCustomFields));
	const customFieldResponsesJson = $derived(JSON.stringify(customResponses));
	const channelValue = $derived(
		mode === "magic_link"
			? "candidate_magic_link"
			: mode === "self_service"
				? "self_service"
				: "internal_team",
	);
</script>

<form
	{...rf.preflight(onboardingPayrollSubmissionSchema).enhance(async ({ submit }) => {
		try {
			await submit();
			const res = rf.result as any;
			if (res?.success) {
				toast.success(
					"Onboarding-Zusatzdaten & gesetzliche Lohnstammdaten PKI-verschlüsselt gespeichert!",
				);
				if (onSuccess) onSuccess(res);
			}
		} catch (err: any) {
			toast.error(err?.message || "Fehler beim Speichern der Onboarding-Daten.");
		}
	})}
	class="space-y-6"
>
	{#if talentId}
		<input {...rf.fields.talentId.as("hidden", talentId)} />
	{/if}
	{#if invitationToken}
		<input {...rf.fields.invitationToken.as("hidden", invitationToken)} />
	{/if}
	{#if jobPostingId}
		<input {...rf.fields.jobPostingId.as("hidden", jobPostingId)} />
	{/if}
	<input {...rf.fields.filledByChannel.as("hidden", channelValue)} />
	<input {...rf.fields.customFieldDefinitionsJson.as("hidden", customFieldDefinitionsJson)} />
	<input {...rf.fields.customFieldResponsesJson.as("hidden", customFieldResponsesJson)} />

	<!-- Section 1: Personal & Residential Address -->
	<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
		<div class="flex items-center gap-2 border-b border-slate-100 pb-3">
			<UserCheck class="w-5 h-5 text-indigo-600" />
			<h3 class="text-base font-bold text-slate-900">
				1. Persönliche Stammdaten & Meldeadresse (für DEÜV & Lohnkonto)
			</h3>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			<div>
				<label for="ob-gn" class="block text-xs font-bold text-slate-700 mb-1">Vorname *</label>
				<input
					id="ob-gn"
					{...rf.fields.givenName.as("text")}
					bind:value={formState.givenName}
					required
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
				/>
				{#each rf.fields.givenName.issues() as issue, idx (idx)}
					<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label for="ob-fn" class="block text-xs font-bold text-slate-700 mb-1">Nachname *</label>
				<input
					id="ob-fn"
					{...rf.fields.familyName.as("text")}
					bind:value={formState.familyName}
					required
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
				/>
				{#each rf.fields.familyName.issues() as issue, idx (idx)}
					<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label for="ob-bday" class="block text-xs font-bold text-slate-700 mb-1">Geburtsdatum *</label>
				<input
					id="ob-bday"
					{...rf.fields.birthday.as("date")}
					bind:value={formState.birthday}
					required
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
				/>
				{#each rf.fields.birthday.issues() as issue, idx (idx)}
					<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label for="ob-phone" class="block text-xs font-bold text-slate-700 mb-1">Telefonnummer</label>
				<input
					id="ob-phone"
					{...rf.fields.phone.as("tel")}
					bind:value={formState.phone}
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
				/>
			</div>

			<div>
				<label for="ob-street" class="block text-xs font-bold text-slate-700 mb-1">Straße *</label>
				<input
					id="ob-street"
					{...rf.fields.street.as("text")}
					bind:value={formState.street}
					required
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
				/>
				{#each rf.fields.street.issues() as issue, idx (idx)}
					<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
				{/each}
			</div>

			<div class="grid grid-cols-3 gap-2">
				<div>
					<label for="ob-hn" class="block text-xs font-bold text-slate-700 mb-1">Hausnr.</label>
					<input
						id="ob-hn"
						{...rf.fields.houseNumber.as("text")}
						bind:value={formState.houseNumber}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="ob-zip" class="block text-xs font-bold text-slate-700 mb-1">PLZ *</label>
					<input
						id="ob-zip"
						{...rf.fields.zip.as("text")}
						bind:value={formState.zip}
						required
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="ob-city" class="block text-xs font-bold text-slate-700 mb-1">Ort *</label>
					<input
						id="ob-city"
						{...rf.fields.city.as("text")}
						bind:value={formState.city}
						required
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Section 2: Statutory German Tax Details (ELStAM) -->
	<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
		<div class="flex items-center gap-2 border-b border-slate-100 pb-3">
			<Scale class="w-5 h-5 text-indigo-600" />
			<h3 class="text-base font-bold text-slate-900">
				2. Elektronische Lohnsteuerabzugsmerkmale (ELStAM / § 39e EStG)
			</h3>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<div>
				<label for="ob-taxid" class="block text-xs font-bold text-slate-700 mb-1">
					Steuer-Identifikationsnummer (11 Ziffern) *
				</label>
				<input
					id="ob-taxid"
					{...rf.fields.taxId.as("text")}
					bind:value={formState.taxId}
					required
					placeholder="z.B. 12345678901"
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
				/>
				{#each rf.fields.taxId.issues() as issue, idx (idx)}
					<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label for="ob-taxclass" class="block text-xs font-bold text-slate-700 mb-1">
					Steuerklasse *
				</label>
				<select
					id="ob-taxclass"
					{...rf.fields.taxClass.as("select")}
					bind:value={formState.taxClass}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
				>
					<option value="1">Steuerklasse I (Ledig / Geschieden)</option>
					<option value="2">Steuerklasse II (Alleinerziehend)</option>
					<option value="3">Steuerklasse III (Verheiratet, höherer Verdienst)</option>
					<option value="4">Steuerklasse IV (Verheiratet, gleich)</option>
					<option value="5">Steuerklasse V (Verheiratet, Partner Kl. III)</option>
					<option value="6">Steuerklasse VI (Zweitbeschäftigung)</option>
				</select>
			</div>

			<div>
				<label for="ob-children" class="block text-xs font-bold text-slate-700 mb-1">
					Kinderfreibeträge (Zähler)
				</label>
				<input
					id="ob-children"
					{...rf.fields.childCount.as("number")}
					bind:value={formState.childCount}
					step="0.5"
					min="0"
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
				/>
			</div>

			<div>
				<label for="ob-church" class="block text-xs font-bold text-slate-700 mb-1">
					Kirchensteuermerkmal
				</label>
				<select
					id="ob-church"
					{...rf.fields.churchTax.as("select")}
					bind:value={formState.churchTax}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
				>
					<option value="none">Keine Kirchensteuer (konfessionslos)</option>
					<option value="ev">Evangelisch (ev)</option>
					<option value="rk">Römisch-Katholisch (rk)</option>
				</select>
			</div>

			<div>
				<label for="ob-state" class="block text-xs font-bold text-slate-700 mb-1">
					Bundesland (Betriebsstätte)
				</label>
				<select
					id="ob-state"
					{...rf.fields.state.as("select")}
					bind:value={formState.state}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
				>
					<option value="BE">Berlin (BE)</option>
					<option value="BB">Brandenburg (BB)</option>
					<option value="NW">Nordrhein-Westfalen (NW)</option>
					<option value="BY">Bayern (BY)</option>
					<option value="BW">Baden-Württemberg (BW)</option>
					<option value="HH">Hamburg (HH)</option>
					<option value="HE">Hessen (HE)</option>
					<option value="SN">Sachsen (SN)</option>
					<option value="NI">Niedersachsen (NI)</option>
				</select>
			</div>

			<div class="flex items-center pt-5">
				<label class="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
					<input
						{...rf.fields.hasChildren.as("checkbox")}
						checked={formState.hasChildren}
						onchange={(e) => (formState.hasChildren = e.currentTarget.checked)}
						class="h-4 w-4 rounded text-indigo-600"
					/>
					Elterneigenschaft für Pflegeversicherung (PV-Abschlag nach PUEG)
				</label>
			</div>
		</div>
	</div>

	<!-- Section 3: Social Security (SV / DEÜV), Health Fund & SGB II -->
	<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
		<div class="flex items-center gap-2 border-b border-slate-100 pb-3">
			<HeartPulse class="w-5 h-5 text-rose-600" />
			<h3 class="text-base font-bold text-slate-900">
				3. Sozialversicherung (SV / DEÜV), Krankenkasse & SGB II Förderung
			</h3>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<div>
				<label for="ob-svnr" class="block text-xs font-bold text-slate-700 mb-1">
					Sozialversicherungsnummer (12-stellig) *
				</label>
				<input
					id="ob-svnr"
					{...rf.fields.socialSecurityNumber.as("text")}
					bind:value={formState.socialSecurityNumber}
					required
					placeholder="z.B. 65150490M018"
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
				/>
				{#each rf.fields.socialSecurityNumber.issues() as issue, idx (idx)}
					<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label for="ob-hmoname" class="block text-xs font-bold text-slate-700 mb-1">
					Krankenkasse (GKV / PKV) *
				</label>
				<input
					id="ob-hmoname"
					{...rf.fields.healthInsuranceName.as("text")}
					bind:value={formState.healthInsuranceName}
					required
					placeholder="z.B. Techniker Krankenkasse (TK)"
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
				/>
			</div>

			<div>
				<label for="ob-hmotype" class="block text-xs font-bold text-slate-700 mb-1">
					 Krankenversicherungsart
				</label>
				<select
					id="ob-hmotype"
					{...rf.fields.healthInsuranceType.as("select")}
					bind:value={formState.healthInsuranceType}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
				>
					<option value="statutory">Gesetzlich versichert (GKV)</option>
					<option value="private">Privat versichert (PKV)</option>
				</select>
			</div>

			<div>
				<label for="ob-addcontrib" class="block text-xs font-bold text-slate-700 mb-1">
					KV-Zusatzbeitrag (%)
				</label>
				<input
					id="ob-addcontrib"
					{...rf.fields.healthInsuranceAdditionalContributionPercent.as("number")}
					bind:value={formState.healthInsuranceAdditionalContributionPercent}
					step="0.1"
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
				/>
			</div>

			<div>
				<label for="ob-emptype" class="block text-xs font-bold text-slate-700 mb-1">
					Beschäftigungsart
				</label>
				<select
					id="ob-emptype"
					{...rf.fields.employmentType.as("select")}
					bind:value={formState.employmentType}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
				>
					<option value="regular">Sozialversicherungspflichtig (Regulär)</option>
					<option value="minijob">Minijob (Geringfügig entlohnt)</option>
					<option value="midijob">Midijob (Übergangsbereich)</option>
					<option value="working_student">Werkstudierende</option>
					<option value="intern">Praktikum</option>
				</select>
			</div>

			<div>
				<label for="ob-funding" class="block text-xs font-bold text-slate-700 mb-1">
					SGB II Förderprogramm
				</label>
				<select
					id="ob-funding"
					{...rf.fields.fundingProgram.as("select")}
					bind:value={formState.fundingProgram}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
				>
					<option value="none">Keine Förderung (Regulär)</option>
					<option value="sgb2_16i">§ 16i SGB II (Teilhabe am Arbeitsmarkt, BGR 1101)</option>
					<option value="sgb2_16d">§ 16d SGB II (AGH / MAE, BGR 0000, PGR 190)</option>
				</select>
			</div>

			<div>
				<label for="ob-pgr" class="block text-xs font-bold text-slate-700 mb-1">
					DEÜV Personengruppe
				</label>
				<input
					id="ob-pgr"
					{...rf.fields.deuevPersonengruppe.as("text")}
					bind:value={formState.deuevPersonengruppe}
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
				/>
			</div>

			<div>
				<label for="ob-bgr" class="block text-xs font-bold text-slate-700 mb-1">
					DEÜV Beitragsgruppe (KV/RV/AV/PV)
				</label>
				<input
					id="ob-bgr"
					{...rf.fields.deuevBeitragsgruppe.as("text")}
					bind:value={formState.deuevBeitragsgruppe}
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
				/>
			</div>
		</div>
	</div>

	<!-- Section 4: SEPA Bank Account for Salary Payout -->
	<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
		<div class="flex items-center gap-2 border-b border-slate-100 pb-3">
			<Landmark class="w-5 h-5 text-emerald-600" />
			<h3 class="text-base font-bold text-slate-900">
				4. SEPA-Bankverbindung für die Gehaltsabrechnung
			</h3>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
			<div>
				<label for="ob-iban" class="block text-xs font-bold text-slate-700 mb-1">IBAN *</label>
				<input
					id="ob-iban"
					{...rf.fields.iban.as("text")}
					bind:value={formState.iban}
					required
					placeholder="DE89 3704 0044 0532 0130 00"
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
				/>
				{#each rf.fields.iban.issues() as issue, idx (idx)}
					<p class="mt-1 text-xs text-rose-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label for="ob-bic" class="block text-xs font-bold text-slate-700 mb-1">BIC</label>
				<input
					id="ob-bic"
					{...rf.fields.bic.as("text")}
					bind:value={formState.bic}
					placeholder="COBADEFFXXX"
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
				/>
			</div>

			<div>
				<label for="ob-bank" class="block text-xs font-bold text-slate-700 mb-1">Kreditinstitut</label>
				<input
					id="ob-bank"
					{...rf.fields.bankName.as("text")}
					bind:value={formState.bankName}
					placeholder="z.B. GLS Gemeinschaftsbank / DKB"
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
				/>
			</div>
		</div>
	</div>

	<!-- Section 5: Customizable Additional Onboarding Fields (Story 4) -->
	<div class="rounded-2xl border border-violet-200 bg-violet-50/30 p-5 shadow-xs space-y-4">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-violet-100 pb-3">
			<div class="flex items-center gap-2">
				<Sliders class="w-5 h-5 text-violet-600" />
				<div>
					<h3 class="text-base font-bold text-slate-900">
						5. Anpassbare Onboarding-Zusatzfelder (Story 4)
					</h3>
					<p class="text-xs text-slate-500">
						Spezifische Träger-, Compliance- und Ausstattungsfelder (individuell erweiterbar durch Admin, HR oder Hiring Manager).
					</p>
				</div>
			</div>

			{#if mode === "internal"}
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={() => (showFieldBuilder = !showFieldBuilder)}
					class="bg-white"
				>
					<Plus class="w-3.5 h-3.5 mr-1" />
					{showFieldBuilder ? "Feld-Designer schließen" : "Zusatzfeld konfigurieren"}
				</Button>
			{/if}
		</div>

		<!-- Dynamic Custom Field Builder for Internal Team (No name attributes!) -->
		{#if mode === "internal" && showFieldBuilder}
			<div class="rounded-xl border border-violet-200 bg-white p-4 space-y-3">
				<h4 class="text-xs font-bold uppercase tracking-wider text-violet-800">
					Neues Onboarding-Zusatzfeld definieren
				</h4>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
					<div>
						<label for="cf-label-de" class="block text-[11px] font-bold text-slate-700 mb-1">
							Feldname (Deutsch) *
						</label>
						<input
							id="cf-label-de"
							type="text"
							bind:value={newFieldLabelDe}
							placeholder="z.B. Masernschutz-Nachweis"
							class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
						/>
					</div>

					<div>
						<label for="cf-label-en" class="block text-[11px] font-bold text-slate-700 mb-1">
							Feldname (Englisch)
						</label>
						<input
							id="cf-label-en"
							type="text"
							bind:value={newFieldLabelEn}
							placeholder="e.g. Measles Immunity Proof"
							class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
						/>
					</div>

					<div>
						<label for="cf-type" class="block text-[11px] font-bold text-slate-700 mb-1">
							Feldtyp
						</label>
						<select
							id="cf-type"
							bind:value={newFieldType}
							class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
						>
							<option value="text">Textfeld (einzeilig)</option>
							<option value="textarea">Mehrzeiliger Text</option>
							<option value="select">Auswahlmenü (Dropdown)</option>
							<option value="boolean">Ja / Nein Checkbox</option>
							<option value="date">Datum</option>
						</select>
					</div>

					<div>
						<label for="cf-cat" class="block text-[11px] font-bold text-slate-700 mb-1">
							Kategorie
						</label>
						<select
							id="cf-cat"
							bind:value={newFieldCategory}
							class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
						>
							<option value="compliance">Compliance & Nachweise</option>
							<option value="equipment">IT & Arbeitsmittel</option>
							<option value="emergency">Notfallkontakt</option>
							<option value="payroll">Vergütung & Zulagen</option>
							<option value="custom">Sonstiges</option>
						</select>
					</div>
				</div>

				{#if newFieldType === "select"}
					<div>
						<label for="cf-opts" class="block text-[11px] font-bold text-slate-700 mb-1">
							Auswahloptionen (kommagetrennt)
						</label>
						<input
							id="cf-opts"
							type="text"
							bind:value={newFieldOptionsText}
							placeholder="Option A, Option B, Option C"
							class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
						/>
					</div>
				{/if}

				<div class="flex items-center justify-between pt-1">
					<label class="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
						<input type="checkbox" bind:checked={newFieldRequired} class="rounded text-violet-600" />
						Pflichtfeld im Onboarding
					</label>
					<Button type="button" size="sm" onclick={addCustomField} class="bg-violet-600 text-white">
						<Plus class="w-3.5 h-3.5 mr-1" />
						Feld hinzufügen
					</Button>
				</div>
			</div>
		{/if}

		<!-- Dynamic Custom Fields Inputs (No raw name attributes; serialized via customFieldResponsesJson) -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{#each activeCustomFields as cf (cf.id)}
				<div class="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5">
					<div class="flex items-center justify-between gap-2">
						<label for="cf-input-{cf.id}" class="text-xs font-bold text-slate-800">
							{cf.labelDe}
							{#if cf.required}<span class="text-rose-600">*</span>{/if}
						</label>
						{#if mode === "internal"}
							<button
								type="button"
								onclick={() => removeCustomField(cf.id)}
								title="Zusatzfeld entfernen"
								class="text-slate-400 hover:text-rose-600"
							>
								<Trash2 class="w-3.5 h-3.5" />
							</button>
						{/if}
					</div>

					{#if cf.type === "select" && cf.options?.length}
						<select
							id="cf-input-{cf.id}"
							bind:value={customResponses[cf.id]}
							class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
						>
							<option value="">— Bitte wählen —</option>
							{#each cf.options as opt (opt)}
								<option value={opt}>{opt}</option>
							{/each}
						</select>
					{:else if cf.type === "boolean"}
						<label class="flex items-center gap-2 pt-1 text-xs text-slate-700 cursor-pointer">
							<input
								id="cf-input-{cf.id}"
								type="checkbox"
								checked={Boolean(customResponses[cf.id])}
								onchange={(e) => (customResponses[cf.id] = e.currentTarget.checked)}
								class="h-4 w-4 rounded text-violet-600"
							/>
							<span>Ja / Bestätigt</span>
						</label>
					{:else if cf.type === "date"}
						<input
							id="cf-input-{cf.id}"
							type="date"
							bind:value={customResponses[cf.id]}
							class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
						/>
					{:else if cf.type === "textarea"}
						<textarea
							id="cf-input-{cf.id}"
							rows={2}
							bind:value={customResponses[cf.id]}
							class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
						></textarea>
					{:else}
						<input
							id="cf-input-{cf.id}"
							type="text"
							bind:value={customResponses[cf.id]}
							class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
						/>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Section 6: Internal Base Contract & Active Payroll Provisioning -->
	{#if mode === "internal"}
		<div class="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-xs space-y-4">
			<div class="flex items-center gap-2 border-b border-emerald-100 pb-3">
				<FileSignature class="w-5 h-5 text-emerald-700" />
				<div>
					<h3 class="text-base font-bold text-slate-900">
						6. Arbeitsvertrag & Sofortige Freigabe für die Gehaltsabrechnung (Payroll Engine)
					</h3>
					<p class="text-xs text-slate-600">
						Erzeugt auf Wunsch direkt einen aktiven Hauptvertrag (`base_contract`) und schaltet das Talent auf `active` / `hired`.
					</p>
				</div>
			</div>

			<div class="flex flex-wrap gap-6">
				<label class="flex items-center gap-2 text-xs font-bold text-emerald-950 cursor-pointer">
					<input
						{...rf.fields.autoCreateContract.as("checkbox")}
						checked={formState.autoCreateContract}
						onchange={(e) => (formState.autoCreateContract = e.currentTarget.checked)}
						class="h-4 w-4 rounded text-emerald-600"
					/>
					Basis-Arbeitsvertrag automatisch anlegen (falls noch kein Vertrag existiert)
				</label>

				<label class="flex items-center gap-2 text-xs font-bold text-emerald-950 cursor-pointer">
					<input
						{...rf.fields.markAsHiredAndActive.as("checkbox")}
						checked={formState.markAsHiredAndActive}
						onchange={(e) => (formState.markAsHiredAndActive = e.currentTarget.checked)}
						class="h-4 w-4 rounded text-emerald-600"
					/>
					Kandidat:in als Eingestellt (`hired` / `active`) markieren
				</label>
			</div>

			{#if formState.autoCreateContract}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
					<div>
						<label for="ob-cstart" class="block text-[11px] font-bold text-slate-700 mb-1">
							Vertragsbeginn
						</label>
						<input
							id="ob-cstart"
							{...rf.fields.contractStartDate.as("date")}
							bind:value={formState.contractStartDate}
							class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
						/>
					</div>

					<div>
						<label for="ob-chours" class="block text-[11px] font-bold text-slate-700 mb-1">
							Wochenstunden
						</label>
						<input
							id="ob-chours"
							{...rf.fields.contractWorkHoursPerWeek.as("number")}
							bind:value={formState.contractWorkHoursPerWeek}
							step="0.5"
							class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
						/>
					</div>

					<div>
						<label for="ob-cwage" class="block text-[11px] font-bold text-slate-700 mb-1">
							Bruttogehalt (€)
						</label>
						<input
							id="ob-cwage"
							{...rf.fields.contractWageAmount.as("number")}
							bind:value={formState.contractWageAmount}
							step="50"
							class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
						/>
					</div>

					<div>
						<label for="ob-ceg" class="block text-[11px] font-bold text-slate-700 mb-1">
							Entgeltgruppe
						</label>
						<input
							id="ob-ceg"
							{...rf.fields.contractEntgeltgruppe.as("text")}
							bind:value={formState.contractEntgeltgruppe}
							class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
						/>
					</div>

					<div>
						<label for="ob-cstufe" class="block text-[11px] font-bold text-slate-700 mb-1">
							Erfahrungsstufe
						</label>
						<input
							id="ob-cstufe"
							{...rf.fields.contractErfahrungsstufe.as("number")}
							bind:value={formState.contractErfahrungsstufe}
							class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
						/>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-900 p-4 text-white">
		<div class="flex items-center gap-2.5 text-xs text-slate-300">
			<ShieldCheck class="w-5 h-5 text-teal-400 shrink-0" />
			<span>
				Alle Angaben werden per <strong>AES-256-GCM / RSA-OAEP-256</strong> verschlüsselt, in `payroll_profile` übernommen und in der <strong>Blockchain-Custody-Kette</strong> signiert.
			</span>
		</div>

		<AsyncButton
			type="submit"
			loading={rf.pending > 0}
			class="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black shrink-0"
		>
			<CheckCircle2 class="w-4 h-4 mr-1.5" />
			Onboarding- & Lohnprofil verschlüsselt speichern
		</AsyncButton>
	</div>
</form>
