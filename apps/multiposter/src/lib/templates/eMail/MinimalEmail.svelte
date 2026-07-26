<script lang="ts">
	interface Props {
		event: {
			summary: string;
			description?: string;
			startDate?: string;
			startDateTime?: Date | string;
			location?: string;
		};
		isAnnouncement?: boolean;
		contactInfo?: {
			name: string;
			email: string;
		};
	}

	let { event, isAnnouncement = false, contactInfo }: Props = $props();

	function formatDate(dateVal?: Date | string): string {
		if (!dateVal) return '';
		const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
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

	let formattedStart = $derived(formatDate(event.startDateTime || event.startDate));
</script>

<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>{event.summary}</title>
	<style>
		body { font-family: sans-serif; line-height: 1.5; color: #111827; max-width: 550px; margin: 0 auto; padding: 20px; }
		.card { border-left: 4px solid #10b981; padding-left: 16px; margin-bottom: 20px; }
		h2 { margin: 0 0 8px 0; font-size: 20px; color: #111827; }
		.meta { font-size: 14px; color: #4b5563; margin-bottom: 12px; }
		.desc { font-size: 15px; margin-top: 12px; white-space: pre-wrap; }
		.footer { font-size: 12px; color: #9ca3af; border-top: 1px dashed #e5e7eb; padding-top: 12px; margin-top: 24px; }
	</style>
</head>
<body>
	<div class="card">
		<h2>{event.summary}</h2>
		<div class="meta">
			{#if !isAnnouncement && formattedStart}
				<span>📅 {formattedStart}</span>
			{/if}
			{#if event.location}
				<span> &bull; 📍 {event.location}</span>
			{/if}
		</div>
		{#if event.description}
			<div class="desc">{event.description}</div>
		{/if}
	</div>

	{#if contactInfo?.name}
		<p style="font-size: 13px; color: #6b7280;">
			Kontakt: {contactInfo.name} ({contactInfo.email})
		</p>
	{/if}

	<div class="footer">
		AC-Multiposter Email Service
	</div>
</body>
</html>
