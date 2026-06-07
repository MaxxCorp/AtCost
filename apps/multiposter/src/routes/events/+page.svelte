<script lang="ts">
	import { listEvents } from "./list.remote";
	import * as m from "$lib/paraglide/messages.js";
	import { deleteEvents } from "./delete.remote";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import { Pencil, Trash2, Plus, Clock, MapPin, ChevronDown, ChevronRight, CalendarDays } from "@lucide/svelte";
	import { toast } from "svelte-sonner";

	// Simple date formatter function
	function formatEventTime(event: any): string {
		if (!event.startDateTime) return m.loading();
		
		const start = new Date(event.startDateTime);
		const startDateStr = start.toLocaleDateString();
		
		if (event.isAllDay) {
			if (event.endDateTime) {
				const endDateStr = new Date(event.endDateTime).toLocaleDateString();
				if (startDateStr !== endDateStr) {
					return `${m.all_day()}: ${startDateStr} - ${endDateStr}`;
				}
			}
			return `${m.all_day()} ${m.on()} ${startDateStr}`;
		}

		const startTime = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		if (event.endDateTime) {
			const end = new Date(event.endDateTime);
			const endTime = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			return `${startDateStr}, ${startTime} - ${endTime}`;
		}
		
		return `${startDateStr}, ${startTime}`;
	}

	// State for expanded series
	let expandedSeries = $state<Record<string, boolean>>({});

	const eventsQuery = listEvents();
	const groupedEvents = $derived(
		(eventsQuery.current || []).filter((e: any) => !e.recurringEventId).map((master: any) => {
			const instances = (eventsQuery.current || []).filter((e: any) => e.recurringEventId === master.id);
			return { ...master, instances };
		})
	);

	function toggleSeries(id: string) {
		expandedSeries[id] = !expandedSeries[id];
	}

	async function handleDelete(event: any, isSeriesMaster: boolean) {
		try {
			if (isSeriesMaster) {
				if (!window.confirm(m.delete_series_confirm())) return;
				await deleteEvents({ ids: [event.id], deleteSeries: true });
			} else {
				if (!window.confirm(m.delete_confirm({ item: m.event_label() }))) return;
				await deleteEvents({ ids: [event.id] });
			}
			toast.success(m.delete_successful());
		} catch (error: any) {
			toast.error(error?.message || m.something_went_wrong());
		}
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-5xl mx-auto space-y-6">
		<Breadcrumb feature="events" />

		<!-- Header -->
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
			<div>
				<h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
					{m.feature_events_title()}
				</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{m.feature_events_description()}</p>
			</div>
			<Button href="/events/new" class="w-full md:w-auto shadow-sm">
				<Plus class="w-4 h-4 mr-2" />
				{m.new_item({ item: m.event_label() })}
			</Button>
		</div>

		<!-- List using exactly the requested reactive pattern -->
		<div class="grid grid-cols-1 gap-5">
			{#if eventsQuery.loading && !eventsQuery.current}
				<div class="flex items-center text-gray-500 dark:text-gray-400 p-4">{m.loading()}</div>
			{:else if eventsQuery.error}
				<div class="text-red-500 p-4">{m.error_loading_item({ item: m.feature_events_title() })}</div>
			{:else}
				{#each groupedEvents as event}
					<div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-md transition-shadow">
						
						<div class="flex-1 mb-5">
							<a href="/events/{event.id}/view" class="block group mb-2">
								<div class="flex items-start justify-between gap-4">
									<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug line-clamp-2 transition-colors">
										{event.summary || m.untitled_event()}
									</h3>
									{#if event.tags && event.tags.length > 0}
										<div class="flex flex-wrap gap-1 mt-1 shrink-0 justify-end max-w-[50%]">
											{#each event.tags as t}
												{#if t.tag}
													<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
														{t.tag.name}
													</span>
												{/if}
											{/each}
										</div>
									{/if}
								</div>
							</a>
							
							<div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
								<Clock class="w-4 h-4 mr-2 text-primary-500 shrink-0" />
								<span class="truncate font-medium">{formatEventTime(event)}</span>
							</div>
							{#if event.locations && event.locations.length > 0}
								<div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2">
									<MapPin class="w-4 h-4 mr-2 text-primary-500 shrink-0" />
									<span class="truncate">
										{#each event.locations as l, i}
											{#if l.location}
												<a href="/locations/{l.location.id}" class="hover:underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors">{l.location.name}</a>{#if i < event.locations.length - 1}, {/if}
											{/if}
										{/each}
									</span>
								</div>
							{/if}
						</div>

						<div class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
							{#if event.instances.length > 0}
								<button 
									class="inline-flex items-center text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
									onclick={() => toggleSeries(event.id)}>
									<CalendarDays class="w-4 h-4 mr-2 text-primary-500" />
									{event.instances.length} {m.instances()}
									{#if expandedSeries[event.id]}
										<ChevronDown class="w-4 h-4 ml-1" />
									{:else}
										<ChevronRight class="w-4 h-4 ml-1" />
									{/if}
								</button>
							{:else}
								<div></div>
							{/if}

							<div class="flex justify-end gap-2 w-full sm:w-auto">
								<Button variant="outline" size="sm" href="/events/{event.id}" class="flex-1 sm:flex-none">
									<Pencil class="w-4 h-4 mr-2" />
									{m.edit()}
								</Button>
								<button 
									class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500" 
									onclick={() => handleDelete(event, event.instances.length > 0)}>
									<Trash2 class="w-4 h-4 mr-2" />
									{m.delete()}
								</button>
							</div>
						</div>
						<div class="text-[11px] text-gray-400 dark:text-gray-500 text-right px-1 mt-2">
							{m.updated_on({ date: new Date(event.updatedAt).toLocaleDateString() })}
							{#if event.user}
								| <a href="/users/{event.user.id}" class="hover:underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors">{event.user.name || event.user.email || 'User'}</a>
							{/if}
						</div>

						<!-- Instances List -->
						{#if expandedSeries[event.id] && event.instances.length > 0}
							<div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 rounded-lg p-4 space-y-3">
								<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{m.instances()}</h4>
								{#each event.instances as instance}
									<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-gray-900 p-3 rounded-md border border-gray-200 dark:border-gray-700">
										<div class="flex items-center text-sm text-gray-600 dark:text-gray-300">
											<Clock class="w-3.5 h-3.5 mr-2 text-primary-400 shrink-0" />
											<span>{formatEventTime(instance)}</span>
										</div>
										<div class="flex gap-2 w-full sm:w-auto">
											<Button variant="outline" size="sm" href="/events/{instance.id}" class="flex-1 sm:flex-none h-8 px-2 text-xs">
												<Pencil class="w-3.5 h-3.5 mr-1" />
												{m.edit()}
											</Button>
											<button 
												class="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-8 px-2 text-red-500" 
												onclick={() => handleDelete(instance, false)}>
												<Trash2 class="w-3.5 h-3.5 mr-1" />
												{m.delete()}
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
