import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { db, setConnectionString } from "@ac/db";

import {
    DATABASE_URL,
    BETTER_AUTH_SECRET,
    BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET,
    MICROSOFT_TENANT_ID
} from "$app/env/private";

import { getBetterAuthSecondaryStorage } from "#lib/server/cache/index.js";

// Initialize DB connection string from SvelteKit environment
if (DATABASE_URL) {
    setConnectionString(DATABASE_URL);
}

const secondaryStorage = getBetterAuthSecondaryStorage();

export const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    ...secondaryStorage ? { secondaryStorage } : {},
    secret: BETTER_AUTH_SECRET || "development-secret-only-for-build",
    baseURL: BETTER_AUTH_URL || "http://localhost:5175",
    basePath: "/api/auth",
    session: {
        cookieCache: { enabled: true, maxAge: 24 * 60 * 60 // 24 hours
         }
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
            clientId: GOOGLE_CLIENT_ID || "",
            clientSecret: GOOGLE_CLIENT_SECRET || "",
            scope: ["openid", "email", "profile"]
        },
        microsoft: {
            clientId: MICROSOFT_CLIENT_ID || "",
            clientSecret: MICROSOFT_CLIENT_SECRET || "",
            tenantId: MICROSOFT_TENANT_ID || "common"
        }
    },
    plugins: [sveltekitCookies(getRequestEvent)],
} as any);
