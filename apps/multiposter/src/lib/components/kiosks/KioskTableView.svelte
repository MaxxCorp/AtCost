<script lang="ts">
    import { type PublicEvent } from "@ac/validations";

    import { type Announcement } from "@ac/validations";

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
        const ITEMS_PER_PAGE = 5; // Reduced as requested to ensure it fits vertically

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

<div class="w-full h-full flex flex-col bg-gray-950 text-white p-8 md:p-12 overflow-hidden select-none">
    {#if currentPageData}
        <!-- Rich Location Header -->
        <div class="mb-8 flex justify-between items-start border-b-2 border-blue-500/30 pb-6 shrink-0">
            <div class="space-y-3">
                <div class="flex items-center gap-4">
                    <div class="h-12 w-2 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                    <h1 class="text-5xl md:text-6xl font-black tracking-tight uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[60vw]">
                        {currentPageData.location.name}
                    </h1>
                </div>
                
                <div class="flex gap-8 text-xl text-gray-400 font-medium pl-6">
                    {#if currentPageData.location.street}
                        <div class="leading-snug">
                            {currentPageData.location.street} {currentPageData.location.houseNumber || ''}<br/>
                            {currentPageData.location.zip || ''} {currentPageData.location.city || ''}
                        </div>
                    {/if}
                    
                    {#if currentPageData.location.contact}
                        <div class="border-l border-gray-800 pl-8 space-y-1">
                            <span class="text-blue-400 uppercase text-xs font-bold tracking-widest block mb-1">Contact</span>
                            <div class="flex items-start gap-4">
                                {#if currentPageData.location.contact.qrCodePath}
                                    <div class="bg-white p-1 rounded-lg shadow-lg shrink-0 mt-0.5">
                                        <img src={currentPageData.location.contact.qrCodePath} alt="Contact QR" class="w-12 h-12" />
                                    </div>
                                {/if}
                                <div class="space-y-0.5">
                                    <div class="text-white text-2xl font-bold leading-tight">{currentPageData.location.contact.name}</div>
                                    <div class="flex flex-wrap gap-x-6 text-gray-500 text-lg font-medium">
                                        {#if currentPageData.location.contact.email}
                                            <div class="flex items-center gap-1.5">
                                                <span class="text-blue-500/50 text-base">@</span>
                                                {currentPageData.location.contact.email}
                                            </div>
                                        {/if}
                                        {#if currentPageData.location.contact.phone}
                                            <div class="flex items-center gap-1.5">
                                                <span class="text-blue-500/50 text-base">#</span>
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

            <div class="flex items-center gap-6 shrink-0">
                <div class="text-right">
                    <div class="text-3xl font-black text-blue-500/50">PAGE</div>
                    <div class="text-6xl font-black">{currentPage + 1} <span class="text-gray-800">/</span> {totalPages}</div>
                </div>
            </div>
        </div>

        <!-- Enhanced Table -->
        <div class="flex-1 overflow-hidden">
            <table class="w-full text-left border-collapse table-fixed">
                <thead>
                    <tr class="text-gray-500 text-lg uppercase tracking-[0.2em] font-black border-b border-gray-800/50">
                        <th class="py-3 px-6 w-[12%]">Date</th>
                        <th class="py-3 px-6 w-[10%]">Time</th>
                        <th class="py-3 px-6 w-[45%]">Event Detail</th>
                        <th class="py-3 px-6 w-[20%]">Tags</th>
                        <th class="py-3 px-6 w-[13%] text-right">QR</th>
                    </tr>
                </thead>
                <tbody>
                    {#key currentPage}
                        {#each currentPageData.items as item, i}
                            <tr 
                                class="border-b border-gray-900/30 hover:bg-blue-500/5 transition-all duration-300 h-[12vh] min-h-[100px]"
                                in:fly={{ x: 20, duration: 600, delay: i * 80 }}
                            >
                                <td class="py-4 px-6 align-middle">
                                    <div class="text-3xl font-black whitespace-nowrap">{formatDate(item.startDateTime)}</div>
                                </td>
                                <td class="py-4 px-6 align-middle">
                                    <div class="text-2xl font-bold text-gray-400 whitespace-nowrap">{formatTime(item.startDateTime)}</div>
                                </td>
                                <td class="py-4 px-6 align-middle">
                                    <div class="space-y-1.5 overflow-hidden">
                                        <div class="text-3xl font-black leading-tight line-clamp-2">{item.summary || "UNTITLED EVENT"}</div>
                                        {#if item.roomTitle}
                                            <div class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-800 rounded-md text-blue-300 text-base font-bold">
                                                <div class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                {item.roomTitle}
                                            </div>
                                        {/if}
                                    </div>
                                </td>
                                <td class="py-4 px-6 align-middle">
                                    <div class="flex flex-wrap gap-1.5 max-h-[8vh] overflow-hidden">
                                        {#each (item.tags || []).slice(0, 3) as tag}
                                            <span class="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider">
                                                {tag.name || tag}
                                            </span>
                                        {/each}
                                    </div>
                                </td>
                                <td class="py-3 px-6 align-middle text-right shrink-0">
                                    {#if item.qrCodeDataUrl || (item as any).qrCodePath}
                                        <div class="inline-block bg-white p-1 rounded-lg shadow-lg transform hover:scale-105 transition-transform shadow-blue-500/10">
                                            <img src={item.qrCodeDataUrl || (item as any).qrCodePath} alt="QR" class="w-16 h-16 md:w-20 md:h-20" />
                                        </div>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    {/key}
                </tbody>
            </table>
        </div>
    {:else}
        <div class="h-full flex flex-col items-center justify-center text-gray-700 space-y-8">
            <div class="w-48 h-48 rounded-full border-8 border-gray-900 border-t-blue-500/20 animate-spin flex items-center justify-center">
                <div class="text-6xl text-gray-800">!</div>
            </div>
            <p class="text-5xl font-black italic uppercase tracking-tighter">No Scheduled Events</p>
        </div>
    {/if}

    {#if totalPages > 1}
        <div class="mt-4 pt-6 flex justify-center items-center gap-3 shrink-0">
            {#each pages as page, i}
                <div 
                    class="h-2 rounded-full transition-all duration-700 {i === currentPage ? 'w-16 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'w-2 bg-gray-800'}"
                ></div>
            {/each}
        </div>
    {/if}
</div>


