<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { page } from "$app/state";
	import { readCampaign } from "./read.remote";
	import { updateCampaign } from "./update.remote";
	import { updateCampaignSchema } from "$lib/validations/campaigns";
	import CampaignForm from "$lib/components/campaigns/CampaignForm.svelte";
	import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
	import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
	const campaignId = $derived(page.params.id || "");
	const query = $derived(readCampaign(campaignId));
</script>

{#if query.loading && !query.current}
	<LoadingSection message={m.loading_item({ item: m.feature_campaigns_title() })} />
{:else if query.current}
	{@const campaign = query.current}
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
{:else if query.error}
	{@const error = query.error}
	<ErrorSection headline={m.something_went_wrong()} message={error.message} />
{/if}
