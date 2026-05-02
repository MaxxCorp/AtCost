<script lang="ts">
    import { listEvents, deleteEvent } from "./events.remote";
    import * as m from "$lib/paraglide/messages";
    import { toast } from "svelte-sonner";
    import { Calendar, MapPin, Tag, Users, Search, Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Eye, Clock } from "@lucide/svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import { onMount } from "svelte";

    let search = $state("");
    let page = $state(1);
    let limit = 20;

    let eventsData = $state<any>({ data: [], total: 0 });
    let isLoading = $state(true);

    async function loadEvents() {
        isLoading = true;
        try {
            eventsData = await listEvents({ page, limit, search });
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            isLoading = false;
        }
    }

    $effect(() => {
        // Trigger reload on search or page change
        loadEvents();
    });

    const totalPages = $derived(Math.ceil(eventsData.total / limit));

    function formatTime(dt: string | null) {
        if (!dt) return "";
        return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(dt: string | null) {
        if (!dt) return "";
        return new Date(dt).toLocaleDateString();
    }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-6xl mx-auto">
        <Breadcrumb feature="events" />
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h1 class="text-4xl font-black text-gray-900 tracking-tight">{m.feature_events_title()}</h1>
            <Button href="/events/new" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl shadow-lg shadow-blue-100 flex items-center gap-2 transition-all active:scale-95">
                <Plus size={20} />
                {m.create_item({ item: "Event" })}
            </Button>
        </div>

        <!-- Search and Filters -->
        <div class="bg-white p-4 rounded-2xl border shadow-sm mb-6 flex items-center gap-4">
            <div class="relative flex-1">
                <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    bind:value={search}
                    placeholder={m.search_placeholder?.({ item: "Events" }) ?? "Search events..."}
                    class="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
            </div>
        </div>

        <!-- Events List -->
        <div class="space-y-4">
            {#if isLoading}
                <div class="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p class="font-medium animate-pulse">{m.loading()}</p>
                </div>
            {:else if eventsData.data.length === 0}
                <div class="bg-white border-2 border-dashed rounded-3xl p-20 text-center">
                    <div class="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Calendar size={40} class="text-gray-300" />
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">{m.no_items_found({ item: "Events" })}</h3>
                    <p class="text-gray-500 mb-8">{m.not_found_message({ item: "Events" })}</p>
                    <Button variant="outline" onclick={() => { search = ""; page = 1; }}>{m.cancel()}</Button>
                </div>
            {:else}
                <div class="grid grid-cols-1 gap-4">
                    {#each eventsData.data as event}
                        <div class="bg-white border rounded-2xl p-6 hover:shadow-xl hover:shadow-gray-100 transition-all group border-l-4 {event.isPublic ? 'border-l-green-500' : 'border-l-blue-500'}">
                            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div class="space-y-3 flex-1">
                                    <div class="flex items-center gap-3">
                                        <h2 class="text-xl font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                                            <a href={`/events/${event.id}/view`}>{event.summary}</a>
                                        </h2>
                                        {#if event.isPublic}
                                            <span class="bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-green-100">{m.public()}</span>
                                        {/if}
                                    </div>
                                    
                                    <div class="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-gray-500">
                                        <div class="flex items-center gap-1.5">
                                            <Calendar size={14} class="text-blue-500" />
                                            <span class="font-medium">{formatDate(event.startDateTime)}</span>
                                        </div>
                                        <div class="flex items-center gap-1.5">
                                            <Clock size={14} class="text-orange-500" />
                                            <span class="font-medium">
                                                {event.isAllDay ? m.all_day() : `${formatTime(event.startDateTime)} - ${formatTime(event.endDateTime)}`}
                                            </span>
                                        </div>
                                        {#if event.location}
                                            <div class="flex items-center gap-1.5">
                                                <MapPin size={14} class="text-red-500" />
                                                <span class="font-medium truncate max-w-[200px]">{event.location}</span>
                                            </div>
                                        {/if}
                                    </div>

                                    <div class="flex flex-wrap gap-2">
                                        {#each event.tags as tag}
                                            <span class="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-indigo-100 flex items-center gap-1">
                                                <Tag size={10} />
                                                {tag.name}
                                            </span>
                                        {/each}
                                    </div>
                                </div>

                                <div class="flex items-center gap-2 shrink-0">
                                    <Button variant="ghost" size="icon" href={`/events/${event.id}/view`} class="rounded-xl hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                                        <Eye size={18} />
                                    </Button>
                                    <Button variant="ghost" size="icon" href={`/events/${event.id}`} class="rounded-xl hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                                        <Pencil size={18} />
                                    </Button>
                                    <AsyncButton 
                                        variant="ghost" 
                                        size="icon" 
                                        loading={deleteEvent.pending}
                                        onclick={async () => {
                                            if (!confirm(m.delete_confirm?.({ item: "Event" }) ?? "Are you sure?")) return;
                                            if (await deleteEvent({ id: event.id })) {
                                                toast.success(m.successfully_saved?.() ?? "Deleted");
                                            }
                                        }}
                                        class="rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600"
                                    >
                                        <Trash2 size={18} />
                                    </AsyncButton>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Pagination -->
                {#if totalPages > 1}
                    <div class="flex items-center justify-center gap-4 mt-8">
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={page === 1}
                            onclick={() => page--}
                            class="rounded-xl"
                        >
                            <ChevronLeft size={20} />
                        </Button>
                        <span class="text-sm font-bold text-gray-600">
                            {m.page?.() ?? "Page"} {page} {m.of?.() ?? "of"} {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={page === totalPages}
                            onclick={() => page++}
                            class="rounded-xl"
                        >
                            <ChevronRight size={20} />
                        </Button>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</div>
