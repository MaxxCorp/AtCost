import { syncService } from '$lib/server/sync/service';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Microsoft Graph Calendar push notification webhook handler
 * https://learn.microsoft.com/en-us/graph/webhooks
 */
export async function POST(event: RequestEvent) {
	const url = new URL(event.request.url);
	
	// 1. Handle Validation Challenge
	// When creating a subscription, MS Graph sends a POST with a validationToken query parameter.
	// We MUST return the exact token in the response body as plain text within 10 seconds.
	const validationToken = url.searchParams.get('validationToken');
	if (validationToken) {
		return new Response(validationToken, {
			status: 200,
			headers: {
				'Content-Type': 'text/plain'
			}
		});
	}

	// 2. Handle actual notifications
	try {
		const payload = await event.request.json();
		
		if (payload && Array.isArray(payload.value)) {
			// Pass the payload to the sync service which will trigger the syncs
			await syncService.handleWebhook('microsoft-calendar', payload);
		}

		// Always return 202 Accepted (or 200) to acknowledge receipt
		return new Response(null, { status: 202 });
	} catch (error: any) {
		console.error('Failed to handle Microsoft Calendar webhook:', error);
		return new Response('Internal server error', { status: 500 });
	}
}
