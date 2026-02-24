import { auth } from '$lib/server/auth';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
    try {
        return await auth.handler(request);
    } catch (err) {
        console.error('[auth GET] handler error', err);
        return new Response('Auth GET error', { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        return await auth.handler(request);
    } catch (err) {
        console.error('[auth POST] handler error', err);
        return new Response('Auth POST error', { status: 500 });
    }
};
