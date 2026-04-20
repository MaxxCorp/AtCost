<script lang="ts">
	import { createEvent } from "./create.remote";
	import { createEventSchema } from "$lib/validations/events";
	import EventForm from "$lib/components/events/EventForm.svelte";
</script>

<EventForm
	remoteFunction={createEvent}
	validationSchema={createEventSchema}
/>
