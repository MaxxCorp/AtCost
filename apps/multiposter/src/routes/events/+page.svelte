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
		RefreshCw,
	} from "@lucide/svelte";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

	import { onMount } from "svelte";
	import { browser } from "$app/environment";
	import { goto } from "$app/navigation";
	import { toast } from "svelte-sonner";

	// We still initialize the Ably listener. As listEvents is passed to EntityManager, it handles its own QueryHandle.
	// We'll manage the refresh indirectly or manually. Since EntityManager now calls listEvents({page, limit}) reactively,
	// if we just reassigned a "version" variable we could force a refresh. But Ably is tricky.
	
	let ablyConnected = $state(false);

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
			(event as any).seriesId ||
			(event.recurrence && event.recurrence.length > 0) ||
			(event as any).recurringEventId
		);
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

	let expandedSeriesIds = $state(new Set<string>());

	function toggleSeries(seriesId: string) {
		if (expandedSeriesIds.has(seriesId)) {
			expandedSeriesIds.delete(seriesId);
		} else {
			expandedSeriesIds.add(seriesId);
		}
		expandedSeriesIds = new Set(expandedSeriesIds);
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<Breadcrumb feature="events" />
		<div class="bg-white shadow rounded-lg p-6">
			<h1 class="text-2xl font-black mb-6 text-gray-900">{m.feature_events_title()}</h1>
			<EntityManager 
				title={m.feature_events_title()} 
				icon={Calendar} 
				mode="standalone"
				listItemsRemote={(params: any) => (listEvents as any)({ ...params, grouped: true })}
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
				{#snippet renderListItem(event: Event, { isSelected, toggleSelection, deleteItem }: any)}
					{@const isExpanded = event.seriesId && expandedSeriesIds.has(event.seriesId)}
					
					<div class="flex flex-col gap-2">
						<div class="bg-white border rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow hover:shadow-md {event.isSeries ? 'border-blue-200 bg-blue-50/10' : ''}">
							<div class="flex items-start gap-4 flex-1 w-full min-w-0">
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => toggleSelection(event.id)}
									class="mt-1 w-4 h-4 text-blue-600 rounded shrink-0"
								/>
								<div class="flex-1 w-full min-w-0">
									<div class="flex items-center gap-2 mb-1">
										{#if event.isSeries}
											<Button 
												variant="ghost" 
												size="sm" 
												class="h-6 w-6 p-0" 
												onclick={() => event.seriesId && toggleSeries(event.seriesId)}
											>
												<ChevronDown size={16} class="transition-transform {isExpanded ? 'rotate-180' : ''}" />
											</Button>
											<span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
												{m.series()} ({event.instanceCount})
											</span>
										{/if}
									</div>
									<div class="flex items-start gap-3 mb-2">
										<div class="flex-1 min-w-0">
											<h2 class="text-xl font-semibold break-all text-pretty">
												<a
													href={`/events/${event.id}/view`}
													class="hover:underline text-blue-600"
												>
													{event.summary}
												</a>
											</h2>
										</div>
									</div>
									<div class="flex flex-col gap-1 mt-1">
										<div class="flex items-center gap-2">
											<Calendar size={14} class="text-blue-500" />
											<span class="text-xs text-gray-500 break-all text-pretty">
												{formatEventTime(event)}
												{#if event.isSeries && !isExpanded}
													<span class="ml-1 italic text-gray-400">({m.plus_more({ count: (event.instanceCount || 1) - 1 })})</span>
												{/if}
											</span>
										</div>
										{#if event.locations && event.locations.length > 0}
											<div class="flex items-center gap-2 min-w-0">
												<MapPin size={14} class="text-red-500 shrink-0" />
												<span class="text-xs text-gray-400 break-all text-pretty">
													{event.locations.map(l => l.name).join(", ")}
												</span>
											</div>
										{/if}
										<div class="flex flex-wrap items-center gap-2 mt-1">
											{#if event.isPublic}
												<div class="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
													<Earth size={12} class="text-green-600" />
													<span class="text-[10px] text-green-700 font-medium">
														{m.public()}
													</span>
												</div>
											{/if}
											{#if event.tags && event.tags.length > 0}
												{#each event.tags as tag}
													<span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-medium rounded-full border border-indigo-100 flex items-center gap-1">
														<TagIcon size={12} />
														{tag.name}
													</span>
												{/each}
											{/if}
										</div>
									</div>
								</div>
							</div>
							
							<div class="flex flex-col gap-2 shrink-0 items-end">
								{#if isSeriesEvent(event)}
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										<Button
											variant="default"
											size="default"
											class="flex items-center gap-2 w-[120px] justify-start"
										>
											<Pencil size={16} />
											<span class="ml-auto">{m.edit()}</span>
											<ChevronDown size={14} class="ml-auto" />
										</Button>
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end">
										<DropdownMenu.Item
											onclick={() => goto(`/events/${event.id}`)}
										>
											<Pencil size={14} class="mr-2" /> 
											{m.edit_item({ item: m.instance() })}
										</DropdownMenu.Item>
										<DropdownMenu.Item
											onclick={() => goto(`/events/${(event as any).recurringEventId || event.id}?editSeries=true`)}
										>
											<RefreshCw size={14} class="mr-2" /> 
											{m.edit_item({ item: m.series() })}
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										<Button
											variant="destructive"
											size="default"
											class="flex items-center gap-2 w-[120px] justify-start"
										>
											<Trash2 size={16} />
											<span class="ml-auto">{m.delete()}</span>
											<ChevronDown size={14} class="ml-auto" />
										</Button>
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end">
										<DropdownMenu.Item
											onclick={async () => {
												await handleDelete({
													ids: [event.id],
													deleteFn: deleteEvents,
													itemName: m.instance().toLowerCase(),
												});
												// Note: Deselect All is handled by EntityManager if items are deleted via default actions, 
												// but here we manually call delete backend. We could trigger deleteItem(event) instead if it's supported!
											}}
										>
											<Trash2 size={14} class="mr-2" /> 
											{m.delete()} {m.instance()}
										</DropdownMenu.Item>
										<DropdownMenu.Item
											onclick={async () => {
												if (!confirm(m.delete_series_confirm())) return;
												await deleteSeries(event.id);
												toast.success(m.series_deleted());
												// Note: Requires a hard page reload or EntityManager query reset in the future
												location.reload(); 
											}}
										>
											<RefreshCw size={14} class="mr-2" /> 
											{m.delete()} {m.series()}
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							{:else}
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
							{/if}
						</div>
					</div>

					{#if isExpanded && event.seriesId}
						<div class="ml-10 border-l-2 border-blue-100 pl-6 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
							{#await listEvents({ seriesId: event.seriesId, limit: 100 })}
								<div class="py-4 text-xs text-gray-400 animate-pulse flex items-center gap-2">
									<RefreshCw size={12} class="animate-spin" />
									{m.loading()} {m.instances()}...
								</div>
							{:then res}
								{#each res.data.filter(i => i.id !== event.id) as instance}
									<div class="bg-gray-50/50 border rounded-lg p-4 flex items-center justify-between group hover:bg-white transition-all">
										<div class="flex items-center gap-4">
											<div class="flex flex-col">
												<span class="text-sm font-medium text-gray-700">{formatEventTime(instance)}</span>
												{#if instance.locations && instance.locations.length > 0}
													<span class="text-[10px] text-gray-400 flex items-center gap-1">
														<MapPin size={10} />
														{instance.locations.map(l => l.name).join(", ")}
													</span>
												{/if}
											</div>
										</div>
										<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
											<Button
												href={`/events/${instance.id}`}
												variant="ghost"
												size="sm"
												class="h-8 w-8 p-0"
											>
												<Pencil size={14} />
											</Button>
											<AsyncButton
												variant="ghost"
												size="sm"
												loading={false}
												loadingLabel=""
												class="h-8 w-8 p-0 text-red-500 hover:text-red-600"
												onclick={() => deleteItem(instance)}
											>
												<Trash2 size={14} />
											</AsyncButton>
										</div>
									</div>
								{/each}
							{/await}
						</div>
					{/if}
				</div>
				{/snippet}
			</EntityManager>
		</div>
	</div>
</div>
