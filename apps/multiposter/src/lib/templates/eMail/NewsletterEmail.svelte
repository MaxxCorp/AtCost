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
		if (!dateVal) return '';
		const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('de-DE', {
			weekday: 'long',
			day: '2-digit',
			month: 'long',
			year: 'numeric',
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
	<title>{event.summary}</title>
	<style>
		body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 32px 16px; }
		.wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); overflow: hidden; }
		.banner { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px 24px; text-align: center; color: #ffffff; }
		.badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
		.title { font-size: 26px; font-weight: 800; margin: 0; line-height: 1.2; }
		.content { padding: 28px 24px; }
		.info-grid { display: grid; grid-template-cols: 1fr; gap: 12px; margin-bottom: 20px; background-color: #faf5ff; border: 1px solid #f3e8ff; border-radius: 12px; padding: 16px; }
		.info-item { font-size: 14px; font-weight: 600; color: #6b21a8; }
		.description { font-size: 15px; line-height: 1.7; color: #374151; white-space: pre-wrap; margin-bottom: 24px; }
		.contact-box { background: #f9fafb; border-radius: 12px; padding: 16px; border: 1px solid #f3f4f6; font-size: 14px; }
		.footer { text-align: center; padding: 20px; font-size: 12px; color: #9ca3af; }
	</style>
</head>
<body>
	<div class="wrapper">
		<div class="banner">
			<span class="badge">{isAnnouncement ? 'Community Update' : 'Veranstaltungs-Highlight'}</span>
			<h1 class="title">{event.summary}</h1>
		</div>

		<div class="content">
			<div class="info-grid">
				{#if !isAnnouncement && formattedStart}
					<div class="info-item">📅 {formattedStart}{#if formattedEnd} — {formattedEnd}{/if}</div>
				{/if}
				{#if event.location}
					<div class="info-item">📍 {event.location}</div>
				{/if}
			</div>

			{#if event.description}
				<div class="description">{event.description}</div>
			{/if}

			{#if contactInfo?.name}
				<div class="contact-box">
					<p style="margin: 0; font-weight: 700; color: #111827;">Organisator & Kontakt</p>
					<p style="margin: 4px 0 0 0; color: #4b5563;">{contactInfo.name} &bull; <a href="mailto:{contactInfo.email}" style="color: #4f46e5;">{contactInfo.email}</a></p>
				</div>
			{/if}
		</div>
	</div>

	<div class="footer">
		AC-Multiposter Bulletin Service
	</div>
</body>
</html>
