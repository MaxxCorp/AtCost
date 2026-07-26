<script lang="ts">
	interface Props {
		event: {
			summary: string;
			description?: string;
			startDateTime?: Date | string;
			endDateTime?: Date | string;
			location?: string;
			ticketPrice?: string;
			organizer?: { name: string; email?: string; phone?: string; website?: string };
		};
		hashtags?: string;
	}

	let { event, hashtags = '' }: Props = $props();

	function formatDate(val?: Date | string): string {
		if (!val) return '';
		const d = typeof val === 'string' ? new Date(val) : val;
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('de-DE', {
			weekday: 'short',
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let formattedStart = $derived(formatDate(event.startDateTime));
	let formattedEnd = $derived(formatDate(event.endDateTime));
</script>

<div class="instagram-post-standard">
	<p class="title">📅 <strong>{event.summary}</strong></p>

	{#if formattedStart}
		<p class="time">⏰ {formattedStart}{#if formattedEnd} - {formattedEnd}{/if}</p>
	{/if}

	{#if event.location}
		<p class="location">📍 {event.location}</p>
	{/if}

	{#if event.ticketPrice}
		<p class="price">🎟️ {event.ticketPrice}</p>
	{/if}

	{#if event.description}
		<br />
		<p class="description">{event.description}</p>
	{/if}

	{#if event.organizer?.name}
		<br />
		<p class="organizer">👤 Veranstalter: {event.organizer.name}</p>
	{/if}

	{#if hashtags}
		<br />
		<p class="hashtags">{hashtags}</p>
	{/if}
</div>
