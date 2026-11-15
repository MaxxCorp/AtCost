<script lang="ts">
	import { GdprSelfServiceForm } from "@ac/ui";
	import { gdprSelfServiceSchema } from "@ac/validations";
	import { submitGdprRequest } from "./gdpr-self-service.remote.js";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import LockIcon from "@lucide/svelte/icons/lock";
	import KeyRoundIcon from "@lucide/svelte/icons/key-round";
	import FileTextIcon from "@lucide/svelte/icons/file-text";
	import ScaleIcon from "@lucide/svelte/icons/scale";
	import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";

	breadcrumbState.set({
		feature: "contacts",
		current: "GDPR Art. 15 & 17 Self-Service",
	});
</script>

<svelte:head>
	<title>GDPR Self-Service & Crypto-Shredding · AC-Goals</title>
</svelte:head>

<div class="space-y-6 pb-12">
	<!-- Top Navigation & Legal Links Bar -->
	<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 shadow-2xs">
		<a
			href="/goals"
			class="inline-flex items-center gap-2 text-xs font-bold text-gray-700 hover:text-indigo-600 transition-colors"
		>
			<ArrowLeftIcon class="size-4" />
			Back to Campaigns
		</a>
		<div class="flex flex-wrap items-center gap-2">
			<a
				href="/GDPR"
				class="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
			>
				<FileTextIcon class="size-3.5" />
				Data Privacy Policy (/GDPR)
			</a>
			<a
				href="/imprint"
				class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
			>
				<ScaleIcon class="size-3.5" />
				Legal Notice / Imprint (/imprint)
			</a>
		</div>
	</div>

	<!-- Architecture Explanation Card: Encrypted Contact Segregation -->
	<div class="rounded-3xl border border-indigo-100 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
		<div class="max-w-3xl space-y-3">
			<span class="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-indigo-200">
				<ShieldCheckIcon class="size-3.5" />
				Zero-Plaintext Campaign Ledger · GDPR Art. 17 & 25
			</span>
			<h2 class="text-xl sm:text-2xl font-black tracking-tight">
				Segregated PKI Envelope Encryption & 3-Factor Blind-Index Verification
			</h2>
			<p class="text-xs sm:text-sm text-indigo-100/90 leading-relaxed">
				AC-Goals strictly segregates personal supporter and creator identities from public campaign metrics. All personal contact attributes are encrypted at rest in a dedicated contact vault while campaign backing totals remain intact.
			</p>
		</div>

		<div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
			<div class="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1.5">
				<div class="flex items-center gap-2 font-bold text-indigo-200">
					<LockIcon class="size-4 text-indigo-400" />
					<span>1. AES-256-GCM PKI Envelope</span>
				</div>
				<p class="text-indigo-100/80 leading-relaxed">
					Each contact record is encrypted with a unique per-subject AES-256-GCM Data Encryption Key (<code class="text-indigo-200">crypto_data_key</code>) wrapped by the organizational master key.
				</p>
			</div>
			<div class="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1.5">
				<div class="flex items-center gap-2 font-bold text-emerald-200">
					<KeyRoundIcon class="size-4 text-emerald-400" />
					<span>2. HMAC-SHA256 3-Attribute Match</span>
				</div>
				<p class="text-indigo-100/80 leading-relaxed">
					Verification compares normalized HMAC-SHA256 blind indexes across at least 3 independent personal attributes without exposing plaintext records.
				</p>
			</div>
			<div class="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1.5">
				<div class="flex items-center gap-2 font-bold text-rose-200">
					<ShieldCheckIcon class="size-4 text-rose-400" />
					<span>3. Art. 17 Crypto-Shredding</span>
				</div>
				<p class="text-indigo-100/80 leading-relaxed">
					Upon erasure execution, the subject's DEK is permanently destroyed and fields are replaced with irreversible SHA-256 hashes while preserving aggregate campaign progress.
				</p>
			</div>
		</div>
	</div>

	<GdprSelfServiceForm
		remoteForm={submitGdprRequest}
		validationSchema={gdprSelfServiceSchema}
	/>
</div>
