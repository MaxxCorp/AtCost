import Ably from 'ably';
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function handleAuth(event: Parameters<RequestHandler>[0]) {
    if (!env.ABLY_API_KEY) {
        return json({ error: 'Missing ABLY_API_KEY' }, { status: 500 });
    }

    const client = new Ably.Rest(env.ABLY_API_KEY);
    try {
        const user = event.locals.user;
        const requestedClientId = event.url.searchParams.get('clientId');
        
        // Use authenticated user ID, or fallback to requested clientId, or generate anonymous ID
        const clientId = user?.id || requestedClientId || `anon-${crypto.randomUUID()}`;

        const tokenParams: Ably.TokenParams = {
            clientId
        };

        const tokenRequestData = await client.auth.createTokenRequest(tokenParams);
        return json(tokenRequestData);
    } catch (err) {
        console.error('Error creating Ably token request:', err);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export const GET: RequestHandler = async (event) => {
    return handleAuth(event);
};

export const POST: RequestHandler = async (event) => {
    return handleAuth(event);
};
