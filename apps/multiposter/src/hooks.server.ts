import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment';

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

const handleParaglide: Handle = ({ event, resolve }) => paraglideMiddleware(event.request, ({ request, locale }) => {
	event.request = request;

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
	});
});

export const handle: Handle = sequence(handleBetterAuth, handleRouteGuard, handleParaglide);
