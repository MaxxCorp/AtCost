<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        authClient: any;
        callbackURL?: string;
    }

    let { authClient: client, callbackURL = "/" }: Props = $props();

    let loading = $state(false);
    let error = $state<string | null>(null);

    async function handleSocialSignIn(
        event: MouseEvent,
        provider: "google" | "microsoft",
    ) {
        event.preventDefault();
        event.stopPropagation();
        console.log("handleSocialSignIn called for", provider);
        console.log("authClient keys:", Object.keys(client || {}));
        if (client?.signIn) {
            console.log("authClient.signIn keys:", Object.keys(client.signIn));
        } else {
            console.error("authClient.signIn is undefined");
        }

        try {
            loading = true;
            error = null;
            console.log("Calling client.signIn.social...");
            const result = await client.signIn.social({
                provider,
                callbackURL,
            });
            console.log("client.signIn.social returned:", result);
        } catch (e: any) {
            console.error("Social sign in error:", e);
            error = e.message || "Failed to sign in";
            loading = false;
        }
    }
</script>

<div class="w-full space-y-6">
    <div class="text-center">
        <h2 class="text-2xl font-bold text-gray-900">Welcome back</h2>
        <p class="text-sm text-gray-500">Sign in to your account to continue</p>
    </div>

    {#if error}
        <div
            class="p-3 text-sm text-red-500 bg-red-50 rounded-lg border border-red-100"
        >
            {error}
        </div>
    {/if}

    <div class="space-y-4 relative z-50 p-1">
        <button
            type="button"
            onclick={(e) => handleSocialSignIn(e, "google")}
            disabled={loading}
            class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium transition-all bg-white border border-input rounded-md shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 relative z-50 cursor-pointer gap-3"
        >
            <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
            </svg>
            Continue with Google
        </button>

        <button
            type="button"
            onclick={(e) => handleSocialSignIn(e, "microsoft")}
            disabled={loading}
            class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium transition-all bg-white border border-input rounded-md shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 relative z-50 cursor-pointer gap-3"
        >
            <svg class="w-5 h-5 shrink-0" viewBox="0 0 23 23">
                <rect width="11" height="11" fill="#F25022" />
                <rect x="12" width="11" height="11" fill="#7FBA00" />
                <rect y="12" width="11" height="11" fill="#00A4EF" />
                <rect x="12" y="12" width="11" height="11" fill="#FFB900" />
            </svg>
            Continue with Microsoft
        </button>
    </div>

    <!-- Magic Link removed as per visual style alignment -->
</div>
