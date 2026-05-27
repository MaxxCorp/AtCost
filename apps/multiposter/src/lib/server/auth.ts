import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { db, setConnectionString } from "@ac/db";
import { env } from '$env/dynamic/private';

// Initialize DB connection string from SvelteKit environment
if (env.DATABASE_URL) {
    setConnectionString(env.DATABASE_URL);
}

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    secret: env.BETTER_AUTH_SECRET || "development-secret-only-for-build",
    baseURL: env.BETTER_AUTH_URL || "http://localhost:5173",
    basePath: "/api/auth",
    trustHost: true,
    onAPIError: {
        throw: true,
        onError: (error) => {
            console.error("[BetterAuth API Error]:", error);
        }
    },
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
            clientId: env.MICROSOFT_CLIENT_ID || "",
            clientSecret: env.MICROSOFT_CLIENT_SECRET || "",
            tenantId: env.MICROSOFT_TENANT_ID || "common",
            scope: [
                "openid",
                "profile",
                "email",
                "Calendars.ReadWrite",
                "offline_access"
            ],
            mapProfileToUser: (profile) => {
                const email = (profile as any).email || (profile as any).mail || (profile as any).userPrincipalName || (profile as any).preferred_username;
                return {
                    email: email,
                    name: profile.name || (profile as any).displayName || (profile as any).userPrincipalName,
                    image: profile.picture,
                    claims: {
                        ...(profile as any),
                        email: email
                    }
                };
            },
        }
    },
    plugins: [sveltekitCookies(getRequestEvent)],
});
