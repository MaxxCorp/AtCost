<script lang="ts">
	import { untrack } from "svelte";
	import type { FilterGroup, FilterStateMap, BooleanFilter, RadioFilterGroup, DateFilter, DateFilterValue } from "./EntityManager.types";
	import type { Snippet } from "svelte";
	import { normalizeOption, registerGroupOptions } from "../utils/filterOptionsCache.svelte";
	import {
		isDateFilterActive,
		formatDateFilterSummary,
		getTodayDateFilterValue,
		getThisWeekDateFilterValue,
		getThisMonthDateFilterValue,
	} from "../utils/dateFilter";
	import * as DropdownMenu from "./dropdown-menu";
	import Button from "./button/button.svelte";
	import {
		Filter as FilterIcon,
		Plus,
		Minus,
		X,
		Search,
		Loader2,
		Check,
		Ban,
		ChevronDown,
		CalendarDays,
	} from "@lucide/svelte";

	interface Props {
		groups?: FilterGroup[];
		filters?: FilterStateMap;
		booleanFilters?: BooleanFilter[];
		radioGroups?: RadioFilterGroup[];
		dateFilters?: DateFilter[];
		children?: Snippet;
		buttonLabel?: string;
		buttonVariant?: "outline" | "ghost" | "secondary" | "default";
		buttonClass?: string;
		align?: "start" | "end" | "center";
		systemFiltersLabel?: string;
		filterCriteriaLabel?: string;
		searchPlaceholder?: (groupLabel: string) => string;
		cycleStateHelp?: string;
		includeHelp?: string;
		excludeHelp?: string;
		includeTooltip?: string;
		excludeTooltip?: string;
		loadingText?: (groupLabel: string) => string;
		noOptionsText?: (groupLabel: string) => string;
		clearGroupText?: (groupLabel: string) => string;
		clearAllText?: (count: number) => string;
		onfilterchange?: (filters: FilterStateMap) => void;
		onchange?: (filters?: FilterStateMap) => void;
		onclear?: () => void;
	}

	let {
		groups = [],
		filters = $bindable({}),
		booleanFilters = [],
		radioGroups = [],
		dateFilters = [],
		children,
		buttonLabel = "Filters",
		buttonVariant = "outline",
		buttonClass = "",
		align = "end",
		systemFiltersLabel = "System Filters",
		filterCriteriaLabel = "Filter Criteria",
		searchPlaceholder = (label: string) => `Filter ${label.toLowerCase()}...`,
		cycleStateHelp = "Click: Cycle state",
		includeHelp = "+ Include",
		excludeHelp = "− Exclude",
		includeTooltip = "Include",
		excludeTooltip = "Exclude",
		loadingText = (label: string) => `Loading ${label.toLowerCase()}...`,
		noOptionsText = (label: string) => `No ${label.toLowerCase()} found`,
		clearGroupText = (label: string) => `Clear ${label}`,
		clearAllText = (count: number) => `Clear all filters (${count})`,
		onfilterchange,
		onchange,
		onclear,
	}: Props = $props();

	// Tracks which filter groups are expanded vertically
	let expandedGroups = $state<Record<string, boolean>>({});

	// Local search queries per group to filter long option lists
	let groupSearches = $state<Record<string, string>>({});

	function isGroupExpanded(groupId: string): boolean {
		if (expandedGroups[groupId] !== undefined) {
			return expandedGroups[groupId];
		}
		// Expand by default if group has active selections
		return getGroupActiveCount(groupId).total > 0;
	}

	function toggleGroup(groupId: string) {
		const currentState = isGroupExpanded(groupId);
		expandedGroups = {
			...expandedGroups,
			[groupId]: !currentState,
		};
	}

	function isDateFilterExpanded(df: DateFilter): boolean {
		const key = `date:${df.id}`;
		if (expandedGroups[key] !== undefined) {
			return expandedGroups[key];
		}
		return isDateFilterActive(df.value);
	}

	function toggleDateFilter(df: DateFilter) {
		const key = `date:${df.id}`;
		const currentState = isDateFilterExpanded(df);
		expandedGroups = {
			...expandedGroups,
			[key]: !currentState,
		};
	}

	function updateDateFilter(df: DateFilter, next: DateFilterValue) {
		if (
			next.mode === df.value.mode &&
			next.from === df.value.from &&
			next.to === df.value.to
		) {
			return;
		}
		df.onchange(next);
		onchange?.(filters);
	}

	function handleDateInput(
		df: DateFilter,
		field: "single" | "from" | "to",
		rawVal: string,
	) {
		if (rawVal !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(rawVal)) {
			return;
		}
		if (field === "single") {
			updateDateFilter(df, { mode: "single", from: rawVal, to: "" });
			return;
		}
		if (field === "from") {
			const nextTo =
				rawVal && df.value.to && rawVal > df.value.to
					? rawVal
					: df.value.to;
			updateDateFilter(df, { mode: "range", from: rawVal, to: nextTo });
			return;
		}
		const nextFrom =
			rawVal && df.value.from && rawVal < df.value.from
				? rawVal
				: df.value.from;
		updateDateFilter(df, { mode: "range", from: nextFrom, to: rawVal });
	}

	// Compute total active filters count (includes + excludes + active boolean flags + active date filters)
	const activeFiltersCount = $derived.by(() => {
		let count = 0;
		for (const state of Object.values(filters || {})) {
			if (state) {
				count += (state.include?.length || 0) + (state.exclude?.length || 0);
			}
		}
		for (const bf of booleanFilters || []) {
			if (bf.checked) count += 1;
		}
		for (const df of dateFilters || []) {
			if (isDateFilterActive(df.value)) count += 1;
		}
		return count;
	});

	function getGroupActiveCount(groupId: string): { include: number; exclude: number; total: number } {
		const state = filters[groupId];
		const inc = state?.include?.length || 0;
		const exc = state?.exclude?.length || 0;
		return { include: inc, exclude: exc, total: inc + exc };
	}

	function getOptionState(groupId: string, optionId: string): "include" | "exclude" | "neutral" {
		const state = filters[groupId];
		if (!state) return "neutral";
		if (state.include?.includes(optionId)) return "include";
		if (state.exclude?.includes(optionId)) return "exclude";
		return "neutral";
	}

	function cycleOptionState(groupId: string, optionId: string) {
		const current = getOptionState(groupId, optionId);
		if (current === "neutral") {
			setOptionState(groupId, optionId, "include");
		} else if (current === "include") {
			setOptionState(groupId, optionId, "exclude");
		} else {
			setOptionState(groupId, optionId, "neutral");
		}
	}

	function setOptionState(groupId: string, optionId: string, targetState: "include" | "exclude" | "neutral") {
		const current = filters[groupId] || { include: [], exclude: [] };
		let newInclude = [...(current.include || [])];
		let newExclude = [...(current.exclude || [])];

		// Remove from both first
		newInclude = newInclude.filter((id) => id !== optionId);
		newExclude = newExclude.filter((id) => id !== optionId);

		if (targetState === "include") {
			newInclude.push(optionId);
		} else if (targetState === "exclude") {
			newExclude.push(optionId);
		}

		filters = {
			...filters,
			[groupId]: {
				include: newInclude,
				exclude: newExclude,
			},
		};

		onfilterchange?.(filters);
		onchange?.(filters);
	}

	function clearGroup(groupId: string) {
		filters = {
			...filters,
			[groupId]: {
				include: [],
				exclude: [],
			},
		};
		onfilterchange?.(filters);
		onchange?.(filters);
	}

	function clearAll() {
		const newFilters: FilterStateMap = {};
		for (const key of Object.keys(filters || {})) {
			newFilters[key] = { include: [], exclude: [] };
		}
		filters = newFilters;
		for (const bf of booleanFilters || []) {
			bf.onchange(false);
		}
		for (const df of dateFilters || []) {
			df.onchange({ mode: df.value.mode, from: "", to: "" });
		}
		onclear?.();
		onfilterchange?.(filters);
		onchange?.(filters);
	}

	async function fetchGroupOptions(group: FilterGroup) {
		const remoteFn = group.optionsRemote || group.listRemote;
		if (!remoteFn) return [];
		let res: any;
		try {
			res = await remoteFn({ limit: 500, sortField: "name", sortOrder: "asc" });
		} catch {
			try {
				res = await remoteFn({ limit: 500 });
			} catch {
				try {
					res = await remoteFn({});
				} catch {
					res = [];
				}
			}
		}
		const raw = Array.isArray(res) ? res : (res?.data ?? []);
		const items = raw.map((item: any) => normalizeOption(item, group));
		registerGroupOptions(group.id, items);
		return items;
	}

	$effect(() => {
		const currentGroups = groups;
		untrack(() => {
			for (const g of currentGroups) {
				if (g.options && Array.isArray(g.options)) {
					const items = g.options.map((opt: any) => normalizeOption(opt, g));
					registerGroupOptions(g.id, items);
				}
			}
		});
	});
