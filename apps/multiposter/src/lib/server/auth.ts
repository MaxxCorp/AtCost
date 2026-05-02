import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { db, setDatabaseUrl } from "@ac/db";
import { env } from '$env/dynamic/private';

if (env.DATABASE_URL) {
    setDatabaseUrl(env.DATABASE_URL);
}

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustHost: true,
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 30 * 60, // 30 minutes
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
                "https://www.googleapis.com/auth/calendar"
            ],
            accessType: "offline",
            prompt: "consent"
        },
        microsoft: {
            clientId: env.MICROSOFT_CLIENT_ID,
            clientSecret: env.MICROSOFT_CLIENT_SECRET,
            tenantId: env.MICROSOFT_TENANT_ID,
            scope: [
                "openid",
                "email",
                "profile",
                "User.Read",
                "offline_access",
                "Calendars.ReadWrite.Shared"
            ],
            accessType: "offline",
            prompt: "consent"
        }
    },
    plugins: [sveltekitCookies(getRequestEvent)],
});
