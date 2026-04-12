<script lang="ts">
    import { DashboardCard, LoadingSection, ErrorSection } from "@ac/ui";
    import { hasAccess } from "$lib/authorization";
    import { getVisibleFeatures } from "$lib/features";
    import DashboardTalentCard from "$lib/components/dashboard/DashboardTalentCard.svelte";
    import DashboardTimeTrackingCard from "$lib/components/dashboard/DashboardTimeTrackingCard.svelte";
    import DashboardTimeOffCard from "$lib/components/dashboard/DashboardTimeOffCard.svelte";
    import { authClient } from "$lib/auth";
    
    import { getMyTalentProfile } from "./talents/talents.remote";
    import { getMyStatus } from "./my-timesheet/timesheets.remote";
    import { getMyTimeOffBalances, getMyTimeOffRequests } from "./time-off/time-off.remote";

    /**
     * STABILIZED DASHBOARD (Powered by Native Remote Functions)
     */
    let sessionPromise = $state(authClient.getSession());
    let profilePromise = $state(getMyTalentProfile());

    async function refreshDashboard() {
        profilePromise = getMyTalentProfile();
    }
</script>

<div class="space-y-8">
    {#await sessionPromise}
        <!-- Silently wait for session resolution -->
    {:then session}
        {#if session?.data?.user}
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div class="bg-white rounded-[3rem] shadow-xl border border-gray-100 p-10 md:p-12">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                        <div class="space-y-2">
                            <div class="flex items-center gap-3">
                                <span class="w-2 h-8 bg-indigo-600 rounded-full"></span>
                                <h1 class="text-5xl font-black text-gray-900 tracking-tighter leading-none uppercase italic">Workspace Cloud</h1>
                            </div>
                            <p class="text-gray-400 font-bold ml-5 uppercase tracking-widest text-[10px]">Portal for {session.data.user.name || session.data.user.email}</p>
                        </div>
                        <div class="flex items-center gap-3 text-xs font-black text-emerald-600 bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100 shadow-sm uppercase tracking-widest italic">
                            <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            Neural Connection Active
                        </div>
                    </div>

                    {#await profilePromise}
                        <LoadingSection message="Synchronizing profile configuration..." />
                    {:then profile}
                        {#if profile}
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                                <DashboardTalentCard talent={profile} />
                                
                                {#await Promise.all([getMyStatus(profile.id), getMyTimeOffBalances(profile.id), getMyTimeOffRequests(profile.id)])}
                                    <div class="col-span-2 flex items-center justify-center p-12 bg-gray-50/50 rounded-[2.5rem] border border-gray-100">
                                        <LoadingSection message="Loading operational statistics..." />
                                    </div>
                                {:then [status, balances, requests]}
                                    <DashboardTimeTrackingCard 
                                        {status} 
                                        talentId={profile.id} 
                                        onRefresh={refreshDashboard} 
                                    />
                                    <DashboardTimeOffCard 
                                        {balances} 
                                        {requests} 
                                        talentId={profile.id} 
                                        onRefresh={refreshDashboard}
                                    />
                                {:catch error}
                                    <div class="col-span-2">
                                        <ErrorSection headline="Modules Sync Failure" message={error.message} />
                                    </div>
                                {/await}
                            </div>
                        {:else}
                            <div class="bg-amber-50 border border-amber-200 rounded-[2.5rem] p-12 text-center max-w-3xl mx-auto shadow-inner">
                                <div class="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-8">
                                    <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                                <h2 class="text-2xl font-black text-amber-900 mb-4 tracking-tight uppercase italic">No Linked Talent Profile</h2>
                                <p class="text-amber-700 font-bold leading-relaxed uppercase tracking-widest text-[10px] max-w-md mx-auto opacity-70">To synchronize your operational statistics, please link your account to a talent profile.</p>
                            </div>
                        {/if}
                    {:catch error}
                        <ErrorSection headline="Authentication Error" message={error.message} />
                    {/await}
                </div>

                <div class="bg-white/40 backdrop-blur-xl rounded-[3rem] p-12 border border-white/40 shadow-sm">
                    <h2 class="text-lg font-bold text-gray-900 mb-8 flex items-center gap-3 uppercase tracking-[0.2em] italic">
                        <span class="w-2 h-6 bg-indigo-500 rounded-full shadow-lg shadow-indigo-100"></span>
                        Operational Modules
                    </h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {#each getVisibleFeatures(session.data.user, hasAccess) as f (f.key)}
                            <a href={f.href} class="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-50 transition-all duration-500 hover:-translate-y-2 flex flex-col items-center text-center">
                                <div class={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 ${
                                    f.icon === 'users' ? 'bg-indigo-50 text-indigo-600 shadow-indigo-50' :
                                    f.icon === 'mapPin' ? 'bg-orange-50 text-orange-600 shadow-orange-50' :
                                    f.icon === 'clock' ? 'bg-emerald-50 text-emerald-600 shadow-emerald-50' : 'bg-rose-50 text-rose-600 shadow-rose-50'
                                } shadow-lg relative`}>
                                    <svg class="w-7 h-7 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {#if f.icon === 'users'}<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        {:else if f.icon === 'mapPin'}<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        {:else if f.icon === 'clock'}<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        {:else}<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A3.323 3.323 0 0010.605 2.021M9 7c-1.263 0-2.425.479-3.323 1.28a3.323 3.323 0 001.28 3.323M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />{/if}
                                    </svg>
                                </div>
                                <div class="font-black text-gray-900 text-[11px] tracking-widest uppercase italic mb-1">{f.title}</div>
                                <div class="text-[9px] text-gray-400 font-bold uppercase tracking-tight line-clamp-1">{f.description}</div>
                            </a>
                        {/each}
                    </div>
                </div>
            </div>
        {:else}
            <div class="bg-white rounded-[4rem] shadow-2xl border border-gray-100 p-20 text-center max-w-3xl mx-auto animate-in zoom-in-95 duration-700">
                <div class="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-lg shadow-indigo-100 rotate-3 group-hover:rotate-0 transition-transform">
                    <svg class="w-12 h-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h2 class="text-5xl font-black text-gray-900 mb-6 tracking-tighter uppercase italic leading-none">Authentication Link Required</h2>
                <p class="text-gray-400 font-bold mb-12 leading-relaxed uppercase tracking-widest text-[10px]">
                    Please authenticate into the secure neural interface 
                    to access your personalized operational dashboard.
                </p>
                <div class="flex flex-col sm:flex-row gap-6 justify-center">
                    <a href="/login" class="px-12 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-widest text-sm italic">Initialize Session</a>
                    <a href="/signup" class="px-12 py-5 bg-white border-2 border-gray-100 text-gray-900 rounded-[1.5rem] font-black hover:bg-gray-50 transition-all uppercase tracking-widest text-sm italic">New Instance</a>
                </div>
            </div>
        {/if}
    {:catch error}
        <ErrorSection headline="Session Error" message={String(error)} />
    {/await}
</div>
