import { describe, it, expect, beforeEach } from 'vitest';
import { InstagramProvider } from './instagram';
import { getAvailableInstagramTemplates, renderInstagramTemplate } from '../../instagram-templates';

describe('Instagram Templates & Provider', () => {
	it('should list available templates', () => {
		const templates = getAvailableInstagramTemplates();
		expect(templates.length).toBeGreaterThanOrEqual(3);
		const ids = templates.map((t) => t.id);
		expect(ids).toContain('standard');
		expect(ids).toContain('minimal');
		expect(ids).toContain('story-banner');
	});

	it('should render standard Instagram template to caption and html', () => {
		const result = renderInstagramTemplate('standard', {
			event: {
				summary: 'Sommerfest 2026',
				description: 'Ein tolles Fest für die ganze Familie',
				location: 'Berlin Park',
				startDateTime: new Date('2026-08-15T14:00:00Z')
			},
			hashtags: '#sommer #fest'
		});

		expect(result.caption).toContain('Sommerfest 2026');
		expect(result.caption).toContain('Berlin Park');
		expect(result.caption).toContain('#sommer #fest');
		expect(result.html).toContain('Sommerfest 2026');
	});

	it('should render minimal Instagram template', () => {
		const result = renderInstagramTemplate('minimal', {
			event: {
				summary: 'Workshops',
				description: 'Interaktiver Workshop'
			},
			hashtags: '#workshop'
		});

		expect(result.caption).toContain('Workshops');
		expect(result.caption).toContain('#workshop');
	});

	it('should push event with mock fallback when credentials absent', async () => {
		const provider = new InstagramProvider();
		await provider.initialize({
			id: 'sync-1',
			userId: 'user-1',
			providerId: 'instagram-test',
			providerType: 'instagram',
			direction: 'push',
			enabled: true,
			settings: {
				selectedTemplate: 'standard',
				defaultHashtags: '#test'
			},
			createdAt: new Date(),
			updatedAt: new Date()
		});

		const valid = await provider.validateConnection();
		expect(valid).toBe(true);

		const result = await provider.pushEvent({
			externalId: '',
			providerId: 'instagram-test',
			summary: 'Test Event',
			description: 'Description text'
		});

		expect(result.externalId).toMatch(/^ig_post_/);
		expect(result.etag).toBeDefined();
	});
});
