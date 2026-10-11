import type { RequestHandler } from './$types';
import { syncConditions } from '#lib/server/conditions/service.js';
import * as privateEnv from '$app/env/private';

const CRON_SECRET = (privateEnv as any).CRON_SECRET || process.env.CRON_SECRET;

/**
 * Monthly Automated Runner for Union Contracts, HMO and Social Insurance Conditions
 * 
 * Invoked by Vercel Cron on the 1st of every month:
 * Schedule: 0 2 1 * *
 * 
 * Also supports manual invocation with Authorization: Bearer <CRON_SECRET> or ?token=<CRON_SECRET>
 */
export const GET: RequestHandler = async ({ request, url }) => {
    try {
        const cronHeader = request.headers.get('x-vercel-cron');
        const authHeader = request.headers.get('authorization');
        const queryToken = url.searchParams.get('token');
        const force = url.searchParams.get('force') === 'true';
        const period = url.searchParams.get('period') || undefined;
        const simulateChange = url.searchParams.get('simulate') === 'true';
        const expectedToken = CRON_SECRET;

        // If not triggered by Vercel Cron runner, enforce authorization token if CRON_SECRET is configured
        if (!cronHeader && expectedToken) {
            const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(('Bearer ').length) : undefined;
            const provided = bearer || queryToken || '';
            if (provided !== expectedToken) {
                return Response.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const result = await syncConditions({ force, period, simulateChange });
        return Response.json(result);
    } catch (error: any) {
        console.error('[SyncConditions][GET] Error running conditions sync:', error);
        return Response.json(
            { success: false, error: error?.message || 'Failed to sync conditions' },
            { status: 500 }
        );
    }
};

export const POST: RequestHandler = async ({ request, url }) => {
    try {
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

        let body: any = {};
        try {
            body = await request.json();
        } catch {
            // Empty body is acceptable
        }

        const force = body.force ?? url.searchParams.get('force') === 'true';
        const period = body.period ?? url.searchParams.get('period') ?? undefined;
        const simulateChange = body.simulateChange ?? url.searchParams.get('simulate') === 'true';

        const result = await syncConditions({ force, period, simulateChange });
        return Response.json(result);
    } catch (error: any) {
        console.error('[SyncConditions][POST] Error running conditions sync:', error);
        return Response.json(
            { success: false, error: error?.message || 'Failed to sync conditions' },
            { status: 500 }
        );
    }
};
