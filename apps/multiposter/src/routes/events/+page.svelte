<script lang="ts">
	import { listEvents } from "./list.remote";
	import * as m from "$lib/paraglide/messages.js";
	import { deleteEvents } from "./delete.remote";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import { Pencil, Trash2, Plus, Clock, MapPin } from "@lucide/svelte";
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
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
			{#each await listEvents() as event}
				<div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 flex flex-col hover:shadow-md transition-shadow">
					
					<div class="flex-1 mb-5">
						<a href="/events/{event.id}/view" class="block group">
							<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 leading-snug line-clamp-2 mb-2 transition-colors">
								{event.summary || m.untitled_event()}
							</h3>
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

					<div class="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800">
						<div class="flex justify-end gap-2 mb-2">
							<Button variant="outline" size="sm" href="/events/{event.id}" class="flex-1 md:flex-none">
								<Pencil class="w-4 h-4 mr-2" />
								{m.edit()}
							</Button>
							<button 
								class="flex-1 md:flex-none inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-red-50 hover:text-red-600 h-9 px-3 text-red-500" 
								onclick={() => {
									deleteEvents({ ids: [event.id] });
									toast.success(m.delete_successful());
								}}>
								<Trash2 class="w-4 h-4 mr-2" />
								{m.delete()}
							</button>
						</div>
						<div class="text-[11px] text-gray-400 dark:text-gray-500 text-right px-1">
							{m.updated_on({ date: new Date(event.updatedAt).toLocaleDateString() })}
							{#if event.user}
								{#if event.user.userContacts && event.user.userContacts.length > 0 && event.user.userContacts[0].contact}
									| <a href="/contacts/{event.user.userContacts[0].contact.id}" class="hover:underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
										{event.user.userContacts[0].contact.displayName || event.user.userContacts[0].contact.givenName || event.user.name || 'User'}
									</a>
								{:else}
									| {event.user.name || event.user.email || 'User'}
								{/if}
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
