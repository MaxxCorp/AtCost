<script lang="ts">
	import * as m from "#lib/paraglide/messages.js";
	import { getTeamSurroundingAbsences } from "../../../routes/time-off/time-off.remote";
	import { listTags } from "../../../routes/tags/list.remote";
	import { listLocations } from "../../../routes/locations/list.remote";
	import { listTalents } from "../../../routes/talents/list.remote";
	import {
		FilterMenu,
		ActiveFilterChips,
		type FilterGroup,
		type FilterStateMap,
	} from "@ac/ui";
	import {
		AlertTriangle,
		AlertCircle,
		CheckCircle2,
		Calendar,
		Clock,
		Search,
		Tag,
		MapPin,
		Users,
		Loader2,
	} from "@lucide/svelte";

	interface Props {
		startDate: string;
		endDate: string;
		excludeTalentId?: string;
		initialTeamTagIds?: string[];
	}

	let {
		startDate,
		endDate,
		excludeTalentId,
		initialTeamTagIds = [],
	}: Props = $props();

	let filterValues = $state<FilterStateMap>({});
	let searchQuery = $state("");
	let initializedFromProps = false;

	$effect(() => {
		const tags = initialTeamTagIds;
		if (!initializedFromProps && tags && tags.length > 0) {
			if (!filterValues.tagId || (filterValues.tagId.include.length === 0 && filterValues.tagId.exclude.length === 0)) {
				initializedFromProps = true;
				filterValues = {
					...filterValues,
					tagId: { include: [...tags], exclude: [] },
				};
			}
		}
	});

	const filterGroups = $derived<FilterGroup[]>([
		{
			id: "tagId",
			label: m.tags ? m.tags() : "Teams / Tags",
			icon: Tag,
			optionsRemote: listTags,
			searchable: true,
			getOptionLabel: (t: any) => t.name,
		},
		{
			id: "locationId",
			label: m.locations ? m.locations() : "Locations",
			icon: MapPin,
			optionsRemote: listLocations,
			searchable: true,
			getOptionLabel: (l: any) => l.name,
		},
		{
			id: "talentId",
			label: m.talent ? m.talent() : "Colleague",
			icon: Users,
			optionsRemote: listTalents,
			searchable: true,
			getOptionLabel: (t: any) => t.contact?.displayName || t.contact?.name || t.id,
		},
		{
			id: "status",
			label: m.status ? m.status() : "Status",
			icon: Clock,
			options: [
				{ id: "approved", label: m.status_approved ? m.status_approved() : "Approved" },
				{ id: "pending", label: m.status_pending ? m.status_pending() : "Pending" },
			],
		},
		{
			id: "type",
			label: m.type ? m.type() : "Type",
			icon: Calendar,
			options: [
				{ id: "vacation", label: m.leave_vacation ? m.leave_vacation() : "Vacation" },
				{ id: "sick", label: m.leave_sick ? m.leave_sick() : "Sick" },
				{ id: "unpaid", label: m.leave_unpaid ? m.leave_unpaid() : "Unpaid" },
				{ id: "other", label: m.leave_other ? m.leave_other() : "Other" },
			],
		},
	]);

	const surroundingQuery = $derived(
		startDate && endDate
			? getTeamSurroundingAbsences({
					startDate,
					endDate,
					excludeTalentId,
					tagId:
						filterValues.tagId?.include?.length || filterValues.tagId?.exclude?.length
							? filterValues.tagId
							: undefined,
					talentId:
						filterValues.talentId?.include?.length || filterValues.talentId?.exclude?.length
							? filterValues.talentId
							: undefined,
					locationId:
						filterValues.locationId?.include?.length || filterValues.locationId?.exclude?.length
							? filterValues.locationId
							: undefined,
					status:
						filterValues.status?.include?.length || filterValues.status?.exclude?.length
							? filterValues.status
							: undefined,
					type:
						filterValues.type?.include?.length || filterValues.type?.exclude?.length
							? filterValues.type
							: undefined,
					search: searchQuery || undefined,
				})
			: null,
	);

	const surroundingData = $derived(surroundingQuery?.current ?? null);
	const loading = $derived(surroundingQuery?.loading ?? false);

	const coverage = $derived(surroundingData?.coverageSummary);
	const riskLevel = $derived(coverage?.riskLevel ?? "none");
	const absentTeamMembers = $derived(coverage?.absentTeamMembers ?? 0);
	const totalTeamMembers = $derived(coverage?.totalTeamMembers ?? 0);
	const coveragePercent = $derived(coverage?.coveragePercent ?? 100);
	const absences = $derived(surroundingData?.overlappingAbsences ?? []);

	function getInitials(name: string): string {
		if (!name) return "?";
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
		}
		return name.slice(0, 2).toUpperCase();
	}

	function formatDate(dateStr: string): string {
		try {
			const d = new Date(dateStr);
			if (isNaN(d.getTime())) return dateStr;
			return d.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		} catch {
			return dateStr;
		}
	}

	function handleRemoveFilter(groupId: string, optionId: string, type: "include" | "exclude") {
		const current = filterValues[groupId] || { include: [], exclude: [] };
		filterValues = {
			...filterValues,
			[groupId]: {
				include: type === "include" ? current.include.filter((id) => id !== optionId) : current.include,
				exclude: type === "exclude" ? current.exclude.filter((id) => id !== optionId) : current.exclude,
			},
		};
	}

	function handleClearAllFilters() {
		filterValues = {};
	}
