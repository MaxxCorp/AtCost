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
    baseURL: env.BETTER_AUTH_URL || "http://localhost:5173",
    basePath: "/api/auth",
    onAPIError: {
        throw: true,
        onError: (error: unknown) => {
            console.error("[BetterAuth API Error]:", error);
        }
    },
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
                "Calendars.ReadWrite.Shared",
                "offline_access"
            ],
            mapProfileToUser: (profile: any) => {
                const email = (profile as any).email || (profile as any).mail || (profile as any).userPrincipalName || (profile as any).preferred_username;
                return {
                    email: email,
                    name: profile.name || (profile as any).displayName || (profile as any).userPrincipalName,
                    image: profile.picture,
                    emailVerified: true,
                };
            },
        }
    },
    plugins: [sveltekitCookies(getRequestEvent)],
} as any);
