<script lang="ts">
    import { authClient } from "$lib/auth";
    import { DashboardCard, LoadingSection } from "@ac/ui";
    import { hasAccess, parseRoles, parseClaims } from "$lib/authorization";
    import { getVisibleFeatures } from "$lib/features";
    import { getMyTalentProfile } from "./talents/talents.remote";
    import { getMyStatus } from "./timesheets/timesheets.remote";
    import { getMyTimeOffBalances, getMyTimeOffRequests } from "./time-off/time-off.remote";
    import DashboardTalentCard from "$lib/components/dashboard/DashboardTalentCard.svelte";
    import DashboardTimeTrackingCard from "$lib/components/dashboard/DashboardTimeTrackingCard.svelte";
    import DashboardTimeOffCard from "$lib/components/dashboard/DashboardTimeOffCard.svelte";

    let sessionPromise = $state(loadSession());
    let dashboardDataPromise = $state<Promise<any> | null>(null);

    async function loadSession() {
        const session = await authClient.getSession();
        const user = session?.data?.user;
        if (user) {
            dashboardDataPromise = loadDashboardData();
        }
        return {
            user,
            userRoles: user ? parseRoles(user) : [],
            userClaims: user ? parseClaims(user) : null,
        };
    }

    async function loadDashboardData() {
        const profile = await (getMyTalentProfile as any)();
        if (!profile) return null;

        const [status, balances, requests] = await Promise.all([
            (getMyStatus as any)(profile.id),
            (getMyTimeOffBalances as any)(profile.id),
            (getMyTimeOffRequests as any)(profile.id)
        ]);

        return { profile, status, balances, requests };
    }

    function refreshDashboard() {
        dashboardDataPromise = loadDashboardData();
    }
</script>

<div class="space-y-8">
    {#await sessionPromise}
        <LoadingSection message="Loading your dashboard..." />
    {:then { user, userRoles, userClaims }}
        {#if user}
            <div class="space-y-6">
                <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
                            <p class="text-gray-500 mt-1">Welcome back, {user.name || user.email}</p>
                        </div>
                        <div class="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                            <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            System Online
                        </div>
                    </div>

                    {#if dashboardDataPromise}
                        {#await dashboardDataPromise}
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div class="h-64 bg-gray-50 animate-pulse rounded-2xl"></div>
                                <div class="h-64 bg-gray-50 animate-pulse rounded-2xl"></div>
                                <div class="h-64 bg-gray-50 animate-pulse rounded-2xl"></div>
                            </div>
                        {:then data}
                            {#if data}
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                                    <DashboardTalentCard talent={data.profile} />
                                    <DashboardTimeTrackingCard 
                                        status={data.status} 
                                        talentId={data.profile.id} 
                                        onRefresh={refreshDashboard} 
                                    />
                                    <DashboardTimeOffCard 
                                        balances={data.balances} 
                                        requests={data.requests} 
                                        talentId={data.profile.id} 
                                        onRefresh={refreshDashboard}
                                    />
                                </div>
                            {:else}
                                <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                                    <p class="text-amber-800 font-medium">No Talent Profile Linked</p>
                                    <p class="text-amber-700 text-sm mt-1">To see your personal dashboard, your account must be linked to a talent record.</p>
                                </div>
                            {/if}
                        {/await}
                    {/if}
                </div>

                <div class="bg-white/50 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                    <h2 class="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <span class="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                        Quick Access Features
                    </h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {#each getVisibleFeatures(user, hasAccess) as f (f.key)}
                            <a href={f.href} class="group bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                                <div class={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${
                                    f.icon === 'users' ? 'bg-indigo-50 text-indigo-600' :
                                    f.icon === 'mapPin' ? 'bg-orange-50 text-orange-600' :
                                    f.icon === 'clock' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {#if f.icon === 'users'}<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        {:else if f.icon === 'mapPin'}<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        {:else if f.icon === 'clock'}<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        {:else}<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A3.323 3.323 0 0010.605 2.021M9 7c-1.263 0-2.425.479-3.323 1.28a3.323 3.323 0 001.28 3.323M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />{/if}
                                    </svg>
                                </div>
                                <div class="font-bold text-gray-900 text-sm">{f.title}</div>
                                <div class="text-[11px] text-gray-500 mt-1 line-clamp-1">{f.description}</div>
                            </a>
                        {/each}
                    </div>
                </div>
            </div>
        {:else}
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center max-w-2xl mx-auto">
                <div class="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg class="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h2 class="text-3xl font-extrabold text-gray-900 mb-4">Welcome to AtCost Talents</h2>
                <p class="text-gray-600 mb-8 leading-relaxed">
                    A comprehensive HR platform for managing employee records, 
                    time tracking, and organizational resources. Please sign in to access your dashboard.
                </p>
                <div class="flex flex-col sm:flex-row gap-4 justify-center">
                    <a href="/login" class="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Sign In</a>
                    <a href="/signup" class="px-8 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all">Create Account</a>
                </div>
            </div>
        {/if}
    {:catch error}
        <div class="bg-white rounded-2xl shadow-sm border border-red-200 p-12 text-center max-w-md mx-auto">
            <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p class="text-red-600 font-bold mb-4">{error?.message || "Connection error"}</p>
            <button onclick={() => (sessionPromise = loadSession())} class="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all">Retry Connection</button>
        </div>
    {/await}
</div>


