import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { db, setConnectionString } from "@ac/db";
import { env } from '$env/dynamic/private';

import { getBetterAuthSecondaryStorage } from "$lib/server/cache";

// Initialize DB connection string from SvelteKit environment
if (env.DATABASE_URL) {
    setConnectionString(env.DATABASE_URL);
}

const secondaryStorage = getBetterAuthSecondaryStorage();

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    ...(secondaryStorage ? { secondaryStorage } : {}),
    secret: env.BETTER_AUTH_SECRET || "development-secret-only-for-build",
    baseURL: env.BETTER_AUTH_URL || "http://localhost:5175",
    basePath: "/api/auth",
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 24 * 60 * 60, // 24 hours
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
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "microsoft"],
            requireLocalEmailVerified: false,
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
            tenantId: env.MICROSOFT_TENANT_ID || "common",
        }
    },
    plugins: [sveltekitCookies(getRequestEvent)],
} as any);
