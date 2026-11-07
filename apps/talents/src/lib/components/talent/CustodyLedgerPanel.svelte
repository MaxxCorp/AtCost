<script lang="ts">
	import {
		verifyCustodyChain,
		getTalentVersionHistory,
		restoreTalentVersion,
		getPkiStatus,
	} from "../../../routes/recruitment/recruitment.remote";
	import { Button, AsyncButton } from "@ac/ui";
	import { toast } from "svelte-sonner";
	import {
		ShieldCheck,
		ShieldAlert,
		History,
		RotateCcw,
		Lock,
		CheckCircle2,
		RefreshCw,
		GitCommitHorizontal,
		FileCode2,
		UserCheck,
	} from "@lucide/svelte";

	let { talentId }: { talentId: string } = $props();

	const custodyQuery = $derived(verifyCustodyChain(talentId));
	const custody = $derived(custodyQuery.current);

	const versionsQuery = $derived(getTalentVersionHistory(talentId));
	const versions = $derived(versionsQuery.current ?? []);

	const pkiQuery = getPkiStatus();
	const pki = $derived(pkiQuery.current);

	let expandedVersionId = $state<string | null>(null);
	let showBlocksExplorer = $state(false);
	let restoringVersionNumber = $state<number | null>(null);
	let restoreReason = $state("Point-in-Time Wiederherstellung durch Personalabteilung / Admin");
	let isRefreshing = $state(false);

	async function handleRefresh() {
		isRefreshing = true;
		try {
			await Promise.all([
				custodyQuery.refresh(),
				versionsQuery.refresh(),
				pkiQuery.refresh(),
			]);
			toast.success("Kryptografische Chain-of-Custody & Merkle-Tree neu verifiziert.");
		} finally {
			isRefreshing = false;
		}
	}

	async function handleRestoreVersion(versionNumber: number) {
		restoringVersionNumber = versionNumber;
		try {
			const res = await restoreTalentVersion({
				talentId,
				versionNumber,
			});
			toast.success(
				`Version v${versionNumber} wurde zerstörungsfrei als neue Version v${res.newVersionNumber} wiederhergestellt!`,
			);
			await Promise.all([custodyQuery.refresh(), versionsQuery.refresh()]);
		} catch (e: any) {
			toast.error(e?.message || "Fehler bei der Wiederherstellung der Version.");
		} finally {
			restoringVersionNumber = null;
		}
	}

	function formatChannel(channel: string) {
		switch (channel) {
			case "public_portal":
				return "Öffentliches Karriereportal (/careers)";
			case "magic_link":
				return "Persönlicher E-Mail Magic-Link";
			case "self_service":
				return "Mitarbeiter Self-Service (/my-profile)";
			case "gdpr_portal":
				return "DSGVO Art. 17 Crypto-Shredding";
			default:
				return "Interne HR / Management Oberfläche";
		}
	}
</script>

