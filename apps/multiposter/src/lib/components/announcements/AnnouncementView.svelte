<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { Calendar, MapPin } from "@lucide/svelte";
    import type { Announcement } from "../../../routes/announcements/list.remote";

    let { announcement } = $props<{ announcement: any }>();
</script>

<div class="space-y-8">
    <div class="border-b pb-6">
        <div class="flex items-center gap-3 mb-2 flex-wrap">
            <h1 class="text-3xl font-bold text-gray-900">
                {announcement.title}
            </h1>
            {#if announcement.isPublic}
                <span
                    class="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full"
                    >{m.public()}</span
                >
            {/if}
        </div>
        <div class="text-sm text-gray-500 flex items-center gap-2 mt-2">
            <Calendar size={14} />
            {m.updated_on({
                date: new Date(announcement.updatedAt).toLocaleDateString(),
            })}
        </div>
    </div>

    <div class="prose max-w-none text-gray-700 whitespace-pre-wrap">
        {@html announcement.content}
    </div>

    {#if announcement.locations && announcement.locations.length > 0}
        <div class="mt-8 pt-6 border-t">
            <h3
                class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4"
            >
                {m.locations()}
            </h3>
            <div class="space-y-4">
                {#each announcement.locations as loc}
                    <div class="flex items-start gap-3">
                        <div class="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <MapPin size={18} />
                        </div>
                        <div>
                            <div class="font-medium text-gray-900">{loc.name}</div>
                            <div class="text-sm text-gray-600">
                                {loc.street}
                                {loc.houseNumber}<br />
                                {loc.zip}
                                {loc.city}
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>
