import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment';

const handleWebhook: Handle = async ({ event, resolve }) => {
	// Microsoft Graph webhooks send POST requests with Content-Type: text/plain during validation challenge.
	// We handle the validation challenge directly here to bypass SvelteKit's CSRF protection completely.
	
	let validationToken = event.url.searchParams.get('validationToken') || event.url.searchParams.get('ValidationToken');
	if (!validationToken) {
		// Fallback: search all params case-insensitively
		for (const [key, value] of event.url.searchParams.entries()) {
			if (key.toLowerCase() === 'validationtoken') {
				validationToken = value;
				break;
			}
		}
	}

	// If we see a validation token, we MUST return it as plain text immediately.
	// This makes it bulletproof regardless of the exact path, trailing slashes, or proxies.
	if (validationToken) {
		return new Response(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain' } });
	}

	const pathname = event.url.pathname.replace(/\/$/, '').toLowerCase();
	if (pathname.includes('microsoft-calendar') && event.request.method === 'POST') {
		// If no validationToken is found, but it is a text/plain POST to this endpoint, SvelteKit CSRF will block it.
		// Microsoft Graph might be sending an empty validation challenge? Return 200 just in case it's a ping.
		const contentType = event.request.headers.get('content-type') || '';
		if (contentType.includes('text/plain')) {
			return new Response('OK', { status: 200 });
		}
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
