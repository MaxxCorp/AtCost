import { createAuthClient } from "better-auth/svelte";
import { PUBLIC_BASE_URL } from "$env/static/public";

export const authClient = createAuthClient({
    baseURL: typeof window !== 'undefined' ? window.location.origin : (PUBLIC_BASE_URL || "http://localhost:5175"),
    basePath: "/api/auth",
});
