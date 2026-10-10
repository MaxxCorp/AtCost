<script lang="ts">
	import { untrack } from "svelte";
	import type { FilterGroup, FilterStateMap, BooleanFilter } from "./EntityManager.types";
	import { X, Plus, Minus, Filter, Check, Loader2, Trash2 } from "@lucide/svelte";
	import {
		getCachedOptionLabel,
		loadOptionsForGroup,
		registerGroupOptions,
		isGroupLoading,
		isUuid,
		normalizeOption,
	} from "../utils/filterOptionsCache.svelte";

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

	// Automatically load options for any active filter group backed by remote functions
	$effect(() => {
		const currentFilters = filters;
		const currentGroups = groups;

		untrack(() => {
			for (const [groupId, state] of Object.entries(currentFilters)) {
				if (!state) continue;
				const hasActive =
					(state.include && state.include.length > 0) ||
					(state.exclude && state.exclude.length > 0);
				if (!hasActive) continue;

				const group = currentGroups.find((g) => g.id === groupId);
				if (!group) continue;

				// Register static options if provided
				if (group.options && Array.isArray(group.options)) {
					const items = group.options.map((opt: any) => normalizeOption(opt, group));
					registerGroupOptions(group.id, items);
				}

				// If remote options present, check if any active ID is missing from cache
				if (group.optionsRemote || group.listRemote) {
					const activeIds = [...(state.include || []), ...(state.exclude || [])];
					const needsFetch = activeIds.some((id) => !getCachedOptionLabel(groupId, id));
					if (needsFetch) {
						loadOptionsForGroup(group);
					}
				}
			}
		});
	});

	function resolveOption(groupId: string, optionId: string): { label: string; isLoading: boolean } {
		if (getOptionName) {
			const custom = getOptionName(groupId, optionId);
			if (custom) return { label: custom, isLoading: false };
		}

		// Check shared reactive cache
		const cached = getCachedOptionLabel(groupId, optionId);
		if (cached) {
			return { label: cached, isLoading: false };
		}

		// Check static options on the group
		const group = groups.find((g) => g.id === groupId);
		if (group?.options) {
			const opt = group.options.find(
				(o: any) => (o.id ?? o.value ?? o.name) === optionId,
			);
			if (opt) {
				const normalized = normalizeOption(opt, group);
				return { label: normalized.label, isLoading: false };
			}
		}

		// Check if group is currently loading
		const loading = isGroupLoading(groupId);
		if (loading) {
			return { label: "Loading...", isLoading: true };
		}

		// If it's a UUID and wasn't found, format it cleanly rather than raw UUID
		if (isUuid(optionId)) {
			return { label: `#${optionId.slice(0, 6)}...`, isLoading: false };
		}

		return { label: optionId, isLoading: false };
	}

	function resolveGroup(groupId: string): FilterGroup | undefined {
		return groups.find((g) => g.id === groupId);
	}

	const activeChips = $derived.by(() => {
		const chips: Array<{
			groupId: string;
			groupLabel: string;
			groupIcon?: any;
			optionId: string;
			optionLabel: string;
			isLoading: boolean;
			type: "include" | "exclude";
		}> = [];

		for (const [groupId, state] of Object.entries(filters)) {
			if (!state) continue;
			const group = resolveGroup(groupId);
			const groupLabel = group?.label ?? groupId;
			const groupIcon = group?.icon;

			for (const incId of state.include || []) {
				const { label, isLoading } = resolveOption(groupId, incId);
				chips.push({
					groupId,
					groupLabel,
					groupIcon,
					optionId: incId,
					optionLabel: label,
					isLoading,
					type: "include",
				});
			}
			for (const excId of state.exclude || []) {
				const { label, isLoading } = resolveOption(groupId, excId);
				chips.push({
					groupId,
					groupLabel,
					groupIcon,
					optionId: excId,
					optionLabel: label,
					isLoading,
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
		class="flex flex-wrap items-center gap-2 py-1.5 px-0.5 animate-in fade-in duration-200"
	>
		<div class="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 select-none mr-1">
			<Filter size={13} class="text-gray-400 dark:text-gray-500" />
			<span>{activeFiltersLabel}</span>
		</div>

		{#each activeChips as chip (chip.groupId + '-' + chip.type + '-' + chip.optionId)}
			{#if chip.type === "include"}
				<span
					class="group inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-medium bg-emerald-50/90 text-emerald-900 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60 shadow-xs hover:shadow-sm hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
					title="{chip.groupLabel}: {chip.optionLabel}"
				>
					{#if chip.isLoading}
						<Loader2 size={11} class="animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
					{:else}
						<span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-200/80 text-emerald-800 dark:bg-emerald-800/80 dark:text-emerald-200 text-[10px] font-black shrink-0">
							<Plus size={10} strokeWidth={3} />
						</span>
					{/if}

					{#if chip.groupIcon}
						{@const GroupIcon = chip.groupIcon}
						<GroupIcon size={12} class="text-emerald-700 dark:text-emerald-400 shrink-0" />
					{/if}

					<span class="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] select-none">
						{chip.groupLabel}:
					</span>

					<span class="font-bold text-emerald-950 dark:text-emerald-100 truncate max-w-[200px]">
						{chip.optionLabel}
					</span>

					<button
						type="button"
						class="ml-0.5 p-0.5 rounded-full hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80 text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
						onclick={() => onremove?.(chip.groupId, chip.optionId, "include")}
						title={removeFilterTooltip}
						aria-label="{removeFilterTooltip}: {chip.optionLabel}"
					>
						<X size={12} strokeWidth={2.5} />
					</button>
				</span>
			{:else}
				<span
					class="group inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-medium bg-rose-50/90 text-rose-900 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/60 shadow-xs hover:shadow-sm hover:border-rose-300 dark:hover:border-rose-700 transition-all"
					title="Excluded - {chip.groupLabel}: {chip.optionLabel}"
				>
					{#if chip.isLoading}
						<Loader2 size={11} class="animate-spin text-rose-600 dark:text-rose-400 shrink-0" />
					{:else}
						<span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-200/80 text-rose-800 dark:bg-rose-800/80 dark:text-rose-200 text-[10px] font-black shrink-0">
							<Minus size={10} strokeWidth={3} />
						</span>
					{/if}

					{#if chip.groupIcon}
						{@const GroupIcon = chip.groupIcon}
						<GroupIcon size={12} class="text-rose-700 dark:text-rose-400 shrink-0" />
					{/if}

					<span class="text-rose-700 dark:text-rose-400 font-semibold text-[11px] select-none">
						{chip.groupLabel}:
					</span>

					<span class="font-bold text-rose-950 dark:text-rose-100 truncate max-w-[200px] flex items-center gap-1">
						<span class="text-[10px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-rose-200/70 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300">not</span>
						<span>{chip.optionLabel}</span>
					</span>

					<button
						type="button"
						class="ml-0.5 p-0.5 rounded-full hover:bg-rose-200/80 dark:hover:bg-rose-800/80 text-rose-700 dark:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
						onclick={() => onremove?.(chip.groupId, chip.optionId, "exclude")}
						title={removeExclusionTooltip}
						aria-label="{removeExclusionTooltip}: {chip.optionLabel}"
					>
						<X size={12} strokeWidth={2.5} />
					</button>
				</span>
			{/if}
		{/each}

		{#each activeBooleanFilters as bf (bf.id)}
			<span
				class="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-indigo-50/90 text-indigo-900 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800/60 shadow-xs hover:shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
				title={bf.label}
			>
				<span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-200/80 text-indigo-800 dark:bg-indigo-800/80 dark:text-indigo-200 text-[10px] font-black shrink-0">
					<Check size={10} strokeWidth={3} />
				</span>
				<span class="font-bold text-indigo-950 dark:text-indigo-100 truncate max-w-[220px]">
					{bf.label}
				</span>
				<button
					type="button"
					class="ml-0.5 p-0.5 rounded-full hover:bg-indigo-200/80 dark:hover:bg-indigo-800/80 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
					onclick={() => {
						bf.onchange(false);
						onremoveboolean?.(bf.id);
					}}
					title={turnOffFilterTooltip}
					aria-label="{turnOffFilterTooltip}: {bf.label}"
				>
					<X size={12} strokeWidth={2.5} />
				</button>
			</span>
		{/each}

		{#if onclearall}
			<button
				type="button"
				class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-full border border-transparent hover:border-red-200 dark:hover:border-red-900/60 transition-all focus:outline-none focus:ring-2 focus:ring-red-400"
				onclick={onclearall}
				title={clearAllLabel}
			>
				<Trash2 size={12} />
				<span>{clearAllLabel}</span>
				<span class="px-1.5 py-0.2 rounded-full text-[10px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-extrabold">
					{totalActiveCount}
				</span>
			</button>
		{/if}
	</div>
{/if}
