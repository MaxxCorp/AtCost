<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { kioskState } from "#lib/stores/kiosk.svelte.js";
    import EventView from "#lib/components/events/EventView.svelte";
    import AnnouncementView from "#lib/components/announcements/AnnouncementView.svelte";
    import KioskTableView from "#lib/components/kiosks/KioskTableView.svelte";
    import KioskFlatListView from "#lib/components/kiosks/KioskFlatListView.svelte";
    import KioskFoldedFlyerView from "#lib/components/kiosks/KioskFoldedFlyerView.svelte";
    import KioskFoldedFlyerCiView from "#lib/components/kiosks/KioskFoldedFlyerCiView.svelte";
    import KioskPosterView from "#lib/components/kiosks/KioskPosterView.svelte";
    import KioskPosterViewCi from "#lib/components/kiosks/KioskPosterViewCi.svelte";
    import { type Event, type Announcement } from "@ac/validations";

    import { browser } from '$app/env';
    // import * as Ably from "ably";
    import { invalidate, refreshAll } from "$app/navigation";

    import { page } from "$app/state";
    import { subscribeRealtimeChannel } from "#lib/client/realtime/client.svelte.js";
    import { readKioskView } from "./read.remote";
    import { compressSeriesEvents, type EnrichedEvent } from "#lib/utils/kiosk-flat-helpers.js";

    let kioskId = $derived(page.params.id);
    let kiosk = $state<any>(null);
    let items = $state<(Event | Announcement)[]>([]);

    let currentIndex = $state(0);
    let direction = $state(1); // 1 for forward (next), -1 for backward (prev)
    let isOffline = $state(false);
    let localCompressOverride = $state<boolean | null>(null);

    const effectiveCompressSeries = $derived(
        localCompressOverride !== null
            ? localCompressOverride
            : Boolean(kiosk?.compressSeries ?? true)
    );

    const displayItems = $derived.by(() => {
        const isCarousel = !kiosk?.uiMode || kiosk.uiMode === "carousel";
        if (!isCarousel || !effectiveCompressSeries) {
            return items;
        }
        const rawEvents: EnrichedEvent[] = [];
        const announcements: Announcement[] = [];
        for (const item of items) {
            if ("startDateTime" in item) {
                rawEvents.push(item as EnrichedEvent);
            } else {
                announcements.push(item as Announcement);
            }
        }
        const compressedEvents = compressSeriesEvents(rawEvents, "none", {
            short: false,
            includeEnd: true,
        });
        return [...compressedEvents, ...announcements].sort((a, b) => {
            const timeA =
                "startDateTime" in a && a.startDateTime
                    ? new Date(a.startDateTime).getTime()
                    : a.updatedAt
                      ? new Date(a.updatedAt).getTime()
                      : 0;
            const timeB =
                "startDateTime" in b && b.startDateTime
                    ? new Date(b.startDateTime).getTime()
                    : b.updatedAt
                      ? new Date(b.updatedAt).getTime()
                      : 0;
            return timeA - timeB;
        });
    });

    const activeIndex = $derived(
        displayItems.length > 0 ? ((currentIndex % displayItems.length) + displayItems.length) % displayItems.length : 0
    );
    const activeItem = $derived(displayItems[activeIndex]);

    function syncKioskSeriesToggleState() {
        const dbBase = Boolean(kiosk?.compressSeries ?? true);
        let overrideVal: boolean | null = null;
        if (typeof window !== "undefined" && kioskId) {
            try {
                const raw = localStorage.getItem(`kiosk_carousel_prefs_${kioskId}`);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (
                        typeof parsed?.compressSeries === "boolean" &&
                        parsed?.dbBase === dbBase
                    ) {
                        overrideVal = parsed.compressSeries;
                    }
                }
            } catch {
                // ignore malformed storage
            }
        }
        localCompressOverride = overrideVal;
        const isCarousel = !kiosk?.uiMode || kiosk.uiMode === "carousel";
        kioskState.showSeriesToggle = Boolean(kiosk && isCarousel && !kiosk.excludeSeries);
        kioskState.compressSeries = overrideVal ?? dbBase;
    }

    function setCompressSeriesOverride(val: boolean) {
        localCompressOverride = val;
        kioskState.compressSeries = val;
        currentIndex = 0;
        if (typeof window !== "undefined" && kioskId) {
            try {
                localStorage.setItem(
                    `kiosk_carousel_prefs_${kioskId}`,
                    JSON.stringify({
                        compressSeries: val,
                        dbBase: Boolean(kiosk?.compressSeries ?? true),
                    })
                );
            } catch {
                // ignore storage errors
            }
        }
        showHeader();
        resetLoop();
    }

    let timer: ReturnType<typeof setInterval>;
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const INACTIVITY_TIMEOUT = 5000;

    // --- Inactivity & Header Logic ---
    function showHeader() {
        console.log("Showing header"); // debug
        kioskState.isHeaderVisible = true;
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            console.log("Hiding header due to inactivity"); // debug
            kioskState.isHeaderVisible = false;
        }, INACTIVITY_TIMEOUT);
    }

    function resetInactivity() {
        if (kiosk?.uiMode === 'flat_list' || kiosk?.uiMode === 'folded_flyer' || kiosk?.uiMode === 'poster' || kiosk?.uiMode === 'folded_flyer_ci' || kiosk?.uiMode === 'poster_ci') return;
        console.log("Resetting inactivity timer"); // debug
        showHeader();
        // Reset loop timer on interaction to prevent flipping while reading/swiping
        resetLoop();
    }

    // --- Loop Logic ---
    function startLoop() {
        clearInterval(timer);
        if (kiosk?.uiMode === 'flat_list' || kiosk?.uiMode === 'folded_flyer' || kiosk?.uiMode === 'poster' || kiosk?.uiMode === 'folded_flyer_ci' || kiosk?.uiMode === 'poster_ci') return;
        timer = setInterval(
            () => {
                nextSlide(true); // Auto-advance
            },
            (kiosk?.loopDuration || 5) * 1000,
        );
    }

    function resetLoop() {
        clearInterval(timer);
        startLoop();
    }

    function nextSlide(auto = false) {
        if (displayItems.length <= 1) return;
        direction = 1;
        currentIndex = (currentIndex + 1) % displayItems.length;
        if (!auto) resetLoop();
    }

    function prevSlide() {
        if (displayItems.length <= 1) return;
        direction = -1;
        currentIndex = (currentIndex - 1 + displayItems.length) % displayItems.length;
        resetLoop();
    }

    async function fetchData() {
        if (!kioskId) return;
        try {
            const data = await readKioskView(kioskId);
            if (!data) return;

            kiosk = data.kiosk;
            const freshItems = data.items;

            // Online success: enrich with QR codes for caching and update cache
            const enrichedItems = await Promise.all(
                freshItems.map(async (item) => {
                    let qrData = (item as any).qrCodeDataUrl;

                // If it's an event and has a path but no dataUrl (or we want to ensure it's loaded), fetch it
                if ("qrCodePath" in item && item.qrCodePath && !qrData) {
                    try {
                        const res = await fetch(item.qrCodePath);
                        if (res.ok) {
                            const blob = await res.blob();
                            qrData = await new Promise((resolve) => {
                                const reader = new FileReader();
                                    reader.onloadend = () =>
                                        resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                            });
                        }
                        } catch (e) {
                            console.error(
                                "Failed to cache QR code for event",
                                item.id,
                                e,
                            );
                    }
                }

                // Enrich contact QR code if it exists
                    if (
                        "resolvedContact" in item &&
                        item.resolvedContact?.qrCodePath
                    ) {
                    try {
                            const res = await fetch(
                                item.resolvedContact.qrCodePath,
                            );
                        if (res.ok) {
                            const blob = await res.blob();
                                const contactQrData = await new Promise<string>(
                                    (resolve) => {
                                const reader = new FileReader();
                                        reader.onloadend = () =>
                                            resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                                    },
                                );
                                item.resolvedContact.qrCodeDataUrl =
                                    contactQrData;
                        }
                        } catch (e) {
                            console.error(
                                "Failed to cache contact QR code for event",
                                item.id,
                                e,
                            );
                    }
                }
                return { ...item, qrCodeDataUrl: qrData };
                }),
            );

            // Enrich kiosk locations with QR code data URLs
            if (kiosk?.locations) {
                kiosk.locations = await Promise.all(
                    kiosk.locations.map(async (loc: any) => {
                    if (loc.contact?.qrCodePath && !loc.contact?.qrCodeDataUrl) {
                        try {
                            const res = await fetch(loc.contact.qrCodePath);
                            if (res.ok) {
                                const blob = await res.blob();
                                const qrData = await new Promise<string>((resolve) => {
                                    const reader = new FileReader();
                                        reader.onloadend = () => resolve(reader.result as string);
                                    reader.readAsDataURL(blob);
                                });
                                loc.contact.qrCodeDataUrl = qrData;
                            }
                            } catch (e) {
                            console.error("Failed to cache QR code for location contact", loc.id, e);
                        }
                    }
                    return loc;
                    })
                );
            }

            items = enrichedItems;
            syncKioskSeriesToggleState();

            if (displayItems.length > 1) {
                startLoop();
            }

            const storageKey = `kiosk_items_${kioskId}`;
            try {
                localStorage.setItem(storageKey, JSON.stringify(enrichedItems));

                // Also cache kiosk details
                localStorage.setItem(
                    `kiosk_details_${kioskId}`,
                    JSON.stringify(kiosk),
                );
            } catch (storageErr) {
                console.warn("Could not cache kiosk data to localStorage (quota exceeded)", storageErr);
            }

            isOffline = false;
        } catch (e) {
            console.error("Failed to fetch data, attempting offline load", e);
            await initCache();
        }
    }

    $effect(() => {
        if (kioskId) {
            fetchData();
        }
    });

    // --- Offline & Caching Logic ---
    async function initCache() {
        try {
            // 1. Load from storage first if data.items is empty (offline load)
            // 1. Load from storage first if data.items is empty (offline load)
            const storageKey = `kiosk_items_${kioskId}`;
            const stored = localStorage.getItem(storageKey);

            // Also load kiosk details if missing
            if (!kiosk) {
                const storedKiosk = localStorage.getItem(
                    `kiosk_details_${kioskId}`,
                );
                if (storedKiosk) kiosk = JSON.parse(storedKiosk);
            }
            let cachedItems: (Event | Announcement)[] = stored
                ? JSON.parse(stored)
                : [];

            // Items already loaded via fetchData if online
            // Just need to handle QR code caching if items are present
            if (items.length > 0) {
                const mergedItems = await Promise.all(
                    items.map(async (item) => {
                        // ... existing logic but optimized since we already have items ...
                        // Actually, let's just keep the cache logic simple:
                        // If we fetched fresh items, we might want to ensure QR codes are cached.
                        return item;
                        // For now, assume fetchData handled main loading.
                        // But initCache is called on mount.
                        // If fetchData succeeds, it sets items.
                        // We might want initCache to ONLY handle the offline fallback or QR enrichment.
                    }),
                );
                isOffline = false;
            } else if (cachedItems.length > 0) {
                // Offline fallback
                // Filter out outdated events
                const now = new Date();
                const validItems = cachedItems.filter((item) => {
                    // Check validity for Events
                    if ("startDateTime" in item) {
                        const e = item as Event;
                        // Simple check: is endDateTime in future?
                        if (e.endDateTime) return new Date(e.endDateTime) > now;
                        if (e.startDateTime && e.isAllDay) {
                            const d = new Date(e.startDateTime);
                            const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
                            return endOfDay > now;
                        }
                        return false;
                    }
                    // Announcements always valid
                    return true;
                });

                items = validItems;
                syncKioskSeriesToggleState();
                if (displayItems.length > 1) {
                    startLoop();
                }
                // Update storage to remove old ones
                localStorage.setItem(storageKey, JSON.stringify(validItems));
                isOffline = true;
            }
        } catch (e) {
            console.error("Kiosk offline cache error:", e);
        }
    }

    // --- Gesture Logic ---
    let startX = 0;
    let endX = 0;
    // let announcement = $state<any>((data as any).announcement); // Removed unused legacy state
    let realtime: any | undefined;

    function handlePointerDown(e: PointerEvent) {
        startX = e.screenX;
        resetInactivity();
    }

    function handlePointerUp(e: PointerEvent) {
        endX = e.screenX;
        handleSwipe();
        resetInactivity();
    }

    function handleSwipe() {
        const threshold = 50;
        if (endX < startX - threshold) {
            // Swiped Left -> User Requirement: "swiping left (back)"
            prevSlide();
        } else if (endX > startX + threshold) {
            // Swiped Right -> User Requirement: "swiping right (forward)"
            nextSlide();
        }
    }

    let unsubRealtimeEvents: (() => void) | null = null;
    let unsubRealtimeAnnouncements: (() => void) | null = null;

    onMount(() => {
        kioskState.isKiosk = true;
        kioskState.onToggleCompressSeries = setCompressSeriesOverride;
        showHeader();

        if (browser) {
            unsubRealtimeEvents = subscribeRealtimeChannel(
                "event-changes",
                () => {
                    void refreshAll();
                },
                () => {
                    void refreshAll();
                }
            );
            unsubRealtimeAnnouncements = subscribeRealtimeChannel(
                "announcement-changes",
                () => {
                    void refreshAll();
                },
                () => {
                    void refreshAll();
                }
            );
        }
    });

    onDestroy(() => {
        unsubRealtimeEvents?.();
        unsubRealtimeAnnouncements?.();
        kioskState.isKiosk = false;
        kioskState.isHeaderVisible = true;
        kioskState.showSeriesToggle = false;
        kioskState.onToggleCompressSeries = null;
        clearInterval(timer);
        clearTimeout(inactivityTimer);
    });
