import { sequence } from '@sveltejs/kit/hooks';
import { type Handle } from '@sveltejs/kit';
import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building, dev } from '$app/environment';
import { paraglideMiddleware } from '$lib/paraglide/server';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
    const result = await auth.api.getSession({ headers: event.request.headers });
    event.locals.session = result?.session ?? null;
    event.locals.user = result?.user ?? null;
    
    return svelteKitHandler({ event, resolve, auth, building });
};

const handleMockAuth: Handle = async ({ event, resolve }) => {
    // SECURITY: NEVER RUN IN PRODUCTION
    if (!dev) return resolve(event);

     // Inject mock user for debugging if not authenticated
    const isStaticAsset = event.url.pathname.includes('.') || event.url.pathname.startsWith('/_') || event.url.pathname.startsWith('/favicon');
    
    if (!isStaticAsset && !event.locals.user) {
        (event.locals as any).user = {
            id: 'mock-user',
            email: 'admin@example.com',
            emailVerified: true,
            name: 'Mock Admin',
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: '["admin"]'
        };
        (event.locals as any).session = {
            id: 'mock-session',
            userId: 'mock-user',
            expiresAt: new Date(Date.now() + 1000 * 60 * 60),
            token: 'mock-token',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    return resolve(event);
};

const handleParaglide: Handle = ({ event, resolve }) => paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;

    return resolve(event, {
        transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
    });
});

export const handle: Handle = sequence(handleBetterAuth, handleMockAuth, handleParaglide);
