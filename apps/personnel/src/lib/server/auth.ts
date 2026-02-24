import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { db } from "$lib/server/db";
import { env } from '$env/dynamic/private';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    secret: env.BETTER_AUTH_SECRET || "development-secret-only-for-build",
    baseURL: env.BETTER_AUTH_URL || "http://localhost:5174",
    basePath: "/api/auth",
    trustHost: true,
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 30 * 60,
        },
    },
    user: {
        additionalFields: {
            roles: {
                type: "json",
                required: false,
                input: false,
            },
            claims: {
                type: "json",
                required: false,
                input: false,
            },
        },
    },
    socialProviders: {
        google: {
            clientId: env.GOOGLE_CLIENT_ID || "",
            clientSecret: env.GOOGLE_CLIENT_SECRET || "",
            scope: [
                "openid",
                "email",
                "profile",
            ],
        },
        microsoft: {
            clientId: env.MICROSOFT_CLIENT_ID || "",
            clientSecret: env.MICROSOFT_CLIENT_SECRET || "",
        }
    },
    plugins: [sveltekitCookies(getRequestEvent)],
});
