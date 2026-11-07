import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEventSalesAndFinancials } from '#lib/server/events/sales.js';
import { posCorsHeaders } from '#lib/server/pos/openapi.js';

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: posCorsHeaders });
};

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const financials = await getEventSalesAndFinancials({ eventId: params.id });
		return json(
			{
				eventId: financials.eventId,
				eventSummary: financials.eventSummary,
				currency: financials.currency,
				participantsCount: financials.participantsCount,
				qrCodeUrl: `${url.origin}/api/events/${financials.eventId}/qr.png`,
				items: financials.itemSummaries
			},
			{ headers: posCorsHeaders }
		);
	} catch (err: any) {
		const status = err?.message === 'Event not found' ? 404 : 500;
		return json(
			{ error: err?.message ?? 'Failed to fetch event items' },
			{ status, headers: posCorsHeaders }
		);
	}
};
