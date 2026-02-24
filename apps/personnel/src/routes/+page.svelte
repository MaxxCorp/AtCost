<script lang="ts">
    import { authClient } from "$lib/auth";
    import DashboardCard from "@ac/ui/components/DashboardCard.svelte";
    import { hasAccess, parseRoles, parseClaims } from "$lib/authorization";
    import { FEATURES, getVisibleFeatures } from "$lib/features";
    import LoadingSection from "@ac/ui/components/LoadingSection.svelte";

    let sessionPromise = $state(loadSession());

    async function loadSession() {
        const session = await authClient.getSession();
        const user = session?.data?.user;
        return {
            user,
            userRoles: user ? parseRoles(user) : [],
            userClaims: user ? parseClaims(user) : null,
        };
    }
</script>

<div class="space-y-8">
    {#await sessionPromise}
        <LoadingSection message="Loading your dashboard..." />
    {:then { user, userRoles, userClaims }}
        {#if user}
            <div
                class="bg-white rounded-lg shadow-sm border border-gray-200 p-8"
            >
                <div
                    class="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6"
                >
                    <h3 class="font-semibold text-emerald-900 mb-2">
                        Welcome to AC Personnel!
                    </h3>
                    <p class="text-emerald-800 text-sm">
                        You're successfully signed in. This is your HR
                        management dashboard where you can manage employees,
                        locations, and access controls.
                    </p>
                </div>
                <div
                    class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-stretch"
                >
                    {#each getVisibleFeatures(user, hasAccess) as f (f.key)}
                        <DashboardCard
                            title={f.title}
                            description={f.description}
                            href={f.href}
                            buttonText={f.buttonText}
                            visible={true}
                            gradientFrom={f.gradientFrom}
                            gradientTo={f.gradientTo}
                            borderClass={f.borderClass}
                            buttonClass={f.buttonClass}
                            icon={f.icon}
                            iconClass={f.icon === "users"
                                ? "text-indigo-600"
                                : f.icon === "mapPin"
                                  ? "text-orange-600"
                                  : "text-rose-600"}
                        />
                    {/each}
                </div>
            </div>
        {:else}
            <div
                class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center"
            >
                <svg
                    class="w-16 h-16 text-gray-400 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">
                    Welcome to AC Personnel
                </h2>
                <p class="text-gray-600 mb-6">
                    Sign in using the sidebar to get started with your HR
                    management.
                </p>
                <p class="text-sm text-gray-500">
                    AC Personnel helps you manage employees, locations, and
                    organizational access in one place.
                </p>
            </div>
        {/if}
    {:catch error}
        <div
            class="bg-white rounded-lg shadow-sm border border-red-200 p-12 text-center"
        >
            <p class="text-red-600 mb-3">
                {error?.message || "Failed to load session"}
            </p>
            <button
                onclick={() => (sessionPromise = loadSession())}
                class="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
            >
                Retry
            </button>
        </div>
    {/await}
</div>

<style>
    :global(main) {
        background: linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%);
        min-height: 100vh;
    }
</style>
