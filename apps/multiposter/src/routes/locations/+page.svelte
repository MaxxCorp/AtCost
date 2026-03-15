<script lang="ts">
	import * as m from "$lib/paraglide/messages";
	import { listLocations } from "./list.remote";
	import { deleteLocation } from "./[id]/delete.remote";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
	import { MapPin, Pencil, Trash2, Home, Hash } from "@lucide/svelte";

	import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
	import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
	import BulkActionToolbar from "$lib/components/ui/BulkActionToolbar.svelte";
	import { handleDelete } from "$lib/hooks/handleDelete.svelte";
	import EmptyState from "$lib/components/ui/EmptyState.svelte";

	// Type definition for the list items
	type Location = Awaited<ReturnType<typeof listLocations>>[number];

	const query = listLocations();
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
		// Force reactivity
		selectedIds = new Set(selectedIds);
	}
	function selectAll(items: Location[]) {
		selectedIds = new Set(items.map((item) => item.id));
	}
	function deselectAll() {
		selectedIds = new Set();
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<Breadcrumb feature="locations" />
		<div class="bg-white shadow rounded-lg p-6">
			<div
				class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4"
			>
				<h1 class="text-3xl font-bold flex-shrink-0">{m.feature_locations_title()}</h1>
				<div class="flex-1 flex justify-end w-full md:w-auto">
					<BulkActionToolbar
						selectedCount={selectedIds.size}
						totalCount={query.current?.length ?? 0}
						onSelectAll={() => selectAll(query.current ?? [])}
						onDeselectAll={deselectAll}
						onDelete={async () => {
							await handleDelete({
								ids: [...selectedIds],
								deleteFn: deleteLocation,
								itemName: m.location().toLowerCase(),
							});
							deselectAll();
						}}
						newItemHref="/locations/new"
						newItemLabel={"+ " + m.create_item({ item: m.location() })}
					/>
				</div>
			</div>

			{#if query.loading}
				<LoadingSection message={m.loading_item({ item: m.feature_locations_title() })} />
			{:else if query.error}
				<ErrorSection
					headline={m.failed_to_load({ item: m.feature_locations_title() })}
					message={query.error?.message || m.something_went_wrong()}
					href="/locations"
					button={m.retry()}
				/>
			{:else if query.current}
				<div class="grid gap-4">
					{#if query.current.length === 0}
						<EmptyState
							icon={MapPin}
							title={m.no_items({ items: m.feature_locations_title() })}
							description={m.get_started_creating({ item: m.location() })}
							actionLabel={m.create_first({ item: m.location() })}
							actionHref="/locations/new"
						/>
					{:else}
						{#each query.current as location (location.id)}
							<div
								class="bg-white shadow rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow"
							>
								<input
									type="checkbox"
									checked={isSelected(location.id)}
									onchange={() =>
										toggleSelection(location.id)}
									class="mt-1 w-4 h-4 text-blue-600 rounded"
								/>
								<div class="flex-1 min-w-0">
									<div class="flex items-start gap-3 mb-2">
										<div
											class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0"
										>
											<MapPin size={20} />
										</div>
										<div class="min-w-0 flex-1">
											<h2
												class="text-xl font-semibold break-words"
											>
												<a
													href={`/locations/${location.id}`}
													class="hover:underline text-blue-600"
												>
													{location.name}
												</a>
											</h2>
											{#if location.roomId}
												<p
													class="text-sm text-gray-500 flex items-center gap-1"
												>
													<Hash size={14} />
													{m.room()}: {location.roomId}
												</p>
											{/if}
										</div>
									</div>

									<div
										class="flex items-start gap-2 mt-4 text-gray-600"
									>
										<Home
											size={16}
											class="text-gray-400 mt-1"
										/>
										<div class="flex flex-col text-sm">
											<span>
												{location.street}
												{location.houseNumber}
											</span>
											<span>
												{location.zip}
												{location.city}
											</span>
											{#if location.state || location.country}
												<span class="text-gray-400">
													{location.state || ""}, {location.country ||
														""}
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
											onclick={async () => {
												const success =
													await handleDelete({
														ids: [location.id],
														deleteFn:
															deleteLocation,
														itemName: m.feature_locations_title().toLowerCase(),
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
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