</script>

{#snippet renderOptionRow(group: FilterGroup, option: any)}
	{@const state = getOptionState(group.id, option.id)}
	<div
		class="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all {state === 'include'
			? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/80'
			: state === 'exclude'
			? 'bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200 border border-rose-200/80 dark:border-rose-800/80'
			: 'hover:bg-gray-100/80 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-300 border border-transparent'}"
		onclick={(e) => {
			e.stopPropagation();
			cycleOptionState(group.id, option.id);
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.stopPropagation();
				cycleOptionState(group.id, option.id);
			}
		}}
		tabindex="0"
		role="button"
	>
		<div class="flex items-center gap-2 min-w-0 flex-1">
			<div class="w-4 h-4 rounded-md flex items-center justify-center shrink-0 {state === 'include'
				? 'bg-emerald-600 text-white'
				: state === 'exclude'
				? 'bg-rose-600 text-white'
				: 'border border-gray-300 dark:border-gray-600 group-hover:border-gray-400'}">
				{#if state === 'include'}
					<Check size={10} strokeWidth={3} />
				{:else if state === 'exclude'}
					<Ban size={10} strokeWidth={3} />
				{/if}
			</div>
			<span class="break-all font-medium {state === 'exclude' ? 'line-through decoration-rose-400' : ''}">
				{option.label}
			</span>
		</div>

		<!-- Action Buttons -->
		<div class="flex items-center gap-1 shrink-0">
			<button
				type="button"
				class="w-6 h-6 rounded-lg flex items-center justify-center font-bold transition-colors cursor-pointer {state === 'include'
					? 'bg-emerald-600 text-white shadow-xs'
					: 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/80'}"
				onclick={(e) => {
					e.stopPropagation();
					setOptionState(group.id, option.id, state === 'include' ? 'neutral' : 'include');
				}}
				title={includeTooltip}
			>
				<Plus size={12} strokeWidth={2.5} />
			</button>
			<button
				type="button"
				class="w-6 h-6 rounded-lg flex items-center justify-center font-bold transition-colors cursor-pointer {state === 'exclude'
					? 'bg-rose-600 text-white shadow-xs'
					: 'text-gray-400 hover:text-rose-600 hover:bg-rose-100/80 dark:hover:bg-rose-950/80'}"
				onclick={(e) => {
					e.stopPropagation();
					setOptionState(group.id, option.id, state === 'exclude' ? 'neutral' : 'exclude');
				}}
				title={excludeTooltip}
			>
				<Minus size={12} strokeWidth={2.5} />
			</button>
		</div>
	</div>
{/snippet}

