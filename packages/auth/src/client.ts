import { createAuthClient as createBetterAuthClient } from "better-auth/svelte";
import { magicLinkClient } from "better-auth/client/plugins";

export function createAuthClient(options: {
    baseURL: string;
}) {
    return createBetterAuthClient({
        baseURL: options.baseURL,
        basePath: "/api/auth",
        plugins: [
            magicLinkClient()
        ]
    });
}
