<script lang="ts">
	import * as m from "$lib/paraglide/messages";
	import { listLocations } from "./list.remote";
	import { deleteLocation } from "./[id]/delete.remote";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
	import { MapPin, Pencil, Trash2, Home, Hash } from "@lucide/svelte";

	import { EntityManager } from "@ac/ui";
	import { handleDelete } from "$lib/hooks/handleDelete.svelte";

	// Type definition for the list items
	type Location = Awaited<ReturnType<typeof listLocations>>["data"][number];
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<Breadcrumb feature="locations" />
		<div class="bg-white shadow rounded-lg p-6">
			<EntityManager 
				title={m.feature_locations_title()} 
				icon={MapPin} 
				mode="standalone"
				listItemsRemote={listLocations as any}
				deleteItemRemote={async (ids: string[]) => {
					return await handleDelete({
						ids,
						deleteFn: deleteLocation,
						itemName: m.location().toLowerCase(),
					});
				}}
				loadingLabel={m.loading_item({ item: m.feature_locations_title() })}
				noItemsFoundLabel={m.no_items({ items: m.feature_locations_title() })}
				searchPredicate={(l: Location, q: string) => l.name.toLowerCase().includes(q.toLowerCase())}
			>
				{#snippet renderListItem(location: Location, { isSelected, toggleSelection, deleteItem })}
					<div class="bg-white border rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow hover:shadow-md">
						<input
							type="checkbox"
							checked={isSelected}
							onchange={() => toggleSelection(location.id)}
							class="mt-1 w-4 h-4 text-blue-600 rounded shrink-0"
						/>
						<div class="flex-1 min-w-0">
							<div class="flex items-start gap-3 mb-2">
								<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
									<MapPin size={20} />
								</div>
								<div class="min-w-0 flex-1">
									<h2 class="text-xl font-semibold break-words">
										<a
											href={`/locations/${location.id}`}
											class="hover:underline text-blue-600"
										>
											{location.name}
										</a>
									</h2>
									{#if location.roomId}
										<p class="text-sm text-gray-500 flex items-center gap-1">
											<Hash size={14} />
											{m.room()}: {location.roomId}
										</p>
									{/if}
								</div>
							</div>

							<div class="flex items-start gap-2 mt-4 text-gray-600">
								<Home size={16} class="text-gray-400 mt-1" />
								<div class="flex flex-col text-sm">
									<span>
										{location.street || ""} {location.houseNumber || ""}
									</span>
									<span>
										{location.zip || ""} {location.city || ""}
									</span>
									{#if location.state || location.country}
										<span class="text-gray-400">
											{location.state || ""}{location.state && location.country ? ", " : ""}{location.country || ""}
										</span>
									{/if}
								</div>
							</div>
						</div>
						
						<div class="flex flex-col gap-2 shrink-0">
							<Button
								href={`/locations/${location.id}`}
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
								onclick={() => deleteItem(location)}
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
