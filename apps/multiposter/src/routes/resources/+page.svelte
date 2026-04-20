<script lang="ts">
    import { listResources } from "./list.remote";
    import { listLocations } from "../locations/list.remote";
    import * as m from "$lib/paraglide/messages";
    import { deleteResource } from "./[id]/delete.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { Box, Pencil, Trash2 } from "@lucide/svelte";
    import { EntityManager } from "@ac/ui";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";

    type Resource = Awaited<ReturnType<typeof listResources>>["data"][number];
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <Breadcrumb feature="resources" />

        <div class="bg-white shadow rounded-lg p-6">
            <h1 class="text-2xl font-black mb-6 text-gray-900">{m.resources()}</h1>
            <EntityManager
                title={m.resources()}
                icon={Box}
                mode="standalone"
                listItemsRemote={listResources as any}
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
                        deleteFn: deleteResource,
                        itemName: m.resources(),
                    });
                }}
                loadingLabel={m.loading_resources()}
                noItemsFoundLabel={m.no_resources()}
                searchPredicate={(r: Resource, q: string) => r.name.toLowerCase().includes(q.toLowerCase())}
                createHref="/resources/new"
                createLabel={m.create_item({ item: "Resource" })}
            >
                {#snippet renderListItem(resource: Resource, { isSelected, toggleSelection, deleteItem })}
                    <div class="bg-white border rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow hover:shadow-md">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onchange={() => toggleSelection(resource.id)}
                            class="mt-1 w-4 h-4 text-blue-600 rounded shrink-0"
                        />

                        <div class="flex-1 min-w-0">
                            <div class="flex items-start gap-3 mb-2">
                                <div class="flex-1 min-w-0">
                                    <h2 class="text-xl font-semibold break-all text-pretty">
                                        <a href={`/resources/${resource.id}`} class="hover:underline text-blue-600">
                                            {resource.name}
                                        </a>
                                    </h2>
                                </div>
                            </div>

                            <div class="mt-2 text-gray-600 space-y-1">
                                <p class="text-sm">
                                    <span class="font-medium">{m.type_label()}</span>
                                    {resource.type}
                                </p>
                                {#if resource.locationName}
                                    <p class="text-sm">
                                        <span class="font-medium">{m.location_label()}</span>
                                        {resource.locationName}
                                    </p>
                                {/if}
                                {#if resource.description}
                                    <p class="text-sm line-clamp-2">
                                        {resource.description}
                                    </p>
                                {/if}
                            </div>

                            <div class="mt-4">
                                <p class="text-xs text-gray-400">
                                    {m.created_label()} {new Date(resource.createdAt).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div class="flex flex-col gap-2 shrink-0">
                            <Button
                                href={`/resources/${resource.id}`}
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
                                onclick={() => deleteItem(resource)}
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
