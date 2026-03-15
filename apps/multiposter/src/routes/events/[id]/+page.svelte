<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { page } from "$app/state";
	import { readEvent } from "./read.remote";
	import { updateExistingEvent } from "./update.remote";
	import { updateEventSchema } from "$lib/validations/events";
	import EventForm from "$lib/components/events/EventForm.svelte";
	import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
	import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
</script>

{#await readEvent(page.params.id ?? "")}
	<LoadingSection message={m.loading_event_data()} />
{:then event}
	{#if event}
		<EventForm
			remoteFunction={updateExistingEvent}
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
