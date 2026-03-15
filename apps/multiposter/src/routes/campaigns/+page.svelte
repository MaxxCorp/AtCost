<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { listCampaigns } from "./list.remote";
	import { deleteCampaigns } from "./[id]/delete.remote";
	import type { Campaign } from "./list.remote";
	import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
	import { Megaphone, Pencil, Trash2 } from "@lucide/svelte";
	import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
	import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
	import BulkActionToolbar from "$lib/components/ui/BulkActionToolbar.svelte";
	import { handleDelete } from "$lib/hooks/handleDelete.svelte";
	import EmptyState from "$lib/components/ui/EmptyState.svelte";

	const query = listCampaigns();
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
	function selectAll(items: Campaign[]) {
		selectedIds = new Set(items.map((item) => item.id));
	}
	function deselectAll() {
		selectedIds = new Set();
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<Breadcrumb feature="campaigns" />
		<div class="bg-white shadow rounded-lg p-6">
			<div
				class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4"
			>
				<h1 class="text-3xl font-bold flex-shrink-0">{m.feature_campaigns_title()}</h1>
				<div class="flex-1 flex justify-end w-full md:w-auto">
					<BulkActionToolbar
						selectedCount={selectedIds.size}
						totalCount={query.current?.length ?? 0}
						onSelectAll={() => selectAll(query.current ?? [])}
						onDeselectAll={deselectAll}
						onDelete={async () => {
							await handleDelete({
								ids: [...selectedIds],
								deleteFn: deleteCampaigns,
								itemName: m.feature_campaigns_title().toLowerCase(),
							});
							deselectAll();
						}}
						newItemHref="/campaigns/new"
						newItemLabel={"+ " + m.create_item({ item: m.campaign_label() })}
					/>
				</div>
			</div>

			{#if query.loading}
				<LoadingSection message={m.loading_item({ item: m.feature_campaigns_title() })} />
			{:else if query.error}
				<ErrorSection
					headline={m.failed_to_load({ item: m.feature_campaigns_title() })}
					message={query.error?.message || m.something_went_wrong()}
					href="/campaigns"
					button={m.retry()}
				/>
			{:else if query.current}
				<div class="grid gap-4">
					{#if query.current.length === 0}
						<EmptyState
							icon={Megaphone}
							title={m.no_items({ items: m.feature_campaigns_title() })}
							description={m.get_started_campaign()}
							actionLabel={m.create_first({ item: m.campaign_label() })}
							actionHref="/campaigns/new"
						/>
					{:else}
						{#each query.current as campaign (campaign.id)}
							<div class="mb-6 last:mb-0">
								<div
									class="bg-white shadow rounded-lg p-6 flex flex-col sm:flex-row items-start gap-4 transition-shadow"
								>
									<input
										type="checkbox"
										checked={isSelected(campaign.id)}
										onchange={() =>
											toggleSelection(campaign.id)}
										class="mt-1 w-4 h-4 text-blue-600"
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
														href={`/campaigns/${campaign.id}`}
														class="hover:underline text-blue-600"
													>
														{campaign.name}
													</a>
												</h2>
											</div>
										</div>
										<div class="mt-3">
											<p
												class="text-xs text-gray-500 mt-3"
											>
												{m.created()}: {new Date(
													campaign.createdAt,
												).toLocaleString()}
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
											onclick={async () => {
												const success =
													await handleDelete({
														ids: [campaign.id],
														deleteFn:
															deleteCampaigns,
														itemName: m.feature_campaigns_title().toLowerCase(),
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