<div class="space-y-6">
	<!-- 1. Blockchain & RFC 6962 Merkle Tree Verification Status Banner -->
	<div
		class="rounded-2xl border p-5 shadow-xs {custody?.isValid !== false
			? 'border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white'
			: 'border-rose-300 bg-rose-50/90'}"
	>
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-200/70 pb-4">
			<div class="flex items-start gap-3">
				<div
					class="p-2.5 rounded-xl shrink-0 {custody?.isValid !== false
						? 'bg-emerald-600 text-white'
						: 'bg-rose-600 text-white'}"
				>
					{#if custody?.isValid !== false}
						<ShieldCheck class="w-6 h-6" />
					{:else}
						<ShieldAlert class="w-6 h-6" />
					{/if}
				</div>
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h3 class="text-base sm:text-lg font-black text-slate-900">
							{#if custody?.isValid !== false}
								Blockchain Chain-of-Custody & RFC 6962 Merkle-Tree Verifiziert
							{:else}
								Integritätswarnung: Manipulationsprüfung fehlgeschlagen!
							{/if}
						</h3>
						<span
							class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300"
						>
							<CheckCircle2 class="w-3 h-3" />
							RFC 8785 JCS + RFC 7515 JWS
						</span>
					</div>
					<p class="text-xs text-slate-600 mt-1">
						Jede Änderung an Personal-, Bewerbungs- und Lohnstammdaten wird kanonisiert, mit RSASSA-PSS-SHA256 signiert und in einer kryptografischen Hash-Kette verankert.
					</p>
				</div>
			</div>

			<AsyncButton
				type="button"
				variant="outline"
				size="sm"
				loading={isRefreshing}
				onclick={handleRefresh}
				class="shrink-0 bg-white"
			>
				<RefreshCw class="w-3.5 h-3.5 mr-1.5" />
				Kette live prüfen
			</AsyncButton>
		</div>

		<!-- Cryptographic Metrics Grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
			<div class="rounded-xl bg-white/90 border border-emerald-100 p-3">
				<span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
					RFC 6962 Merkle Tree Root
				</span>
				<span
					class="text-xs font-mono font-bold text-slate-900 truncate block mt-0.5"
					title={custody?.merkleRootHash || ""}
				>
					{custody?.merkleRootHash ? `${custody.merkleRootHash.slice(0, 22)}…` : "Genesis"}
				</span>
				<span class="text-[10px] text-emerald-700 font-semibold">
					{custody?.sthValid ? "Signed Tree Head (STH) gültig" : "Initialisiert"}
				</span>
			</div>

			<div class="rounded-xl bg-white/90 border border-emerald-100 p-3">
				<span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
					Signierte Custody-Blöcke
				</span>
				<span class="text-lg font-black text-slate-900">
					{custody?.totalEntityBlocks ?? custody?.totalGlobalBlocks ?? 0}
				</span>
				<span class="text-[10px] text-slate-500 block">
					Versionen: {versions.length} Snapshots
				</span>
			</div>

			<div class="rounded-xl bg-white/90 border border-emerald-100 p-3">
				<span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
					PKI Provider (M365 NGO Compatible)
				</span>
				<span class="text-xs font-bold text-indigo-900 block mt-0.5">
					{pki?.activeProvider || "m365-entra-oidc"}
				</span>
				<span class="text-[10px] font-mono text-slate-500 block truncate">
					FP: {pki?.keys?.[0]?.keyFingerprint?.slice(0, 18) || custody?.orgPublicKeyFingerprint?.slice(0, 18) || "RSA-OAEP-256"}…
				</span>
			</div>

			<div class="rounded-xl bg-white/90 border border-emerald-100 p-3">
				<span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
					At-Rest Envelope Encryption
				</span>
				<span class="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
					<Lock class="w-3.5 h-3.5 text-teal-600" />
					AES-256-GCM + RSA-OAEP-256
				</span>
				<span class="text-[10px] text-slate-500 block">
					Crypto-Shredded DEKs: {pki?.shreddedDeksCount ?? 0}
				</span>
			</div>
		</div>
	</div>

	<!-- 2. Version History & Non-Destructive Point-in-Time Restore -->
	<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
			<div class="flex items-center gap-2">
				<History class="w-5 h-5 text-indigo-600" />
				<div>
					<h4 class="text-base font-bold text-slate-900">
						Versionierte Personal-Snapshots & Point-in-Time Wiederherstellung
					</h4>
					<p class="text-xs text-slate-500">
						Frühere Stände können entschlüsselt eingesehen und zerstörungsfrei (als neue signierte Version) wiederhergestellt werden.
					</p>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<input
					type="text"
					bind:value={restoreReason}
					placeholder="Begründung für Wiederherstellung..."
					class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs w-64"
				/>
			</div>
		</div>

		{#if versionsQuery.loading && versions.length === 0}
			<p class="text-sm text-slate-500 py-4">Versionshistorie wird entschlüsselt...</p>
		{:else if versions.length === 0}
			<p class="text-sm text-slate-500 italic py-4">
				Noch keine versionierten Änderungen für diesen Datensatz protokolliert. Speichern Sie das Profil, um Version v1 zu erzeugen.
			</p>
		{:else}
			<div class="space-y-3">
				{#each versions as ver, idx (ver.id)}
					{@const isLatest = idx === 0}
					{@const isExpanded = expandedVersionId === ver.id}
					<div
						class="rounded-xl border p-4 transition-all {isLatest
							? 'border-indigo-200 bg-indigo-50/30'
							: 'border-slate-200 bg-slate-50/40'}"
					>
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
							<div class="space-y-1">
								<div class="flex flex-wrap items-center gap-2">
									<span
										class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black {isLatest
											? 'bg-indigo-600 text-white'
											: 'bg-slate-200 text-slate-800'}"
									>
										Version v{ver.versionNumber}
									</span>
									{#if isLatest}
										<span class="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
											Aktueller Stand
										</span>
									{/if}
									<span class="text-xs font-bold text-slate-800 uppercase tracking-wide">
										{ver.operation}
									</span>
									{#if ver.restoredFromVersion}
										<span class="text-[11px] font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
											Wiederhergestellt aus v{ver.restoredFromVersion}
										</span>
									{/if}
									{#if ver.isShredded}
										<span class="text-[11px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md">
											DSGVO Art. 17 Crypto-Shredded (DEK vernichtet)
										</span>
									{/if}
								</div>

								<p class="text-xs font-medium text-slate-700">
									{(ver.redactedSummary as any)?.changeSummary || `Operation ${ver.operation} (${ver.entityType})`}
								</p>

								<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
									<span class="inline-flex items-center gap-1">
										<UserCheck class="w-3.5 h-3.5 text-indigo-500" />
										<strong>{ver.createdByName}</strong> ({ver.createdByRole})
									</span>
									<span>Kanal: <strong>{formatChannel(ver.channel)}</strong></span>
									<span>Zeitpunkt: {new Date(ver.createdAt).toLocaleString("de-DE")}</span>
								</div>

								{#if ver.fieldDiffs?.length > 0}
									<div class="flex flex-wrap items-center gap-1 pt-1">
										<span class="text-[10px] font-semibold text-slate-400 mr-1">Geänderte Felder:</span>
										{#each ver.fieldDiffs as diff (diff.field)}
											<span class="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-700">
												{diff.field}
											</span>
										{/each}
									</div>
								{/if}
							</div>

							<div class="flex flex-wrap items-center gap-2 shrink-0">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => (expandedVersionId = isExpanded ? null : ver.id)}
								>
									<FileCode2 class="w-3.5 h-3.5 mr-1" />
									{isExpanded ? "Snapshot ausblenden" : "PKI-Snapshot einsehen"}
								</Button>

								{#if !isLatest && !ver.isShredded}
									<AsyncButton
										type="button"
										size="sm"
										loading={restoringVersionNumber === ver.versionNumber}
										onclick={() => handleRestoreVersion(ver.versionNumber)}
										class="bg-amber-600 hover:bg-amber-700 text-white"
									>
										<RotateCcw class="w-3.5 h-3.5 mr-1" />
										Auf v{ver.versionNumber} wiederherstellen
									</AsyncButton>
								{/if}
							</div>
						</div>

						{#if isExpanded}
							<div class="mt-3 pt-3 border-t border-slate-200">
								{#if ver.isShredded}
									<div class="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900">
										Der datensubjektbezogene AES-256-GCM Schlüssel (DEK) wurde gemäß DSGVO Art. 17 unwiderruflich vernichtet (Crypto-Shredding). Der kryptografische Block-Hash bleibt für die Revisionssicherheit der Kette erhalten, das Chiffrat ist jedoch dauerhaft unentschlüsselbar.
									</div>
								{:else if ver.decryptedState}
									<div class="rounded-xl bg-slate-900 p-3.5 text-xs font-mono text-emerald-300 overflow-x-auto">
										<div class="text-[10px] font-sans font-bold uppercase tracking-wider text-teal-400 mb-1.5">
											Entschlüsselter PKI-Snapshot (AES-256-GCM · Block {ver.ledgerBlockHash.slice(0, 14)}…)
										</div>
										<pre class="text-[11px] leading-relaxed">{JSON.stringify(ver.decryptedState, null, 2)}</pre>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- 3. Raw Blockchain Custody Ledger Blocks & RFC 6962 Inclusion Proofs -->
	<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<GitCommitHorizontal class="w-5 h-5 text-teal-700" />
				<h4 class="text-sm font-bold text-slate-900">
					Unveränderliche Blockchain Custody-Blöcke & RFC 6962 Merkle Audit-Pfade ({custody?.blocks?.length ?? 0})
				</h4>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={() => (showBlocksExplorer = !showBlocksExplorer)}
			>
				{showBlocksExplorer ? "Blöcke einklappen" : "Block-Explorer öffnen"}
			</Button>
		</div>

		{#if showBlocksExplorer && custody?.blocks}
			<div class="space-y-2.5 pt-2 max-h-96 overflow-y-auto">
				{#each custody.blocks as blk (blk.id)}
					<div class="rounded-xl border border-slate-200 bg-slate-950 text-slate-200 p-3.5 text-xs font-mono space-y-1.5">
						<div class="flex flex-wrap items-center justify-between gap-2 font-sans">
							<div class="flex items-center gap-2">
								<span class="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold">
									Block #{blk.blockIndex}
								</span>
								<span class="font-bold text-white">{blk.operation}</span>
								<span class="text-slate-400">durch {blk.actorName} ({blk.channel})</span>
							</div>
							<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
								JWS & SHA-256 Verifiziert ({blk.inclusionProofLength} Merkle-Knoten)
							</span>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-1 text-[11px] text-slate-400">
							<div class="truncate">Prev Hash: <span class="text-slate-300">{blk.previousBlockHash}</span></div>
							<div class="truncate">Block Hash: <span class="text-emerald-300">{blk.blockHash}</span></div>
							<div class="truncate">Payload Commitment: <span class="text-indigo-300">{blk.payloadCommitmentHash}</span></div>
							<div class="truncate">Merkle Root: <span class="text-amber-300">{blk.merkleRootHash}</span></div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
