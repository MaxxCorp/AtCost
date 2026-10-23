<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { Calendar, MapPin, Folder, ExternalLink } from "@lucide/svelte";
    import { type Announcement } from "@ac/validations";


    let { announcement }: { announcement: any } = $props();
</script>

<div class="space-y-8">
    <div class="border-b pb-6">
        <div class="flex items-center gap-3 mb-2 flex-wrap">
            <h1 class="text-3xl font-bold text-gray-900">
                {announcement.title}
            </h1>
            {#if announcement.tags && announcement.tags.length > 0}
                {#each announcement.tags as tag}
                    <span
                        class="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100"
                    >
                        #{typeof tag === 'string' ? tag : tag.name}
                    </span>
                {/each}
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

    {#if announcement.files && announcement.files.length > 0}
        <div class="mt-8 pt-6 border-t">
            <h3
                class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4"
            >
                {m.feature_files_title?.() || "Files & Documents"}
            </h3>
            <div class="space-y-3">
                {#each announcement.files as file (file.id || file.name)}
                    {@const href = file.webUrl || file.targetUrl}
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Folder size={18} />
                        </div>
                        <div class="flex items-center gap-2 min-w-0">
                            {#if href}
                                <a
                                    {href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1.5 truncate"
                                >
                                    <span class="truncate">{file.name}</span>
                                    <ExternalLink size={14} class="flex-shrink-0" />
                                </a>
                            {:else}
                                <span class="font-medium text-gray-900 truncate">{file.name}</span>
                            {/if}
                            {#if file.isShortcut}
                                <span class="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200 flex-shrink-0">
                                    Shortcut
                                </span>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>