</script>

<div class="space-y-4">
	<!-- Action Bar -->
	<div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
		<div class="relative flex-1">
			<Search
				size={16}
				class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
			/>
			<input
				type="text"
				placeholder={(m as any).search?.() ?? "Search colleague or role..."}
				bind:value={searchQuery}
				class="pl-9 w-full px-3.5 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all placeholder:text-gray-400"
			/>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			<FilterMenu
				groups={filterGroups}
				bind:filters={filterValues}
				buttonLabel={m.filters ? m.filters() : "Filters"}
			/>
		</div>
	</div>

	<!-- Active Filter Chips -->
	<ActiveFilterChips
		groups={filterGroups}
		filters={filterValues}
		activeFiltersLabel={m.active_filters ? m.active_filters() : "Active Filters:"}
		clearAllLabel={m.clear_all_filters ? m.clear_all_filters() : "Clear all"}
		onremove={handleRemoveFilter}
		onclearall={handleClearAllFilters}
	/>

	<!-- Coverage Risk Banner -->
	{#if surroundingData && coverage}
		{#if riskLevel === "high"}
			<div class="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-950 transition-all">
				<AlertTriangle class="text-rose-600 shrink-0 mt-0.5" size={20} />
				<div class="flex-1 min-w-0">
					<p class="font-bold text-sm text-rose-900">
						High Capacity Risk: {absentTeamMembers} of {totalTeamMembers} team members absent during this period ({coveragePercent}% coverage)
					</p>
					<p class="text-xs text-rose-700 mt-0.5">
						Multiple overlapping absences detected. Team capacity is significantly reduced.
					</p>
				</div>
			</div>
		{:else if riskLevel === "medium"}
			<div class="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-950 transition-all">
				<AlertCircle class="text-amber-600 shrink-0 mt-0.5" size={20} />
				<div class="flex-1 min-w-0">
					<p class="font-bold text-sm text-amber-900">
						Moderate Capacity Risk: {absentTeamMembers === 1 ? "1 team member" : `${absentTeamMembers} team members`} overlapping ({coveragePercent}% coverage)
					</p>
					<p class="text-xs text-amber-700 mt-0.5">
						Scheduled overlap with colleague absence. Verify mission-critical coverage.
					</p>
				</div>
			</div>
		{:else}
			<div class="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-950 transition-all">
				<CheckCircle2 class="text-emerald-600 shrink-0 mt-0.5" size={20} />
				<div class="flex-1 min-w-0">
					<p class="font-bold text-sm text-emerald-900">
						Optimal Team Coverage: Full team capacity ({coveragePercent}% coverage)
					</p>
					<p class="text-xs text-emerald-700 mt-0.5">
						No conflicting absences detected among team members during this period.
					</p>
				</div>
			</div>
		{/if}
	{:else if loading && !surroundingData}
		<div class="flex items-center gap-2 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-500 text-sm">
			<Loader2 class="animate-spin text-gray-400" size={18} />
			<span>Assessing team coverage and overlapping absences...</span>
		</div>
	{/if}

	<!-- Overlapping and Surrounding Absences List -->
	<div class="space-y-3 {loading && surroundingData ? 'opacity-60 transition-opacity' : ''}">
		{#if absences.length > 0}
			<div class="flex items-center justify-between px-1">
				<span class="text-xs font-black uppercase tracking-wider text-gray-400">
					Surrounding Team Absences ({absences.length})
				</span>
				{#if loading}
					<span class="inline-flex items-center gap-1.5 text-xs text-gray-400">
						<Loader2 size={12} class="animate-spin text-amber-600" />
						Updating...
					</span>
				{/if}
			</div>

			<div class="grid grid-cols-1 gap-3">
				{#each absences as item (item.id)}
					<div class="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs hover:border-gray-300 transition-all space-y-3">
						<div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
							<!-- Colleague Info -->
							<div class="flex items-start gap-3 min-w-0">
								<div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center shrink-0 shadow-xs text-sm">
									{getInitials(item.talentName)}
								</div>
								<div class="min-w-0">
									<h4 class="font-bold text-gray-900 text-sm truncate">
										{item.talentName}
									</h4>
									{#if item.jobTitle}
										<p class="text-xs text-gray-500 truncate">
											{item.jobTitle}
										</p>
									{/if}

									{#if item.tags && item.tags.length > 0}
										<div class="flex flex-wrap gap-1 mt-1.5">
											{#each item.tags as tag (tag.id)}
												<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200/60">
													{tag.name}
												</span>
											{/each}
										</div>
									{/if}
								</div>
							</div>

							<!-- Overlap and Status Badges -->
							<div class="flex flex-wrap sm:flex-col sm:items-end gap-1.5 shrink-0">
								{#if item.isDirectOverlap}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
										<AlertTriangle size={12} class="shrink-0" />
										Direct Overlap: {item.overlapDays} {item.overlapDays === 1 ? "day" : "days"}
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
										Adjacent (+/- 7 days)
									</span>
								{/if}

								<div class="flex items-center gap-1.5">
									<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700 capitalize">
										{item.type}
									</span>

									{#if item.status === "approved"}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
											<CheckCircle2 size={11} />
											Approved
										</span>
									{:else if item.status === "pending"}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
											<Clock size={11} />
											Pending
										</span>
									{:else}
										<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600 capitalize">
											{item.status}
										</span>
									{/if}
								</div>
							</div>
						</div>

						<!-- Dates -->
						<div class="flex items-center gap-2 text-xs text-gray-600 bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100">
							<Calendar size={14} class="text-gray-400 shrink-0" />
							<span class="font-medium">
								{formatDate(item.startDate)} – {formatDate(item.endDate)}
							</span>
						</div>

						<!-- Reason / Notes -->
						{#if item.reason}
							<div class="text-xs text-gray-600 bg-gray-50/60 p-2.5 rounded-xl border border-gray-100 italic">
								"{item.reason}"
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else if !loading || surroundingData}
			<div class="text-center py-12 px-4 rounded-2xl bg-gray-50/60 border border-dashed border-gray-200">
				<div class="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
					<Users size={24} />
				</div>
				<h4 class="text-sm font-bold text-gray-900">
					No overlapping or surrounding absences
				</h4>
				<p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
					All colleagues within the selected filters appear to be available or have no scheduled time off in this timeframe.
				</p>
			</div>
		{/if}
	</div>
</div>
