<script lang="ts">
	interface Props {
		event: {
			summary: string;
			description?: string;
			startDateTime?: Date | string;
			endDateTime?: Date | string;
			location?: string;
			ticketPrice?: string;
		};
		hashtags?: string;
	}

	let { event, hashtags = '' }: Props = $props();

	function formatDate(val?: Date | string): string {
		if (!val) return '';
		const d = typeof val === 'string' ? new Date(val) : val;
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('de-DE', {
			weekday: 'long',
			day: '2-digit',
			month: 'long',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let formattedDate = $derived(formatDate(event.startDateTime));
</script>

<div class="instagram-story-banner" style="background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045); color: #ffffff; padding: 24px; border-radius: 16px; font-family: sans-serif;">
	<div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 8px;">🔥 HIGHLIGHT</div>
	<h1 style="font-size: 28px; font-weight: bold; margin: 0 0 12px 0; line-height: 1.2;">{event.summary}</h1>

	{#if formattedDate}
		<div style="font-size: 16px; margin-bottom: 8px;">📅 {formattedDate}</div>
	{/if}

	{#if event.location}
		<div style="font-size: 16px; margin-bottom: 12px;">📍 {event.location}</div>
	{/if}

	{#if event.description}
		<p style="font-size: 14px; opacity: 0.95; line-height: 1.4; margin-top: 12px;">{event.description}</p>
	{/if}

	{#if hashtags}
		<div style="font-size: 12px; opacity: 0.8; margin-top: 16px;">{hashtags}</div>
	{/if}
</div>
