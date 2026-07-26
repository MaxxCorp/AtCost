import { render } from 'svelte/server';
import EventNotification from '../templates/eMail/EventNotification.svelte';
import MinimalEmail from '../templates/eMail/MinimalEmail.svelte';
import NewsletterEmail from '../templates/eMail/NewsletterEmail.svelte';

export interface EmailTemplateData {
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

export interface EmailTemplateMeta {
	id: string;
	name: string;
	description: string;
}

export const EMAIL_TEMPLATES: Record<string, { meta: EmailTemplateMeta; component: any }> = {
	standard: {
		meta: {
			id: 'standard',
			name: 'Standard Event Notification',
			description: 'Rich HTML notification with full event details, date/time, location, and contact info.'
		},
		component: EventNotification
	},
	minimal: {
		meta: {
			id: 'minimal',
			name: 'Minimal & Direct',
			description: 'Clean layout focused on event title, date, location, and concise summary.'
		},
		component: MinimalEmail
	},
	newsletter: {
		meta: {
			id: 'newsletter',
			name: 'Newsletter Highlight',
			description: 'Modern card-based layout ideal for community announcements and bulletins.'
		},
		component: NewsletterEmail
	}
};

export function getAvailableEmailTemplates(): EmailTemplateMeta[] {
	return Object.values(EMAIL_TEMPLATES).map((t) => t.meta);
}

/**
 * Render a Svelte email component to HTML and plain text.
 */
export function renderEmailTemplate(
	templateId: string,
	data: EmailTemplateData
): { html: string; text: string } {
	const templateConfig = EMAIL_TEMPLATES[templateId] || EMAIL_TEMPLATES.standard;
	const result = render(templateConfig.component, { props: data });
	const html = result.body;
	const text = htmlToPlainText(html);

	return { html, text };
}

export async function renderEmailTemplates(
	data: EmailTemplateData
): Promise<{ html: string; text: string }> {
	return renderEmailTemplate('standard', data);
}

function htmlToPlainText(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n\n')
		.replace(/<\/div>/gi, '\n')
		.replace(/<\/h[1-6]>/gi, '\n\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
