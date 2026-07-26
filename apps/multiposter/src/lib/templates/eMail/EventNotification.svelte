<script lang="ts">
	interface Props {
		event: {
			summary: string;
			description?: string;
			startDate?: string;
			startDateTime?: Date | string;
			endDate?: string;
			endDateTime?: Date | string;
			location?: string;
			recurrence?: string[];
		};
		isAnnouncement?: boolean;
		contactInfo?: {
			name: string;
			email: string;
			phone?: string;
		};
	}

	let { event, isAnnouncement = false, contactInfo }: Props = $props();

	function formatDate(dateVal?: Date | string): string {
		if (!dateVal) return 'Nicht angegeben';
		const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
		if (isNaN(d.getTime())) return 'Nicht angegeben';
		return d.toLocaleDateString('de-DE', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let formattedStart = $derived(formatDate(event.startDateTime || event.startDate));
	let formattedEnd = $derived(formatDate(event.endDateTime || event.endDate));
</script>

<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>{isAnnouncement ? 'Ankündigung' : 'Neue Veranstaltung'}: {event.summary}</title>
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f9fafb; }
		.container { background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
		.header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; padding: 28px 24px; text-align: left; }
		.header h1 { margin: 0 0 6px 0; font-size: 14px; text-transform: uppercase; tracking: 0.05em; opacity: 0.85; font-weight: 600; }
		.event-title { font-size: 22px; font-weight: 700; margin: 0; line-height: 1.3; }
		.body-content { padding: 24px; }
		.detail-card { background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
		.detail-row { margin-bottom: 12px; }
		.detail-row:last-child { margin-bottom: 0; }
		.detail-label { font-weight: 600; color: #374151; width: 110px; display: inline-block; }
		.contact-card { border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px; }
		.contact-card h3 { margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #6b7280; font-weight: 600; }
		.footer { font-size: 12px; color: #9ca3af; text-align: center; margin-top: 24px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>{isAnnouncement ? 'Ankündigung' : 'Neue Veranstaltung'}</h1>
			<div class="event-title">{event.summary}</div>
		</div>

		<div class="body-content">
			<div class="detail-card">
				{#if !isAnnouncement}
					<div class="detail-row">
						<span class="detail-label">📅 Beginn:</span> {formattedStart}
					</div>
					{#if formattedEnd !== 'Nicht angegeben'}
						<div class="detail-row">
							<span class="detail-label">⏰ Ende:</span> {formattedEnd}
						</div>
					{/if}
				{/if}

				{#if event.location}
					<div class="detail-row">
						<span class="detail-label">📍 Ort:</span> {event.location}
					</div>
				{/if}

				{#if event.recurrence && event.recurrence.length > 0}
					<div class="detail-row">
						<span class="detail-label">🔄 Wiederholung:</span> {event.recurrence.join(', ')}
					</div>
				{/if}
			</div>

			{#if event.description}
				<div class="detail-row">
					<strong>Beschreibung:</strong>
					<p style="margin-top: 4px; white-space: pre-wrap;">{event.description}</p>
				</div>
			{/if}

			{#if contactInfo}
				<div class="contact-card">
					<h3>Kontakt</h3>
					<p style="margin: 0;"><strong>{contactInfo.name}</strong></p>
					{#if contactInfo.email}
						<p style="margin: 2px 0 0 0;"><a href="mailto:{contactInfo.email}" style="color: #2563eb;">{contactInfo.email}</a></p>
					{/if}
					{#if contactInfo.phone}
						<p style="margin: 2px 0 0 0;"><a href="tel:{contactInfo.phone}" style="color: #2563eb;">{contactInfo.phone}</a></p>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="footer">
		<p>Diese E-Mail wurde automatisch von AC-Multiposter generiert.</p>
	</div>
</body>
</html>
