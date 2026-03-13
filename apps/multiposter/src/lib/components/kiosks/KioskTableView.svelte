<script lang="ts">
    import type { PublicEvent } from "../../../routes/events/list-public.remote";
    import type { Announcement } from "../../../routes/announcements/list.remote";
    import { onDestroy } from "svelte";
    import { fly } from "svelte/transition";

    interface LocationInfo {
        id: string;
        name: string;
        street: string | null;
        houseNumber: string | null;
        zip: string | null;
        city: string | null;
        country: string | null;
        contact: {
            name: string;
            email?: string;
            phone?: string;
            qrCodePath?: string;
        } | null;
    }

    let { items, kiosk }: { 
        items: (PublicEvent | Announcement)[], 
        kiosk: {
            loopDuration?: number;
            locations: LocationInfo[];
        }
    } = $props();

    // Filter only events
    let events = $derived(items.filter(item => "startDateTime" in item) as PublicEvent[]);

    // Flatten into pages grouped by kiosk locations
    let pages = $derived.by(() => {
        const result: { location: LocationInfo, items: PublicEvent[] }[] = [];
        const ITEMS_PER_PAGE = 7; // Slightly less to accommodate rich header

        if (!kiosk?.locations) return [];

        for (const loc of kiosk.locations) {
            // Find events that belong to this location ID
            const locEvents = events.filter(e => e.locationIds?.includes(loc.id));
            if (locEvents.length === 0) continue;

            for (let i = 0; i < locEvents.length; i += ITEMS_PER_PAGE) {
                result.push({
                    location: loc,
                    items: locEvents.slice(i, i + ITEMS_PER_PAGE)
                });
            }
        }
        return result;
    });

    let currentPage = $state(0);
    let totalPages = $derived(pages.length);
    let currentPageData = $derived(pages[currentPage]);

    let timer: ReturnType<typeof setInterval>;

    function startTimer() {
        clearInterval(timer);
        if (totalPages <= 1) return;
        timer = setInterval(() => {
            currentPage = (currentPage + 1) % totalPages;
        }, (kiosk.loopDuration || 5) * 1000);
    }

    $effect(() => {
        startTimer();
    });

    onDestroy(() => {
        clearInterval(timer);
    });

    function formatDate(dateStr: string | null) {
        if (!dateStr) return "---";
        return new Date(dateStr).toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    }

    function formatTime(dateStr: string | null) {
        if (!dateStr) return "---";
        return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
</script>

<div class="w-full h-full flex flex-col bg-gray-950 text-white p-12">
    {#if currentPageData}
        <!-- Rich Location Header -->
        <div class="mb-12 flex justify-between items-start border-b-2 border-blue-500/30 pb-8">
            <div class="space-y-4">
                <div class="flex items-center gap-4">
                    <div class="h-16 w-3 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                    <h1 class="text-7xl font-black tracking-tight uppercase">{currentPageData.location.name}</h1>
                </div>
                
                <div class="flex gap-12 text-2xl text-gray-400 font-medium pl-6">
                    {#if currentPageData.location.street}
                        <div>
                            {currentPageData.location.street} {currentPageData.location.houseNumber || ''}<br/>
                            {currentPageData.location.zip || ''} {currentPageData.location.city || ''}
                        </div>
                    {/if}
                    
                    {#if currentPageData.location.contact}
                        <div class="border-l border-gray-800 pl-12 space-y-2">
                            <span class="text-blue-400 uppercase text-sm font-bold tracking-widest block mb-2">Contact</span>
                            <div class="flex items-start gap-5">
                                {#if currentPageData.location.contact.qrCodePath}
                                    <div class="bg-white p-1.5 rounded-lg shadow-lg shrink-0 mt-1">
                                        <img src={currentPageData.location.contact.qrCodePath} alt="Contact QR" class="w-16 h-16" />
                                    </div>
                                {/if}
                                <div class="space-y-1">
                                    <div class="text-white text-3xl font-bold leading-tight">{currentPageData.location.contact.name}</div>
                                    <div class="flex flex-wrap gap-x-8 text-gray-500 text-xl font-medium">
                                        {#if currentPageData.location.contact.email}
                                            <div class="flex items-center gap-2">
                                                <span class="text-blue-500/50">@</span>
                                                {currentPageData.location.contact.email}
                                            </div>
                                        {/if}
                                        {#if currentPageData.location.contact.phone}
                                            <div class="flex items-center gap-2">
                                                <span class="text-blue-500/50">#</span>
                                                {currentPageData.location.contact.phone}
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>

            <div class="flex items-center gap-10">
                <div class="text-right">
                    <div class="text-5xl font-black text-blue-500/50">PAGE</div>
                    <div class="text-8xl font-black">{currentPage + 1} <span class="text-gray-800">/</span> {totalPages}</div>
                </div>
            </div>
        </div>

        <!-- Enhanced Table -->
        <table class="w-full text-left border-collapse table-fixed">
            <thead>
                <tr class="text-gray-500 text-xl uppercase tracking-[0.2em] font-black border-b border-gray-800">
                    <th class="py-4 px-6 w-[12%]">Date</th>
                    <th class="py-4 px-6 w-[10%]">Time</th>
                    <th class="py-4 px-6 w-[45%]">Event Detail</th>
                    <th class="py-4 px-6 w-[20%]">Tags</th>
                    <th class="py-4 px-6 w-[13%] text-right">QR</th>
                </tr>
            </thead>
            <tbody>
                {#key currentPage}
                    {#each currentPageData.items as item, i}
                        <tr 
                            class="border-b border-gray-900/50 hover:bg-blue-500/5 transition-all duration-300"
                            in:fly={{ x: 20, duration: 600, delay: i * 80 }}
                        >
                            <td class="py-8 px-6 align-top">
                                <div class="text-4xl font-black">{formatDate(item.startDateTime)}</div>
                            </td>
                            <td class="py-8 px-6 align-top">
                                <div class="text-3xl font-bold text-gray-400">{formatTime(item.startDateTime)}</div>
                            </td>
                            <td class="py-8 px-6 align-top">
                                <div class="space-y-3">
                                    <div class="text-4xl font-black leading-tight">{item.summary || "UNTITLED EVENT"}</div>
                                    {#if item.roomTitle}
                                        <div class="inline-flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg text-blue-300 text-lg font-bold">
                                            <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                            {item.roomTitle}
                                        </div>
                                    {/if}
                                </div>
                            </td>
                            <td class="py-8 px-6 align-top">
                                <div class="flex flex-wrap gap-2">
                                    {#each (item.tags || []).slice(0, 3) as tag}
                                        <span class="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-bold uppercase tracking-wider">
                                            {tag}
                                        </span>
                                    {/each}
                                </div>
                            </td>
                            <td class="py-6 px-6 align-middle text-right">
                                {#if item.qrCodeDataUrl || (item as any).qrCodePath}
                                    <div class="inline-block bg-white p-1.5 rounded-lg shadow-lg transform hover:scale-105 transition-transform">
                                        <img src={item.qrCodeDataUrl || (item as any).qrCodePath} alt="QR" class="w-24 h-24" />
                                    </div>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                {/key}
            </tbody>
        </table>
    {:else}
        <div class="h-full flex flex-col items-center justify-center text-gray-700 space-y-8">
            <div class="w-48 h-48 rounded-full border-8 border-gray-900 border-t-blue-500/20 animate-spin flex items-center justify-center">
                <div class="text-6xl text-gray-800">!</div>
            </div>
            <p class="text-5xl font-black italic uppercase tracking-tighter">No Scheduled Events</p>
        </div>
    {/if}

    {#if totalPages > 1}
        <div class="mt-auto pt-12 flex justify-center items-center gap-4">
            {#each pages as page, i}
                <div 
                    class="h-3 rounded-full transition-all duration-700 {i === currentPage ? 'w-24 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]' : 'w-3 bg-gray-800'}"
                ></div>
            {/each}
        </div>
    {/if}
</div>

<style>
    :global(body) {
        margin: 0;
        background: #030712;
    }
</style>
