import { auth } from '$lib/auth';
import type { RequestHandler } from '@sveltejs/kit';

// Catch-all auth endpoint to support Better Auth routes like:
// /api/auth/get-session, /api/auth/sign-in, /api/auth/callback/google, etc.
// SvelteKit v2 requires +server.ts naming; placing this inside a
// `[...all]` directory makes it a wildcard for all subpaths.
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
