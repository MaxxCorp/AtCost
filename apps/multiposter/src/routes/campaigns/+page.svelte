<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { listCampaigns } from "./list.remote";
	import { deleteCampaigns } from "./[id]/delete.remote";

	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
	import { Megaphone, Pencil, Trash2 } from "@lucide/svelte";
    import { EntityManager } from "@ac/ui";
    import { handleDelete } from "$lib/hooks/handleDelete.svelte";

    type Campaign = Awaited<ReturnType<typeof listCampaigns>>["data"][number];
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<Breadcrumb feature="campaigns" />
		<div class="bg-white shadow rounded-lg p-6">
            <EntityManager 
                title={m.feature_campaigns_title()} 
                icon={Megaphone} 
                mode="standalone"
                listItemsRemote={listCampaigns}
                createHref="/campaigns/new"
                createLabel={m.create_item({ item: "Campaign" })}
                deleteItemRemote={async (ids: string[]) => {
                    return await handleDelete({
                        ids,
                        deleteFn: deleteCampaigns,
                        itemName: m.feature_campaigns_title().toLowerCase(),
                    });
                }}
                loadingLabel={m.loading_item({ item: m.feature_campaigns_title() })}
                noItemsFoundLabel={m.no_items({ items: m.feature_campaigns_title() })}
                searchPredicate={(c: Campaign, q: string) => c.name.toLowerCase().includes(q.toLowerCase())}
            >
                {#snippet renderListItem(campaign: Campaign, { isSelected, toggleSelection, deleteItem })}
                    <div class="bg-white border rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow hover:shadow-md">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onchange={() => campaign.id && toggleSelection(campaign.id)}
                            class="mt-1 w-4 h-4 text-blue-600 rounded shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start gap-3 mb-2">
                                <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                                    <Megaphone size={20} />
                                </div>
                                <div class="min-w-0">
                                    <h2 class="text-xl font-semibold break-all text-pretty">
                                        <a href={`/campaigns/${campaign.id}`} class="hover:underline text-blue-600">
                                            {campaign.name}
                                        </a>
                                    </h2>
                                </div>
                            </div>

                            <div class="mt-3">
                                <p class="text-xs text-gray-500 mt-3">
                                    {m.created()}: {new Date(campaign.createdAt).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div class="flex flex-col gap-2 shrink-0">
                            <Button
                                href={`/campaigns/${campaign.id}`}
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
                                onclick={() => deleteItem(campaign)}
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
