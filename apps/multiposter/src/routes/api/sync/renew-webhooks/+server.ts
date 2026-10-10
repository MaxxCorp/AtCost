import type { RequestHandler } from './$types';
import { syncService } from '#lib/server/sync/service.js';
import { CRON_SECRET } from '$app/env/private';

/**
 * API endpoint to renew expiring webhooks
 * This should be called periodically (e.g., via a cron job)
 * 
 * To set up a cron job:
 * - Use a service like cron-job.org, EasyCron, or GitHub Actions
 * - Schedule to run daily: curl -X POST https://your-domain.com/api/sync/renew-webhooks
 * - Or use Vercel Cron: https://vercel.com/docs/cron-jobs
 */
export const POST: RequestHandler = async ({ request, url }) => {
	try {
		// Authentication: Support Authorization header OR query param (?token=)
		const authHeader = request.headers.get('authorization');
		const queryToken = url.searchParams.get('token');
		const expectedToken = CRON_SECRET;

		if (expectedToken) {
			const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(('Bearer ').length) : undefined;
			const provided = bearer || queryToken || '';
			if (provided !== expectedToken) {
				return Response.json({ error: 'Unauthorized' }, { status: 401 });
			}
		}

		await syncService.renewWebhooks();
		const pruned = await syncService.pruneOldOperations();

		return Response.json({
			success: true,
			message: 'Webhooks renewed and old operations pruned successfully',
			pruned
		});
	} catch (error: any) {
		console.error('[RenewWebhooks][POST] Error renewing webhooks:', error);
		return Response.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
};

// Vercel Cron performs a GET request. Support GET with same logic as POST.
export const GET: RequestHandler = async ({ request, url }) => {
	try {
		const cronHeader = request.headers.get('x-vercel-cron');
		const expectedToken = CRON_SECRET;
		const authHeader = request.headers.get('authorization');
		const queryToken = url.searchParams.get('token');

		// If triggered by Vercel Cron, allow regardless of token (can't include headers or query secrets in vercel.json)
		// Otherwise, if CRON_SECRET is set, require a matching token via header or query param
		if (!cronHeader) {
			if (expectedToken) {
				const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(('Bearer ').length) : undefined;
				const provided = bearer || queryToken || '';
				if (provided !== expectedToken) {
					return Response.json({ error: 'Unauthorized' }, { status: 401 });
				}
			} else {
				return Response.json({ error: 'Forbidden' }, { status: 403 });
			}
		}

		await syncService.renewWebhooks();
		const pruned = await syncService.pruneOldOperations();

		return Response.json({
			success: true,
			message: 'Webhooks renewed and old operations pruned successfully',
			pruned
		});
	} catch (error: any) {
		console.error('[RenewWebhooks][GET] Error renewing webhooks:', error);
		return Response.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
};
