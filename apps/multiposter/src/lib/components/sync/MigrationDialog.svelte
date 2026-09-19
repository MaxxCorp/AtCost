<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog";
	import Button from "$lib/components/ui/button/button.svelte";
	import { startMigration, processMigrationBatch } from "../../../routes/synchronizations/migration.remote";
	import { toast } from "svelte-sonner";
	import { Database, CheckCircle2, AlertTriangle, Loader2 } from "@lucide/svelte";

	let {
		open = $bindable(false),
		statusData,
		oncomplete,
		onclose
	}: {
		open: boolean;
		statusData: {
			totalItems: number;
			counts: {
				syncMappings: number;
				emailCampaigns: number;
				unlinkedInstances: number;
				legacyCampaigns: number;
			};
		};
		oncomplete: () => void;
		onclose: () => void;
	} = $props();

	let isRunning = $state(false);
	let isCompleted = $state(false);
	let operationId = $state<string | null>(null);
	let processed = $state(0);
	let totalOverride = $state<number | null>(null);
	const total = $derived(totalOverride ?? (statusData?.totalItems || 0));
	let errors = $state<any[]>([]);

	const percentage = $derived(total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0);

	async function runMigration() {
		isRunning = true;
		errors = [];

		try {
			if (!operationId) {
				const startRes = await startMigration();
				if (startRes.done) {
					isCompleted = true;
					isRunning = false;
					oncomplete();
					return;
				}
				operationId = startRes.operationId;
				totalOverride = startRes.total;
				processed = 0;
			}

			let done = false;
			while (!done && isRunning) {
				const batchRes = await processMigrationBatch({
					operationId: operationId!,
					batchSize: 25
				});

				processed = batchRes.processed;
				totalOverride = batchRes.total;
				done = batchRes.done;

				if (batchRes.errors && batchRes.errors.length > 0) {
					errors = [...errors, ...batchRes.errors];
				}
			}

			if (done) {
				isCompleted = true;
				isRunning = false;
				toast.success("Migration completed successfully!");
				oncomplete();
			}
		} catch (e: any) {
			console.error("Migration error:", e);
			toast.error(e?.message || "Migration encountered an error");
			isRunning = false;
		}
	}

	function handleClose() {
		if (isRunning) {
			isRunning = false; // pauses loop
		}
		open = false;
		onclose();
	}
</script>

<Dialog.Root bind:open onOpenChange={(val) => { if (!val) handleClose(); }}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-xl font-bold">
				<Database class="w-5 h-5 text-blue-600" />
				Standardize Syncs to Campaigns
			</Dialog.Title>
			<Dialog.Description class="text-sm text-gray-500 mt-1">
				Migrate legacy synchronization mappings and email records into the unified campaign architecture.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<!-- Summary of items to migrate -->
			<div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2 text-sm">
				<div class="font-medium text-gray-700 dark:text-gray-300">Records to Migrate:</div>
				<ul class="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
					<li>Sync Mappings: <strong class="text-gray-900 dark:text-gray-100">{statusData?.counts?.syncMappings ?? 0}</strong></li>
					<li>Email Campaigns: <strong class="text-gray-900 dark:text-gray-100">{statusData?.counts?.emailCampaigns ?? 0}</strong></li>
					<li>Legacy Campaigns: <strong class="text-gray-900 dark:text-gray-100">{statusData?.counts?.legacyCampaigns ?? 0}</strong></li>
					<li>Unlinked Series Instances: <strong class="text-gray-900 dark:text-gray-100">{statusData?.counts?.unlinkedInstances ?? 0}</strong></li>
				</ul>
			</div>

			<!-- Progress Bar -->
			{#if isRunning || processed > 0 || isCompleted}
				<div class="space-y-2">
					<div class="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-400">
						<span>Progress: {processed} / {total} items</span>
						<span>{percentage}%</span>
					</div>
					<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
						<div
							class="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
							style="width: {percentage}%"
						></div>
					</div>
				</div>
			{/if}

			{#if isCompleted}
				<div class="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm flex items-center gap-2">
					<CheckCircle2 class="w-5 h-5 flex-shrink-0" />
					<span>All legacy data has been successfully migrated and cleaned up!</span>
				</div>
			{/if}

			{#if errors.length > 0}
				<div class="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg text-xs space-y-1 max-h-32 overflow-y-auto">
					<div class="flex items-center gap-1 font-semibold">
						<AlertTriangle class="w-4 h-4" />
						<span>Warnings ({errors.length}):</span>
					</div>
					{#each errors.slice(0, 5) as err}
						<p class="truncate">{err.error || JSON.stringify(err)}</p>
					{/each}
				</div>
			{/if}
		</div>

		<Dialog.Footer class="flex justify-end gap-2">
			{#if !isCompleted}
				<Button variant="outline" onclick={handleClose} disabled={isRunning}>
					Cancel
				</Button>
				<Button onclick={runMigration} disabled={isRunning} class="gap-2">
					{#if isRunning}
						<Loader2 class="w-4 h-4 animate-spin" />
						Migrating...
					{:else if processed > 0}
						Resume Migration
					{:else}
						Start Migration
					{/if}
				</Button>
			{:else}
				<Button onclick={handleClose}>
					Done
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
