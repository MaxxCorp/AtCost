import Ably from 'ably';
import { ABLY_API_KEY } from '$app/env/private';
import type { RequestHandler } from './$types';
import { getRealtimeInfo } from '#lib/server/realtime.js';

async function handleAuth(event: Parameters<RequestHandler>[0]) {
    if (!ABLY_API_KEY) {
        const info = getRealtimeInfo();
        return Response.json(
            {
                error: 'Ably is not configured',
                enabled: false,
                fallbackProvider: info.provider
            },
            { status: 503 }
        );
    }

    const client = new Ably.Rest(ABLY_API_KEY);
    try {
        const user = event.locals.user;
        const requestedClientId = event.url.searchParams.get('clientId');
        
        // Use authenticated user ID, or fallback to requested clientId, or generate anonymous ID
        const clientId = user?.id || requestedClientId || `anon-${crypto.randomUUID()}`;

        const tokenParams: Ably.TokenParams = {
            clientId
        };

        const tokenRequestData = await client.auth.createTokenRequest(tokenParams);
        return Response.json(tokenRequestData);
    } catch (err) {
        console.warn('[Ably Auth] Error creating Ably token request:', err);
        return Response.json({ error: 'Ably token request failed' }, { status: 500 });
    }
}

export const GET: RequestHandler = async (event) => {
    return handleAuth(event);
};

export const POST: RequestHandler = async (event) => {
    return handleAuth(event);
};
