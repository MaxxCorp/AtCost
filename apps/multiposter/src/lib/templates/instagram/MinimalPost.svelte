<script lang="ts">
	interface Props {
		event: {
			summary: string;
			description?: string;
			startDateTime?: Date | string;
			location?: string;
		};
		hashtags?: string;
	}

	let { event, hashtags = '' }: Props = $props();

	function formatDateShort(val?: Date | string): string {
		if (!val) return '';
		const d = typeof val === 'string' ? new Date(val) : val;
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let formattedTime = $derived(formatDateShort(event.startDateTime));
</script>

<div class="instagram-post-minimal">
	<p class="summary">✨ {event.summary}</p>
	{#if formattedTime}
		<p class="meta">🗓️ {formattedTime}{#if event.location} • 📍 {event.location}{/if}</p>
	{/if}
	{#if event.description}
		<p class="snippet">{event.description.slice(0, 140)}{#if event.description.length > 140}...{/if}</p>
	{/if}
	{#if hashtags}
		<br />
		<p class="hashtags">{hashtags}</p>
	{/if}
</div>
