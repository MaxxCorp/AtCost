<script lang="ts">
	import * as m from "#lib/paraglide/messages.js";
	import { page } from "$app/state";
	import { readCampaign } from "./read.remote";
	import { updateCampaign } from "./update.remote";
	import { updateCampaignSchema } from "#lib/validations/campaigns.js";
	import CampaignForm from "#lib/components/campaigns/CampaignForm.svelte";
	import { LoadingSection, ErrorSection, recordActiveItem, getLastListUrl } from "@ac/ui";
	const campaignId = $derived(page.params.id || "");

	$effect(() => {
		if (campaignId) {
			recordActiveItem("campaigns", campaignId);
		}
	});
</script>

<svelte:boundary>
	{#if $effect.pending()}
		<LoadingSection message={m.loading_item({ item: m.feature_campaigns_title() })} />
	{/if}
	<div class={[$effect.pending() && "opacity-50 pointer-events-none"]}>
		{#await readCampaign(campaignId) then campaign}
			{#if campaign}
				{#key campaignId}
				<CampaignForm
					remoteFunction={updateCampaign}
					validationSchema={updateCampaignSchema}
					isUpdating={true}
					initialData={campaign}
				/>
				{/key}
			{:else}
				<ErrorSection
					headline={m.not_found({ item: m.feature_campaigns_title() })}
					message={m.not_found_message({ item: m.feature_campaigns_title() })}
					href={getLastListUrl("campaigns", "/campaigns")}
					button={m.back_to_list()}
				/>
			{/if}
		{/await}
	</div>
	{#snippet failed(error: unknown)}
		<ErrorSection
			headline={m.something_went_wrong()}
			message={error instanceof Error ? error.message : "An error occurred"}
			href={getLastListUrl("campaigns", "/campaigns")}
			button={m.back_to_list()}
		/>
	{/snippet}
</svelte:boundary>
