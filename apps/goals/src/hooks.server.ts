import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { DATABASE_URL } from '$app/env/private';

if (DATABASE_URL) {
    process.env.DATABASE_URL = DATABASE_URL.replace(/^"|"$/g, '');
}

import { auth } from "#lib/server/auth.js";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building, dev } from '$app/env';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
    try {
        const result = await auth.api.getSession({ headers: event.request.headers });
        event.locals.session = result?.session ?? null;
        event.locals.user = result?.user ?? null;
    } catch {
        event.locals.session = null;
        event.locals.user = null;
    }

    return svelteKitHandler({ event, resolve, auth, building });
};

const handleMockAuth: Handle = async ({ event, resolve }) => {
    if (!dev) return resolve(event);

    const isRemoteFunction = event.url.pathname.startsWith('/_app/remote');
    const isStaticAsset = !isRemoteFunction && (
        (event.url.pathname.includes('.') && !event.url.pathname.includes('/_app/')) ||
        (event.url.pathname.startsWith('/_') && !event.url.pathname.startsWith('/_app/remote')) ||
        event.url.pathname.startsWith('/favicon')
    );

    if (!isStaticAsset && !event.locals.user) {
        const persona = event.cookies.get('ac_goals_dev_persona') || 'operator';
        if (persona === 'guest') {
            return resolve(event);
        }

        if (persona === 'community') {
            (event.locals as any).user = {
                id: 'community-user-1',
                email: 'member@community.org',
                emailVerified: true,
                name: 'Elena Weber (Community Member)',
                createdAt: new Date(),
                updatedAt: new Date(),
                roles: ['user'],
                claims: {}
            };
        } else {
            (event.locals as any).user = {
                id: 'mock-operator',
                email: 'operator@atcost.org',
                emailVerified: true,
                name: 'Operator Admin',
                createdAt: new Date(),
                updatedAt: new Date(),
                roles: ['admin', 'operator'],
                claims: { goals: true, locations: true, tags: true, users: true }
            };
        }

        (event.locals as any).session = {
            id: `mock-session-${persona}`,
            userId: (event.locals as any).user.id,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
            token: `mock-token-${persona}`,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    return resolve(event);
};

const handleParaglide: Handle = ({ event, resolve }) => paraglideMiddleware(event.request, ({ locale }) => {
    return resolve(event, {
        transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
    });
});

export const handle: Handle = dev
    ? sequence(handleBetterAuth, handleMockAuth, handleParaglide)
    : sequence(handleBetterAuth, handleParaglide);