{#snippet renderFilteredOptions(group: FilterGroup, allOptions: any[])}
	{@const search = (groupSearches[group.id] || "").toLowerCase().trim()}
	{@const filteredOptions = search
		? allOptions.filter((opt: any) => opt.label.toLowerCase().includes(search))
		: allOptions}

	{#if filteredOptions.length === 0}
		<div class="text-xs text-center py-4 text-gray-400 font-medium italic">
			{noOptionsText(group.label)}
		</div>
	{:else}
		{#each filteredOptions as option (option.id)}
			{@render renderOptionRow(group, option)}
		{/each}
	{/if}
{/snippet}

{#snippet renderOptionsList(group: FilterGroup)}
	{@const remoteFn = group.optionsRemote || group.listRemote}
	{#if remoteFn && (!group.options || group.options.length === 0)}
		{#await fetchGroupOptions(group)}
			<div class="flex items-center justify-center py-6 text-gray-400 gap-2 text-xs">
				<Loader2 class="h-4 w-4 animate-spin text-blue-500" />
				<span>{loadingText(group.label)}</span>
			</div>
		{:then allOptions}
			{@render renderFilteredOptions(group, allOptions)}
		{/await}
	{:else if group.options}
		{@const allOptions = group.options.map((o: any) => normalizeOption(o, group))}
		{@render renderFilteredOptions(group, allOptions)}
	{/if}
{/snippet}

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		<Button
			variant={buttonVariant}
			class="relative border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 {buttonClass}"
		>
			<FilterIcon size={16} class="mr-2" />
			<span>{buttonLabel}</span>
			{#if activeFiltersCount > 0}
				<span
					class="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-blue-600 dark:bg-blue-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-sm"
				>
					{activeFiltersCount}
				</span>
			{/if}
		</Button>
	</DropdownMenu.Trigger>

	<DropdownMenu.Content
		{align}
		class="w-80 max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 bg-white dark:bg-gray-900 z-50 animate-in fade-in zoom-in-95 duration-150"
	>
		<!-- Radio Filter Groups (e.g. Display Modes) -->
		{#if radioGroups && radioGroups.length > 0}
			{#each radioGroups as rg (rg.id)}
				{#if rg.label}
					<DropdownMenu.Label
						class="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-1.5"
					>
						{rg.label}
					</DropdownMenu.Label>
				{/if}
				<DropdownMenu.RadioGroup
					value={rg.value}
					onValueChange={(val) => {
						if (val) rg.onchange(val);
					}}
				>
					{#each rg.options as opt (opt.value)}
						<DropdownMenu.RadioItem
							value={opt.value}
							closeOnSelect={false}
							class="rounded-xl py-2 ps-8 pe-3 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
						>
							{#if opt.icon}
								{@const OptIcon = opt.icon}
								<OptIcon size={14} class="text-gray-500 shrink-0" />
							{/if}
							<div class="flex flex-col min-w-0">
								<span class="break-all font-medium">{opt.label}</span>
								{#if opt.description}
									<span class="text-[11px] text-gray-400 font-normal leading-tight break-words">{opt.description}</span>
								{/if}
							</div>
						</DropdownMenu.RadioItem>
					{/each}
				</DropdownMenu.RadioGroup>
				<DropdownMenu.Separator class="bg-gray-100 dark:bg-gray-800 my-1" />
			{/each}
		{/if}

		<!-- System / Boolean Flags Section -->
		{#if booleanFilters.length > 0}
			<DropdownMenu.Label
				class="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-1.5"
			>
				{systemFiltersLabel}
			</DropdownMenu.Label>

			{#each booleanFilters as bf (bf.id)}
				<DropdownMenu.CheckboxItem
					checked={bf.checked}
					onCheckedChange={(val) => bf.onchange(!!val)}
					closeOnSelect={false}
					class="rounded-xl py-2 ps-8 pe-3 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
				>
					<span class="break-all block w-full font-medium">{bf.label}</span>
				</DropdownMenu.CheckboxItem>
			{/each}

			{#if groups.length > 0 || dateFilters.length > 0}
				<DropdownMenu.Separator class="bg-gray-100 dark:bg-gray-800 my-1" />
			{/if}
		{/if}

		<!-- Filter Criteria Groups (Vertical Accordion Expansion) -->
		{#if groups.length > 0 || dateFilters.length > 0}
			<DropdownMenu.Label
				class="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-1.5"
			>
				{filterCriteriaLabel}
			</DropdownMenu.Label>

			<div class="space-y-1">
				{#each dateFilters as df (df.id)}
					{@const isExpanded = isDateFilterExpanded(df)}
					{@const isActive = isDateFilterActive(df.value)}
					{@const summary = isActive ? formatDateFilterSummary(df.value, { fromLabel: df.fromLabel, toLabel: df.toLabel }) : ""}

					<div class="rounded-xl overflow-hidden border border-transparent transition-colors {isExpanded ? 'border-gray-200/70 dark:border-gray-700/70 bg-gray-50/50 dark:bg-gray-800/40' : ''}">
						<button
							type="button"
							class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-100/70 dark:hover:bg-gray-800/70 cursor-pointer transition-colors text-left"
							onclick={(e) => {
								e.stopPropagation();
								toggleDateFilter(df);
							}}
						>
							<div class="flex items-center gap-2 min-w-0">
								<CalendarDays size={16} class="text-gray-400 dark:text-gray-500 shrink-0" />
								<span class="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{df.label}</span>
							</div>

							<div class="flex items-center gap-2 shrink-0">
								{#if isActive && summary}
									<span
										class="text-[10px] py-0.5 px-1.5 h-4 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full font-bold flex items-center truncate max-w-[140px]"
										title={summary}
									>
										{summary}
									</span>
								{/if}
								<ChevronDown
									size={15}
									class="text-gray-400 transition-transform duration-200 {isExpanded ? 'rotate-180 text-blue-600' : ''}"
								/>
							</div>
						</button>

						{#if isExpanded}
							<div
								class="px-2.5 pb-2.5 pt-2 space-y-2.5 border-t border-gray-100 dark:border-gray-800/80"
								role="group"
								aria-label={df.label}
							>
								<!-- Mode Toggle -->
								<div class="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800">
									<button
										type="button"
										class="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer {df.value.mode === 'single'
											? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-2xs'
											: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
										onclick={(e) => {
											e.stopPropagation();
											updateDateFilter(df, {
												mode: "single",
												from: df.value.from || df.value.to,
												to: "",
											});
										}}
									>
										{df.singleLabel ?? "Single date"}
									</button>
									<button
										type="button"
										class="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer {df.value.mode === 'range'
											? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-2xs'
											: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
										onclick={(e) => {
											e.stopPropagation();
											updateDateFilter(df, {
												mode: "range",
												from: df.value.from,
												to: df.value.to,
											});
										}}
									>
										{df.rangeLabel ?? "Date range"}
									</button>
								</div>

								<!-- Quick Presets -->
								<div class="flex flex-wrap gap-1.5">
									<button
										type="button"
										class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
										onclick={(e) => {
											e.stopPropagation();
											updateDateFilter(df, getTodayDateFilterValue());
										}}
									>
										{df.todayLabel ?? "Today"}
									</button>
									<button
										type="button"
										class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
										onclick={(e) => {
											e.stopPropagation();
											updateDateFilter(df, getThisWeekDateFilterValue());
										}}
									>
										{df.thisWeekLabel ?? "This week"}
									</button>
									<button
										type="button"
										class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
										onclick={(e) => {
											e.stopPropagation();
											updateDateFilter(df, getThisMonthDateFilterValue());
										}}
									>
										{df.thisMonthLabel ?? "This month"}
									</button>
								</div>

								<!-- Date Inputs -->
								{#if df.value.mode === "single"}
									<div>
										<label
											for="date-filter-{df.id}-single"
											class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1"
										>
											{df.dateLabel ?? "Date"}
										</label>
										<input
											id="date-filter-{df.id}-single"
											type="date"
											value={df.value.from}
											onclick={(e) => e.stopPropagation()}
											onkeydown={(e) => {
												if (e.key !== "Escape") e.stopPropagation();
											}}
											oninput={(e) => handleDateInput(df, "single", e.currentTarget.value)}
											onchange={(e) => handleDateInput(df, "single", e.currentTarget.value)}
											class="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
										/>
									</div>
								{:else}
									<div class="space-y-2">
										<div>
											<label
												for="date-filter-{df.id}-from"
												class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1"
											>
												{df.fromLabel ?? "From"}
											</label>
											<input
												id="date-filter-{df.id}-from"
												type="date"
												value={df.value.from}
												onclick={(e) => e.stopPropagation()}
												onkeydown={(e) => {
													if (e.key !== "Escape") e.stopPropagation();
												}}
												oninput={(e) => handleDateInput(df, "from", e.currentTarget.value)}
												onchange={(e) => handleDateInput(df, "from", e.currentTarget.value)}
												class="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
											/>
										</div>
										<div>
											<label
												for="date-filter-{df.id}-to"
												class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1"
											>
												{df.toLabel ?? "To"}
											</label>
											<input
												id="date-filter-{df.id}-to"
												type="date"
												value={df.value.to}
												onclick={(e) => e.stopPropagation()}
												onkeydown={(e) => {
													if (e.key !== "Escape") e.stopPropagation();
												}}
												oninput={(e) => handleDateInput(df, "to", e.currentTarget.value)}
												onchange={(e) => handleDateInput(df, "to", e.currentTarget.value)}
												class="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
											/>
										</div>
									</div>
								{/if}

								<!-- Clear Date Filter Action -->
								{#if isActive}
									<div class="pt-1 border-t border-gray-200/60 dark:border-gray-700/60">
										<button
											type="button"
											class="w-full flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
											onclick={(e) => {
												e.stopPropagation();
												updateDateFilter(df, {
													mode: df.value.mode,
													from: "",
													to: "",
												});
											}}
										>
											<X size={12} />
											{df.clearLabel ?? clearGroupText(df.label)}
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}

				{#each groups as group (group.id)}
					{@const groupCounts = getGroupActiveCount(group.id)}
					{@const isExpanded = isGroupExpanded(group.id)}

					<div class="rounded-xl overflow-hidden border border-transparent transition-colors {isExpanded ? 'border-gray-200/70 dark:border-gray-700/70 bg-gray-50/50 dark:bg-gray-800/40' : ''}">
						<!-- Vertical Accordion Header -->
						<button
							type="button"
							class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-100/70 dark:hover:bg-gray-800/70 cursor-pointer transition-colors text-left"
							onclick={(e) => {
								e.stopPropagation();
								toggleGroup(group.id);
							}}
						>
							<div class="flex items-center gap-2 min-w-0">
								{#if group.icon}
									{@const GroupIcon = group.icon}
									<GroupIcon size={16} class="text-gray-400 dark:text-gray-500 shrink-0" />
								{/if}
								<span class="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{group.label}</span>
							</div>

							<div class="flex items-center gap-2 shrink-0">
								{#if groupCounts.total > 0}
									<div class="flex items-center gap-1">
										{#if groupCounts.include > 0}
											<span
												class="text-[10px] py-0.5 px-1.5 h-4 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-full font-black flex items-center"
											>
												+{groupCounts.include}
											</span>
										{/if}
										{#if groupCounts.exclude > 0}
											<span
												class="text-[10px] py-0.5 px-1.5 h-4 bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 rounded-full font-black flex items-center"
											>
												−{groupCounts.exclude}
											</span>
										{/if}
									</div>
								{/if}
								<ChevronDown
									size={15}
									class="text-gray-400 transition-transform duration-200 {isExpanded ? 'rotate-180 text-blue-600' : ''}"
								/>
							</div>
						</button>

						<!-- Vertically Expanded Content -->
						{#if isExpanded}
							<div class="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-gray-100 dark:border-gray-800/80">
								<!-- Search bar inside group -->
								<div class="relative mt-1">
									<Search
										size={13}
										class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
									/>
									<input
										type="text"
										placeholder={searchPlaceholder(group.label)}
										value={groupSearches[group.id] || ""}
										onclick={(e) => e.stopPropagation()}
										onkeydown={(e) => e.stopPropagation()}
										oninput={(e) => {
											groupSearches = {
												...groupSearches,
												[group.id]: (e.target as HTMLInputElement).value,
											};
										}}
										class="w-full pl-8 pr-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
									/>
								</div>

								<div class="flex items-center justify-between text-[10px] font-bold text-gray-400 dark:text-gray-500 px-0.5">
									<span>{cycleStateHelp}</span>
									<div class="flex items-center gap-2">
										<span class="text-emerald-600 dark:text-emerald-400">{includeHelp}</span>
										<span class="text-rose-600 dark:text-rose-400">{excludeHelp}</span>
									</div>
								</div>

								<!-- Options list vertically scrollable in place -->
								<div class="max-h-[220px] overflow-y-auto space-y-0.5 p-0.5">
									{@render renderOptionsList(group)}
								</div>

								<!-- Clear Group Action -->
								{#if groupCounts.total > 0}
									<div class="pt-1 border-t border-gray-200/60 dark:border-gray-700/60">
										<button
											type="button"
											class="w-full flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
											onclick={(e) => {
												e.stopPropagation();
												clearGroup(group.id);
											}}
										>
											<X size={12} />
											{clearGroupText(group.label)}
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if children}
			<DropdownMenu.Separator class="bg-gray-100 dark:bg-gray-800 my-1" />
			{@render children()}
		{/if}

		<!-- Global Clear All Action -->
		{#if activeFiltersCount > 0}
			<DropdownMenu.Separator class="bg-gray-100 dark:bg-gray-800 my-1" />
			<button
				type="button"
				class="w-full text-red-600 dark:text-red-400 font-bold text-xs py-2 px-3 rounded-xl cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition-colors"
				onclick={(e) => {
					e.stopPropagation();
					clearAll();
				}}
			>
				<X size={14} class="mr-2" />
				{clearAllText(activeFiltersCount)}
			</button>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
