import { render } from 'svelte/server';
import StandardPost from '$lib/templates/instagram/StandardPost.svelte';
import MinimalPost from '$lib/templates/instagram/MinimalPost.svelte';
import StoryBanner from '$lib/templates/instagram/StoryBanner.svelte';

export interface InstagramTemplateData {
	event: {
		summary: string;
		description?: string;
		startDateTime?: Date | string;
		endDateTime?: Date | string;
		location?: string;
		ticketPrice?: string;
		organizer?: {
			name: string;
			email?: string;
			phone?: string;
			website?: string;
		};
	};
	hashtags?: string;
}

export interface InstagramTemplateMeta {
	id: string;
	name: string;
	description: string;
}

export const INSTAGRAM_TEMPLATES: Record<string, { meta: InstagramTemplateMeta; component: any }> = {
	standard: {
		meta: {
			id: 'standard',
			name: 'Standard Event Post',
			description: 'Feature-rich post template with emojis, date/time, location, and hashtags.'
		},
		component: StandardPost
	},
	minimal: {
		meta: {
			id: 'minimal',
			name: 'Minimal & Punchy',
			description: 'Concise summary ideal for fast scrolling on Instagram feed.'
		},
		component: MinimalPost
	},
	'story-banner': {
		meta: {
			id: 'story-banner',
			name: 'Story Banner Layout',
			description: 'Vibrant highlight design layout suitable for Instagram Stories and highlights.'
		},
		component: StoryBanner
	}
};

export function getAvailableInstagramTemplates(): InstagramTemplateMeta[] {
	return Object.values(INSTAGRAM_TEMPLATES).map((t) => t.meta);
}

/**
 * Render a Svelte component template to Instagram caption text and HTML.
 */
export function renderInstagramTemplate(
	templateId: string,
	data: InstagramTemplateData
): { caption: string; html: string } {
	const templateConfig = INSTAGRAM_TEMPLATES[templateId] || INSTAGRAM_TEMPLATES.standard;
	const result = render(templateConfig.component, { props: data });
	const html = result.body;

	// Convert HTML output to clean Instagram text caption
	const caption = htmlToInstagramCaption(html);

	return { caption, html };
}

function htmlToInstagramCaption(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<\/div>/gi, '\n')
		.replace(/<strong>(.*?)<\/strong>/gi, '*$1*')
		.replace(/<b>(.*?)<\/b>/gi, '*$1*')
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
