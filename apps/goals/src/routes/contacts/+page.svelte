<script lang="ts">
	import {
		EntityManager,
		ContactEncryptionBanner,
		ContactEncryptionMigrationDialog,
	} from "@ac/ui";
	import { listContacts } from "./list.remote.js";
	import { deleteContact } from "./[id]/delete.remote.js";
	import {
		getEncryptionStatus,
		beginEncryptionMigration,
		runEncryptionBatch,
	} from "./encryption-migration.remote.js";
	import { breadcrumbState } from "#lib/stores/breadcrumb.svelte.js";
	import {
		Users,
		Lock,
		ShieldAlert,
		ShieldCheck,
		UserX,
		Mail,
		Phone,
		MapPin,
		KeyRound,
	} from "@lucide/svelte";

	breadcrumbState.set({
		feature: "contacts",
		current: "Encrypted Participant Contacts",
	});

	let showEncryptionMigrationDialog = $state(false);
	const encryptionStatusQuery = getEncryptionStatus();
	const encryptionStatus = $derived(encryptionStatusQuery.current);
</script>

<svelte:head>
	<title>Encrypted Participant Contacts & PKI Vault · AC-Goals</title>
</svelte:head>

<div class="container mx-auto px-4 py-6 max-w-6xl space-y-6">
	<!-- Header -->
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-200/80 shadow-2xs">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-indigo-700">
					<KeyRound class="size-3.5" />
					Segregated Contact Vault · AES-256-GCM
				</span>
				{#if encryptionStatus}
					<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
						<Lock class="size-3" />
						{Math.max(0, encryptionStatus.totalContacts - encryptionStatus.unencryptedCount)} / {encryptionStatus.totalContacts} Encrypted
					</span>
				{/if}
			</div>
			<h1 class="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
				Encrypted Supporter & Creator Contacts
			</h1>
			<p class="text-xs sm:text-sm text-gray-500 max-w-2xl">
				Personal supporter data is isolated from public campaign records, encrypted with per-contact AES-256-GCM DEKs, and indexed via HMAC-SHA256 blind hashes for GDPR Art. 17 self-service erasure.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2.5 shrink-0">
			<button
				type="button"
				onclick={() => (showEncryptionMigrationDialog = true)}
				class="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
			>
				<Lock class="size-3.5" />
				PKI Envelope Migration
			</button>
			<a
				href="/contacts/obfuscations"
				class="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition-colors"
			>
				<UserX class="size-3.5" />
				GDPR Obfuscation Queue
			</a>
			<a
				href="/gdpr-self-service"
				class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
			>
				<ShieldCheck class="size-3.5 text-emerald-600" />
				Self-Service Portal
			</a>
		</div>
	</div>

	<!-- Encryption Status Banner -->
	<ContactEncryptionBanner
		status={encryptionStatus}
		onopen={() => (showEncryptionMigrationDialog = true)}
	/>

	{#if showEncryptionMigrationDialog && encryptionStatus}
		<ContactEncryptionMigrationDialog
			bind:open={showEncryptionMigrationDialog}
			statusData={encryptionStatus}
			startMigrationRemote={beginEncryptionMigration}
			processBatchRemote={runEncryptionBatch}
			oncomplete={async () => {
				await encryptionStatusQuery.refresh();
			}}
			onclose={() => (showEncryptionMigrationDialog = false)}
		/>
	{/if}

	<EntityManager
		title="Segregated Contacts"
		icon={Users}
		mode="standalone"
		preferenceKey="em_filters_goals_contacts"
		listItemsRemote={listContacts}
		deleteItemRemote={deleteContact}
	>
		{#snippet renderItem(contact: any)}
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full py-1">
				<div class="space-y-1.5 min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<span class="font-bold text-gray-900 text-sm truncate">
							{contact.displayName ||
								[contact.givenName, contact.familyName].filter(Boolean).join(" ") ||
								"Anonymous Contact"}
						</span>

						{#if contact.encryptionStatus === "shredded" || contact.obfuscationStatus === "obfuscated"}
							<span class="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-700">
								<UserX size={11} />
								Crypto-Shredded (Art. 17)
							</span>
						{:else if contact.encryptionStatus === "migrated"}
							<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
								<Lock size={11} />
								AES-256-GCM Envelope
							</span>
						{:else}
							<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
								<ShieldAlert size={11} />
								Plaintext (Migration Pending)
							</span>
						{/if}

						{#if contact.obfuscationStatus === "pending"}
							<span class="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
								Pending GDPR Erasure
							</span>
						{/if}
					</div>

					<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
						{#if contact.emails?.length}
							<span class="inline-flex items-center gap-1">
								<Mail size={12} class="text-gray-400" />
								{contact.emails.map((e: any) => e.value || e).join(", ")}
							</span>
						{/if}
						{#if contact.phones?.length}
							<span class="inline-flex items-center gap-1">
								<Phone size={12} class="text-gray-400" />
								{contact.phones.map((p: any) => p.value || p).join(", ")}
							</span>
						{/if}
						{#if contact.addresses?.length}
							<span class="inline-flex items-center gap-1">
								<MapPin size={12} class="text-gray-400" />
								{contact.addresses
									.map((a: any) => [a.street, a.zip, a.city].filter(Boolean).join(" "))
									.join(" · ")}
							</span>
						{/if}
					</div>
				</div>

				{#if contact.company || contact.role}
					<div class="text-xs text-gray-500 shrink-0">
						{[contact.role, contact.company].filter(Boolean).join(" · ")}
					</div>
				{/if}
			</div>
		{/snippet}
	</EntityManager>
</div>
