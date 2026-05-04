<script lang="ts">
	import { listEvents } from "./list.remote";
	import { listLocations } from "../locations/list.remote";
	import { listTags } from "../tags/list.remote";
	import { listContacts } from "../contacts/list.remote";
	import * as m from "$lib/paraglide/messages.js";
	import type { Event } from "@ac/validations";
	import { deleteEvents } from "./delete.remote";
	import { deleteSeries } from "./[id]/delete-series.remote";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
	import { handleDelete, EntityManager } from "@ac/ui";
	import {
		Calendar,
		MapPin,
		Earth,
		Tag as TagIcon,
		Pencil,
		Trash2,
		ChevronDown,
	} from "@lucide/svelte";
	import * as Collapsible from "$lib/components/ui/collapsible";

	import { goto } from "$app/navigation";
	import { toast } from "svelte-sonner";

	// --- Series grouping state ---
	let expandedSeries = $state<Set<string>>(new Set());
	let currentItems = $state<Event[]>([]);

	function toggleSeriesExpansion(seriesKey: string) {
		if (expandedSeries.has(seriesKey)) {
			expandedSeries.delete(seriesKey);
		} else {
			expandedSeries.add(seriesKey);
		}
		expandedSeries = new Set(expandedSeries);
	}

	/** Get the series grouping key for an event (seriesId or recurringEventId) */
	function getSeriesKey(event: Event): string | null {
		return event.seriesId || event.recurringEventId || null;
	}

	/** Intercept listEvents to capture items for grouping */
	async function listEventsIntercepted(params?: any) {
		const result = await listEvents(params);
		const items = Array.isArray(result) ? result : (result?.data ?? []);
		currentItems = items as Event[];
		return result;
	}

	/** Map of seriesKey -> sorted instances for that series */
	const seriesGroups = $derived.by(() => {
		const groups = new Map<string, Event[]>();
		for (const event of currentItems) {
			const key = getSeriesKey(event);
			if (key) {
				if (!groups.has(key)) {
					groups.set(key, []);
				}
				groups.get(key)!.push(event);
			}
		}
		// Sort instances within each group ascending by startDateTime
		for (const [, instances] of groups) {
			instances.sort((a, b) => {
				const dateA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
				const dateB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
				return dateA - dateB;
			});
		}
		return groups;
	});

	/** Get the next upcoming instance for a series (or the last one if all are past) */
	function getNextUpcomingInstance(instances: Event[]): Event {
		const now = Date.now();
		const upcoming = instances.find(
			(e) => e.startDateTime && new Date(e.startDateTime).getTime() >= now,
		);
		return upcoming ?? instances[instances.length - 1];
	}

	function formatEventTime(event: Event): string {
		if (event.isAllDay && event.startDateTime) {
			const startDateStr = new Date(
				event.startDateTime,
			).toLocaleDateString();
			if (event.endDateTime) {
				const endDateStr = new Date(
					event.endDateTime,
				).toLocaleDateString();
				if (startDateStr !== endDateStr) {
					return `${m.all_day()}: ${startDateStr} - ${endDateStr}`;
				}
			}
			return `${m.all_day()} ${m.on()} ${startDateStr}`;
		}

		if (event.startDateTime) {
			const start = new Date(event.startDateTime);
			const end = event.endDateTime ? new Date(event.endDateTime) : null;
			const dateStr = start.toLocaleDateString();
			const startTime = start.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
			if (end) {
				const endTime = end.toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				});
				return `${dateStr}, ${startTime} - ${endTime}`;
			}
			return `${dateStr}, ${startTime}`;
		}
		return m.loading(); // Fallback
	}

	// Check if an event is part of a recurring series
	function isSeriesEvent(event: Event): boolean {
		return !!(
			event.seriesId ||
			(event.recurrence && event.recurrence.length > 0) ||
			event.recurringEventId
		);
	}

	/** Check if this event is the first of its series group (used to render the series header only once) */
	function isFirstOfSeriesGroup(event: Event): boolean {
		const key = getSeriesKey(event);
		if (!key) return false;
		const group = seriesGroups.get(key);
		if (!group || group.length <= 1) return false;
		return group[0].id === event.id;
	}

	/** Check if this event belongs to a multi-instance series */
	function isGroupedSeriesEvent(event: Event): boolean {
		const key = getSeriesKey(event);
		if (!key) return false;
		const group = seriesGroups.get(key);
		return !!(group && group.length > 1);
	}

	const eventAssociations = [
		{
			id: "locationId",
			label: m.location(),
			listRemote: listLocations,
			getOptionLabel: (l: any) => l.name
		},
		{
			id: "tagId",
			label: m.tags(),
			listRemote: listTags,
			getOptionLabel: (t: any) => t.name
		},
		{
			id: "contactId",
			label: m.feature_contacts_title(),
			listRemote: listContacts,
			getOptionLabel: (c: any) => c.displayName || `${c.givenName || ""} ${c.familyName || ""}`
		}
	];
