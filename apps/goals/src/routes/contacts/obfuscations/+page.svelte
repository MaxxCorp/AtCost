<script lang="ts">
	import { page } from "$app/state";
	import { GdprAdminList, LoadingSection, Button } from "@ac/ui";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import { getCurrentSessionUser } from "../../goals/list.remote.js";
	import {
		listGdprRequests,
		executeGdprObfuscation,
	} from "./obfuscations.remote.js";
	import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import LockIcon from "@lucide/svelte/icons/lock";

	breadcrumbState.set({
		feature: "contacts",
		segments: [{ label: "Encrypted Contacts", href: "/contacts" }],
		current: "GDPR Art. 17 Obfuscation Queue",
	});

	const sessionQuery = getCurrentSessionUser({});
	const currentUser = $derived(sessionQuery.current?.user ?? null);
	const isOperator = $derived(Boolean(sessionQuery.current?.isOperator));
	const requestsQuery = $derived(isOperator ? listGdprRequests({ status: "all" }) : null);
</script>

<svelte:head>
	<title>GDPR Art. 17 Obfuscation & Crypto-Shredding Manager · AC-Goals</title>
</svelte:head>

{#if sessionQuery.loading && !sessionQuery.current}
	<LoadingSection message="Verifying operator access..." />
{:else if !currentUser || !isOperator}
	<div class="max-w-3xl mx-auto py-8">
		<div class="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center space-y-5 shadow-sm">
			<div class="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
				<LockIcon class="w-7 h-7" />
			</div>
			<div class="space-y-2 max-w-xl mx-auto">
				<h1 class="text-xl font-bold text-gray-900">
					{!currentUser ? "Authentication Required" : "Operator or Admin Privileges Required"}
				</h1>
				<p class="text-sm text-gray-600 leading-relaxed">
					{!currentUser
						? "Please sign in with an Operator or Administrator account to manage GDPR obfuscation requests."
						: "Only platform operators and administrators can access the GDPR Art. 17 Obfuscation Queue."}
				</p>
			</div>
			<div class="flex flex-wrap items-center justify-center gap-3">
				{#if !currentUser}
					<Button href="/login?redirectTo={encodeURIComponent(page.url.pathname)}" variant="primary">
						Sign In
					</Button>
				{:else}
					<Button href="/goals" variant="outline">Back to Campaigns</Button>
				{/if}
			</div>
		</div>
	</div>
{:else}
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

		{#if requestsQuery}
			<GdprAdminList
				{requestsQuery}
				obfuscateCommand={executeGdprObfuscation}
			/>
		{/if}
	</div>
{/if}
