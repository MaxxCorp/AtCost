<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { page } from "$app/state";
	import { readCampaign } from "./read.remote";
	import { updateCampaign } from "./update.remote";
	import { updateCampaignSchema } from "$lib/validations/campaigns";
	import CampaignForm from "$lib/components/campaigns/CampaignForm.svelte";
	import { LoadingSection, ErrorSection } from "@ac/ui";
	const campaignId = $derived(page.params.id || "");
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
				/>
			{/if}
		{/await}
	</div>
	{#snippet failed(error: unknown)}
		<ErrorSection headline={m.something_went_wrong()} message={error instanceof Error ? error.message : "An error occurred"} />
	{/snippet}
</svelte:boundary>