</script>

<svelte:head>
    <title>{kiosk?.name || "Kiosk"}</title>
    {#if kiosk?.uiMode === "flat_list" || kiosk?.uiMode === "folded_flyer" || kiosk?.uiMode === "folded_flyer_ci" || kiosk?.uiMode === "poster" || kiosk?.uiMode === "poster_ci"}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Patrick+Hand&family=Playfair+Display:wght@600;700;800&family=Poppins:wght@400;500;600;700;800&family=Roboto+Slab:wght@400;600;700;800&display=swap"
        />
    {/if}
</svelte:head>

<svelte:window
    onmousemove={resetInactivity}
    onmousedown={resetInactivity}
    onkeydown={resetInactivity}
></svelte:window>

{#if kiosk?.uiMode === "flat_list"}
    <div
        class="w-full min-h-screen bg-slate-100 dark:bg-slate-900 print:bg-white overflow-y-auto"
    ><KioskFlatListView items={items} kiosk={kiosk} /></div>
{:else if kiosk?.uiMode === "folded_flyer"}
    <div
        class="w-full min-h-screen bg-slate-100 dark:bg-slate-900 print:bg-white print:min-h-0 print:overflow-visible overflow-y-auto"
    ><KioskFoldedFlyerView items={items} kiosk={kiosk} /></div>
{:else if kiosk?.uiMode === "folded_flyer_ci"}
    <div
        class="w-full min-h-screen bg-slate-100 dark:bg-slate-900 print:bg-white print:min-h-0 print:overflow-visible overflow-y-auto"
    ><KioskFoldedFlyerCiView items={items} kiosk={kiosk} /></div>
{:else if kiosk?.uiMode === "poster"}
    <div
        class="w-full min-h-screen bg-slate-100 dark:bg-slate-900 print:bg-white print:min-h-0 print:overflow-visible print:block print:w-auto print:h-auto print:m-0 print:p-0 overflow-y-auto"
    ><KioskPosterView items={items} kiosk={kiosk} /></div>
{:else if kiosk?.uiMode === "poster_ci"}
    <div
        class="w-full min-h-screen bg-slate-100 dark:bg-slate-900 print:bg-white print:min-h-0 print:overflow-visible print:block print:w-auto print:h-auto print:m-0 print:p-0 overflow-y-auto"
    ><KioskPosterViewCi items={items} kiosk={kiosk} /></div>
{:else}
    <div
        class="fixed inset-0 bg-gray-900 overflow-hidden flex items-center justify-center"
        onpointerdown={handlePointerDown}
        onpointerup={handlePointerUp}
        role="region"
        aria-label="Event Kiosk"
    >
        {#if displayItems.length === 0}
            <div
                class="text-white text-xl opacity-50 flex flex-col items-center gap-4"
            >
                <p>
                    {#if isOffline}
                        No cached content available offline.
                    {:else}
                        No upcoming content matching this kiosk's settings.
                    {/if}
                </p>
                <p class="text-sm">
                    Location: {kiosk?.locations && kiosk.locations.length > 0
                        ? kiosk.locations.map((l: any) => l.name).join(", ")
                        : "All Locations"}
                </p>
            </div>
        {:else if kiosk?.uiMode === "table"}
            <KioskTableView items={items} kiosk={kiosk} />
        {:else}
            {#if activeItem}
                {#key `${activeIndex}_${(activeItem as any).id ?? activeIndex}`}
                    <div
                        class="absolute inset-0 w-full h-full overflow-hidden"
                        in:fly={{
                            x: direction * 500,
                            duration: 600,
                            opacity: 0,
                            easing: cubicOut,
                        }}
                        out:fly={{
                            x: direction * -500,
                            duration: 600,
                            opacity: 0,
                            easing: cubicOut,
                        }}
                    >
                        {#if "startDateTime" in activeItem}
                            <EventView event={activeItem as Event} />
                        {:else}
                            <div class="w-full h-full bg-white flex flex-col overflow-y-auto p-6 sm:p-10 lg:p-16 pb-20">
                                <div class="w-full flex-1">
                                    <AnnouncementView
                                        announcement={activeItem as Announcement}
                                        allowInternal={true}
                                    />
                                </div>
                            </div>
                        {/if}
                    </div>
                {/key}
            {/if}

            {#if displayItems.length > 1}
                <div
                    class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex max-w-[90vw] flex-wrap items-center justify-center gap-2 rounded-full bg-slate-950/50 px-3.5 py-1.5 backdrop-blur-md border border-white/15 shadow-lg"
                >
                    {#each displayItems as _, i (i)}
                        <div
                            class="h-2 rounded-full transition-all duration-300 {i === activeIndex
                                ? 'w-8 bg-white shadow-xs'
                                : 'w-2 bg-white/40'}"
                        ></div>
                    {/each}
                </div>
            {/if}

            {#if isOffline}
                <div
                    class="pointer-events-none absolute top-4 right-4 z-30 text-white/90 text-xs font-medium bg-slate-950/60 backdrop-blur-md border border-white/15 px-2.5 py-1 rounded-full shadow-md"
                >
                    Offline Mode
                </div>
            {/if}
        {/if}
    </div>
{/if}
