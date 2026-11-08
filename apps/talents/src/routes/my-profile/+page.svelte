<script lang="ts">
	import { getMyCustodyAndOnboarding } from "../recruitment/recruitment.remote";
	import OnboardingPayrollForm from "#lib/components/recruitment/OnboardingPayrollForm.svelte";
	import CustodyLedgerPanel from "#lib/components/talent/CustodyLedgerPanel.svelte";
	import RequestTimeOffModal from "#lib/components/time-off/RequestTimeOffModal.svelte";
	import { Button, LoadingSection, ErrorSection } from "@ac/ui";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import * as m from "#lib/paraglide/messages.js";
	import {
		User,
		ShieldCheck,
		Lock,
		KeyRound,
		ExternalLink,
		FileCheck2,
		Trash2,
		Plane,
		Clock,
		Banknote,
		Calendar,
	} from "@lucide/svelte";

	breadcrumbState.set({ feature: "my-profile", current: "Mein Profil & Arbeitsplatz" });

	const myQuery = getMyCustodyAndOnboarding();
	const myData = $derived(myQuery.current);

	let activeTab = $state<"profile" | "custody" | "gdpr">("profile");
	let showTimeOffModal = $state(false);
</script>

<svelte:head>
	<title>Mein Profil & Arbeitsplatz · AC Talents</title>
</svelte:head>

