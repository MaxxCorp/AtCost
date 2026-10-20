<script lang="ts">
	import type { Snippet } from "svelte";
	import { Trash2, X, CheckSquare, LoaderCircle } from "@lucide/svelte";
	import { fly } from "svelte/transition";

	interface Props {
		selectedCount?: number;
		selectedIds?: string[] | Set<string> | any;
		totalCount: number;
		onSelectAll: () => void;
		onDeselectAll: () => void;
		onDelete?: () => Promise<void> | void;
		deleteLabel?: string;
		deleteConfirmMessage?: string;
		extraInfo?: string;
		selectedText?: string;
		selectAllLabel?: string;
		deselectAllLabel?: string;
		actions?: Snippet;
		class?: string;
	}

	let {
		selectedCount = undefined,
		selectedIds = undefined,
		totalCount,
		onSelectAll,
		onDeselectAll,
		onDelete,
		deleteLabel = "Delete",
		deleteConfirmMessage,
		extraInfo = undefined,
		selectedText = undefined,
		selectAllLabel = undefined,
		deselectAllLabel = undefined,
		actions = undefined,
		class: className = "",
	}: Props = $props();

	let bulkDeleting = $state(false);

	const count = $derived(
		selectedIds
			? (Array.isArray(selectedIds) ? selectedIds.length : (selectedIds as any).size ?? 0)
			: (selectedCount ?? 0)
	);

	const allSelected = $derived(
		count > 0 && count === totalCount,
	);

	async function handleBulkDelete() {
		if (deleteConfirmMessage) {
			if (!window.confirm(deleteConfirmMessage)) return;
		}
		if (!onDelete) return;
		bulkDeleting = true;
		try {
			await onDelete();
		} finally {
			bulkDeleting = false;
		}
	}
</script>

{#if count > 0}
	<div class="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 z-50 flex justify-center pointer-events-none px-4">
		<aside
			aria-label="Bulk actions"
			transition:fly={{ y: 24, duration: 200 }}
			class="pointer-events-auto flex items-center gap-2 sm:gap-3 p-2 sm:px-4 sm:py-2.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/90 dark:border-gray-700/90 shadow-2xl rounded-2xl text-sm max-w-[calc(100vw-2rem)] sm:max-w-fit overflow-x-auto {className}"
		>
		<!-- Count badge -->
		<div class="flex items-center gap-2 shrink-0">
			<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary-100 text-primary-800 dark:bg-primary-950/80 dark:text-primary-300 border border-primary-200/60 dark:border-primary-800/60 shadow-2xs">
				<CheckSquare size={13} class="text-primary-600 dark:text-primary-400" />
				<span>{count} {selectedText ?? "selected"}</span>
			</span>
			{#if extraInfo}
				<span class="text-xs text-gray-500 dark:text-gray-400 font-medium hidden md:inline">
					{extraInfo}
				</span>
			{/if}
		</div>

		<div class="h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0"></div>

		<!-- Select/Deselect All Toggle -->
		<button
			type="button"
			class="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 cursor-pointer"
			onclick={allSelected ? onDeselectAll : onSelectAll}
		>
			{allSelected
				? (deselectAllLabel ?? "Deselect All")
				: (selectAllLabel ?? `Select All (${totalCount})`)}
		</button>

		<!-- Custom actions (e.g. status change) -->
		{#if actions}
			<div class="h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0"></div>
			<div class="flex items-center gap-1.5 shrink-0">
				{@render actions()}
			</div>
		{/if}

		<!-- Delete Action -->
		{#if onDelete}
			<div class="h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0"></div>
			<button
				type="button"
				onclick={handleBulkDelete}
				disabled={bulkDeleting}
				class="inline-flex items-center justify-center h-8 px-3 rounded-xl gap-1.5 text-xs font-bold shadow-xs shrink-0 cursor-pointer bg-red-600 hover:bg-red-700 active:bg-red-800 text-white disabled:opacity-50 disabled:pointer-events-none transition-colors"
			>
				{#if bulkDeleting}
					<LoaderCircle size={13} class="animate-spin" />
					<span>Deleting...</span>
				{:else}
					<Trash2 size={13} />
					<span>{deleteLabel} ({count})</span>
				{/if}
			</button>
		{/if}

		<!-- Close/Cancel Selection Button -->
		<button
			type="button"
			class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 cursor-pointer ml-1"
			onclick={onDeselectAll}
			title={deselectAllLabel ?? "Clear selection"}
		>
			<X size={15} />
		</button>
		</aside>
	</div>
{/if}
