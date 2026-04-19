<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { listAnnouncements } from "./list.remote";
    import { listLocations } from "../locations/list.remote";
    import { deleteAnnouncements } from "./[id]/delete.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { EntityManager } from "@ac/ui";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import { Megaphone, Calendar, Earth, Pencil, Trash2 } from "@lucide/svelte";

    type Announcement = Awaited<ReturnType<typeof listAnnouncements>>["data"][number];
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <Breadcrumb feature="announcements" />
        
        <div class="bg-white shadow rounded-lg p-6">
            <EntityManager
                title={m.announcements()}
                icon={Megaphone}
                mode="standalone"
                listItemsRemote={listAnnouncements as any}
                filterAssociations={[
                    {
                        id: "locationId",
                        label: m.locations(),
                        listRemote: listLocations as any,
                        getOptionLabel: (l: any) => l.name,
                    },
                ]}
                deleteItemRemote={async (ids: string[]) => {
                    return await handleDelete({
                        ids,
                        deleteFn: deleteAnnouncements,
                        itemName: m.announcement().toLowerCase(),
                    });
                }}
                loadingLabel={m.loading_item({ item: m.announcements() })}
                noItemsFoundLabel={m.no_items({ items: m.announcements() })}
                searchPredicate={(a: Announcement, q: string) => a.title.toLowerCase().includes(q.toLowerCase())}
                createHref="/announcements/new"
                createLabel={m.create_item({ item: m.announcement() })}
            >
                {#snippet renderListItem(announcement: Announcement, { isSelected, toggleSelection, deleteItem })}
                    <div class="bg-white border rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow hover:shadow-md">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onchange={() => toggleSelection(announcement.id)}
                            class="mt-1 w-4 h-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded shrink-0"
                        />
                        <div class="flex-1 w-full min-w-0">
                            <div class="flex items-start gap-3 mb-2">
                                <div class="flex-1 min-w-0">
                                    <h2 class="text-xl font-semibold break-all text-pretty">
                                        <a href={`/announcements/${announcement.id}/view`} class="hover:underline text-amber-600">
                                            {announcement.title}
                                        </a>
                                    </h2>
                                </div>
                            </div>

                            <div class="flex flex-col gap-1 mt-1">
                                <div class="flex items-center gap-2">
                                    <Calendar size={14} class="text-gray-400" />
                                    <span class="text-xs text-gray-500">
                                        {m.updated_on({
                                            date: new Date(announcement.updatedAt).toLocaleDateString(),
                                        })}
                                    </span>
                                </div>
                                {#if announcement.isPublic}
                                    <div class="flex items-center gap-2">
                                        <Earth size={14} class="text-green-500" />
                                        <span class="text-xs text-green-600 font-medium">{m.public()}</span>
                                    </div>
                                {:else}
                                    <div class="flex items-center gap-2">
                                        <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{m.draft()}</span>
                                    </div>
                                {/if}
                            </div>
                        </div>
                        <div class="flex flex-col gap-2 shrink-0">
                            <Button
                                href={`/announcements/${announcement.id}`}
                                variant="default"
                                size="default"
                                class="flex items-center gap-2 w-[120px] justify-center"
                            >
                                <Pencil size={16} /> {m.edit()}
                            </Button>
                            <AsyncButton
                                variant="destructive"
                                size="default"
                                loading={false}
                                loadingLabel={m.deleting()}
                                class="flex items-center gap-2 w-[120px] justify-center"
                                onclick={() => deleteItem(announcement)}
                            >
                                <Trash2 size={16} /> {m.delete()}
                            </AsyncButton>
                        </div>
                    </div>
                {/snippet}
            </EntityManager>
        </div>
    </div>
</div>