</script>

{#snippet eventContent(evt: Event)}
	<div class="flex items-start gap-3 mb-2">
		<div class="flex-1 min-w-0">
			<h2 class="text-xl font-semibold break-all text-pretty">
				<a
					href={`/events/${evt.id}/view`}
					class="hover:underline text-blue-600"
				>
					{evt.summary}
				</a>
			</h2>
		</div>
	</div>
	<div class="flex flex-col gap-1 mt-1">
		<div class="flex items-center gap-2">
			<Calendar size={14} class="text-blue-500" />
			<span class="text-xs text-gray-500 break-all text-pretty">
				{formatEventTime(evt)}
			</span>
		</div>
		{#if evt.location}
			<div class="flex items-center gap-2 min-w-0">
				<MapPin size={14} class="text-red-500 shrink-0" />
				<span class="text-xs text-gray-400 break-all text-pretty">
					{evt.location}
				</span>
			</div>
		{/if}
		<div class="flex flex-wrap items-center gap-2 mt-1">
			{#if evt.isPublic}
				<div class="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
					<Earth size={12} class="text-green-600" />
					<span class="text-[10px] text-green-700 font-medium">
						{m.public()}
					</span>
				</div>
			{/if}
			{#if evt.tags && evt.tags.length > 0}
				{#each evt.tags as tag}
					<span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-medium rounded-full border border-indigo-100 flex items-center gap-1">
						<TagIcon size={12} />
						{tag.name}
					</span>
				{/each}
			{/if}
		</div>
	</div>
{/snippet}

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<Breadcrumb feature="events" />
		<div class="bg-white shadow rounded-lg p-6">
			<h1 class="text-2xl font-black mb-6 text-gray-900">{m.feature_events_title()}</h1>
			<EntityManager 
				title={m.feature_events_title()} 
				icon={Calendar} 
				mode="standalone"
				listItemsRemote={listEventsIntercepted as any}
				deleteItemRemote={async (ids: string[]) => {
					return await handleDelete({
						ids,
						deleteFn: deleteEvents,
						itemName: m.event_label().toLowerCase(),
					});
				}}
				loadingLabel={m.loading_item({ item: m.feature_events_title() })}
				noItemsFoundLabel={m.no_items_found({ item: m.feature_events_title() })}
				searchPredicate={(e: Event, q: string) => e.summary.toLowerCase().includes(q.toLowerCase())}
				createHref="/events/new"
				createLabel={m.create_item({ item: "Event" })}
				filterAssociations={eventAssociations}
			>
				{#snippet renderListItem(event: Event, { isSelected, toggleSelection, deleteItem })}
					{#if isGroupedSeriesEvent(event)}
						{#if isFirstOfSeriesGroup(event)}
							{@const seriesKey = getSeriesKey(event)!}
							{@const group = seriesGroups.get(seriesKey)!}
							{@const nextInstance = getNextUpcomingInstance(group)}
							{@const isExpanded = expandedSeries.has(seriesKey)}
							<Collapsible.Root open={isExpanded} onOpenChange={() => toggleSeriesExpansion(seriesKey)}>
								<div class="bg-white border rounded-lg overflow-hidden transition-shadow hover:shadow-md">
									<!-- Series Header — same UI as a normal event -->
									<div class="p-6 flex flex-col sm:flex-row items-start gap-4">
										<input
											type="checkbox"
											checked={isSelected}
											onchange={() => {
												for (const inst of group) {
													toggleSelection(inst.id);
												}
											}}
											class="mt-1 w-4 h-4 text-blue-600 rounded shrink-0"
										/>
										<Collapsible.Trigger class="flex-1 w-full min-w-0 cursor-pointer text-left">
											{@render eventContent(nextInstance)}
										</Collapsible.Trigger>

										<div class="flex flex-col gap-2 shrink-0 items-end">
											<Button
												href={`/events/${nextInstance.recurringEventId || nextInstance.id}?editSeries=true`}
												variant="default"
												size="default"
												class="flex items-center gap-2 w-[120px] justify-center"
											>
												<Pencil size={16} /> {m.edit()}
											</Button>
											<AsyncButton
												variant="destructive"
												size="default"
												loading={false}
												loadingLabel={m.deleting()}
												class="flex items-center gap-2 w-[120px] justify-center"
												onclick={async () => {
													if (!confirm(m.delete_series_confirm())) return;
													await deleteSeries(group[0].id);
													toast.success(m.series_deleted());
													location.reload();
												}}
											>
												<Trash2 size={16} /> {m.delete()}
											</AsyncButton>
										</div>
									</div>

									<!-- Expanded: all instances -->
									<Collapsible.Content>
										<div class="border-t border-gray-200 bg-gray-50 divide-y divide-gray-100">
											{#each group as instance (instance.id)}
												<div class="p-4 pl-12 flex flex-col sm:flex-row items-start gap-4 hover:bg-gray-100 transition-colors">
													<input
														type="checkbox"
														onchange={() => toggleSelection(instance.id)}
														class="mt-1 w-4 h-4 text-blue-600 rounded shrink-0"
													/>
													<div class="flex-1 w-full min-w-0">
														<h3 class="text-base font-medium break-all text-pretty">
															<a
																href={`/events/${instance.id}/view`}
																class="hover:underline text-blue-600"
															>
																{instance.summary}
															</a>
														</h3>
														<div class="flex flex-col gap-1 mt-1">
															<div class="flex items-center gap-2">
																<Calendar size={12} class="text-blue-400" />
																<span class="text-xs text-gray-500">
																	{formatEventTime(instance)}
																</span>
															</div>
															{#if instance.location}
																<div class="flex items-center gap-2 min-w-0">
																	<MapPin size={12} class="text-red-400 shrink-0" />
																	<span class="text-xs text-gray-400">
																		{instance.location}
																	</span>
																</div>
															{/if}
														</div>
													</div>
													<div class="flex flex-col gap-2 shrink-0 items-end">
														<Button
															href={`/events/${instance.id}`}
															variant="default"
															size="sm"
															class="flex items-center gap-2 w-[110px] justify-center"
														>
															<Pencil size={14} /> {m.edit()}
														</Button>
														<AsyncButton
															variant="destructive"
															size="sm"
															loading={false}
															loadingLabel={m.deleting()}
															class="flex items-center gap-2 w-[110px] justify-center"
															onclick={async () => {
																await handleDelete({
																	ids: [instance.id],
																	deleteFn: deleteEvents,
																	itemName: m.instance().toLowerCase(),
																});
															}}
														>
															<Trash2 size={14} /> {m.delete()}
														</AsyncButton>
													</div>
												</div>
											{/each}
										</div>
									</Collapsible.Content>
								</div>
							</Collapsible.Root>
						{/if}
						<!-- Non-first items of the group: render nothing -->
					{:else}
						<!-- Regular standalone event -->
						<div class="bg-white border rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow hover:shadow-md">
							<input
								type="checkbox"
								checked={isSelected}
								onchange={() => toggleSelection(event.id)}
								class="mt-1 w-4 h-4 text-blue-600 rounded shrink-0"
							/>
							<div class="flex-1 w-full min-w-0">
								{@render eventContent(event)}
							</div>
							
							<div class="flex flex-col gap-2 shrink-0 items-end">
								<Button
									href={`/events/${event.id}`}
									variant="default"
									size="default"
									class="flex items-center gap-2 w-[120px] justify-center"
								>
									<Pencil size={16} /> {m.edit()}
								</Button>
								<AsyncButton
									variant="destructive"
									size="default"
									loading={false}
									loadingLabel={m.deleting()}
									class="flex items-center gap-2 w-[120px] justify-center"
									onclick={() => deleteItem(event)}
								>
									<Trash2 size={16} /> {m.delete()}
								</AsyncButton>
							</div>
						</div>
					{/if}
				{/snippet}
			</EntityManager>
		</div>
	</div>
</div>
