<script lang="ts">
	import CampaignForm from "$lib/components/campaigns/CampaignForm.svelte";
	import { createCampaign } from "./create.remote";
	import { createCampaignSchema } from "$lib/validations/campaigns";

    const formId = crypto.randomUUID();
    const rf = createCampaign.for(formId);
</script>

<CampaignForm
	remoteFunction={rf}
	validationSchema={createCampaignSchema}
/>
