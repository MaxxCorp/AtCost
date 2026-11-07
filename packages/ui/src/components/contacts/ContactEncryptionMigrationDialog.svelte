<script lang="ts">
	import * as Dialog from "../dialog/index.js";
	import { Button } from "../button/index.js";
	import { toast } from "svelte-sonner";
	import { ShieldCheck, ShieldAlert, Loader2, AlertTriangle, Lock } from "@lucide/svelte";
	import type { ContactEncryptionStatus } from "@ac/validations";

	interface Props {
		open?: boolean;
		statusData: ContactEncryptionStatus;
		startMigrationRemote: () => Promise<{ operationId: string; total: number; done: boolean }>;
		processBatchRemote: (args: { operationId: string; batchSize?: number }) => Promise<{
			processed: number;
			total: number;
			done: boolean;
			errors: string[];
		}>;
		oncomplete?: () => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		statusData,
		startMigrationRemote,
		processBatchRemote,
		oncomplete,
		onclose,
	}: Props = $props();

	let isRunning = $state(false);
	let isCompleted = $state(false);
	let operationId = $state<string | null>(null);
	let processed = $state(0);
	let totalOverride = $state<number | null>(null);
	const total = $derived(totalOverride ?? (statusData?.unencryptedCount || 0));
	let errors = $state<string[]>([]);

	const percentage = $derived(total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0);

	async function runMigration() {
		isRunning = true;
		errors = [];

		try {
			if (!operationId) {
				const startRes = await startMigrationRemote();
				if (startRes.done) {
					isCompleted = true;
					isRunning = false;
					toast.success("Alle Kontaktdaten sind bereits verschlüsselt!");
					if (oncomplete) oncomplete();
					return;
				}
				operationId = startRes.operationId;
				totalOverride = startRes.total;
				processed = 0;
			}

			let done = false;
			while (!done && isRunning) {
				const batchRes = await processBatchRemote({
					operationId: operationId!,
					batchSize: 25,
				});

				processed = batchRes.processed;
				if (batchRes.total) totalOverride = batchRes.total;
				done = batchRes.done;

				if (batchRes.errors && batchRes.errors.length > 0) {
					errors = [...errors, ...batchRes.errors];
				}
			}

			if (done) {
				isCompleted = true;
				isRunning = false;
				toast.success("Kontaktdaten-Verschlüsselung erfolgreich abgeschlossen!");
				if (oncomplete) oncomplete();
			}
		} catch (e: any) {
			console.error("[ContactEncryptionMigration] Error:", e);
			toast.error(e?.message || "Fehler bei der Kontaktdaten-Verschlüsselung");
			isRunning = false;
		}
	}

	function handleClose() {
		if (isRunning) {
			isRunning = false;
		}
		open = false;
		if (onclose) onclose();
	}
</script>

<Dialog.Root bind:open onOpenChange={(val) => { if (!val) handleClose(); }}>
	<Dialog.Content class="sm:max-w-[540px]">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-xl font-bold">
				<Lock class="w-5 h-5 text-indigo-600" />
				Kontakt-Verschlüsselung (PKI Envelope)
			</Dialog.Title>
			<Dialog.Description class="text-sm text-gray-500 mt-1">
				Migrieren Sie unverschlüsselte Kontaktdaten auf das AES-256-GCM Envelope-Verfahren mit O365 Entra-ID PKI-Absicherung und HMAC-SHA256 Blind-Indexing.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<!-- Summary of items to migrate -->
			<div class="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-sm">
				<div class="font-semibold text-gray-800">Status der Kontaktdatenbank:</div>
				<div class="grid grid-cols-2 gap-2 text-xs">
					<div class="bg-white p-2.5 rounded-lg border border-gray-200">
						<span class="text-gray-500 block">Gesamte Kontakte</span>
						<strong class="text-gray-900 text-sm">{statusData?.totalContacts ?? 0}</strong>
					</div>
					<div class="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
						<span class="text-amber-700 block">Zu verschlüsseln</span>
						<strong class="text-amber-900 text-sm">{statusData?.unencryptedCount ?? 0}</strong>
					</div>
				</div>
				<p class="text-[11px] text-gray-500 pt-1 leading-relaxed">
					Jeder Kontakt erhält einen individuellen AES-256 Daten-Verschlüsselungsschlüssel (DEK), mehrfach geschützt über den Org-Master- und HR-Role-Key. Anschrift, Telefon, E-Mail und Notizen werden at-rest verschlüsselt.
				</p>
			</div>

			<!-- Progress Bar -->
			{#if isRunning || processed > 0 || isCompleted}
				<div class="space-y-2">
					<div class="flex justify-between text-xs font-semibold text-gray-700">
						<span>Fortschritt: {processed} / {total} Kontakte</span>
						<span>{percentage}%</span>
					</div>
					<div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
						<div
							class="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
							style="width: {percentage}%"
						></div>
					</div>
				</div>
			{/if}

			{#if isCompleted}
				<div class="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm flex items-center gap-2 border border-emerald-200">
					<ShieldCheck class="w-5 h-5 shrink-0 text-emerald-600" />
					<span>Alle Kontaktdatensätze wurden erfolgreich verschlüsselt und im Ledger verankert!</span>
				</div>
			{/if}

			{#if errors.length > 0}
				<div class="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs space-y-1 max-h-32 overflow-y-auto border border-amber-200">
					<div class="flex items-center gap-1 font-semibold">
						<AlertTriangle class="w-4 h-4 text-amber-600" />
						<span>Warnungen ({errors.length}):</span>
					</div>
					{#each errors.slice(0, 5) as err}
						<p class="truncate">{err}</p>
					{/each}
				</div>
			{/if}
		</div>

		<Dialog.Footer class="flex justify-end gap-2">
			{#if !isCompleted}
				<Button variant="outline" onclick={handleClose} disabled={isRunning}>
					Abbrechen
				</Button>
				<Button onclick={runMigration} disabled={isRunning} class="gap-2">
					{#if isRunning}
						<Loader2 class="w-4 h-4 animate-spin" />
						Verschlüssle...
					{:else if processed > 0}
						Migration fortsetzen
					{:else}
						Verschlüsselung starten
					{/if}
				</Button>
			{:else}
				<Button onclick={handleClose}>
					Schließen
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

