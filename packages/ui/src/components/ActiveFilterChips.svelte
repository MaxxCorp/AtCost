<script lang="ts">
	import type { FilterGroup, FilterStateMap, BooleanFilter } from "./EntityManager.types";
	import { X, Plus, Minus } from "@lucide/svelte";

	interface Props {
		groups?: FilterGroup[];
		filters?: FilterStateMap;
		booleanFilters?: BooleanFilter[];
		getOptionName?: (groupId: string, optionId: string) => string | undefined;
		activeFiltersLabel?: string;
		clearAllLabel?: string;
		removeFilterTooltip?: string;
		removeExclusionTooltip?: string;
		turnOffFilterTooltip?: string;
		onremove?: (groupId: string, optionId: string, type: "include" | "exclude") => void;
		onremoveboolean?: (filterId: string) => void;
		onclearall?: () => void;
	}

	let {
		groups = [],
		filters = {},
		booleanFilters = [],
		getOptionName,
		activeFiltersLabel = "Active Filters:",
		clearAllLabel = "Clear all",
		removeFilterTooltip = "Remove filter",
		removeExclusionTooltip = "Remove exclusion",
		turnOffFilterTooltip = "Turn off filter",
		onremove,
		onremoveboolean,
		onclearall,
	}: Props = $props();

	function resolveOptionLabel(groupId: string, optionId: string): string {
		if (getOptionName) {
			const custom = getOptionName(groupId, optionId);
			if (custom) return custom;
		}
		const group = groups.find((g) => g.id === groupId);
		if (group?.options) {
			const opt = group.options.find(
				(o: any) => (o.id ?? o.value ?? o.name) === optionId,
			);
			if (opt) {
				return opt.label ?? opt.name ?? opt.title ?? opt.value ?? optionId;
			}
		}
		return optionId;
	}

	function resolveGroupLabel(groupId: string): string {
		const group = groups.find((g) => g.id === groupId);
		return group?.label ?? groupId;
	}

	const activeChips = $derived.by(() => {
		const chips: Array<{
			groupId: string;
			groupLabel: string;
			optionId: string;
			optionLabel: string;
			type: "include" | "exclude";
		}> = [];

		for (const [groupId, state] of Object.entries(filters)) {
			if (!state) continue;
			const groupLabel = resolveGroupLabel(groupId);
			for (const incId of state.include || []) {
				chips.push({
					groupId,
					groupLabel,
					optionId: incId,
					optionLabel: resolveOptionLabel(groupId, incId),
					type: "include",
				});
			}
			for (const excId of state.exclude || []) {
				chips.push({
					groupId,
					groupLabel,
					optionId: excId,
					optionLabel: resolveOptionLabel(groupId, excId),
					type: "exclude",
				});
			}
		}

		return chips;
	});

	const activeBooleanFilters = $derived(
		booleanFilters.filter((bf) => bf.checked),
	);

	const totalActiveCount = $derived(activeChips.length + activeBooleanFilters.length);
</script>

{#if totalActiveCount > 0}
	<div
		class="flex flex-wrap items-center gap-1.5 py-1 animate-in fade-in duration-200"
	>
		<span class="text-xs font-semibold text-gray-400 dark:text-gray-500 mr-1 select-none">
			{activeFiltersLabel}
		</span>

		{#each activeChips as chip (chip.groupId + '-' + chip.type + '-' + chip.optionId)}
			{#if chip.type === "include"}
				<span
					class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 shadow-sm transition-all"
				>
					<span class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200 text-[10px] font-black">
						<Plus size={10} strokeWidth={3} />
					</span>
					<span class="text-emerald-600 dark:text-emerald-400 font-medium">{chip.groupLabel}:</span>
					<span class="font-bold truncate max-w-[150px]">{chip.optionLabel}</span>
					<button
						type="button"
						class="ml-0.5 p-0.5 rounded hover:bg-emerald-200/60 dark:hover:bg-emerald-800/60 text-emerald-700 dark:text-emerald-300 focus:outline-none transition-colors"
						onclick={() => onremove?.(chip.groupId, chip.optionId, "include")}
						title={removeFilterTooltip}
					>
						<X size={12} strokeWidth={2.5} />
					</button>
				</span>
			{:else}
				<span
					class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 shadow-sm transition-all"
				>
					<span class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-200 text-[10px] font-black">
						<Minus size={10} strokeWidth={3} />
					</span>
					<span class="text-rose-600 dark:text-rose-400 font-medium">{chip.groupLabel}:</span>
					<span class="font-bold line-through decoration-rose-400 truncate max-w-[150px]">{chip.optionLabel}</span>
					<button
						type="button"
						class="ml-0.5 p-0.5 rounded hover:bg-rose-200/60 dark:hover:bg-rose-800/60 text-rose-700 dark:text-rose-300 focus:outline-none transition-colors"
						onclick={() => onremove?.(chip.groupId, chip.optionId, "exclude")}
						title={removeExclusionTooltip}
					>
						<X size={12} strokeWidth={2.5} />
					</button>
				</span>
			{/if}
		{/each}

		{#each activeBooleanFilters as bf (bf.id)}
			<span
				class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 shadow-sm transition-all"
			>
				<span class="font-bold truncate max-w-[180px]">{bf.label}</span>
				<button
					type="button"
					class="ml-0.5 p-0.5 rounded hover:bg-blue-200/60 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-300 focus:outline-none transition-colors"
					onclick={() => {
						bf.onchange(false);
						onremoveboolean?.(bf.id);
					}}
					title={turnOffFilterTooltip}
				>
					<X size={12} strokeWidth={2.5} />
				</button>
			</span>
		{/each}

		{#if onclearall}
			<button
				type="button"
				class="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
				onclick={onclearall}
			>
				<X size={12} />
				{clearAllLabel}
			</button>
		{/if}
	</div>
{/if}
