import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, event, desc } from '@ac/db';
import { posCorsHeaders } from '#lib/server/pos/openapi.js';

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: posCorsHeaders });
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const events = await db.query.event.findMany({
			orderBy: [desc(event.startDateTime), desc(event.createdAt)],
			with: {
				prices: {
					with: {
						price: {
							with: {
								items: true
							}
						}
					}
				},
				contacts: true
			}
		});

		const sellableEvents = events
			.filter((ev) => (ev.prices?.length ?? 0) > 0)
			.map((ev) => {
				const currencies = new Set<string>();
				for (const ep of ev.prices ?? []) {
					if (ep.price?.currency) currencies.add(ep.price.currency);
				}
				return {
					id: ev.id,
					summary: ev.summary,
					startDateTime: ev.startDateTime ? ev.startDateTime.toISOString() : null,
					endDateTime: ev.endDateTime ? ev.endDateTime.toISOString() : null,
					currency: Array.from(currencies)[0] ?? 'EUR',
					participantsCount: Math.max(1, ev.contacts?.length ?? 0),
					priceListsCount: ev.prices?.length ?? 0,
					qrCodeUrl: `${url.origin}/api/events/${ev.id}/qr.png`,
					itemsEndpoint: `${url.origin}/api/pos/events/${ev.id}/items`,
					salesEndpoint: `${url.origin}/api/pos/events/${ev.id}/sales`
				};
			});

		return json({ data: sellableEvents }, { headers: posCorsHeaders });
	} catch (err: any) {
		return json(
			{ error: err?.message ?? 'Failed to list POS events' },
			{ status: 500, headers: posCorsHeaders }
		);
	}
};
