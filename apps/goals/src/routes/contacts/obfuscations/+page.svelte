<script lang="ts">
	import { GdprAdminList } from "@ac/ui";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import {
		listGdprRequests,
		executeGdprObfuscation,
	} from "./obfuscations.remote.js";
	import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";

	breadcrumbState.set({
		feature: "contacts",
		segments: [{ label: "Encrypted Contacts", href: "/contacts" }],
		current: "GDPR Art. 17 Obfuscation Queue",
	});

	const requestsQuery = listGdprRequests({ status: "all" });
</script>

<svelte:head>
	<title>GDPR Art. 17 Obfuscation & Crypto-Shredding Manager · AC-Goals</title>
</svelte:head>

<div class="space-y-6">
	<div class="rounded-3xl border border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-sm">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div class="space-y-1">
				<span class="text-[11px] font-black uppercase tracking-wider text-indigo-300">
					GDPR Art. 17 · Right to Erasure & PKI Crypto-Shredding
				</span>
				<h2 class="text-lg sm:text-xl font-black">
					Irreversible Contact Anonymization & DEK Destruction
				</h2>
				<p class="text-xs text-slate-300 max-w-3xl leading-relaxed">
					Executing obfuscation permanently destroys the contact's AES-256-GCM Data Encryption Key (<code class="text-indigo-200">crypto_data_key</code>), replaces personal fields with SHA-256 hashes, and anonymizes linked campaign participations while keeping aggregate campaign goal totals accurate.
				</p>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<a
					href="/contacts"
					class="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20"
				>
					<ArrowLeftIcon class="size-3.5" />
					Contacts Vault
				</a>
				<a
					href="/gdpr-self-service"
					class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400"
				>
					<ShieldCheckIcon class="size-3.5" />
					Self-Service Portal
				</a>
			</div>
		</div>
	</div>

	<GdprAdminList
		{requestsQuery}
		obfuscateCommand={executeGdprObfuscation}
	/>
</div>
