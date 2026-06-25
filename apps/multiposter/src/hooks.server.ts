import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment';

const handleWebhook: Handle = async ({ event, resolve }) => {
	// Microsoft Graph webhooks send POST requests with Content-Type: text/plain during validation challenge.
	// Since they don't include an Origin header, SvelteKit's built-in CSRF protection blocks them.
	// We handle the validation challenge directly here to bypass CSRF, and to avoid a static import
	// of the actual route, which would cause Vercel's NFT to bundle `syncService` and heavy dependencies
	// like `sharp` into every single Vercel Serverless Function.
	const pathname = event.url.pathname.replace(/\/$/, '').toLowerCase();
	if (pathname === '/api/sync/webhook/microsoft-calendar' && event.request.method === 'POST') {
		const validationToken = event.url.searchParams.get('validationToken') || event.url.searchParams.get('ValidationToken');
		if (validationToken) {
			return new Response(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain' } });
		}
		
		// If it's a POST to this endpoint but no validation token, it might be a normal webhook event.
		// Normal webhook events are application/json, so SvelteKit CSRF won't block them.
		// We can just let it fall through to resolve(event).
	}

	return resolve(event);
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const result = await auth.api.getSession({ headers: event.request.headers });
	const session = result?.session ?? null;
	event.locals.session = session;
	event.locals.user = result?.user ?? null;
	return svelteKitHandler({ event, resolve, auth, building });
};

const handleRouteGuard: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const protectedRoots = [
		'/announcements',
		'/campaigns',
		'/cms',
		'/contacts',
		'/events',
		'/kiosks',
		'/locations',
		'/resources',
		'/synchronizations',
		'/tags',
		'/talents',
		'/users'
	];

	const path = event.url.pathname;
	
	const isProtectedRoute = protectedRoots.some(root => path === root || path.startsWith(`${root}/`));
	const isPublicViewRoute = path.endsWith('/view');

	if (isProtectedRoute && !isPublicViewRoute) {
		if (!event.locals.user) {
			// Redirect unauthenticated users to the login page
			// Add a redirectTo param so we can send them back after login if desired
			const fromUrl = event.url.pathname + event.url.search;
			throw redirect(303, `/login?redirectTo=${encodeURIComponent(fromUrl)}`);
		}
	}

	return resolve(event);
};

export const handle: Handle = sequence(handleWebhook, handleBetterAuth, handleRouteGuard);