<div class="space-y-6">
	{#if myQuery.loading && !myData}
		<LoadingSection message="Persönliches Mitarbeiterprofil wird geladen..." />
	{:else if myQuery.error}
		<ErrorSection headline="Fehler beim Laden" message={myQuery.error.message} />
	{:else if myData}
		<!-- Header Banner -->
		<div class="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-950 via-slate-900 to-teal-950 p-6 md:p-8 text-white shadow-lg">
			<div class="flex flex-col md:flex-row md:items-start justify-between gap-6">
				<div class="space-y-2 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<span class="inline-flex items-center gap-1.5 rounded-full bg-teal-400/20 px-3 py-0.5 text-xs font-bold text-teal-200 border border-teal-400/30">
							<ShieldCheck class="w-3.5 h-3.5" />
							Mitarbeiter-Portal & Datenschutz
						</span>
						{#if myData.talent}
							<span class="inline-flex items-center gap-1 rounded-full bg-indigo-400/20 px-3 py-0.5 text-xs font-semibold text-indigo-200 border border-indigo-400/30">
								Status: {myData.talent.status || "Aktiv"}
							</span>
						{/if}
					</div>
					<h1 class="text-2xl sm:text-3xl font-black tracking-tight">
						{myData.talent?.contact?.displayName || myData.user.name || "Mein Personalprofil"}
					</h1>
					<p class="text-xs sm:text-sm text-slate-300 max-w-2xl">
						Verwalten Sie Ihre persönlichen Stammdaten, prüfen Sie die Änderungshistorie im Audit-Log oder nutzen Sie die DSGVO-Selbstauskunft.
					</p>
				</div>

				{#if myData.talent}
					<!-- Employment Quick Actions in Header -->
					<div class="flex flex-wrap items-center gap-2 shrink-0">
						<Button
							onclick={() => (showTimeOffModal = true)}
							class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm"
							size="sm"
						>
							<Plane class="w-4 h-4 mr-1.5" />
							Urlaub beantragen
						</Button>

						<a href="/my-timesheet">
							<Button variant="outline" size="sm" class="border-white/25 bg-white/10 text-white hover:bg-white/20">
								<Clock class="w-4 h-4 mr-1.5" />
								Zeiterfassung
							</Button>
						</a>

						<a href="/my-payroll">
							<Button variant="outline" size="sm" class="border-white/25 bg-white/10 text-white hover:bg-white/20">
								<Banknote class="w-4 h-4 mr-1.5" />
								Abrechnungen
							</Button>
						</a>

						<a href="/gdpr-self-service">
							<Button variant="secondary" size="sm" class="bg-teal-400 text-slate-950 hover:bg-teal-300 font-bold">
								<Lock class="w-4 h-4 mr-1.5" />
								DSGVO
							</Button>
						</a>
					</div>
				{/if}
			</div>

			<!-- Tab Navigation -->
			<div class="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
				<button
					type="button"
					onclick={() => (activeTab = "profile")}
					class="rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 {activeTab === 'profile'
						? 'bg-white text-slate-950 shadow'
						: 'bg-white/10 text-slate-200 hover:bg-white/20'}"
				>
					<User class="w-4 h-4" />
					1. Stammdaten & Beschäftigung
				</button>

				<button
					type="button"
					onclick={() => (activeTab = "custody")}
					class="rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 {activeTab === 'custody'
						? 'bg-white text-slate-950 shadow'
						: 'bg-white/10 text-slate-200 hover:bg-white/20'}"
				>
					<ShieldCheck class="w-4 h-4" />
					2. Änderungshistorie & Audit-Trail
				</button>

				<button
					type="button"
					onclick={() => (activeTab = "gdpr")}
					class="rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 {activeTab === 'gdpr'
						? 'bg-white text-slate-950 shadow'
						: 'bg-white/10 text-slate-200 hover:bg-white/20'}"
				>
					<KeyRound class="w-4 h-4" />
					3. Datenschutz & DSGVO (Art. 15/17)
				</button>
			</div>
		</div>

		{#if !myData.talent}
			<div class="rounded-2xl border bg-white p-8 text-center space-y-3">
				<h2 class="text-lg font-bold text-slate-900">Kein verknüpfter Personal-Datensatz gefunden</h2>
				<p class="text-sm text-slate-600">
					Ihr Benutzerkonto ({myData.user.email}) ist aktuell noch keinem Mitarbeiterprofil zugeordnet.
				</p>
			</div>
		{:else if activeTab === "profile"}
			<OnboardingPayrollForm
				talentId={myData.talent.id}
				initialData={myData.talent}
				customFieldDefinitions={myData.customOnboardingFields}
				mode="self_service"
				onSuccess={() => {
					void myQuery.refresh();
				}}
			/>
		{:else if activeTab === "custody"}
			<CustodyLedgerPanel talentId={myData.talent.id} />
		{:else if activeTab === "gdpr"}
			<div class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
				<div class="flex items-start gap-3 border-b border-slate-100 pb-4">
					<div class="p-3 rounded-2xl bg-teal-600 text-white">
						<KeyRound class="w-6 h-6" />
					</div>
					<div>
						<h2 class="text-lg font-black text-slate-900">
							Datenschutz-Selbstauskunft & Recht auf Löschung (DSGVO)
						</h2>
						<p class="text-xs text-slate-600 mt-1">
							Verwalten Sie Ihre Datenschutzrechte, fordern Sie Datenauskünfte an oder beantragen Sie die Löschung Ihrer Daten.
						</p>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
						<div class="flex items-center gap-2 font-bold text-sm text-slate-900">
							<Lock class="w-4 h-4 text-indigo-600" />
							Verschlüsselte Speicherung (AES-256)
						</div>
						<p class="text-xs text-slate-600 leading-relaxed">
							Ihre personenbezogenen Stammdaten sind nach modernen Sicherheitsstandards verschlüsselt gespeichert, sodass nur autorisierte Stellen Zugriff haben.
						</p>
					</div>

					<div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
						<div class="flex items-center gap-2 font-bold text-sm text-slate-900">
							<FileCheck2 class="w-4 h-4 text-teal-600" />
							Sichere Datenabfrage
						</div>
						<p class="text-xs text-slate-600 leading-relaxed">
							Für Auskunfts- und Obfuskierungsanfragen werden sensible Daten wie E-Mail und Steuernummer über geschützte kryptografische Indizes verarbeitet.
						</p>
					</div>

					<div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
						<div class="flex items-center gap-2 font-bold text-sm text-slate-900">
							<Trash2 class="w-4 h-4 text-rose-600" />
							Recht auf Löschung (Art. 17 DSGVO)
						</div>
						<p class="text-xs text-slate-600 leading-relaxed">
							Bei einer bestätigten Löschanfrage werden Ihre personenbezogenen Daten unwiderruflich gelöscht bzw. unlesbar gemacht, während gesetzliche Aufbewahrungsfristen eingehalten werden.
						</p>
					</div>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-5 text-white">
					<div class="space-y-1">
						<h3 class="text-sm font-bold">DSGVO Self-Service-Portal öffnen</h3>
						<p class="text-xs text-slate-300">
							Fordern Sie einen vollständigen maschinenlesbaren JSON-Export Ihrer Daten an oder verwalten Sie Löschungsanträge.
						</p>
					</div>
					<a href="/gdpr-self-service">
						<Button class="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black">
							Zum DSGVO Self-Service
						</Button>
					</a>
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if myData?.talent?.id}
	<RequestTimeOffModal
		bind:open={showTimeOffModal}
		talentId={myData.talent.id}
		onSuccess={() => void myQuery.refresh()}
	/>
{/if}
