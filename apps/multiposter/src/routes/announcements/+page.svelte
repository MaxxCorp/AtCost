<script lang="ts">
    import * as m from "$lib/paraglide/messages";
    import { listAnnouncements } from "./list.remote";
    import type { Announcement } from "./list.remote";
    import { deleteAnnouncements } from "./[id]/delete.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
    import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
    import BulkActionToolbar from "$lib/components/ui/BulkActionToolbar.svelte";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";
    import EmptyState from "$lib/components/ui/EmptyState.svelte";
    import { Megaphone, Calendar, Earth, Pencil, Trash2 } from "@lucide/svelte";

    const query = listAnnouncements();
    let selectedIds = $state<Set<string>>(new Set());

    function isSelected(id: string) {
        return selectedIds.has(id);
    }
    function toggleSelection(id: string) {
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
        } else {
            selectedIds.add(id);
        }
        selectedIds = new Set(selectedIds);
    }
    function selectAll(items: Announcement[]) {
        selectedIds = new Set(items.map((item) => item.id));
    }
    function deselectAll() {
        selectedIds = new Set();
    }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <Breadcrumb feature="announcements" />
        <div class="bg-white shadow rounded-lg p-6">
            <div
                class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4"
            >
                <h1 class="text-3xl font-bold flex-shrink-0">
                    {m.announcements()}
                </h1>
                <div class="flex-1 flex justify-end w-full md:w-auto">
                    <BulkActionToolbar
                        selectedCount={selectedIds.size}
                        totalCount={query.current?.length ?? 0}
                        onSelectAll={() => selectAll(query.current ?? [])}
                        onDeselectAll={deselectAll}
                        onDelete={async () => {
                            await handleDelete({
                                ids: [...selectedIds],
                                deleteFn: deleteAnnouncements,
                                itemName: m.announcement().toLowerCase(),
                            });
                            deselectAll();
                        }}
                        newItemHref="/announcements/new"
                        newItemLabel={"+ " +
                            m.create_item({ item: m.announcement() })}
                    />
                </div>
            </div>

            {#if query.loading}
                <LoadingSection
                    message={m.loading_item({ item: m.announcements() })}
                />
            {:else if query.error}
                <ErrorSection
                    headline={m.failed_to_load({ item: m.announcements() })}
                    message={query.error?.message || m.something_went_wrong()}
                    href="/announcements"
                    button={m.retry()}
                />
            {:else if query.current}
                <div class="grid gap-4">
                    {#if query.current.length === 0}
                        <EmptyState
                            icon={Megaphone}
                            title={m.no_items({ items: m.announcements() })}
                            description={m.get_started_announcement()}
                            actionLabel={m.create_first_announcement()}
                            actionHref="/announcements/new"
                        />
                    {:else}
                        {#each query.current as announcement (announcement.id)}
                            <div class="mb-6 last:mb-0">
                                <div
                                    class="bg-white shadow rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow"
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected(announcement.id)}
                                        onchange={() =>
                                            toggleSelection(announcement.id)}
                                        class="mt-1 w-4 h-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                                    />
                                    <div class="flex-1 w-full min-w-0">
                                        <div
                                            class="flex items-start gap-3 mb-2"
                                        >
                                            <div class="flex-1 min-w-0">
                                                <h2
                                                    class="text-xl font-semibold break-all text-pretty"
                                                >
                                                    <a
                                                        href={`/announcements/${announcement.id}/view`}
                                                        class="hover:underline text-amber-600"
                                                    >
                                                        {announcement.title}
                                                    </a>
                                                </h2>
                                            </div>
                                        </div>

                                        <div class="flex flex-col gap-1 mt-1">
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <Calendar
                                                    size={14}
                                                    class="text-gray-400"
                                                />
                                                <span
                                                    class="text-xs text-gray-500"
                                                >
                                                    {m.updated_on({
                                                        date: new Date(
                                                            announcement.updatedAt,
                                                        ).toLocaleDateString(),
                                                    })}
                                                </span>
                                            </div>
                                            {#if announcement.isPublic}
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <Earth
                                                        size={14}
                                                        class="text-green-500"
                                                    />
                                                    <span
                                                        class="text-xs text-green-600 font-medium"
                                                        >{m.public()}</span
                                                    >
                                                </div>
                                            {:else}
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <span
                                                        class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                                                        >{m.draft()}</span
                                                    >
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
                                            onclick={async () => {
                                                const success =
                                                    await handleDelete({
                                                        ids: [announcement.id],
                                                        deleteFn:
                                                            deleteAnnouncements,
                                                        itemName:
                                                            m.announcement().toLowerCase(),
                                                    });
                                                if (success) {
                                                    deselectAll();
                                                }
                                            }}
                                        >
                                            <Trash2 size={16} /> {m.delete()}
                                        </AsyncButton>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>
