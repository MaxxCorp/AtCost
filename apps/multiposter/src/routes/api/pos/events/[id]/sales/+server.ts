import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { recordEventSalesSchema } from '@ac/validations';
import {
	getEventSalesAndFinancials,
	recordEventSales,
	removeEventSaleRecord
} from '#lib/server/events/sales.js';
import { posCorsHeaders } from '#lib/server/pos/openapi.js';

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: posCorsHeaders });
};

export const GET: RequestHandler = async ({ params }) => {
	try {
		const financials = await getEventSalesAndFinancials({ eventId: params.id });
		return json(financials, { headers: posCorsHeaders });
	} catch (err: any) {
		const status = err?.message === 'Event not found' ? 404 : 500;
		return json(
			{ error: err?.message ?? 'Failed to fetch event sales' },
			{ status, headers: posCorsHeaders }
		);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const payload = {
			...body,
			eventId: params.id,
			source: body.source ?? 'pos'
		};

		const parsed = v.safeParse(recordEventSalesSchema, payload);
		if (!parsed.success) {
			return json(
				{
					error: 'Validation failed',
					issues: parsed.issues.map((i) => ({
						path: i.path?.map((p) => p.key).join('.') ?? '',
						message: i.message
					}))
				},
				{ status: 400, headers: posCorsHeaders }
			);
		}

		const result = await recordEventSales(parsed.output);
		return json(result, { headers: posCorsHeaders });
	} catch (err: any) {
		const status = err?.message === 'Event not found' ? 404 : 400;
		return json(
			{ error: err?.message ?? 'Failed to record sales' },
			{ status, headers: posCorsHeaders }
		);
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	try {
		const saleId = url.searchParams.get('saleId');
		if (!saleId) {
			return json(
				{ error: 'Missing required query parameter: saleId' },
				{ status: 400, headers: posCorsHeaders }
			);
		}
		const restoreInventory = url.searchParams.get('restoreInventory') !== 'false';
		const result = await removeEventSaleRecord({
			eventId: params.id,
			saleId,
			restoreInventory
		});
		return json(result, { headers: posCorsHeaders });
	} catch (err: any) {
		const status = err?.message === 'Sale record not found' ? 404 : 400;
		return json(
			{ error: err?.message ?? 'Failed to delete sale record' },
			{ status, headers: posCorsHeaders }
		);
	}
};
