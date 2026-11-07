<script lang="ts">
	import { getMyCustodyAndOnboarding } from "../recruitment/recruitment.remote";
	import OnboardingPayrollForm from "#lib/components/recruitment/OnboardingPayrollForm.svelte";
	import CustodyLedgerPanel from "#lib/components/talent/CustodyLedgerPanel.svelte";
	import { Button, LoadingSection, ErrorSection } from "@ac/ui";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import {
		User,
		ShieldCheck,
		Lock,
		KeyRound,
		ExternalLink,
		FileCheck2,
		Trash2,
	} from "@lucide/svelte";

	breadcrumbState.set({ feature: "my-profile", current: "Mein Self-Service & Custody-Portal" });

	const myQuery = getMyCustodyAndOnboarding();
	const myData = $derived(myQuery.current);

	let activeTab = $state<"profile" | "custody" | "gdpr">("profile");
</script>

<svelte:head>
	<title>Mein Profil, Onboarding & Chain-of-Custody · AC Talents</title>
</svelte:head>

<div class="space-y-6">
	{#if myQuery.loading && !myData}
		<LoadingSection message="Persönliches Self-Service-Profil & Custody-Kette werden geladen..." />
	{:else if myQuery.error}
		<ErrorSection headline="Fehler beim Laden" message={myQuery.error.message} />
	{:else if myData}
		<!-- Header Banner -->
		<div class="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-950 via-slate-900 to-teal-950 p-6 md:p-8 text-white shadow-lg">
			<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div class="space-y-2">
					<div class="flex flex-wrap items-center gap-2">
						<span class="inline-flex items-center gap-1.5 rounded-full bg-teal-400/20 px-3 py-0.5 text-xs font-bold text-teal-200 border border-teal-400/30">
							<ShieldCheck class="w-3.5 h-3.5" />
							Self-Service & Kryptografische Transparenz
						</span>
						{#if myData.talent}
							<span class="inline-flex items-center gap-1 rounded-full bg-indigo-400/20 px-3 py-0.5 text-xs font-mono text-indigo-200 border border-indigo-400/30">
								Version v{myData.talent.currentVersion} · Stage: {myData.talent.pipelineStage}
							</span>
						{/if}
					</div>
					<h1 class="text-2xl sm:text-3xl font-black tracking-tight">
						{myData.talent?.contact?.displayName || myData.user.name || "Mein Personalprofil"}
					</h1>
					<p class="text-xs sm:text-sm text-slate-300 max-w-2xl">
						Verwalten Sie Ihre persönlichen Onboarding- und Lohnstammdaten im Self-Service, prüfen Sie lückenlos, wer Ihre Personaldaten wann und wie bearbeitet hat (Blockchain Chain-of-Custody), oder nutzen Sie das DSGVO-Auskunfts- und Crypto-Shredding-Portal.
					</p>
				</div>

				{#if myData.talent}
					<div class="flex flex-wrap items-center gap-2 shrink-0">
						<a href="/talents/{myData.talent.id}/view">
							<Button variant="outline" size="sm" class="border-white/25 bg-white/10 text-white hover:bg-white/20">
								<ExternalLink class="w-4 h-4 mr-1.5" />
								Klassische Profilansicht
							</Button>
						</a>
						<a href="/gdpr-self-service">
							<Button variant="secondary" size="sm" class="bg-teal-400 text-slate-950 hover:bg-teal-300 font-bold">
								<Lock class="w-4 h-4 mr-1.5" />
								DSGVO Self-Service
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
					1. Mein Profil, Onboarding & Lohnstammdaten
				</button>

				<button
					type="button"
					onclick={() => (activeTab = "custody")}
					class="rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 {activeTab === 'custody'
						? 'bg-white text-slate-950 shadow'
						: 'bg-white/10 text-slate-200 hover:bg-white/20'}"
				>
					<ShieldCheck class="w-4 h-4" />
					2. Meine Chain-of-Custody & Versionshistorie
				</button>

				<button
					type="button"
					onclick={() => (activeTab = "gdpr")}
					class="rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 {activeTab === 'gdpr'
						? 'bg-white text-slate-950 shadow'
						: 'bg-white/10 text-slate-200 hover:bg-white/20'}"
				>
					<KeyRound class="w-4 h-4" />
					3. DSGVO Art. 15/17 & Crypto-Shredding
				</button>
			</div>
		</div>

		{#if !myData.talent}
			<div class="rounded-2xl border bg-white p-8 text-center space-y-3">
				<h2 class="text-lg font-bold text-slate-900">Kein verknüpfter Personal-Datensatz gefunden</h2>
				<p class="text-sm text-slate-600">
					Ihr Benutzerkonto ({myData.user.email}) ist aktuell noch keinem Talent-Profil zugeordnet.
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
							Datenschutz-Selbstauskunft (Art. 15 DSGVO) & Kryptografische Löschung (Art. 17 Crypto-Shredding)
						</h2>
						<p class="text-xs text-slate-600 mt-1">
							Erweiterte Selbstbedienungsfunktionen auf Basis unserer PKI-Envelope-Verschlüsselung und Blockchain-Custody-Architektur.
						</p>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
						<div class="flex items-center gap-2 font-bold text-sm text-slate-900">
							<Lock class="w-4 h-4 text-indigo-600" />
							Subjektbezogener AES-256-GCM DEK
						</div>
						<p class="text-xs text-slate-600 leading-relaxed">
							Ihre personenbezogenen Snapshots sind mit einem dedizierten Data Encryption Key (DEK) verschlüsselt, der über RSA-OAEP-256 (Microsoft 365 NGO / Entra ID gebunden) geschützt ist.
						</p>
					</div>

					<div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
						<div class="flex items-center gap-2 font-bold text-sm text-slate-900">
							<FileCheck2 class="w-4 h-4 text-teal-600" />
							HMAC-SHA256 Blind-Indexierung
						</div>
						<p class="text-xs text-slate-600 leading-relaxed">
							Für Auskunfts- und Obfuskierungsanfragen werden E-Mail, Telefon, Adresse und Steuer-ID über deterministische HMAC-SHA256 Blind-Indizes abgeglichen, ohne Klartext-Scans.
						</p>
					</div>

					<div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
						<div class="flex items-center gap-2 font-bold text-sm text-slate-900">
							<Trash2 class="w-4 h-4 text-rose-600" />
							DSGVO Art. 17 Crypto-Shredding
						</div>
						<p class="text-xs text-slate-600 leading-relaxed">
							Bei einer bestätigten Löschanfrage wird Ihr persönlicher DEK unwiderruflich vernichtet. Alle historischen verschlüsselten Versionen werden unlesbar, während die RFC 6962 Hash-Kette integer bleibt.
						</p>
					</div>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-5 text-white">
					<div class="space-y-1">
						<h3 class="text-sm font-bold">DSGVO Self-Service-Portal öffnen</h3>
						<p class="text-xs text-slate-300">
							Fordern Sie einen vollständigen maschinenlesbaren JSON-Export Ihrer Daten oder die Obfuskierung / Crypto-Shredding per E-Mail-Verifizierung an.
						</p>
					</div>
					<a href="/gdpr-self-service">
						<Button class="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black">
							Zum DSGVO Self-Service (/gdpr-self-service)
						</Button>
					</a>
				</div>
			</div>
		{/if}
	{/if}
</div>
