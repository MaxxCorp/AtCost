<script lang="ts">
    import { listKiosks } from "./list.remote";
    import { listLocations } from "../locations/list.remote";
    import * as m from "$lib/paraglide/messages";
    import { deleteKiosk } from "./[id]/delete.remote";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { Monitor, Trash2, Pencil, MapPin } from "@lucide/svelte";
    import { EntityManager } from "@ac/ui";
    import { handleDelete } from "@ac/ui";

    type Kiosk = Awaited<ReturnType<typeof listKiosks>>["data"][number];
</script>

<div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
        <Breadcrumb feature="kiosks" />

        <div class="bg-white shadow rounded-lg p-6">
            <h1 class="text-2xl font-black mb-6 text-gray-900">{m.kiosks()}</h1>
            <EntityManager
                title={m.kiosks()}
                icon={Monitor}
                mode="standalone"
                listItemsRemote={listKiosks as any}
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
                        deleteFn: deleteKiosk,
                        itemName: m.kiosks(),
                    });
                }}
                loadingLabel={m.loading_kiosks()}
                noItemsFoundLabel={m.no_kiosks()}
                searchPredicate={(k: Kiosk, q: string) => k.name.toLowerCase().includes(q.toLowerCase())}
                createHref="/kiosks/new"
                createLabel={m.create_item({ item: "Kiosk" })}
            >
                {#snippet renderListItem(kiosk: Kiosk, { isSelected, toggleSelection, deleteItem })}
                    <div class="bg-white border rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow hover:shadow-md">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onchange={() => toggleSelection(kiosk.id)}
                            class="mt-1 w-4 h-4 text-blue-600 rounded shrink-0"
                        />

                        <div class="flex-1 min-w-0">
                            <div class="flex items-start gap-4 mb-2">
                                <div class="flex-1 min-w-0">
                                    <h2 class="text-xl font-semibold break-all text-pretty">
                                        <a href={`/kiosks/${kiosk.id}/view`} target="_blank" class="hover:underline text-blue-600">
                                            {kiosk.name}
                                        </a>
                                    </h2>
                                </div>
                            </div>

                            {#if kiosk.description}
                                <div class="mt-2 text-gray-600 text-sm line-clamp-2">
                                    <p>{kiosk.description}</p>
                                </div>
                            {/if}

                            {#if kiosk.locations && kiosk.locations.length > 0}
                                <div class="mt-4 flex flex-wrap gap-3">
                                    {#each kiosk.locations as loc}
                                        <div class="flex items-center gap-4 bg-gray-50 pl-3 pr-2 py-2 rounded-xl border border-gray-100 transition-colors hover:bg-gray-100 shadow-sm">
                                            <div class="flex items-center gap-2 min-w-0">
                                                <MapPin size={16} class="text-red-500 shrink-0" />
                                                <span class="text-xs font-bold text-gray-700 truncate">{loc.name}</span>
                                            </div>
                                            {#if loc.publicContactQrCodePath}
                                                <div class="bg-white p-1 border rounded-lg shadow-inner shrink-0 flex items-center justify-center">
                                                    <img src={loc.publicContactQrCodePath} alt="Contact QR" class="w-14 h-14 object-contain" />
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            {/if}

                            <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                                <div>
                                    <span class="text-gray-500 mr-1">{m.loop_label()}</span>
                                    <span class="font-medium">{kiosk.loopDuration}s</span>
                                </div>
                                <div>
                                    <span class="text-gray-500 mr-1">{m.look_ahead_label()}</span>
                                    <span class="font-medium">{m.days_count({ count: Math.round(kiosk.lookAhead / 86400) })}</span>
                                </div>
                                <div>
                                    <span class="text-gray-500 mr-1">{m.look_past_label()}</span>
                                    <span class="font-medium">{m.days_count({ count: Math.round(kiosk.lookPast / 86400) })}</span>
                                </div>
                            </div>

                            <div class="mt-4">
                                <p class="text-xs text-gray-400">
                                    {m.created()}: {new Date(kiosk.createdAt).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div class="flex flex-col gap-2 shrink-0">
                            <Button
                                href={`/kiosks/${kiosk.id}`}
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
                                onclick={() => deleteItem(kiosk)}
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
