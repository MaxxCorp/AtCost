import { createAuth } from "@ac/auth/server";
import { getRequestEvent } from "$app/server";
import { db } from "$lib/server/db";
import { env } from '$env/dynamic/private';

export const auth = createAuth(db, {
    secret: env.BETTER_AUTH_SECRET || "development-secret-only-for-build",
    baseURL: env.BETTER_AUTH_URL || "http://localhost:5173",
    google: (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
    } : undefined,
    microsoft: (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) ? {
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
    } : undefined,
    getRequestEvent
});