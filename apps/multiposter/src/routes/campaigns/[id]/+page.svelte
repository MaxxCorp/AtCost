<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { page } from "$app/state";
	import { readCampaign } from "./read.remote";
	import { updateCampaign } from "./update.remote";
	import { updateCampaignSchema } from "$lib/validations/campaigns";
	import CampaignForm from "$lib/components/campaigns/CampaignForm.svelte";
	import LoadingSection from "$lib/components/ui/LoadingSection.svelte";
	import ErrorSection from "$lib/components/ui/ErrorSection.svelte";
</script>

{#await readCampaign(page.params.id ?? "")}
	<LoadingSection message={m.loading_item({ item: m.feature_campaigns_title() })} />
{:then campaign}
	{#if campaign}
		<CampaignForm
			remoteFunction={updateCampaign}
			validationSchema={updateCampaignSchema}
			isUpdating={true}
			initialData={campaign}
		/>
	{:else}
		<ErrorSection
			headline={m.not_found({ item: m.feature_campaigns_title() })}
			message={m.not_found_message({ item: m.feature_campaigns_title() })}
		/>
	{/if}
{:catch error}
	<ErrorSection headline={m.something_went_wrong()} message={error.message} />
{/await}
