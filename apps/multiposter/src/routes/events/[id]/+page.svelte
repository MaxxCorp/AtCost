<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { page } from "$app/state";
	import { browser } from "$app/environment";
	import { readEvent } from "./read.remote";
	import { updateEvent } from "./update.remote";
	import { updateEventSchema } from "$lib/validations/events";
	import EventForm from "$lib/components/events/EventForm.svelte";
	import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
	import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
	const eventId = page.params.id || "";
</script>

{#if browser}
	{#await readEvent(eventId)}
		<LoadingSection message={m.loading_event_data()} />
	{:then event}
	{#if event}
		<EventForm
			remoteFunction={updateEvent}
			validationSchema={updateEventSchema}
			isUpdating={true}
			initialData={event}
		/>
	{:else}
		<ErrorSection
			headline={m.event_not_found()}
			message={m.event_not_found_message()}
			href="/events"
			button={m.back_to_events()}
		/>
	{/if}
{:catch error}
	<ErrorSection
		headline={m.error()}
		message={error instanceof Error
			? error.message
			: m.failed_to_load_event()}
		href="/events"
		button={m.back_to_events()}
	/>
	{/await}
{:else}
	<LoadingSection message={m.loading_event_data()} />
{/if}
